#!/usr/bin/env python3
"""
Spotify Downloader — Web Edition.

A CLI tool ported from SearchExtendedBot that:
- Fetches metadata for a Spotify playlist or single track
- Searches YouTube/SoundCloud for the best matching version
  (preferring Extended Mix / Original Mix for short tracks)
- Downloads as MP3 @ 320 kbps with embedded metadata + cover art

Usage:
  python spotify_dl.py fetch   <spotify_url>           -> prints tracks JSON
  python spotify_dl.py download <track_json> <out_dir>  -> downloads one track

Logs are emitted as JSON lines to stdout (one JSON object per line):
  {"level": "info|warning|error", "message": "...", "ts": "..."}
"""

import sys
import os
import io
import re
import json
import time
import hmac
import hashlib
import struct
import shutil
import urllib.parse
import subprocess
from providers import Downloader, BeatportSearch, SongLink
import difflib
from typing import List, Optional
from dataclasses import dataclass, asdict

# Optional imports for ID3v2.3 metadata embedding (used for embedding
# rich metadata from Lossless-Core into MP3 files).
try:
    from mutagen.mp3 import MP3, HeaderNotFoundError
    from mutagen.id3 import ID3, TIT2, TPE1, TALB, APIC, TRCK, TDRC, TSRC, TCON, COMM, ID3NoHeaderError
    HAS_MUTAGEN = True
except ImportError:
    HAS_MUTAGEN = False

# Lossless-Core — built-in module for fetching Spotify metadata (title,
# artist, album, ISRC, release date, cover art). All metadata requests go
# through this module.
try:
    import lossless_core
    HAS_LOSSLESS_CORE = True
except ImportError:
    HAS_LOSSLESS_CORE = False

# -------------------------------------------------------------------
# Logging — JSON lines to stdout
# -------------------------------------------------------------------

def emit_log(level: str, message: str, **extra):
    """Emit a single JSON log line to stdout (consumed by Node orchestrator)."""
    payload = {
        "level": level,
        "message": message,
        "ts": time.strftime("%H:%M:%S"),
    }
    if extra:
        payload["extra"] = extra
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def info(msg, **kw):
    emit_log("info", msg, **kw)


def warning(msg, **kw):
    emit_log("warning", msg, **kw)


def error(msg, **kw):
    emit_log("error", msg, **kw)


# -------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------

# Default values for the extended-mix search algorithm. These can be
# overridden at runtime via the SD_SEARCH_PARAMS env var (JSON object).
DEFAULT_MAX_DURATION_SECONDS = 4 * 60 + 30  # 4:30
DEFAULT_SHORT_TITLE_KEYWORDS = r"\b(mixed|cut|radioedit|radio\s*edit)\b"
DEFAULT_SIMILARITY_THRESHOLD = 0.70
DEFAULT_EXTENDED_MIX_SUFFIXES = ["Extended Mix", "Original Mix"]
DEFAULT_EXISTING_SUFFIX_PATTERN = r"\b(extended|original|club)\s+mix\b"
# Pattern that matches "(ArtistName Remix)" / "(SomeArtist Remix)" suffixes
# in Spotify titles — e.g. "Dracula (JENNIE Remix)". When present, we always
# search for a longer version (just like for short tracks).
DEFAULT_REMIX_SUFFIX_PATTERN = r"\([^\)]*\bremix\b[^\)]*\)"

# Module-level configuration — populated from env vars at process start.
MAX_DURATION_SECONDS = DEFAULT_MAX_DURATION_SECONDS
SHORT_TITLE_KEYWORDS = re.compile(DEFAULT_SHORT_TITLE_KEYWORDS, re.IGNORECASE)
SIMILARITY_THRESHOLD = DEFAULT_SIMILARITY_THRESHOLD
EXTENDED_MIX_SUFFIXES = list(DEFAULT_EXTENDED_MIX_SUFFIXES)
EXISTING_SUFFIX_PATTERN = re.compile(DEFAULT_EXISTING_SUFFIX_PATTERN, re.IGNORECASE)
REMIX_SUFFIX_PATTERN = re.compile(DEFAULT_REMIX_SUFFIX_PATTERN, re.IGNORECASE)


def safe_compile_regex(val: str, fallback: re.Pattern, max_len: int = 128) -> re.Pattern:
    if not isinstance(val, str) or not val.strip() or len(val) > max_len:
        return fallback
    if re.search(r'\([^)]*[\+\*][^)]*\)[\+\*]', val):
        warning("Unsafe regex pattern detected (potential ReDoS), using default fallback")
        return fallback
    try:
        return re.compile(val, re.IGNORECASE)
    except re.error as e:
        warning(f"Invalid regex pattern, using default fallback: {e}")
        return fallback


def _load_search_config_from_env():
    """Read SD_SEARCH_MODE and SD_SEARCH_PARAMS env vars and apply them to
    the module-level configuration. Called once at process start.
    """
    global MAX_DURATION_SECONDS, SHORT_TITLE_KEYWORDS, SIMILARITY_THRESHOLD
    global EXTENDED_MIX_SUFFIXES, EXISTING_SUFFIX_PATTERN, REMIX_SUFFIX_PATTERN

    params_raw = os.environ.get("SD_SEARCH_PARAMS", "").strip()
    if params_raw:
        try:
            p = json.loads(params_raw)
            if not isinstance(p, dict):
                raise ValueError("SD_SEARCH_PARAMS must be a JSON object")
            if "maxDurationSeconds" in p:
                try:
                    MAX_DURATION_SECONDS = int(p["maxDurationSeconds"])
                except (TypeError, ValueError):
                    pass
            if "shortTitleKeywords" in p:
                SHORT_TITLE_KEYWORDS = safe_compile_regex(p["shortTitleKeywords"], SHORT_TITLE_KEYWORDS)
            if "similarityThreshold" in p:
                try:
                    SIMILARITY_THRESHOLD = float(p["similarityThreshold"])
                except (TypeError, ValueError):
                    pass
            if "extendedMixSuffixes" in p and isinstance(p["extendedMixSuffixes"], str):
                suffixes = [s.strip() for s in p["extendedMixSuffixes"].split(",") if s.strip()]
                if suffixes:
                    EXTENDED_MIX_SUFFIXES = suffixes
            if "existingSuffixPattern" in p:
                EXISTING_SUFFIX_PATTERN = safe_compile_regex(p["existingSuffixPattern"], EXISTING_SUFFIX_PATTERN)
            if "remixSuffixPattern" in p:
                REMIX_SUFFIX_PATTERN = safe_compile_regex(p["remixSuffixPattern"], REMIX_SUFFIX_PATTERN)
        except (json.JSONDecodeError, ValueError) as e:
            warning(f"Failed to parse SD_SEARCH_PARAMS, using defaults: {e}")


# Apply env-driven configuration at import time
_load_search_config_from_env()


try:
    from curl_cffi.requests import Session as CffiSession
    USE_CFFI = True
except ImportError:
    import requests as _requests

    class CffiSession:
        def __init__(self, **kwargs):
            self._s = _requests.Session()

        def get(self, url, **kwargs):
            return self._s.get(url, **kwargs)

        def post(self, url, **kwargs):
            return self._s.post(url, **kwargs)

        def __enter__(self):
            return self

        def __exit__(self, *args):
            self._s.close()

    USE_CFFI = False


# -------------------------------------------------------------------
# Data Models
# -------------------------------------------------------------------

@dataclass
class Track:
    title: str
    artist: str
    duration_ms: int = 0
    cover_url: Optional[str] = None
    spotify_url: Optional[str] = None
    track_id: Optional[str] = None
    album: Optional[str] = None
    label: Optional[str] = None
    release_date: Optional[str] = None

    @property
    def duration_seconds(self) -> float:
        return self.duration_ms / 1000.0

    def to_dict(self) -> dict:
        return asdict(self)


# -------------------------------------------------------------------
# Spotify Auth (TOTP)
# -------------------------------------------------------------------

def _decode_secret(secret_str: str) -> bytes:
    t, n = 33, 9
    r_arr = []
    for i, char in enumerate(secret_str):
        val = ord(char) ^ ((i % t) + n)
        r_arr.append(str(val))
    return "".join(r_arr).encode("utf-8")


def _generate_hotp(secret_bytes: bytes, counter: int, digits: int = 6) -> str:
    counter_bytes = struct.pack(">Q", counter)
    mac = hmac.new(secret_bytes, counter_bytes, hashlib.sha1).digest()
    offset = mac[-1] & 0x0F
    binary = struct.unpack(">I", mac[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(binary % (10**digits)).zfill(digits)


def _generate_totp(secret_bytes: bytes, timestamp_sec: float = None, period: int = 30, digits: int = 6) -> str:
    if timestamp_sec is None:
        timestamp_sec = time.time()
    counter = int(timestamp_sec // period)
    return _generate_hotp(secret_bytes, counter, digits)


def _get_totp_params() -> dict:
    target_secret = ',7/*F("rLJ2oxaKL^f+E1xvP@N'
    secret_bytes = _decode_secret(target_secret)
    current_ts = time.time()
    totp = _generate_totp(secret_bytes, current_ts)
    return {
        "reason": "init",
        "productType": "web-player",
        "totp": totp,
        "totpServer": totp,
        "totpVer": "61",
    }


def _get_access_token(session) -> dict:
    session.get("https://open.spotify.com/")
    totp_params = _get_totp_params()
    query_string = urllib.parse.urlencode(totp_params)
    url = f"https://open.spotify.com/api/token?{query_string}"
    headers = {
        "accept": "application/json",
        "referer": "https://open.spotify.com/",
    }
    resp = session.get(url, headers=headers)
    if resp.status_code != 200:
        raise RuntimeError(f"Failed to get Spotify token: HTTP {resp.status_code}")
    data = resp.json()
    access_token = data.get("accessToken")
    client_token = data.get("clientToken")
    if not access_token:
        raise RuntimeError("accessToken missing in Spotify response")
    return {"access_token": access_token, "client_token": client_token}


# -------------------------------------------------------------------
# Spotify API
# -------------------------------------------------------------------

PLAYLIST_HASH = "346811f856fb0b7e4f6c59f8ebea78dd081c6e2fb01b77c954b26259d5fc6763"
TRACK_HASH = "612585ae06ba435ad26369870deaae23b5c8800a256cd8a57e08eddc25a37294"


def extract_spotify_id(url: str):
    playlist_match = re.search(r"playlist[:/]([^/?]+)", url)
    if playlist_match:
        return "playlist", playlist_match.group(1)
    album_match = re.search(r"album[:/]([^/?]+)", url)
    if album_match:
        return "album", album_match.group(1)
    track_match = re.search(r"track[:/]([^/?]+)", url)
    if track_match:
        return "track", track_match.group(1)
    return None, None


def fetch_single_track(track_id: str) -> List[Track]:
    kw = {"impersonate": "chrome124"} if USE_CFFI else {}
    with CffiSession(**kw) as session:
        token_data = _get_access_token(session)
        headers = {
            "accept": "application/json",
            "app-platform": "WebPlayer",
            "authorization": f'Bearer {token_data["access_token"]}',
            "client-token": token_data["client_token"],
            "content-type": "application/json;charset=UTF-8",
        }
        payload = {
            "variables": {"uri": f"spotify:track:{track_id}"},
            "operationName": "getTrack",
            "extensions": {
                "persistedQuery": {
                    "version": 1,
                    "sha256Hash": TRACK_HASH,
                }
            },
        }
        resp = session.post(
            "https://api-partner.spotify.com/pathfinder/v2/query",
            headers=headers,
            json=payload,
        )
        if resp.status_code != 200:
            error(f"Failed to fetch single track: HTTP {resp.status_code}")
            return []

        data = resp.json()
        if "data" not in data or "trackUnion" not in data["data"]:
            error(f"Invalid track data format: {data}")
            return []

        track_info = data["data"]["trackUnion"]

        artists = []
        for artist_data in track_info.get("firstArtist", {}).get("items", []):
            name = artist_data.get("profile", {}).get("name")
            if name:
                artists.append(name)
        for artist_data in track_info.get("otherArtists", {}).get("items", []):
            name = artist_data.get("profile", {}).get("name")
            if name:
                artists.append(name)

        artist_str = ", ".join(artists) if artists else "Unknown Artist"

        cover_url = None
        album_cover = track_info.get("albumOfTrack", {}).get("coverArt", {}).get("sources", [])
        if album_cover:
            cover_url = album_cover[0]["url"]

        duration_ms = track_info.get("duration", {}).get("totalMilliseconds", 0)
        title = track_info.get("name", "Unknown")

        album_name = track_info.get("albumOfTrack", {}).get("name")
        release_date = track_info.get("albumOfTrack", {}).get("date", {}).get("isoString", "")
        return [Track(
            title=title,
            artist=artist_str,
            duration_ms=duration_ms,
            cover_url=cover_url,
            spotify_url=f"https://open.spotify.com/track/{track_id}",
            track_id=track_id,
            album=album_name,
            release_date=release_date,
        )]


def fetch_playlist_tracks(playlist_id: str) -> List[Track]:
    kw = {"impersonate": "chrome124"} if USE_CFFI else {}
    with CffiSession(**kw) as session:
        token_data = _get_access_token(session)
        headers = {
            "accept": "application/json",
            "app-platform": "WebPlayer",
            "authorization": f'Bearer {token_data["access_token"]}',
            "client-token": token_data["client_token"],
            "content-type": "application/json;charset=UTF-8",
        }

        payload = {
            "variables": {
                "uri": f"spotify:playlist:{playlist_id}",
                "offset": 0,
                "limit": 1,
                "enableWatchFeedEntrypoint": False,
            },
            "operationName": "fetchPlaylist",
            "extensions": {
                "persistedQuery": {"version": 1, "sha256Hash": PLAYLIST_HASH}
            },
        }

        resp = session.post(
            "https://api-partner.spotify.com/pathfinder/v2/query",
            headers=headers,
            json=payload,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to get playlist metadata: HTTP {resp.status_code}")

        playlist_meta = resp.json()["data"]["playlistV2"]
        total_count = playlist_meta["content"]["totalCount"]
        playlist_name = playlist_meta.get("name", "Unknown Playlist")
        info(f"Playlist: {playlist_name} — {total_count} tracks", playlist=playlist_name, total=total_count)

        tracks: List[Track] = []
        offset = 0
        limit = 50

        while offset < total_count:
            payload["variables"]["offset"] = offset
            payload["variables"]["limit"] = limit
            resp = session.post(
                "https://api-partner.spotify.com/pathfinder/v2/query",
                headers=headers,
                json=payload,
            )
            if resp.status_code != 200:
                warning(f"Failed to fetch tracks at offset {offset}: HTTP {resp.status_code}")
                break

            data = resp.json()["data"]["playlistV2"]

            for item in data["content"]["items"]:
                track_data = None
                if "itemV2" in item and "data" in item["itemV2"]:
                    track_data = item["itemV2"]["data"]

                if not track_data or not track_data.get("uri", "").startswith("spotify:track:"):
                    continue

                track_id = track_data["uri"].split(":")[-1]

                artists = []
                for artist in track_data.get("artists", {}).get("items", []):
                    name = artist.get("profile", {}).get("name")
                    if name:
                        artists.append(name)
                artist_str = ", ".join(artists) if artists else "Unknown Artist"

                cover_url = None
                cover_sources = (
                    track_data.get("albumOfTrack", {})
                    .get("coverArt", {})
                    .get("sources", [])
                )
                if cover_sources:
                    cover_url = cover_sources[0]["url"]

                duration_ms = track_data.get("trackDuration", {}).get("totalMilliseconds", 0)

                tracks.append(
                    Track(
                        title=track_data.get("name", "Unknown"),
                        artist=artist_str,
                        duration_ms=duration_ms,
                        cover_url=cover_url,
                        spotify_url=f"https://open.spotify.com/track/{track_id}",
                        track_id=track_id,
                        album=track_data.get("albumOfTrack", {}).get("name"),
                        release_date=track_data.get("albumOfTrack", {}).get("date", {}).get("isoString", ""),
                    )
                )

            offset += limit

    return tracks


# -------------------------------------------------------------------
# Album fetcher
# -------------------------------------------------------------------

# Spotify GraphQL hash for the getAlbum operation. Used to fetch all tracks
# from a Spotify album via the partner API.
ALBUM_HASH = "b9bfabef66ed756e5e13f68a942deb60bd4125ec1f1be8cc42769dc0259b4b10"


def fetch_album_tracks(album_id: str) -> List[Track]:
    """Fetch all tracks from a Spotify album (synchronous).

    Uses the same Spotify partner GraphQL API as fetch_playlist_tracks but
    with the getAlbum operation. Returns a list of Track objects in album
    order.
    """
    kw = {"impersonate": "chrome124"} if USE_CFFI else {}
    with CffiSession(**kw) as session:
        token_data = _get_access_token(session)
        headers = {
            "accept": "application/json",
            "app-platform": "WebPlayer",
            "authorization": f'Bearer {token_data["access_token"]}',
            "client-token": token_data["client_token"],
            "content-type": "application/json;charset=UTF-8",
        }

        # First request: get total count + album name
        payload = {
            "variables": {
                "uri": f"spotify:album:{album_id}",
                "offset": 0,
                "limit": 1,
                "enableWatchFeedEntrypoint": False,
            },
            "operationName": "getAlbum",
            "extensions": {
                "persistedQuery": {"version": 1, "sha256Hash": ALBUM_HASH}
            },
        }

        resp = session.post(
            "https://api-partner.spotify.com/pathfinder/v2/query",
            headers=headers,
            json=payload,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to get album metadata: HTTP {resp.status_code}")

        album_meta = resp.json()["data"]["albumUnion"]
        tracks_v2_meta = album_meta.get("tracksV2", {})
        total_count = tracks_v2_meta.get("totalCount", 0)
        album_name = album_meta.get("name", "Unknown Album")
        # Album cover art
        album_cover_url = None
        cover_sources = album_meta.get("coverArt", {}).get("sources", [])
        if cover_sources:
            album_cover_url = cover_sources[0]["url"]
        info(f"Album: {album_name} — {total_count} tracks", album=album_name, total=total_count)

        # Paginate through all tracks
        tracks: List[Track] = []
        offset = 0
        limit = 50

        while offset < total_count:
            payload["variables"]["offset"] = offset
            payload["variables"]["limit"] = limit
            resp = session.post(
                "https://api-partner.spotify.com/pathfinder/v2/query",
                headers=headers,
                json=payload,
            )
            if resp.status_code != 200:
                warning(f"Failed to fetch album tracks at offset {offset}: HTTP {resp.status_code}")
                break

            data = resp.json()["data"]["albumUnion"]
            items = data.get("tracksV2", {}).get("items", [])

            for item in items:
                track_data = item.get("track")
                if not track_data or not track_data.get("uri", "").startswith("spotify:track:"):
                    continue

                track_id = track_data["uri"].split(":")[-1]

                # Parse artists
                artists = []
                for artist in track_data.get("artists", {}).get("items", []):
                    name = artist.get("profile", {}).get("name")
                    if name:
                        artists.append(name)
                artist_str = ", ".join(artists) if artists else "Unknown Artist"

                duration_ms = track_data.get("duration", {}).get("totalMilliseconds", 0)

                tracks.append(
                    Track(
                        title=track_data.get("name", "Unknown"),
                        artist=artist_str,
                        duration_ms=duration_ms,
                        cover_url=album_cover_url,
                        spotify_url=f"https://open.spotify.com/track/{track_id}",
                        track_id=track_id,
                        album=album_name,
                        label=album_meta.get("label"),
                        release_date=album_meta.get("date", {}).get("isoString", ""),
                    )
                )

            offset += limit

    return tracks


# -------------------------------------------------------------------
# YouTube / SoundCloud search via yt-dlp
# -------------------------------------------------------------------

def safe_filename(artist: str, title: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "_", f"{artist} - {title}")



def download_youtube(query: str, output_path: str, duration_ms: int = 0):
    import subprocess
    import os
    cookies_file = os.environ.get("YTDLP_COOKIES_FILE", "")
    
    base_cmd = [
        "yt-dlp",
        "--extract-audio",
        "--audio-format", "flac",
        "--audio-quality", "0",
        "-o", output_path,
        "--no-playlist",
        "--remote-components", "ejs:github",
    ]
    if cookies_file and os.path.exists(cookies_file):
        base_cmd.extend(["--cookies", cookies_file])
    
    # 1. Try with duration filter if specified
    if duration_ms > 0:
        duration_sec = duration_ms // 1000
        min_sec = max(0, duration_sec - 15)
        max_sec = duration_sec + 15
        cmd = list(base_cmd) + ["--match-filter", f"duration > {min_sec} & duration < {max_sec}", f"ytsearch5:{query}"]
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            if os.path.exists(output_path):
                return True
        except Exception:
            pass

    # 2. Fallback without duration filter
    cmd = list(base_cmd) + [f"ytsearch1:{query}"]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return os.path.exists(output_path)
    except subprocess.CalledProcessError as e:
        error(f"yt-dlp failed: {e.stderr}")
        return False

def download_track_with_providers(track: Track, output_dir: str, config: dict) -> dict:
    source_pref = config.get("download_source", "auto")
    providers_to_try = ["youtube"]
    if source_pref != "auto" and source_pref in providers_to_try:
        providers_to_try = [source_pref]
        
    dl_title = track.title
    extended_mix = BeatportSearch.find_extended_mix(track.artist, track.title, track.duration_ms, track.album, MAX_DURATION_SECONDS * 1000, getattr(track, 'label', None), getattr(track, 'release_date', None))
    bp_duration = track.duration_ms
    if extended_mix and extended_mix[0]:
        info(f"Beatport: Found extended mix: {extended_mix[0]} ({extended_mix[1]}ms)")
        dl_title = extended_mix[0]
        bp_duration = extended_mix[1]
    else:
        info("Beatport: No extended mix found.")

    audio_format = os.environ.get("SD_AUDIO_FORMAT", "mp3-320").strip()
    ext = ".wav" if audio_format == "wav-16-44100" else ".mp3"
    
    safe_name = safe_filename(track.artist, dl_title)
    
    providers_to_try = ["yt-dlp"]
    if source_pref != "auto" and source_pref in providers_to_try:
        providers_to_try = [source_pref]
        
    out_path_flac = os.path.join(output_dir, f"{safe_name}.flac")
    final_path = os.path.join(output_dir, f"{safe_name}{ext}")
    
    success = False
    used_platform = None
    
    query = f"{track.artist} {dl_title}"
    
    for provider in providers_to_try:
        try:
            info(f"Attempting download via {provider}")
            if provider in ("yt-dlp", "youtube"):
                info("Downloading via yt-dlp...")
                if download_youtube(query, out_path_flac, bp_duration):
                    success = True
                    used_platform = "yt-dlp"
                    break
        except Exception as e:
            warning(f"{provider} download failed: {e}")

    if success:
        if os.path.exists(out_path_flac):
            try:
                ffmpeg_cmd = ["ffmpeg", "-y", "-i", out_path_flac, "-loglevel", "error"]
                if ext == ".mp3":
                    ffmpeg_cmd.extend(["-b:a", "320k"])
                ffmpeg_cmd.append(final_path)
                subprocess.run(ffmpeg_cmd, check=True)
                os.remove(out_path_flac) 
            except subprocess.CalledProcessError as e:
                error(f"FFmpeg conversion failed: {e}")
                return {"success": False, "error": "FFmpeg conversion failed"}
                
        if os.path.exists(final_path):
            return {"success": True, "error": None, "file": f"{safe_name}{ext}", "platform": used_platform}
        else:
            error(f"Downloaded file not found at: {final_path}")
            return {"success": False, "error": f"Downloaded file not found at {final_path}"}
    else:
        return {"success": False, "error": "All providers failed."}

def apply_metadata_id3v23(
    file_path: str,
    title: str,
    artist: str,
    album: Optional[str] = None,
    track_number: Optional[int] = None,
    release_date: Optional[str] = None,
    isrc: Optional[str] = None,
    genre: Optional[str] = None,
    cover_path: Optional[str] = None,
    comment: Optional[str] = None,
) -> bool:
    """Apply ID3v2.3 tags to an MP3 file using mutagen.

    Writes the following frames (all v2.3-compatible):
      - TIT2 (Title)
      - TPE1 (Performer / artist)
      - TALB (Album)            — if album is set
      - TRCK (Track number)     — if track_number is set
      - TDRC (Recording date)   — if release_date is set (YYYY-MM-DD)
      - TSRC (ISRC)             — if isrc is set
      - TCON (Genre)            — if genre is set
      - APIC (Cover art)        — if cover_path points to a valid image
      - COMM (Comment)          — if comment is set

    Returns True on success, False on error. Errors are logged but do NOT
    fail the overall download — the file is already on disk.
    """
    if not HAS_MUTAGEN:
        warning("mutagen not installed — skipping ID3v2.3 metadata embedding")
        return False
    if not file_path or not os.path.isfile(file_path):
        warning(f"Cannot apply metadata — file not found: {file_path}")
        return False

    try:
        # Load existing ID3 tags or create new
        try:
            audio = MP3(file_path, ID3=ID3)
            if audio.tags is None:
                audio.add_tags()
            tags = audio.tags
        except (HeaderNotFoundError, ID3NoHeaderError):
            tags = ID3()

        # Title
        if title:
            tags.delall("TIT2")
            tags.add(TIT2(encoding=3, text=title))
        # Artist
        if artist:
            tags.delall("TPE1")
            tags.add(TPE1(encoding=3, text=artist))
        # Album
        if album:
            tags.delall("TALB")
            tags.add(TALB(encoding=3, text=album))
        # Track number
        if track_number is not None:
            tags.delall("TRCK")
            tags.add(TRCK(encoding=3, text=str(track_number)))
        # Release date (TDRC is the v2.4 frame; mutagen auto-converts to v2.3
        # TYE/TDA frames when saving with v2_version=3)
        if release_date:
            tags.delall("TDRC")
            tags.add(TDRC(encoding=3, text=release_date))
        # ISRC (TSRC frame in ID3v2.3)
        if isrc:
            tags.delall("TSRC")
            tags.add(TSRC(encoding=3, text=isrc))
        # Genre
        if genre:
            tags.delall("TCON")
            tags.add(TCON(encoding=3, text=genre))
        # Comment
        if comment:
            tags.delall("COMM")
            tags.add(COMM(encoding=3, lang="eng", desc="", text=comment))

        # Cover art (APIC)
        if cover_path and os.path.isfile(cover_path):
            # Detect MIME type from extension
            ext = os.path.splitext(cover_path)[1].lower()
            mime = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".webp": "image/webp",
            }.get(ext, "image/jpeg")
            with open(cover_path, "rb") as f:
                cover_data = f.read()
            tags.delall("APIC")
            tags.add(APIC(
                encoding=3,
                mime=mime,
                type=3,        # front cover
                desc="Cover",
                data=cover_data,
            ))

        # Save with ID3v2.3 (v2_version=3)
        tags.save(file_path, v2_version=3)
        info(
            f"Applied ID3v2.3 metadata to {os.path.basename(file_path)}",
            title=title, artist=artist, album=album, isrc=isrc,
        )
        return True
    except Exception as e:
        error(f"Failed to apply ID3v2.3 metadata to {file_path}: {e}")
        return False


def enhance_track_with_lossless_core(track: Track, file_path: str) -> bool:
    """Fetch rich metadata from the built-in Lossless-Core module and embed
    it into the downloaded MP3 file as ID3v2.3 tags.

    Uses the track's spotify_url to query Lossless-Core, which returns the
    album name, ISRC, release date, track number and cover art URL. The
    cover is downloaded to a temp file and embedded via APIC.

    Returns True if metadata was applied, False otherwise (including when
    Lossless-Core is not available — the caller's file is left untouched
    in that case).
    """
    if not HAS_LOSSLESS_CORE:
        return False
    if not track.spotify_url:
        return False

    info(f"Fetching metadata from Lossless-Core for: {track.artist} - {track.title}")
    try:
        meta = lossless_core.fetch_track_metadata(track.spotify_url)
    except Exception as e:
        warning(f"Lossless-Core metadata fetch failed: {e}")
        return False

    if not meta:
        warning("Lossless-Core returned no metadata, skipping enhancement")
        return False

    # Use the rich metadata from Lossless-Core, falling back to the Track's
    # basic metadata where fields are missing.
    title = meta.title or track.title
    artist = meta.artist or track.artist
    album = meta.album
    isrc = meta.isrc
    release_date = meta.release_date
    track_number = meta.track_number
    cover_url = meta.cover_url or track.cover_url

    # Download cover to a temp file
    cover_path = None
    if cover_url:
        cover_path = os.path.join(os.path.dirname(file_path), f".cover_tmp_{int(time.time())}.jpg")
        if lossless_core.download_cover(cover_url, cover_path):
            info(f"Downloaded cover from Lossless-Core: {cover_url}")
        else:
            warning(f"Failed to download cover from Lossless-Core: {cover_url}")
            cover_path = None

    try:
        result = apply_metadata_id3v23(
            file_path=file_path,
            title=title,
            artist=artist,
            album=album,
            track_number=int(track_number) if track_number else None,
            release_date=release_date,
            isrc=isrc,
            genre=None,
            cover_path=cover_path,
            comment=None,
        )
        return result
    finally:
        # Clean up the temp cover file
        if cover_path and os.path.isfile(cover_path):
            try:
                os.remove(cover_path)
            except Exception:
                pass


# -------------------------------------------------------------------
# Process one track (search + download)
# -------------------------------------------------------------------

def process_track(track: Track, output_dir: str) -> dict:
    info(f"Processing track", artist=track.artist, title=track.title)

    config = {"download_source": os.environ.get("SD_DOWNLOAD_SOURCE", "auto")}
    
    res = download_track_with_providers(track, output_dir, config)
    if res["success"]:
        file_path = os.path.join(output_dir, res["file"])
        info(f"Downloaded successfully", file=res["file"], platform=res["platform"])
        
        try:
            enhance_track_with_lossless_core(track, file_path)
        except Exception as e:
            warning(f"Lossless-Core metadata enhancement failed: {e}")
            
        return {"status": "downloaded", "file": res["file"], "message": "OK", "platform": res["platform"], "error": None, "candidates": []}
    else:
        error(f"Download failed for: {track.artist} - {track.title}")
        return {"status": "failed", "file": None, "message": "Download failed", "error": res["error"], "candidates": []}

def cmd_fetch(url: str):
    """Fetch tracks for a Spotify URL (playlist, album, or single track)."""
    entity_type, entity_id = extract_spotify_id(url)
    if not entity_type:
        error(f"Invalid Spotify URL: {url}")
        print(json.dumps({"ok": False, "error": "Invalid Spotify URL"}))
        return 1

    info(f"Fetching {entity_type}: {entity_id}", entity_type=entity_type, entity_id=entity_id)

    try:
        if entity_type == "playlist":
            tracks = fetch_playlist_tracks(entity_id)
        elif entity_type == "album":
            tracks = fetch_album_tracks(entity_id)
        else:
            tracks = fetch_single_track(entity_id)
    except Exception as e:
        error(f"Failed to fetch: {e}")
        print(json.dumps({"ok": False, "error": str(e)}))
        return 1

    info(f"Found {len(tracks)} tracks", count=len(tracks))
    print(json.dumps({
        "ok": True,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "tracks": [t.to_dict() for t in tracks],
    }, ensure_ascii=False))
    return 0


def cmd_download(track_json_str: str, output_dir: str):
    """Download a single track given as JSON."""
    try:
        track_dict = json.loads(track_json_str)
    except json.JSONDecodeError as e:
        error(f"Invalid track JSON: {e}")
        print(json.dumps({"ok": False, "error": f"Invalid JSON: {e}"}))
        return 1

    track = Track(
        title=track_dict.get("title", "Unknown"),
        artist=track_dict.get("artist", "Unknown"),
        duration_ms=track_dict.get("duration_ms", 0),
        cover_url=track_dict.get("cover_url"),
        spotify_url=track_dict.get("spotify_url"),
        track_id=track_dict.get("track_id"),
        album=track_dict.get("album"),
        label=track_dict.get("label"),
        release_date=track_dict.get("release_date"),
    )

    os.makedirs(output_dir, exist_ok=True)
    result = process_track(track, output_dir)
    print(json.dumps({"ok": True, **result}, ensure_ascii=False))
    return 0 if result["status"] != "failed" else 2


def cmd_download_url(url: str, artist: str, title: str, output_dir: str):
    """Download a specific URL directly (used when the user manually picks
    a candidate from the picker dialog).
    """
    os.makedirs(output_dir, exist_ok=True)
    info(f"Direct download: {artist} - {title}", url=url, artist=artist, title=title)

    audio_format = os.environ.get("SD_AUDIO_FORMAT", "mp3-320").strip()
    ext = ".wav" if audio_format == "wav-16-44100" else ".mp3"

    success, used_platform, err = try_download_with_fallback(url, artist, title, output_dir, "youtube")
    if success:
        filename = safe_filename(artist, title) + ext
        info(f"Downloaded successfully", file=filename, platform=used_platform)
        print(json.dumps({
            "ok": True,
            "status": "downloaded",
            "file": filename,
            "message": "OK",
            "platform": used_platform,
            "error": None,
        }, ensure_ascii=False))
        return 0
    else:
        error(f"Download failed for: {artist} - {title}")
        print(json.dumps({
            "ok": False,
            "status": "failed",
            "file": None,
            "message": "Download failed",
            "error": err,
        }, ensure_ascii=False))
        return 2


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Usage: spotify_dl.py <fetch|download|download_url> ..."}))
        return 1

    cmd = sys.argv[1]

    if cmd == "fetch":
        if len(sys.argv) < 3:
            print(json.dumps({"ok": False, "error": "Usage: spotify_dl.py fetch <url>"}))
            return 1
        return cmd_fetch(sys.argv[2])

    if cmd == "download":
        if len(sys.argv) < 4:
            print(json.dumps({"ok": False, "error": "Usage: spotify_dl.py download <track_json> <output_dir>"}))
            return 1
        return cmd_download(sys.argv[2], sys.argv[3])

    if cmd == "download_url":
        if len(sys.argv) < 6:
            print(json.dumps({"ok": False, "error": "Usage: spotify_dl.py download_url <url> <artist> <title> <output_dir>"}))
            return 1
        return cmd_download_url(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])

    print(json.dumps({"ok": False, "error": f"Unknown command: {cmd}"}))
    return 1


if __name__ == "__main__":
    sys.exit(main())

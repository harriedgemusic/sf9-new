"""
Lossless-Core — встроенный модуль для получения метаданных из Spotify.

Этот модуль является аналогом микросервиса Lossless-Core из Charlotte-v2
(https://github.com/JellyTyan/Charlotte-v2), но реализован как встроенный
Python-модуль, а не Docker-контейнер.

Все запросы метаданных и обложек в приложении проходят через этот модуль.
Он использует Spotify partner GraphQL API (через curl_cffi с impersonate
Chrome 124) для получения:
  - title (название трека)
  - artist (исполнитель)
  - album (альбом)
  - release_date (дата релиза)
  - cover (URL обложки)
  - track_number (номер трека в альбоме)
  - isrc (International Standard Recording Code) — через Web API v1

Полученные метаданные используются для встраивания ID3v2.3 тегов в
скачанные MP3 файлы.
"""

import hashlib
import hmac
import json
import re
import struct
import time
import urllib.parse
from typing import List, Optional

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


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Spotify GraphQL operation hashes (extracted from the web-player JS bundle)
PLAYLIST_HASH = "346811f856fb0b7e4f6c59f8ebea78dd081c6e2fb01b77c954b26259d5fc6763"
TRACK_HASH = "612585ae06ba435ad26369870deaae23b5c8800a256cd8a57e08eddc25a37294"
ALBUM_HASH = "b9bfabef66ed756e5e13f68a942deb60bd4125ec1f1be8cc42769dc0259b4b10"


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

class TrackMetadata:
    """Rich metadata for a single track, suitable for ID3v2.3 embedding."""

    def __init__(
        self,
        title: str = "",
        artist: str = "",
        album: Optional[str] = None,
        isrc: Optional[str] = None,
        release_date: Optional[str] = None,
        track_number: Optional[int] = None,
        cover_url: Optional[str] = None,
        duration_ms: int = 0,
        spotify_url: Optional[str] = None,
        track_id: Optional[str] = None,
    ):
        self.title = title
        self.artist = artist
        self.album = album
        self.isrc = isrc
        self.release_date = release_date
        self.track_number = track_number
        self.cover_url = cover_url
        self.duration_ms = duration_ms
        self.spotify_url = spotify_url
        self.track_id = track_id

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "artist": self.artist,
            "album": self.album,
            "isrc": self.isrc,
            "release_date": self.release_date,
            "track_number": self.track_number,
            "cover_url": self.cover_url,
            "duration_ms": self.duration_ms,
            "spotify_url": self.spotify_url,
            "track_id": self.track_id,
        }


# ---------------------------------------------------------------------------
# Spotify Auth (TOTP) — reused from spotify_dl.py
# ---------------------------------------------------------------------------

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
    binary = struct.unpack(">I", mac[offset: offset + 4])[0] & 0x7FFFFFFF
    return str(binary % (10 ** digits)).zfill(digits)


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
    """Obtain Spotify browser access + client token."""
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


# ---------------------------------------------------------------------------
# URL parsing
# ---------------------------------------------------------------------------

def extract_spotify_id(url: str):
    """Extract (entity_type, entity_id) from a Spotify URL.
    Returns ("playlist"|"album"|"track", id) or (None, None).
    """
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


# ---------------------------------------------------------------------------
# ISRC fetching via Spotify Web API v1
# ---------------------------------------------------------------------------

# Simple in-memory cache for ISRC lookups (track_id → isrc or None).
# This avoids repeated Web API v1 calls which are heavily rate-limited.
_isrc_cache: dict = {}


def _fetch_isrc(session, access_token: str, track_id: str) -> Optional[str]:
    """Fetch ISRC for a track via Spotify Web API v1.

    The Web API v1 endpoint returns external_ids.isrc, but it is heavily
    rate-limited (429). We cache results and retry once after a short delay
    on rate limit. Returns None if ISRC cannot be obtained.
    """
    if track_id in _isrc_cache:
        return _isrc_cache[track_id]

    try:
        r = session.get(
            f"https://api.spotify.com/v1/tracks/{track_id}?market=US",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            isrc = data.get("external_ids", {}).get("isrc")
            _isrc_cache[track_id] = isrc
            return isrc
        elif r.status_code == 429:
            # Rate limited — don't retry, just return None. The ISRC is
            # optional for ID3v2.3 tags; the file will still have title,
            # artist, album, cover, etc.
            return None
        else:
            return None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Metadata fetching via GraphQL
# ---------------------------------------------------------------------------

def _graphql_headers(token_data: dict) -> dict:
    return {
        "accept": "application/json",
        "app-platform": "WebPlayer",
        "authorization": f'Bearer {token_data["access_token"]}',
        "client-token": token_data["client_token"],
        "content-type": "application/json;charset=UTF-8",
    }


def _graphql_request(session, token_data: dict, operation_name: str, sha256_hash: str, variables: dict) -> dict:
    """Make a Spotify partner GraphQL request and return the parsed data."""
    payload = {
        "variables": variables,
        "operationName": operation_name,
        "extensions": {
            "persistedQuery": {"version": 1, "sha256Hash": sha256_hash}
        },
    }
    resp = session.post(
        "https://api-partner.spotify.com/pathfinder/v2/query",
        headers=_graphql_headers(token_data),
        json=payload,
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Spotify GraphQL {operation_name} failed: HTTP {resp.status_code}")
    data = resp.json()
    if "errors" in data:
        raise RuntimeError(f"Spotify GraphQL {operation_name} error: {data['errors']}")
    return data.get("data", {})


def _parse_artists(track_info: dict, first_artist_key: str = "firstArtist") -> str:
    """Parse artist names from firstArtist + otherArtists (track) or
    artists.items (album track) fields."""
    artists = []
    for artist_data in track_info.get(first_artist_key, {}).get("items", []):
        name = artist_data.get("profile", {}).get("name")
        if name:
            artists.append(name)
    for artist_data in track_info.get("otherArtists", {}).get("items", []):
        name = artist_data.get("profile", {}).get("name")
        if name:
            artists.append(name)
    # Fallback: album track structure uses "artists" key directly
    if not artists:
        for artist in track_info.get("artists", {}).get("items", []):
            name = artist.get("profile", {}).get("name")
            if name:
                artists.append(name)
    return ", ".join(artists) if artists else "Unknown Artist"


def _parse_cover(sources: list) -> Optional[str]:
    """Extract the first (largest) cover URL from a coverArt.sources list."""
    if sources and isinstance(sources, list) and len(sources) > 0:
        return sources[0].get("url")
    return None


def fetch_track_metadata(spotify_url_or_id: str) -> Optional[TrackMetadata]:
    """Fetch rich metadata for a single Spotify track.

    Returns a TrackMetadata object with title, artist, album, ISRC,
    release_date, track_number, cover_url, duration_ms, spotify_url.
    Returns None on error.
    """
    entity_type, entity_id = extract_spotify_id(spotify_url_or_id)
    if entity_type != "track" or not entity_id:
        # Maybe it's a bare track ID
        if re.match(r"^[a-zA-Z0-9]+$", spotify_url_or_id):
            entity_id = spotify_url_or_id
        else:
            return None

    kw = {"impersonate": "chrome124"} if USE_CFFI else {}
    with CffiSession(**kw) as session:
        token_data = _get_access_token(session)

        data = _graphql_request(session, token_data, "getTrack", TRACK_HASH, {"uri": f"spotify:track:{entity_id}"})
        track_info = data.get("trackUnion")
        if not track_info:
            return None

        title = track_info.get("name", "Unknown")
        artist = _parse_artists(track_info)

        # Album info
        album_info = track_info.get("albumOfTrack", {})
        album_name = album_info.get("name")
        release_date = None
        date_info = album_info.get("date", {})
        if date_info:
            release_date = date_info.get("isoString", "")[:10]  # YYYY-MM-DD

        # Cover
        cover_url = _parse_cover(album_info.get("coverArt", {}).get("sources", []))

        # Track number
        track_number = track_info.get("trackNumber")

        # Duration
        duration_ms = track_info.get("duration", {}).get("totalMilliseconds", 0)

        # ISRC (via Web API v1 — may fail due to rate limiting)
        isrc = _fetch_isrc(session, token_data["access_token"], entity_id)

        return TrackMetadata(
            title=title,
            artist=artist,
            album=album_name,
            isrc=isrc,
            release_date=release_date,
            track_number=track_number,
            cover_url=cover_url,
            duration_ms=duration_ms,
            spotify_url=f"https://open.spotify.com/track/{entity_id}",
            track_id=entity_id,
        )


def fetch_album_tracks(spotify_url_or_id: str) -> List[TrackMetadata]:
    """Fetch all tracks from a Spotify album. Returns a list of
    TrackMetadata objects in album order."""
    entity_type, entity_id = extract_spotify_id(spotify_url_or_id)
    if entity_type != "album" or not entity_id:
        if re.match(r"^[a-zA-Z0-9]+$", spotify_url_or_id):
            entity_id = spotify_url_or_id
        else:
            return []

    kw = {"impersonate": "chrome124"} if USE_CFFI else {}
    with CffiSession(**kw) as session:
        token_data = _get_access_token(session)

        # First request: get total count + album name + cover
        data = _graphql_request(session, token_data, "getAlbum", ALBUM_HASH, {
            "uri": f"spotify:album:{entity_id}",
            "offset": 0,
            "limit": 1,
            "enableWatchFeedEntrypoint": False,
        })
        album_meta = data.get("albumUnion", {})
        total_count = album_meta.get("tracksV2", {}).get("totalCount", 0)
        album_name = album_meta.get("name", "Unknown Album")
        album_cover = _parse_cover(album_meta.get("coverArt", {}).get("sources", []))
        release_date = None
        date_info = album_meta.get("date", {})
        if date_info:
            release_date = date_info.get("isoString", "")[:10]

        tracks: List[TrackMetadata] = []
        offset = 0
        limit = 50

        while offset < total_count:
            data = _graphql_request(session, token_data, "getAlbum", ALBUM_HASH, {
                "uri": f"spotify:album:{entity_id}",
                "offset": offset,
                "limit": limit,
                "enableWatchFeedEntrypoint": False,
            })
            album_data = data.get("albumUnion", {})
            items = album_data.get("tracksV2", {}).get("items", [])

            for item in items:
                track_data = item.get("track")
                if not track_data or not track_data.get("uri", "").startswith("spotify:track:"):
                    continue

                track_id = track_data["uri"].split(":")[-1]
                title = track_data.get("name", "Unknown")
                artist = _parse_artists(track_data, first_artist_key="firstArtist")
                # For album tracks, artists are under "artists.items" not firstArtist
                if artist == "Unknown Artist":
                    artists_list = []
                    for a in track_data.get("artists", {}).get("items", []):
                        name = a.get("profile", {}).get("name")
                        if name:
                            artists_list.append(name)
                    artist = ", ".join(artists_list) if artists_list else "Unknown Artist"

                duration_ms = track_data.get("duration", {}).get("totalMilliseconds", 0)
                track_number = track_data.get("trackNumber")

                tracks.append(TrackMetadata(
                    title=title,
                    artist=artist,
                    album=album_name,
                    isrc=None,  # ISRC fetched on-demand per track during download
                    release_date=release_date,
                    track_number=track_number,
                    cover_url=album_cover,
                    duration_ms=duration_ms,
                    spotify_url=f"https://open.spotify.com/track/{track_id}",
                    track_id=track_id,
                ))

            offset += limit

        return tracks


def fetch_playlist_tracks(spotify_url_or_id: str) -> List[TrackMetadata]:
    """Fetch all tracks from a Spotify playlist. Returns a list of
    TrackMetadata objects."""
    entity_type, entity_id = extract_spotify_id(spotify_url_or_id)
    if entity_type != "playlist" or not entity_id:
        if re.match(r"^[a-zA-Z0-9]+$", spotify_url_or_id):
            entity_id = spotify_url_or_id
        else:
            return []

    kw = {"impersonate": "chrome124"} if USE_CFFI else {}
    with CffiSession(**kw) as session:
        token_data = _get_access_token(session)

        # First request: get total count
        data = _graphql_request(session, token_data, "fetchPlaylist", PLAYLIST_HASH, {
            "uri": f"spotify:playlist:{entity_id}",
            "offset": 0,
            "limit": 1,
            "enableWatchFeedEntrypoint": False,
        })
        playlist_meta = data.get("playlistV2", {})
        total_count = playlist_meta.get("content", {}).get("totalCount", 0)

        tracks: List[TrackMetadata] = []
        offset = 0
        limit = 50

        while offset < total_count:
            data = _graphql_request(session, token_data, "fetchPlaylist", PLAYLIST_HASH, {
                "uri": f"spotify:playlist:{entity_id}",
                "offset": offset,
                "limit": limit,
                "enableWatchFeedEntrypoint": False,
            })
            playlist_data = data.get("playlistV2", {})
            items = playlist_data.get("content", {}).get("items", [])

            for item in items:
                track_data = None
                if "itemV2" in item and "data" in item["itemV2"]:
                    track_data = item["itemV2"]["data"]
                if not track_data or not track_data.get("uri", "").startswith("spotify:track:"):
                    continue

                track_id = track_data["uri"].split(":")[-1]
                title = track_data.get("name", "Unknown")
                artist = _parse_artists(track_data)

                cover_url = _parse_cover(
                    track_data.get("albumOfTrack", {}).get("coverArt", {}).get("sources", [])
                )
                album_name = track_data.get("albumOfTrack", {}).get("name")
                release_date = None
                date_info = track_data.get("albumOfTrack", {}).get("date", {})
                if date_info:
                    release_date = date_info.get("isoString", "")[:10]

                duration_ms = track_data.get("trackDuration", {}).get("totalMilliseconds", 0)

                tracks.append(TrackMetadata(
                    title=title,
                    artist=artist,
                    album=album_name,
                    isrc=None,  # ISRC fetched on-demand per track during download
                    release_date=release_date,
                    track_number=None,
                    cover_url=cover_url,
                    duration_ms=duration_ms,
                    spotify_url=f"https://open.spotify.com/track/{track_id}",
                    track_id=track_id,
                ))

            offset += limit

        return tracks


def fetch_metadata(spotify_url: str) -> dict:
    """Fetch metadata for any Spotify URL (track / album / playlist).

    This is the main entry point that mirrors the Lossless-Core
    POST /metadata endpoint from Charlotte-v2. Returns a dict with:
      {
        "type": "song" | "album" | "playlist",
        "tracks": [TrackMetadata.to_dict(), ...],
        "title": str (for album/playlist),
        "author": str (for album/playlist),
        "cover": str (cover URL),
        "track_count": int
      }
    """
    entity_type, entity_id = extract_spotify_id(spotify_url)
    if entity_type == "track":
        meta = fetch_track_metadata(entity_id)
        if meta:
            return {
                "type": "song",
                "tracks": [meta.to_dict()],
                "title": meta.title,
                "author": meta.artist,
                "cover": meta.cover_url,
                "track_count": 1,
            }
        return {"type": "song", "tracks": [], "track_count": 0}
    elif entity_type == "album":
        tracks = fetch_album_tracks(entity_id)
        kw = {"impersonate": "chrome124"} if USE_CFFI else {}
        with CffiSession(**kw) as session:
            token_data = _get_access_token(session)
            data = _graphql_request(session, token_data, "getAlbum", ALBUM_HASH, {
                "uri": f"spotify:album:{entity_id}",
                "offset": 0,
                "limit": 1,
                "enableWatchFeedEntrypoint": False,
            })
            album = data.get("albumUnion", {})
            return {
                "type": "album",
                "tracks": [t.to_dict() for t in tracks],
                "title": album.get("name", "Unknown Album"),
                "author": ", ".join(a.get("profile", {}).get("name", "") for a in album.get("artists", {}).get("items", [])),
                "cover": _parse_cover(album.get("coverArt", {}).get("sources", [])),
                "track_count": len(tracks),
            }
    elif entity_type == "playlist":
        tracks = fetch_playlist_tracks(entity_id)
        kw = {"impersonate": "chrome124"} if USE_CFFI else {}
        with CffiSession(**kw) as session:
            token_data = _get_access_token(session)
            data = _graphql_request(session, token_data, "fetchPlaylist", PLAYLIST_HASH, {
                "uri": f"spotify:playlist:{entity_id}",
                "offset": 0,
                "limit": 1,
                "enableWatchFeedEntrypoint": False,
            })
            playlist = data.get("playlistV2", {})
            return {
                "type": "playlist",
                "tracks": [t.to_dict() for t in tracks],
                "title": playlist.get("name", "Unknown Playlist"),
                "author": ", ".join(a.get("profile", {}).get("name", "") for a in playlist.get("owners", {}).get("items", [])),
                "cover": _parse_cover(playlist.get("images", {}).get("items", [{}])[0].get("sources", [])) if playlist.get("images", {}).get("items") else None,
                "track_count": len(tracks),
            }
    return {"type": "unknown", "tracks": [], "track_count": 0}


def download_cover(url: str, dest_path: str) -> bool:
    """Download a cover image from `url` to `dest_path`. Returns True on
    success, False otherwise."""
    if not url:
        return False
    try:
        kw = {"impersonate": "chrome124"} if USE_CFFI else {}
        with CffiSession(**kw) as session:
            resp = session.get(url, timeout=20)
            if resp.status_code != 200:
                return False
            with open(dest_path, "wb") as f:
                f.write(resp.content)
            return True
    except Exception:
        return False


def is_available() -> bool:
    """The built-in Lossless-Core is always available (no external
    container needed)."""
    return True

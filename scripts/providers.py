import os
import re
import json
import base64
import time
import subprocess
from curl_cffi import requests
from urllib.parse import urlparse
from datetime import datetime

COMMUNITY_API_KEY = "explore-obscure-chivalry-travesty-blinks"
COMMUNITY_UA = "SpotiFLAC/Unknown"


class AmazonProvider:
    @staticmethod
    def get_url(amazon_url):
        match = re.search(r'(B[0-9A-Z]{9})', amazon_url)
        if not match:
            return None, None
        asin = match.group(1)
        payload = {"id": asin, "quality": "24", "country": "US"}
        headers = {
            "x-api-key": COMMUNITY_API_KEY,
            "User-Agent": COMMUNITY_UA,
            "Content-Type": "application/json"
        }
        try:
            r = requests.post("https://amz-foss.spotbye.qzz.io/api/dl", json=payload, headers=headers, impersonate='chrome124')
            if r.status_code == 200:
                data = r.json()
                url = data.get('streamUrl') or data.get('url')
                keys = data.get('keySpecs', [])
                if not keys and data.get('key'):
                    keys = [data['key']]
                return url, keys
            else:
                try: emit_log("error", f"Amazon Community API Error {r.status_code}: {r.text}")
                except: pass
                return None, None
        except Exception as e:
            print("Amazon error:", e)
            return None, None

class SongLink:
    @staticmethod
    def get_links(spotify_url):
        return None, None


from datetime import datetime
import json
def emit_log(level, message, **extra):
    rec = {"level": level, "message": str(message), "ts": datetime.now().strftime("%H:%M:%S")}
    rec.update(extra)
    print(json.dumps(rec), flush=True)

class BeatportSearch:
    @staticmethod
    def _emit_log(level, message, **extra):
        import json
        rec = {"level": level, "message": str(message), "ts": datetime.now().strftime("%H:%M:%S")}
        rec.update(extra)
        print(json.dumps(rec), flush=True)

    @staticmethod
    def _parse_release_page(rel_url, base_duration_ms, target_artist, target_title, max_duration_ms=270000, target_label=None, target_date=None):
        emit_log("info", f"Parsing Beatport release page: {rel_url}")
        try:
            r2 = requests.get(rel_url, impersonate='chrome124')
            match2 = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', r2.text)
            if not match2:
                emit_log("warning", "No NEXT_DATA found on release page")
                return None, 0
            data2 = json.loads(match2.group(1))
            state2 = data2.get('props', {}).get('pageProps', {}).get('dehydratedState', {})
            
            release_info = {}
            for q in state2.get('queries', []):
                q_key = q.get('queryKey', [])
                if q_key and isinstance(q_key[0], str) and q_key[0].startswith('release-'):
                    release_info = q.get('state', {}).get('data', {})
                    break
            
            bp_label = release_info.get("label", {}).get("name", "")
            bp_date = release_info.get("new_release_date", "")
            
            rel_tracks = release_info.get('tracks', [])
            if not rel_tracks or (rel_tracks and isinstance(rel_tracks[0], str)):
                for query in state2.get('queries', []):
                    q_key = query.get('queryKey', [])
                    if q_key and isinstance(q_key[0], str) and q_key[0] == 'tracks':
                        rel_tracks = query.get('state', {}).get('data', {}).get('results', []) or query.get('state', {}).get('data', [])
                        break
            
            if not rel_tracks or (rel_tracks and isinstance(rel_tracks[0], str)):
                return None, 0
                
            # Verify Label if provided
            if target_label and bp_label:
                def norm_label(l): return re.sub(r'\b(records|recordings|music|ltd|llc|inc)\b', '', l.lower()).strip()
                n_t_label = norm_label(target_label)
                n_b_label = norm_label(bp_label)
                if n_t_label not in n_b_label and n_b_label not in n_t_label:
                    emit_log("warning", f"Label mismatch: Spotify '{target_label}' vs Beatport '{bp_label}'. Skipping release.")
                    return None, 0
                    
            # Verify Date if provided
            if target_date and bp_date:
                from datetime import datetime
                try:
                    t_date = datetime.strptime(target_date[:10], "%Y-%m-%d")
                    b_date = datetime.strptime(bp_date[:10], "%Y-%m-%d")
                    diff_days = abs((b_date - t_date).days)
                    if diff_days > 30: # 30 days tolerance
                        emit_log("warning", f"Release date mismatch: Spotify '{target_date}' vs Beatport '{bp_date}'. Skipping release.")
                        return None, 0
                except Exception as e:
                    emit_log("warning", f"Date parsing error: {e}")
            
            # Log contents
            tracks_info = [f"{t.get('name', '')} ({t.get('mix_name', '')})" for t in rel_tracks]
            emit_log("info", f"Found {len(rel_tracks)} tracks in release:", release_tracks=tracks_info)
            for track_str in tracks_info:
                emit_log("info", f" - {track_str}")
                    
            target_artist_norm = re.sub(r'[^a-z0-9]', '', target_artist.lower())
            
            def clean_title(title):
                t = re.sub(r'\b(extended|original|mix|radio|edit|version|feat|ft)\b', '', title.lower())
                return re.sub(r'[^a-z0-9]', '', t)
            
            target_clean = clean_title(target_title)
            
            best_match = None
            for t in rel_tracks:
                length_ms = t.get('length_ms', 0)
                mix_name = (t.get('mix_name') or '').lower()
                track_name = (t.get('track_name') or t.get('name') or '').lower()
                
                bp_clean = clean_title(f"{track_name} {mix_name}")
                
                # 1. Track Title match (Strict Remix check)
                if target_clean != bp_clean:
                    if 'remix' in target_clean and 'remix' not in bp_clean: continue
                    if 'remix' in bp_clean and 'remix' not in target_clean: continue
                    if 'dub' in target_clean and 'dub' not in bp_clean: continue
                    if 'dub' in bp_clean and 'dub' not in target_clean: continue
                    if target_clean not in bp_clean and bp_clean not in target_clean:
                        continue
                
                # 2. Artist match (at least one)
                track_artists = [re.sub(r'[^a-z0-9]', '', a.get('name', '').lower()) for a in t.get('artists', [])] + [re.sub(r'[^a-z0-9]', '', a.get('name', '').lower()) for a in t.get('remixers', [])]
                if not any(target_artist_norm in a or a in target_artist_norm for a in track_artists):
                    continue
                
                # If Spotify track is short, skip the Beatport track if it's also short
                if base_duration_ms < max_duration_ms and abs(length_ms - base_duration_ms) < 15000:
                    emit_log("info", f"Track {track_name} ({t.get('mix_name')}) duration {length_ms}ms matches Spotify short version. Marked as regular. Searching for longer track.")
                    continue
                
                # 4. Version longer than original
                if length_ms > base_duration_ms + 15000:
                    if not best_match or length_ms > best_match[1]:
                        best_match = (f"{track_name} ({t.get('mix_name')})", length_ms)
                elif length_ms >= base_duration_ms - 15000:
                    # Same length but base is already long, or no longer version available
                    if not best_match:
                        best_match = (f"{track_name} ({t.get('mix_name')})", length_ms)
            
            if best_match:
                return best_match
            return None, 0
        except Exception as e:
            emit_log("error", f"Error parsing release page: {e}")
            return None, 0

    @staticmethod
    def find_extended_mix(artist, title, base_duration_ms, album=None, max_duration_ms=270000, target_label=None, target_date=None):
        queries_to_try = []
        
        # Extract first artist for a cleaner search
        first_artist = artist.split(',')[0].strip()
        
        # If title contains 'Remix', we can search 'Remixer Title'
        remix_match = re.search(r'-\s*(.+?)\s*Remix', title, re.IGNORECASE)
        if remix_match:
            remixer = remix_match.group(1).strip()
            clean_t = re.sub(r'-\s*.+?Remix.*', '', title, flags=re.IGNORECASE).strip()
            queries_to_try.append(f"{remixer} {clean_t}")
            
        album_name = album.get("name", "") if isinstance(album, dict) else (album or "")
        if album_name and album_name.lower() != title.lower():
            queries_to_try.append(f"{first_artist} {album_name}")
        
        queries_to_try.append(f"{first_artist} {title}")
        queries_to_try.append(f"{artist} {title}")
        
        for q_str in queries_to_try:
            q = q_str.replace(' ', '+')
            url = f"https://www.beatport.com/search?q={q}"
            emit_log("info", f"Searching Beatport Native API: {url}")
            
            try:
                r = requests.get(url, impersonate='chrome124')
                match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', r.text)
                if not match: continue
                data = json.loads(match.group(1))
                state = data.get('props', {}).get('pageProps', {}).get('dehydratedState', {})
                
                tracks = []
                for query in state.get('queries', []):
                    if query.get('queryKey') and query['queryKey'][0] == 'search-all':
                        tracks = query.get('state', {}).get('data', {}).get('tracks', {}).get('data', [])
                        break
                
                if not tracks: continue
                
                seen_releases = set()
                # Check top 3 unique releases from search results
                for track_data in tracks:
                    rel_id = track_data.get('release', {}).get('release_id')
                    if not rel_id or rel_id in seen_releases: continue
                    
                    seen_releases.add(rel_id)
                    if len(seen_releases) > 3: break
                    
                    rel_url = f"https://www.beatport.com/release/release/{rel_id}"
                    ext = BeatportSearch._parse_release_page(rel_url, base_duration_ms, artist, title, max_duration_ms, target_label, target_date)
                    if ext and ext[0]:
                        return ext
            except Exception as e:
                emit_log("error", f"Beatport native search error: {e}")
                
        return None, 0

import urllib.parse
class Downloader:
    @staticmethod
    def run_decryptor(in_path, out_path, keys):
        bin_path = os.path.join(os.path.dirname(__file__), "..", "go-decryptor", "decryptor")
        cmd = [bin_path, "-i", in_path, "-o", out_path, "-k", ",".join(keys)]
        subprocess.run(cmd, check=True)
        
    @staticmethod
    def download_file(url, out_path):
        r = requests.get(url, impersonate='chrome124', stream=True)
        with open(out_path, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

    @staticmethod
    def download_amazon(asin, out_path):
        url, keys = AmazonProvider.get_url(f"B{asin}")
        if not url: return False
        temp_enc = out_path + ".enc.mp4"
        Downloader.download_file(url, temp_enc)
        if keys:
            Downloader.run_decryptor(temp_enc, out_path, keys)
            os.remove(temp_enc)
        else:
            os.rename(temp_enc, out_path)
        return True

    @staticmethod
    def download_qobuz(query, out_path):
        q = urllib.parse.quote(query)
        search_url = f"https://www.qobuz.com/api.json/0.2/track/search?query={q}&app_id=712109809"
        try:
            r = requests.get(search_url, impersonate='chrome124')
            if r.status_code != 200: return False
            items = r.json().get('tracks', {}).get('items', [])
            if not items: return False
            
            payload = {"id": str(items[0]['id']), "quality": "24"}
            headers = {"x-api-key": COMMUNITY_API_KEY, "User-Agent": COMMUNITY_UA, "Content-Type": "application/json"}
            cr = requests.post("https://qbz-foss.spotbye.qzz.io/api/dl", json=payload, headers=headers, impersonate='chrome124')
            if cr.status_code != 200:
                try: emit_log("error", f"Qobuz Community API Error {cr.status_code}: {cr.text}")
                except: pass
                return False
            cdata = cr.json()
            url = cdata.get('url') or (cdata.get('data') or {}).get('url')
            if not url: return False
            Downloader.download_file(url, out_path)
            return True
        except:
            return False


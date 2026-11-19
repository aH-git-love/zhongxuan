#!/usr/bin/env python3
"""Fetch the 78 original public-domain RWS scans, preserving the TAROT.ALL IDs.

Requirements: Python 3.10+, Pillow, and Node.js on PATH.
Run from any directory: python tools/fetch_tarot_art.py
Offline validation: python tools/fetch_tarot_art.py --verify
Only assets/tarot/rws/ is written. Commons source JPEGs are decoded in memory.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import io
import json
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'tarot' / 'rws'
MANIFEST = OUT / 'sources.json'
API = 'https://commons.wikimedia.org/w/api.php'
CATEGORY_TITLE = 'Category:Rider-Waite-Smith tarot deck (TaionWC)'
CATEGORY_URL = 'https://commons.wikimedia.org/wiki/Category:Rider-Waite-Smith_tarot_deck_(TaionWC)'
USER_AGENT = 'ZhongxuanTarotArt/1.0 (public-domain RWS scan preservation; sequential downloader)'
WIDTH = 420
QUALITY = 62


def deck_cards():
    # Read the real CommonJS export rather than duplicating or guessing IDs.
    code = "const {TAROT}=require('./js/tarot.js'); process.stdout.write(JSON.stringify(TAROT.ALL.map(({id,name,en,num,suit})=>({id,name,en,num,suit}))));"
    result = subprocess.run(['node', '-e', code], cwd=ROOT, check=True, capture_output=True, encoding='utf-8')
    cards = json.loads(result.stdout)
    if len(cards) != 78 or len({c['id'] for c in cards}) != 78:
        raise RuntimeError('TAROT.ALL must expose exactly 78 unique card IDs.')
    return cards


def fetch(url, attempts=5):
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': '*/*'})
            with urllib.request.urlopen(request, timeout=90) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt + 1 == attempts:
                raise
            value = error.headers.get('Retry-After', '')
            delay = max(15 * (2 ** attempt), int(value) if value.isdigit() else 0)
            print(f'HTTP {error.code}: waiting {delay}s before retry {attempt + 2}/{attempts}', flush=True)
            time.sleep(delay)
        except (urllib.error.URLError, TimeoutError):
            if attempt + 1 == attempts:
                raise
            delay = 5 * (2 ** attempt)
            print(f'Transport failure: waiting {delay}s before retry', flush=True)
            time.sleep(delay)
    raise RuntimeError('Unreachable fetch state')


def api(**params):
    params.update(action='query', format='json', maxlag=5)
    data = json.loads(fetch(API + '?' + urllib.parse.urlencode(params)))
    if 'error' in data:
        raise RuntimeError('Commons API: ' + json.dumps(data['error']))
    return data


def plain(value):
    return html.unescape(re.sub(r'<[^>]*>', '', value)).strip()


def discover(cards):
    members = []
    continuation = {}
    while True:
        data = api(list='categorymembers', cmtitle=CATEGORY_TITLE, cmtype='file', cmlimit=500, **continuation)
        members.extend(data['query']['categorymembers'])
        if 'continue' not in data:
            break
        continuation = data['continue']
        time.sleep(1)
    by_major = {}
    by_minor = {}
    for member in members:
        title = member['title']
        major = re.fullmatch(r'File:RWS Tarot (\d{2}) (.+)\.jpg', title)
        minor = re.fullmatch(r'File:(Wands|Cups|Swords|Pents)(\d{2})\.jpg', title)
        if major:
            by_major[int(major[1])] = title
        if minor:
            by_minor[(minor[1].lower(), int(minor[2]))] = title
    titles = {}
    for card in cards:
        title = by_major.get(card['num']) if card['suit'] == 'major' else by_minor.get((card['suit'], card['num']))
        if not title:
            raise RuntimeError(f'No category scan mapped to {card["id"]}')
        titles[card['id']] = title
    # Lock the two historically variable numbering positions to the actual RWS scans.
    if titles.get('M08') != 'File:RWS Tarot 08 Strength.jpg' or titles.get('M11') != 'File:RWS Tarot 11 Justice.jpg':
        raise RuntimeError('RWS Strength VIII / Justice XI mismatch')
    infos = {}
    unique_titles = list(dict.fromkeys(titles.values()))
    for start in range(0, len(unique_titles), 40):
        time.sleep(1)
        data = api(prop='imageinfo', titles='|'.join(unique_titles[start:start + 40]), iiprop='url|extmetadata|size|sha1', iilimit=1, iiurlwidth=500, redirects=1)
        for page in data['query']['pages'].values():
            if not page.get('imageinfo'):
                raise RuntimeError('Missing original image info: ' + page['title'])
            infos[page['title']] = page['imageinfo'][0]
        for redirect in data['query'].get('redirects', []):
            if redirect['to'] in infos:
                infos[redirect['from']] = infos[redirect['to']]
    records = []
    for card in cards:
        title = titles[card['id']]
        info = infos[title]
        meta = info.get('extmetadata', {})
        get = lambda key: plain(str(meta.get(key, {}).get('value', '')))
        license_name = get('LicenseShortName')
        artist = get('Artist')
        if license_name.lower() != 'public domain' or 'Pamela Colman Smith' not in artist:
            raise RuntimeError(f'Unexpected artwork rights/author for {title}: {license_name}, {artist}')
        source_image = urllib.parse.urlunsplit(urllib.parse.urlsplit(info['url'])._replace(query='', fragment=''))
        if urllib.parse.urlsplit(source_image).hostname != 'upload.wikimedia.org':
            raise RuntimeError('Unexpected original image host')
        record = {
            'id': card['id'], 'cardName': card['name'], 'englishName': card['en'],
            'suit': card['suit'], 'number': card['num'], 'sourceFile': title,
            'sourcePage': info['descriptionurl'],
            'sourceImage': urllib.parse.urlunsplit(urllib.parse.urlsplit(info.get('thumburl', source_image))._replace(query='', fragment='')),
            'sourceOriginalImage': source_image,
            'downloadDimensions': {'width': info.get('thumbwidth', info['width']), 'height': info.get('thumbheight', info['height'])},
            'license': license_name, 'licenseCode': get('License'),
            'licenseUrl': get('LicenseUrl') or 'https://creativecommons.org/publicdomain/mark/1.0/',
            'originalSourceAuthor': artist, 'sourceCredit': get('Credit'),
            'originalPublicationDate': get('DateTimeOriginal'),
            'sourceDimensions': {'width': info['width'], 'height': info['height']},
            'sourceSha1': info.get('sha1', ''),
            'localImage': f'assets/tarot/rws/{card["id"]}.webp',
        }
        records.append(record)
    return records


def add_commons_thumbnails(records):
    """Switch pending downloads to official, uncropped 500px Commons JPEGs."""
    pending = [r for r in records if not (ROOT / r['localImage']).exists()]
    for record in records:
        record.setdefault('sourceOriginalImage', record['sourceImage'])
        record.setdefault('downloadDimensions', record['sourceDimensions'])
    for start in range(0, len(pending), 40):
        subset = pending[start:start + 40]
        data = api(prop='imageinfo', titles='|'.join(r['sourceFile'] for r in subset), iiprop='url', iiurlwidth=500, redirects=1)
        infos = {p['title']: p['imageinfo'][0] for p in data['query']['pages'].values()}
        for record in subset:
            info = infos[record['sourceFile']]
            thumb = urllib.parse.urlunsplit(urllib.parse.urlsplit(info['thumburl'])._replace(query='', fragment=''))
            if urllib.parse.urlsplit(thumb).hostname not in ('thumb.wikimedia.org', 'upload.wikimedia.org'):
                raise RuntimeError('Unexpected Commons thumbnail host')
            record['sourceImage'] = thumb
            record['downloadDimensions'] = {'width': info['thumbwidth'], 'height': info['thumbheight']}
        time.sleep(1)
    save_manifest(records)


def inspect_image(path):
    raw = path.read_bytes()
    with Image.open(io.BytesIO(raw)) as image:
        image.load()
        if image.format != 'WEBP':
            raise RuntimeError(f'Expected actual WebP: {path.name}')
        width, height = image.size
    if width != WIDTH or not 1.5 < height / width < 2.0:
        raise RuntimeError(f'Unexpected portrait dimensions: {path.name} {width}x{height}')
    return {'width': width, 'height': height}, len(raw), hashlib.sha256(raw).hexdigest()


def save_manifest(records, checked_at=None):
    payload = {
        'schemaVersion': 1,
        'deck': 'Rider-Waite-Smith, Pamela Colman Smith, original Pam-A scans',
        'sourceCategory': CATEGORY_URL,
        'author': 'Pamela Colman Smith',
        'processing': {'format': 'WebP', 'width': WIDTH, 'quality': QUALITY, 'method': 6, 'imageBudgetBytes': 5800000, 'budgetRecompressionQuality': 54, 'resize': 'proportional Lanczos; entire scan retained; no crop, recoloring or text overlay'}, 
        'verifiedAt': checked_at,
        'cards': records,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def verify(cards, records):
    if [c['id'] for c in cards] != [r['id'] for r in records]:
        raise RuntimeError('Manifest order/IDs differ from the live TAROT.ALL Node export')
    hashes = set()
    total = 0
    dimensions = set()
    for card, record in zip(cards, records):
        if record['cardName'] != card['name']:
            raise RuntimeError('Card name mapping mismatch: ' + card['id'])
        expected_path = f'assets/tarot/rws/{card["id"]}.webp'
        if record['localImage'] != expected_path:
            raise RuntimeError('Unexpected local asset path')
        size, byte_count, digest = inspect_image(ROOT / expected_path)
        if digest in hashes:
            raise RuntimeError('Duplicate SHA256: ' + card['id'])
        hashes.add(digest)
        if record.get('sha256') != digest or record.get('dimensions') != size or record.get('bytes') != byte_count:
            raise RuntimeError('Manifest image verification mismatch: ' + card['id'])
        if record['license'] != 'Public domain' or 'Pamela Colman Smith' not in record['originalSourceAuthor']:
            raise RuntimeError('Manifest provenance mismatch: ' + card['id'])
        dimensions.add((size['width'], size['height']))
        total += byte_count
    actual_files = {p.name for p in OUT.glob('*.webp')}
    expected_files = {f'{c["id"]}.webp' for c in cards}
    if actual_files != expected_files:
        raise RuntimeError('Unexpected missing/extra WebP asset files')
    total_asset_bytes = total + MANIFEST.stat().st_size
    if total > 5_800_000 or total_asset_bytes >= 6_000_000:
        raise RuntimeError(f'Assets exceed the 6 MB target: {total_asset_bytes} bytes including manifest')
    print(json.dumps({'verifiedCards': len(records), 'uniqueSha256': len(hashes), 'totalImageBytes': total, 'totalImageMiB': round(total / 1024 ** 2, 3), 'totalAssetBytes': total_asset_bytes, 'dimensions': sorted(dimensions)}, ensure_ascii=False), flush=True)
    return total


def fit_budget(records, target=5_800_000):
    """Retain complete scans while reserving room for attribution under 6 MB."""
    total = sum(r['bytes'] for r in records)
    for record in sorted(records, key=lambda r: (-r['bytes'], r['id'])):
        if total <= target:
            break
        path = ROOT / record['localImage']
        with Image.open(path) as image:
            buffer = io.BytesIO()
            image.convert('RGB').save(buffer, format='WEBP', quality=54, method=6)
        encoded = buffer.getvalue()
        if len(encoded) >= record['bytes']:
            continue
        old_size = record['bytes']
        path.write_bytes(encoded)
        dimensions, byte_count, digest = inspect_image(path)
        record.update(dimensions=dimensions, bytes=byte_count, sha256=digest,
                      budgetRecompression={'input': 'first-pass WebP', 'quality': 54, 'method': 6})
        total -= old_size - byte_count
        print(f'Budget pass {record["id"]}: {old_size} -> {byte_count} bytes', flush=True)
    if total > target:
        raise RuntimeError('Review compression settings: unable to meet the image payload target')
    save_manifest(records)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true', help='Offline validation of all 78 images and the manifest against TAROT.ALL')
    parser.add_argument('--force', action='store_true', help='Refresh metadata and redownload every Commons scan')
    parser.add_argument('--commons-thumbnails', action='store_true', help='Use official uncropped 500px Commons derivatives for pending downloads')
    parser.add_argument('--delay', type=float, default=1.0, help='Seconds between sequential image requests (default 1)')
    args = parser.parse_args()
    if args.delay < 0.5:
        parser.error('--delay must be at least 0.5 seconds')
    cards = deck_cards()
    if args.verify:
        verify(cards, json.loads(MANIFEST.read_text(encoding='utf-8'))['cards'])
        return
    OUT.mkdir(parents=True, exist_ok=True)
    if MANIFEST.exists() and not args.force:
        records = json.loads(MANIFEST.read_text(encoding='utf-8'))['cards']
        if [r['id'] for r in records] != [c['id'] for c in cards]:
            raise RuntimeError('Existing manifest differs from TAROT.ALL; review mapping before --force')
    else:
        records = discover(cards)
        save_manifest(records)
    if args.commons_thumbnails:
        add_commons_thumbnails(records)
    # Deliver the selected promotional images early; manifest order remains TAROT.ALL order.
    priority = {'M02': 0, 'M17': 1, 'M19': 2}
    work = sorted(records, key=lambda r: priority.get(r['id'], 3))
    for index, record in enumerate(work):
        path = ROOT / record['localImage']
        if not path.exists() or args.force:
            if index:
                time.sleep(args.delay)
            data = fetch(record['sourceImage'])
            with Image.open(io.BytesIO(data)) as original:
                original.load()
                image = ImageOps.exif_transpose(original).convert('RGB')
                if image.width < WIDTH:
                    raise RuntimeError('Original scan is too small: ' + record['id'])
                height = round(image.height * WIDTH / image.width)
                image = image.resize((WIDTH, height), Image.Resampling.LANCZOS)
                image.save(path, format='WEBP', quality=QUALITY, method=6)
        dimensions, byte_count, digest = inspect_image(path)
        record.update(dimensions=dimensions, bytes=byte_count, sha256=digest)
        save_manifest(records)
        print(f'{index + 1:02d}/78 {record["id"]}: {dimensions["width"]}x{dimensions["height"]}, {byte_count} bytes', flush=True)
    fit_budget(records)
    verify(cards, records)
    save_manifest(records, datetime.now(timezone.utc).isoformat(timespec='seconds'))


if __name__ == '__main__':
    main()

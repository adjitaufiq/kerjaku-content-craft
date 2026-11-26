"""Download original background tracks through immutable app asset pointers, then verify bytes."""
import hashlib
import json
import os
import tempfile
from pathlib import Path
from urllib.parse import urlparse
import requests


def instrumental_path(style):
    if style not in ('lofi', 'tech', 'emotional'):
        raise ValueError('Unsupported BGM style')
    folder = Path(__file__).parent / 'assets' / 'bgm'
    pointer = json.loads((folder / (style + '.mp3.asset.json')).read_text())
    checksum = json.loads((folder / 'checksums.json').read_text())[style]
    target = Path(tempfile.gettempdir()) / 'craft-bgm' / (checksum + '.mp3')
    if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == checksum:
        return target
    origin = os.environ.get('CRAFT_APP_ORIGIN') or os.environ.get('CRAFT_BGM_TEST_ORIGIN')
    if not origin:
        raise RuntimeError('CRAFT_APP_ORIGIN required to retrieve original music')
    parsed = urlparse(origin)
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname == 'localhost'):
        raise ValueError('Music origin requires HTTPS')
    if not pointer['url'].startswith('/__l5e/assets-v1/'):
        raise ValueError('Music asset pointer invalid')
    response = requests.get(origin.rstrip('/') + pointer['url'], timeout=90, allow_redirects=False)
    response.raise_for_status()
    if len(response.content) != pointer['size'] or hashlib.sha256(response.content).hexdigest() != checksum:
        raise ValueError('BGM asset checksum mismatch')
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix('.pending')
    temporary.write_bytes(response.content)
    temporary.replace(target)
    return target

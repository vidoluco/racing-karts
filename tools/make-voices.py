#!/usr/bin/env python3
"""Makes the commentary's sound once, offline, from src/data/commentary.js: the game plays one pack per language and needs no internet.

  python3 tools/make-voices.py              what is new or changed; the rest comes from the cache
  python3 tools/make-voices.py --lang ro    one language
  python3 tools/make-voices.py --check      no network: 1 if a pack does not match the lines

Writes assets/voice/<lang>.bin (the mp3s one after the other) and <lang>.json ({ clips: { id: [offset, bytes, seconds] } }). The cache is
data/raw/voice/, one mp3 per line by the hash of its text, voice and mood, or VOICE_CACHE=<dir>. The first run makes ./.venv with edge-tts in it.
edge-tts talks to a Microsoft service that is not an official API: read CREDITS.md before anything leaves this machine. The packs are git
ignored on purpose, as Web Swing's, and the game runs without them, with captions only.
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import subprocess
import sys
import venv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENV = ROOT / '.venv'
CACHE = Path(os.environ['VOICE_CACHE']) if os.environ.get('VOICE_CACHE') else ROOT / 'data' / 'raw' / 'voice'
OUT = ROOT / 'assets' / 'voice'
TARGET_MEAN = -19.0  # dB, the mean loudness of every line, or the two voices jump by 3 dB
PEAK_LIMIT = -1.5


def ensure_venv():
    py = VENV / 'bin' / 'python'
    if Path(sys.prefix).resolve() == VENV.resolve():
        return
    if not py.exists():
        venv.create(VENV, with_pip=True)
    if subprocess.run([str(py), '-c', 'import edge_tts'], capture_output=True).returncode != 0:
        subprocess.run([str(py), '-m', 'pip', 'install', '-q', 'edge-tts'], check=True)
    os.execv(str(py), [str(py), __file__, *sys.argv[1:]])


def read_lines():
    js = ("import('./src/data/commentary.js').then((m) => process.stdout.write(JSON.stringify({ moods: m.MOODS, "
          "langs: Object.fromEntries(m.VOICE_LANGS.map((l) => [l, m.clipsFor(l)])) })))")
    return json.loads(subprocess.run(['node', '--input-type=module', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True).stdout)


def cache_path(lang, clip, moods):
    m = moods[clip['mood']]
    key = '|'.join([clip['say'], clip['name'], m['rate'], m['pitch']])
    return CACHE / lang / f"{hashlib.sha1(key.encode()).hexdigest()[:16]}.mp3"


def seconds(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)], capture_output=True, text=True).stdout
    return round(float(out.strip()), 3)


def finish(raw, path):
    """The service pads every line with up to a second of silence and the voices differ in level: trim, level, small mono mp3."""
    edge = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03'
    wav = path.with_suffix('.tmp.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(raw), '-af', f'{edge},areverse,{edge},areverse', '-ac', '1', str(wav)], check=True)
    stats = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(wav), '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    mean = float(re.search(r'mean_volume: (-?[\d.]+) dB', stats).group(1))
    peak = float(re.search(r'max_volume: (-?[\d.]+) dB', stats).group(1))
    gain = min(TARGET_MEAN - mean, PEAK_LIMIT - peak)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(wav), '-af', f'volume={gain:.2f}dB', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '32k', '-write_xing', '0', str(path)], check=True)
    wav.unlink(missing_ok=True)
    raw.unlink(missing_ok=True)


async def speak(edge_tts, clip, moods, path, sem):
    m = moods[clip['mood']]
    raw = path.with_suffix('.raw.mp3')
    async with sem:
        for attempt in range(5):
            try:
                await edge_tts.Communicate(clip['say'], clip['name'], rate=m['rate'], pitch=m['pitch']).save(str(raw))
                break
            except Exception as e:  # the service drops a request now and then
                if attempt == 4:
                    raise
                print(f"  retry {clip['id']}: {e}", flush=True)
                await asyncio.sleep(2 * (attempt + 1))
        await asyncio.to_thread(finish, raw, path)


async def generate(jobs, workers):
    import edge_tts
    sem = asyncio.Semaphore(workers)
    done = 0

    async def one(job):
        nonlocal done
        await speak(edge_tts, *job, sem)
        done += 1
        if done % 50 == 0:
            print(f'  {done}/{len(jobs)}', flush=True)

    await asyncio.gather(*[one(j) for j in jobs])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lang', help='it, ro, id or en; all by default')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--jobs', type=int, default=4)
    args = ap.parse_args()
    if not args.check:
        ensure_venv()
    data = read_lines()
    moods = data['moods']
    langs = [args.lang] if args.lang else list(data['langs'])
    bad = 0
    for lang in langs:
        clips = data['langs'][lang]
        (CACHE / lang).mkdir(parents=True, exist_ok=True)
        paths = {c['id']: cache_path(lang, c, moods) for c in clips}
        if args.check:
            index = OUT / f'{lang}.json'
            have = json.loads(index.read_text('utf8')) if index.exists() else {}
            same = have.get('hash') == hashlib.sha1(''.join(p.name for p in paths.values()).encode()).hexdigest()
            print(f"{lang}: {'ok' if same else 'stale or missing'}")
            bad += 0 if same else 1
            continue
        jobs = [(c, moods, paths[c['id']]) for c in clips if not paths[c['id']].exists()]
        print(f'{lang}: {len(clips)} clips, {len(jobs)} to make', flush=True)
        if jobs:
            asyncio.run(generate(jobs, args.jobs))
        OUT.mkdir(parents=True, exist_ok=True)
        index, offset = {}, 0
        with open(OUT / f'{lang}.bin', 'wb') as pack:
            for c in clips:
                raw = paths[c['id']].read_bytes()
                pack.write(raw)
                index[c['id']] = [offset, len(raw), seconds(paths[c['id']])]
                offset += len(raw)
        names = ''.join(p.name for p in paths.values())
        (OUT / f'{lang}.json').write_text(json.dumps({'lang': lang, 'hash': hashlib.sha1(names.encode()).hexdigest(), 'bytes': offset, 'clips': index}, ensure_ascii=False, separators=(',', ':')), 'utf8')
        total = sum(v[2] for v in index.values())
        print(f'{lang}: {offset / 1e6:.2f} MB, {total:.0f} s of speech, longest {max(v[2] for v in index.values()):.1f} s', flush=True)
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()

"""Second half of the pronunciation check: compares the sound of plain vs vowel-marked audio.
Distance ~0 = same pronunciation; clearly above the threshold = the plain spelling was read differently.
Usage: python3 scripts/compare-pronunciation.py /tmp/hebrew-pcm"""
import json, sys, os
import numpy as np

THRESHOLD = 3.0
d = sys.argv[1]
pairs = json.load(open(os.path.join(d, 'pairs.json'), encoding='utf-8'))

def spec(path):
    s = np.frombuffer(open(path, 'rb').read(), dtype=np.int16).astype(float)
    env = np.array([np.abs(s[i:i + 320]).max() for i in range(0, len(s), 320)])
    v = np.where(env > 1500)[0]
    if len(v) == 0:
        return np.zeros((1, 200))
    s = s[v[0] * 320:(v[-1] + 1) * 320]
    if len(s) < 600:
        s = np.pad(s, (0, 600 - len(s)))
    return np.array([np.log1p(np.abs(np.fft.rfft(s[i:i + 512] * np.hanning(512))))[:200] for i in range(0, len(s) - 512, 160)])

def dist(a, b):
    A, B = spec(a), spec(b)
    n, m = len(A), len(B)
    C = np.linalg.norm(A[:, None, :] - B[None, :, :], axis=2)
    D = np.full((n + 1, m + 1), np.inf); D[0, 0] = 0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i, j] = C[i - 1, j - 1] + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
    return D[n, m] / (n + m)

for k, p in enumerate(pairs):
    p['dist'] = round(float(dist(p['plainFile'], p['vocFile'])), 1)
    if k % 300 == 0: print(f'  {k} compared', flush=True)
differ = sorted([p for p in pairs if p['dist'] > THRESHOLD], key=lambda p: -p['dist'])
hist = np.histogram([p['dist'] for p in pairs], bins=[0, 0.5, 1, 2, 3, 4, 6, 9, 100])
print('distance histogram:', list(zip([f'{b:g}' for b in hist[1][:-1]], hist[0].tolist())))
root = os.path.join(os.path.dirname(__file__), '..')
lines = ['# Pronunciation check', '',
         f'{len(pairs)} words and forms compared (plain spelling vs. with vowel marks).',
         f'**{len(differ)}** are pronounced differently without vowel marks: here the vowel marks decide, so they were checked by hand.', '',
         '| difference | entry | what | plain | with vowel marks | transliteration |', '|---|---|---|---|---|---|']
lines += [f"| {p['dist']} | {p['id']} | {p['what']} | {p['plain']} | {p['voc']} | {p.get('tr') or ''} |" for p in differ]
open(os.path.join(root, 'docs', 'pronunciation-check.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print(f'{len(differ)} of {len(pairs)} differ -> docs/pronunciation-check.md')

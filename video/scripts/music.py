"""Synthesizes the promo soundtrack (original, generated: no samples or licensed audio).

Calm lo-fi bed in F major at 96 BPM (one beat = 0.625 s, 48 beats = 30 s), timed to scene.html:
pads + Rhodes-style arpeggio from 0 s, soft beat enters at 3.75 s when the browser window rises,
drops out at 26.25 s for the end card, plus UI sounds on cursor clicks and whooshes on transitions.

usage: python music.py <out.wav>
"""
import sys
import wave
import numpy as np

SR = 48000
DUR = 30.0
BEAT = 0.625
N = int(SR * DUR)
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, start, pan=0.0, gain=1.0):
    """Mix a mono signal at `start` seconds with constant-power pan (-1..1)."""
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    a = (pan + 1) * np.pi / 4
    L[i:i + len(sig)] += sig * np.cos(a)
    R[i:i + len(sig)] += sig * np.sin(a)


def env_t(dur):
    return np.arange(int(dur * SR)) / SR


def lowpass(x, cutoff, order=2):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / cutoff) ** (2 * order))
    return np.fft.irfft(X, len(x))


def highpass(x, cutoff, order=2):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 - 1 / np.sqrt(1 + (f / cutoff) ** (2 * order))
    return np.fft.irfft(X, len(x))


def rhodes(m, dur=1.6, vel=1.0):
    t = env_t(dur)
    f = midi_hz(m)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2)
         + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4.0)
         + 0.12 * np.sin(2 * np.pi * 3 * f * t + 0.3) * np.exp(-t * 7.0)
         + 0.05 * np.sin(2 * np.pi * 7 * f * t) * np.exp(-t * 25.0))  # tine "bark"
    s *= 1 + 0.08 * np.sin(2 * np.pi * 4.5 * t)  # gentle tremolo
    s *= np.minimum(1, t / 0.004) * np.minimum(1, (dur - t) / 0.05)
    return s * vel


def bell(m, dur=2.5, vel=1.0):
    t = env_t(dur)
    f = midi_hz(m)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t * 1.6)
         + 0.4 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 3.5)
         + 0.2 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t * 6))
    return s * np.minimum(1, t / 0.002) * vel


def pad(notes, start, dur, gain=1.0):
    t = env_t(dur + 1.2)
    att, rel = 0.9, 1.2
    e = np.clip(t / att, 0, 1) * np.clip((dur + rel - t) / rel, 0, 1)
    for side, pan in ((-1, -0.6), (1, 0.6)):
        s = np.zeros(len(t))
        for m in notes:
            f = midi_hz(m)
            for cents in (-7 * side, 0, 5 * side):
                ff = f * 2 ** (cents / 1200)
                s += np.sin(2 * np.pi * ff * t + rng.uniform(0, 6.28))
                s += 0.25 * np.sin(2 * np.pi * 2 * ff * t)
        add(lowpass(s * e, 1400) / (len(notes) * 3), start, pan, gain)


def bass(m, start, dur, gain=1.0):
    t = env_t(dur)
    f = midi_hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    s *= np.minimum(1, t / 0.01) * np.exp(-t * 0.9) * np.minimum(1, (dur - t) / 0.08)
    add(s, start, 0, gain)


def kick(start, gain=1.0):
    t = env_t(0.4)
    f = 48 + 70 * np.exp(-t * 35)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    add(s, start, 0, gain)


def snap(start, gain=1.0):
    t = env_t(0.25)
    s = highpass(rng.standard_normal(len(t)), 1800) * np.exp(-t * 28)
    s += 0.3 * np.sin(2 * np.pi * 330 * t) * np.exp(-t * 40)
    add(s, start, 0.1, gain)


def shaker(start, gain=1.0):
    t = env_t(0.09)
    s = highpass(rng.standard_normal(len(t)), 6000) * np.sin(np.pi * t / 0.09) ** 2
    add(s, start, 0.45, gain)


def click(start, gain=1.0):
    t = env_t(0.12)
    s = np.sin(2 * np.pi * 1650 * t) * np.exp(-t * 60) + 0.5 * np.sin(2 * np.pi * 2480 * t) * np.exp(-t * 90)
    s += 0.15 * highpass(rng.standard_normal(len(t)), 4000) * np.exp(-t * 120)
    add(s, start, 0.2, gain)


def whoosh(start, dur, gain=1.0):
    t = env_t(dur)
    n = rng.standard_normal(len(t))
    e = np.sin(np.pi * t / dur) ** 2
    s = lowpass(highpass(n, 400), 2500) * e
    add(s, start, -0.2, gain)
    add(s[::-1] * 0.6, start, 0.3, gain)


def reverb(x, seconds=2.4, decay=0.55, seed=0):
    r = np.random.default_rng(seed)
    t = env_t(seconds)
    ir = r.standard_normal(len(t)) * np.exp(-t / decay)
    ir = lowpass(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    n = len(x) + len(ir)
    y = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)
    return y[: len(x)]


# Harmony: (start beat, length in beats, bass midi, chord tones)
F_MAJ7 = [53, 57, 60, 64]
D_M9 = [53, 57, 60, 64, 62]
BB_MAJ7 = [57, 58, 62, 65]
C_SUS = [55, 60, 65, 67]
C_MAJ = [55, 60, 64, 67]
F_ADD9 = [53, 57, 60, 67, 69]
chords = [
    (0, 8, 41, F_MAJ7), (8, 8, 38, D_M9), (16, 8, 34, BB_MAJ7),
    (24, 4, 36, C_SUS), (28, 4, 36, C_MAJ), (32, 4, 38, D_M9),
    (36, 6, 34, BB_MAJ7), (42, 6, 41, F_ADD9),
]

for b0, nb, root, tones in chords:
    t0 = b0 * BEAT
    pad(tones, t0, nb * BEAT, gain=0.20)
    # Bass enters with the beat
    if b0 >= 6 or b0 == 0:
        for k in range(0, nb, 2):
            if (b0 + k) * BEAT >= 3.75 and b0 + k < 42:
                bass(root + 12, (b0 + k) * BEAT, 2 * BEAT, gain=0.30 if k % 4 == 0 else 0.22)
    if b0 == 42:
        bass(root + 12, t0, 3.6, gain=0.30)

# Rhodes arpeggio in eighth notes (wet), sparse in the intro, resolving on the end card
ep = np.zeros(N)
ep_r = np.zeros(N)
pattern = [0, 2, 1, 3, 2, 1, 3, 2]
for b0, nb, root, tones in chords:
    for e8 in range(nb * 2):
        beat = b0 + e8 / 2
        if beat >= 42:
            break
        if beat < 6 and e8 % 2:
            continue
        m = sorted(tones)[pattern[e8 % 8] % len(tones)] + 12
        vel = (0.9 if e8 % 2 == 0 else 0.6) * (0.75 if beat < 6 else 1.0)
        s = rhodes(m, 1.4, vel)
        i = int(beat * BEAT * SR)
        seg = s[: N - i]
        pan = -0.3 if e8 % 2 else 0.3
        ep[i:i + len(seg)] += seg * np.cos((pan + 1) * np.pi / 4)
        ep_r[i:i + len(seg)] += seg * np.sin((pan + 1) * np.pi / 4)
# Closing chord, rolled, on the end card
for k, m in enumerate([53, 60, 64, 67, 69, 72]):
    s = rhodes(m, 3.7 - k * 0.06, 0.7)
    i = int((42 * BEAT + k * 0.06) * SR)
    seg = s[: N - i]
    ep[i:i + len(seg)] += seg * 0.7
    ep_r[i:i + len(seg)] += seg * 0.7
L += 0.16 * (ep + 0.45 * reverb(ep, seed=1))
R += 0.16 * (ep_r + 0.45 * reverb(ep_r, seed=2))

# Soft beat from 3.75 s (beat 6) to 26.25 s (beat 42)
for beat in range(6, 42):
    t0 = beat * BEAT
    if beat % 4 in (0, 2):
        kick(t0, 0.55 if beat % 4 == 0 else 0.4)
    else:
        snap(t0, 0.10)
    for sub in range(4):
        shaker(t0 + sub * BEAT / 4, 0.035 if sub % 2 else 0.02)

# Bell glints: logo reveal and end-card logo
fx_l = np.zeros(N)
fx_r = np.zeros(N)
for start, notes in ((1.15, [77, 81, 84]), (27.0, [77, 81, 84, 89])):
    for k, m in enumerate(notes):
        s = bell(m, 2.5, 0.5)
        i = int((start + k * 0.11) * SR)
        seg = s[: N - i]
        fx_l[i:i + len(seg)] += seg * (0.8 if k % 2 else 0.5)
        fx_r[i:i + len(seg)] += seg * (0.5 if k % 2 else 0.8)
L += 0.10 * (fx_l + 0.6 * reverb(fx_l, 3.0, 0.8, seed=3))
R += 0.10 * (fx_r + 0.6 * reverb(fx_r, 3.0, 0.8, seed=4))

# UI sounds synced to the cursor clicks and transitions in scene.html
for t_click in (13.0, 15.8, 20.55, 25.85):
    click(t_click, 0.12)
whoosh(3.45, 0.9, 0.06)
whoosh(26.0, 1.0, 0.06)

# Master: fade in/out, soft clip, normalize
mix = np.stack([L, R], axis=1)
t = np.arange(N) / SR
mix *= np.clip(t / 0.05, 0, 1)[:, None] * np.clip((DUR - t) / 1.2, 0, 1)[:, None]
mix = np.tanh(mix * 1.2) / 1.2
mix /= np.max(np.abs(mix)) / 0.89

with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('peak', np.max(np.abs(mix)), 'rms dBFS', 20 * np.log10(np.sqrt(np.mean(mix ** 2))))

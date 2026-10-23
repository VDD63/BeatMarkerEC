# BeatMarker AE for EffectCraft

Beat detection and colored beat markers for [EffectCraft](https://github.com/storytold/effectcraft),
ported from the After Effects CEP panel **BeatMarker AE** by
[samaBR85](https://github.com/samaBR85/BeatMarker-AEPlugin) (extended edition by
[VDD63](https://github.com/VDD63/BeatMarker-AE-Extended)).

The panel analyzes an audio layer or an audio footage item, detects the tempo, and
writes four-colour markers on the clip or on the composition timeline:

| Beat | Marker colour |
| --- | --- |
| 1 | Red |
| 2 | Blue |
| 3 | Yellow |
| 4 | Aqua |

## Install

Requirements: **EffectCraft 0.14.0 or newer** (tested on 0.14.0). No Adobe apps,
no Node.js, no extra packages.

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

Then restart EffectCraft and open **Window ▸ BeatMarker.jsx**. The panel docks like
any other panel.

Manual install: copy `BeatMarker.jsx` to

```
%APPDATA%\EffectCraft\Scripts\ScriptUI Panels\
```

Uninstall with `install.ps1 -Uninstall` (or delete the file).

## Use

1. Open a composition that contains an audio layer, and select that layer.
   Alternatively, select an audio footage item in the **Project** panel.
2. Click **Analyze Selected Layer/Footage**. The panel shows BPM, beat count and a
   confidence score with a short comment.
3. Tap the four coloured circles to enable/disable beats 1–4.
4. **Create on Clip** writes markers on the audio layer; **Create on Timeline**
   writes composition markers. Re-creating clears the previous BeatMarker markers
   on that target first (other markers are left alone).
5. **◀ / ▶** with the Clip/Timeline selector shifts the beat colours (phase).
   Markers keep their times; only the labels change as needed.
6. **Remove from Clip / Remove from Timeline** deletes only markers created by
   this panel (identified by their stored beat number).

Clip markers are placed at `beat + layer.startTime`, matching the original plugin,
so they line up with the waveform after moving the layer. Timeline markers use the
same composition times.

## How it works

EffectCraft already decodes every format it can import, so the port does not ship
any audio decoders:

- A temporary composition receives the item and
  **Convert Audio to Keyframes** (`keys.audioToKeyframes`). The amplitude envelope
  is read in one `layer.tree` call and the temporary composition is removed.
  Analysis runs at an adaptive 60–240 fps (about 30 000 keyframes for tracks
  under ~8 minutes; the 60 fps floor means a 20 minute track uses ~72 000), which
  keeps long tracks practical in the boa script engine.
- The detector is written for this runtime: log-energy onset novelty → decimated
  autocorrelation → phase-compensated comb around the tempo → least-squares fit of
  the beat grid to the onsets → snap each beat to a nearby onset. Confidence mixes
  interval stability with how strongly the onsets align to the grid.
- Markers are written through `app.run("markers.set")`, and read back through
  `markers.list`, so the beat number stored in the marker's `cuePoint` params
  survives a round trip. Markers use an empty comment and the Red/Blue/Yellow/Aqua
  labels.

The UI follows the system language: English, or Brazilian Portuguese when
`app.isoLanguage` starts with `pt`.

## Tests

The suite drives the real panel handlers and marker commands against
`effectcraft-cli.exe`:

```powershell
powershell -ExecutionPolicy Bypass -File test\run.ps1
# another install location:
powershell -ExecutionPolicy Bypass -File test\run.ps1 -Cli "C:\path\to\effectcraft-cli.exe"
```

- `analysis.test.jsx` — 128 BPM click fixture: BPM, 52 beats, confidence, grid
  deviation, adaptive analysis rate.
- `markers.test.jsx` — 52 clip + 52 timeline markers, labels, empty comments,
  `cuePoint` beat numbers, `layer.startTime` offset, phase rotation, beat toggles,
  removal.
- `footage.test.jsx` — Project-panel footage mode (timeline markers only).

## Limits

- **Steady tempo assumed.** The detector fits one grid for the whole track; a
  tempo change or gradual drift is averaged. This is the main difference from the
  original PCM/`music-tempo` implementation.
- **20 minutes max.** Analysis time and memory grow with length. The envelope
  targets ~30 000 keyframes, but the 60 fps floor raises that for very long tracks
  (≈72 000 at 20 minutes).
- **Source audio, not the layer stack.** The analysis uses the item's audio, so
  layer trims, time-stretch and audio effects do not affect the detected beats.
  Only `layer.startTime` is applied to the markers (same as the original).
- **No file picker.** EffectCraft scripts have no `File.openDialog`; select the
  layer or footage in the UI first.
- The scratch composition shows up as a single **Analyze Audio** undo step; it is
  removed automatically, including when analysis fails.
- Existing markers that carry a beat number are treated as BeatMarker markers and
  are replaced by **Create** / removed by **Remove**.

## Credits and license

**GPL-3.0** — see [LICENSE](LICENSE).

- Original **BeatMarker AE** © [samaBR85](https://github.com/samaBR85/BeatMarker-AEPlugin),
  GPL-3.0.
- Extended After Effects edition by [VDD63](https://github.com/VDD63/BeatMarker-AE-Extended).
- This EffectCraft port keeps the marker format, the four-colour scheme, the phase
  behaviour and the confidence phrases, and replaces the CEP/HTML layer with
  ScriptUI and the PCM analysis with EffectCraft's own audio decoding.

---

## Panduan singkat (Bahasa Indonesia)

1. Jalankan `install.ps1`, lalu buka ulang EffectCraft.
2. Buka **Window ▸ BeatMarker.jsx**.
3. Pilih layer audio di komposisi (atau footage audio di panel Project), klik
   **Analyze Selected Layer/Footage**.
4. Atur beat 1–4 lewat tombol warna, lalu **Create on Clip** (marker di layer)
   atau **Create on Timeline** (marker di komposisi).
5. **◀ / ▶** menggeser fase warna marker; pilih **Clip** atau **Timeline** di
   dropdown di antaranya.
6. **Remove from Clip / Timeline** hanya menghapus marker buatan panel ini.

Batas: tempo dianggap konstan, audio maksimal 20 menit, dan yang dianalisis adalah
file sumber (bukan hasil trim/effects layer).

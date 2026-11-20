# Sound credits

All three recordings are released under **Creative Commons 0 (CC0 1.0, public domain)**. Licences were confirmed on each Freesound page on 2026-11-20. Attribution isn't required; it's kept here on purpose.

| File | Used for | Source recording | Creator | Source URL | Licence | Cut |
|---|---|---|---|---|---|---|
| `paper-shuffle.m4a` | Ten images collapse into a stack | "Paper Shuffle and Stack.aif" (dry, sound booth, Electro-Voice RE20) | moose13088 | https://freesound.org/people/moose13088/sounds/182889/ | CC0 1.0 | 7.05 s → landing + two riffles, 0.62 s |
| `fabric-sweep.m4a` | The stack opens into the sphere | "Fabric flaps" (shaking out a T-shirt) | PelicanPolice | https://freesound.org/people/PelicanPolice/sounds/580967/ | CC0 1.0 | 10.00 s → one soft swell, 0.53 s |
| `garment-click.m4a` | A visitor selects a piece | "soft button click 1" (ultrasonic-cleaner button) | FOSSarts | https://freesound.org/people/FOSSarts/sounds/740266/ | CC0 1.0 | 0.60 s → press only, low-passed at 3.2 kHz, 0.12 s |

Processing (reproducible with `python3 scripts/process-sounds.py <work-dir>`): built from the public HQ previews (128 kb/s MP3). Steps: cut, high-pass, a gate and light compression on the paper transient, leading silence trimmed to 4 ms, short fades. Perceived loudness is balanced with BS.1770 K-weighting: paper −22, fabric −21, click −30 LUFS (the click is the quietest), with at least 1 dB of peak headroom. Each cue ships as WebM/Opus and AAC (`.m4a`).

Not done: the clips were checked by measurement and waveform/spectrogram inspection only, not by ear. Listen before launch.

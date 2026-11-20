# Intro sound and cursor

`intro-desktop-with-sound.webm` (1440×900, 13.5 s): a desktop visit that enables sound early, then opens a piece and closes it. Headless Chromium can't capture its own audio, so `scripts/record-intro.mjs` rebuilds the soundtrack from the page's own cue log. Each cue the page played is placed at its logged time, using the files the site serves. The visual timing is exact; the audio alignment is within a frame or two.

## Cues (files and credits: `public/media/sound/CREDITS.md`)

| Cue | Fires on | Time in the intro |
|---|---|---|
| Paper shuffle | `onStackMeet`: the first ring image reaches the centre stack; the two riffles cover the other arrivals | gate + 3.35 s |
| Fabric sweep | `onExplode`: the stack opens into the sphere | gate + 4.0 s (0.65 s after the paper) |
| Garment click | A visitor selects (enlarges) a piece | on click |

- Cues hang off animation events, so a slow load shifts them with the picture.
- Only cues after the enabling click or tap play.
- A clip that hasn't loaded is skipped, never played late.
- Muting fades active sound in 140 ms.
- Repeat triggers within 150 ms are ignored.

## "Click to enable audio" (desktop, intro only)

- Appears on the first pointer move, 14 px below-right of the arrow, trailing it by 0.5 s (power3.out, per AUDIT.md §2.4).
- A click while it shows enables sound and does nothing else: a transparent layer takes that click, so it can't open a piece even as the intro ends.
- With no click, the intro ends silently and the prompt fades out.
- If the prompt never appeared, the layer goes the moment the intro ends.
- No prompt on touch or with reduced motion: the sound button works directly.

## Cursor labels (desktop)

| Where | Label | The click then… |
|---|---|---|
| Empty sphere area (≤ 250 px from centre) | Drag | does nothing; dragging rotates (label hides once a drag starts) |
| A garment | View | enlarges it |
| The enlarged piece | Details | opens its story (piece page) |
| Around the enlarged piece | X (Close) | collapses it |

- The label sits 14 px from the native arrow and trails it by 0.5 s; with reduced motion there's no trailing.
- It flips sides near the viewport edges.
- Difference blending keeps it legible on white and on dark photography.
- Hidden over the navigation, links, fields, the sound button and the title line.

# Pulse Forge Rhythm Trainer

Simple web app for rhythm ear training.

## What it does

- Generates a rhythm in 4/4 with configurable length (1, 2, 3, 4, 6, or 8 bars).
- Supports three rhythm modes:
  - **Straight 16ths**,
  - **Swing 8ths** (long-short feel),
  - **Triplets** (3 per beat).
- Uses staff lines as the notation surface for both generated and user rhythm display.
- Includes a separate **Rhythm Quiz** section with 4 multiple-choice staff notation options.
- Draws note/rest values with standard engraving symbols (whole, half, quarter, eighth, sixteenth, dotted, tied).
- Renders triplet values with proper tuplet grouping brackets on staff.
- Supports note/rest entry with proper ordinal values:
  - `1`, `1/2`, `1/4`, `1/8`, `1/16` (mode-dependent extra triplet values are also available),
  - dotted values,
  - ligature/tie to next note.
- Plays the rhythm through:
  - a selected MIDI output (if Web MIDI is available and enabled), or
  - an internal synth fallback.
- Checks notation with rhythmic equivalence rules.
- Quiz difficulty controls how close wrong options are to the correct rhythm:
  - **Easy**: around half of total bar value differs,
  - **Medium**: around `6-8` sixteenth notes differ,
  - **Hard**: around `1-4` sixteenth notes differ.

## Equivalence rules

- Consecutive rests are normalized for checking.
- Example: a `1/4` rest is treated as equivalent to two consecutive `1/8` rests.
- Notes tied with ligatures are normalized to a single sustained segment for checking.

## Run it

This project uses a local build step to bundle dependencies (including staff engraving).

### 1) Install dependencies

From the project folder:

```bash
npm install
```

### 2) Build the app bundle

```bash
npm run build
```

### 3) Run locally

Option A: Open directly

Open `index.html` in a browser.

Option B: Serve locally (recommended)

From the project folder:

```bash
npm run serve
```

Then open:

`http://localhost:5173`

## How to use

1. Click **Generate Rhythm**.
2. Set **Length**, **Mode**, **Density**, and **Tempo**.
3. Click **Your Staff** to open the placement prompt.
4. Choose **Type** (note/rest), **Value**, and **Form** (normal/dot/ligature).
5. Click **Place** to build the rhythm from left to right.
6. Use **Undo Value** when needed.
7. Click **Play Generated** / **Play My Notation**.
8. Click **Check Answer**.
9. Use **Reveal Answer** to compare notation lanes.

### Quiz mode

1. In **Rhythm Quiz**, choose difficulty (**Easy / Medium / Hard**).
2. Click **Generate Quiz**.
3. Click **Play Quiz Rhythm** to hear the target rhythm.
4. Choose one of the 4 notation options.
5. The app highlights the correct option and shows result feedback.

## Notes

- Web MIDI support depends on browser and permissions.
- If MIDI is unavailable, playback automatically uses the internal synth.
- Tempo, density, length, and rhythm mode can be adjusted before generation.
- Staff notation is rendered with VexFlow from a local bundled file for offline operation.

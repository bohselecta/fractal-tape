# Fractal Tape — Glyph Trainer Plan

## M1: Web Demo (Canvas) — Trainer & Controls
- [ ] Pane 1 toolbar: **Load Glyphs**, **Save Glyphs**, **Glyph Now**
- [ ] Pane 2 shows glyphed text (longest-match); updates live.
- [ ] Pane 3 canvas: zoom-at-cursor, pan, **Reset View**, **Toggle Grid**, **Max glyphs** slider.
- [ ] Stats bar: `<KB in> → <KB out> • <reduction%> • <words>→<tokens> • depth <D>`

**Acceptance**
- Pasting lorem ipsum + clicking **Glyph Now** yields glyphs in pane 2.
- Load `glyphs.json` updates encoding immediately; Save downloads current dictionary.
- Toggle Grid shows faint subdivision lines; 60fps preserved.

## M2: Code Hygiene
- [ ] Extract modules in `packages/tape-web/src/`:
  - `glyphDict.ts` (preset + load/save + trainer)
  - `encoder.ts` (normalize, trie, encode)
  - `sierpinski.ts` (address math, toBase3, points)
  - `viewer.ts` (canvas transform, render, grid)
  - `main.ts` (UI wiring)
- [ ] Debounce input (100ms) and only reflow when tokens change.

**Acceptance**
- `vite build` succeeds; no console errors; typing feels snappy.

## M3: (Optional) CLI support
- [ ] `tape glyph-train <docs> --top 96 > glyphs.json`

**Acceptance**
- Produced JSON loads in web and increases reduction ≥10% on example corpus.

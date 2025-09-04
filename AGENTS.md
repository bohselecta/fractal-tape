# Agents • Fractal Tape (Glyph-Trainer)

## 1) Web Demo Builder (UI/Canvas)
Goal: Add Glyph Now (trainer), Load/Save glyphs, Toggle Grid, stats, and smooth zoom/pan.
- Keep 60fps; throttle label drawing when cell < 5px.
- All logic in small modules: glyphDict.ts, encoder.ts, sierpinski.ts, viewer.ts.

**Checklist**
- [ ] Canvas zoom-under-cursor + pan drag.
- [ ] Buttons: Load Glyphs, Save Glyphs, Glyph Now, Reset, Toggle Grid.
- [ ] Live stats: KB in/out, tokens, reduction %, depth D.
- [ ] Debounced input (100ms) before glyphing.

**Acceptance**
- Pasting lorem ipsum then clicking **Glyph Now** produces visible glyphs in pane 2.
- Toggle Grid overlays subdivision lines without jank.

---

## 2) Builder (Core/CLI)
- Keep core pure; no DOM.
- Add optional `glyph-train` CLI later (bi/tri-gram mining).

**Acceptance (later)**
- `tape glyph-train ./docs --top 96 > glyphs.json` produces a valid dict loaded by the web demo.

---

## 3) Refactor Agent
- Extract helpers; keep behavior identical.
- ≤ 300 LOC changes per PR; add minimal smoke tests.

---

## 4) Test Agent
- Vitest for pure helpers (tokenize, trie encode, depth).
- Snapshots for common inputs.

---

## 5) Docs Agent
- README section "Glyph Trainer Demo" with quickstart and screenshots.

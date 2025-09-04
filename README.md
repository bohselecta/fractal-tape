# Fractal Tape - Glyph Trainer

> **Interactive glyph compression with layered mining and fractal triangle visualization**

[![Build Status](https://github.com/bohselecta/fractal-tape/workflows/CI/badge.svg)](https://github.com/bohselecta/fractal-tape/actions)
[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/bohselecta/fractal-tape/releases)

Fractal Tape is an interactive glyph compression system that uses **layered mining** and **fractal addressing** to discover and compress text patterns. Documents are encoded into compact glyph representations and visualized within a Sierpinski triangle for spatial exploration.

## 🎯 **Core Concepts**

### Layered Mining System
The system discovers patterns through recursive analysis:

- **Layer 1**: Mines n-grams directly from input text
- **Layer 2+**: Encodes with previous layers, then mines from the encoded stream
- **Progressive Discovery**: Each layer finds patterns in the previous layer's output

### Mathematical Foundation

#### Sierpinski Triangle Addressing
Each glyph gets a unique address in the fractal triangle:

```
Address: base-3 string (e.g., "012", "201")
Point: (x, y) coordinates in unit triangle

For address a = (a₁, a₂, ..., aₙ):
- Start with triangle vertices A=(0,0), B=(1,0), C=(0.5,√3/2)
- For each digit aᵢ:
  - '0': Keep (A, midpoint(A,B), midpoint(A,C))
  - '1': Keep (midpoint(A,B), B, midpoint(B,C))  
  - '2': Keep (midpoint(A,C), midpoint(B,C), C)
- Final point = centroid of resulting triangle
```

#### Glyph Compression
Transform common phrases into single glyphs:

```
Input: "i'm going to write some code"
Layer 1: "i'm going to" → "~A", "write some code" → "~b"
Layer 2: "~A ~b" → "~AA" (if pattern repeats)
```

#### Benefit-Scored Ranking
Phrases are ranked by actual compression benefit:

```
gain(p) = c × (chars(p) - chars(γ)) - λ × chars(rule(p))

Where:
- p = phrase being evaluated
- γ = glyph replacement
- c = frequency count
- λ = complexity penalty (typically 1.0)
- rule(p) = encoding rule for phrase p
```

## 🚀 **Quick Start**

### Prerequisites
- Node.js 20+
- npm

### Installation
```bash
git clone https://github.com/bohselecta/fractal-tape.git
cd fractal-tape
npm install
```

### Interactive Web Demo
```bash
# Start the development server
npm -w packages/tape-web run dev

# Open http://localhost:5173
```

## 🎮 **Web Demo Features**

### Interactive Triangle Viewer
- **Zoom & Pan**: Mouse wheel zooms under cursor, drag to pan
- **Hover Tooltips**: Shows fractal addresses (e.g., "012", "201") in real-time
- **Grid Overlay**: Toggle subdivision lines to see fractal structure
- **DPR-Aware**: Pixel-perfect interactions on all display types

### Layered Mining Controls
- **Layer Depth**: 1-3 layers of recursive pattern discovery
- **ASCII Glyphs**: Deterministic glyph generation with custom prefixes
- **N-gram Range**: 2-5 word phrases for pattern mining
- **Live Stats**: Real-time compression ratios and token counts

### Glyph Management
- **Load/Save**: Import/export custom glyph dictionaries
- **Legend Display**: Shows glyph mappings with layer information
- **Live Encoding**: Updates in real-time as you type

## 📊 **Performance**

- **Encoding**: 50k tokens in < 250ms
- **Web UI**: < 16ms typing latency, 20k glyphs @ 60fps
- **Layered Mining**: 2k-10k words in < 200ms
- **Compression**: 20-40% size reduction with custom glyphs
- **Hover Response**: < 1ms address calculation

## 🛠 **Architecture**

```
packages/
├── tape-core/     # Core algorithms: mining, encoding, fractal math
├── tape-cli/      # CLI tools: encode, decode, pack, unpack
└── tape-web/      # Interactive demo: layered mining, triangle viewer
```

### Core Components

- **`tape-core`** — Layered mining, ASCII glyph pools, fractal addressing
- **`tape-cli`** — Command-line encoding/decoding tools
- **`tape-web`** — Interactive canvas demo with hover tooltips

## 🧮 **Mathematical Details**

### Fractal Address Mathematics

#### Base-3 Conversion
```typescript
function toBase3(idx: number, D: number): string {
  let s = "";
  for (let k = D - 1; k >= 0; k--) {
    const p = Math.trunc(idx / (3 ** k));
    s += (p % 3).toString();
    idx %= 3 ** k;
  }
  return s;
}
```

#### Point-to-Address Inverse
```typescript
function pointToAddress(p: Vec, D: number): string {
  let a = A, b = B, c = C;
  let code = '';
  for (let i = 0; i < D; i++) {
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    if (pointInTri(p, a, ab, ca)) {
      code += '0'; b = ab; c = ca;
    } else if (pointInTri(p, ab, b, bc)) {
      code += '1'; a = ab; c = bc;
    } else {
      code += '2'; a = ca; b = bc;
    }
  }
  return code;
}
```

### Layered Mining Algorithm

#### Layer 1: Direct Mining
```typescript
function mineLayer1(text: string, top: number): GlyphEntry[] {
  const words = normalizeWords(text);
  const phrases = minePhrases(words, top);
  const pool = asciiGlyphPool("~", 2);
  return phrases.map((phrase, i) => ({
    layer: 1,
    phrase,
    glyph: pool[i]
  }));
}
```

#### Layer 2+: Encoded Stream Mining
```typescript
function mineLayerN(encodedTokens: string[], layer: number): GlyphEntry[] {
  const phrases = minePhrases(encodedTokens, top);
  const pool = asciiGlyphPool("~", 2);
  return phrases.map((phrase, i) => ({
    layer,
    phrase,
    glyph: pool[i]
  }));
}
```

## 📋 **CLI Commands**

### Encoding/Decoding
```bash
# Encode text with glyphs
echo "hello world" | npm -w packages/tape-cli run encode -- --glyphs glyphs.json

# Decode glyphs back to text
echo "~A ~b" | npm -w packages/tape-cli run decode -- --glyphs glyphs.json

# Pack encoded stream
npm -w packages/tape-cli run pack -- input.txt --glyphs glyphs.json --output output.ftz

# Unpack and decode
npm -w packages/tape-cli run unpack -- output.ftz --output decoded.txt
```

### Glyph Training
```bash
# Train glyphs from documents
npm -w packages/tape-cli run glyph-train -- ./docs --top 256 --ascii

# Custom parameters
npm -w packages/tape-cli run glyph-train -- ./docs --top 512 --nmin 2 --nmax 5 --prefix "~" --levels 2
```

## 🔧 **Development**

### Building
```bash
# Build all packages
npm run build

# Build individual packages
npm -w packages/tape-core run build
npm -w packages/tape-cli run build
npm -w packages/tape-web run build
```

### Testing
```bash
# Run tests
npm test

# Test web demo
npm -w packages/tape-web run dev
```

## 🎨 **Customization**

### Glyph Dictionaries
Create custom glyph dictionaries for domain-specific compression:

```json
[
  {"layer": 1, "phrase": ["machine", "learning"], "glyph": "~A"},
  {"layer": 1, "phrase": ["artificial", "intelligence"], "glyph": "~b"},
  {"layer": 2, "phrase": ["~A", "~b"], "glyph": "~AA"}
]
```

### ASCII Glyph Pools
Customize glyph generation:

```typescript
const pool = asciiGlyphPool("~", 2); // "~A", "~b", ..., "~AA", "~Ab", ...
// Results in: ["~A", "~b", "~c", ..., "~AA", "~Ab", "~Ac", ...]
```

## 📈 **Advanced Features**

### DPR-Aware Canvas
- **Device Pixel Ratio** scaling for crisp rendering
- **Mouse coordinate conversion** for pixel-perfect interactions
- **Zoom under cursor** with no drift
- **Smooth panning** on all display types

### Hover Interactions
- **Real-time address calculation** for mouse position
- **Crosshair overlay** showing exact position
- **Address bubble** displaying fractal coordinates
- **Works at any zoom level** regardless of label visibility

### Layered Compression
- **Recursive pattern discovery** through multiple layers
- **Progressive complexity** as layers increase
- **Union encoding** using all layers up to selected depth
- **Visual layer indicators** in legend display

## 📚 **API Reference**

### Core Functions
```typescript
// Layered mining
trainLayeredGlyphs(text: string, layerDepth: number, opts?: MiningOptions): void
mineFromEncodedStream(tokens: string[], layer: number, top: number): GlyphEntry[]
getGlyphsUpToLayer(maxLayer: number): GlyphEntry[]

// Fractal addressing
addressToPoint(code: string): Vec
pointToAddress(p: Vec, D: number): string
pointInTri(p: Vec, a: Vec, b: Vec, c: Vec): boolean

// ASCII glyph pools
asciiGlyphPool(prefix: string, levels: number): string[]
buildAsciiGlyphsForTape(text: string, opts?: GlyphOptions): GlyphEntry[]

// Canvas utilities
canvasScale(el: HTMLCanvasElement): ScaleInfo
toCanvasPoint(ev: MouseEvent, el: HTMLCanvasElement): Point2D
```

## 🤝 **Contributing**

This project is currently **proprietary**. For permission requests or collaboration inquiries, please contact the maintainer.

## 📄 **License**

**FRACTAL TAPE - READ-ONLY LICENSE (FTROL)**

Viewing permitted; no use, reproduction, or derivative works without explicit permission.

See [LICENSE](LICENSE) for details.

## 🙏 **Acknowledgments**

**Concept & IP:** Hayden (bohselecta)

---

*Fractal Tape v0.2.0 - Interactive glyph compression with layered mining and fractal visualization*
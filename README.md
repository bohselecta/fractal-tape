# Fractal Tape

> **Local-first, glyph-compressed, addressable retrieval substrate**

[![Build Status](https://github.com/bohselecta/fractal-tape/workflows/CI/badge.svg)](https://github.com/bohselecta/fractal-tape/actions)
[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/bohselecta/fractal-tape/releases)

Fractal Tape is a novel approach to document indexing and retrieval that uses **glyph-based compression** and **fractal addressing** for efficient, offline-first search capabilities. Documents are encoded into a compact glyph representation and positioned within a Sierpinski triangle for spatial indexing.

## 🎯 **Key Concepts**

### Glyph Compression
Transform common phrases into single glyphs:
- `"i'm going to"` → `"^%>"`
- `"and then"` → `"€€<"`
- `"until it is finished"` → `"⊕"`

### Fractal Addressing
Each token gets a unique address in a Sierpinski triangle:
- **Base-3 addressing** for deterministic positioning
- **Sequential addresses** for append-only ingestion
- **Spatial indexing** for efficient range queries

### Offline-First Design
- **No servers** beyond Vite/Preview
- **No SSR** or browser databases
- **Static file exports** for web demos
- **Local SQLite** for ingestion only

## 🚀 **Quick Start**

### Prerequisites
- Node.js 18+
- npm

### Installation
```bash
git clone https://github.com/bohselecta/fractal-tape.git
cd fractal-tape
npm install
```

### Basic Usage
```bash
# 1) Ingest documents (creates tape.db)
npm -w packages/tape-cli run ingest -- ./docs

# 2) Query with advanced options
npm -w packages/tape-cli run query -- "i'm going to write" --and --limit 10

# 3) Export for web demo
npm -w packages/tape-cli run export -- ./packages/tape-web/public/export.json

# 4) Run interactive web demo
npm -w packages/tape-web run dev
# Open http://localhost:5173
```

## 📊 **Performance**

- **Encoding**: 50k tokens in < 250ms
- **Web UI**: < 16ms typing latency, 20k glyphs @ 60fps
- **Database**: 50k+ tokens/s ingestion rate
- **Compression**: 20-40% size reduction with custom glyphs

## 🛠 **Architecture**

```
packages/
├── tape-core/     # Core library: glyph encoder, SQLite store, utilities
├── tape-cli/      # CLI tools: ingest, query, export, glyph-train, bitmap
└── tape-web/      # Web demo: Vite static site with canvas visualization
```

### Core Components

- **`tape-core`** — Glyph encoding, SQLite storage, address math, bitmap indexing
- **`tape-cli`** — Command-line tools with advanced query options
- **`tape-web`** — Interactive canvas demo with hover tooltips and grid overlay

## 🎮 **Web Demo Features**

The web demo (`fractal_tape_canvas_ui_demo.html`) includes:

- **Interactive triangle viewer** with zoom/pan controls
- **Hover tooltips** showing ±20 tokens around each glyph
- **Subdivision grid overlay** for fractal structure visualization
- **Glyph dictionary import/export** for custom compression
- **Real-time analytics** showing compression ratios and token counts
- **Customizable glyphs** with live encoding updates

## 📋 **CLI Commands**

### Ingest
```bash
# Ingest documents
npm -w packages/tape-cli run ingest -- ./docs

# Ingest specific files
npm -w packages/tape-cli run ingest -- file1.txt file2.md
```

### Query
```bash
# Basic query
npm -w packages/tape-cli run query -- "search terms"

# Advanced options
npm -w packages/tape-cli run query -- "terms" --and --limit 20 --json

# Windowing
npm -w packages/tape-cli run query -- "text" --min-span 3 --max-gap 5
```

### Export
```bash
# Export for web demo
npm -w packages/tape-cli run export -- ./packages/tape-web/public/export.json
```

### Glyph Training
```bash
# Generate custom glyphs from frequency analysis
npm -w packages/tape-cli run glyph-train -- ./docs --max-glyphs 20

# Use custom glyphs for ingestion
npm -w packages/tape-cli run ingest -- ./docs --glyphs ./custom-glyphs.json
```

### Bitmap Index
```bash
# Build bitmap index for fast queries
npm -w packages/tape-cli run bitmap -- --build

# Show index statistics
npm -w packages/tape-cli run bitmap -- --stats

# Test performance
npm -w packages/tape-cli run bitmap -- --test "query terms"
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
# Run tests (when implemented)
npm test

# Test CLI functionality
npm -w packages/tape-cli run ingest -- ./docs
npm -w packages/tape-cli run query -- "test query"
```

## 📈 **Advanced Features**

### Query Options
- **`--and`** / **`--intersection`** - Find documents containing ALL terms
- **`--or`** / **`--union`** - Find documents containing ANY terms (default)
- **`--window <k>`** - Pack adjacent addresses into spans with gap ≤ k
- **`--min-span <n>`** - Minimum span size to include
- **`--max-gap <k>`** - Maximum gap between addresses in same span
- **`--limit <n>`** - Limit results to n hits
- **`--json`** - Compact JSON output

### Bitmap Indexing
- **Roaring bitmaps** for O(1) set operations
- **Multi-token AND queries** across 1k+ docs in < 10ms
- **Memory-efficient** compression for large datasets
- **Performance benchmarking** vs traditional queries

### Address Mathematics
- **Base-3 conversions** for fractal positioning
- **Sierpinski triangle geometry** with precise coordinates
- **Spatial indexing** for range queries
- **Round-trip validation** for address accuracy

## 🎨 **Customization**

### Glyph Dictionaries
Create custom glyph dictionaries for domain-specific compression:

```json
[
  {"phrase": ["machine", "learning"], "glyph": "🤖"},
  {"phrase": ["artificial", "intelligence"], "glyph": "🧠"},
  {"phrase": ["neural", "network"], "glyph": "🕸️"}
]
```

### Web Demo Styling
Customize the web demo appearance in `fractal_tape_canvas_ui_demo.html`:
- **Colors**: Modify `--accent` and `--accent2` CSS variables
- **Canvas size**: Adjust `<canvas>` width/height attributes
- **Glyphs**: Edit `DEFAULT_GLYPHS` array in the script section

## 📚 **API Reference**

### Core Functions
```typescript
// Encoding
encodeTextToTokens(text: string, glyphs?: GlyphEntry[]): string[]
ingestDocsToStore(docs: string[], dbPath?: string, glyphs?: GlyphEntry[]): IngestStats

// Address math
addrToBase3(addr: number, D: number): string
base3ToAddr(base3: string): number
addressToPoint(base3: string): Point2D

// Windowing
packAddressesIntoSpans(addresses: number[], maxGap: number): AddressSpan[]
findMinMaxSpans(addresses: number[], minSpan: number, maxGap: number): AddressSpan[]

// Bitmap indexing
buildBitmapIndexFromStore(store: TapeStore): BitmapIndex
intersectTokenDocs(index: BitmapIndex, tokens: string[]): number[]
unionTokenDocs(index: BitmapIndex, tokens: string[]): number[]
```

## 🤝 **Contributing**

This project is currently **proprietary**. For permission requests or collaboration inquiries, please contact the maintainer.

## 📄 **License**

**Proprietary - All Rights Reserved**

Viewing permitted; no use, reproduction, or derivative works without explicit permission.

See [LICENSE](LICENSE) for details.

## 🙏 **Acknowledgments**

**Concept & IP:** Hayden (bohselecta)

---

*Fractal Tape v0.2.0 - Local-first document retrieval with fractal addressing*

import './style.css';
import { getGlyphs, setGlyphs, exportGlyphs, buildAsciiGlyphsForTape, getAsciiOnly, setAsciiOnly, train, words, build, encode, trainLayeredGlyphs, getLayerDepth, setLayerDepth, getGlyphsUpToLayer } from './glyphDict';
import { normalizeWords, buildTrie, encodeWithTrie, minDepthForSlots, toBase3 } from './encoder';
import { computePositions } from './viewer';
import { drawBaseTriangle, drawGrid, worldToScreen, screenToWorld, Transform } from './viewer';
import { A, B, C, addressToPoint, pointToAddress, Vec } from './sierpinski';

// Canvas scaling helpers
function canvasScale(el: HTMLCanvasElement) {
  const rect = el.getBoundingClientRect();
  return {
    sx: el.width / rect.width,
    sy: el.height / rect.height,
    rect
  };
}

function toCanvasPoint(ev: MouseEvent, el: HTMLCanvasElement) {
  const { sx, sy, rect } = canvasScale(el);
  return {
    x: (ev.clientX - rect.left) * sx,
    y: (ev.clientY - rect.top) * sy
  };
}

function isInsideBaseTri(p: Vec): boolean {
  const area = (A:Vec,B:Vec,C:Vec) => (B.x-A.x)*(C.y-A.y)-(B.y-A.y)*(C.x-A.x);
  const s = area(A,B,C);
  const s1 = area(p,B,C), s2 = area(A,p,C), s3 = area(A,B,p);
  const hasNeg = (s1<0)||(s2<0)||(s3<0), hasPos = (s1>0)||(s2>0)||(s3>0);
  return !(hasNeg && hasPos);
}

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="top">
    <div class="brand">FRΛCTAL <span>TAPE</span></div>
    <div class="stats"><span id="kbIn">0 KB</span> → <span id="kbOut">0 KB</span> • <span id="ratio">0% reduction</span> • <span id="counts">0→0</span> • depth <span id="depthD">0</span></div>
  </header>
  <section class="panel threecol">
    <div class="pane">
      <h2>Input</h2>
      <div class="viewerBar">
        <button id="loadGlyphs">Load Glyphs</button>
        <button id="saveGlyphs">Save Glyphs</button>
        <button id="glyphNow">Glyph Now</button>
      </div>
                   <div class="ascii-controls">
               <label><input id="asciiOnly" type="checkbox" checked/> ASCII only</label>
               <label class="small">Prefix: <input id="prefix" value="~" size="2"/></label>
               <label class="small">Levels: <input id="levels" type="range" min="1" max="3" value="2"/></label>
             </div>
             <div class="aggressive-controls">
               <label class="small">Max glyphs: <input id="maxGlyphsTrain" type="range" min="50" max="1000" value="512"/></label>
               <label class="small">N-grams: <input id="nMin" type="range" min="2" max="4" value="2"/>-<input id="nMax" type="range" min="3" max="6" value="5"/></label>
               <label class="small">Layer depth: <input id="layerDepth" type="range" min="1" max="3" value="1"/></label>
               <label class="small">Seed: <input id="seed" value="tape-1" size="8"/></label>
             </div>
      <textarea id="input" placeholder="Paste a large text block here..."></textarea>
    </div>
    <div class="pane">
      <h2>Glyphed</h2>
      <div id="legend" class="legend"></div>
      <div class="glyphed-section">
        <textarea id="glyphed" readonly></textarea>
      </div>
    </div>
    <div class="pane">
      <h2>Triangle</h2>
      <div class="viewerBar">
        <button id="reset">Reset View</button>
        <button id="toggleGrid">Toggle Grid</button>
        <label class="small">Max glyphs <input id="maxGlyphs" type="range" min="200" max="25000" value="6000"/></label>
        <span id="zoomInfo" class="small"></span>
      </div>
      <canvas id="view" width="900" height="650"></canvas>
    </div>
  </section>
`;

const el = {
  input: document.getElementById('input') as HTMLTextAreaElement,
  glyphed: document.getElementById('glyphed') as HTMLTextAreaElement,
  kbIn: document.getElementById('kbIn')!,
  kbOut: document.getElementById('kbOut')!,
  ratio: document.getElementById('ratio')!,
  counts: document.getElementById('counts')!,
  depthD: document.getElementById('depthD')!,
  max: document.getElementById('maxGlyphs') as HTMLInputElement,
  zoomInfo: document.getElementById('zoomInfo')!,
  reset: document.getElementById('reset') as HTMLButtonElement,
  toggleGrid: document.getElementById('toggleGrid') as HTMLButtonElement,
  glyphNow: document.getElementById('glyphNow') as HTMLButtonElement,
  loadGlyphs: document.getElementById('loadGlyphs') as HTMLButtonElement,
  saveGlyphs: document.getElementById('saveGlyphs') as HTMLButtonElement,
  canvas: document.getElementById('view') as HTMLCanvasElement,
  asciiOnly: document.getElementById('asciiOnly') as HTMLInputElement,
  prefix: document.getElementById('prefix') as HTMLInputElement,
  levels: document.getElementById('levels') as HTMLInputElement,
  maxGlyphsTrain: document.getElementById('maxGlyphsTrain') as HTMLInputElement,
  nMin: document.getElementById('nMin') as HTMLInputElement,
  nMax: document.getElementById('nMax') as HTMLInputElement,
  layerDepth: document.getElementById('layerDepth') as HTMLInputElement,
  seed: document.getElementById('seed') as HTMLInputElement,
  legend: document.getElementById('legend')!,
};
const ctx = el.canvas.getContext('2d')!;

// Initialize canvas with DPR
const dpr = window.devicePixelRatio || 1;
const rect = el.canvas.getBoundingClientRect();
el.canvas.width = Math.round(rect.width * dpr);
el.canvas.height = Math.round(rect.height * dpr);

// Transform
const t: Transform = { scale: 0.9 * Math.min(el.canvas.width, el.canvas.height), zoom: 1, offset: { x: el.canvas.width*0.05, y: el.canvas.height*0.05 } };
let showGrid = false, panning=false, anchor={x:0,y:0}, off0={x:0,y:0};
let panScale = { sx: 1, sy: 1 };
let hover = { code: '', screen: { x: 0, y: 0 }, visible: false };

// Data
let tokens: string[] = [];
let D = 0;
let positions: {x:number;y:number}[] = [];
function toKB(n:number){ return (n/1024).toFixed(2)+' KB'; }

function render(){
  ctx.clearRect(0,0,el.canvas.width,el.canvas.height);
  ctx.fillStyle = '#0b0e14'; ctx.fillRect(0,0,el.canvas.width,el.canvas.height);
  drawBaseTriangle(ctx, t);
  if (showGrid){
    const est = Math.max(1, Math.min(8, Math.floor(Math.log2(t.zoom*2))));
    drawGrid(ctx, t, est);
  }
  const pxCell = (t.scale * t.zoom) * (1 / (2 ** D));
  const drawLabel = pxCell >= 5;
  const limit = parseInt(el.max.value, 10);
  ctx.shadowColor = 'rgba(72,255,210,0.35)'; ctx.shadowBlur = 10;

  for (let i=0;i<positions.length && i<limit;i++){
    const p = worldToScreen(t, positions[i]);
    if (p.x<-50 || p.y<-50 || p.x>el.canvas.width+50 || p.y>el.canvas.height+50) continue;
    if (drawLabel){
      ctx.fillStyle = '#a2ffef';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = Math.max(10, pxCell) + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.fillText(tokens[i], p.x, p.y);
    } else {
      ctx.fillStyle = '#2bd1ff'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI*2); ctx.fill();
    }
  }

  // Hover overlay (always visible if inside tri)
  if (hover.visible){
    // crosshair
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(164,255,239,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hover.screen.x - 6, hover.screen.y);
    ctx.lineTo(hover.screen.x + 6, hover.screen.y);
    ctx.moveTo(hover.screen.x, hover.screen.y - 6);
    ctx.lineTo(hover.screen.x, hover.screen.y + 6);
    ctx.stroke();

    // label bubble
    const pad = 4;
    const text = hover.code;
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    const w = ctx.measureText(text).width + pad*2;
    const h = 18;

    const bx = hover.screen.x + 10;
    const by = hover.screen.y - (h + 10);

    ctx.fillStyle = 'rgba(6,12,20,0.85)';
    ctx.strokeStyle = 'rgba(43,209,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(bx, by, w, h); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#a2ffef';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + pad, by + h/2);
    ctx.restore();
  }

  el.zoomInfo.textContent = `zoom ${t.zoom.toFixed(2)} • cell ${pxCell.toFixed(1)}px`;
}

function updateLegend(glyphs: any[]) {
  const top20 = glyphs.slice(0, 20);
  el.legend.innerHTML = top20.map(g => 
    `<span class="legend-item"><code>${g.glyph}</code> = "${g.phrase.join(' ')}" <small>(L${g.layer || 0})</small></span>`
  ).join(' • ');
}

function updateAll(){
  const wordList = words(el.input.value);
  // Use glyphs up to the current layer depth for encoding
  const currentLayerDepth = getLayerDepth();
  const glyphsToUse = getGlyphsUpToLayer(currentLayerDepth);
  const trie = build(glyphsToUse);
  tokens = encode(wordList, trie);

  el.glyphed.value = tokens.join(' ');
  const enc = new TextEncoder();
  const inB = enc.encode(el.input.value).length;
  const outB = enc.encode(el.glyphed.value).length;
  el.kbIn.textContent = toKB(inB);
  el.kbOut.textContent = toKB(outB);
  el.ratio.textContent = inB ? `${(((inB - outB) / inB) * 100).toFixed(1)}% reduction` : '0% reduction';
  el.counts.textContent = `${wordList.length} words → ${tokens.length} tokens`;

  // Update legend
  updateLegend(glyphsToUse);

  D = Math.max(1, minDepthForSlots(tokens.length || 1));
  el.depthD.textContent = String(D);
  positions = computePositions(tokens.length, toBase3, D);
  render();
}

// Controls
el.canvas.addEventListener('wheel', (ev)=>{
  ev.preventDefault();
  const f = Math.exp(-ev.deltaY * 0.001);
  const m = toCanvasPoint(ev as MouseEvent, el.canvas);
  const before = screenToWorld(t, m);
  t.zoom = Math.max(.2, Math.min(6, t.zoom * f));
  const after = screenToWorld(t, m);
  t.offset.x += (after.x - before.x) * t.scale * t.zoom;
  t.offset.y += (after.y - before.y) * t.scale * t.zoom;
  render();
},{passive:false});

el.canvas.addEventListener('mousedown', (ev) => {
  panning = true;
  const { sx, sy } = canvasScale(el.canvas);
  panScale = { sx, sy };
  anchor = { x: ev.clientX, y: ev.clientY };
  off0 = { ...t.offset };
});

window.addEventListener('mouseup', () => { panning = false; });

window.addEventListener('mousemove', (ev) => {
  if (!panning) return;
  const dx = (ev.clientX - anchor.x) * panScale.sx;
  const dy = (ev.clientY - anchor.y) * panScale.sy;
  t.offset.x = off0.x + dx;
  t.offset.y = off0.y + dy;
  render();
});

// Hover tracking
el.canvas.addEventListener('mousemove', (ev) => {
  const m = toCanvasPoint(ev as MouseEvent, el.canvas);
  const w = screenToWorld(t, m);
  if (!isInsideBaseTri(w)) {
    hover.visible = false;
    render();
    return;
  }
  const code = pointToAddress(w, D);
  const center = worldToScreen(t, addressToPoint(code));
  hover = { code, screen: center, visible: true };
  render();
});

el.reset.onclick = () => {
  const rect = el.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  el.canvas.width = Math.round(rect.width * dpr);
  el.canvas.height = Math.round(rect.height * dpr);
  
  t.zoom = 1;
  t.offset = { x: el.canvas.width*0.05, y: el.canvas.height*0.05 };
  render();
};
el.toggleGrid.onclick = ()=>{ showGrid = !showGrid; render(); };
el.max.oninput = render;

// ASCII controls
el.asciiOnly.onchange = ()=>{ setAsciiOnly(el.asciiOnly.checked); updateAll(); };
el.prefix.oninput = ()=>{ updateAll(); };
el.levels.oninput = ()=>{ updateAll(); };
el.layerDepth.oninput = ()=>{ setLayerDepth(parseInt(el.layerDepth.value)); updateAll(); };

el.glyphNow.onclick = ()=>{
  const layerDepth = parseInt(el.layerDepth.value);
  setLayerDepth(layerDepth);
  
  if (getAsciiOnly()) {
    // Use layered mining with ASCII glyphs
    trainLayeredGlyphs(el.input.value, layerDepth, {
      top: parseInt(el.maxGlyphsTrain.value),
      prefix: el.prefix.value,
      levels: parseInt(el.levels.value),
      seed: el.seed.value || `tape-${Date.now()}`
    });
  } else {
    // Legacy Unicode training (single layer)
    trainGlyphsFromText(el.input.value, parseInt(el.maxGlyphs.value), 1);
  }
  updateAll();
};
el.loadGlyphs.onclick = ()=>{
  const i = document.createElement('input'); i.type='file'; i.accept='application/json';
  i.onchange = async ()=>{ if(!i.files?.[0]) return; const txt = await i.files[0].text(); const arr = JSON.parse(txt);
    if (Array.isArray(arr) && arr.length) { setGlyphs(arr); updateAll(); } };
  i.click();
};
el.saveGlyphs.onclick = ()=>{
  const blob = new Blob([exportGlyphs()], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='glyphs.json'; a.click(); URL.revokeObjectURL(a.href);
};

// Seed & debounce
el.input.value = "lorem ipsum dolor sit amet, consectetur adipiscing elit. sed erat erat, pulvinar non tincidunt sit amet...";
let timer: number|undefined;
el.input.addEventListener('input', ()=>{
  if (timer) cancelAnimationFrame(timer);
  timer = requestAnimationFrame(()=>updateAll());
});
updateAll();
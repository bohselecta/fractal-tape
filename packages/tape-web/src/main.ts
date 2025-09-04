import './style.css'

const app=document.getElementById('app')!
app.innerHTML=`
  <header class="top"><h1>Fractal Tape</h1><p class="sub">Offline demo (load export.json)</p></header>
  <section class="panel">
    <div class="controls">
      <input id="q" placeholder="Type query..."/>
      <button id="load">Load export.json</button>
      <input id="file" type="file" accept="application/json" style="display:none"/>
      <span id="meta" class="small"></span>
    </div>
    <ul id="results"></ul>
  </section>`;

const q=document.getElementById('q') as HTMLInputElement;
const loadBtn=document.getElementById('load') as HTMLButtonElement;
const file=document.getElementById('file') as HTMLInputElement;
const meta=document.getElementById('meta')!;
const results=document.getElementById('results')!;
let exportData:any=null;

loadBtn.onclick=()=>file.click();
file.onchange=async()=>{if(!file.files?.[0])return; const txt=await file.files[0].text(); exportData=JSON.parse(txt);
  meta.textContent = `tokens=${exportData?.meta?.count} • depthD=${exportData?.meta?.depthD}`; results.innerHTML=''; q.value=''; q.focus();
};

q.oninput=()=>{ if(!exportData){ results.innerHTML='<li>Load export.json first</li>'; return; }
  const tokens=tokenize(q.value); const addrSet=new Set<number>();
  for(const t of tokens){ const list=exportData.postings[t]; if(list) for(const a of list) addrSet.add(a); }
  const addrs=Array.from(addrSet).sort((a,b)=>a-b).slice(0,200);
  results.innerHTML=addrs.map(a=>`<li><span class="badge">addr ${a}</span> match</li>`).join('');
};

function tokenize(s:string){return s.toLowerCase().replace(/[^a-z0-9\s']/g,' ').trim().split(/\s+/).filter(Boolean);}

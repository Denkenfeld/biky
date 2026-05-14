/* ═══════════════════════════════════════════════════════
   d2-stats.js  —  Stats-Widget für 90-1.html & d2.html
   Einfach mit <script src="d2-stats.js"></script> einbinden.
   CSS wird automatisch injiziert.
   ═══════════════════════════════════════════════════════ */

(function injectD2CSS(){
  if(document.getElementById('d2-stats-style')) return;
  const s = document.createElement('style');
  s.id = 'd2-stats-style';
  s.textContent = `
.d2-stats-divider{border:none;border-top:1px solid rgba(255,255,255,0.10);margin:0 15px;}
.d2-kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}
.d2-kpi-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:9px;padding:12px 13px;position:relative;overflow:hidden;}
.d2-kpi-card.highlight{background:linear-gradient(135deg,rgba(0,230,118,0.07),rgba(0,0,0,0));border-color:rgba(0,230,118,0.25);}
.d2-kpi-card.highlight::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--green);box-shadow:0 0 8px rgba(0,230,118,0.5);}
.d2-kpi-icon{font-size:15px;margin-bottom:5px;}
.d2-kpi-label{font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:3px;}
.d2-kpi-value{font-family:var(--mono);font-size:20px;font-weight:700;color:var(--text);line-height:1;}
.d2-kpi-card.highlight .d2-kpi-value{color:var(--green);}
.d2-chart-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:9px;padding:12px 13px;margin-bottom:10px;}
.d2-card-title{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text);margin-bottom:2px;}
.d2-card-sub{font-size:8px;color:var(--muted);letter-spacing:.05em;text-transform:uppercase;margin-bottom:10px;}
.d2-chart-wrap{position:relative;height:140px;}
.d2-chart-wrap-sm{position:relative;height:110px;}
.d2-mini-row{display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;}
.d2-mini-row:last-child{border-bottom:none;}
.d2-mini-label{color:var(--dim);font-size:11px;}
.d2-mini-val{font-family:var(--mono);font-weight:600;color:var(--text);font-size:11px;}
.d2-period-btns{display:flex;gap:3px;margin-bottom:8px;}
.d2-period-btn{font-family:var(--font);font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:none;color:var(--dim);cursor:pointer;transition:.15s;flex:1;text-align:center;}
.d2-period-btn.active{background:rgba(0,230,118,.12);border-color:rgba(0,230,118,.35);color:var(--green);}
.d2-metric-btns{display:flex;gap:3px;margin-bottom:8px;}
.d2-metric-btn{font-family:var(--font);font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:3px 7px;border-radius:4px;border:1px solid rgba(0,212,255,.4);background:rgba(0,212,255,.12);color:var(--accent);cursor:pointer;flex:1;text-align:center;}
.d2-metric-btn.active-km{background:rgba(0,212,255,.14);border-color:rgba(0,212,255,.4);color:var(--accent);}
.d2-metric-btn.active-hm{background:rgba(255,61,107,.14);border-color:rgba(255,61,107,.4);color:var(--red);}
.d2-metric-btn.active-cal{background:rgba(255,145,0,.14);border-color:rgba(255,145,0,.4);color:var(--orange);}
.d2-ring-wrap{display:flex;justify-content:center;align-items:center;position:relative;margin:6px auto;}
.d2-ring-inner{position:absolute;text-align:center;}
.d2-ring-pct{font-family:var(--mono);font-size:18px;font-weight:700;color:var(--green);line-height:1;}
.d2-ring-sub{font-size:8px;color:var(--muted);margin-top:2px;}
.d2-heatmap-outer{overflow-x:auto;padding-bottom:4px;}
.d2-heatmap-grid{display:grid;grid-template-rows:repeat(7,10px);grid-auto-flow:column;gap:2px;width:max-content;}
.d2-heatmap-months{display:flex;gap:0;margin-bottom:4px;font-size:8px;font-weight:700;letter-spacing:.07em;color:var(--muted);text-transform:uppercase;width:max-content;}
.d2-hm-cell{width:10px;height:10px;border-radius:2px;background:rgba(255,255,255,0.04);cursor:pointer;transition:transform .1s;}
.d2-hm-cell:hover{transform:scale(1.3);}
.d2-hm-cell[data-level="1"]{background:rgba(0,230,118,0.2);}
.d2-hm-cell[data-level="2"]{background:rgba(0,230,118,0.45);}
.d2-hm-cell[data-level="3"]{background:rgba(0,230,118,0.7);}
.d2-hm-cell[data-level="4"]{background:rgba(0,230,118,0.95);box-shadow:0 0 4px rgba(0,230,118,0.4);}
.d2-heatmap-days{display:flex;flex-direction:column;gap:2px;margin-right:5px;flex-shrink:0;}
.d2-heatmap-days span{font-size:7px;color:var(--muted);height:10px;display:flex;align-items:center;font-family:var(--mono);}
.d2-chip-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;}
.d2-chip{font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:3px;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--dim);}
.d2-chip.green{background:rgba(0,230,118,0.1);border-color:rgba(0,230,118,0.3);color:var(--green);}
.d2-chip.accent{background:rgba(0,212,255,0.1);border-color:rgba(0,212,255,0.3);color:var(--accent);}
.d2-tour-list{display:flex;flex-direction:column;gap:5px;}
.d2-tour-row{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;background:rgba(255,255,255,0.03);border:1px solid transparent;transition:.15s;}
.d2-tour-row:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,.08);}
.d2-tour-icon{font-size:14px;flex-shrink:0;}
.d2-tour-info{flex:1;min-width:0;}
.d2-tour-name{font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.d2-tour-date{font-size:9px;color:var(--muted);margin-top:1px;}
.d2-tour-stats{display:flex;gap:8px;flex-shrink:0;}
.d2-tour-stat{text-align:right;}
.d2-tour-stat-v{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--accent);}
.d2-tour-stat-l{font-size:7px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;}
.d2-two-col{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}
`;
  document.head.appendChild(s);
})();

/* ── State ───────────────────────────────────────────── */
let _d2Period = 'year';
let _d2Metric = 'km';
const _d2Charts = new WeakMap();

/* ── Daten ───────────────────────────────────────────── */
function d2GetRides(){
  let local = [];
  try { local = JSON.parse(localStorage.getItem('vn_rides')||'[]'); } catch(e){}
  const cloud = window._cloudRides || [];
  const merged = [...local];
  cloud.forEach(cr => {
    if(!merged.some(lr => lr.date===cr.date && Math.abs((lr.km||0)-(cr.km||0))<0.2)) merged.push(cr);
  });
  return merged.map(r => ({
    name: r.name || 'Tour',
    date: r.date || '',
    km:   r.km   || 0,
    hm:   r.hm   || 0,
    cal:  r.cal  || 0,
  })).sort((a,b) => (b.date||'').localeCompare(a.date||''));
}

function d2FilterRides(rides){
  const now = new Date();
  return rides.filter(r => {
    if(!r.date) return _d2Period === 'all';
    const d = new Date(r.date);
    if(_d2Period==='week'){ const wa=new Date(now); wa.setDate(now.getDate()-6); return d>=wa; }
    if(_d2Period==='month') return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
    if(_d2Period==='year')  return d.getFullYear()===now.getFullYear();
    return true;
  });
}

/* ── Scopes: alle gerenderten Profil-Panes ───────────── */
function d2Scopes(){
  return ['t-profil','st-profil']
    .map(id => document.getElementById(id))
    .filter(el => el && el.querySelector('.d2-kpi-grid'));
}

/* ── Öffentliche Steuerung ───────────────────────────── */
window.d2SetPeriod = function(p, btn){
  _d2Period = p;
  document.querySelectorAll('.d2-period-btns .d2-period-btn').forEach(b => b.classList.remove('active'));
  if(btn){
    btn.classList.add('active');
    const grp = btn.closest('.d2-period-btns');
    if(grp) document.querySelectorAll('.d2-period-btns').forEach(g => {
      if(g!==grp){ const match=g.querySelector(`[onclick="${btn.getAttribute('onclick')}"]`); if(match) match.classList.add('active'); }
    });
  }
  const labels = {week:'Letzte 7 Tage', month:'Dieser Monat', year:'Dieses Jahr', all:'Gesamtzeitraum'};
  document.querySelectorAll('.d2-chart-period-label').forEach(el => el.textContent = labels[p]||'');
  initD2Stats();
};

window.d2SetMetric = function(m, btn){
  _d2Metric = m;
  document.querySelectorAll('.d2-metric-btns .d2-metric-btn').forEach(b => b.className='d2-metric-btn');
  document.querySelectorAll(`.d2-metric-btns .d2-metric-btn[onclick="d2SetMetric('${m}',this)"]`).forEach(b => b.classList.add('active-'+m));
  const allRides = d2GetRides();
  d2Scopes().forEach(scope => d2RenderMainChart(scope, d2FilterRides(allRides)));
};

/* ── Haupt-Init ──────────────────────────────────────── */
function initD2Stats(){
  const scopes = d2Scopes();
  if(!scopes.length) return;
  const allRides = d2GetRides();
  const filtered = d2FilterRides(allRides);
  scopes.forEach(scope => {
    d2RenderKPIs(scope, filtered);
    d2RenderMainChart(scope, filtered);
    d2RenderWeekdayChart(scope, filtered);
    d2RenderDoughnut(scope, filtered);
    d2RenderActivityStats(scope, filtered);
    d2RenderGoalRing(scope, allRides);
    d2RenderHeatmap(scope, allRides);
    d2RenderTourList(scope, allRides);
  });
}
window.initD2Stats = initD2Stats;

/* ── Render-Funktionen ───────────────────────────────── */
function d2RenderKPIs(scope, rides){
  const km  = rides.reduce((s,r)=>s+r.km, 0);
  const hm  = rides.reduce((s,r)=>s+r.hm, 0);
  const cal = rides.reduce((s,r)=>s+r.cal,0);
  const set = (sel, v) => { const el=scope.querySelector(sel); if(el) el.textContent=v; };
  set('.d2-kpi-km',    km  > 0 ? km.toFixed(0)+' km' : '—');
  set('.d2-kpi-hm',    hm  > 0 ? hm.toFixed(0)+' m'  : '—');
  set('.d2-kpi-cal',   cal > 0 ? cal.toFixed(0)       : '—');
  set('.d2-kpi-tours', rides.length || '—');
}

function d2RenderMainChart(scope, rides){
  const canvas = scope.querySelector('.d2-main-chart');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const now = new Date();
  let labels = [], dataMap = {};

  if(_d2Period==='week'){
    const dn=['So','Mo','Di','Mi','Do','Fr','Sa'];
    for(let i=6;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); const k=d.toISOString().slice(0,10); labels.push(dn[d.getDay()]); dataMap[k]=0; }
  } else if(_d2Period==='month'){
    const dInM=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    for(let i=1;i<=dInM;i++){ const d=new Date(now.getFullYear(),now.getMonth(),i); labels.push(i%5===1?String(i):''); dataMap[d.toISOString().slice(0,10)]=0; }
  } else if(_d2Period==='year'){
    ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'].forEach((m,i)=>{ labels.push(m); dataMap[`${now.getFullYear()}-${String(i+1).padStart(2,'0')}`]=0; });
  } else {
    const sk=[...new Set(rides.map(r=>r.date?.slice(0,7)).filter(Boolean))].sort();
    sk.forEach(k=>{ const[y,m]=k.split('-'); labels.push(`${m}/${y.slice(2)}`); dataMap[k]=0; });
  }

  const keys = Object.keys(dataMap);
  rides.forEach(r=>{
    if(!r.date) return;
    const k = (_d2Period==='year'||_d2Period==='all') ? r.date.slice(0,7) : r.date;
    const h = keys.find(x => k.startsWith(x));
    if(h != null) dataMap[h] += _d2Metric==='km' ? r.km : _d2Metric==='hm' ? r.hm : r.cal;
  });
  const dp = Object.values(dataMap);
  const mc = {km:'rgba(0,212,255,', hm:'rgba(255,61,107,', cal:'rgba(255,145,0,'};
  const col = mc[_d2Metric]||mc.km;
  const grad = ctx.createLinearGradient(0,0,0,140);
  grad.addColorStop(0, col+'0.35)'); grad.addColorStop(1, col+'0)');

  const existing = _d2Charts.get(canvas);
  if(existing){ try{ existing.destroy(); }catch(e){} }
  _d2Charts.set(canvas, new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ data:dp, backgroundColor:dp.map(v=>v>0?grad:'rgba(255,255,255,0.03)'), borderColor:dp.map(v=>v>0?col+'1)':'rgba(255,255,255,0.07)'), borderWidth:1.5, borderRadius:3, borderSkipped:false }] },
    options:{ responsive:true, maintainAspectRatio:false, animation:{duration:250},
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{label:c=>`${c.raw.toFixed(_d2Metric==='km'?1:0)} ${_d2Metric==='km'?'km':_d2Metric==='hm'?'m':'kcal'}`}, backgroundColor:'rgba(4,5,8,0.96)', borderColor:'rgba(255,255,255,0.12)', borderWidth:1, bodyFont:{family:'JetBrains Mono'} }},
      scales:{ x:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'rgba(139,155,180,.7)',font:{size:8}} }, y:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'rgba(139,155,180,.7)',font:{size:8},maxTicksLimit:4}, beginAtZero:true } }
    }
  }));
}

function d2RenderWeekdayChart(scope, rides){
  const canvas = scope.querySelector('.d2-weekday-chart');
  if(!canvas) return;
  const dn=['So','Mo','Di','Mi','Do','Fr','Sa'], counts=[0,0,0,0,0,0,0];
  rides.forEach(r=>{ if(!r.date) return; counts[new Date(r.date).getDay()]++; });
  const md = counts.indexOf(Math.max(...counts));
  const favEl = scope.querySelector('.d2-fav-day');
  if(favEl) favEl.textContent = counts.some(c=>c>0) ? dn[md] : '—';
  const ws = new Set();
  rides.forEach(r=>{ if(!r.date) return; const d=new Date(r.date); ws.add(`${d.getFullYear()}-W${Math.ceil(d.getDate()/7)}`); });
  const avgEl = scope.querySelector('.d2-avg-per-week');
  if(avgEl) avgEl.textContent = ws.size>0 ? (rides.length/Math.max(ws.size,1)).toFixed(1) : '—';
  const existing = _d2Charts.get(canvas);
  if(existing){ try{ existing.destroy(); }catch(e){} }
  _d2Charts.set(canvas, new Chart(canvas.getContext('2d'), {
    type:'bar',
    data:{ labels:dn, datasets:[{ data:counts, backgroundColor:counts.map((c,i)=>i===md?'rgba(0,230,118,0.7)':'rgba(0,212,255,0.25)'), borderColor:counts.map((c,i)=>i===md?'rgba(0,230,118,1)':'rgba(0,212,255,0.5)'), borderWidth:1.5, borderRadius:3, borderSkipped:false }] },
    options:{ responsive:true, maintainAspectRatio:false, animation:{duration:200},
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{label:c=>`${c.raw} Touren`}, backgroundColor:'rgba(4,5,8,0.96)', borderColor:'rgba(255,255,255,0.12)', borderWidth:1, bodyFont:{family:'JetBrains Mono'} }},
      scales:{ x:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'rgba(139,155,180,.7)',font:{size:8}} }, y:{ display:false, beginAtZero:true } }
    }
  }));
}

function d2RenderDoughnut(scope, rides){
  const canvas = scope.querySelector('.d2-doughnut-chart');
  if(!canvas) return;
  const s=rides.filter(r=>r.km<30).length, m=rides.filter(r=>r.km>=30&&r.km<=70).length, l=rides.filter(r=>r.km>70).length;
  const set = (sel, v) => { const el=scope.querySelector(sel); if(el) el.textContent=v; };
  set('.d2-longest-tour', rides.length ? rides.reduce((x,r)=>Math.max(x,r.km),0).toFixed(0)+' km' : '—');
  set('.d2-avg-dist',     rides.length ? (rides.reduce((x,r)=>x+r.km,0)/rides.length).toFixed(0)+' km' : '—');
  const existing = _d2Charts.get(canvas);
  if(existing){ try{ existing.destroy(); }catch(e){} }
  if(!rides.length) return;
  _d2Charts.set(canvas, new Chart(canvas.getContext('2d'), {
    type:'doughnut',
    data:{ labels:['<30km','30–70km','>70km'], datasets:[{ data:[s,m,l], backgroundColor:['rgba(0,230,118,0.75)','rgba(0,212,255,0.7)','rgba(255,145,0,0.75)'], borderColor:['rgba(0,230,118,1)','rgba(0,212,255,1)','rgba(255,145,0,1)'], borderWidth:1.5, hoverOffset:4 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'66%',
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{label:c=>`${c.label}: ${c.raw}`}, backgroundColor:'rgba(4,5,8,0.96)', borderColor:'rgba(255,255,255,0.12)', borderWidth:1, bodyFont:{family:'JetBrains Mono'} } }
    }
  }));
}

function d2RenderActivityStats(scope, rides){
  const ws=new Set(), mc={}, mns=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  rides.forEach(r=>{
    if(!r.date) return;
    const d=new Date(r.date);
    ws.add(`${d.getFullYear()}-${Math.ceil(d.getDate()/7)}`);
    const k=`${d.getFullYear()}-${d.getMonth()}`; mc[k]=(mc[k]||0)+1;
  });
  const set = (sel, v) => { const el=scope.querySelector(sel); if(el) el.textContent=v; };
  set('.d2-active-weeks', ws.size||'—');
  const bm = Object.entries(mc).sort((a,b)=>b[1]-a[1])[0];
  set('.d2-best-month', bm ? `${mns[parseInt(bm[0].split('-')[1])]} ${bm[0].split('-')[0]}` : '—');
  const ds=new Set(rides.map(r=>r.date).filter(Boolean)); let cur=0, maxS=0; const today=new Date();
  for(let i=0;i<365;i++){ const d=new Date(today); d.setDate(today.getDate()-i); if(ds.has(d.toISOString().slice(0,10))){ cur++; maxS=Math.max(maxS,cur); } else if(i>0) cur=0; }
  set('.d2-streak',      maxS>0 ? `${maxS} Tage` : '—');
  set('.d2-avg-hm',      rides.length ? Math.round(rides.reduce((s,r)=>s+r.hm, 0)/rides.length)+' m'    : '—');
  set('.d2-avg-cal',     rides.length ? Math.round(rides.reduce((s,r)=>s+r.cal,0)/rides.length)+' kcal' : '—');
}

function d2RenderGoalRing(scope, allRides){
  const yr  = allRides.filter(r=>r.date && new Date(r.date).getFullYear()===new Date().getFullYear());
  const km  = yr.reduce((s,r)=>s+r.km,0);
  const goal = 5000, pct = Math.min(km/goal,1);
  const ring = scope.querySelector('.d2-goal-ring');
  if(ring) ring.style.strokeDashoffset = 232*(1-pct);
  const set = (sel, v) => { const el=scope.querySelector(sel); if(el) el.textContent=v; };
  set('.d2-goal-pct',       (pct*100).toFixed(0)+'%');
  set('.d2-goal-reached',   km.toFixed(0)+' km');
  set('.d2-goal-remaining', Math.max(0,goal-km).toFixed(0)+' km');
}

function d2RenderHeatmap(scope, allRides){
  const year = new Date().getFullYear();
  const yearEl = scope.querySelector('.d2-heatmap-year');
  if(yearEl) yearEl.textContent = year;
  const container = scope.querySelector('.d2-heatmap-container');
  if(!container) return;

  const dc={};
  allRides.forEach(r=>{ if(!r.date||parseInt(r.date.slice(0,4))!==year) return; dc[r.date]=(dc[r.date]||0)+1; });
  const maxC = Math.max(...Object.values(dc),1);
  const sd=new Date(year,0,1), sday=sd.getDay(), offset=sday===0?6:sday-1;
  const totalDays=(new Date(year,11,31)-sd)/86400000+1, totalCells=Math.ceil((totalDays+offset)/7)*7;
  const mns=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const mpos=[]; let cm=-1;
  for(let i=0;i<totalCells;i++){
    const do2=i-offset; if(do2<0||do2>=totalDays) continue;
    const dt=new Date(year,0,1+do2);
    if(dt.getMonth()!==cm){ cm=dt.getMonth(); mpos.push({col:Math.floor(i/7),name:mns[cm]}); }
  }

  container.innerHTML='';
  const cw=12;
  const mr=document.createElement('div'); mr.className='d2-heatmap-months'; mr.style.paddingLeft='20px'; let prevCol=0;
  mpos.forEach(mp=>{
    const sp=document.createElement('div'); sp.style.width=`${(mp.col-prevCol)*cw}px`; sp.style.flexShrink='0'; mr.appendChild(sp);
    const lb=document.createElement('div'); lb.textContent=mp.name; lb.style.flexShrink='0'; mr.appendChild(lb);
    prevCol=mp.col+Math.ceil(mp.name.length*6/cw);
  });
  container.appendChild(mr);

  const inner=document.createElement('div'); inner.style.display='flex';
  const dl=document.createElement('div'); dl.className='d2-heatmap-days';
  ['Mo','','Mi','','Fr','','So'].forEach(d=>{ const s=document.createElement('span'); s.textContent=d; dl.appendChild(s); });
  inner.appendChild(dl);
  const od=document.createElement('div'); od.className='d2-heatmap-outer';
  const grid=document.createElement('div'); grid.className='d2-heatmap-grid';
  for(let i=0;i<totalCells;i++){
    const cell=document.createElement('div'); cell.className='d2-hm-cell';
    const do2=i-offset;
    if(do2<0||do2>=totalDays){ cell.style.opacity='0'; cell.style.pointerEvents='none'; }
    else{
      const dt=new Date(year,0,1+do2); const ds=dt.toISOString().slice(0,10);
      const cnt=dc[ds]||0;
      if(cnt>0){ cell.setAttribute('data-level',Math.ceil((cnt/maxC)*4)); cell.title=`${ds}: ${cnt} Tour${cnt>1?'en':''}`; }
      else cell.title=ds;
    }
    grid.appendChild(cell);
  }
  od.appendChild(grid); inner.appendChild(od); container.appendChild(inner);

  const tt=allRides.filter(r=>r.date&&parseInt(r.date.slice(0,4))===year).length;
  const chips=scope.querySelector('.d2-heatmap-chips');
  if(chips) chips.innerHTML=`<span class="d2-chip green">📍 ${tt} Touren ${year}</span><span class="d2-chip accent">📅 ${Object.keys(dc).length} aktive Tage</span>`;
}

function d2RenderTourList(scope, allRides){
  const list=scope.querySelector('.d2-tour-list');
  if(!list) return;
  const recent=allRides.slice(0,10);
  if(!recent.length){
    list.innerHTML='<div style="text-align:center;padding:16px;color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;">Noch keine Touren</div>';
    return;
  }
  list.innerHTML=recent.map(r=>`
    <div class="d2-tour-row">
      <div class="d2-tour-icon">🗺</div>
      <div class="d2-tour-info">
        <div class="d2-tour-name">${r.name}</div>
        <div class="d2-tour-date">${r.date||''}</div>
      </div>
      <div class="d2-tour-stats">
        <div class="d2-tour-stat"><div class="d2-tour-stat-v">${r.km.toFixed(1)}</div><div class="d2-tour-stat-l">km</div></div>
        ${r.hm>0?`<div class="d2-tour-stat"><div class="d2-tour-stat-v" style="color:var(--red);">${r.hm}</div><div class="d2-tour-stat-l">hm</div></div>`:''}
        ${r.cal>0?`<div class="d2-tour-stat"><div class="d2-tour-stat-v" style="color:var(--orange);">${r.cal}</div><div class="d2-tour-stat-l">kcal</div></div>`:''}
      </div>
    </div>`).join('');
}

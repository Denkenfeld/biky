/* ═══════════════════════════════════════════════════════
   d2-stats.js  —  Stats-Widget für 90-1.html, d2.html, d3.html
   Einbinden mit <script src="d2-stats.js"></script>
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
.d2-heatmap-scroll{overflow-x:auto;padding-bottom:4px;}
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
.d2-radial-wrap{display:flex;flex-direction:column;align-items:center;margin:4px 0 8px;}
.d2-radial-svg{display:block;width:100%;max-width:280px;height:auto;}
.d2-radial-month-label{font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;fill:var(--muted,#3d4d60);}
.d2-radial-center-text{font-family:var(--mono,'JetBrains Mono',monospace);font-size:11px;font-weight:700;fill:var(--green,#00e676);text-anchor:middle;dominant-baseline:middle;}
.d2-radial-center-sub{font-size:8px;fill:var(--muted,#3d4d60);text-anchor:middle;dominant-baseline:middle;}
.d2-community-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:9px;overflow:hidden;margin-bottom:10px;}
.d2-community-card-header{padding:10px 13px 8px;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,0.06);}
.d2-community-card-title{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text,#e4ecf4);}
.d2-community-card-status{font-size:8px;color:var(--muted,#3d4d60);font-family:var(--mono,'JetBrains Mono',monospace);margin-left:auto;}
.d2-community-mapwrap{position:relative;width:100%;height:320px;}
.d2-community-map{position:absolute;inset:0;}
.d2-community-load{position:absolute;inset:0;z-index:10;background:rgba(4,5,8,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;}
.d2-community-load-text{font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#3d4d60);}
.d2-community-load-bar{width:120px;height:2px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;}
.d2-community-load-fill{height:100%;background:var(--green,#00e676);border-radius:2px;transition:width .4s ease;}
.d2-community-spin{width:18px;height:18px;border:2px solid rgba(255,255,255,0.08);border-top-color:var(--green,#00e676);border-radius:50%;animation:d2cspin .7s linear infinite;}
@keyframes d2cspin{to{transform:rotate(360deg);}}
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

/* ── Scopes ──────────────────────────────────────────── */
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
    d2RenderRadialHeatmap(scope, allRides);
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
  // Ensure canvas has dimensions (container must be visible when this runs)
  const chartH = canvas.offsetHeight || 140;
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
    const sk=[...new Set(rides.map(r=>r.date&&r.date.slice(0,7)).filter(Boolean))].sort();
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
  const grad = ctx.createLinearGradient(0,0,0,chartH);
  grad.addColorStop(0, col+'0.35)'); grad.addColorStop(1, col+'0)');

  const existing = _d2Charts.get(canvas);
  if(existing){
    try{ existing.destroy(); }catch(e){}
    // Clear any inline dimensions Chart.js may have set, so it reads from CSS
    canvas.style.width = '';
    canvas.style.height = '';
  }
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
  if(existing){
    existing.data.datasets[0].data = counts;
    existing.data.datasets[0].backgroundColor = counts.map((c,i)=>i===md?'rgba(0,230,118,0.7)':'rgba(0,212,255,0.25)');
    existing.data.datasets[0].borderColor = counts.map((c,i)=>i===md?'rgba(0,230,118,1)':'rgba(0,212,255,0.5)');
    existing.update('none');
    return;
  }
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
  if(existing){
    existing.data.datasets[0].data = [s,m,l];
    existing.update('none');
    return;
  }
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

  // Scrollbarer Wrapper — Monate scrollen MIT dem Grid
  const scrollWrap=document.createElement('div');
  scrollWrap.className='d2-heatmap-scroll';

  const mr=document.createElement('div'); mr.className='d2-heatmap-months'; mr.style.paddingLeft='22px'; let prevCol=0;
  mpos.forEach(mp=>{
    const sp=document.createElement('div'); sp.style.width=`${(mp.col-prevCol)*cw}px`; sp.style.flexShrink='0'; mr.appendChild(sp);
    const lb=document.createElement('div'); lb.textContent=mp.name; lb.style.flexShrink='0'; mr.appendChild(lb);
    prevCol=mp.col+Math.ceil(mp.name.length*6/cw);
  });
  scrollWrap.appendChild(mr);

  const inner=document.createElement('div'); inner.style.display='flex';
  const dl=document.createElement('div'); dl.className='d2-heatmap-days';
  ['Mo','','Mi','','Fr','','So'].forEach(d=>{ const s=document.createElement('span'); s.textContent=d; dl.appendChild(s); });
  inner.appendChild(dl);
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
  inner.appendChild(grid);
  scrollWrap.appendChild(inner);
  container.appendChild(scrollWrap);

  const tt=allRides.filter(r=>r.date&&parseInt(r.date.slice(0,4))===year).length;
  const chips=scope.querySelector('.d2-heatmap-chips');
  if(chips) chips.innerHTML=`<span class="d2-chip green">📍 ${tt} Touren ${year}</span><span class="d2-chip accent">📅 ${Object.keys(dc).length} aktive Tage</span>`;
}

function d2RenderRadialHeatmap(scope, allRides){
  const container = scope.querySelector('.d2-radial-container');
  if(!container) return;
  const year = new Date().getFullYear();
  const dc={};
  allRides.forEach(r=>{ if(!r.date||parseInt(r.date.slice(0,4))!==year) return; dc[r.date]=(dc[r.date]||0)+1; });
  const maxC = Math.max(...Object.values(dc),1);
  const mns=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const totalDays=(new Date(year,11,31)-new Date(year,0,1))/86400000+1;
  const cx=140,cy=140,r0=28,r1=118,NS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox','0 0 280 280');
  svg.setAttribute('class','d2-radial-svg');
  const anglePerDay=(2*Math.PI)/totalDays, gap=0.008;

  // Hintergrundring
  [0.25,0.5,0.75].forEach(f=>{
    const r=r0+(r1-r0)*f;
    const c=document.createElementNS(NS,'circle');
    c.setAttribute('cx',cx);c.setAttribute('cy',cy);c.setAttribute('r',r);
    c.setAttribute('fill','none');c.setAttribute('stroke','rgba(255,255,255,0.04)');c.setAttribute('stroke-width','0.5');
    svg.appendChild(c);
  });

  // Tages-Segmente
  for(let d=0;d<totalDays;d++){
    const dt=new Date(year,0,1+d);
    const ds=dt.toISOString().slice(0,10);
    const cnt=dc[ds]||0;
    const level=cnt>0?Math.ceil((cnt/maxC)*4):0;
    const a0=-Math.PI/2+d*anglePerDay+gap/2;
    const a1=-Math.PI/2+(d+1)*anglePerDay-gap/2;
    const cos0=Math.cos(a0),sin0=Math.sin(a0),cos1=Math.cos(a1),sin1=Math.sin(a1);
    const lg=anglePerDay>Math.PI?1:0;
    const path=document.createElementNS(NS,'path');
    path.setAttribute('d',`M${cx+r0*cos0},${cy+r0*sin0} L${cx+r1*cos0},${cy+r1*sin0} A${r1},${r1},0,${lg},1,${cx+r1*cos1},${cy+r1*sin1} L${cx+r0*cos1},${cy+r0*sin1} A${r0},${r0},0,${lg},0,${cx+r0*cos0},${cy+r0*sin0}Z`);
    const colors=['rgba(255,255,255,0.04)','rgba(0,230,118,0.2)','rgba(0,230,118,0.45)','rgba(0,230,118,0.7)','rgba(0,230,118,0.95)'];
    path.setAttribute('fill',colors[level]);
    if(level===4) path.setAttribute('filter','drop-shadow(0 0 2px rgba(0,230,118,0.5))');
    svg.appendChild(path);
  }

  // Monatslinien + Beschriftungen
  for(let m=0;m<12;m++){
    const dayOff=(new Date(year,m,1)-new Date(year,0,1))/86400000;
    const angle=-Math.PI/2+dayOff*anglePerDay;
    const line=document.createElementNS(NS,'line');
    line.setAttribute('x1',cx+(r0-2)*Math.cos(angle));line.setAttribute('y1',cy+(r0-2)*Math.sin(angle));
    line.setAttribute('x2',cx+(r1+2)*Math.cos(angle));line.setAttribute('y2',cy+(r1+2)*Math.sin(angle));
    line.setAttribute('stroke','rgba(255,255,255,0.15)');line.setAttribute('stroke-width','0.8');
    svg.appendChild(line);
    const nextOff=m<11?(new Date(year,m+1,1)-new Date(year,0,1))/86400000:totalDays;
    const ma=-Math.PI/2+((dayOff+nextOff)/2)*anglePerDay;
    const lx=cx+(r1+13)*Math.cos(ma), ly=cy+(r1+13)*Math.sin(ma);
    const txt=document.createElementNS(NS,'text');
    txt.setAttribute('x',lx);txt.setAttribute('y',ly);
    txt.setAttribute('class','d2-radial-month-label');
    txt.setAttribute('text-anchor','middle');txt.setAttribute('dominant-baseline','middle');
    txt.setAttribute('transform',`rotate(${(ma+Math.PI/2)*(180/Math.PI)},${lx},${ly})`);
    txt.textContent=mns[m];
    svg.appendChild(txt);
  }

  // Mitteltext
  const totalTours=allRides.filter(r=>r.date&&parseInt(r.date.slice(0,4))===year).length;
  const t1=document.createElementNS(NS,'text');
  t1.setAttribute('x',cx);t1.setAttribute('y',cy-7);t1.setAttribute('class','d2-radial-center-text');
  t1.textContent=totalTours;svg.appendChild(t1);
  const t2=document.createElementNS(NS,'text');
  t2.setAttribute('x',cx);t2.setAttribute('y',cy+7);t2.setAttribute('class','d2-radial-center-sub');
  t2.textContent='Touren '+year;svg.appendChild(t2);

  container.innerHTML='';
  container.appendChild(svg);
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

/* ═══════════════════════════════════════════════════════
   COMMUNITY ROUTENKARTE
   Einbinden mit:
   <div class="d2-community-map-container"></div>
   Benötigt maplibre-gl — wird automatisch nachgeladen falls
   nicht vorhanden. Verbindet sich mit window.db/AW_DB/AW_COL.
   ═══════════════════════════════════════════════════════ */

const _d2CommMaps = new WeakMap();

function _d2LoadMapLibre(){
  if(window.maplibregl) return Promise.resolve();
  return new Promise(function(res, rej){
    // CSS
    if(!document.querySelector('link[href*="maplibre-gl"]')){
      const l=document.createElement('link');
      l.rel='stylesheet';
      l.href='https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      document.head.appendChild(l);
    }
    // JS
    const s=document.createElement('script');
    s.src='https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
    s.onload=res;
    s.onerror=function(){ rej(new Error('MapLibre konnte nicht geladen werden')); };
    document.head.appendChild(s);
  });
}

async function d2InitCommunityMap(container){
  if(_d2CommMaps.has(container)) return;
  _d2CommMaps.set(container, true);

  // Wrapper aufbauen
  container.innerHTML='';
  const card=document.createElement('div');
  card.className='d2-community-card';

  const hdr=document.createElement('div');
  hdr.className='d2-community-card-header';
  hdr.innerHTML='<span class="d2-community-card-title">🌐 Community Routen</span><span class="d2-community-card-status" id="_d2cst"></span>';
  card.appendChild(hdr);

  const mapwrap=document.createElement('div');
  mapwrap.className='d2-community-mapwrap';

  const mapEl=document.createElement('div');
  mapEl.className='d2-community-map';
  mapwrap.appendChild(mapEl);

  const loadEl=document.createElement('div');
  loadEl.className='d2-community-load';
  loadEl.innerHTML='<div class="d2-community-spin"></div><div class="d2-community-load-text" id="_d2clt">Lade…</div><div class="d2-community-load-bar"><div class="d2-community-load-fill" id="_d2clf" style="width:0%"></div></div>';
  mapwrap.appendChild(loadEl);
  card.appendChild(mapwrap);
  container.appendChild(card);

  const ltEl=loadEl.querySelector('#_d2clt');
  const lfEl=loadEl.querySelector('#_d2clf');
  const stEl=hdr.querySelector('#_d2cst');
  const setLoad=function(txt,pct){ ltEl.textContent=txt; lfEl.style.width=pct+'%'; };

  try{
    setLoad('Lade Karte…', 8);
    await _d2LoadMapLibre();

    const routeMap=new maplibregl.Map({
      container: mapEl,
      style:{
        version:8,
        sources:{ osm:{ type:'raster', tiles:['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png','https://b.tile.openstreetmap.org/{z}/{x}/{y}.png','https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize:256, attribution:'© OpenStreetMap' } },
        layers:[
          { id:'bg',  type:'background', paint:{'background-color':'#060a10'} },
          { id:'osm', type:'raster',     source:'osm', paint:{'raster-saturation':-1,'raster-contrast':0.1,'raster-brightness-min':0,'raster-brightness-max':0.3,'raster-opacity':0.85} }
        ]
      },
      center:[9.15,48.35], zoom:9, pitchWithRotate:false, maxPitch:0,
      attributionControl:false
    });
    routeMap.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    routeMap.addControl(new maplibregl.ScaleControl({maxWidth:90,unit:'metric'}),'bottom-left');

    setLoad('Lade Routen…', 20);

    let allDocs=[];
    try{
      const db=window.db, DB=window.AW_DB, COL=window.AW_COL, Q=window.Query;
      if(db && DB && COL && Q){
        let cursor=null, page=0;
        while(true){
          const qs=[Q.orderDesc('$createdAt'), Q.limit(100)];
          if(cursor) qs.push(Q.cursorAfter(cursor));
          const res=await db.listDocuments(DB, COL, qs);
          const valid=res.documents.filter(function(d){ return d.routeName!=='__weight__' && (d.distance||0)>0; });
          allDocs=allDocs.concat(valid);
          lfEl.style.width=Math.min(20+allDocs.length*0.3, 65)+'%';
          ltEl.textContent=allDocs.length+' Routen geladen…';
          if(res.documents.length<100) break;
          cursor=res.documents[res.documents.length-1].$id;
          if(++page>30) break;
        }
      }
    }catch(e){ console.warn('d2 community load:', e); }

    setLoad('Berechne Häufigkeiten…', 70);

    const GRID=0.001;
    const snap=function(v){ return Math.round(v/GRID)*GRID; };
    const segCounts=new Map(), routeLines=[], userSet=new Set();

    for(let i=0;i<allDocs.length;i++){
      const doc=allDocs[i];
      let coords=[];
      try{ coords=JSON.parse(doc.coordinates||'[]'); }catch(e){ continue; }
      if(!Array.isArray(coords)||coords.length<2) continue;
      const norm=coords.map(function(c){
        if(Array.isArray(c)&&c.length>=2) return [parseFloat(c[0]),parseFloat(c[1])];
        if(c&&typeof c==='object'){ if('lng' in c) return [parseFloat(c.lng),parseFloat(c.lat)]; if('lon' in c) return [parseFloat(c.lon),parseFloat(c.lat)]; }
        return null;
      }).filter(function(c){ return c&&!isNaN(c[0])&&!isNaN(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90; });
      if(norm.length<2) continue;
      userSet.add(doc.userId);
      routeLines.push({coords:norm, km:(doc.distance||0)/1000});
      for(let j=0;j<norm.length-1;j++){
        const a=[snap(norm[j][0]),snap(norm[j][1])];
        const b=[snap(norm[j+1][0]),snap(norm[j+1][1])];
        const key=a[0]<b[0]||(a[0]===b[0]&&a[1]<b[1]) ? a[0]+','+a[1]+'|'+b[0]+','+b[1] : b[0]+','+b[1]+'|'+a[0]+','+a[1];
        segCounts.set(key,(segCounts.get(key)||0)+1);
      }
    }

    setLoad('Rendere Karte…', 88);

    const features=routeLines.map(function(rl){
      let maxFreq=1;
      for(let j=0;j<rl.coords.length-1;j++){
        const a=[snap(rl.coords[j][0]),snap(rl.coords[j][1])];
        const b=[snap(rl.coords[j+1][0]),snap(rl.coords[j+1][1])];
        const key=a[0]<b[0]||(a[0]===b[0]&&a[1]<b[1]) ? a[0]+','+a[1]+'|'+b[0]+','+b[1] : b[0]+','+b[1]+'|'+a[0]+','+a[1];
        maxFreq=Math.max(maxFreq,segCounts.get(key)||1);
      }
      return {type:'Feature',properties:{freq:maxFreq,km:rl.km},geometry:{type:'LineString',coordinates:rl.coords}};
    });

    function addLayers(){
      if(!features.length){
        ltEl.textContent='Keine Routen gefunden.';
        lfEl.style.width='100%';
        return;
      }

      routeMap.addSource('d2-routes',{type:'geojson',data:{type:'FeatureCollection',features:features}});

      // Zoom-abhängige Skalierung — kein Farbblock-Effekt beim Rauszoomen
      const zs=['interpolate',['exponential',2],['zoom'],6,0.07,8,0.16,10,0.38,12,0.68,14,1.0,16,1.4];

      routeMap.addLayer({id:'d2-routes-glow',type:'line',source:'d2-routes',
        layout:{'line-join':'round','line-cap':'round'},
        paint:{
          'line-color':['interpolate',['linear'],['get','freq'],1,'#001a2e',4,'#003344',8,'#004433',15,'#ffffff'],
          'line-opacity':['interpolate',['linear'],['get','freq'],1,0.06,4,0.12,10,0.2],
          'line-width':['*',zs,['interpolate',['linear'],['get','freq'],1,8,4,14,8,22,15,34]],
          'line-blur':['*',zs,5]
        }
      });
      routeMap.addLayer({id:'d2-routes-main',type:'line',source:'d2-routes',
        layout:{'line-join':'round','line-cap':'round'},
        paint:{
          'line-color':['interpolate',['linear'],['get','freq'],1,'#004466',2,'#0077aa',3,'#00aabb',5,'#00cc88',8,'#00e676',12,'#88ffaa',20,'#ffffff'],
          'line-opacity':['interpolate',['linear'],['get','freq'],1,0.5,2,0.65,4,0.8,8,0.92,15,1.0],
          'line-width':['*',zs,['interpolate',['linear'],['get','freq'],1,1.2,2,2.0,3,3.0,5,4.8,8,7.0,12,10.0,20,14.0]]
        }
      });

      // Auf alle Routen fitten
      var allC=[];
      features.forEach(function(f){ allC=allC.concat(f.geometry.coordinates); });
      if(allC.length){
        var lngs=allC.map(function(c){return c[0];}), lats=allC.map(function(c){return c[1];});
        try{ routeMap.fitBounds([[Math.min.apply(null,lngs),Math.min.apply(null,lats)],[Math.max.apply(null,lngs),Math.max.apply(null,lats)]],{padding:32,duration:1000,maxZoom:13}); }catch(e){}
      }

      if(stEl) stEl.textContent=features.length+' Routen · '+userSet.size+' Fahrer';
      lfEl.style.width='100%';
      setTimeout(function(){ loadEl.style.display='none'; }, 400);
    }

    if(routeMap.loaded()) addLayers(); else routeMap.on('load', addLayers);

  }catch(err){
    console.error('d2 community map error:', err);
    ltEl.textContent='Fehler: '+err.message;
  }
}

// Intersection Observer — Karte erst init wenn sichtbar
(function(){
  function scanContainers(){
    document.querySelectorAll('.d2-community-map-container').forEach(function(el){
      obs.observe(el);
    });
  }
  var obs=new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting) d2InitCommunityMap(e.target); });
  },{threshold:0.05});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', scanContainers);
  else scanContainers();
  new MutationObserver(scanContainers).observe(document.documentElement,{childList:true,subtree:true});
})();

window.d2InitCommunityMap = d2InitCommunityMap;

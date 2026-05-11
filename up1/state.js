
// ══════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════
const DEFAULT_KEY = '0h9bkxDZifPxKncVxFXv';
let map, elevChart;
let apiKey = localStorage.getItem('custom_maptiler_key') || DEFAULT_KEY;
let limitReachedShown = false;
let waypoints = []; 
let segments = [];
let fullRoute = { coords:[], elevs:[], dist:0, up:0, dn:0, maxGrade:0 };
let warnings = [];
let terrainOn = true, meshOn = false, satelliteOn = false, mapHidden = false, kmMarkersOn = false, meteoPaused = false;
let mapLayerIds = [];
let currentSpeedKmh = 15;
let activeProfile = 'casual';
let prefForest = false;
// 0 = collapsed (peek), 1 = expanded (mid), 2 = maximized (full)
let sheetState    = 0;
let sheetExpanded = false; // true when state >= 1 (backwards compat)
let sheetStartY = 0;
let sheetDragging = false;
window.wpDistKm = [];

// Waypoint View Toggle
let globalWpVisible = true;
let wpMarkers       = [];   // HTML pin markers for waypoints
let osmPinMarkers   = [];   // HTML pin markers for OSM route start points

// Drag & Drop / Freehand state
let dragWpId = null;
let isDraggingWp = false;
let longPressTimer = null;
let isLongPress = false;
let drawModeIdx = -1;
let drawCoords = [];
let searchPin = null;

const PROFILES = {
  casual:{ osrm:'cycling', speed:15 },
  mtb:   { osrm:'foot',    speed:16 },
  road:  { osrm:'cycling', speed:28 }
};

// ══════════════════════════════════════════════════
// ELEVATION CACHE
// ══════════════════════════════════════════════════
const ELC = (() => {
  try { return JSON.parse(localStorage.getItem('vn_el_c') || '{}'); } catch(e) { return {}; }
})();
let elcDirty = false;

function elKey(lat, lng){ return `${lat.toFixed(3)},${lng.toFixed(3)}`; }

function persistElCache(){
  if(!elcDirty) return;
  try {
    const keys = Object.keys(ELC);
    if(keys.length > 3000) keys.slice(0, keys.length-3000).forEach(k => delete ELC[k]);
    localStorage.setItem('vn_el_c', JSON.stringify(ELC));
    elcDirty = false;
  } catch(e){}
}
setInterval(persistElCache, 8000);
window.addEventListener('beforeunload', persistElCache);

async function fetchElevations(coords){
  if(meteoPaused) {
      // Return 0s or cached values to avoid API block
      return smoothElev(coords.map(c => ELC[elKey(c[1],c[0])] || 0), 5);
  }

  const maxSamples = 90;
  const step = Math.max(1, Math.floor(coords.length / maxSamples));
  const sidx = [];
  for(let i=0;i<coords.length;i+=step) sidx.push(i);
  if(sidx[sidx.length-1]!==coords.length-1) sidx.push(coords.length-1);
  const sampled = sidx.map(i=>coords[i]);

  const edata = new Array(sampled.length).fill(null);
  const toFetch = [];

  sampled.forEach((c,si)=>{
    const k = elKey(c[1],c[0]);
    if(ELC[k]!==undefined){ edata[si]=ELC[k]; }
    else toFetch.push({si,c,k});
  });

  for(let ci=0;ci<toFetch.length;ci+=100){
    if(ci>0) await sleep(280);
    const chunk = toFetch.slice(ci,ci+100);
    try {
      const lats = chunk.map(u=>u.c[1].toFixed(6)).join(',');
      const lngs = chunk.map(u=>u.c[0].toFixed(6)).join(',');
      const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if(!d.elevation) throw new Error('no data');
      chunk.forEach((u,k)=>{
        const e = d.elevation[k] ?? 0;
        ELC[u.k] = e; edata[u.si] = e; elcDirty = true;
      });
    } catch(err){
      chunk.forEach(u=>{ if(edata[u.si]===null) edata[u.si]=0; });
    }
  }

  const filled = edata.map(v=>v??0);
  const out = [];
  for(let i=0;i<coords.length;i++){
    let lo=0, hi=sidx.length-1;
    for(let j=0;j<sidx.length-1;j++){
      if(sidx[j]<=i && sidx[j+1]>=i){ lo=j; hi=j+1; break; }
    }
    const span = sidx[hi]-sidx[lo];
    const t = span===0 ? 0 : (i-sidx[lo])/span;
    out.push(filled[lo]*(1-t)+filled[hi]*t);
  }
  return smoothElev(out, 5);
}

// ══════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function haversineM(a,b){
  const R=6371000, dLat=(b[1]-a[1])*Math.PI/180, dLng=(b[0]-a[0])*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.cos(a[1]*Math.PI/180)*Math.cos(b[1]*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function smoothElev(arr, w=5){
  return arr.map((_,i)=>{
    const a=arr.slice(Math.max(0,i-w),i+w+1);
    return a.reduce((s,v)=>s+v,0)/a.length;
  });
}

function lerpColor(c1,c2,t){
  return `rgb(${Math.round(c1[0]+(c2[0]-c1[0])*t)},${Math.round(c1[1]+(c2[1]-c1[1])*t)},${Math.round(c1[2]+(c2[2]-c1[2])*t)})`;
}

function gradeColor(g){
  g=Math.max(-20,Math.min(20,g));
  const stops=[[-15,[123,31,162]],[-5,[25,118,210]],[0,[0,212,255]],[5,[192,202,51]],[10,[245,124,0]],[15,[229,57,53]],[20,[183,28,28]]];
  for(let i=0;i<stops.length-1;i++){
    if(g<=stops[i+1][0]){
      const t=(g-stops[i][0])/(stops[i+1][0]-stops[i][0]);
      return lerpColor(stops[i][1],stops[i+1][1],t);
    }
  }
  return `rgb(183,28,28)`;
}

function fmtDist(m){ return m>=1000?`${(m/1000).toFixed(1)} km`:`${Math.round(m)} m`; }
function fmtTime(sec){
  if(!sec||sec<0) return '—';
  const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60);
  return h>0?`${h}h ${m<10?'0':''}${m}m`:`${m} min`;
}

function calcCalories(distM, upM, weightKg, speedKmh){
  if(distM<50) return 0;
  const met = speedKmh<16?5.8:speedKmh<22?8.5:speedKmh<28?11:14;
  const h = (distM/1000)/speedKmh;
  const base = met*weightKg*h;
  const climb = upM*weightKg*9.81/4186/0.25;
  return Math.round(base+climb);
}

function emptyFC(){ return {type:'FeatureCollection',features:[]}; }
function showToast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }
function showLoad(msg){ document.getElementById('load-txt').textContent=msg||'Lädt…'; document.getElementById('loading').style.display='flex'; }
function hideLoad(){ document.getElementById('loading').style.display='none'; }

// ══════════════════════════════════════════════════
// SEARCH
// ══════════════════════════════════════════════════
let srchTimer = null;
document.getElementById('srch-inp').addEventListener('input', e => {
  const v = e.target.value.trim();
  document.getElementById('srch-clear').style.display = v?'block':'none';
  clearTimeout(srchTimer);
  if(v.length < 2){ hideDrop(); return; }
  srchTimer = setTimeout(() => doSearch(v), 420);
});
document.getElementById('srch-inp').addEventListener('keydown', e => { if(e.key==='Escape') clearSearch(); });

async function doSearch(q){
  try {
    const mapCenter = map ? `&viewbox=${map.getCenter().lng-1},${map.getCenter().lat+1},${map.getCenter().lng+1},${map.getCenter().lat-1}&bounded=0` : '';
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&accept-language=de&addressdetails=1${mapCenter}`);
    const data = await res.json();
    showDrop(data);
  } catch(e){ hideDrop(); }
}

function showDrop(results){
  const drop = document.getElementById('srch-drop');
  if(!results.length){ drop.innerHTML='<div class="sr-item" style="color:var(--muted)"><span class="sr-pin">🔍</span><div><div class="sr-name">Keine Ergebnisse</div></div></div>'; drop.style.display='block'; return; }
  drop.innerHTML = results.map(r => {
    const name = r.display_name.split(',')[0];
    const sub  = r.display_name.split(',').slice(1,3).join(',').trim();
    const icon = r.type==='street'||r.type==='road'?'🛣️':r.class==='place'?'📍':r.class==='natural'?'🌳':'📌';
    return `<div class="sr-item" onclick="selectResult(${r.lat},${r.lon}, '${name.replace(/'/g,"\\'")}')">
      <span class="sr-pin">${icon}</span>
      <div style="min-width:0"><div class="sr-name">${name}</div><div class="sr-sub">${sub}</div></div>
    </div>`;
  }).join('');
  drop.style.display='block';
}

function hideDrop(){ document.getElementById('srch-drop').style.display='none'; }

function clearSearch(){
  document.getElementById('srch-inp').value='';
  document.getElementById('srch-clear').style.display='none';
  hideDrop();
}

window.addWpFromSearch = function(lng, lat) {
    addWaypoint(lng, lat);
    clearSearchPin();
};

window.clearSearchPin = function() {
    if(searchPin) { searchPin.remove(); searchPin = null; }
};

function selectResult(lat, lng, name){
  clearSearch();
  lat=parseFloat(lat); lng=parseFloat(lng);
  map.flyTo({center:[lng,lat],zoom:14,speed:1.8});
  
  if(searchPin) searchPin.remove();
  searchPin = new maplibregl.Marker({color: '#ff3d6b'}).setLngLat([lng, lat]).addTo(map);
  
  const popup = new maplibregl.Popup({closeButton:false, offset:30, anchor:'bottom'})
    .setHTML(`
      <div style="font-family:var(--font);text-align:center;padding:5px;">
        <div style="margin-bottom:8px;font-size:14px;font-weight:600">${name}</div>
        <button class="btn ok" style="width:100%;margin-bottom:5px;justify-content:center" onclick="addWpFromSearch(${lng},${lat})">📍 Als Wegpunkt setzen</button>
        <button class="btn danger" style="width:100%;justify-content:center" onclick="clearSearchPin()">✕ Verwerfen</button>
      </div>
    `);
  searchPin.setPopup(popup).togglePopup();
}

// ══════════════════════════════════════════════════
// MAP INIT
// ══════════════════════════════════════════════════
function launch(key){
  apiKey = key;
  document.getElementById('api-overlay').style.display='none';
  initMap();
  renderSavesList();
  renderBrouterProfileBtns();
  checkURLHash();
}

function handleLimitReached(){
  if(limitReachedShown) return;
  limitReachedShown = true;
  // Switch to fallback style (demo mode visually)
  if(map) {
    try { map.setStyle(buildFallbackStyle()); } catch(e){}
  }
  document.getElementById('limit-overlay').classList.add('show');
}

function dismissLimitModal(){
  document.getElementById('limit-overlay').classList.remove('show');
  showToast('Demo-Modus aktiv · 3D & Satellit deaktiviert');
}

function applyCustomKey(){
  const key = document.getElementById('limit-key-inp').value.trim();
  if(!key){ showToast('Bitte einen gültigen Key eingeben'); return; }
  localStorage.setItem('custom_maptiler_key', key);
  document.getElementById('limit-overlay').classList.remove('show');
  location.reload();
}

function buildFallbackStyle(){
  return {
    version:8,
    glyphs:'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources:{
      osm:{type:'raster',tiles:['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'],tileSize:256,attribution:'© OpenStreetMap, © Carto'}
    },
    layers:[{id:'osm-bg',type:'raster',source:'osm',paint:{'raster-opacity':1}}]
  };
}

class ResetCtrl{
  onAdd(map){ this._m=map; this._c=document.createElement('div'); this._c.className='maplibregl-ctrl maplibregl-ctrl-group'; const b=document.createElement('button'); b.type='button'; b.title='Reset Ansicht'; b.innerHTML='<span style="font-size:15px;font-weight:700;color:var(--text)">⌂</span>'; b.onclick=()=>map.flyTo({pitch:55,bearing:-10,zoom:13}); this._c.appendChild(b); return this._c; }
  onRemove(){ this._c.parentNode.removeChild(this._c); this._m=undefined; }
}

function initMap(){
  // Mehr parallele Tile-Requests → schnelleres Laden beim Zoomen/Drehen
  if(maplibregl.config) maplibregl.config.MAX_PARALLEL_IMAGE_REQUESTS = 32;

  const style = apiKey ? `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${apiKey}` : buildFallbackStyle();
  map = new maplibregl.Map({
    container:'map', style,
    center:[8.856553,48.247994], zoom:13,
    pitch:55, bearing:-10, maxPitch:85, antialias:true,
    touchPitch: true, touchZoomRotate: true, dragRotate: true,
    // Großer In-Memory-Tile-Cache: verhindert Re-Upload nach kurzen Zoom-Bewegungen
    maxTileCacheSize: 1200,
    // Symbole (Labels) sofort rendern – weniger Pop-in beim Zoom
    fadeDuration: 150
  });
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-left');
  map.addControl(new ResetCtrl(),'top-left');
  map.addControl(new maplibregl.FullscreenControl(),'top-left');
  map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
  
  map.once('style.load', onStyleLoad);
  
  // Detect API limit (402) or invalid key (403) from tile errors
  map.on('error', (e) => {
    const status = e?.error?.status || e?.error?.statusCode || (e?.error?.message||'').match(/\b(402|403)\b/)?.[0];
    if(status == 402 || status == 403) handleLimitReached();
  });
  
  // Update Mesh on Move if enabled
  map.on('moveend', () => { if(meshOn) updateMesh(); });

  // ── Tile Prefetcher ──────────────────────────────────────────────────
  // Nach jeder Bewegung / Zoom-Änderung werden Sat-Tiles der Zoom-Level
  // ±1 im Hintergrund per fetch() in den Browser-HTTP-Cache geladen.
  // MapLibre greift dann beim nächsten Zoom auf gecachte Ressourcen zurück
  // → kein Nachladen, kein Flackern.
  let _prefetchTimer = null;
  function schedulePrefetch(){
    clearTimeout(_prefetchTimer);
    _prefetchTimer = setTimeout(prefetchSatTiles, 600);
  }
  map.on('moveend', schedulePrefetch);
  map.on('zoomend', schedulePrefetch);

  // Record user touch time — used to decide whether to follow GPS or let user explore
  map.getCanvas().addEventListener('touchstart', () => {
    if(naviActive) naviUserLastTouch = Date.now();
  }, {passive: true});
  map.getCanvas().addEventListener('mousedown', () => {
    if(naviActive) naviUserLastTouch = Date.now();
  }, {passive: true});

  setupMapEvents();
  updateMobBtns();
}

// ══════════════════════════════════════════════════
// MAP EVENTS & LOGIC
// ══════════════════════════════════════════════════

// ── Helper: ring FX at screen coords ──
function spawnRingFX(cx, cy, color){
  const ring = document.createElement('div');
  ring.className = 'wp-ring-fx';
  ring.style.cssText = `left:${cx}px;top:${cy}px;border-color:${color||'var(--accent)'};`;
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 700);
}

// ── Hold-to-place state ──
let mapHoldTimer   = null;
let mapHoldActive  = false;
let mapHoldStartPt = null;
let mapHoldMoved   = false;
let mapHoldRafId   = null;
const MAP_HOLD_MS  = 380;

function startMapHold(clientX, clientY){
  if(naviActive || drawModeIdx >= 0) return;
  mapHoldActive  = false;
  mapHoldMoved   = false;
  mapHoldStartPt = {x: clientX, y: clientY};

  // Show ghost pin at cursor position
  const ghost = document.getElementById('wp-ghost-pin');
  const nextColor = waypoints.length === 0 ? '#00e676' : '#ff3d6b';
  ghost.innerHTML = makePinSVG(nextColor, waypoints.length + 1, 30);
  ghost.style.left = clientX + 'px';
  ghost.style.top  = clientY + 'px';
  ghost.classList.add('visible');

  // Animate hold ring
  const ring    = document.getElementById('wp-hold-ring');
  const prog    = document.getElementById('wp-hold-prog');
  ring.style.display = 'block';
  ring.style.left    = clientX + 'px';
  ring.style.top     = clientY + 'px';
  prog.style.strokeDashoffset = '138.2';
  prog.style.stroke  = nextColor;

  const start = performance.now();
  function animRing(ts){
    const elapsed = ts - start;
    const t = Math.min(elapsed / MAP_HOLD_MS, 1);
    prog.style.strokeDashoffset = (138.2 * (1 - t)).toFixed(2);
    if(t < 1) mapHoldRafId = requestAnimationFrame(animRing);
  }
  mapHoldRafId = requestAnimationFrame(animRing);

  mapHoldTimer = setTimeout(() => {
    mapHoldActive = true;
    cancelAnimationFrame(mapHoldRafId);
    ring.style.display = 'none';
    ghost.classList.remove('visible');

    const rect = map.getCanvas().getBoundingClientRect();
    const lngLat = map.unproject([clientX - rect.left, clientY - rect.top]);
    addWaypointWithFX(lngLat.lng, lngLat.lat, clientX, clientY);
  }, MAP_HOLD_MS);
}

function cancelMapHold(){
  clearTimeout(mapHoldTimer);
  cancelAnimationFrame(mapHoldRafId);
  document.getElementById('wp-ghost-pin').classList.remove('visible');
  document.getElementById('wp-hold-ring').style.display = 'none';
  mapHoldActive = false;
}

function addWaypointWithFX(lng, lat, cx, cy){
  const color = waypoints.length === 0 ? '#00e676' : '#ffd600';
  spawnRingFX(cx, cy, color);
  addWaypoint(lng, lat);
}

function setupMapEvents() {
  // ── Mouse: hold-to-place on empty map ──────────────────
  map.getCanvas().addEventListener('mousedown', (e) => {
    if(naviActive) return;
    // Only handle direct canvas clicks (not on existing pins)
    if(e.target !== map.getCanvas()) return;
    const bbox = [[e.offsetX-10, e.offsetY-10],[e.offsetX+10, e.offsetY+10]];
    const onPin = map.queryRenderedFeatures(bbox, {layers:['vn-wps']}).length > 0;
    const onRoute = map.queryRenderedFeatures(bbox, {layers:['route-segs-hit']}).length > 0;
    if(onPin || onRoute) return;
    startMapHold(e.clientX, e.clientY);
  }, {passive:true});

  map.getCanvas().addEventListener('mousemove', (e) => {
    if(mapHoldTimer && mapHoldStartPt){
      const dx = e.clientX - mapHoldStartPt.x;
      const dy = e.clientY - mapHoldStartPt.y;
      if(Math.sqrt(dx*dx+dy*dy) > 8){ cancelMapHold(); }
    }
    // Update ghost pin position
    const ghost = document.getElementById('wp-ghost-pin');
    if(ghost.classList.contains('visible')){
      ghost.style.left = e.clientX + 'px';
      ghost.style.top  = e.clientY + 'px';
      document.getElementById('wp-hold-ring').style.left = e.clientX + 'px';
      document.getElementById('wp-hold-ring').style.top  = e.clientY + 'px';
    }
  });

  map.getCanvas().addEventListener('mouseup', () => { /* handled on window below */ });

  // Cancel hold-to-place when mouse is released anywhere (even outside the canvas)
  window.addEventListener('mouseup', () => {
    if(mapHoldTimer || mapHoldRafId) cancelMapHold();
  });

  // ── Mouse: drag existing pin on vn-wps layer (desktop fallback for GeoJSON hit) ──
  map.on('mousedown', 'vn-wps', (e) => {
      e.preventDefault();
      cancelMapHold(); // cancel place-hold if clicked on existing pin
      // Pin drag is now handled by the HTML marker element listeners in renderWpMarkers
  });

  // ── Mouse drag of waypoint (driven by renderWpMarkers el mousedown → isDraggingWp) ──
  map.on('mousemove', (e) => {
      if(!map.getStyle()) return;
      
      if (isDraggingWp && dragWpId !== null) {
          clearTimeout(longPressTimer); 
          map.getCanvas().style.cursor = 'grabbing';
          waypoints[dragWpId].lng = e.lngLat.lng;
          waypoints[dragWpId].lat = e.lngLat.lat;
          // Only move the marker, do NOT call renderWpMarkers (that recreates all pins)
          const m = wpMarkers.find(mk => mk._wpIdx === dragWpId);
          if(m) m.setLngLat([e.lngLat.lng, e.lngLat.lat]);
      } 
      else if (drawModeIdx >= 0 && e.originalEvent.buttons === 1) {
          drawCoords.push([e.lngLat.lng, e.lngLat.lat]);
          map.getSource('vn-draw').setData({type:'Feature', geometry:{type:'LineString', coordinates:drawCoords}});
      }

      if(map.getLayer('route-segs-hit') && map.queryRenderedFeatures(e.point, {layers:['route-segs-hit']}).length) {
          if(!isDraggingWp) map.getCanvas().style.cursor='move';
      } else if (!isDraggingWp && drawModeIdx < 0) {
          map.getCanvas().style.cursor='crosshair';
          document.getElementById('rt-tip').style.display='none';
      }
  });

  map.on('mouseup', (e) => {
      clearTimeout(longPressTimer);

      if (isDraggingWp && dragWpId !== null) {
          isDraggingWp = false;
          map.getCanvas().style.cursor = '';
          // Skip rerouteAll here when the HTML pin element already handled it (_activePinDrag).
          // _activePinDrag is set in startPinDrag() and cleared in endPinDrag().
          if (!isLongPress && !_activePinDrag) rerouteAll();
          if (!_activePinDrag) dragWpId = null; // endPinDrag handles cleanup for pin drags
      }

      if (drawModeIdx >= 0 && drawCoords.length > 1) {
          const end = drawCoords[drawCoords.length-1];
          const newIdx = drawModeIdx + 1;
          waypoints.splice(newIdx, 0, {lng: end[0], lat: end[1], label: `P${newIdx+1}`, manualLine: true, customCoords: drawCoords, hidden: false});
          
          drawModeIdx = -1;
          drawCoords = [];
          if(map.getSource('vn-draw')) map.getSource('vn-draw').setData(emptyFC());
          map.dragPan.enable(); map.dragRotate.enable(); map.touchZoomRotate.enable(); map.touchPitch.enable(); map.scrollZoom.enable();  document.body.style.overscrollBehavior = ''; document.documentElement.style.overscrollBehavior = '';
          
          renderWpMarkers();
          renderWpList();
          rerouteAll();
          showToast("✓ Freihand-Route erstellt");
      }
  });

  // ── Click: only used for route-segment insert and warning popups ──
  map.on('click', (e) => {
      if(naviActive) return;
      if(suppressClick){ suppressClick = false; return; }
      if(hadMultiTouch) return;
      if(isDraggingWp || isLongPress || drawModeIdx >= 0) return;
      if(!map.getStyle() || !map.getLayer('vn-wps') || !map.getLayer('vn-warn')) return;

      const hitRadius = window.innerWidth <= 860 ? 20 : 8;
      const bbox = [[e.point.x-hitRadius, e.point.y-hitRadius],[e.point.x+hitRadius, e.point.y+hitRadius]];
      const fs = map.queryRenderedFeatures(bbox, {layers:['vn-warn']});

      if(fs.length){
          new maplibregl.Popup({closeButton:false,anchor:'bottom',offset:10})
              .setLngLat(fs[0].geometry.coordinates)
              .setHTML(`<div style="padding:6px;font-family:var(--font);font-size:12px;color:var(--text);font-weight:600">${fs[0].properties.msg}</div>`).addTo(map);
      }
      // Note: waypoints are now placed via hold-to-place, not on click
  });

  // Route segment: hold-to-insert (mouse) — same hold duration as placing new pins
  map.on('mousedown', 'route-segs-hit', (e) => {
    if (dragWpId !== null || drawModeIdx >= 0) return;
    e.preventDefault();
    cancelMapHold();

    let minDist = Infinity, insertIdx = 1;
    segments.forEach((seg, i) => {
      seg.coords.forEach(c => {
        const d = haversineM([e.lngLat.lng, e.lngLat.lat], c);
        if(d < minDist){ minDist = d; insertIdx = i + 1; }
      });
    });
    const insertLng = e.lngLat.lng, insertLat = e.lngLat.lat;
    const cx = e.originalEvent.clientX, cy = e.originalEvent.clientY;

    const ghost = document.getElementById('wp-ghost-pin');
    ghost.innerHTML = makePinSVG('#ffd600', insertIdx + 1, 30);
    ghost.style.left = cx + 'px'; ghost.style.top = cy + 'px';
    ghost.classList.add('visible');
    const ring = document.getElementById('wp-hold-ring');
    const prog = document.getElementById('wp-hold-prog');
    ring.style.left = cx + 'px'; ring.style.top = cy + 'px';
    ring.style.display = 'block';
    prog.style.strokeDashoffset = '138.2';
    prog.style.stroke = '#ffd600';

    let segHoldFired = false, segRafId = null;
    const start = performance.now();
    function animSegMouse(ts){
      const frac = Math.min((ts - start) / MAP_HOLD_MS, 1);
      prog.style.strokeDashoffset = (138.2 * (1 - frac)).toFixed(2);
      if(frac < 1) segRafId = requestAnimationFrame(animSegMouse);
    }
    segRafId = requestAnimationFrame(animSegMouse);

    const segTimer = setTimeout(() => {
      segHoldFired = true;
      cancelAnimationFrame(segRafId);
      ring.style.display = 'none'; ghost.classList.remove('visible');
      spawnRingFX(cx, cy, '#ffd600');
      waypoints.splice(insertIdx, 0, {lng:insertLng, lat:insertLat, label:`P${insertIdx+1}`, hidden:false, manualLine:false, customCoords:null});
      dragWpId = insertIdx; isDraggingWp = true;
      map.getCanvas().style.cursor = 'grab';
      renderWpMarkers(); renderWpList();
    }, MAP_HOLD_MS);

    const onSegUp = () => {
      if(!segHoldFired){
        clearTimeout(segTimer); cancelAnimationFrame(segRafId);
        ring.style.display = 'none'; ghost.classList.remove('visible');
      }
      window.removeEventListener('mouseup', onSegUp);
      window.removeEventListener('mousemove', onSegMove);
    };

    // Desktop: Mausbewegung > 8px bricht den Hold ab (wie Touchmove auf Mobile)
    const onSegMove = (me) => {
      if(segHoldFired){ window.removeEventListener('mousemove', onSegMove); return; }
      const dx = me.clientX - cx, dy = me.clientY - cy;
      if(Math.sqrt(dx*dx+dy*dy) > 8){
        clearTimeout(segTimer); cancelAnimationFrame(segRafId);
        ring.style.display = 'none'; ghost.classList.remove('visible');
        window.removeEventListener('mousemove', onSegMove);
        window.removeEventListener('mouseup', onSegUp);
      }
    };

    window.addEventListener('mouseup', onSegUp);
    window.addEventListener('mousemove', onSegMove);
  });

  map.on('mousemove','route-segs-hit', e=>{
    if(isDraggingWp || !map.getLayer('route-segs-hit')) return;
    const fs = map.queryRenderedFeatures(e.point, {layers:['route-segs']});
    if(!fs.length) return;
    const p = fs[0].properties;
    const g=+p.grade, el=+p.elev;
    document.getElementById('rt-tip').innerHTML=`<span style="color:${gradeColor(g)}">▲ ${g.toFixed(1)}%</span>${el?` <span style="color:var(--dim)"> · ${Math.round(el)} m</span>`:''}`;
    const pt=map.project(e.lngLat);
    const tt=document.getElementById('rt-tip');
    tt.style.display='block';
    tt.style.left=(pt.x+14)+'px'; tt.style.top=(pt.y-14)+'px';
  });

  // ── TOUCH EVENTS (mobile) ──────────────────────────
  // Touch on empty map: hold-to-place
  let mapTouchHoldTimer = null;
  let mapTouchHoldStart = null;
  let mapTouchMoved     = false;

  map.getCanvas().addEventListener('touchstart', (e) => {
    if(naviActive || e.touches.length > 1) return;
    const t = e.touches[0];
    // Check if touching an existing pin (HTML markers are above canvas, so this mainly catches empty space)
    mapTouchMoved = false;
    mapTouchHoldStart = {x: t.clientX, y: t.clientY};

    const rect = map.getCanvas().getBoundingClientRect();
    const pt = {x: t.clientX - rect.left, y: t.clientY - rect.top};
    const onPin = map.queryRenderedFeatures([
      [pt.x-18, pt.y-18], [pt.x+18, pt.y+18]
    ], {layers:['vn-wps']}).length > 0;
    const onRoute = map.queryRenderedFeatures([
      [pt.x-18, pt.y-18], [pt.x+18, pt.y+18]
    ], {layers:['route-segs-hit']}).length > 0;
    if(onPin || onRoute || drawModeIdx >= 0) return;

    // Show ghost pin
    const ghost = document.getElementById('wp-ghost-pin');
    const nextColor = waypoints.length === 0 ? '#00e676' : '#ff3d6b';
    ghost.innerHTML = makePinSVG(nextColor, waypoints.length + 1, 30);
    ghost.style.left = t.clientX + 'px';
    ghost.style.top  = t.clientY + 'px';
    ghost.classList.add('visible');

    const ring    = document.getElementById('wp-hold-ring');
    const prog    = document.getElementById('wp-hold-prog');
    ring.style.display = 'block';
    ring.style.left = t.clientX + 'px';
    ring.style.top  = t.clientY + 'px';
    prog.style.strokeDashoffset = '138.2';
    prog.style.stroke = nextColor;

    const start = performance.now();
    function animRingT(ts){
      const elapsed = ts - start;
      const frac = Math.min(elapsed / MAP_HOLD_MS, 1);
      prog.style.strokeDashoffset = (138.2 * (1 - frac)).toFixed(2);
      if(frac < 1) mapHoldRafId = requestAnimationFrame(animRingT);
    }
    mapHoldRafId = requestAnimationFrame(animRingT);

    mapTouchHoldTimer = setTimeout(() => {
      cancelAnimationFrame(mapHoldRafId);
      ring.style.display = 'none';
      ghost.classList.remove('visible');
      if(mapTouchMoved) return;
      const lngLat = map.unproject([pt.x, pt.y]);
      addWaypointWithFX(lngLat.lng, lngLat.lat, t.clientX, t.clientY);
      suppressClick = true;
    }, MAP_HOLD_MS);
  }, {passive:true});

  map.getCanvas().addEventListener('touchmove', (e) => {
    if(e.touches.length > 1) return;
    const t = e.touches[0];
    if(mapTouchHoldStart){
      const dx = t.clientX - mapTouchHoldStart.x;
      const dy = t.clientY - mapTouchHoldStart.y;
      if(Math.sqrt(dx*dx+dy*dy) > 10){
        mapTouchMoved = true;
        clearTimeout(mapTouchHoldTimer);
        cancelAnimationFrame(mapHoldRafId);
        // Also cancel segment hold on move
        if(!segTouchHoldFired){
          clearTimeout(segTouchHoldTimer);
          cancelAnimationFrame(segTouchRafId);
        }
        document.getElementById('wp-ghost-pin').classList.remove('visible');
        document.getElementById('wp-hold-ring').style.display = 'none';
      }
    }
  }, {passive:true});

  map.getCanvas().addEventListener('touchend', () => {
    clearTimeout(mapTouchHoldTimer);
    cancelAnimationFrame(mapHoldRafId);
    // Also cancel route-segment hold if it hasn't fired yet
    if(!segTouchHoldFired){
      clearTimeout(segTouchHoldTimer);
      cancelAnimationFrame(segTouchRafId);
    }
    document.getElementById('wp-ghost-pin').classList.remove('visible');
    document.getElementById('wp-hold-ring').style.display = 'none';
    mapTouchHoldStart = null;
  }, {passive:true});

  // Touch on waypoint: handled via HTML marker listeners in renderWpMarkers
  // (kept as no-op to avoid double-handling)
  map.on('touchstart', 'vn-wps', (e) => {
    if(naviActive) return;
    // HTML marker handles it; just prevent map from adding a waypoint
    suppressClick = true;
  });

  // Touch on route segment: hold-to-insert — same hold duration as placing new pins
  let segTouchHoldTimer = null, segTouchRafId = null, segTouchHoldFired = false;

  map.on('touchstart', 'route-segs-hit', (e) => {
    if(naviActive || dragWpId !== null || drawModeIdx >= 0) return;
    if(e.originalEvent.touches.length > 1) return;
    // Also cancel any map-hold that started simultaneously (canvas touchstart fires too)
    cancelMapHold();

    let minDist = Infinity, insertIdx = 1;
    segments.forEach((seg, i) => {
      seg.coords.forEach(c => {
        const d = haversineM([e.lngLat.lng, e.lngLat.lat], c);
        if(d < minDist){ minDist = d; insertIdx = i + 1; }
      });
    });
    const insertLng = e.lngLat.lng, insertLat = e.lngLat.lat;
    const t0 = e.originalEvent.touches[0];
    const cx = t0.clientX, cy = t0.clientY;

    segTouchHoldFired = false;
    const ghost = document.getElementById('wp-ghost-pin');
    ghost.innerHTML = makePinSVG('#ffd600', insertIdx + 1, 30);
    ghost.style.left = cx + 'px'; ghost.style.top = cy + 'px';
    ghost.classList.add('visible');
    const ring = document.getElementById('wp-hold-ring');
    const prog = document.getElementById('wp-hold-prog');
    ring.style.left = cx + 'px'; ring.style.top = cy + 'px';
    ring.style.display = 'block';
    prog.style.strokeDashoffset = '138.2';
    prog.style.stroke = '#ffd600';

    const start = performance.now();
    function animSegTouch(ts){
      const frac = Math.min((ts - start) / MAP_HOLD_MS, 1);
      prog.style.strokeDashoffset = (138.2 * (1 - frac)).toFixed(2);
      if(frac < 1) segTouchRafId = requestAnimationFrame(animSegTouch);
    }
    segTouchRafId = requestAnimationFrame(animSegTouch);

    segTouchHoldTimer = setTimeout(() => {
      segTouchHoldFired = true;
      cancelAnimationFrame(segTouchRafId);
      ring.style.display = 'none'; ghost.classList.remove('visible');
      spawnRingFX(cx, cy, '#ffd600');
      waypoints.splice(insertIdx, 0, {lng:insertLng, lat:insertLat, label:`P${insertIdx+1}`, hidden:false, manualLine:false, customCoords:null});
      dragWpId = insertIdx; isDraggingWp = false; isLongPress = false;
      renderWpMarkers(); renderWpList();
    }, MAP_HOLD_MS);
  });

  // Global touchmove: handle waypoint drag (driven by HTML marker, update GeoJSON)
  map.on('touchmove', (e) => {
    if(naviActive) return;
    if(isDraggingWp && dragWpId !== null && !isLongPress){
      clearTimeout(longPressTimer);
      const lngLat = map.unproject(e.point);
      waypoints[dragWpId].lng = lngLat.lng;
      waypoints[dragWpId].lat = lngLat.lat;
      const m = wpMarkers.find(mk => mk._wpIdx === dragWpId);
      if(m) m.setLngLat([lngLat.lng, lngLat.lat]);
    } else if(drawModeIdx >= 0 && e.originalEvent.touches.length === 1){
      const lngLat = map.unproject(e.point);
      drawCoords.push([lngLat.lng, lngLat.lat]);
      if(map.getSource('vn-draw')) map.getSource('vn-draw').setData({type:'Feature',geometry:{type:'LineString',coordinates:drawCoords}});
    }
  });

  map.getCanvas().addEventListener('touchmove', (e) => {
    if(drawModeIdx >= 0) {
      e.preventDefault();
      return;
    }
    if(isDraggingWp) e.preventDefault();
  }, {passive: false});

  document.addEventListener('touchmove', (e) => {
    if(drawModeIdx >= 0) e.preventDefault();
  }, {passive: false});

  let activeTouchCount = 0;
  let hadMultiTouch = false;
  map.getCanvas().addEventListener('touchstart', e => {
    activeTouchCount = e.touches.length;
    if(e.touches.length > 1){
      hadMultiTouch = true;
      // Cancel any in-progress hold so no pin fires after pinch
      clearTimeout(mapTouchHoldTimer);
      clearTimeout(segTouchHoldTimer);
      cancelAnimationFrame(mapHoldRafId);
      cancelAnimationFrame(segTouchRafId);
      document.getElementById('wp-ghost-pin').classList.remove('visible');
      document.getElementById('wp-hold-ring').style.display = 'none';
      mapTouchHoldStart = null;
    }
  }, {passive:true});
  map.getCanvas().addEventListener('touchend', e => {
    activeTouchCount = e.touches.length;
    if(e.touches.length === 0) setTimeout(() => { hadMultiTouch = false; }, 400);
  }, {passive:true});

  map.on('touchend', () => {
    clearTimeout(longPressTimer);
    if(hadMultiTouch){ touchedWpIdx = null; touchedWpCoord = null; return; }

    if(isDraggingWp && dragWpId !== null){
      isDraggingWp = false;
      map.dragPan.enable(); map.dragRotate.enable(); map.touchZoomRotate.enable(); map.touchPitch.enable(); map.scrollZoom.enable();  document.body.style.overscrollBehavior = ''; document.documentElement.style.overscrollBehavior = '';
      if(!isLongPress) rerouteAll();
      dragWpId = null;
      suppressClick = true;
    }

    touchedWpIdx = null; touchedWpCoord = null;

    if(drawModeIdx >= 0 && drawCoords.length > 1){
      const end = drawCoords[drawCoords.length-1];
      const newIdx = drawModeIdx + 1;
      waypoints.splice(newIdx, 0, {lng:end[0],lat:end[1],label:`P${newIdx+1}`,manualLine:true,customCoords:drawCoords,hidden:false});
      drawModeIdx = -1; drawCoords = [];
      if(map.getSource('vn-draw')) map.getSource('vn-draw').setData(emptyFC());
      map.dragPan.enable(); map.dragRotate.enable(); map.touchZoomRotate.enable(); map.touchPitch.enable(); map.scrollZoom.enable();  document.body.style.overscrollBehavior = ''; document.documentElement.style.overscrollBehavior = '';
      renderWpMarkers(); renderWpList(); rerouteAll();
      showToast('✓ Freihand-Route erstellt');
      suppressClick = true;
    }
  });
}

window.startDraw = function(idx) {
    document.querySelector('.maplibregl-popup')?.remove();
    drawModeIdx = idx;
    drawCoords = [[waypoints[idx].lng, waypoints[idx].lat]];
    // Lock ALL map interactions while drawing
    map.dragPan.disable();
    map.dragRotate.disable();
    map.touchZoomRotate.disable();
    map.touchPitch.disable();
    map.scrollZoom.disable();
    // Block pull-to-refresh (overscroll) — don't set touch-action, MapLibre needs touch events
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    showToast("✏️ Mit Finger zeichnen · Karte gesperrt");
}

function onStyleLoad(){
  try {
    if(apiKey){
      if(!map.getSource('dem')) map.addSource('dem',{type:'raster-dem',url:`https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`,tileSize:256});
      map.setTerrain({source:'dem',exaggeration:1.5});
      document.getElementById('btn-3d').classList.add('active');
    }

    // MapLibre sky layer — Zustand aus skyOn-Variable wiederherstellen
    _applySky();

    // Set a neutral background for non-satellite mode
    const layers = map.getStyle().layers;
    if(layers){
      layers.forEach(l => {
        if(l.type === 'background'){
          map.setPaintProperty(l.id,'background-color','#e8e8e0');
          map.setPaintProperty(l.id,'background-opacity',1);
        }
      });
    }

    mapLayerIds=(map.getStyle().layers||[]).filter(l=>!l.id.startsWith('vn-')&&!l.id.startsWith('route-')).map(l=>l.id);
    addLayers();
    applyMapLayers();
    renderWpMarkers();
    rebuildRoute();

    // Activate satellite view by default
    if(!satelliteOn) toggleSat();
  } catch(e){ console.error('Style load error:',e); }
}

// ══════════════════════════════════════════════════
// MAP LAYERS & BOOSTS
// ══════════════════════════════════════════════════
let layerStyles = {};
let layerBoosts = { roads:false, cycle:false, paths:false };
let layerVis = { roads:false, cycle:false, paths:false };

function getLayerCats() {
  if(!map||!map.getStyle()) return {};
  const all = map.getStyle().layers;
  return {
    roads: all.filter(l => (l.id.includes('road') || l.id.includes('highway') || l.id.includes('motorway') || l.id.includes('street')) && !l.id.includes('path') && !l.id.includes('track') && !l.id.includes('cycle')),
    cycle: all.filter(l => l.id.includes('cycle') || l.id.includes('bicycle') || l.id.includes('bike')),
    paths: all.filter(l => l.id.includes('path') || l.id.includes('track') || l.id.includes('trail') || l.id.includes('footway') || l.id.includes('steps') || l.id.includes('pedestrian') || l.id.includes('dirt'))
  };
}

window.layerToggle = function(type, show) {
  layerVis[type] = show;
  applyMapLayers();
};

window.boostToggle = function(type, boost) {
  layerBoosts[type] = boost;
  applyMapLayers();
};

function applyMapLayers() {
  if(!map || !map.getStyle()) return;
  const cats = getLayerCats();
  for (let type in cats) {
    const show = layerVis[type];
    const boost = layerBoosts[type];
    cats[type].forEach(l => {
      if(map.getLayer(l.id)) map.setLayoutProperty(l.id, 'visibility', show ? (mapHidden?'none':'visible') : 'none');
      
      if (!layerStyles[l.id] && l.type === 'line') {
        layerStyles[l.id] = { width: map.getPaintProperty(l.id, 'line-width') || 1, color: map.getPaintProperty(l.id, 'line-color') || '#000' };
      }
      if (l.type === 'line') {
        if (show && boost) {
          map.setPaintProperty(l.id, 'line-width', ['*', 4, layerStyles[l.id].width]); 
          let c = type==='roads' ? '#ffffff' : type==='cycle' ? '#00ffff' : '#aeea00';
          map.setPaintProperty(l.id, 'line-color', c);
          if(map.getPaintProperty(l.id, 'line-opacity') !== undefined) {
             map.setPaintProperty(l.id, 'line-opacity', 1);
          }
        } else if (show && !boost) {
          map.setPaintProperty(l.id, 'line-width', layerStyles[l.id].width);
          map.setPaintProperty(l.id, 'line-color', layerStyles[l.id].color);
        }
      }
    });
  }
}

function addLayers(){
  if(!map.getSource('vn-draw')) map.addSource('vn-draw',{type:'geojson',data:emptyFC()});
  if(!map.getLayer('vn-draw')) map.addLayer({id:'vn-draw',type:'line',source:'vn-draw',paint:{'line-color':'#ff9100','line-width':4,'line-dasharray':[2,2]}});

  if(!map.getSource('vn-mesh')) map.addSource('vn-mesh', {type: 'geojson', data: emptyFC()});
  if(!map.getLayer('vn-mesh')) map.addLayer({id:'vn-mesh', type:'line', source:'vn-mesh', paint:{'line-color':'rgba(0,212,255,0.15)', 'line-width':1}, layout:{visibility:'none'}});

  if(!map.getSource('vn-mesh-dots')) map.addSource('vn-mesh-dots', {type: 'geojson', data: emptyFC()});
  if(!map.getLayer('vn-mesh-dots')) map.addLayer({id:'vn-mesh-dots', type:'circle', source:'vn-mesh-dots', paint:{'circle-color':'#00d4ff', 'circle-radius':3, 'circle-blur':0.3, 'circle-opacity':0.9}, layout:{visibility:'none'}});

  if(!map.getSource('vn-route')) map.addSource('vn-route',{type:'geojson',data:emptyFC()});
  
  if(!map.getLayer('route-segs-hit')) map.addLayer({id:'route-segs-hit',type:'line',source:'vn-route',paint:{'line-width':25,'line-opacity':0},layout:{'line-join':'round','line-cap':'round'}});
  if(!map.getLayer('vn-shad')) map.addLayer({id:'vn-shad',type:'line',source:'vn-route',paint:{'line-color':'#000','line-width':9,'line-opacity':0.3,'line-blur':7,'line-offset':2.5},layout:{'line-join':'round','line-cap':'round'}});
  if(!map.getLayer('route-manual-bg')) map.addLayer({id:'route-manual-bg',type:'line',source:'vn-route',filter:['==',['get','isManual'],true],paint:{'line-color':'#ff9100','line-width':9,'line-offset':2.5},layout:{'line-join':'round','line-cap':'round'}});
  if(!map.getLayer('route-segs')) map.addLayer({id:'route-segs',type:'line',source:'vn-route',paint:{'line-color':['get','color'],'line-width':5,'line-opacity':.96,'line-offset':2.5},layout:{'line-join':'round','line-cap':'round'}});

  if(!map.getSource('vn-km')) map.addSource('vn-km',{type:'geojson',data:emptyFC()});
  if(!map.getLayer('vn-km-dot')) map.addLayer({id:'vn-km-dot',type:'circle',source:'vn-km',paint:{'circle-radius':5,'circle-color':'#fff','circle-stroke-width':1.5,'circle-stroke-color':'#000','circle-opacity':.85},layout:{visibility:'none'}});
  if(!map.getLayer('vn-km-lbl')) map.addLayer({id:'vn-km-lbl',type:'symbol',source:'vn-km',layout:{visibility:'none','text-field':['get','label'],'text-font':['Noto Sans Regular','Open Sans Regular','Arial Unicode MS Regular'],'text-size':11,'text-offset':[0,-1.5],'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':'#fff','text-halo-color':'rgba(0,0,0,.8)','text-halo-width':1.5}});
  
  if(!map.getSource('vn-warn')) map.addSource('vn-warn',{type:'geojson',data:emptyFC()});
  if(!map.getLayer('vn-warn')) map.addLayer({id:'vn-warn',type:'symbol',source:'vn-warn',layout:{'text-field':'!','text-font':['Noto Sans Bold','Open Sans Bold','Arial Unicode MS Bold'],'text-size':16,'text-allow-overlap':true},paint:{'text-color':'#fff','text-halo-color':'#ff3d6b','text-halo-width':3}});

  if(!map.getSource('vn-wps')) map.addSource('vn-wps',{type:'geojson',data:emptyFC()});
  // Invisible hit-detection layer — HTML pin markers are used for visuals
  if(!map.getLayer('vn-wp-pulse')) map.addLayer({id:'vn-wp-pulse',type:'circle',source:'vn-wps',filter:['==',['get','isEnd'],true],paint:{'circle-radius':0,'circle-color':'transparent','circle-opacity':0}});
  if(!map.getLayer('vn-wp-shad'))  map.addLayer({id:'vn-wp-shad', type:'circle',source:'vn-wps',paint:{'circle-radius':0,'circle-color':'transparent','circle-opacity':0}});
  if(!map.getLayer('vn-wps'))      map.addLayer({id:'vn-wps',     type:'circle',source:'vn-wps',paint:{'circle-radius':16,'circle-color':'transparent','circle-opacity':0.001,'circle-stroke-width':0}});
  if(!map.getLayer('vn-wp-lbl'))   map.addLayer({id:'vn-wp-lbl',  type:'circle',source:'vn-wps',paint:{'circle-radius':0,'circle-opacity':0}});

  // Navi ridden track (gefahrene Strecke)
  if(!map.getSource('vn-ridden')) map.addSource('vn-ridden',{type:'geojson',data:emptyFC()});
  if(!map.getLayer('vn-ridden-shadow')) map.addLayer({id:'vn-ridden-shadow',type:'line',source:'vn-ridden',paint:{'line-color':'rgba(0,0,0,.4)','line-width':11,'line-blur':5,'line-offset':2.5},layout:{'line-join':'round','line-cap':'round'}});
  if(!map.getLayer('vn-ridden')) map.addLayer({id:'vn-ridden',type:'line',source:'vn-ridden',paint:{'line-color':'#1565C0','line-width':6,'line-opacity':.92,'line-offset':2.5},layout:{'line-join':'round','line-cap':'round'}});
  if(!map.getLayer('vn-ridden-glow')) map.addLayer({id:'vn-ridden-glow',type:'line',source:'vn-ridden',paint:{'line-color':'rgba(100,181,246,.5)','line-width':12,'line-blur':8,'line-offset':2.5},layout:{'line-join':'round','line-cap':'round'}});
  // REC live track
  if(!map.getSource('vn-rec-live')) map.addSource('vn-rec-live',{type:'geojson',data:emptyFC()});
  if(!map.getLayer('vn-rec-live-shadow')) map.addLayer({id:'vn-rec-live-shadow',type:'line',source:'vn-rec-live',paint:{'line-color':'rgba(0,0,0,.35)','line-width':9,'line-blur':5},layout:{'line-join':'round','line-cap':'round'}});
  if(!map.getLayer('vn-rec-live-line')) map.addLayer({id:'vn-rec-live-line',type:'line',source:'vn-rec-live',paint:{'line-color':'#ff3d6b','line-width':5,'line-opacity':.9},layout:{'line-join':'round','line-cap':'round'}});
  if(!map.getLayer('vn-rec-live-glow')) map.addLayer({id:'vn-rec-live-glow',type:'line',source:'vn-rec-live',paint:{'line-color':'rgba(255,61,107,.4)','line-width':11,'line-blur':7},layout:{'line-join':'round','line-cap':'round'}});

  // GPS position dot for navi
  if(!map.getSource('vn-gps')) map.addSource('vn-gps',{type:'geojson',data:emptyFC()});
  if(!map.getLayer('vn-gps-ring')) map.addLayer({id:'vn-gps-ring',type:'circle',source:'vn-gps',paint:{'circle-radius':18,'circle-color':'rgba(0,212,255,.15)','circle-stroke-width':2,'circle-stroke-color':'rgba(0,212,255,.5)'}});
  if(!map.getLayer('vn-gps-dot')) map.addLayer({id:'vn-gps-dot',type:'circle',source:'vn-gps',paint:{'circle-radius':8,'circle-color':'#00d4ff','circle-stroke-width':2.5,'circle-stroke-color':'#fff','circle-pitch-alignment':'map'}});

  // Navigations-Richtungs-Layer (Teardrop)
  if(!map.hasImage('vn-nav-dot')) map.addImage('vn-nav-dot', createNavDotIcon());
  if(!map.getLayer('vn-gps-dot-nav')) map.addLayer({id:'vn-gps-dot-nav',type:'symbol',source:'vn-gps',layout:{'icon-image':'vn-nav-dot','icon-size':1,'icon-allow-overlap':true,'icon-ignore-placement':true,'icon-rotation-alignment':'map','icon-rotate':['coalesce',['get','bearing'],0],'visibility':'none'}});

  // Show current position dot during planning (low-power background watch)
  if(navigator.geolocation){
    navigator.geolocation.watchPosition(pos => {
      if(naviActive) return; // navi has its own handler
      const {longitude:lng, latitude:lat} = pos.coords;
      if(map.getSource('vn-gps'))
        map.getSource('vn-gps').setData({type:'Feature',geometry:{type:'Point',coordinates:[lng,lat]}});
    }, ()=>{}, {enableHighAccuracy:false, maximumAge:10000, timeout:20000});
  }
}

// ══════════════════════════════════════════════════
// ROUTING
// ══════════════════════════════════════════════════
function addWaypoint(lng, lat){
  const idx = waypoints.length;
  waypoints.push({lng, lat, label:`P${idx+1}`, hidden: false, manualLine: false, customCoords: null});
  renderWpMarkers(); renderWpList();
  if(waypoints.length>=2) rerouteAll();
  else { updateWpDists(); renderElevChart(); }
}

async function rerouteAll(){
  showLoad('Route wird berechnet…');
  segments=[]; warnings=[];

  const osrmProfile = prefForest ? 'foot' : (PROFILES[activeProfile]?.osrm || 'cycling');

  for(let i=0;i<waypoints.length-1;i++){
    const a=waypoints[i], b=waypoints[i+1];

    if (b.manualLine) {
        let coords = [];
        if (b.customCoords) {
            coords = [...b.customCoords];
        } else {
            const steps = 10;
            for(let j=0; j<=steps; j++){
                coords.push([ a.lng + (b.lng - a.lng) * (j/steps), a.lat + (b.lat - a.lat) * (j/steps) ]);
            }
        }
        const elevs = await fetchElevations(coords);
        segments.push({coords, elevs});
        continue;
    }

    try {
      await sleep(80);

      if(usebrouter){
        // ── BRouter ──────────────────────────────────
        const seg = await fetchBRouterSegment(a, b);
        if(seg){
          // Fill any missing elevations via Open-Elevation
          const elevs = seg.elevs.some(e=>e==null) ? await fetchElevations(seg.coords) : seg.elevs;
          segments.push({coords:seg.coords, elevs});
        }
      } else {
        // ── OSRM fallback ────────────────────────────
        const res = await fetch(`https://router.project-osrm.org/route/v1/${osrmProfile}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&annotations=true`);
        const data = await res.json();
        if(!data.routes?.length) continue;
        const coords = data.routes[0].geometry.coordinates;
        if (prefForest && data.routes[0].legs[0].annotation?.surface) {
            const surfs = data.routes[0].legs[0].annotation.surface;
            let lastWarn = -100;
            surfs.forEach((s, idx) => {
                if (['unpaved', 'sand', 'dirt', 'grass', 'mud', 'gravel'].includes(s) && (idx - lastWarn > 30)) {
                    warnings.push({coord: coords[idx], msg: `⚠️ ${s}`});
                    lastWarn = idx;
                }
            });
        }
        const elevs = await fetchElevations(coords);
        segments.push({coords, elevs});
      }
    } catch(e){
      console.error('Routing error:', e);
      // Try OSRM as fallback if BRouter fails
      if(usebrouter){
        try{
          const res = await fetch(`https://router.project-osrm.org/route/v1/${osrmProfile}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`);
          const data = await res.json();
          if(data.routes?.length){
            const coords = data.routes[0].geometry.coordinates;
            const elevs = await fetchElevations(coords);
            segments.push({coords, elevs});
          }
        } catch(e2){ console.error(e2); }
      }
    }
  }

  rebuildRoute(); hideLoad();
}

function rebuildRoute(){
  fullRoute.coords=[]; fullRoute.elevs=[];
  for(const seg of segments){ fullRoute.coords.push(...seg.coords); fullRoute.elevs.push(...seg.elevs); }
  calcFullStats();
  updateWpDists();
  renderRoute();
  renderWarnings();
  renderStats();
  renderElevChart();
  updateKmMarkers();
  // Show navi FAB when route exists, rec FAB when no route and not recording-active
  const fab = document.getElementById('navi-start-fab');
  const recFab = document.getElementById('rec-start-fab');
  const hasRoute = fullRoute.coords.length >= 2;
  if(fab)    fab.style.display    = hasRoute ? 'flex' : 'none';
  if(recFab) recFab.style.display = (!hasRoute && !naviActive) ? 'flex' : 'none';
  // Start route pulse animation
  if(fullRoute.coords.length >= 2){
    startPulseAnimation(fullRoute.coords);
  } else if(pulseReqId){
    cancelAnimationFrame(pulseReqId); pulseReqId=null;
    if(map.getSource('vn-pulse')) map.getSource('vn-pulse').setData({type:'Feature',geometry:{type:'Point',coordinates:[0,0]}});
  }
}

function renderWarnings() {
  if(!map.getSource('vn-warn')) return;
  map.getSource('vn-warn').setData({
      type: 'FeatureCollection',
      features: warnings.map(w => ({
          type: 'Feature', geometry: {type: 'Point', coordinates: w.coord}, properties: {msg: w.msg}
      }))
  });
}

function toggleWald() {
    prefForest = !prefForest;
    document.getElementById('btn-wald')?.classList.toggle('active', prefForest);
    document.getElementById('mob-btn-wald')?.classList.toggle('active', prefForest);
    if(waypoints.length > 1) rerouteAll();
}

function toggleRouter(){
  usebrouter = !usebrouter;
  // Sync all engine toggle buttons (stats quick-toggle + plan tab)
  ['btn-brouter','mob-btn-brouter','mob-btn-brouter2','dsk-btn-brouter'].forEach(id=>{
    document.getElementById(id)?.classList.toggle('active', usebrouter);
  });
  ['mob-btn-osrm','dsk-btn-osrm'].forEach(id=>{
    document.getElementById(id)?.classList.toggle('active', !usebrouter);
  });
  // Show/hide BRouter profile grids
  ['dsk-brouter-profs','mob-brouter-profs'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = usebrouter ? '' : 'none';
  });
  showToast(usebrouter ? '🔀 BRouter aktiviert' : '🔁 Standard-Router (OSRM)');
  if(waypoints.length > 1) rerouteAll();
}

function setBrouterProfile(id, btn){
  brouterProfile = id;
  document.querySelectorAll('.bp-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`.bp-btn[data-pid="${id}"]`).forEach(b => b.classList.add('active'));
  if(waypoints.length > 1 && usebrouter) rerouteAll();
}

function renderBrouterProfileBtns(){
  ['bp-grid-dsk', 'mob-bp-grid'].forEach(gridId => {
    const g = document.getElementById(gridId);
    if(!g) return;
    g.innerHTML = BROUTER_PROFILES.map(p=>`
      <button class="bp-btn${p.id===brouterProfile?' active':''}" data-pid="${p.id}" onclick="setBrouterProfile('${p.id}',this)">
        ${p.icon} ${p.label}
      </button>`).join('');
  });
  // Also sync the engine button states
  ['btn-brouter','mob-btn-brouter','mob-btn-brouter2','dsk-btn-brouter'].forEach(id=>{
    document.getElementById(id)?.classList.toggle('active', usebrouter);
  });
  ['mob-btn-osrm','dsk-btn-osrm'].forEach(id=>{
    document.getElementById(id)?.classList.toggle('active', !usebrouter);
  });
}

// ══════════════════════════════════════════════════
// RENDER ROUTE & WPS
// ══════════════════════════════════════════════════
function renderRoute(){
  const {coords,elevs} = fullRoute;
  if(!map.getSource('vn-route')) return;
  if(coords.length<2){
    map.getSource('vn-route').setData(emptyFC());
    if(map.getSource('vn-shad')) map.getSource('vn-shad').setData(emptyFC());
    return;
  }
  const cum=[0];
  for(let i=0;i<coords.length-1;i++) cum.push(cum[cum.length-1]+haversineM(coords[i],coords[i+1]));
  
  const feats=[];
  const win=120;
  for(let i=0;i<coords.length-1;i++){
    let ip=i,in2=i+1;
    while(ip>0&&cum[i]-cum[ip]<win/2) ip--;
    while(in2<coords.length-1&&cum[in2]-cum[i]<win/2) in2++;
    const span=cum[in2]-cum[ip];
    const grade=span>0.5?((elevs[in2]-elevs[ip])/span)*100:0;
    
    let isManual = false;
    for(let w=1; w<waypoints.length; w++) {
        if(waypoints[w].manualLine && cum[i] >= window.wpDistKm[w-1]*1000 && cum[i] <= window.wpDistKm[w]*1000) {
            isManual = true; break;
        }
    }
    
    feats.push({type:'Feature',properties:{color:gradeColor(grade),grade:grade.toFixed(1),elev:(elevs[i]||0).toFixed(0), isManual: isManual},geometry:{type:'LineString',coordinates:[coords[i],coords[i+1]]}});
  }
  map.getSource('vn-route').setData({type:'FeatureCollection',features:feats});
}

window.toggleGlobalWps = function() {
    globalWpVisible = !globalWpVisible;
    if(globalWpVisible) waypoints.forEach(w => w.hidden = false);
    document.getElementById('btn-wp-vis').classList.toggle('active', globalWpVisible);
    const mwv=document.getElementById('mob-btn-wp-vis'); if(mwv) mwv.classList.toggle('active',globalWpVisible);
    renderWpMarkers();
    renderWpList();
};

window.hideSingleWp = function(idx) {
    waypoints[idx].hidden = true;
    document.querySelector('.maplibregl-popup')?.remove();
    renderWpMarkers();
    renderWpList();
};

window.unhideWp = function(idx) {
    waypoints[idx].hidden = false;
    renderWpMarkers();
    renderWpList();
};

function makePinSVG(color, label, size=34){
  const h = Math.round(size * 1.36);
  const cx = size/2, cy = size*0.44;
  const r  = size*0.46, ri = size*0.28;
  const tip = h;
  return `<svg width="${size}" height="${tip}" viewBox="0 0 ${size} ${tip}" xmlns="http://www.w3.org/2000/svg">
    <path d="M${cx} 0 C${cx-r} 0 ${cx-r} ${cy*2} ${cx} ${cy*2+r*0.9} C${cx+r} ${cy*2} ${cx+r} 0 ${cx} 0Z" fill="${color}" opacity="0.15"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(0,0,0,0.18)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>
    <path d="M${cx-r*0.7} ${cy+r*0.6} Q${cx} ${tip} ${cx+r*0.7} ${cy+r*0.6}" fill="${color}"/>
    <circle cx="${cx}" cy="${cy}" r="${ri}" fill="white" opacity="0.92"/>
    <text x="${cx}" y="${cy+4}" text-anchor="middle" font-family="-apple-system,system-ui,sans-serif" font-size="${size*0.29}" font-weight="800" fill="${color}">${label}</text>
    <rect x="${cx-size*0.7}" y="0" width="${size*1.4}" height="${tip}" fill="transparent"/>
  </svg>`;
}

// Pin dimensions for default size=34
const PIN_W = 34;
const PIN_H = Math.round(34 * 1.36); // 46px

function renderWpMarkers(){
  if(!map||!map.getSource('vn-wps')) return;

  // Update invisible GeoJSON for hit detection
  map.getSource('vn-wps').setData({
    type:'FeatureCollection',
    features:waypoints.map((wp,i)=>{
      const isEnd = i === 0 || i === waypoints.length - 1;
      const visible = isEnd || (globalWpVisible && !wp.hidden);
      if(!visible) return null;
      return {
        type:'Feature',
        properties:{index:i, color:i===0?'#00e676':i===waypoints.length-1?'#ff3d6b':'#ffd600', isEnd},
        geometry:{type:'Point',coordinates:[wp.lng,wp.lat]}
      };
    }).filter(Boolean)
  });

  // Remove old HTML markers
  wpMarkers.forEach(m => m.remove());
  wpMarkers = [];

  // Create new HTML pin markers with hold-to-drag / tap-for-popup
  waypoints.forEach((wp, i) => {
    const isEnd  = i === 0 || i === waypoints.length - 1;
    const visible = isEnd || (globalWpVisible && !wp.hidden);
    if(!visible) return;
    const color = i===0 ? '#00e676' : i===waypoints.length-1 ? '#ff3d6b' : '#ffd600';
    const el = document.createElement('div');
    el.className = 'wp-pin-wrap';
    // Explicit size so MapLibre can measure correctly before animation starts
    el.style.width  = PIN_W + 'px';
    el.style.height = PIN_H + 'px';
    el.style.display = 'block';
    el.innerHTML = '<div class="wp-pin-inner">' + makePinSVG(color, i+1) + '</div>';

    // ── Hold-to-drag / tap-for-popup logic ──────────────────
    let pinHoldTimer = null;
    let pinIsDragging = false;
    let pinMoved = false;
    const HOLD_MS = 350;

    function pinShowPopup(){
      document.querySelector('.maplibregl-popup')?.remove();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 400);
      new maplibregl.Popup({closeButton:false, anchor:'bottom', offset:6})
        .setLngLat([wp.lng, wp.lat])
        .setHTML(`<div style="position:relative;text-align:center;min-width:130px;font-family:var(--font);padding-top:4px;">
          <div class="popup-x" onclick="document.querySelector('.maplibregl-popup')?.remove()">✕</div>
          <div style="font-size:14px;font-weight:600;margin-bottom:11px;">Wegpunkt ${i+1}</div>
          <button class="btn ok" style="width:100%;justify-content:center;padding:7px;margin-bottom:5px;" onclick="startDraw(${i})">✏️ Freihand zeichnen</button>
          ${i!==0&&i!==waypoints.length-1?`<button class="btn" style="width:100%;justify-content:center;padding:7px;margin-bottom:5px;" onclick="hideSingleWp(${i})">👁 Verbergen</button>`:''}
          <button class="btn danger" style="width:100%;justify-content:center;padding:7px;" onclick="removeWp(${i});document.querySelector('.maplibregl-popup')?.remove()">✕ Löschen</button>
        </div>`)
        .addTo(map);
    }

    function startPinDrag(){
      _activePinDrag = true;
      pinIsDragging = true;
      dragWpId = i;
      isDraggingWp = true;
      el.querySelector('.wp-pin-inner').classList.add('wp-pin-dragging');
      el.querySelector('.wp-pin-inner').classList.remove('wp-pin-drop-in');
      map.dragPan.disable();
      document.querySelector('.maplibregl-popup')?.remove();
    }

    function endPinDrag(){
      if(!pinIsDragging) return;
      pinIsDragging = false;
      el.querySelector('.wp-pin-inner').classList.remove('wp-pin-dragging');
      isDraggingWp = false;
      map.dragPan.enable();
      // Ring FX at final position (convert map coords → screen coords)
      const rect = map.getCanvas().getBoundingClientRect();
      const pt = map.project([wp.lng, wp.lat]);
      spawnRingFX(pt.x + rect.left, pt.y + rect.top, color);
      if(!isLongPress) rerouteAll();
      _activePinDrag = false;
      dragWpId = null;
    }

    // Mouse events
    el.addEventListener('mousedown', (ev) => {
      if(naviActive) return;
      ev.stopPropagation(); ev.preventDefault();
      pinMoved = false;
      suppressClick = true;

      // Sofort dragPan sperren – verhindert dass die Karte unter dem Pin
      // wegscrollt und es so aussieht als würde der Pin der Maus folgen.
      map.dragPan.disable();

      pinHoldTimer = setTimeout(() => {
        startPinDrag();
      }, HOLD_MS);

      // End drag on mouseup anywhere
      const onMouseUp = () => {
        clearTimeout(pinHoldTimer);
        if(pinIsDragging){
          endPinDrag();
        } else {
          // Kein Drag → dragPan wiederherstellen, Popup zeigen
          map.dragPan.enable();
          pinShowPopup();
        }
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 400);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mouseup', onMouseUp);
    });

    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      // popup is handled by mouseup above; suppress map click
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 400);
    });

    // Touch events
    el.addEventListener('touchstart', (ev) => {
      if(naviActive) return;
      ev.stopPropagation();
      pinMoved = false;
      pinHoldTimer = setTimeout(() => {
        startPinDrag();
      }, HOLD_MS);
    }, {passive:true});

    el.addEventListener('touchend', (ev) => {
      ev.stopPropagation();
      clearTimeout(pinHoldTimer);
      if(pinIsDragging){
        endPinDrag();
      } else if(!pinMoved){
        pinShowPopup();
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 400);
      }
      touchedWpIdx = null; touchedWpCoord = null;
    });

    el.addEventListener('touchmove', (ev) => {
      pinMoved = true;
      clearTimeout(pinHoldTimer);
      if(!pinIsDragging) return;
      ev.preventDefault();
      const t = ev.touches[0];
      const rect = map.getCanvas().getBoundingClientRect();
      const lngLat = map.unproject([t.clientX - rect.left, t.clientY - rect.top]);
      waypoints[i].lng = lngLat.lng;
      waypoints[i].lat = lngLat.lat;
      marker.setLngLat([lngLat.lng, lngLat.lat]);
    }, {passive:false});

    // anchor:'bottom' + offset centers the pin tip on the coordinate.
    // We set it explicitly so MapLibre uses our known PIN_W/PIN_H, not a live measurement.
    const marker = new maplibregl.Marker({element:el, anchor:'bottom', offset:[0, 0]})
      .setLngLat([wp.lng, wp.lat])
      .addTo(map);
    marker._wpIdx = i;
    wpMarkers.push(marker);
    // Add drop-in animation AFTER marker is in DOM (avoids animation-offset confusing MapLibre)
    requestAnimationFrame(() => { el.querySelector('.wp-pin-inner').classList.add('wp-pin-drop-in'); });
  });
}

// Stats
function calcFullStats(){
  const {coords,elevs} = fullRoute;
  let dist=0, up=0, dn=0, maxG=0;
  for(let i=0;i<coords.length-1;i++){
    const d = haversineM(coords[i],coords[i+1]);
    dist += d;
    const de=(elevs[i+1]||0)-(elevs[i]||0);
    if(de>0&&elevs[i]>0) up+=de;
    else if(de<0&&elevs[i]>0) dn+=Math.abs(de);
    if(d>0.5) maxG=Math.max(maxG,Math.abs(de/d)*100);
  }
  fullRoute.dist=dist; fullRoute.up=up; fullRoute.dn=dn; fullRoute.maxGrade=maxG;
}

function renderStats(){
  const {dist,up,dn,maxGrade} = fullRoute;
  const w = parseFloat(document.getElementById('weight-inp')?.value||75);
  const cal = calcCalories(dist, up, w, currentSpeedKmh);
  const timeSec = dist>0 ? (dist/1000/currentSpeedKmh)*3600 : 0;

  // Desktop stats
  setEl('s-dist', dist>0?fmtDist(dist):'—');
  setEl('s-up', dist>0?`${Math.round(up)} m`:'—');
  setEl('s-down', dist>0?`${Math.round(dn)} m`:'—');
  setEl('s-grade', dist>0?`${maxGrade.toFixed(1)}%`:'—');
  setEl('s-time', dist>0?fmtTime(timeSec):'—');
  setEl('s-speed', dist>0?`${currentSpeedKmh} km/h`:'—');
  setEl('s-cal', dist>0?`${cal}`:'—');
  setEl('dur-val', dist>0?fmtTime(timeSec):'—');
  setEl('wp-count', waypoints.length);

  // Mobile peek stats
  setEl('pm-dist', dist>0?(dist/1000).toFixed(1):'—');
  setEl('pm-up', dist>0?`${Math.round(up)}`:'—');
  setEl('pm-time', dist>0?fmtTime(timeSec):'—');
  setEl('pm-cal', dist>0?`${cal}`:'—');

  // Mobile sheet stats
  setEl('ms-dist', dist>0?fmtDist(dist):'—');
  setEl('ms-time', dist>0?fmtTime(timeSec):'—');
  setEl('ms-up', dist>0?`${Math.round(up)} m`:'—');
  setEl('ms-down', dist>0?`${Math.round(dn)} m`:'—');
  setEl('ms-grade', dist>0?`${maxGrade.toFixed(1)}%`:'—');
  setEl('ms-speed', dist>0?`${currentSpeedKmh} km/h`:'—');
  setEl('ms-cal', dist>0?`${cal}`:'—');
}

function setEl(id, val){ const el=document.getElementById(id); if(el) el.textContent=val; }
function recalcStats(){ renderStats(); }

function renderWpList(){
  setEl('wp-count', waypoints.length);
  const html = waypoints.length===0 ?
    '<div class="wp-empty">Klicke auf die Karte<br>um Wegpunkte zu setzen</div>' :
    waypoints.map((wp,i)=>{
      const isF=i===0, isL=i===waypoints.length-1;
      const col=isF?'#00e676':isL?'#ff3d6b':'#ffd600';
      const tag=isF?'Start':isL?'Ziel':`WP ${i}`;
      return `<div class="wp-item" draggable="true" ondragstart="wdStart(event,${i})" ondragend="wdEnd(event)" ondragover="wdOver(event)" ondrop="wdDrop(event,${i})" ondragenter="wdEnter(event)" ondragleave="wdLeave(event)">
        <div class="wp-handle">☰</div>
        <div class="wp-dot" style="background:${col};color:#000">${i+1}</div>
        <div class="wp-info">
          <div class="wp-tag" style="color:${col}">${tag} ${wp.manualLine?' <span style="font-size:9px;color:var(--orange)">(Manuell)</span>':''}</div>
          <div class="wp-coord">${wp.lat.toFixed(5)}°N ${wp.lng.toFixed(5)}°E</div>
        </div>
        ${wp.hidden ? `<button class="wp-del" onclick="unhideWp(${i})" title="Wieder einblenden">👁️</button>` : `<button class="wp-del" onclick="removeWp(${i})" title="Löschen">✕</button>`}
      </div>`;
    }).join('');
  document.getElementById('wp-list').innerHTML=html;
  // Also update mobile list
  const mobList = document.getElementById('mob-wp-list');
  if(mobList) mobList.innerHTML = html;
}

let wdSrcIdx=null;
function wdStart(e,i){ wdSrcIdx=i; e.dataTransfer.effectAllowed='move'; e.target.style.opacity='.4'; }
function wdOver(e){ e.preventDefault(); e.dataTransfer.dropEffect='move'; }
function wdEnter(e){ e.currentTarget.classList.add('drag-over'); }
function wdLeave(e){ e.currentTarget.classList.remove('drag-over'); }
function wdEnd(e){ e.target.style.opacity='1'; }
async function wdDrop(e,ti){
  e.stopPropagation(); e.currentTarget.classList.remove('drag-over');
  if(wdSrcIdx===null||wdSrcIdx===ti) return;
  const m=waypoints.splice(wdSrcIdx,1)[0];
  waypoints.splice(ti,0,m);
  waypoints.forEach((wp,i)=>wp.label=`P${i+1}`);
  renderWpMarkers(); renderWpList();
  if(waypoints.length>=2) await rerouteAll(); else rebuildRoute();
}

async function removeWp(idx){
  waypoints.splice(idx,1);
  waypoints.forEach((wp,i)=>wp.label=`P${i+1}`);
  renderWpMarkers(); renderWpList();
  if(waypoints.length>=2) await rerouteAll(); else rebuildRoute();
}

function undoWp(){
  if(!waypoints.length) return;
  waypoints.pop();
  renderWpMarkers(); renderWpList();
  if(waypoints.length>=2) rerouteAll(); else rebuildRoute();
}

function clearAll(){
  waypoints=[]; segments=[]; window.wpDistKm=[]; warnings=[];
  fullRoute={coords:[],elevs:[],dist:0,up:0,dn:0,maxGrade:0};
  // Remove all HTML pin markers
  if(typeof wpMarkers !== 'undefined'){ wpMarkers.forEach(m=>m.remove()); wpMarkers=[]; }
  ['vn-route','vn-shad','vn-wps','vn-km','vn-warn','vn-draw'].forEach(id=>{ if(map&&map.getSource(id)) map.getSource(id).setData(emptyFC()); });
  renderWpList(); renderStats();
  setEl('dur-val','—');
  if(elevChart){ elevChart.data.datasets[0].data=[]; elevChart.update('none'); }
  const mobEl=document.getElementById('mob-elev-chart'); if(mobEl&&mobEl._chart){ mobEl._chart.data.datasets[0].data=[]; mobEl._chart.update('none'); }
  // Hide navi FAB
  const fab=document.getElementById('navi-start-fab'); if(fab) fab.style.display='none';
  // Stop pulse animation
  if(typeof pulseReqId!=='undefined'&&pulseReqId){ cancelAnimationFrame(pulseReqId); pulseReqId=null; }
  if(map&&map.getSource('vn-pulse')) try{ map.getSource('vn-pulse').setData({type:'Feature',geometry:{type:'Point',coordinates:[0,0]}}); }catch(e){}
  showToast('✓ Route und Wegpunkte gelöscht');
}

function updateWpDists(){
  window.wpDistKm=[0]; let run=0;
  for(const seg of segments){
    let d=0;
    for(let i=0;i<seg.coords.length-1;i++) d+=haversineM(seg.coords[i],seg.coords[i+1]);
    run+=d;
    window.wpDistKm.push(run/1000);
  }
}

// ══════════════════════════════════════════════════
// EXTRAS: KM Markers, Chart, Export
// ══════════════════════════════════════════════════
function updateKmMarkers(){
  if(!map.getSource('vn-km')) return;
  const {coords} = fullRoute;
  if(!kmMarkersOn||coords.length<2){ map.getSource('vn-km').setData(emptyFC()); return; }
  const feats=[];
  let dist=0, nextKm=1;
  for(let i=0;i<coords.length-1;i++){
    const d=haversineM(coords[i],coords[i+1]);
    dist+=d;
    while(dist/1000>=nextKm){
      const t=(nextKm*1000-(dist-d))/d;
      const lng=coords[i][0]+(coords[i+1][0]-coords[i][0])*t;
      const lat=coords[i][1]+(coords[i+1][1]-coords[i][1])*t;
      feats.push({type:'Feature',properties:{label:`${nextKm}km`},geometry:{type:'Point',coordinates:[lng,lat]}});
      nextKm++;
    }
  }
  map.getSource('vn-km').setData({type:'FeatureCollection',features:feats});
}

function toggleKmMarkers(){
  kmMarkersOn=!kmMarkersOn;
  const v=kmMarkersOn?'visible':'none';
  if(map.getLayer('vn-km-dot')) map.setLayoutProperty('vn-km-dot','visibility',v);
  if(map.getLayer('vn-km-lbl')) map.setLayoutProperty('vn-km-lbl','visibility',v);
  document.getElementById('t-km')?.classList.toggle('active',kmMarkersOn);
  document.getElementById('mob-t-km')?.classList.toggle('active',kmMarkersOn);
  updateKmMarkers();
}

function mapFitRoute(){
  if(!fullRoute.coords.length) return;
  const bounds = fullRoute.coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(fullRoute.coords[0], fullRoute.coords[0]));
  map.fitBounds(bounds, {padding: 60, duration: 1200});
}

const wpChartPlugin={
  id:'wpLines',
  beforeDraw(chart){
    if(!window.wpDistKm?.length) return;
    const {ctx,scales:{x,y}} = chart;
    ctx.save();
    ctx.lineWidth=1; ctx.setLineDash([4,4]);
    window.wpDistKm.forEach((d,i)=>{
      if(d===0&&i>0) return;
      const px=x.getPixelForValue(d);
      if(px<x.left||px>x.right) return;
      const col=i===0?'#00e676':i===window.wpDistKm.length-1?'#ff3d6b':'#ffd600';
      ctx.strokeStyle=col;
      ctx.beginPath(); ctx.moveTo(px,y.top); ctx.lineTo(px,y.bottom); ctx.stroke();
      ctx.fillStyle=col; ctx.beginPath(); ctx.arc(px,y.bottom,3,0,Math.PI*2); ctx.fill();
    });
    ctx.restore();
  }
};
if (typeof Chart !== 'undefined') { Chart.register(wpChartPlugin); }

function renderElevChart(){
  const {coords,elevs} = fullRoute;
  const emptyEl = document.getElementById('mob-elev-empty');

  if(elevs.length===0){
    if(elevChart){elevChart.data.datasets[0].data=[];elevChart.update('none');}
    if(emptyEl) emptyEl.style.display='flex';
    return;
  }
  const dists=[0];
  for(let i=0;i<coords.length-1;i++) dists.push(dists[dists.length-1]+haversineM(coords[i],coords[i+1]));
  const N=Math.min(elevs.length,350);
  const step=Math.max(1,Math.floor(elevs.length/N));
  const data=[];
  for(let i=0;i<elevs.length;i+=step){
    const distKm=(dists[Math.min(i,dists.length-1)]||0)/1000;
    data.push({x:distKm,y:Math.round(elevs[i])});
  }

  // Desktop chart
  if(elevChart){ elevChart.data.datasets[0].data=data; elevChart.update('none'); }
  else if(typeof Chart !== 'undefined'){
    const ctx=document.getElementById('elev-canvas').getContext('2d');
    const grad=ctx.createLinearGradient(0,0,0,110);
    grad.addColorStop(0,'rgba(0,212,255,.35)'); grad.addColorStop(1,'rgba(0,212,255,0)');
    elevChart=new Chart(ctx,{
      type:'line',
      data:{datasets:[{data,fill:true,backgroundColor:grad,borderColor:'#00d4ff',borderWidth:2,pointRadius:0,tension:.4}]},
      options:{
        responsive:true,maintainAspectRatio:false,animation:{duration:350},
        layout:{padding:{left:0,right:0,top:2,bottom:0}},
        plugins:{legend:{display:false},tooltip:{mode:'index',intersect:false,backgroundColor:'rgba(8,12,20,.92)',borderColor:'rgba(255,255,255,.08)',borderWidth:1,titleColor:'#8b9bb4',bodyColor:'#00d4ff',titleFont:{family:'JetBrains Mono',size:10},bodyFont:{family:'JetBrains Mono',size:12,weight:'bold'},callbacks:{title:it=>`${Number(it[0].raw.x).toFixed(2)} km`,label:it=>`${it.raw.y} m ü.NN`}}},
        scales:{
          x:{type:'linear',ticks:{callback:v=>v.toFixed(1)+'km',color:'#4a5568',maxTicksLimit:7,font:{size:9,family:'JetBrains Mono'}},grid:{color:'rgba(255,255,255,.04)'}},
          y:{ticks:{color:'#4a5568',maxTicksLimit:4,font:{size:9,family:'JetBrains Mono'},maxRotation:0},grid:{color:'rgba(255,255,255,.04)'},afterFit(scale){scale.width=38;}}
        },
        onHover:(_,els)=>{ if(els.length){ const v=elevChart.data.datasets[0].data[els[0].index]; setEl('elev-pos',`${v.y}m @ ${v.x.toFixed(2)}km`); } else setEl('elev-pos',''); }
      }
    });
  }

  // Mobile chart
  if(emptyEl) emptyEl.style.display='none';
  const mobCanvas = document.getElementById('mob-elev-chart');
  if(mobCanvas && typeof Chart !== 'undefined'){
    if(mobCanvas._chart){ mobCanvas._chart.data.datasets[0].data=data; mobCanvas._chart.update('none'); }
    else {
      const mctx = mobCanvas.getContext('2d');
      const mgrad = mctx.createLinearGradient(0,0,0,100);
      mgrad.addColorStop(0,'rgba(0,212,255,.3)'); mgrad.addColorStop(1,'rgba(0,212,255,0)');
      mobCanvas._chart = new Chart(mctx,{
        type:'line',
        data:{datasets:[{data,fill:true,backgroundColor:mgrad,borderColor:'#00d4ff',borderWidth:1.5,pointRadius:0,tension:.4}]},
        options:{
          responsive:true,maintainAspectRatio:false,animation:{duration:200},
          layout:{padding:{left:0,right:0,top:4,bottom:0}},
          plugins:{legend:{display:false},tooltip:{enabled:false}},
          scales:{
            x:{type:'linear',ticks:{callback:v=>v.toFixed(0)+'km',color:'#4a5568',maxTicksLimit:5,font:{size:8}},grid:{color:'rgba(255,255,255,.04)'}},
            y:{ticks:{color:'#4a5568',maxTicksLimit:3,font:{size:8},maxRotation:0},grid:{color:'rgba(255,255,255,.04)'},afterFit(sc){sc.width=30;}}
          }
        }
      });
    }
  }
}

function exportGPX(){
  const {coords,elevs} = fullRoute;
  if(coords.length<2){ showToast('Keine Route zum Exportieren'); return; }
  const pts = coords.map((c,i)=>`    <trkpt lat="${c[1].toFixed(7)}" lon="${c[0].toFixed(7)}"><ele>${Math.round(elevs[i]||0)}</ele></trkpt>`).join('\n');
  const gpx=`<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GravelGuide 3D" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata><name>GravelGuide Route</name><desc>${fmtDist(fullRoute.dist)} · ↑${Math.round(fullRoute.up)}m</desc></metadata>
  <trk><name>GravelGuide Route</name><trkseg>\n${pts}\n  </trkseg></trk>\n</gpx>`;
  const blob=new Blob([gpx],{type:'application/gpx+xml'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`gravelguide-${new Date().toISOString().slice(0,10)}.gpx`; a.click(); URL.revokeObjectURL(a.href);
  showToast('✓ GPX exportiert');
}

function importGPX(input){
  const file=input.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=async e=>{
    try {
      const parser=new DOMParser();
      const doc=parser.parseFromString(e.target.result,'application/xml');
      if(doc.querySelector('parsererror')) throw new Error('Parse error');
      let pts=[...doc.querySelectorAll('rtept')];
      if(pts.length<2){
        const all=[...doc.querySelectorAll('trkpt')];
        const step=Math.max(1,Math.floor(all.length/25));
        pts=all.filter((_,i)=>i%step===0||i===all.length-1);
      }
      if(pts.length<2){ showToast('GPX: Zu wenige Punkte'); return; }
      clearAll();
      pts.forEach(p=>{
        const lat=parseFloat(p.getAttribute('lat')),lng=parseFloat(p.getAttribute('lon'));
        if(!isNaN(lat)&&!isNaN(lng)) waypoints.push({lat,lng,label:`P${waypoints.length+1}`, hidden: false, manualLine: false, customCoords: null});
      });
      renderWpMarkers(); renderWpList();
      if(waypoints.length>=2){ map.flyTo({center:[waypoints[0].lng,waypoints[0].lat],zoom:11}); await rerouteAll(); mapFitRoute(); }
      showToast(`✓ ${waypoints.length} Punkte importiert`);
    } catch(err){ showToast('GPX Import fehlgeschlagen'); }
    input.value='';
  };
  reader.readAsText(file);
}

function exportGMaps(){
  if(waypoints.length < 2){ showToast('Mindestens 2 Wegpunkte nötig'); return; }
  // Google Maps supports max 10 stops (origin + 8 waypoints + destination)
  const pts = waypoints.filter((_, i) => i === 0 || i === waypoints.length-1 || waypoints.length <= 10);
  let stops;
  if(waypoints.length <= 10){
    stops = waypoints;
  } else {
    // Sample: start, ~7 intermediate, end
    const step = Math.floor((waypoints.length-2) / 7);
    stops = [waypoints[0]];
    for(let i=step; i<waypoints.length-1; i+=step) stops.push(waypoints[i]);
    stops.push(waypoints[waypoints.length-1]);
    stops = stops.slice(0,10);
  }
  const coords = stops.map(w => `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`);
  const url = `https://www.google.com/maps/dir/${coords.join('/')}`;
  window.open(url, '_blank');
  showToast('✓ Google Maps geöffnet');
}

function saveRoute(){
  if(waypoints.length<2){ showToast('Mindestens 2 Wegpunkte nötig'); return; }
  const deskInp = document.getElementById('save-name-inp');
  const mobInp  = document.getElementById('mob-save-inp');
  const name = (deskInp?.value.trim() || '') || (mobInp?.value.trim() || '') || `Route ${new Date().toLocaleDateString('de-DE')}`;
  const saves = getSaves();
  const id = Date.now();
  
  saves.push({ 
      id, name, date: new Date().toLocaleDateString('de-DE'), 
      wps: waypoints.map(w=>({lat:w.lat, lng:w.lng, label:w.label, hidden:w.hidden, manualLine:w.manualLine, customCoords:w.customCoords})), 
      stats: { dist:fullRoute.dist, up:fullRoute.up } 
  });
  
  if(saves.length>10) saves.splice(0,saves.length-10);
  localStorage.setItem('vn_saves', JSON.stringify(saves));
  if(deskInp) deskInp.value = '';
  if(mobInp)  mobInp.value  = '';
  renderSavesList();
  showToast(`✓ "${name}" gespeichert`);

  // ☁️ Cloud-Speicherung falls eingeloggt
  if(typeof window._awSaveRoute === 'function' && typeof window._awCurrentUser === 'function' && window._awCurrentUser()){
    const w = parseFloat(document.getElementById('weight-inp')?.value || 75);
    const cal = typeof calcCalories === 'function' ? calcCalories(fullRoute.dist, fullRoute.up, w, currentSpeedKmh||15) : 0;
    window._awSaveRoute({
      name,
      distance: Math.round(fullRoute.dist || 0),
      coordinates: fullRoute.coords.slice(0, 200),
      elevation: Math.round(fullRoute.up || 0),
      calories: cal,
      date: new Date().toISOString().slice(0,10),
      weight: w,
      coins: 0
    });
  }
}
function getSaves(){ try { return JSON.parse(localStorage.getItem('vn_saves')||'[]'); } catch(e){ return []; } }

function renderSavesList(){
  const saves=getSaves();
  const html = !saves.length
    ? '<div class="wp-empty" style="padding:14px 0;">Noch keine Routen gespeichert.</div>'
    : saves.slice().reverse().map(s=>`
    <div class="srt-item">
      <button class="srt-load" onclick="loadSavedRoute(${s.id})">
        <div class="srt-name">${s.isRecording ? '<span style="color:var(--red);font-size:9px;margin-right:4px;">⏺ REC</span>' : ''}${s.name}</div>
        <div class="srt-meta">${s.date} · ${fmtDist(s.stats?.dist||0)} · ↑${Math.round(s.stats?.up||0)}m</div>
      </button>
      <button class="srt-del" onclick="deleteSave(${s.id})">🗑</button>
    </div>`).join('');
  const list=document.getElementById('saves-list');
  const mobList=document.getElementById('mob-saves-list');
  if(list) list.innerHTML=html;
  if(mobList) mobList.innerHTML=html;
}
async function loadSavedRoute(id){
  const saves=getSaves();
  const s=saves.find(x=>x.id===id);
  if(!s) return;
  clearAll();

  if(s.rawCoords && s.rawCoords.length >= 2){
    // Aufgezeichnete Route: GPS-Track direkt anzeigen, kein Re-Routing
    const first = s.rawCoords[0];
    const last  = s.rawCoords[s.rawCoords.length-1];
    waypoints.push({lat:first[1],lng:first[0],label:'Start',hidden:false,manualLine:false,customCoords:null});
    waypoints.push({lat:last[1], lng:last[0], label:'Ziel', hidden:false,manualLine:false,customCoords:null});
    renderWpMarkers(); renderWpList();
    // Track auf Karte zeichnen
    if(map.getSource('vn-rec-live')){
      map.getSource('vn-rec-live').setData({type:'Feature',geometry:{type:'LineString',coordinates:s.rawCoords}});
    }
    const bounds = s.rawCoords.reduce((b,c)=>b.extend(c), new maplibregl.LngLatBounds(s.rawCoords[0],s.rawCoords[0]));
    map.fitBounds(bounds,{padding:60,duration:1000});
    showToast(`✓ "${s.name}" geladen`);
  } else {
    // Normale Route: Wegpunkte laden + neu routen
    s.wps.forEach((w,i)=>{
      waypoints.push({lat:w.lat,lng:w.lng,label:w.label||`P${i+1}`,hidden:!!w.hidden,manualLine:!!w.manualLine,customCoords:w.customCoords||null});
    });
    renderWpMarkers(); renderWpList();
    if(waypoints.length>=2){ map.flyTo({center:[waypoints[0].lng,waypoints[0].lat],zoom:11}); await rerouteAll(); mapFitRoute(); }
    showToast(`✓ "${s.name}" geladen`);
  }
  switchTab('t-route', document.querySelector('.tab-btn:nth-child(2)'));
}
function deleteSave(id){ const saves=getSaves().filter(s=>s.id!==id); localStorage.setItem('vn_saves',JSON.stringify(saves)); renderSavesList(); showToast('Route gelöscht'); }

function shareRoute(){
  if(waypoints.length<2){ showToast('Mindestens 2 Wegpunkte nötig'); return; }
  const hash='#wp='+waypoints.map(w=>`${w.lng.toFixed(5)},${w.lat.toFixed(5)}`).join('|');
  const url=window.location.origin+window.location.pathname+hash;
  if(navigator.clipboard){ navigator.clipboard.writeText(url).then(()=>showToast('🔗 Link kopiert!')).catch(()=>fallbackCopy(url)); }
  else fallbackCopy(url);
}
function fallbackCopy(text){ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy'); showToast('🔗 Link kopiert!');}catch(e){} document.body.removeChild(ta); }

async function checkURLHash(){
  const hash=window.location.hash;
  if(!hash.startsWith('#wp=')) return;
  const parts=hash.slice(4).split('|');
  const wps=parts.map((p,i)=>{ const [lng,lat]=p.split(',').map(Number); return {lng,lat,label:`P${i+1}`, hidden: false, manualLine:false, customCoords:null}; }).filter(w=>!isNaN(w.lat)&&!isNaN(w.lng));
  if(wps.length<2) return;
  waypoints=wps;
  renderWpMarkers(); renderWpList();
  await sleep(500);
  map.flyTo({center:[waypoints[0].lng,waypoints[0].lat],zoom:11});
  await rerouteAll();
  mapFitRoute();
}

function toggle3D(){ if(!apiKey){ showToast('Key benötigt'); return; } terrainOn=!terrainOn; map.setTerrain(terrainOn?{source:'dem',exaggeration:+document.getElementById('exag-sl').value}:null); document.getElementById('btn-3d').classList.toggle('active',terrainOn); const m=document.getElementById('mob-btn-3d'); if(m) m.classList.toggle('active',terrainOn); const m2=document.getElementById('mob-btn-3d2'); if(m2) m2.classList.toggle('active',terrainOn); }

function toggleSat(){
  if(!apiKey){ showToast('Key benötigt'); return; }
  satelliteOn = !satelliteOn;
  document.getElementById('btn-sat').classList.toggle('active', satelliteOn);
  const ms=document.getElementById('mob-btn-sat'); if(ms) ms.classList.toggle('active',satelliteOn);

  if(satelliteOn){
    if(!map.getSource('vn-satellite')){
      map.addSource('vn-satellite',{
        type:'raster',
        tiles:[`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${apiKey}`],
        tileSize:256, maxzoom:20
      });
    }
    // Find the first vn- or route- layer to insert satellite below it
    const firstVnId = (map.getStyle().layers||[]).find(l => l.id.startsWith('vn-') || l.id.startsWith('route-'))?.id;
    if(!map.getLayer('vn-sat-layer')){
      map.addLayer({id:'vn-sat-layer',type:'raster',source:'vn-satellite',paint:{
        'raster-opacity':1,
        'raster-contrast':0.15,
        'raster-saturation':0.2,
        'raster-brightness-min':0.02,
        'raster-brightness-max':1.0,
        'raster-fade-duration':150
      }}, firstVnId||undefined);
    } else {
      map.setLayoutProperty('vn-sat-layer','visibility','visible');
    }
    // Hide base vector/raster layers (keep vn- and route- layers visible)
    (map.getStyle().layers||[]).forEach(l => {
      if(l.id.startsWith('vn-') || l.id.startsWith('route-') || l.id === 'vn-sat-layer') return;
      try { map.setLayoutProperty(l.id,'visibility','none'); } catch(e){}
    });
  } else {
    if(map.getLayer('vn-sat-layer')) map.setLayoutProperty('vn-sat-layer','visibility','none');
    // Restore all base map layers
    (map.getStyle().layers||[]).forEach(l => {
      if(l.id.startsWith('vn-') || l.id.startsWith('route-') || l.id === 'vn-sat-layer') return;
      try { map.setLayoutProperty(l.id,'visibility', mapHidden ? 'none' : 'visible'); } catch(e){}
    });
    // Re-apply layer visibility (roads/paths) without overriding general layers
    const cats = getLayerCats();
    for(const type in cats){
      cats[type].forEach(l => {
        if(map.getLayer(l.id)) map.setLayoutProperty(l.id,'visibility', layerVis[type] ? 'visible' : 'visible'); // default to visible
      });
    }
  }
}

/* --- Mesh Funktion & Matrix Impulses --- */
let meshDots = [];
let meshReq = null;

function initMeshDots() {
    meshDots = [];
    for(let i=0; i<35; i++) {
        meshDots.push({
            isHoriz: Math.random() > 0.5,
            index: Math.floor(Math.random() * 20),
            prog: Math.random(),
            spd: (Math.random() * 0.003 + 0.001) * (Math.random()>0.5?1:-1)
        });
    }
}

function tickMeshDots() {
    if(!meshOn || !map || !map.getSource('vn-mesh-dots')) {
        cancelAnimationFrame(meshReq);
        return;
    }
    const b = map.getBounds();
    const w=b.getWest(), e=b.getEast(), s=b.getSouth(), n=b.getNorth();
    const feats = meshDots.map(d => {
        d.prog += d.spd;
        if(d.prog > 1) d.prog = 0;
        if(d.prog < 0) d.prog = 1;
        let lng = d.isHoriz ? w + (e-w)*d.prog : w + (e-w)*(d.index/20);
        let lat = d.isHoriz ? s + (n-s)*(d.index/20) : s + (n-s)*d.prog;
        return {type:'Feature', geometry:{type:'Point', coordinates:[lng, lat]}};
    });
    map.getSource('vn-mesh-dots').setData({type:'FeatureCollection', features:feats});
    meshReq = requestAnimationFrame(tickMeshDots);
}

window.toggleMesh = function(){ 
  meshOn=!meshOn; 
  const v=meshOn?'visible':'none'; 
  if(map.getLayer('vn-mesh')) map.setLayoutProperty('vn-mesh','visibility',v); 
  if(map.getLayer('vn-mesh-dots')) map.setLayoutProperty('vn-mesh-dots','visibility',v);
  document.getElementById('btn-mesh').classList.toggle('active',meshOn);
  const mm=document.getElementById('mob-btn-mesh'); if(mm) mm.classList.toggle('active',meshOn);
  
  if(meshOn) { 
      updateMesh(); 
      initMeshDots();
      cancelAnimationFrame(meshReq);
      meshReq = requestAnimationFrame(tickMeshDots);
  } else {
      cancelAnimationFrame(meshReq);
  }
};

window.updateMesh = function() {
    if(!meshOn || !map) return;
    const b = map.getBounds();
    const feats = [];
    for(let i=0; i<=20; i++) {
        const lng = b.getWest() + (b.getEast()-b.getWest())*(i/20);
        feats.push({type:'Feature', geometry:{type:'LineString', coordinates:[[lng, b.getSouth()], [lng, b.getNorth()]]}});
        const lat = b.getSouth() + (b.getNorth()-b.getSouth())*(i/20);
        feats.push({type:'Feature', geometry:{type:'LineString', coordinates:[[b.getWest(), lat], [b.getEast(), lat]]}});
    }
    if(map.getSource('vn-mesh')) map.getSource('vn-mesh').setData({type:'FeatureCollection', features:feats});
};

/* --- Map aus/ein togglen --- */
window.toggleHide = function() {
    mapHidden = !mapHidden;
    const style = map.getStyle();
    if(style && style.layers) {
       style.layers.forEach(l => {
           if(!l.id.startsWith('vn-') && !l.id.startsWith('route-') && l.type !== 'background') {
               map.setLayoutProperty(l.id, 'visibility', mapHidden ? 'none' : 'visible');
           }
       });
    }
    document.getElementById('t-hide').classList.toggle('active', mapHidden);
    document.getElementById('mob-t-hide')?.classList.toggle('active', mapHidden);
    applyMapLayers();
};

/* --- Meteo Pause Toggle --- */
window.toggleMeteo = function() {
    meteoPaused = !meteoPaused;
    document.getElementById('t-meteo').classList.toggle('active', meteoPaused);
    document.getElementById('mob-t-meteo')?.classList.toggle('active', meteoPaused);
    showToast(meteoPaused ? "Meteo pausiert (keine Höhenanfragen)" : "Meteo wieder aktiv");
};

function switchTab(id,btn){
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('on'));
  document.getElementById(id)?.classList.add('on');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(id==='t-tools') renderBrouterProfileBtns();
}
function switchSheetTab(id,btn){
  document.querySelectorAll('.sh-pane').forEach(p=>p.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  document.querySelectorAll('.sh-tab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(id==='st-tools') renderBrouterProfileBtns();
}

// ── LAYER CYCLE (Karte → Satellit → Hybrid) ──────────
let layerMode = 0; // 0=Karte, 1=Satellit, 2=Hybrid
const LAYER_LABELS = ['🗺 Karte','🛰 Satellit','🌐 Hybrid'];
function cycleLayerMode(){
  layerMode = (layerMode + 1) % 3;
  const label = LAYER_LABELS[layerMode];
  const btnD = document.getElementById('hdr-layer-btn');
  const btnM = document.getElementById('mob-layer-btn');
  if(btnD) btnD.textContent = label;
  if(btnM) btnM.textContent = label.split(' ')[0]; // just emoji on mobile

  if(layerMode === 0){
    // Normal map: Satellit + Hybrid-Overlay ausblenden, Vektorlayer einblenden
    if(map.getLayer('vn-sat-layer')) map.setLayoutProperty('vn-sat-layer','visibility','none');
    hideHybridLabels();
    (map.getStyle().layers||[]).forEach(l=>{
      if(l.id.startsWith('vn-')||l.id.startsWith('route-')) return;
      try{ map.setLayoutProperty(l.id,'visibility', mapHidden?'none':'visible'); }catch(e){}
    });
    satelliteOn = false;
    ortsNamenOn = false;
    document.getElementById('btn-sat')?.classList.remove('active');
    document.getElementById('mob-btn-sat')?.classList.remove('active');
  } else {
    // Satellit oder Hybrid: Sat-Layer einschalten
    if(!satelliteOn){ satelliteOn=true; ensureSatLayer(); }
    else{ if(map.getLayer('vn-sat-layer')) map.setLayoutProperty('vn-sat-layer','visibility','visible'); }
    document.getElementById('btn-sat')?.classList.add('active');
    document.getElementById('mob-btn-sat')?.classList.add('active');
    if(layerMode === 2){
      // Hybrid: Raster-Label-Overlay drüberlegen
      ortsNamenOn = true;
      ensureHybridLabels();
      document.getElementById('t-ortsnamen')?.classList.add('active');
      document.getElementById('mob-t-ortsnamen')?.classList.add('active');
    } else {
      // Reiner Satellit: Labels ausblenden
      ortsNamenOn = false;
      hideHybridLabels();
      document.getElementById('t-ortsnamen')?.classList.remove('active');
      document.getElementById('mob-t-ortsnamen')?.classList.remove('active');
    }
  }
  showToast(label);
}

function ensureSatLayer(){
  if(!apiKey){ showToast('Key benötigt'); layerMode=0; return; }
  if(!map.getSource('vn-satellite')){
    map.addSource('vn-satellite',{
      type:'raster',
      tiles:[`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${apiKey}`],
      tileSize:256, maxzoom:20
    });
  }
  const firstVn = (map.getStyle().layers||[]).find(l=>l.id.startsWith('vn-')||l.id.startsWith('route-'))?.id;
  if(!map.getLayer('vn-sat-layer')){
    map.addLayer({id:'vn-sat-layer',type:'raster',source:'vn-satellite',paint:{
      'raster-opacity':1,
      'raster-contrast':0.15,
      'raster-saturation':0.2,
      'raster-fade-duration':150   // sanftes Einblenden statt hartem Flackern
    }},firstVn||undefined);
  } else {
    map.setLayoutProperty('vn-sat-layer','visibility','visible');
  }
  (map.getStyle().layers||[]).forEach(l=>{
    if(l.id.startsWith('vn-')||l.id.startsWith('route-')||l.id==='vn-sat-layer') return;
    try{ map.setLayoutProperty(l.id,'visibility','none'); }catch(e){}
  });
}

// ── Hybrid: Vektor-Symbol-Layer über Sat einblenden ──────────────────────────
// Statt eines halbdurchsichtigen Raster-Overlays werden direkt die Symbol-Layer
// (Ortsnamen, Straßennamen) aus dem geladenen Vektorstil reaktiviert.
// → gestochen scharfe, gut lesbare Beschriftungen über dem Satellitenbild.

function ensureHybridLabels(){
  // Alten Raster-Overlay ausblenden
  if(map.getLayer('vn-hybrid-labels')) map.setLayoutProperty('vn-hybrid-labels','visibility','none');

  if(!apiKey){ showToast('API-Key für Hybrid-Labels benötigt'); return; }

  // ── Eigene Vektorkacheln-Quelle für Ortsnamen ──────────────────────────────
  // Wir fügen eine eigenständige pbf-Quelle hinzu und definieren Symbol-Layer
  // explizit on top – unabhängig vom Basis-Stil und dessen Render-Reihenfolge.
  if(!map.getSource('vn-place-src')){
    map.addSource('vn-place-src',{
      type:'vector',
      url:`https://api.maptiler.com/tiles/v3/tiles.json?key=${apiKey}`
    });
  }

  // Konfiguration: [layerId, class-Filter, minzoom, textSize, fontWeight]
  const cfgs = [
    ['vn-lbl-country', ['in','class','country'],          2,  13, 'Bold'],
    ['vn-lbl-state',   ['in','class','state','region'],   5,  12, 'Bold'],
    ['vn-lbl-city',    ['in','class','city'],              6,  13, 'Bold'],
    ['vn-lbl-town',    ['in','class','town'],              9,  12, 'Regular'],
    ['vn-lbl-village', ['in','class','village','hamlet'], 11,  11, 'Regular'],
    ['vn-lbl-suburb',  ['in','class','suburb','quarter'], 13,  10, 'Regular'],
  ];

  cfgs.forEach(([id, filter, minzoom, size, weight])=>{
    if(!map.getLayer(id)){
      map.addLayer({
        id, type:'symbol',
        source:'vn-place-src', 'source-layer':'place',
        minzoom,
        filter,
        layout:{
          'text-field':['coalesce',['get','name:de'],['get','name:en'],['get','name']],
          'text-font':[`Noto Sans ${weight}`,`Open Sans ${weight}`,'Arial Unicode MS Regular'],
          'text-size': size,
          'text-anchor':'center',
          'text-max-width': 8,
          'text-allow-overlap': false,
          'visibility':'visible'
        },
        paint:{
          'text-color':'#ffffff',
          'text-halo-color':'rgba(0,0,0,0.85)',
          'text-halo-width': 1.8,
          'text-halo-blur': 0.5
        }
      });
    } else {
      map.setLayoutProperty(id,'visibility','visible');
    }
  });
}

function hideHybridLabels(){
  if(map.getLayer('vn-hybrid-labels')) map.setLayoutProperty('vn-hybrid-labels','visibility','none');
  ['vn-lbl-country','vn-lbl-state','vn-lbl-city','vn-lbl-town','vn-lbl-village','vn-lbl-suburb'].forEach(id=>{
    if(map.getLayer(id)) map.setLayoutProperty(id,'visibility','none');
  });
  // Ggf. noch vorhandene alte Symbol-Layer wieder verstecken
  (map.getStyle().layers||[]).forEach(l=>{
    if(l.id.startsWith('vn-')||l.id.startsWith('route-')||l.id==='vn-sat-layer') return;
    if(l.type==='symbol'){
      try{ map.setLayoutProperty(l.id,'visibility','none'); }catch(e){}
    }
  });
}

// ── ORTSNAMEN AUF SAT TOGGLE ──────────────────────────
let ortsNamenOn = false;
window.toggleOrtsnamen = function(){
  if(!satelliteOn && layerMode===0){ showToast('Erst Satellit aktivieren'); return; }
  ortsNamenOn = !ortsNamenOn;
  document.getElementById('t-ortsnamen')?.classList.toggle('active', ortsNamenOn);
  document.getElementById('mob-t-ortsnamen')?.classList.toggle('active', ortsNamenOn);
  if(ortsNamenOn){
    layerMode = 2;
    const btnD = document.getElementById('hdr-layer-btn');
    const btnM = document.getElementById('mob-layer-btn');
    if(btnD) btnD.textContent = '🌐 Hybrid';
    if(btnM) btnM.textContent = '🌐';
    ensureHybridLabels();
    showToast('🌐 Hybrid-Karte (Sat + Labels)');
  } else {
    layerMode = 1;
    const btnD = document.getElementById('hdr-layer-btn');
    const btnM = document.getElementById('mob-layer-btn');
    if(btnD) btnD.textContent = '🛰 Satellit';
    if(btnM) btnM.textContent = '🛰';
    if(map.getLayer('vn-hybrid-labels')) map.setLayoutProperty('vn-hybrid-labels','visibility','none');
    hideHybridLabels();
    showToast('Ortsnamen ausgeblendet');
  }
};

// ── PROFIL ANALYSE SWITCH ─────────────────────────────
const PA_DATA = {
  w:{ km:'142.3', hm:'1.840', cal:'9.820', tours:'6' },
  m:{ km:'487.2', hm:'5.320', cal:'32.140', tours:'19' },
  y:{ km:'1.247', hm:'14.820', cal:'87.340', tours:'68' }
};
window.switchAnalysis = function(period, btn){
  const d = PA_DATA[period];
  ['km','hm','cal','tours'].forEach(k=>{
    const dEl = document.getElementById('pa-'+k);
    const mEl = document.getElementById('mob-pa-'+k);
    if(dEl) dEl.textContent = d[k];
    if(mEl) mEl.textContent = d[k];
  });
  document.querySelectorAll('#pa-w,#pa-m,#pa-y,#mob-pa-w,#mob-pa-m,#mob-pa-y').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll(`#pa-${period},#mob-pa-${period}`).forEach(b=>b.classList.add('active'));
};

function setSheetState(s){
  sheetState    = Math.max(0, Math.min(1, s));
  sheetExpanded = sheetState >= 1;
  const bs = document.getElementById('bsheet');
  bs.classList.toggle('exp', sheetState === 1);
  bs.classList.remove('max');
}

function toggleSheet(){
  // Handle-click: collapsed ↔ expanded (62vh)
  setSheetState(sheetState === 0 ? 1 : 0);
}

function updateMobBtns(){
  const isMob = window.innerWidth<=860;
  const mbtn = document.getElementById('mob-menu-btn');
  if(mbtn) mbtn.style.display = isMob ? 'block' : 'none';
}
window.addEventListener('resize',updateMobBtns);

function setExag(v){ document.getElementById('exag-v').textContent=Number(v).toFixed(1)+'×'; if(terrainOn&&apiKey) map.setTerrain({source:'dem',exaggeration:+v}); }

function locateMe(){
  if(!navigator.geolocation){ showToast('Geolocation nicht unterstützt'); return; }
  showToast('Sucht Standort…');
  navigator.geolocation.getCurrentPosition(p=>{
    map.flyTo({center:[p.coords.longitude,p.coords.latitude],zoom:14});
  },()=>showToast('Standort fehlgeschlagen'),{enableHighAccuracy:true});
}

function setSpeed(v,btn,prof='casual'){
  if(v) currentSpeedKmh=v;
  activeProfile=prof;
  document.querySelectorAll('.spd-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  recalcStats();
}

function applyCustomSpeed(){
  const v=+document.getElementById('custom-spd-inp').value;
  if(v>=5&&v<=60){ setSpeed(v,document.getElementById('spd-custom'),'casual'); document.getElementById('spd-custom').textContent=`⚙ ${v}`; }
}

// ══════════════════════════════════════════════════
// NAVIGATION MODE
// ══════════════════════════════════════════════════
let naviActive      = false;
let naviWatchId     = null;
let naviUiInterval  = null;
let naviViewMode    = 0;
let naviStartTime   = null;
let naviRiddenM     = 0;
let naviLastPos     = null;
let naviLastPosPrev = null;
let naviRouteIdx    = 0;
let naviWakeLock    = null;
let naviHideTimer   = null;
let naviAutoReturnTimer = null;
let naviPeekTimer   = null;
let naviBearing     = 0;
let naviUserLastTouch = 0;   // timestamp of last manual map touch during navi
const NAVI_RETURN_MS = 20000; // 20s inactivity → return to follow mode

// ── NAVI ERWEITERUNGEN ────────────────────────────────
let naviPassedWps   = new Set(); // welche WP-Indices bereits passiert wurden
let naviSpeedSamples= [];        // [kmh] letzte Werte für Ø-Berechnung
let naviPreRouteAdded = false;   // wurde Pre-Route-Layer angelegt?

// ── POWER SAVE STATE ─────────────────────────────────
const ps = (() => {
  try { return Object.assign({master:true,gps:true,display:true,cache:true,darkhud:true,noanim:true},
    JSON.parse(localStorage.getItem('vn_ps')||'{}')); } catch(e) {
    return {master:true,gps:true,display:true,cache:true,darkhud:true,noanim:true};
  }
})();
let naviClimbM = 0;
let naviLastElev = null;

// ── ROUTING ENGINE ───────────────────────────────────
let usebrouter      = true;   // BRouter is default
let brouterProfile  = 'trekking';
let touchedWpIdx    = null;   // waypoint index from last touchstart
let touchedWpCoord  = null;   // coordinates of that waypoint
let suppressClick   = false;  // prevents click from firing after touch-popup
let _activePinDrag  = false;  // true while an HTML-marker pin is being dragged (desktop)

const BROUTER_PROFILES = [
  {id:'trekking',     icon:'🚵', label:'Trekking'},
  {id:'fastbike',     icon:'🏎', label:'Rennrad'},
  {id:'safety',       icon:'🛡', label:'Sicherheit'},
  {id:'shortest',     icon:'📏', label:'Kürzeste'},
  {id:'mtb',          icon:'⛰', label:'MTB'},
  {id:'electric',     icon:'⚡', label:'E-Bike'},
  {id:'hiking-mountain',icon:'🥾',label:'Bergwandern'},
];

async function fetchBRouterSegment(a, b){
  const url = `https://brouter.de/brouter?lonlats=${a.lng},${a.lat}|${b.lng},${b.lat}&profile=${brouterProfile}&alternativeidx=0&format=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  if(!data.features?.length) return null;
  const feat = data.features[0];
  const coords = feat.geometry.coordinates.map(c => [c[0], c[1]]);
  // BRouter returns elevation as 3rd coord (metres*1 or *0.1 depending on version)
  const elevs  = feat.geometry.coordinates.map(c => c[2] != null ? (c[2] > 5000 ? c[2]/10 : c[2]) : null);
  return { coords, elevs };
}

const NAVI_VIEW_LABELS = ['🧭 Nah', '↑ Nord', '▷ Abschn.', '⊞ Gesamt'];

// ══════════════════════════════════════════════════
// POWER SAVE
// ══════════════════════════════════════════════════
function togglePsMaster(on){
  ps.master = on;
  ['dsk','mob'].forEach(sfx => {
    const opts = document.getElementById(`ps-opts-${sfx}`);
    if(opts) opts.classList.toggle('disabled', !on);
    const cb = document.getElementById(`ps-master-${sfx}`);
    if(cb) cb.checked = on;
  });
  localStorage.setItem('vn_ps', JSON.stringify(ps));
}

function togglePs(key){
  ps[key] = !ps[key];
  const label = ps[key] ? 'AN' : 'AUS';
  ['dsk','mob'].forEach(sfx => {
    const b = document.getElementById(`ps-${key}-${sfx}`);
    if(b){ b.textContent = label; b.className = 'ps-badge' + (ps[key] ? ' on' : ''); }
  });
  localStorage.setItem('vn_ps', JSON.stringify(ps));
}

function psApply(){
  if(!ps.master) return;
  if(ps.darkhud){
    // Remove expensive backdrop-blur from HUD during navi
    const ov = document.getElementById('navi-overlay');
    if(ov) ov.style.cssText += ';--blur:blur(2px)';
    const hud = document.getElementById('navi-hud-bar');
    if(hud) hud.style.backdropFilter = 'none';
    
    
  }
}

function psRestore(){
  const hud = document.getElementById('navi-hud-bar');
  if(hud) hud.style.backdropFilter = '';
  
  
}

async function psCacheTiles(){
  if(!ps.master || !ps.cache || !fullRoute.coords.length) return;
  if(!('caches' in window)) return;
  try {
    const cache = await caches.open('vn-tiles-v1');
    const step = Math.max(1, Math.floor(fullRoute.coords.length / 24));
    const urls = [];
    for(let i = 0; i < fullRoute.coords.length; i += step){
      const [lng, lat] = fullRoute.coords[i];
      for(const z of [13, 14]){
        const x = Math.floor((lng + 180) / 360 * (1 << z));
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * (1 << z));
        urls.push(`https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`);
        if(apiKey) urls.push(`https://api.maptiler.com/maps/outdoor-v2/${z}/${x}/${y}.png?key=${apiKey}`);
      }
    }
    const unique = [...new Set(urls)].slice(0, 60);
    let cached = 0;
    await Promise.allSettled(unique.map(url =>
      fetch(url, {mode:'no-cors'}).then(r => { cache.put(url, r); cached++; }).catch(()=>{})
    ));
    showToast(`📦 ${cached} Kacheln gecacht`);
  } catch(e){ console.warn('psCacheTiles:', e); }
}

// Init UI from saved ps state on load
(function psInitUI(){
  document.addEventListener('DOMContentLoaded', () => {
    ['dsk','mob'].forEach(sfx => {
      const cb = document.getElementById(`ps-master-${sfx}`);
      if(cb) cb.checked = ps.master;
      const opts = document.getElementById(`ps-opts-${sfx}`);
      if(opts) opts.classList.toggle('disabled', !ps.master);
      ['gps','display','cache','darkhud','noanim'].forEach(key => {
        const b = document.getElementById(`ps-${key}-${sfx}`);
        if(b){ b.textContent = ps[key] ? 'AN' : 'AUS'; b.className = 'ps-badge' + (ps[key] ? ' on' : ''); }
      });
    });
  });
})();

/* ---------- START / STOP ---------- */
function startNavi(){
  if(fullRoute.coords.length < 2){ showToast('Bitte erst eine Route planen!'); return; }
  if(!navigator.geolocation){ showToast('Kein GPS verfügbar'); return; }

  naviActive     = true;
  naviStartTime  = Date.now();
  naviRiddenM    = 0;
  naviLastPos    = null;
  naviLastPosPrev= null;
  naviRouteIdx   = 0;
  naviViewMode   = 0;
  naviBearing    = 0;
  naviClimbM     = 0;
  naviLastElev   = null;
  naviPassedWps  = new Set();
  naviSpeedSamples = [];
  naviFabViewState = 0;
  const viewFab = document.getElementById('navi-view-fab');
  if(viewFab) viewFab.textContent = '🗺';

  // Reset ridden layer
  if(map.getSource('vn-ridden')) map.getSource('vn-ridden').setData(emptyFC());
  if(map.getSource('vn-gps'))    map.getSource('vn-gps').setData(emptyFC());

  document.body.classList.add('navi-mode');
  document.getElementById('navi-overlay').classList.add('active');
  document.getElementById('navi-start-fab').style.display = 'none';
  // Kreis → Richtungs-Teardrop
  if(map.getLayer('vn-gps-dot'))     map.setLayoutProperty('vn-gps-dot',     'visibility','none');
  if(map.getLayer('vn-gps-dot-nav')) map.setLayoutProperty('vn-gps-dot-nav', 'visibility','visible');

  // Mobile: collapse & hide bsheet, show stop button
  if(window.innerWidth <= 860){
    setSheetState(0);
    const mobStop = document.getElementById('mob-navi-stop');
    if(mobStop) mobStop.style.display = 'block';
  }

  // Blur all inputs to prevent iOS Safari "Shake to Undo" dialog
  document.querySelectorAll('input, textarea').forEach(el => { try{ el.blur(); }catch(e){} });

  // Prevent screen sleep
  if('wakeLock' in navigator){
    navigator.wakeLock.request('screen')
      .then(lock => { naviWakeLock = lock; })
      .catch(()=>{});
  }

  // GPS watch — power-save uses 2s/5m (smooth enough, saves battery vs 1s/0m)
  const gpsOpts = (ps.master && ps.gps)
    ? { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    : { enableHighAccuracy: true, maximumAge: 500,  timeout: 10000 };

  // Fly to current position immediately on start — don't wait for first watchPosition tick
  navigator.geolocation.getCurrentPosition(pos => {
    const {longitude:lng, latitude:lat} = pos.coords;
    naviUserLastTouch = 0; // ensure follow mode is active
    map.flyTo({center:[lng,lat], zoom:16.5, pitch:62, bearing:0, duration:1200, essential:true});
    if(map.getSource('vn-gps')) map.getSource('vn-gps').setData({type:'Feature',geometry:{type:'Point',coordinates:[lng,lat]},properties:{bearing:0}});
    // ── Auto-Route zum ersten Wegpunkt ──────────────────────
    if(waypoints.length >= 1){
      const d = haversineM([lng,lat],[waypoints[0].lng,waypoints[0].lat]);
      if(d > 40 && d < 15000) naviShowPreRoute(lng, lat, waypoints[0].lng, waypoints[0].lat, d);
    }
  }, ()=>{}, {enableHighAccuracy:true, maximumAge:10000, timeout:8000});

  naviWatchId = navigator.geolocation.watchPosition(
    pos  => naviOnPosition(pos),
    err  => console.warn('GPS error:', err.message),
    gpsOpts
  );

  naviUiInterval = setInterval(naviTickUI, 1000);
  // Make all navi UI elements visible at start, then start the auto-hide timer
  ['navi-top','navi-zoom','navi-speed-bubble','navi-bottom'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.style.opacity='1'; el.style.pointerEvents='auto'; }
  });
  naviStartAutoHide();
  updateNaviViewBtn();
  psApply();
  psCacheTiles();
  showToast('🚴 Navigation gestartet!');
}

function stopNavi(silent){
  naviActive = false;
  if(naviWatchId !== null){ navigator.geolocation.clearWatch(naviWatchId); naviWatchId = null; }
  if(naviUiInterval){  clearInterval(naviUiInterval);  naviUiInterval = null; }
  if(naviWakeLock){    naviWakeLock.release().catch(()=>{}); naviWakeLock = null; }
  clearTimeout(naviHideTimer);
  clearTimeout(naviAutoReturnTimer);
  clearTimeout(naviPeekTimer);

  document.body.classList.remove('navi-mode');
  document.getElementById('navi-overlay').classList.remove('active');
  // Teardrop → Kreis zurück
  if(map.getLayer('vn-gps-dot-nav')) map.setLayoutProperty('vn-gps-dot-nav','visibility','none');
  if(map.getLayer('vn-gps-dot'))     map.setLayoutProperty('vn-gps-dot',    'visibility','visible');
  // Pre-Route ausblenden
  if(map.getSource('vn-pre-rt')) map.getSource('vn-pre-rt').setData(emptyFC());

  // Mobile: restore bsheet state, hide stop button
  const bs = document.getElementById('bsheet');
  
  const mobStop = document.getElementById('mob-navi-stop');
  if(mobStop) mobStop.style.display = 'none';

  // Show FAB again if route still exists
  const fab = document.getElementById('navi-start-fab');
  if(fab && fullRoute.coords.length >= 2) fab.style.display = 'flex';
  // Restore rec fab if no route
  const recFab = document.getElementById('rec-start-fab');
  if(recFab) recFab.style.display = fullRoute.coords.length >= 2 ? 'none' : 'flex';

  psRestore();
  if(!silent) showToast('Navigation beendet · ' + (naviRiddenM/1000).toFixed(1) + ' km gefahren');
}

/* ---------- GPS POSITION HANDLER ---------- */
function naviOnPosition(pos){
  const { latitude:lat, longitude:lng, speed, accuracy } = pos.coords;
  const now = [lng, lat];
  const nowTime = Date.now();

  // Heading — primär: GPS-Kompass (pos.coords.heading), sekundär: berechneter Kurs
  const gpsHeading = pos.coords.heading;
  const gpsSpeed   = pos.coords.speed; // m/s, kann null sein
  const isMoving   = (gpsSpeed != null && gpsSpeed > 0.3) || (naviLastPos && haversineM(naviLastPos, now) > 8);

  if(isMoving){
    if(gpsHeading != null && !isNaN(gpsHeading) && gpsHeading >= 0){
      // GPS-Chip liefert direkt den Kurs → genaueste Quelle
      naviBearing = gpsHeading;
    } else if(naviLastPos){
      // Fallback: Kurs aus Positions-Differenz berechnen
      naviBearing = calcBearing(naviLastPos, now);
    }
  }

  // Accumulate distance
  if(naviLastPos){
    const d = haversineM(naviLastPos, now);
    if(d < 80) naviRiddenM += d;
  }

  // Elevation gain
  const alt = pos.coords.altitude;
  if(alt !== null && alt !== undefined){
    if(naviLastElev !== null && alt > naviLastElev + 0.5) naviClimbM += (alt - naviLastElev);
    naviLastElev = alt;
  }

  naviLastPosPrev = naviLastPos;
  naviLastPos     = now;

  // Route progress
  naviRouteIdx = naviNearestIdx(now);

  // ── Wegpunkt-Passage prüfen ──────────────────────────
  naviCheckWpPassage(now);

  // GPS dot (bearing für Richtungs-Layer)
  if(map.getSource('vn-gps')){
    map.getSource('vn-gps').setData({type:'Feature',geometry:{type:'Point',coordinates:now},properties:{bearing:naviBearing}});
  }

  // Ridden track
  if(map.getSource('vn-ridden') && naviRouteIdx >= 1){
    map.getSource('vn-ridden').setData({
      type:'Feature',
      geometry:{type:'LineString',coordinates:fullRoute.coords.slice(0,naviRouteIdx+1)}
    });
  }

  // Speed display (jetzt im oberen HUD)
  const kmh = (speed != null && speed >= 0) ? Math.round(speed * 3.6) : null;
  const speedEl = document.getElementById('navi-speed');
  if(speedEl) speedEl.textContent = kmh !== null ? `${kmh}` : '—';

  // ── CAMERA FOLLOW ─────────────────────────────────
  // Follow if: user hasn't touched the map, OR 20s have passed since last touch
  const sinceTouch = nowTime - naviUserLastTouch;
  const shouldFollow = naviUserLastTouch === 0 || sinceTouch >= NAVI_RETURN_MS;

  if(shouldFollow){
    // Snap back mode label if we were in explore mode
    if(naviViewMode !== 0){
      naviViewMode = 0;
      updateNaviViewBtn();
      if(naviUserLastTouch > 0) showToast('↩ Navi-Ansicht wiederhergestellt');
    }
    map.easeTo({center:now, zoom:16.5, pitch:62, bearing:naviBearing, duration:600, easing:t=>t});
  }
}

function naviNearestIdx(pos){
  const coords = fullRoute.coords;
  if(!coords.length) return 0;
  let minD = Infinity, minI = naviRouteIdx;
  const start = Math.max(0, naviRouteIdx - 30);
  const end   = Math.min(coords.length - 1, naviRouteIdx + 120);
  for(let i = start; i <= end; i++){
    const d = haversineM(pos, coords[i]);
    if(d < minD){ minD = d; minI = i; }
  }
  return minI;
}

/* ---------- UI TICK (every 1s) ---------- */
function naviTickUI(){
  if(!naviActive) return;

  // Elapsed time
  const elapsedSec = Math.floor((Date.now() - naviStartTime) / 1000);
  const h = Math.floor(elapsedSec / 3600);
  const m = Math.floor((elapsedSec % 3600) / 60);
  const s = elapsedSec % 60;
  const elStr = h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`;
  setEl('navi-elapsed', elStr);

  // Distances
  const remainM = Math.max(0, fullRoute.dist - naviRiddenM);
  setEl('navi-remain', (remainM / 1000).toFixed(1));
  setEl('navi-ridden', (naviRiddenM / 1000).toFixed(1));
  setEl('navi-climb',  Math.round(naviClimbM));

  // Calories: ~40 kcal/km (moderate cycling)
  const kcal = Math.round((naviRiddenM / 1000) * 40);
  setEl('navi-cal-hud', kcal);
}

let naviFabViewState = 0; // 0=follow, 1=full route

function cycleNaviViewFab(){
  naviFabViewState = naviFabViewState === 0 ? 1 : 0;
  const btn = document.getElementById('navi-view-fab');
  if(naviFabViewState === 1){
    // Show full route
    naviUserLastTouch = Date.now();
    mapFitRoute();
    map.easeTo({pitch:0, bearing:0, duration:800});
    if(btn) btn.textContent = '📍';
    naviViewMode = 3;
    updateNaviViewBtn();
  } else {
    // Snap back to follow
    naviUserLastTouch = 0;
    naviViewMode = 0;
    updateNaviViewBtn();
    if(btn) btn.textContent = '🗺';
    if(naviLastPos){
      map.easeTo({center:naviLastPos, zoom:16.5, pitch:62, bearing:naviBearing, duration:800, easing:t=>t});
    }
  }
  naviShowUI();
}
function cycleNaviView(){
  naviViewMode = (naviViewMode + 1) % 4;
  updateNaviViewBtn();
  naviShowUI();

  if(naviViewMode === 0){
    // Manual return to follow — reset touch timer so follow starts immediately
    naviUserLastTouch = 0;
  } else if(naviViewMode === 2){
    naviUserLastTouch = Date.now();
    const segStart = Math.max(0, naviRouteIdx - 20);
    const segEnd   = Math.min(fullRoute.coords.length-1, naviRouteIdx + 100);
    const seg      = fullRoute.coords.slice(segStart, segEnd+1);
    if(seg.length >= 2){
      const bounds = seg.reduce((b,c)=>b.extend(c), new maplibregl.LngLatBounds(seg[0],seg[0]));
      map.fitBounds(bounds,{padding:70, pitch:20, bearing:0, duration:1000});
    }
  } else if(naviViewMode === 3){
    naviUserLastTouch = Date.now();
    mapFitRoute();
    map.easeTo({pitch:0, bearing:0, duration:1000});
  } else {
    naviUserLastTouch = Date.now();
  }
}

function naviScheduleReturn(){ /* no-op: handled by timestamp in naviOnPosition */ }

function updateNaviViewBtn(){
  const btn = document.getElementById('navi-view-btn');
  if(btn) btn.textContent = NAVI_VIEW_LABELS[naviViewMode];
}

/* ---------- BEARING ---------- */
function calcBearing(from, to){
  const dLng = (to[0]-from[0]) * Math.PI/180;
  const lat1 = from[1] * Math.PI/180;
  const lat2 = to[1]   * Math.PI/180;
  const y = Math.sin(dLng)*Math.cos(lat2);
  const x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLng);
  return (Math.atan2(y,x)*180/Math.PI + 360) % 360;
}

/* ---------- ZOOM ---------- */
function naviZoom(dir){
  map.easeTo({zoom: map.getZoom()+dir, duration:300});
  naviShowUI();
}

/* ---------- UI AUTO-HIDE ---------- */
function naviShowUI(){
  clearTimeout(naviHideTimer);
  ['navi-top','navi-zoom','navi-speed-bubble','navi-bottom'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.style.opacity='1'; el.style.pointerEvents='auto'; }
  });
  naviStartAutoHide();
}

function naviStartAutoHide(){
  clearTimeout(naviHideTimer);
  naviHideTimer = setTimeout(()=>{
    ['navi-top','navi-zoom','navi-speed-bubble','navi-bottom'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){ el.style.opacity='0'; el.style.pointerEvents='none'; }
    });
  }, 20000);
}

// Re-show UI on any touch/click inside the overlay
document.addEventListener('DOMContentLoaded', ()=>{
  const overlay = document.getElementById('navi-overlay');
  if(overlay){
    overlay.addEventListener('touchstart', naviShowUI, {passive:true});
    overlay.addEventListener('click', naviShowUI, {passive:true});
  }

  // HUD tap just shows UI — no bottom sheet pop-up during navi

  // ── MOBILE: Bottom-Sheet Swipe Gesten (3 Zustände) ──────────────
  // collapsed(0) ↔ expanded(1) ↔ maximized(2)
  // REGEL: Hochschieben (vergrößern) NUR vom Handle oder Peek-Leiste aus.
  // Body-Swipe nach OBEN ist deaktiviert (passiert zu leicht beim Scrollen).
  // Body-Swipe nach UNTEN (minimieren) bleibt wie gehabt.
  const handle  = document.getElementById('sh-handle');
  const bsheet  = document.getElementById('bsheet');
  if(handle && bsheet){
    let swY = 0, swX = 0, swFrom = null;
    let swScrollTop = 0;

    const activeScrollTop = () => {
      const pane = bsheet.querySelector('.sh-pane.on');
      return pane ? pane.scrollTop : 0;
    };

    const swStart = (from) => (e) => {
      if(e.touches.length > 1) return;
      if(from === 'body' && sheetState === 0) return;
      swY    = e.touches[0].clientY;
      swX    = e.touches[0].clientX;
      swFrom = from;
      swScrollTop = activeScrollTop();
    };

    const swEnd = (e) => {
      if(!swFrom) return;
      const dy  = e.changedTouches[0].clientY - swY;
      const dx  = e.changedTouches[0].clientX - swX;
      const src = swFrom;
      swFrom = null;

      // Muss mehr vertikal als horizontal sein
      if(Math.abs(dy) <= Math.abs(dx)) return;

      if(src === 'handle' || src === 'peek'){
        // Handle / Peek: auf/zu toggle, 30px reichen
        if(dy < -30)      setSheetState(1); // rauf → öffnen
        else if(dy > 30)  setSheetState(0); // runter → schließen
      } else {
        // Body: NUR runter (minimieren) erlaubt — kein versehentliches Öffnen
        // beim Scrollen von Inhalten
        if(dy <= 0) return; // nach oben ignorieren
        const threshold = 90;
        if(dy < threshold) return;
        if(swScrollTop > 8) return; // User scrollt Inhalt → ignorieren
        setSheetState(0);
      }
    };

    handle.addEventListener('touchstart', swStart('handle'), {passive:true});
    handle.addEventListener('touchend',   swEnd,             {passive:true});

    const peek = document.getElementById('sh-peek');
    if(peek){
      peek.addEventListener('touchstart', swStart('peek'), {passive:true});
      peek.addEventListener('touchend',   swEnd,           {passive:true});
    }

    bsheet.addEventListener('touchstart', swStart('body'), {passive:true});
    bsheet.addEventListener('touchend',   swEnd,           {passive:true});
  }

  // ── iOS Safari Shake-to-Undo: vollständig deaktivieren ──
  // Capture-Phase: blockiert das Ereignis bevor irgendein Handler es bekommt
  document.addEventListener('beforeinput', e => {
    if(e.inputType === 'historyUndo' || e.inputType === 'historyRedo'){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  // Zusätzlich: alle Inputs readonly während Navi, damit kein Undo-Stack entsteht
  document.addEventListener('visibilitychange', () => {
    if(naviActive) document.querySelectorAll('input,textarea').forEach(el=>{try{el.blur();}catch(e){}});
  });
});

/* ---------- BACKGROUND / VISIBILITY ---------- */
document.addEventListener('visibilitychange', ()=>{
  if(!naviActive) return;
  if(!document.hidden){
    // Re-request wake lock after coming back to foreground
    if('wakeLock' in navigator && !naviWakeLock){
      navigator.wakeLock.request('screen').then(l=>{ naviWakeLock=l; }).catch(()=>{});
    }
    // ── Stats aus Routengeometrie nachberechnen ──────────
    // (GPS läuft im Hintergrund nicht → Distanz/Aufstieg aus
    //  Route + aktueller Position rekonstruieren)
    naviRecoverStatsFromRoute();
  }
});

// ══════════════════════════════════════════════════
// iOS SAFARI: SHAKE-TO-UNDO komplett deaktivieren
// ══════════════════════════════════════════════════
// 1) Blockt historyUndo/historyRedo bevor iOS den Dialog zeigen kann
document.addEventListener('beforeinput', e => {
  if(e.inputType === 'historyUndo' || e.inputType === 'historyRedo'){
    e.preventDefault(); e.stopImmediatePropagation();
  }
}, true);
// 2) Schüttelgeste per DeviceMotion abfangen → sofort alle Inputs blur()
//    (iOS zeigt den Widerrufen-Dialog nur wenn ein Textfeld fokussiert ist)
(function(){
  let _last=0, _prev={x:0,y:0,z:0};
  window.addEventListener('devicemotion', e=>{
    const a=e.accelerationIncludingGravity; if(!a) return;
    const dx=Math.abs((a.x||0)-_prev.x), dy=Math.abs((a.y||0)-_prev.y), dz=Math.abs((a.z||0)-_prev.z);
    _prev={x:a.x||0,y:a.y||0,z:a.z||0};
    if(dx+dy+dz>20){
      const now=Date.now(); if(now-_last<700) return; _last=now;
      document.querySelectorAll('input,textarea').forEach(el=>{try{el.blur();}catch(ex){}});
      try{document.activeElement?.blur();}catch(ex){}
    }
  },{passive:true});
})();

// ══════════════════════════════════════════════════
// DESKTOP SEARCH (sidebar)
// ══════════════════════════════════════════════════
let srchDeskTimer = null;
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('srch-inp-desk');
  const clr = document.getElementById('srch-clear-desk');
  const drop = document.getElementById('srch-drop-desk');
  if(!inp) return;

  inp.addEventListener('input', e => {
    const v = e.target.value.trim();
    clr.style.display = v ? 'block' : 'none';
    clearTimeout(srchDeskTimer);
    if(v.length < 2){ drop.style.display='none'; return; }
    srchDeskTimer = setTimeout(() => doSearchDesk(v), 420);
  });
  inp.addEventListener('keydown', e => { if(e.key==='Escape') clearSearchDesk(); });
});

async function doSearchDesk(q){
  try {
    const bias = map ? `&viewbox=${map.getCenter().lng-1},${map.getCenter().lat+1},${map.getCenter().lng+1},${map.getCenter().lat-1}&bounded=0` : '';
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&accept-language=de&addressdetails=1${bias}`);
    const data = await res.json();
    const drop = document.getElementById('srch-drop-desk');
    if(!data.length){ drop.innerHTML='<div class="sr-item" style="color:var(--muted)"><span class="sr-pin">🔍</span><div><div class="sr-name">Keine Ergebnisse</div></div></div>'; drop.style.display='block'; return; }
    drop.innerHTML = data.map(r => {
      const name = r.display_name.split(',')[0];
      const sub  = r.display_name.split(',').slice(1,3).join(',').trim();
      const icon = r.type==='street'||r.type==='road'?'🛣️':r.class==='place'?'📍':r.class==='natural'?'🌳':'📌';
      return `<div class="sr-item" onclick="selectResultDesk(${r.lat},${r.lon},'${name.replace(/'/g,"\\'")}')">
        <span class="sr-pin">${icon}</span>
        <div style="min-width:0"><div class="sr-name">${name}</div><div class="sr-sub">${sub}</div></div>
      </div>`;
    }).join('');
    drop.style.display='block';
  } catch(e){}
}

function clearSearchDesk(){
  const inp = document.getElementById('srch-inp-desk');
  const clr = document.getElementById('srch-clear-desk');
  const drop = document.getElementById('srch-drop-desk');
  if(inp) inp.value='';
  if(clr) clr.style.display='none';
  if(drop) drop.style.display='none';
}

function selectResultDesk(lat, lng, name){
  clearSearchDesk();
  lat=parseFloat(lat); lng=parseFloat(lng);
  map.flyTo({center:[lng,lat],zoom:14,speed:1.8});
  if(searchPin) searchPin.remove();
  searchPin = new maplibregl.Marker({color:'#ff3d6b'}).setLngLat([lng,lat]).addTo(map);
  const popup = new maplibregl.Popup({closeButton:false,offset:30,anchor:'bottom'})
    .setHTML(`<div style="font-family:var(--font);text-align:center;padding:5px;">
      <div style="margin-bottom:8px;font-size:14px;font-weight:600">${name}</div>
      <button class="btn ok" style="width:100%;margin-bottom:5px;justify-content:center" onclick="addWpFromSearch(${lng},${lat})">📍 Als Wegpunkt</button>
      <button class="btn danger" style="width:100%;justify-content:center" onclick="clearSearchPin()">✕</button>
    </div>`);
  searchPin.setPopup(popup).togglePopup();
}

// ══════════════════════════════════════════════════
// OSM CYCLING ROUTES IMPORT (Overpass API)
// ══════════════════════════════════════════════════
let osmRoutesData = [];
let selectedOsmRoute = null;

async function loadOsmRoutes(){
  if(!map) return;
  const isMob = window.innerWidth <= 860;
  const panel = document.getElementById(isMob ? 'mob-osm-panel' : 'osm-routes-panel');
  const list  = document.getElementById(isMob ? 'mob-osm-list' : 'osm-routes-list');
  if(!panel||!list) return;
  panel.style.display = 'block';
  list.innerHTML = '<div class="wp-empty" style="padding:12px 0;"><div class="spin" style="margin:0 auto 8px;"></div>Lade Fahrradrouten…</div>';

  if(isMob) {
    // Sheet aufklappen, aber im Route-Tab bleiben
    if(!sheetExpanded){ setSheetState(1); }
  }

  const b = map.getBounds();
  const bbox = `${b.getSouth().toFixed(4)},${b.getWest().toFixed(4)},${b.getNorth().toFixed(4)},${b.getEast().toFixed(4)}`;
  const query = `[out:json][timeout:60];(relation["type"="route"]["route"~"bicycle|mtb"](${bbox}););out body geom;`;

  try {
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    if(!res.ok) throw new Error('Overpass-Fehler');
    const data = await res.json();
    osmRoutesData = (data.elements||[]).filter(e => e.type==='relation' && e.members);

    if(!osmRoutesData.length){
      list.innerHTML = '<div class="wp-empty" style="padding:12px 0;">Keine Routen im aktuellen Bereich.</div>';
      return;
    }

    // Show routes on map + start-point pins
    renderOsmRoutes(osmRoutesData);

    // Render list with numbers
    const colors = ['#e040fb','#ff6d00','#00e5ff','#69f0ae','#ffea00','#ff1744','#40c4ff'];
    list.innerHTML = osmRoutesData.slice(0,20).map((r,i)=>{
      const tags = r.tags||{};
      const name = tags.name || tags.ref || `Route ${i+1}`;
      const type = tags.route === 'mtb' ? 'MTB' : 'Rad';
      const dist = tags.distance ? `${parseFloat(tags.distance).toFixed(0)} km` : '';
      const col = colors[i % colors.length];
      return `<div class="osm-route-item" id="osm-ri-${r.id}" onclick="selectOsmRoute(${r.id})">
        <div class="osm-num" style="background:${col}">${i+1}</div>
        <div class="osm-route-info">
          <div class="osm-route-name">${name}</div>
          <div class="osm-route-meta">${type}${dist?' · '+dist:''}</div>
        </div>
        <button class="osm-route-use" onclick="useOsmRoute(event,${r.id})">Route nutzen</button>
      </div>`;
    }).join('');
  } catch(err){
    list.innerHTML = `<div class="wp-empty" style="padding:12px 0;color:var(--red)">Fehler: ${err.message}</div>`;
  }
}

function renderOsmRoutes(routes){
  if(!map.getSource('vn-osm-routes')) map.addSource('vn-osm-routes',{type:'geojson',data:emptyFC()});
  if(!map.getLayer('vn-osm-routes')) map.addLayer({
    id:'vn-osm-routes',type:'line',source:'vn-osm-routes',
    paint:{'line-color':['get','color'],'line-width':3,'line-opacity':0.7},
    layout:{'line-join':'round','line-cap':'round'}
  },'route-segs');

  const colors = ['#e040fb','#ff6d00','#00e5ff','#69f0ae','#ffea00','#ff1744','#40c4ff'];
  const features = [];

  // Remove old OSM pins
  osmPinMarkers.forEach(m => m.remove());
  osmPinMarkers = [];

  routes.slice(0,20).forEach((r,i) => {
    const col = colors[i % colors.length];

    // Collect all way coordinates
    const ways = (r.members||[]).filter(m=>m.type==='way'&&m.geometry);
    ways.forEach(m=>{
      const coords = m.geometry.map(p=>[p.lon,p.lat]);
      if(coords.length>=2) features.push({type:'Feature',properties:{color:col,routeId:r.id},geometry:{type:'LineString',coordinates:coords}});
    });

    // Start-point pin
    const firstWay = ways[0];
    if(!firstWay || !firstWay.geometry.length) return;
    const startPt = [firstWay.geometry[0].lon, firstWay.geometry[0].lat];
    const tags = r.tags||{};

    const el = document.createElement('div');
    el.className = 'osm-pin-wrap';
    el.innerHTML = makePinSVG(col, i+1, 30);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelector('.maplibregl-popup')?.remove();
      showOsmRoutePopup(r, i, col, startPt);
    });
    const marker = new maplibregl.Marker({element:el, anchor:'bottom'})
      .setLngLat(startPt)
      .addTo(map);
    osmPinMarkers.push(marker);
  });

  map.getSource('vn-osm-routes').setData({type:'FeatureCollection',features});
}

function osmDifficulty(tags){
  const diff = (tags.mtb_scale||tags['mtb:scale']||tags.difficulty||tags.osmc_symbol||'').toLowerCase();
  if(/[3-9]|advanced|hard|expert|schwer/.test(diff)) return {label:'Schwer',color:'#ff3d6b'};
  if(/[12]|moderate|mittel/.test(diff))              return {label:'Mittel', color:'#ffd600'};
  return {label:'Leicht', color:'#00e676'};
}

function showOsmRoutePopup(r, idx, col, lngLat){
  const tags   = r.tags||{};
  const name   = tags.name || tags.ref || `Route ${idx+1}`;
  const type   = tags.route === 'mtb' ? '🚵 MTB' : '🚴 Radroute';
  const distKm = tags.distance ? `${parseFloat(tags.distance).toFixed(1)} km` : '—';
  const elevM  = tags['ascent']||tags['ele:gain']||tags.ascent || null;
  const elevStr= elevM ? `${Math.round(parseFloat(elevM))} m` : '—';
  // Estimated duration at 15 km/h
  const durStr = tags.distance ? fmtTime((parseFloat(tags.distance)/15)*3600) : '—';
  const diff   = osmDifficulty(tags);
  const net    = tags.network||tags.ref||'';

  new maplibregl.Popup({closeButton:false, anchor:'bottom', offset:10, maxWidth:'260px'})
    .setLngLat(lngLat)
    .setHTML(`
      <div style="position:relative;font-family:var(--font);min-width:220px;padding-top:6px;">
        <div class="popup-x" onclick="document.querySelector('.maplibregl-popup')?.remove()">✕</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="width:26px;height:26px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#000;flex-shrink:0;">${idx+1}</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.25;">${name}</div>
            <div style="font-size:10px;color:var(--dim);margin-top:1px;">${type}${net?' · '+net:''}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:10px;">
          <div style="background:var(--glass-lite);border:1px solid var(--border);border-radius:var(--r-sm);padding:6px 8px;">
            <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;">Strecke</div>
            <div style="font-size:14px;font-weight:700;color:var(--text);margin-top:2px;">${distKm}</div>
          </div>
          <div style="background:var(--glass-lite);border:1px solid var(--border);border-radius:var(--r-sm);padding:6px 8px;">
            <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;">Höhenmeter</div>
            <div style="font-size:14px;font-weight:700;color:var(--text);margin-top:2px;">${elevStr}</div>
          </div>
          <div style="background:var(--glass-lite);border:1px solid var(--border);border-radius:var(--r-sm);padding:6px 8px;">
            <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;">Dauer</div>
            <div style="font-size:14px;font-weight:700;color:var(--text);margin-top:2px;">${durStr}</div>
          </div>
          <div style="background:var(--glass-lite);border:1px solid var(--border);border-radius:var(--r-sm);padding:6px 8px;">
            <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;">Schwierigkeit</div>
            <div style="font-size:13px;font-weight:700;color:${diff.color};margin-top:2px;">${diff.label}</div>
          </div>
        </div>
        <button class="btn ok" style="width:100%;justify-content:center;padding:8px;font-size:12px;" onclick="document.querySelector('.maplibregl-popup')?.remove();useOsmRouteById(${r.id})">📍 Diese Route wählen</button>
      </div>
    `).addTo(map);
}

function selectOsmRoute(id){
  selectedOsmRoute = id;
  document.querySelectorAll('.osm-route-item').forEach(el=>el.classList.remove('selected'));
  const el = document.getElementById(`osm-ri-${id}`);
  if(el) el.classList.add('selected');
}

async function useOsmRoute(event, id){
  if(typeof event?.stopPropagation === 'function') event.stopPropagation();
  document.querySelector('.maplibregl-popup')?.remove();
  const route = osmRoutesData.find(r=>r.id===id);
  if(!route) return;

  const coords = [];
  (route.members||[]).filter(m=>m.type==='way'&&m.geometry).forEach(m=>{
    m.geometry.forEach(p=>coords.push([p.lon,p.lat]));
  });
  if(coords.length < 2){ showToast('Route hat keine verwertbaren Koordinaten'); return; }

  // Sample ~12 waypoints evenly along the route
  const maxWp = 12;
  const step = Math.max(1, Math.floor(coords.length / maxWp));
  clearAll();
  const sampled = [];
  for(let i=0; i<coords.length; i+=step) sampled.push(coords[i]);
  if(sampled[sampled.length-1] !== coords[coords.length-1]) sampled.push(coords[coords.length-1]);

  sampled.forEach((c,i)=>waypoints.push({lng:c[0],lat:c[1],label:`P${i+1}`,hidden:false,manualLine:false,customCoords:null}));
  renderWpMarkers(); renderWpList();
  if(waypoints.length>=2){ 
    map.flyTo({center:waypoints[0].lng?[waypoints[0].lng,waypoints[0].lat]:[waypoints[0][0],waypoints[0][1]],zoom:11});
    await rerouteAll(); 
    mapFitRoute(); 
  }
  showToast(`✓ OSM-Route geladen: ${route.tags?.name||'Route'}`);
  clearOsmRoutes();
}

async function useOsmRouteById(id){
  await useOsmRoute({stopPropagation:()=>{}}, id);
}

function clearOsmRoutes(){
  document.getElementById('osm-routes-panel').style.display='none';
  const mobPanel = document.getElementById('mob-osm-panel');
  if(mobPanel) mobPanel.style.display='none';
  if(map.getLayer('vn-osm-routes')) map.setLayoutProperty('vn-osm-routes','visibility','none');
  osmPinMarkers.forEach(m => m.remove());
  osmPinMarkers = [];
  osmRoutesData=[];
}


let pulseReqId = null;

function startPulseAnimation(routeCoordinates){
  if(pulseReqId){ cancelAnimationFrame(pulseReqId); pulseReqId=null; }
  if(!routeCoordinates||routeCoordinates.length<2) return;

  if(!map.getSource('vn-pulse')){
    map.addSource('vn-pulse',{type:'geojson',data:{type:'Feature',geometry:{type:'Point',coordinates:routeCoordinates[0]}}});
    map.addLayer({id:'vn-pulse-layer',type:'circle',source:'vn-pulse',paint:{
      'circle-radius':6,'circle-color':'#00ffcc','circle-opacity':0.85,
      'circle-pitch-alignment':'map',
      'circle-stroke-width':2,'circle-stroke-color':'#ffffff'
    }});
  }

  let progress = 0;
  const speed  = 0.0015;

  function tick(){
    progress += speed;
    if(progress >= 1) progress = 0;
    const idx   = progress * (routeCoordinates.length-1);
    const lo    = Math.floor(idx), hi = Math.ceil(idx);
    const w     = idx - lo;
    if(routeCoordinates[lo] && routeCoordinates[hi]){
      map.getSource('vn-pulse').setData({type:'Feature',geometry:{type:'Point',coordinates:[
        routeCoordinates[lo][0]*(1-w)+routeCoordinates[hi][0]*w,
        routeCoordinates[lo][1]*(1-w)+routeCoordinates[hi][1]*w
      ]}});
    }
    pulseReqId = requestAnimationFrame(tick);
  }
  tick();
}

// ══════════════════════════════════════════════════
// NAVI ERWEITERUNGEN
// ══════════════════════════════════════════════════

/* ── PRE-ROUTE: vom aktuellen Ort zum 1. Wegpunkt ── */
async function naviShowPreRoute(lng, lat, tLng, tLat, distM){
  // Layer anlegen falls nicht vorhanden
  if(!map.getSource('vn-pre-rt')){
    map.addSource('vn-pre-rt',{type:'geojson',data:emptyFC()});
    map.addLayer({id:'vn-pre-rt-bg',type:'line',source:'vn-pre-rt',
      paint:{'line-color':'rgba(0,0,0,.35)','line-width':5,'line-blur':4},
      layout:{'line-join':'round','line-cap':'round'}});
    map.addLayer({id:'vn-pre-rt',type:'line',source:'vn-pre-rt',
      paint:{'line-color':'#ffd600','line-width':3,'line-dasharray':[2,3],'line-opacity':.85},
      layout:{'line-join':'round','line-cap':'round'}});
    naviPreRouteAdded = true;
  }
  showToast(`📍 ${distM>999?(distM/1000).toFixed(1)+' km':Math.round(distM)+' m'} bis zum Start`);
  try {
    const url = `https://brouter.de/brouter?lonlats=${lng},${lat}|${tLng},${tLat}&profile=${brouterProfile}&alternativeidx=0&format=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if(data.features?.length) map.getSource('vn-pre-rt').setData(data.features[0].geometry);
    else throw new Error('no features');
  } catch(e){
    // Fallback: Luftlinie
    map.getSource('vn-pre-rt').setData({type:'LineString',coordinates:[[lng,lat],[tLng,tLat]]});
  }
  // Pre-Route nach 90s oder wenn nahe genug automatisch ausblenden
  setTimeout(()=>{
    if(map.getSource('vn-pre-rt')) map.getSource('vn-pre-rt').setData(emptyFC());
  }, 90000);
}

/* ── WAYPOINT-PASSAGE ERKENNUNG ─────────────────── */
function naviCheckWpPassage(now){
  if(!waypoints.length) return;

  // Nur den NÄCHSTEN noch nicht passierten Wegpunkt prüfen (sequenziell).
  // Das verhindert, dass bei Rundtouren (Start ≈ Ziel) oder dicht
  // beieinander liegenden Pins mehrere WPs gleichzeitig anschlagen.
  let nextIdx = -1;
  for(let i = 0; i < waypoints.length; i++){
    if(!naviPassedWps.has(i)){ nextIdx = i; break; }
  }
  if(nextIdx === -1) return; // alle passiert

  const wp     = waypoints[nextIdx];
  const d      = haversineM([wp.lng, wp.lat], now);
  const thresh = 45 + (naviRiddenM > 100 ? 20 : 0);
  if(d > thresh) return;

  // Letzten WP (Ziel) erst auslösen wenn ≥ 85 % der Strecke gefahren.
  // Das schützt vor Frühauslösung bei Rundtouren (Start ≈ Ziel).
  if(nextIdx === waypoints.length - 1 && waypoints.length > 1){
    const minRidden = Math.max(100, fullRoute.dist * 0.85);
    if(naviRiddenM < minRidden) return;
  }

  naviPassedWps.add(nextIdx);
  if(nextIdx === waypoints.length - 1){
    setTimeout(() => showNaviFinish(), 1200);
  } else {
    naviOnWpPassed(nextIdx);
  }
}

function naviOnWpPassed(i){
  const wp = waypoints[i];
  // Konfetti an der Pin-Position
  const pt = map.project([wp.lng, wp.lat]);
  const rect = map.getCanvas().getBoundingClientRect();
  triggerConfetti(pt.x + rect.left, pt.y + rect.top, 38);
  // Marker orange + Pulsieren
  naviMarkWpPassed(i);
  // Popup mit Etappen-Stats
  showWpPassPopup(i);
}

function naviMarkWpPassed(i){
  const marker = wpMarkers.find(m => m._wpIdx === i);
  if(!marker) return;
  const el = marker.getElement();
  if(!el) return;
  // Pin-SVG komplett mit Orange neu rendern – Form & Zahl bleiben identisch
  const inner = el.querySelector('.wp-pin-inner');
  if(inner) inner.innerHTML = makePinSVG('#ff9100', i + 1);
  el.classList.add('wp-pin-passed');
}

function showWpPassPopup(i){
  document.querySelector('.navi-wp-pass-popup')?.remove();
  const wp = waypoints[i];

  // ── Startpunkt: persönliche Begrüßung ──
  if(i === 0){
    const name = currentUser?.name?.split(' ')[0] || currentUser?.name || null;
    const greet = name ? `Gute Fahrt und viel Spass, ${name}!` : 'Gute Fahrt und viel Spass!';
    new maplibregl.Popup({closeButton:false, anchor:'bottom', offset:[60,-32], maxWidth:'200px', className:'navi-wp-pass-popup'})
      .setLngLat([wp.lng, wp.lat])
      .setHTML(`<div class="navi-popup-body" style="font-family:var(--font);padding:2px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span style="font-size:13px;font-weight:800;color:#00e676;letter-spacing:.03em;">🚴 ${greet}</span>
          <button onclick="document.querySelector('.navi-wp-pass-popup')?.remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;line-height:1;padding:0 2px;flex-shrink:0;">✕</button>
        </div>
      </div>`)
      .addTo(map);
    setTimeout(() => document.querySelector('.navi-wp-pass-popup')?.remove(), 9000);
    return;
  }

  // ── Regulärer Wegpunkt ──
  const distKm = (naviRiddenM / 1000).toFixed(1);
  const upM    = Math.round(naviClimbM);
  const elapsedSec = Math.floor((Date.now() - naviStartTime) / 1000);
  const avgKmh = elapsedSec > 0 ? ((naviRiddenM/1000) / (elapsedSec/3600)).toFixed(1) : '—';
  const label  = `WP ${i + 1}`;
  new maplibregl.Popup({closeButton:false, anchor:'bottom', offset:[60,-32], maxWidth:'190px', className:'navi-wp-pass-popup'})
    .setLngLat([wp.lng, wp.lat])
    .setHTML(`<div class="navi-popup-body" style="font-family:var(--font);padding:2px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
        <span style="font-size:11px;font-weight:800;color:#ffd600;letter-spacing:.05em;">🏁 ${label} erreicht!</span>
        <button onclick="document.querySelector('.navi-wp-pass-popup')?.remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;line-height:1;padding:0 2px;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
        <div style="background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);border-radius:6px;padding:5px 7px;">
          <div style="font-size:15px;font-weight:700;color:var(--accent);">${distKm}</div>
          <div style="font-size:8px;color:var(--muted);">km gefahren</div>
        </div>
        <div style="background:rgba(255,61,107,.08);border:1px solid rgba(255,61,107,.2);border-radius:6px;padding:5px 7px;">
          <div style="font-size:15px;font-weight:700;color:var(--red);">${upM}</div>
          <div style="font-size:8px;color:var(--muted);">hm ↑</div>
        </div>
        <div style="background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.2);border-radius:6px;padding:5px 7px;">
          <div style="font-size:15px;font-weight:700;color:var(--green);">${fmtTime(elapsedSec)}</div>
          <div style="font-size:8px;color:var(--muted);">Zeit</div>
        </div>
        <div style="background:rgba(255,214,0,.08);border:1px solid rgba(255,214,0,.2);border-radius:6px;padding:5px 7px;">
          <div style="font-size:15px;font-weight:700;color:var(--yellow);">${avgKmh}</div>
          <div style="font-size:8px;color:var(--muted);">Ø km/h</div>
        </div>
      </div>
    </div>`)
    .addTo(map);
  setTimeout(() => document.querySelector('.navi-wp-pass-popup')?.remove(), 12000);
}

/* ── KONFETTI ────────────────────────────────────── */
function triggerConfetti(cx, cy, count=36){
  const canvas = document.createElement('canvas');
  canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9200;';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const cols = ['#ffd600','#ff9100','#00d4ff','#00e676','#ff3d6b','#fff','#a855f7'];
  const parts = Array.from({length:count},()=>({
    x:cx, y:cy,
    vx:(Math.random()-0.5)*10,
    vy:(Math.random()*-9)-1,
    r:Math.random()*4+1.5,
    col:cols[Math.floor(Math.random()*cols.length)],
    a:1, rot:Math.random()*Math.PI*2, rv:(Math.random()-.5)*.25
  }));
  let fr = 0;
  function tick(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    parts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.28; p.vx*=.97; p.rot+=p.rv; p.a-=.016;
      if(p.a<=0) return;
      ctx.save(); ctx.globalAlpha=Math.max(0,p.a);
      ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle=p.col; ctx.fillRect(-p.r,-p.r*.45,p.r*2,p.r*.9);
      ctx.restore();
    });
    fr++;
    if(fr<130&&parts.some(p=>p.a>0)) requestAnimationFrame(tick); else canvas.remove();
  }
  tick();
}

/* ── STATS-WIEDERHERSTELLUNG NACH BILDSCHIRM-AUS ── */
function naviRecoverStatsFromRoute(){
  const coords = fullRoute.coords;
  const elevs  = fullRoute.elevs;
  if(!coords.length || naviRouteIdx < 1) return;
  // Distanz aus Routengeometrie bis zum letzten bekannten Index
  let dist = 0;
  for(let i=0; i<Math.min(naviRouteIdx, coords.length-1); i++){
    dist += haversineM(coords[i], coords[i+1]);
  }
  if(dist > naviRiddenM) naviRiddenM = dist;
  // Aufstieg aus Routenhöhenprofil
  let up = 0;
  for(let i=0; i<Math.min(naviRouteIdx, elevs.length-1); i++){
    const de = (elevs[i+1]||0) - (elevs[i]||0);
    if(de > 0) up += de;
  }
  if(up > naviClimbM) naviClimbM = up;
}

/* ── ZIEL-MODAL ──────────────────────────────────── */
function showNaviFinish(){
  const elapsedSec = Math.floor((Date.now() - naviStartTime) / 1000);
  const distKm     = (naviRiddenM / 1000).toFixed(2);
  const avgKmh     = elapsedSec > 0 ? ((naviRiddenM/1000)/(elapsedSec/3600)).toFixed(1) : '—';
  const w          = parseFloat(document.getElementById('weight-inp')?.value||75);
  const cal        = calcCalories(naviRiddenM, naviClimbM, w, parseFloat(avgKmh)||15);

  setEl('nf-dist',  distKm);
  setEl('nf-time',  fmtTime(elapsedSec));
  setEl('nf-climb', Math.round(naviClimbM) + ' m');
  setEl('nf-speed', avgKmh + ' km/h');
  setEl('nf-cal',   cal + ' kcal');
  setEl('nf-wps',   naviPassedWps.size + ' / ' + waypoints.length);

  const modal = document.getElementById('navi-finish-modal');
  modal.classList.add('show');

  // Rein-Zoom + Stopp
  stopNavi(true);
  setTimeout(()=> mapFitRoute(), 800);

  // Konfetti im Modal
  const canvas = document.getElementById('navi-finish-confetti');
  canvas.width  = canvas.offsetWidth  || 380;
  canvas.height = canvas.offsetHeight || 380;
  const ctx = canvas.getContext('2d');
  const cols = ['#ffd600','#ff9100','#00d4ff','#00e676','#ff3d6b','#fff'];
  const parts = Array.from({length:55},()=>({
    x:Math.random()*canvas.width, y:-10,
    vx:(Math.random()-.5)*4, vy:Math.random()*3+1,
    r:Math.random()*4+2, col:cols[Math.floor(Math.random()*cols.length)],
    a:1, rot:Math.random()*Math.PI*2, rv:(Math.random()-.5)*.18
  }));
  let fr=0;
  function tick(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    parts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.rot+=p.rv;
      if(p.y>canvas.height) p.a-=.04; else if(fr>80) p.a-=.008;
      if(p.a<=0) return;
      ctx.save(); ctx.globalAlpha=Math.max(0,p.a);
      ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle=p.col; ctx.fillRect(-p.r,-p.r*.45,p.r*2,p.r*.9);
      ctx.restore();
    });
    fr++;
    if(fr<220&&parts.some(p=>p.a>0)) requestAnimationFrame(tick);
  }
  tick();

  // Statistik speichern (lokal)
  try {
    const saved = JSON.parse(localStorage.getItem('vn_rides')||'[]');
    saved.unshift({date:new Date().toISOString().slice(0,10),km:parseFloat(distKm),hm:Math.round(naviClimbM),time:fmtTime(elapsedSec),cal,avgKmh});
    localStorage.setItem('vn_rides', JSON.stringify(saved.slice(0,50)));
  } catch(e){}

  // ☁️ Cloud-Speicherung falls eingeloggt
  if(typeof window._awSaveRoute === 'function' && typeof window._awCurrentUser === 'function' && window._awCurrentUser()){
    const w = parseFloat(document.getElementById('weight-inp')?.value||75);
    window._awSaveRoute({
      name: `Tour ${new Date().toLocaleDateString('de-DE')}`,
      distance: Math.round(naviRiddenM),
      coordinates: fullRoute.coords.slice(0, 200), // max 200 Punkte
      elevation: Math.round(naviClimbM),
      calories: cal,
      date: new Date().toISOString().slice(0,10),
      weight: w
    });
  }

  // ⏱ Auto-Save Countdown starten
  setTimeout(() => startAutoSave(), 600);
}

/* ── AUTO-SAVE COUNTDOWN ──────────────────────────── */
let _autoSaveTimer = null;

function startAutoSave(){
  let sec = 20;
  const bar   = document.getElementById('nf-autosave-bar');
  const fill  = document.getElementById('nf-autosave-fill');
  const cntEl = document.getElementById('nf-countdown');
  if(!bar) return;
  bar.classList.remove('cancelled');
  if(cntEl) cntEl.textContent = sec;
  if(fill)  fill.style.transition = 'none'; // reset
  if(fill){ fill.style.width = '100%'; void fill.offsetWidth; fill.style.transition = 'width 1s linear'; }

  _autoSaveTimer = setInterval(() => {
    sec--;
    if(cntEl) cntEl.textContent = sec;
    if(fill)  fill.style.width = (sec / 20 * 100) + '%';
    if(sec <= 0){
      clearInterval(_autoSaveTimer);
      _autoSaveTimer = null;
      // Route lokal speichern
      const routeName = `Tour ${new Date().toLocaleDateString('de-DE')} (Auto)`;
      ['save-name-inp','mob-save-inp'].forEach(id => {
        const el = document.getElementById(id);
        if(el && !el.value.trim()) el.value = routeName;
      });
      saveRoute();
      closeNaviFinish();
    }
  }, 1000);
}

window.cancelAutoSave = function(){
  if(_autoSaveTimer){ clearInterval(_autoSaveTimer); _autoSaveTimer = null; }
  const bar   = document.getElementById('nf-autosave-bar');
  const txtEl = document.getElementById('nf-autosave-txt');
  if(bar)   bar.classList.add('cancelled');
  if(txtEl) txtEl.innerHTML = '✕ Auto-Schliessen deaktiviert';
};

function closeNaviFinish(){
  if(_autoSaveTimer){ clearInterval(_autoSaveTimer); _autoSaveTimer = null; }
  document.getElementById('navi-finish-modal').classList.remove('show');
}

/* ══════════════════════════════════════════════════════════
   REC — Strecken-Aufzeichnung
   ══════════════════════════════════════════════════════════ */
let recActive    = false;
let recWatchId   = null;
let recCoords    = [];   // [[lng, lat], …]
let recStartTime = null;
let recDistM     = 0;
let recLastPos   = null;
let recUiTimer   = null;
let recBearing   = 0;

function toggleRec(){
  if(recActive) stopRec();
  else          startRec();
}

function startRec(){
  if(recActive) return;
  if(!navigator.geolocation){ showToast('📍 GPS nicht verfügbar'); return; }

  recActive    = true;
  recCoords    = [];
  recDistM     = 0;
  recLastPos   = null;
  recStartTime = Date.now();

  // Live-Track leeren
  if(map.getSource('vn-rec-live')) map.getSource('vn-rec-live').setData(emptyFC());
  // GPS-Dot einblenden
  if(map.getLayer('vn-gps-dot')) map.setLayoutProperty('vn-gps-dot','visibility','visible');

  updateRecFab();
  showToast('⏺ Aufzeichnung gestartet');

  recWatchId = navigator.geolocation.watchPosition(pos => {
    const {longitude:lng, latitude:lat, speed, heading} = pos.coords;
    const now = [lng, lat];

    if(recLastPos){
      const d = haversineM(recLastPos, now);
      if(d < 200) recDistM += d; // Ausreißer ignorieren
      // Bearing für GPS-Dot
      if(speed != null && speed > 0.3 && heading != null && !isNaN(heading)) recBearing = heading;
      else if(d > 5) recBearing = calcBearing(recLastPos, now);
    }

    recCoords.push(now);
    recLastPos = now;

    // GPS-Dot aktualisieren
    if(map.getSource('vn-gps')){
      map.getSource('vn-gps').setData({type:'Feature',geometry:{type:'Point',coordinates:now},properties:{bearing:recBearing}});
    }

    // Live-Track zeichnen
    if(map.getSource('vn-rec-live') && recCoords.length >= 2){
      map.getSource('vn-rec-live').setData({type:'Feature',geometry:{type:'LineString',coordinates:recCoords}});
    }

    // Karte nachführen
    map.easeTo({center:now, bearing:recBearing, pitch:30, zoom:15.5, duration:700, easing:t=>t});

    updateRecFab();
  }, err => {
    console.warn('REC GPS error:', err.message);
  }, {enableHighAccuracy:true, maximumAge:1000, timeout:10000});

  recUiTimer = setInterval(updateRecFab, 1000);
}

function stopRec(){
  if(!recActive) return;
  recActive = false;
  if(recWatchId !== null){ navigator.geolocation.clearWatch(recWatchId); recWatchId = null; }
  if(recUiTimer){ clearInterval(recUiTimer); recUiTimer = null; }

  // Kamera zurücksetzen
  map.easeTo({pitch:0, bearing:0, duration:800});

  updateRecFab();

  if(recCoords.length < 5){ showToast('⏹ Aufzeichnung zu kurz'); return; }

  saveRecordedRoute();
}

function saveRecordedRoute(){
  const saves    = getSaves();
  const id       = Date.now();
  const now      = new Date();
  const name     = `Aufzeichnung ${now.toLocaleDateString('de-DE')} ${now.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}`;

  // Maximal 500 Punkte speichern (GPS-Tracks können riesig werden)
  const stored   = recCoords.length > 500 ? downsampleCoords(recCoords, 500) : recCoords;
  // Wegpunkte aus Track ableiten (Start + max. 6 Zwischen + Ziel)
  const wps      = coordsToWaypoints(stored, 6);

  saves.push({
    id, name,
    date:   now.toLocaleDateString('de-DE'),
    wps,
    rawCoords: stored,
    isRecording: true,
    stats:  { dist: recDistM, up: 0 }
  });

  if(saves.length > 10) saves.splice(0, saves.length - 10);
  localStorage.setItem('vn_saves', JSON.stringify(saves));
  renderSavesList();
  showToast(`✅ "${name}" gespeichert`);

  // ☁️ Cloud-Speicherung der REC-Strecke
  if(typeof window._awSaveRoute === 'function' && typeof window._awCurrentUser === 'function' && window._awCurrentUser()){
    const wKg = parseFloat(document.getElementById('weight-inp')?.value || 75);
    const distKm = recDistM / 1000;
    const cal = typeof calcCalories === 'function' ? calcCalories(recDistM, 0, wKg, 15) : 0;
    window._awSaveRoute({
      name,
      distance: Math.round(recDistM),
      coordinates: stored.slice(0, 200),
      elevation: 0,
      calories: cal,
      date: now.toISOString().slice(0,10),
      weight: wKg,
      coins: 0
    });
  }
}

/* Gleichmäßig verteilte Wegpunkte aus Koordinaten-Array ableiten */
function coordsToWaypoints(coords, nMid){
  const result = [];
  const labels = ['Start', ...Array.from({length:nMid},(_,i)=>`P${i+1}`), 'Ziel'];
  const total  = nMid + 2;
  for(let i = 0; i < total; i++){
    const idx = Math.round(i * (coords.length - 1) / (total - 1));
    result.push({lat:coords[idx][1], lng:coords[idx][0], label:labels[i]||`P${i}`, hidden:false, manualLine:false, customCoords:null});
  }
  return result;
}

/* Koordinaten-Array gleichmäßig auf n Punkte reduzieren */
function downsampleCoords(coords, n){
  if(coords.length <= n) return coords;
  const result = [];
  for(let i = 0; i < n; i++){
    result.push(coords[Math.round(i * (coords.length - 1) / (n - 1))]);
  }
  return result;
}

function updateRecFab(){
  const btn = document.getElementById('rec-start-fab');
  if(!btn) return;
  const icon = btn.querySelector('.rec-icon');
  const lbl  = btn.querySelector('.rec-lbl');
  const dist = btn.querySelector('.rec-dist');

  if(recActive){
    btn.classList.add('is-recording');
    if(icon) icon.textContent = '⏹';
    if(lbl)  lbl.textContent  = 'STOP';
    if(dist && recStartTime){
      const sec = Math.floor((Date.now() - recStartTime) / 1000);
      const mm  = Math.floor(sec/60).toString().padStart(2,'0');
      const ss  = (sec%60).toString().padStart(2,'0');
      dist.textContent = `${(recDistM/1000).toFixed(1)}km · ${mm}:${ss}`;
    }
  } else {
    btn.classList.remove('is-recording');
    if(icon) icon.textContent = '⏺';
    if(lbl)  lbl.textContent  = 'REC';
    if(dist) dist.textContent = '';
  }
}

/* ══════════════════════════════════════════════════════════ */

/* ── LUCKY: RANDOM ROUTE ─────────────────────────── */
let _randomRouteKm = 15;

window.updateLuckyKm = function(val){
  _randomRouteKm = parseInt(val);
  // Sync both sliders
  const dsk = document.getElementById('lucky-slider');
  const mob = document.getElementById('mob-lucky-slider');
  if(dsk && dsk !== document.activeElement) dsk.value = val;
  if(mob && mob !== document.activeElement) mob.value = val;
  // Update display values
  ['lucky-km-val','mob-lucky-km-val'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = val + ' km';
  });
};

window.generateRandomRoute = function(btnEl){
  if(!navigator.geolocation){ showToast('📍 GPS-Zugriff nicht verfügbar'); return; }

  // Dice spin animation
  if(btnEl){
    const dice = btnEl.querySelector('span[id^="lucky-dice"]');
    if(dice){ dice.classList.remove('lucky-spin'); void dice.offsetWidth; dice.classList.add('lucky-spin'); }
  }

  showToast('🎲 Zufallsroute wird berechnet…');
  document.getElementById('loading').style.display = 'flex';
  setEl('load-txt', '🎲 Zufallsroute…');

  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const targetKm = _randomRouteKm;

    // --- RUNDWEG-LOGIK ---
    // Gesamtumfang ≈ 2πr  →  r = targetKm / (2π)
    // NICHT Durchmesser verwechseln! Wir brauchen den Radius des Kreises,
    // auf dem die Wegpunkte liegen, sodass der Umfang ≈ targetKm ist.
    // Faktor /2 weil BRouter-Routing via Straßen ca. 2× länger ist als Luftlinie.
    const rKm     = targetKm / (2 * Math.PI * 2);
    // Umrechnung in Grad Breite (1° ≈ 111.32 km)
    const rDegLat = rKm / 111.32;
    // Längengrad-Korrektur wegen Breitengrad
    const rDegLon = rDegLat / Math.cos(lat * Math.PI / 180);

    // 4 Wegpunkte mit leichter Zufallsstreuung (neue Route bei jedem Klick)
    const nPts = 4;
    const a0   = Math.random() * Math.PI * 2; // zufälliger Startwinkel

    clearAll();
    // Start = aktueller Standort
    waypoints.push({lat, lng:lon, label:'Start', hidden:false, manualLine:false, customCoords:null});

    for(let i = 0; i < nPts; i++){
      // Gleichmäßig verteilt + kleine Zufallsabweichung im Winkel & Radius
      const angle   = a0 + i * (Math.PI * 2 / nPts) + (Math.random() - 0.5) * 0.55;
      const rFactor = 0.82 + Math.random() * 0.36; // ±18% Radius-Variation
      const wLat = lat + Math.sin(angle) * rDegLat * rFactor;
      const wLon = lon + Math.cos(angle) * rDegLon * rFactor;
      waypoints.push({lat:wLat, lng:wLon, label:`P${i+1}`, hidden:false, manualLine:false, customCoords:null});
    }

    // Ende = Start (Rundweg schließen)
    waypoints.push({lat, lng:lon, label:'Ziel', hidden:false, manualLine:false, customCoords:null});

    renderWpMarkers();
    renderWpList();

    try {
      await rerouteAll();
      mapFitRoute();
      // Switch to Route tab to show waypoints
      if(window.innerWidth <= 860){
        switchSheetTab('st-route', document.querySelectorAll('.sh-tab')[1]);
      } else {
        switchTab('t-route', document.querySelectorAll('.tab-btn')[1]);
      }
      showToast(`🎲 Zufallsroute ~${targetKm} km generiert!`);
    } catch(e){
      showToast('❌ Routing fehlgeschlagen – BRouter erreichbar?');
    }
    document.getElementById('loading').style.display = 'none';
  }, err => {
    document.getElementById('loading').style.display = 'none';
    showToast('📍 GPS-Position nicht verfügbar');
  }, {enableHighAccuracy:true, timeout:9000, maximumAge:15000});
};

function naviFinishShare(){
  const txt = `🚴 GravelGuide – Tour beendet!\n`
    + `📏 ${document.getElementById('nf-dist').textContent} km\n`
    + `⏱ ${document.getElementById('nf-time').textContent}\n`
    + `⛰ ${document.getElementById('nf-climb').textContent}\n`
    + `⚡ ${document.getElementById('nf-speed').textContent}\n`
    + `🔥 ${document.getElementById('nf-cal').textContent}\n`
    + `Geplant mit GravelGuide 3D`;
  if(navigator.share){
    navigator.share({title:'GravelGuide Tour', text:txt}).catch(()=>{});
  } else {
    navigator.clipboard?.writeText(txt).then(()=> showToast('✓ In Zwischenablage kopiert')).catch(()=> showToast(txt));
  }
}

function naviFinishGPX(){ exportGPX(); }

/* ── createNavDotIcon (Teardrop für Navigations-Richtung) ── */
function createNavDotIcon(){
  const S=32, cx=S/2, cy=S/2+2.5, r=7, tip=4.5;
  const canvas=document.createElement('canvas'); canvas.width=S; canvas.height=S;
  const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,S,S);
  function teardrop(rr,tt){
    ctx.beginPath();
    ctx.moveTo(cx,cy-rr-tt);
    ctx.bezierCurveTo(cx+rr*.55,cy-rr-tt*.12,cx+rr,cy-rr*.38,cx+rr,cy);
    ctx.arc(cx,cy,rr,0,Math.PI);
    ctx.bezierCurveTo(cx-rr,cy-rr*.38,cx-rr*.55,cy-rr-tt*.12,cx,cy-rr-tt);
    ctx.closePath();
  }
  teardrop(r+2.5,tip+1.5); ctx.fillStyle='rgba(255,255,255,.97)'; ctx.fill();
  teardrop(r,tip);          ctx.fillStyle='#00d4ff';               ctx.fill();
  const grd=ctx.createRadialGradient(cx-.5,cy-r*.5,0,cx,cy,r*1.1);
  grd.addColorStop(0,'rgba(255,255,255,.52)'); grd.addColorStop(.55,'rgba(255,255,255,.08)'); grd.addColorStop(1,'rgba(255,255,255,0)');
  teardrop(r,tip); ctx.fillStyle=grd; ctx.fill();
  const imgData=ctx.getImageData(0,0,S,S);
  return {width:S,height:S,data:new Uint8Array(imgData.data.buffer)};
}

// ══════════════════════════════════════════════════
// OPTIK: Himmel, Helligkeit, Kontrast
// ══════════════════════════════════════════════════
let skyOn = false;
let optikBrightness = 100;
let optikContrast   = 100;

window.toggleSky = function(){
  skyOn = !skyOn;
  document.querySelectorAll('.optik-sky-btn').forEach(b => b.classList.toggle('active', skyOn));
  _applySky();
  showToast(skyOn ? '☁️ Himmel eingeblendet' : '☁️ Himmel ausgeblendet');
};

function _applySky(){
  if(!map) return;
  if(!map.getLayer('vn-sky')){
    // Layer fehlt (z.B. nach Stilwechsel) — neu anlegen
    try {
      map.addLayer({
        id:'vn-sky', type:'sky',
        layout:{ visibility: skyOn ? 'visible' : 'none' },
        paint:{
          'sky-type':'atmosphere',
          'sky-atmosphere-color':'rgba(100,181,246,1)',
          'sky-atmosphere-sun-intensity':12,
          'sky-opacity':['interpolate',['linear'],['zoom'],0,0,5,0.5,8,1]
        }
      });
    } catch(e){ console.warn('sky layer add failed:', e); }
  } else {
    map.setLayoutProperty('vn-sky', 'visibility', skyOn ? 'visible' : 'none');
  }
}

function _applyMapFilter(){
  const f = `brightness(${optikBrightness}%) contrast(${optikContrast}%)`;
  document.getElementById('map').style.filter = f;
}

window.setOptikBrightness = function(v){
  optikBrightness = parseInt(v);
  document.querySelectorAll('.optik-brightness-inp').forEach(el => el.value = v);
  document.querySelectorAll('.optik-brightness-val').forEach(el => el.textContent = v + '%');
  _applyMapFilter();
};

window.setOptikContrast = function(v){
  optikContrast = parseInt(v);
  document.querySelectorAll('.optik-contrast-inp').forEach(el => el.value = v);
  document.querySelectorAll('.optik-contrast-val').forEach(el => el.textContent = v + '%');
  _applyMapFilter();
};

// ══════════════════════════════════════════════════
// TILE PREFETCHER
// Lädt Satelliten-Tiles für Zoom ±1 im Hintergrund
// in den Browser-HTTP-Cache → kein Re-Download beim Zoomen
// ══════════════════════════════════════════════════
function _lngLatToTileXY(lng, lat, z){
  const n = 1 << z;
  const x = Math.floor((lng + 180) / 360 * n);
  const lr = Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180));
  const y = Math.floor((1 - lr / Math.PI) / 2 * n);
  return [Math.max(0, Math.min(n-1, x)), Math.max(0, Math.min(n-1, y))];
}

function prefetchSatTiles(){
  if(!map || !apiKey || !satelliteOn) return;
  const zoom   = Math.round(map.getZoom());
  const bounds = map.getBounds();
  const W = bounds.getWest(), E = bounds.getEast(),
        N = bounds.getNorth(), S = bounds.getSouth();

  // Viewport leicht vergrößern (1 Tile Puffer an jeder Seite)
  const padLng = (E - W) * 0.25;
  const padLat = (N - S) * 0.25;

  const urls = [];
  // Aktueller Zoom + 1 höher + 1 tiefer
  for(const z of [zoom - 1, zoom, zoom + 1]){
    if(z < 2 || z > 19) continue;
    const [x1, y1] = _lngLatToTileXY(W - padLng, N + padLat, z);
    const [x2, y2] = _lngLatToTileXY(E + padLng, S - padLat, z);
    for(let x = x1; x <= x2; x++){
      for(let y = y1; y <= y2; y++){
        urls.push(`https://api.maptiler.com/tiles/satellite-v2/${z}/${x}/${y}.jpg?key=${apiKey}`);
      }
    }
  }

  // Max. 48 Tiles pro Prefetch, um Bandbreite zu schonen
  const batch = urls.slice(0, 48);
  batch.forEach(url => {
    fetch(url, { mode:'cors', credentials:'omit', cache:'force-cache' })
      .catch(() => {
        // Fallback ohne force-cache (ältere Browser)
        fetch(url, { mode:'cors', credentials:'omit' }).catch(() => {});
      });
  });
}

// Auto-start: kein Dialog, direkt mit Standard- oder gespeichertem Key laden
launch(apiKey);

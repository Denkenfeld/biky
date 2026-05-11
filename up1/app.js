type="module">
  import { Client, Account, Databases, ID, Query } from 'https://cdn.jsdelivr.net/npm/appwrite@16/dist/esm/sdk.js';

  // ── Appwrite Konfiguration ────────────────────
  const AW_ENDPOINT  = 'https://cloud.appwrite.io/v1';
  const AW_PROJECT   = '69ff896300258f20e17a';
  const AW_DB        = '69ff8f4c003d6fd82f1e';
  const AW_COL       = 'routes';

  const client = new Client().setEndpoint(AW_ENDPOINT).setProject(AW_PROJECT);
  const account = new Account(client);
  const db      = new Databases(client);

  // ── Session-State ────────────────────────────
  let currentUser = null;

  async function initAuth(){
    // Passwort-Reset via E-Mail-Link?
    const params = new URLSearchParams(window.location.search);
    if(params.get('userId') && params.get('secret')){
      showRecoveryModal();
      return; // Kein Auto-Login während Recovery
    }
    updateUserAvatars(); // show ? immediately
    try {
      currentUser = await account.get();
    } catch(e){ currentUser = null; }

    if(currentUser){
      // Gewicht + Cloud-Daten zuerst laden, DANN Profil rendern
      // so dass buildLoggedInHTML den richtigen Gewichtswert kennt
      await loadCloudRoutes();
      renderProfileTab();
    } else {
      renderProfileTab();
    }
  }

  // ── Hilfsfunktion: Feld innerhalb des Containers finden ──
  // Buttons übergeben sich selbst (this), wir gehen zum nächsten .sb-Container hoch
  // und suchen dort das Input per data-field Attribut. Keine doppelten IDs nötig.
  function fieldVal(btn, dataField){
    const container = btn.closest('.sb');
    if(!container) return '';
    const el = container.querySelector(`[data-field="${dataField}"]`);
    return el ? el.value.trim() : '';
  }
  function fieldValRaw(btn, dataField){
    const container = btn.closest('.sb');
    if(!container) return '';
    const el = container.querySelector(`[data-field="${dataField}"]`);
    return el ? el.value : '';
  }

  // ── Registrierung ────────────────────────────
  window.registerUser = async function(btn){
    const email = fieldVal(btn,'reg-email');
    const pass  = fieldValRaw(btn,'reg-pass');
    const name  = fieldVal(btn,'reg-name') || email;
    if(!email||!pass){ showToast('E-Mail und Passwort eingeben'); return; }
    btn.disabled = true; btn.textContent = '⏳ Bitte warten…';
    try {
      await account.create(ID.unique(), email, pass, name);
      await account.createEmailPasswordSession(email, pass);
      currentUser = await account.get();
      await loadCloudRoutes();
      renderProfileTab();
      showToast('✓ Account erstellt & eingeloggt!');
    } catch(e){
      showToast('Fehler: ' + (e.message||'Registrierung fehlgeschlagen'));
      btn.disabled = false; btn.textContent = '✨ Account erstellen';
    }
  };

  // ── Login ─────────────────────────────────────
  window.loginUser = async function(btn){
    const email = fieldVal(btn,'login-email');
    const pass  = fieldValRaw(btn,'login-pass');
    if(!email||!pass){ showToast('E-Mail und Passwort eingeben'); return; }
    btn.disabled = true; btn.textContent = '⏳ Bitte warten…';
    try {
      await account.createEmailPasswordSession(email, pass);
      currentUser = await account.get();
      await loadCloudRoutes();
      renderProfileTab();
      showToast('✓ Willkommen zurück, ' + (currentUser.name||currentUser.email) + '!');
    } catch(e){
      showToast('Login fehlgeschlagen: ' + (e.message||''));
      btn.disabled = false; btn.textContent = '🔑 Einloggen';
    }
  };

  // ── Logout ────────────────────────────────────
  window.logoutUser = async function(){
    try { await account.deleteSession('current'); } catch(e){}
    currentUser = null;
    renderProfileTab();
    renderCloudRoutes([]);
    showToast('Abgemeldet');
  };

  // ── Passwort vergessen ────────────────────────
  window.showResetForm = function(btn){
    const sb = btn.closest('.sb');
    if(!sb) return;
    sb.querySelector('.auth-form-login').style.display = 'none';
    sb.querySelector('.auth-form-reg').style.display   = 'none';
    sb.querySelector('.auth-form-reset').style.display = '';
    sb.querySelectorAll('.auth-tab-btn').forEach(b =>
      Object.assign(b.style, {background:'none', color:'var(--dim)'})
    );
  };

  window.cancelResetForm = function(btn){
    const sb = btn.closest('.sb');
    if(!sb) return;
    sb.querySelector('.auth-form-reset').style.display = 'none';
    sb.querySelector('.auth-form-login').style.display = '';
    // Login-Tab optisch reaktivieren
    const loginTabBtn = sb.querySelector('.auth-tab-btn');
    if(loginTabBtn) Object.assign(loginTabBtn.style, {background:'var(--accent-dim)', color:'var(--accent)'});
  };

  window.sendPasswordReset = async function(btn){
    const sb = btn.closest('.sb');
    if(!sb) return;
    const emailEl = sb.querySelector('[data-field="reset-email"]');
    const email = emailEl ? emailEl.value.trim() : '';
    if(!email){ showToast('Bitte E-Mail eingeben'); return; }
    btn.disabled = true; btn.textContent = '⏳ Wird gesendet…';
    try {
      const redirectUrl = window.location.origin + window.location.pathname;
      await account.createRecovery(email, redirectUrl);
      // Erfolgs-View zeigen
      const form = sb.querySelector('.auth-form-reset');
      if(form) form.innerHTML = `
        <div style="text-align:center;padding:8px 0 4px;">
          <div style="font-size:32px;margin-bottom:8px;">📬</div>
          <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">E-Mail gesendet!</div>
          <div style="font-size:11px;color:var(--dim);line-height:1.6;margin-bottom:12px;">Prüfe dein Postfach (<b style="color:var(--accent)">${email}</b>) und klicke den Link zum Zurücksetzen.</div>
          <button class="btn" style="width:100%;justify-content:center;padding:9px;" onclick="cancelResetForm(this)">← Zurück zum Login</button>
        </div>`;
    } catch(e){
      showToast('Fehler: ' + (e.message || 'Reset fehlgeschlagen'));
      btn.disabled = false; btn.textContent = '📤 Reset-Link senden';
    }
  };

  // ── Neues Passwort nach Recovery-Link setzen ─
  window.submitNewPassword = async function(btn){
    const sb = btn.closest('.sb') || btn.closest('.dlg-body');
    if(!sb) return;
    const p1 = sb.querySelector('[data-field="new-pass"]')?.value || '';
    const p2 = sb.querySelector('[data-field="new-pass2"]')?.value || '';
    if(p1.length < 8){ showToast('Passwort muss mind. 8 Zeichen haben'); return; }
    if(p1 !== p2){ showToast('Passwörter stimmen nicht überein'); return; }
    btn.disabled = true; btn.textContent = '⏳ Bitte warten…';
    try {
      const params = new URLSearchParams(window.location.search);
      await account.updateRecovery(params.get('userId'), params.get('secret'), p1);
      showToast('✓ Passwort geändert! Du kannst dich jetzt einloggen.');
      // URL bereinigen & Recovery-Modal schließen
      window.history.replaceState({}, '', window.location.pathname);
      document.getElementById('recovery-modal')?.remove();
      renderProfileTab();
    } catch(e){
      showToast('Fehler: ' + (e.message || 'Reset fehlgeschlagen'));
      btn.disabled = false; btn.textContent = '🔑 Passwort speichern';
    }
  };

  // ── Gewicht via Appwrite User-Preferences speichern ─────
  // account.updatePrefs() speichert beliebige Key-Value-Daten direkt am User-Account.
  // Kein eigener DB-Eintrag, kein Index-Problem, kein Duplikat-Risiko.
  window.saveWeightToCloud = async function(weightKg){
    if(!currentUser) return;
    const w = parseFloat(weightKg);
    if(!w || w < 20 || w > 300) return;
    localStorage.setItem('vn_weight', String(w));
    const h = document.getElementById('weight-inp');
    if(h) h.value = w;
    try {
      await account.updatePrefs({ weight: w });
    } catch(e){ console.warn('Weight prefs save failed:', e); }
  };

  // ── Route in Cloud speichern ──────────────────
  window.saveRouteToCloud = async function(routeData){
    if(!currentUser){ showToast('Bitte zuerst einloggen'); return; }
    try {
      const w = parseFloat(routeData.weight) || parseFloat(document.getElementById('weight-inp')?.value) || 75;
      const doc = {
        userId:      currentUser.$id,
        routeName:   routeData.name,
        distance:    Math.round(routeData.distance || 0),
        coordinates: JSON.stringify((routeData.coordinates||[]).slice(0,200)),
        elevation:   Math.round(routeData.elevation || 0),
        calories:    Math.round(routeData.calories || 0),
        date:        routeData.date || new Date().toISOString().slice(0,10),
        weight:      w,
        coins:       routeData.coins || 0
      };
      await db.createDocument(AW_DB, AW_COL, ID.unique(), doc);
      showToast('☁️ Route in Cloud gespeichert!');
      loadCloudRoutes();
      renderProfileTab(); // Statistiken neu aufbauen
    } catch(e){
      showToast('Cloud-Fehler: ' + (e.message||''));
    }
  };

  // ── Cloud-Routen laden & anzeigen ────────────
  async function loadCloudRoutes(){
    if(!currentUser) return;
    try {
      // ── Gewicht aus User-Preferences laden ──────────────────
      // Das ist die einzige zuverlässige Quelle – kein Index nötig, kein Duplikat.
      try {
        const prefs = await account.getPrefs();
        if(prefs.weight && prefs.weight >= 20 && prefs.weight <= 300){
          const w = prefs.weight;
          localStorage.setItem('vn_weight', String(w));
          const h = document.getElementById('weight-inp');
          if(h) h.value = w;
          // Sichtbares Gewichts-Input im Profil-Tab aktualisieren
          document.querySelectorAll('input[type="number"][min="30"][max="200"]').forEach(el => {
            if(el.id !== 'weight-inp') el.value = w;
          });
        }
      } catch(e){ /* Prefs nicht verfügbar – ignorieren */ }

      const res = await db.listDocuments(AW_DB, AW_COL, [
        Query.equal('userId', currentUser.$id),
        Query.orderDesc('$createdAt'),
        Query.limit(50)
      ]);

      // Merge cloud rides into _cloudRides and local vn_rides
      const realRides = res.documents.filter(d => d.routeName !== '__weight__' && (d.distance||0) > 0);
      window._cloudRides = realRides.map(d => ({
        date:  d.date || '',
        km:    (d.distance||0)/1000,
        hm:    d.elevation || 0,
        cal:   d.calories  || 0,
        time:  '',
        name:  d.routeName || 'Tour',
        cloud: true
      }));
      // Merge into localStorage (deduplicate by date+km)
      let local = [];
      try { local = JSON.parse(localStorage.getItem('vn_rides')||'[]'); } catch(e){}
      const merged = [...local];
      window._cloudRides.forEach(cr => {
        if(!merged.some(lr => lr.date===cr.date && Math.abs(lr.km - cr.km) < 0.2)){
          merged.push(cr);
        }
      });
      localStorage.setItem('vn_rides', JSON.stringify(merged.slice(0,100)));

      renderCloudRoutes(res.documents.filter(d => d.routeName !== '__weight__'));
      // Re-init the stats chart if profile tab is open
      setTimeout(() => initProfileChart(), 200);
    } catch(e){ console.warn('Cloud-Routen Fehler:', e); }
  }

  function renderCloudRoutes(docs){
    document.querySelectorAll('.cloud-routes-list').forEach(container => {
      if(!docs.length){
        container.innerHTML = '<div class="wp-empty" style="padding:12px 0;">Noch keine Cloud-Routen.</div>';
        return;
      }
      container.innerHTML = docs.map(d => {
        const distKm = d.distance ? (d.distance/1000).toFixed(1) : '—';
        const safeName = (d.routeName||'Route').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const safeCoords = encodeURIComponent(d.coordinates||'[]');
        return `<div class="srt-item">
          <button class="srt-load" onclick="loadCloudRouteOnMap('${safeName}','${safeCoords}')">
            <div class="srt-name">🗺 ${d.routeName||'Route'}</div>
            <div class="srt-meta">${d.date||''} · ${distKm} km · ${d.elevation||0} hm · ${d.calories||0} kcal</div>
          </button>
          <button class="srt-del" onclick="deleteCloudRoute('${d.$id}')">🗑</button>
        </div>`;
      }).join('');
    });
  }

  window.loadCloudRouteOnMap = async function(name, coordsEncoded){
    try {
      const coords = JSON.parse(decodeURIComponent(coordsEncoded));
      if(!coords||!coords.length){ showToast('Keine Koordinaten gespeichert'); return; }
      clearAll();
      const toLatLng = c => Array.isArray(c) ? {lat:c[1],lng:c[0]} : c;
      const first = toLatLng(coords[0]);
      const last  = toLatLng(coords[coords.length-1]);
      waypoints.push({lat:first.lat,lng:first.lng,label:'Start',hidden:false,manualLine:false,customCoords:null});
      waypoints.push({lat:last.lat, lng:last.lng, label:'Ziel', hidden:false,manualLine:false,customCoords:null});
      renderWpMarkers(); renderWpList();
      if(waypoints.length>=2){ map.flyTo({center:[waypoints[0].lng,waypoints[0].lat],zoom:11}); await rerouteAll(); mapFitRoute(); }
      showToast('✓ "'+name+'" geladen');
      if(window.innerWidth<=860){ switchSheetTab('st-route', document.querySelectorAll('.sh-tab')[1]); }
      else { switchTab('t-route', document.querySelectorAll('.tab-btn')[1]); }
    } catch(e){ showToast('Fehler beim Laden: '+(e.message||'')); }
  };

  window.deleteCloudRoute = async function(docId){
    try {
      await db.deleteDocument(AW_DB, AW_COL, docId);
      showToast('Route gelöscht');
      loadCloudRoutes();
    } catch(e){ showToast('Löschen fehlgeschlagen'); }
  };

  // ── Profil-Tab rendern ────────────────────────
  function renderProfileTab(){
    const pane    = document.getElementById('t-profil');
    const mobPane = document.getElementById('st-profil');
    if(currentUser){
      if(pane)    pane.innerHTML    = buildLoggedInHTML();
      if(mobPane) mobPane.innerHTML = buildLoggedInHTML();
      loadCloudRoutes();
      setTimeout(() => initProfileChart(), 100);
    } else {
      if(pane)    pane.innerHTML    = buildAuthHTML();
      if(mobPane) mobPane.innerHTML = buildAuthHTML();
    }
    updateUserAvatars();
  }

  // ── Statistik-Chart ───────────────────────────
  let _statsRange  = 'week';
  let _statsMetric = 'km';
  let _profileChart = null;

  window.switchStatsRange = function(range, btn){
    _statsRange = range;
    document.querySelectorAll('#stats-range-btns button').forEach(b=>{
      b.style.background = 'none'; b.style.color = 'var(--dim)'; b.style.borderColor = 'var(--border)';
    });
    if(btn){ btn.style.background='var(--accent-dim)'; btn.style.color='var(--accent)'; btn.style.borderColor='rgba(0,212,255,.4)'; }
    initProfileChart();
  };

  window.switchStatsMetric = function(metric, btn){
    _statsMetric = metric;
    document.querySelectorAll('#stats-metric-btns button').forEach(b=>{
      b.style.background = 'none'; b.style.color = 'var(--dim)'; b.style.borderColor = 'var(--border)';
    });
    const colors = {km:'rgba(0,212,255,.4)', hm:'rgba(255,61,107,.4)', cal:'rgba(255,145,0,.4)'};
    const fgColors = {km:'var(--accent)', hm:'var(--red)', cal:'var(--orange)'};
    if(btn){ btn.style.background=`rgba(${_statsMetric==='km'?'0,212,255':_statsMetric==='hm'?'255,61,107':'255,145,0'},.12)`; btn.style.color=fgColors[metric]||'var(--accent)'; btn.style.borderColor=colors[metric]||'rgba(0,212,255,.4)'; }
    initProfileChart();
  };

  function initProfileChart(){
    const canvas = document.getElementById('profile-stats-chart');
    if(!canvas) return;

    let rides = [];
    try { rides = JSON.parse(localStorage.getItem('vn_rides')||'[]'); } catch(e){}

    const now = new Date();
    let labels = [], dataPoints = [], dateKeys = [];

    if(_statsRange === 'week'){
      for(let i=6;i>=0;i--){
        const d = new Date(now); d.setDate(now.getDate()-i);
        const key = d.toISOString().slice(0,10);
        const days = ['So','Mo','Di','Mi','Do','Fr','Sa'];
        labels.push(days[d.getDay()]);
        dateKeys.push(key);
      }
    } else if(_statsRange === 'month'){
      const dInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
      for(let i=1;i<=dInMonth;i++){
        const d = new Date(now.getFullYear(), now.getMonth(), i);
        const key = d.toISOString().slice(0,10);
        labels.push(i % 5 === 1 ? String(i) : '');
        dateKeys.push(key);
      }
    } else if(_statsRange === 'year'){
      const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
      for(let m=0;m<12;m++){
        labels.push(months[m]);
        dateKeys.push(`${now.getFullYear()}-${String(m+1).padStart(2,'0')}`);
      }
    } else { // all — group by month across all time
      const monthMap = {};
      rides.forEach(r=>{
        if(!r.date) return;
        const k = r.date.slice(0,7);
        if(!monthMap[k]) monthMap[k] = 0;
        monthMap[k] += (_statsMetric==='km'?(r.km||0):_statsMetric==='hm'?(r.hm||0):(r.cal||0));
      });
      const sortedKeys = Object.keys(monthMap).sort();
      sortedKeys.forEach(k => {
        const [y,m] = k.split('-');
        labels.push(`${m}/${y.slice(2)}`);
        dateKeys.push(k);
      });
      dataPoints = sortedKeys.map(k => monthMap[k]);
    }

    if(_statsRange !== 'all'){
      dataPoints = dateKeys.map(key => {
        return rides.filter(r => {
          if(!r.date) return false;
          if(_statsRange==='year') return r.date.startsWith(key);
          return r.date === key;
        }).reduce((sum, r) => sum + (_statsMetric==='km'?(r.km||0):_statsMetric==='hm'?(r.hm||0):(r.cal||0)), 0);
      });
    }

    const metricColors = { km:'rgba(0,212,255,1)', hm:'rgba(255,61,107,1)', cal:'rgba(255,145,0,1)' };
    const metricGlow   = { km:'rgba(0,212,255,.25)', hm:'rgba(255,61,107,.2)', cal:'rgba(255,145,0,.2)' };
    const color = metricColors[_statsMetric] || metricColors.km;
    const glow  = metricGlow[_statsMetric]  || metricGlow.km;

    // Period summary
    const periodSum  = dataPoints.reduce((a,v)=>a+v,0);
    const maxVal     = Math.max(...dataPoints, 0.001);
    const avgVal     = dataPoints.filter(v=>v>0).length ? (periodSum / dataPoints.filter(v=>v>0).length).toFixed(1) : '0';
    const label      = _statsMetric==='km'?'km':_statsMetric==='hm'?'hm':'kcal';
    const periodEl   = document.getElementById('stats-period-summary');
    if(periodEl) periodEl.innerHTML = `
      <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:var(--r-md);padding:8px 10px;text-align:center;">
        <div style="font-family:var(--mono);font-size:16px;font-weight:700;color:${color};">${periodSum.toFixed(_statsMetric==='km'?1:0)}</div>
        <div style="font-size:8px;color:var(--dim);text-transform:uppercase;margin-top:2px;">${label} gesamt</div>
      </div>
      <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:var(--r-md);padding:8px 10px;text-align:center;">
        <div style="font-family:var(--mono);font-size:16px;font-weight:700;color:${color};">${maxVal.toFixed(_statsMetric==='km'?1:0)}</div>
        <div style="font-size:8px;color:var(--dim);text-transform:uppercase;margin-top:2px;">${label} best</div>
      </div>
      <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:var(--r-md);padding:8px 10px;text-align:center;">
        <div style="font-family:var(--mono);font-size:16px;font-weight:700;color:${color};">${avgVal}</div>
        <div style="font-size:8px;color:var(--dim);text-transform:uppercase;margin-top:2px;">${label} ø tour</div>
      </div>`;

    // Destroy old chart
    if(_profileChart){ try { _profileChart.destroy(); } catch(e){} _profileChart = null; }

    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0,0,0,110);
    grad.addColorStop(0, glow);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    _profileChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: dataPoints,
          backgroundColor: dataPoints.map(v => v > 0 ? glow : 'rgba(255,255,255,.04)'),
          borderColor:     dataPoints.map(v => v > 0 ? color : 'rgba(255,255,255,.08)'),
          borderWidth: 1.5,
          borderRadius: 3,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend:{display:false}, tooltip:{
          callbacks:{ label: ctx => `${ctx.raw.toFixed(_statsMetric==='km'?1:0)} ${label}` },
          backgroundColor:'rgba(8,12,20,.95)', borderColor:'rgba(255,255,255,.12)', borderWidth:1,
          titleFont:{family:'JetBrains Mono'}, bodyFont:{family:'JetBrains Mono'}
        }},
        scales:{
          x:{ grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'rgba(139,155,180,.7)', font:{size:8, family:'JetBrains Mono'}} },
          y:{ grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'rgba(139,155,180,.7)', font:{size:8, family:'JetBrains Mono'}, maxTicksLimit:4},
              beginAtZero:true }
        }
      }
    });

    const emptyEl = document.getElementById('profile-chart-empty');
    if(emptyEl) emptyEl.style.display = periodSum===0 ? 'flex' : 'none';
  }

  function updateUserAvatars(){
    const initial = currentUser
      ? ((currentUser.name||currentUser.email||'?').trim()[0] || '?')
      : '?';
    const loggedIn = !!currentUser;
    ['user-avatar-desk','user-avatar-mob'].forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      el.textContent = initial;
      el.classList.toggle('logged-in', loggedIn);
      el.title = loggedIn ? (currentUser.name||currentUser.email||'Profil') : 'Einloggen';
    });
  }

  window.openProfileTab = function(){
    // Desktop: activate Profil tab in sidebar
    const btn = Array.from(document.querySelectorAll('.tab-btn'))
      .find(b => b.textContent.trim() === 'Profil');
    if(btn) switchTab('t-profil', btn);
  };

  window.openProfileMob = function(){
    // Mobile: expand sheet fully and switch to Profil tab
    setSheetState(1);
    const tab = Array.from(document.querySelectorAll('.sh-tab'))
      .find(b => b.textContent.trim() === 'Profil');
    if(tab) switchSheetTab('st-profil', tab);
  };

  // Kein pfx, keine IDs auf Inputs — Buttons lesen aus dem eigenen .sb-Container
  function buildAuthHTML(){
    return `
    <div class="sb" style="background:linear-gradient(135deg,rgba(0,212,255,.06),rgba(0,230,118,.04));border-color:rgba(0,212,255,.2);">
      <div style="text-align:center;padding:8px 0 14px;">
        <div style="font-size:36px;margin-bottom:8px;">🚴</div>
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px;">GravelGuide 3D</div>
        <div style="font-size:11px;color:var(--dim);">Einloggen um Routen zu speichern</div>
      </div>
      <div style="display:flex;margin-bottom:12px;border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;">
        <button class="auth-tab-btn" onclick="switchAuthTab(this,'login')" style="flex:1;padding:8px;background:var(--accent-dim);border:none;color:var(--accent);font-family:var(--font);font-size:12px;font-weight:700;letter-spacing:.08em;cursor:pointer;text-transform:uppercase;">Einloggen</button>
        <button class="auth-tab-btn" onclick="switchAuthTab(this,'reg')"   style="flex:1;padding:8px;background:none;border:none;color:var(--dim);font-family:var(--font);font-size:12px;font-weight:700;letter-spacing:.08em;cursor:pointer;text-transform:uppercase;">Registrieren</button>
      </div>
      <div class="auth-form-login">
        <div style="margin-bottom:8px;"><input data-field="login-email" type="email" placeholder="E-Mail" class="set-inp" style="width:100%;text-align:left;padding:9px 12px;" autocomplete="email"></div>
        <div style="margin-bottom:10px;"><input data-field="login-pass" type="password" placeholder="Passwort" class="set-inp" style="width:100%;text-align:left;padding:9px 12px;" autocomplete="current-password"></div>
        <button class="btn ok" style="width:100%;justify-content:center;padding:10px;" onclick="loginUser(this)">🔑 Einloggen</button>
        <div style="text-align:center;margin-top:10px;">
          <button onclick="showResetForm(this)" style="background:none;border:none;color:var(--dim);font-family:var(--font);font-size:11px;cursor:pointer;letter-spacing:.04em;text-decoration:underline;text-underline-offset:3px;">Passwort vergessen?</button>
        </div>
      </div>
      <div class="auth-form-reset" style="display:none;">
        <div style="margin-bottom:6px;font-size:11px;color:var(--dim);line-height:1.6;">Gib deine E-Mail ein – wir senden dir einen Link zum Zurücksetzen.</div>
        <div style="margin-bottom:10px;"><input data-field="reset-email" type="email" placeholder="Deine E-Mail-Adresse" class="set-inp" style="width:100%;text-align:left;padding:9px 12px;" autocomplete="email"></div>
        <button class="btn ok" style="width:100%;justify-content:center;padding:10px;margin-bottom:8px;" onclick="sendPasswordReset(this)">📤 Reset-Link senden</button>
        <button onclick="cancelResetForm(this)" style="width:100%;background:none;border:1px solid var(--border);color:var(--dim);font-family:var(--font);font-size:11px;font-weight:600;letter-spacing:.06em;padding:8px;border-radius:var(--r-md);cursor:pointer;text-transform:uppercase;">← Zurück</button>
      </div>
      <div class="auth-form-reg" style="display:none;">
        <div style="margin-bottom:8px;"><input data-field="reg-name" type="text" placeholder="Name (optional)" class="set-inp" style="width:100%;text-align:left;padding:9px 12px;" autocomplete="name"></div>
        <div style="margin-bottom:8px;"><input data-field="reg-email" type="email" placeholder="E-Mail" class="set-inp" style="width:100%;text-align:left;padding:9px 12px;" autocomplete="email"></div>
        <div style="margin-bottom:10px;"><input data-field="reg-pass" type="password" placeholder="Passwort (min. 8 Zeichen)" class="set-inp" style="width:100%;text-align:left;padding:9px 12px;" autocomplete="new-password"></div>
        <button class="btn ok" style="width:100%;justify-content:center;padding:10px;" onclick="registerUser(this)">✨ Account erstellen</button>
      </div>
    </div>
    <div class="sb" style="border-bottom:none;">
      <div style="font-size:11px;color:var(--dim);line-height:1.7;text-align:center;">
        <div style="margin-bottom:6px;">Mit einem Account kannst du:</div>
        <div>☁️ Routen in der Cloud speichern</div>
        <div>📊 Fahrtstatistiken tracken</div>
        <div>🔄 Geräteübergreifend synchronisieren</div>
      </div>
    </div>`;
  }

  function buildLoggedInHTML(){
    const name = currentUser.name || currentUser.email;
    const initials = name.slice(0,2).toUpperCase();
    const weight = document.getElementById('weight-inp')?.value || localStorage.getItem('vn_weight') || 75;
    let rides = [];
    try { rides = JSON.parse(localStorage.getItem('vn_rides')||'[]'); } catch(e){}

    // Merge cloud rides (stored in _cloudRides global) with local
    const allRides = [...rides];

    function ridesInRange(range){
      const now = new Date();
      return allRides.filter(r => {
        if(!r.date) return range === 'all';
        const d = new Date(r.date);
        if(range==='week'){
          const weekAgo = new Date(now); weekAgo.setDate(now.getDate()-6);
          return d >= weekAgo;
        } else if(range==='month'){
          return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
        } else if(range==='year'){
          return d.getFullYear()===now.getFullYear();
        }
        return true; // 'all'
      });
    }

    const totalKm  = allRides.reduce((a,r)=>a+(r.km||0),0).toFixed(1);
    const totalHm  = allRides.reduce((a,r)=>a+(r.hm||0),0);
    const totalCal = allRides.reduce((a,r)=>a+(r.cal||0),0);
    const totalMin = allRides.reduce((a,r)=>{
      const t=r.time||''; const p=t.split(':');
      return a+(p.length>=2 ? +p[0]*60+ +p[1] : 0);
    },0);
    const totalH = (totalMin/60).toFixed(1);

    return `
    <div class="sb" style="background:linear-gradient(135deg,rgba(0,212,255,.06),rgba(0,230,118,.04));border-color:rgba(0,212,255,.2);">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--green));display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#000;flex-shrink:0;">${initials}</div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text);">${name}</div>
          <div style="font-size:10px;color:var(--dim);">${currentUser.email}</div>
        </div>
        <button class="btn danger" style="margin-left:auto;padding:5px 10px;font-size:10px;" onclick="logoutUser()">Logout</button>
      </div>
    </div>

    <!-- Gesamtstatistiken (immer sichtbar) -->
    <div class="sb" style="background:rgba(0,0,0,.15);">
      <div class="sb-title">📊 Gesamtstatistiken</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;">
        <div style="background:linear-gradient(135deg,rgba(0,212,255,.1),rgba(0,212,255,.02));border:1px solid rgba(0,212,255,.25);border-radius:var(--r-md);padding:10px 12px;">
          <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:var(--accent);">${totalKm}</div>
          <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-top:2px;">km gefahren</div>
        </div>
        <div style="background:linear-gradient(135deg,rgba(255,70,70,.1),rgba(255,70,70,.02));border:1px solid rgba(255,70,70,.25);border-radius:var(--r-md);padding:10px 12px;">
          <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:var(--red);">${totalHm}</div>
          <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-top:2px;">hm aufgestiegen</div>
        </div>
        <div style="background:linear-gradient(135deg,rgba(255,145,0,.1),rgba(255,145,0,.02));border:1px solid rgba(255,145,0,.25);border-radius:var(--r-md);padding:10px 12px;">
          <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:var(--orange);">${totalCal}</div>
          <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-top:2px;">kcal verbrannt</div>
        </div>
        <div style="background:linear-gradient(135deg,rgba(0,230,118,.1),rgba(0,230,118,.02));border:1px solid rgba(0,230,118,.25);border-radius:var(--r-md);padding:10px 12px;">
          <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:var(--green);">${totalH}h</div>
          <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-top:2px;">im sattel</div>
        </div>
      </div>
      <div style="margin-top:6px;font-size:9px;color:var(--dim);text-align:right;">${allRides.length} Tour${allRides.length!==1?'en':''} gesamt</div>
    </div>

    <!-- Statistik-Charts mit Zeitraum-Regler -->
    <div class="sb" id="stats-chart-block">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div class="sb-title" style="margin-bottom:0;">📈 Verlauf</div>
        <div style="display:flex;gap:3px;" id="stats-range-btns">
          <button onclick="switchStatsRange('week',this)" style="font-family:var(--font);font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:4px 7px;border-radius:4px;border:1px solid var(--border);background:var(--accent-dim);color:var(--accent);cursor:pointer;">7T</button>
          <button onclick="switchStatsRange('month',this)" style="font-family:var(--font);font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:4px 7px;border-radius:4px;border:1px solid var(--border);background:none;color:var(--dim);cursor:pointer;">Monat</button>
          <button onclick="switchStatsRange('year',this)" style="font-family:var(--font);font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:4px 7px;border-radius:4px;border:1px solid var(--border);background:none;color:var(--dim);cursor:pointer;">Jahr</button>
          <button onclick="switchStatsRange('all',this)" style="font-family:var(--font);font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:4px 7px;border-radius:4px;border:1px solid var(--border);background:none;color:var(--dim);cursor:pointer;">Alle</button>
        </div>
      </div>
      <!-- Metric selector -->
      <div style="display:flex;gap:3px;margin-bottom:10px;" id="stats-metric-btns">
        <button onclick="switchStatsMetric('km',this)" style="font-family:var(--font);font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:4px;border:1px solid rgba(0,212,255,.4);background:rgba(0,212,255,.12);color:var(--accent);cursor:pointer;flex:1;">km</button>
        <button onclick="switchStatsMetric('hm',this)" style="font-family:var(--font);font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:none;color:var(--dim);cursor:pointer;flex:1;">Hm</button>
        <button onclick="switchStatsMetric('cal',this)" style="font-family:var(--font);font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:none;color:var(--dim);cursor:pointer;flex:1;">kcal</button>
      </div>
      <!-- Chart canvas -->
      <div style="position:relative;height:110px;border-radius:var(--r-md);overflow:hidden;background:rgba(0,0,0,.2);border:1px solid var(--border);">
        <canvas id="profile-stats-chart" style="width:100%;height:100%;display:block;"></canvas>
        <div id="profile-chart-empty" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--dim);display:none;">Noch keine Touren</div>
      </div>
      <!-- Period summary row -->
      <div id="stats-period-summary" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:8px;"></div>
    </div>

    <!-- Cloud-Routen -->
    <div class="sb" style="border-bottom:none;">
      <div class="sb-title">☁️ Gespeicherte Routen</div>
      <div class="cloud-routes-list"><div class="wp-empty" style="padding:10px 0;">Lade…</div></div>
    </div>

    <!-- Fahrerprofil / Gewicht -->
    <div class="sb" style="border-bottom:none;">
      <div class="sb-title">Fahrerprofil</div>
      <div class="set-row">
        <div class="set-lbl">Körpergewicht (kg)</div>
        <input class="set-inp" type="number" value="${weight}" min="30" max="200"
          oninput="var h=document.getElementById('weight-inp');if(h)h.value=this.value;localStorage.setItem('vn_weight',this.value);recalcStats();"
          onchange="localStorage.setItem('vn_weight',this.value);if(typeof window.saveWeightToCloud==='function')window.saveWeightToCloud(this.value);">
      </div>
    </div>`;
  }

  // ── Recovery-Modal (nach Klick auf Reset-Link) ──
  function showRecoveryModal(){
    if(document.getElementById('recovery-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'recovery-modal';
    modal.style.cssText = `position:fixed;inset:0;z-index:9600;background:rgba(0,0,0,.82);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;padding:20px;`;
    modal.innerHTML = `
      <div class="g" style="width:100%;max-width:360px;padding:22px 20px;">
        <div style="text-align:center;margin-bottom:18px;">
          <div style="font-size:32px;margin-bottom:8px;">🔑</div>
          <div style="font-size:17px;font-weight:800;color:var(--text);letter-spacing:.08em;text-transform:uppercase;">Neues Passwort</div>
          <div style="font-size:11px;color:var(--dim);margin-top:4px;">Gib dein neues Passwort ein.</div>
        </div>
        <div class="dlg-body" style="padding:0;">
          <div style="margin-bottom:8px;"><input data-field="new-pass" type="password" placeholder="Neues Passwort (min. 8 Zeichen)" class="set-inp" style="width:100%;text-align:left;padding:9px 12px;" autocomplete="new-password"></div>
          <div style="margin-bottom:14px;"><input data-field="new-pass2" type="password" placeholder="Passwort wiederholen" class="set-inp" style="width:100%;text-align:left;padding:9px 12px;" autocomplete="new-password"></div>
          <button class="btn ok" style="width:100%;justify-content:center;padding:11px;" onclick="submitNewPassword(this)">🔑 Passwort speichern</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  // ── Körpergewicht aus localStorage wiederherstellen ─
  document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('vn_weight');
    if(saved){
      const inp = document.getElementById('weight-inp');
      if(inp) inp.value = saved;
    }
  });

  // switchAuthTab: btn = geklickter Button, tab = 'login'|'reg'
  // Sucht NUR im eigenen .sb-Container — funktioniert für Desktop UND Mobile
  window.switchAuthTab = function(btn, tab){
    const sb = btn.closest('.sb');
    if(!sb) return;
    sb.querySelectorAll('.auth-tab-btn').forEach(b =>
      Object.assign(b.style, {background:'none', color:'var(--dim)'})
    );
    Object.assign(btn.style, {background:'var(--accent-dim)', color:'var(--accent)'});
    const loginForm = sb.querySelector('.auth-form-login');
    const regForm   = sb.querySelector('.auth-form-reg');
    const resetForm = sb.querySelector('.auth-form-reset');
    resetForm && (resetForm.style.display = 'none');
    if(tab === 'login'){
      loginForm && (loginForm.style.display = '');
      regForm   && (regForm.style.display   = 'none');
    } else {
      loginForm && (loginForm.style.display = 'none');
      regForm   && (regForm.style.display   = '');
    }
  };

  // ── Expose saveRouteToCloud für showNaviFinish ─
  window._awSaveRoute = saveRouteToCloud;
  window._awCurrentUser = () => currentUser;
  window._awLoadCloudRoutes = loadCloudRoutes;

  // ── Init ──────────────────────────────────────
  // Warten bis DOM fertig ist
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }
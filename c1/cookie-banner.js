/**
 * GravelGuide Cookie-Banner
 * DSGVO / TTDSG konform – GitHub Pages (reines Client-Side)
 * Speichert Einwilligung in localStorage: key "gg_consent"
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'gg_consent';
  const VERSION     = 1;

  /* ── Gespeicherte Einwilligung lesen ───────────────────── */
  function getConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj.version !== VERSION) return null;
      return obj;
    } catch (e) { return null; }
  }

  /* ── Einwilligung speichern ────────────────────────────── */
  function saveConsent(fonts) {
    const obj = { version: VERSION, ts: Date.now(), fonts: !!fonts };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (e) {}
    return obj;
  }

  /* ── Google Fonts dynamisch laden ─────────────────────── */
  function loadGoogleFonts() {
    if (document.getElementById('gg-gfonts-preconnect')) return;
    const pc = document.createElement('link');
    pc.id   = 'gg-gfonts-preconnect';
    pc.rel  = 'preconnect';
    pc.href = 'https://fonts.googleapis.com';
    document.head.appendChild(pc);

    const f1 = document.createElement('link');
    f1.rel  = 'stylesheet';
    f1.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600;700;800&display=swap';
    document.head.appendChild(f1);

    const f2 = document.createElement('link');
    f2.rel  = 'stylesheet';
    f2.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap';
    document.head.appendChild(f2);
  }

  /* ── Bereits eingewilligt? → direkt ausführen, Banner überspringen ── */
  const existing = getConsent();
  if (existing !== null) {
    if (existing.fonts) loadGoogleFonts();
    return; // Banner nicht zeigen
  }

  /* ══════════════════════════════════════════════
     Banner-Styles (isoliert, keine Konflikte)
  ══════════════════════════════════════════════ */
  const css = `
#gg-cb-wrap *{box-sizing:border-box;margin:0;padding:0;}
#gg-cb-wrap{
  position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(20px);
  z-index:99999;width:min(520px,calc(100vw - 28px));
  font-family:'Barlow Condensed',system-ui,sans-serif;
  font-size:14px;letter-spacing:.02em;color:#e4ecf4;
  opacity:0;transition:opacity .35s ease, transform .35s ease;
  pointer-events:none;
}
#gg-cb-wrap.gg-visible{
  opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto;
}
#gg-cb-box{
  background:rgba(7,11,19,.88);
  backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
  border:1px solid rgba(255,255,255,.09);
  border-radius:13px;
  box-shadow:0 12px 48px rgba(0,0,0,.7);
  overflow:hidden;
}
#gg-cb-main{padding:16px 18px 14px;}
#gg-cb-head{display:flex;align-items:center;gap:9px;margin-bottom:9px;}
#gg-cb-icon{font-size:17px;flex-shrink:0;}
#gg-cb-title{font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#e4ecf4;}
#gg-cb-body{font-size:13px;color:#8b9bb4;line-height:1.55;margin-bottom:13px;}
#gg-cb-body a{color:#00d4ff;text-decoration:none;}
#gg-cb-body a:hover{text-decoration:underline;}
#gg-cb-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
#gg-cb-ok{
  font-family:inherit;font-size:13px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;cursor:pointer;
  border-radius:8px;border:none;outline:none;
  padding:9px 22px;
  background:linear-gradient(135deg,#00d4ff,#00b8d9);
  color:#000;box-shadow:0 0 16px rgba(0,212,255,.35);
  transition:.2s ease;flex-shrink:0;
}
#gg-cb-ok:hover{box-shadow:0 0 24px rgba(0,212,255,.6);transform:translateY(-1px);}
#gg-cb-ok:active{transform:translateY(0);}
.gg-cb-sm{
  font-family:inherit;font-size:11px;font-weight:600;letter-spacing:.07em;
  text-transform:uppercase;cursor:pointer;
  border-radius:7px;border:1px solid rgba(255,255,255,.1);outline:none;
  padding:8px 13px;
  background:rgba(255,255,255,.05);color:#8b9bb4;
  transition:.2s ease;flex-shrink:0;
}
.gg-cb-sm:hover{background:rgba(255,255,255,.1);color:#e4ecf4;border-color:rgba(255,255,255,.2);}

/* ── Einstellungs-Panel ── */
#gg-cb-settings{
  display:none;
  border-top:1px solid rgba(255,255,255,.07);
  padding:14px 18px 16px;
  background:rgba(0,0,0,.18);
}
#gg-cb-settings.gg-open{display:block;}
.gg-svc-row{
  display:flex;align-items:flex-start;justify-content:space-between;
  gap:12px;padding:9px 0;
  border-bottom:1px solid rgba(255,255,255,.05);
}
.gg-svc-row:last-child{border-bottom:none;}
.gg-svc-info{flex:1;}
.gg-svc-name{font-size:12px;font-weight:700;color:#e4ecf4;letter-spacing:.05em;margin-bottom:2px;}
.gg-svc-desc{font-size:11px;color:#5a6a7e;line-height:1.45;}
.gg-svc-badge{
  font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  padding:2px 7px;border-radius:10px;flex-shrink:0;margin-top:2px;
}
.gg-badge-req{background:rgba(0,230,118,.12);border:1px solid rgba(0,230,118,.3);color:#00e676;}
/* Toggle */
.gg-ts{position:relative;display:inline-block;width:34px;height:18px;flex-shrink:0;margin-top:2px;}
.gg-ts input{opacity:0;width:0;height:0;position:absolute;}
.gg-ts-sl{
  position:absolute;inset:0;cursor:pointer;border-radius:18px;
  background:rgba(255,255,255,.12);transition:.25s;
}
.gg-ts-sl:before{
  content:'';position:absolute;left:2px;top:2px;
  width:14px;height:14px;border-radius:50%;
  background:#3d4d60;transition:.25s;
}
.gg-ts input:checked+.gg-ts-sl{background:#00d4ff;}
.gg-ts input:checked+.gg-ts-sl:before{transform:translateX(16px);background:#fff;}
.gg-ts input:disabled+.gg-ts-sl{opacity:.4;cursor:not-allowed;}
.gg-set-actions{display:flex;gap:7px;margin-top:13px;justify-content:flex-end;}
`;

  /* ── Style-Tag einfügen ─────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ── Banner-HTML ───────────────────────────────────────── */
  const wrap = document.createElement('div');
  wrap.id = 'gg-cb-wrap';
  wrap.innerHTML = `
<div id="gg-cb-box">

  <div id="gg-cb-main">
    <div id="gg-cb-head">
      <span id="gg-cb-icon">🔒</span>
      <span id="gg-cb-title">Datenschutz & externe Dienste</span>
    </div>
    <div id="gg-cb-body">
      Diese App verbindet sich mit externen Diensten. Karten, Routing und Suche sind
      funktional notwendig. <strong style="color:#e4ecf4">Google Fonts</strong> lädt
      Schriftarten von Google&nbsp;– dabei wird Ihre IP-Adresse an Google (USA) übermittelt.
    </div>
    <div id="gg-cb-actions">
      <button id="gg-cb-ok">Alle akzeptieren</button>
      <button class="gg-cb-sm" id="gg-cb-settings-btn">Einstellungen</button>
      <button class="gg-cb-sm" id="gg-cb-deny">Nur Notwendige</button>
    </div>
  </div>

  <div id="gg-cb-settings">
    <div class="gg-svc-row">
      <div class="gg-svc-info">
        <div class="gg-svc-name">Karten · Routing · Suche</div>
        <div class="gg-svc-desc">MapTiler (Kartenkacheln), OSRM &amp; BRouter (Routenberechnung),
          Nominatim/OSM (Ortssuche), lokaler Speicher (Einstellungen &amp; gespeicherte Routen)</div>
      </div>
      <div>
        <span class="gg-svc-badge gg-badge-req">Notwendig</span><br>
        <label class="gg-ts" style="margin-top:6px">
          <input type="checkbox" checked disabled>
          <span class="gg-ts-sl"></span>
        </label>
      </div>
    </div>
    <div class="gg-svc-row">
      <div class="gg-svc-info">
        <div class="gg-svc-name">Google Fonts</div>
        <div class="gg-svc-desc">Schriftarten „Barlow Condensed" &amp; „JetBrains Mono" –
          Google erhält Ihre IP-Adresse. Ohne Zustimmung werden System-Fallback-Fonts verwendet.</div>
      </div>
      <div>
        <span class="gg-svc-badge" style="background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.25);color:#00d4ff;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:10px;">Optional</span><br>
        <label class="gg-ts" style="margin-top:6px">
          <input type="checkbox" id="gg-toggle-fonts" checked>
          <span class="gg-ts-sl"></span>
        </label>
      </div>
    </div>
    <div class="gg-set-actions">
      <button class="gg-cb-sm" id="gg-cb-save-settings">Auswahl speichern</button>
    </div>
  </div>

</div>
  `;
  document.body.appendChild(wrap);

  /* ── Banner einblenden (nach kurzem Delay damit DOM bereit) */
  requestAnimationFrame(() => {
    setTimeout(() => wrap.classList.add('gg-visible'), 80);
  });

  /* ── Banner ausblenden & entfernen ────────────────────── */
  function dismiss() {
    wrap.classList.remove('gg-visible');
    wrap.style.pointerEvents = 'none';
    setTimeout(() => { try { wrap.remove(); } catch(e){} }, 400);
  }

  /* ── Alle akzeptieren ──────────────────────────────────── */
  document.getElementById('gg-cb-ok').addEventListener('click', function () {
    saveConsent(true);
    loadGoogleFonts();
    dismiss();
  });

  /* ── Nur Notwendige ────────────────────────────────────── */
  document.getElementById('gg-cb-deny').addEventListener('click', function () {
    saveConsent(false);
    dismiss();
  });

  /* ── Einstellungen öffnen/schließen ────────────────────── */
  document.getElementById('gg-cb-settings-btn').addEventListener('click', function () {
    const panel = document.getElementById('gg-cb-settings');
    const isOpen = panel.classList.toggle('gg-open');
    this.textContent = isOpen ? 'Schließen' : 'Einstellungen';
  });

  /* ── Auswahl aus Einstellungen speichern ───────────────── */
  document.getElementById('gg-cb-save-settings').addEventListener('click', function () {
    const fonts = document.getElementById('gg-toggle-fonts').checked;
    saveConsent(fonts);
    if (fonts) loadGoogleFonts();
    dismiss();
  });

})();

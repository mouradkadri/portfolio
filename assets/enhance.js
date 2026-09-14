/* =============================================================================
 * enhance.js — recruiter experience + visitor analytics
 * Isolated, framework-agnostic. Injects body-level UI (survives app re-renders)
 * and re-applies in-flow tweaks via a MutationObserver, mirroring the site's
 * existing mk-* injection pattern. No dependency on the compiled template DSL.
 *
 * SETUP (2 fields below):
 *   1. CFG.goatcounter : your GoatCounter subdomain code, e.g. 'mouradkadri'
 *                        (sign up free at goatcounter.com). Leave as-is to disable.
 *   2. CFG.ntfyTopic   : a PRIVATE, unguessable ntfy.sh topic (a shared secret).
 *                        Install the free ntfy app and subscribe to this topic.
 *                        Leave containing "CHANGE-ME" to disable push alerts.
 * ===========================================================================*/
(function () {
  'use strict';

  var CFG = {
    /* --- analytics --- */
    goatcounter: 'GOATCOUNTER_CODE',                 // <-- e.g. 'mouradkadri'
    ntfyTopic:   'mk-portfolio-CHANGE-ME-pick-random',// <-- e.g. 'mk-portfolio-7f3a9c2b91'
    geoLookup:   true,                                // best-effort city/country in alerts

    /* --- always-on availability signal --- */
    availability: "Available Jun 2026 · ML / AI Engineering · Tunis · EU · Remote",

    /* --- role framing (?role=ml|ds|fs|auto) --- */
    roleHeadline: {
      ml:  'I build machine learning systems that <em>run in production</em>, not in notebooks.',
      ds:  'I turn messy, real-world data into <em>decisions teams trust</em>.',
      fs:  'I ship <em>full-stack products</em> with ML at the core, not bolted on.',
      auto:'I design <em>autonomous agents</em> that close the loop, no human in the seat.'
    },
    roleFit: {
      ml:  'Best fit: Applied ML / ML Engineering',
      ds:  'Best fit: Data Science / Analytics',
      fs:  'Best fit: Full-stack / product engineering with ML',
      auto:'Best fit: AI automation / agentic systems',
      '':  'Fit: ML · AI · Full-stack engineering'
    },
    /* home shows these 5 cards; order them per role (by project slug) */
    roleProjects: {
      ml:  ['bte-voice-agent', 'exaq-ocr', 'erp-rag-agent', 'ai-resource-hub', 'goosejobs'],
      ds:  ['exaq-ocr', 'bte-voice-agent', 'goosejobs', 'erp-rag-agent', 'ai-resource-hub'],
      fs:  ['goosejobs', 'ai-resource-hub', 'erp-rag-agent', 'bte-voice-agent', 'exaq-ocr'],
      auto:['bte-voice-agent', 'erp-rag-agent', 'ai-resource-hub', 'exaq-ocr', 'goosejobs']
    },
    roleCV: { ml: 'cvML', ds: 'cvDS', fs: 'cvFS', auto: 'cvAuto' },

    /* top wins shown in the recruiter TL;DR */
    wins: [
      'Autonomous debt-collection voice agent at a bank — 1.05 s end-to-end, 98.1% intent F1 over 39 intents, on-prem.',
      'Exaq OCR assistant — 97% field accuracy, cut manual data-entry time by 85% (YOLOv13 + TrOCR).',
      '11 shipped projects: RAG systems, an MLOps pipeline, and GooseJobs (a SaaS side project).'
    ],

    /* guided tour — selectors that already exist on the home page */
    tour: [
      { sel: '#work',       cap: "Selected work — the systems I've actually shipped, strongest first." },
      { sel: '#experience', cap: 'Experience — four roles, each under real production constraints.' },
      { sel: '#resume',     cap: 'The CV, four ways — grab the version that matches your role.' },
      { sel: '#contact',    cap: "Like what you see? Fastest path is email — let's talk." }
    ],

    contactEmail: 'kadri.mourad@esprit.tn'
  };

  /* -------------------------------------------------------------------------- */
  /* helpers                                                                    */
  /* -------------------------------------------------------------------------- */
  var isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:';
  function clean(s) { return (s || '').replace(/[<>"'`]/g, '').trim().slice(0, 60); }
  function slug(s)  { return clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'style') n.style.cssText = attrs[k]; else n.setAttribute(k, attrs[k]); }
    if (html != null) n.innerHTML = html;
    return n;
  }

  var params = new URLSearchParams(location.search);
  var P = {
    to:   clean(params.get('to')),
    via:  clean(params.get('via')),
    role: (function () { var r = slug(params.get('role')); return CFG.roleHeadline[r] ? r : (CFG.roleFit[r] ? r : ''); })()
  };
  var CVKEY = P.role && CFG.roleCV[P.role];
  var CVHREF = (CVKEY && window.__resources && window.__resources[CVKEY]) || null;

  /* -------------------------------------------------------------------------- */
  /* styles                                                                     */
  /* -------------------------------------------------------------------------- */
  function injectStyle() {
    if (document.getElementById('mk-enhance-style')) return;
    var s = el('style', { id: 'mk-enhance-style' });
    s.textContent = [
      /* greeting toast */
      '#mk-greet{position:fixed;top:72px;left:50%;transform:translateX(-50%) translateY(-14px);z-index:38;max-width:min(92vw,560px);opacity:0;pointer-events:none;',
      'display:flex;align-items:center;gap:14px;padding:12px 14px;background:var(--panel);border:1px solid var(--hair);border-radius:4px;box-shadow:0 10px 40px rgba(0,0,0,0.16);transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1)}',
      '#mk-greet.mk-in{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto}',
      '#mk-greet .mk-g-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;box-shadow:0 0 0 4px var(--accent-soft)}',
      '#mk-greet .mk-g-txt{font-size:13.5px;line-height:1.4;color:var(--body);min-width:0}',
      '#mk-greet .mk-g-txt b{font-family:"Instrument Serif",serif;font-weight:400;font-size:18px;color:var(--ink);letter-spacing:-.01em}',
      '#mk-greet .mk-g-cta{flex-shrink:0;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:var(--accent);border:none;border-radius:2px;padding:8px 12px;cursor:pointer;white-space:nowrap}',
      '#mk-greet .mk-g-x{flex-shrink:0;background:none;border:none;color:var(--muted);font-size:16px;line-height:1;cursor:pointer;padding:2px 4px}',
      /* availability pill (injected into hero eyebrow) */
      '#mk-avail{display:inline-flex;align-items:center;gap:7px;padding:4px 10px;border:1px solid var(--hair);border-radius:100px;background:var(--soft);font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.04em;text-transform:none;color:var(--body);white-space:nowrap}',
      '#mk-avail .mk-live{width:7px;height:7px;border-radius:50%;background:#2ec26b;box-shadow:0 0 0 0 rgba(46,194,107,.5);animation:mkPulse 2s infinite}',
      '@keyframes mkPulse{0%{box-shadow:0 0 0 0 rgba(46,194,107,.5)}70%{box-shadow:0 0 0 7px rgba(46,194,107,0)}100%{box-shadow:0 0 0 0 rgba(46,194,107,0)}}',
      /* hero tour button */
      '#mk-tour-btn{display:inline-flex;align-items:center;gap:9px;padding:14px 20px;border:1px dashed var(--accent);color:var(--accent);background:var(--accent-soft);font-size:14px;font-weight:500;border-radius:2px;cursor:pointer;font-family:inherit}',
      '#mk-tour-btn:hover{background:var(--accent);color:#fff;border-style:solid}',
      /* recruiter tab */
      '#mk-rtab{position:fixed;top:76px;right:16px;z-index:37;display:inline-flex;align-items:center;gap:7px;padding:7px 12px;background:var(--ink);color:var(--bg);border:none;border-radius:100px;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.18)}',
      '#mk-rtab:hover{background:var(--accent);color:#fff}',
      '@media(max-width:820px){#mk-rtab{display:none}}',
      /* TL;DR drawer */
      '#mk-scrim{position:fixed;inset:0;z-index:69;background:rgba(10,10,8,.42);opacity:0;pointer-events:none;transition:opacity .3s}',
      '#mk-scrim.mk-in{opacity:1;pointer-events:auto}',
      '#mk-tldr{position:fixed;top:0;right:0;bottom:0;z-index:70;width:min(430px,92vw);background:var(--bg);border-left:1px solid var(--hair);transform:translateX(102%);transition:transform .38s cubic-bezier(.2,.7,.2,1);overflow-y:auto;padding:26px 26px 40px}',
      '#mk-tldr.mk-in{transform:translateX(0)}',
      '#mk-tldr .mk-h{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:4px}',
      '#mk-tldr h4{font-family:"Instrument Serif",serif;font-weight:400;font-size:28px;letter-spacing:-.02em;margin:0;color:var(--ink)}',
      '#mk-tldr .mk-close{background:none;border:none;color:var(--muted);font-size:22px;line-height:1;cursor:pointer}',
      '#mk-tldr .mk-fit{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin:0 0 18px}',
      '#mk-tldr .mk-sec{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:22px 0 10px}',
      '#mk-tldr ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}',
      '#mk-tldr li{display:flex;gap:10px;font-size:13.5px;line-height:1.5;color:var(--body)}',
      '#mk-tldr li::before{content:"→";color:var(--accent);flex-shrink:0}',
      '#mk-tldr .mk-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}',
      '#mk-tldr .mk-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 16px;font-size:13px;font-weight:500;border-radius:2px;cursor:pointer;text-decoration:none;border:1px solid var(--hair);color:var(--ink);background:var(--panel);font-family:inherit}',
      '#mk-tldr .mk-btn.mk-primary{background:var(--ink);color:var(--bg);border-color:var(--ink)}',
      '#mk-tldr .mk-btn:hover{border-color:var(--accent)}',
      '#mk-tldr .mk-avpill{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:var(--body);background:var(--soft);border:1px solid var(--hair);border-radius:4px;padding:10px 12px}',
      /* tour overlay */
      '#mk-tour{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);z-index:72;opacity:0;pointer-events:none;max-width:min(94vw,540px);',
      'display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--ink);color:var(--bg);border-radius:6px;box-shadow:0 14px 50px rgba(0,0,0,.3);transition:opacity .35s,transform .35s}',
      '#mk-tour.mk-in{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}',
      '#mk-tour .mk-t-n{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.1em;opacity:.6;flex-shrink:0}',
      '#mk-tour .mk-t-cap{font-size:14px;line-height:1.4;flex:1}',
      '#mk-tour button{flex-shrink:0;font-family:"IBM Plex Mono",monospace;font-size:11px;text-transform:uppercase;letter-spacing:.05em;border:1px solid rgba(255,255,255,.3);background:transparent;color:var(--bg);border-radius:2px;padding:7px 11px;cursor:pointer}',
      '#mk-tour button.mk-t-next{background:var(--accent);border-color:var(--accent);color:#fff}',
      '#mk-tour button.mk-t-x{border:none;font-size:15px;padding:6px 8px}',
      '.mk-tour-focus{outline:2px solid var(--accent);outline-offset:6px;transition:outline .3s;scroll-margin-top:90px}',
      /* link builder */
      '#mk-links{position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;background:rgba(10,10,8,.5);padding:20px}',
      '#mk-links.mk-in{display:flex}',
      '#mk-links .mk-card{width:min(440px,94vw);background:var(--bg);border:1px solid var(--hair);border-radius:6px;padding:24px}',
      '#mk-links h4{font-family:"Instrument Serif",serif;font-weight:400;font-size:24px;margin:0 0 4px;color:var(--ink)}',
      '#mk-links p{font-size:12.5px;color:var(--muted);margin:0 0 16px}',
      '#mk-links label{display:block;font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:12px 0 5px}',
      '#mk-links input,#mk-links select{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--hair);background:var(--panel);color:var(--ink);border-radius:2px;font:inherit;font-size:13px}',
      '#mk-links .mk-out{margin-top:16px;padding:10px;background:var(--soft);border:1px dashed var(--hair);border-radius:2px;font-family:"IBM Plex Mono",monospace;font-size:11.5px;word-break:break-all;color:var(--accent)}',
      '#mk-links .mk-row{display:flex;gap:10px;margin-top:14px}',
      '#mk-links .mk-btn{flex:1;text-align:center;padding:11px;border-radius:2px;cursor:pointer;font-size:12.5px;border:1px solid var(--hair);background:var(--panel);color:var(--ink)}',
      '#mk-links .mk-btn.mk-primary{background:var(--ink);color:var(--bg);border-color:var(--ink)}',
      '[dir="rtl"] #mk-tldr{right:auto;left:0;border-left:none;border-right:1px solid var(--hair);transform:translateX(-102%)}',
      '[dir="rtl"] #mk-tldr.mk-in{transform:translateX(0)}',
      '[dir="rtl"] #mk-rtab{right:auto;left:16px}'
    ].join('');
    document.head.appendChild(s);
  }

  /* -------------------------------------------------------------------------- */
  /* 1. analytics: GoatCounter (loaded only when configured)                    */
  /* -------------------------------------------------------------------------- */
  function initAnalytics() {
    if (isLocal || !CFG.goatcounter || CFG.goatcounter.indexOf('GOATCOUNTER') === 0) return;
    var g = el('script', {
      async: 'async',
      'data-goatcounter': 'https://' + CFG.goatcounter + '.goatcounter.com/count',
      src: '//gc.zgo.at/count.js'
    });
    document.head.appendChild(g);

    // SPA: count hash route changes too
    window.addEventListener('hashchange', function () {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: location.pathname + location.search + location.hash });
      }
    });

    // fold tracking-link identity into analytics as a campaign event
    if (P.to) {
      var t = 0, ci = setInterval(function () {
        t++;
        if (window.goatcounter && window.goatcounter.count) {
          window.goatcounter.count({
            path: 'campaign/' + slug(P.to) + (P.via ? '-' + slug(P.via) : ''),
            title: P.to + (P.via ? ' via ' + P.via : ''),
            event: true
          });
          clearInterval(ci);
        }
        if (t > 60) clearInterval(ci);
      }, 250);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 2. real-time phone push via ntfy.sh (once per session)                     */
  /* -------------------------------------------------------------------------- */
  function initNotify() {
    if (isLocal) return;
    if (!CFG.ntfyTopic || CFG.ntfyTopic.indexOf('CHANGE-ME') > -1) return;
    if (ss('mk_notified')) return;
    ss('mk_notified', '1');

    function device() {
      var ua = navigator.userAgent;
      if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
      if (/Android/.test(ua)) return 'Android';
      if (/Mac/.test(ua)) return 'Mac';
      if (/Windows/.test(ua)) return 'Windows';
      if (/Linux/.test(ua)) return 'Linux';
      return 'device';
    }
    function send(geo) {
      var who = P.to ? ('🎯 ' + P.to + (P.via ? ' (via ' + P.via + ')' : '')) : '👀 A visitor';
      var bits = [];
      if (P.role) bits.push('role: ' + P.role);
      if (document.referrer) { try { bits.push('from ' + new URL(document.referrer).hostname); } catch (e) {} }
      if (geo) bits.push(geo);
      bits.push(device());
      try { bits.push(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (e) {}
      var body = who + ' just opened your portfolio\n· ' + bits.join(' · ');
      try {
        fetch('https://ntfy.sh/' + CFG.ntfyTopic, {
          method: 'POST',
          body: body,
          headers: {
            'Title': P.to ? ('Recruiter visit — ' + P.to) : 'Portfolio visit',
            'Priority': P.to ? 'high' : 'default',
            'Tags': P.to ? 'dart,eyes' : 'eyes'
          }
        });
      } catch (e) {}
    }
    if (CFG.geoLookup) {
      var done = false, finish = function (g) { if (done) return; done = true; send(g); };
      setTimeout(function () { finish(''); }, 2500);
      try {
        fetch('https://ipapi.co/json/').then(function (r) { return r.json(); })
          .then(function (d) { finish([d.city, d.country_name].filter(Boolean).join(', ')); })
          .catch(function () { finish(''); });
      } catch (e) { finish(''); }
    } else {
      send('');
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 3. greeting banner (only with ?to=)                                        */
  /* -------------------------------------------------------------------------- */
  function initGreeting() {
    if (!P.to || ss('mk_greet_x') || document.getElementById('mk-greet')) return;
    var viaPart = P.via ? (' — thanks for coming via ' + P.via) : '';
    var g = el('div', { id: 'mk-greet' },
      '<span class="mk-g-dot"></span>' +
      '<span class="mk-g-txt">Hi <b>' + P.to + '</b>' + viaPart +
        '. Here’s the work most relevant to you.</span>' +
      '<button class="mk-g-cta">30-sec brief →</button>' +
      '<button class="mk-g-x" aria-label="Dismiss">×</button>');
    document.body.appendChild(g);
    g.querySelector('.mk-g-cta').addEventListener('click', openTLDR);
    g.querySelector('.mk-g-x').addEventListener('click', function () {
      ss('mk_greet_x', '1'); g.classList.remove('mk-in');
      setTimeout(function () { g.remove(); }, 500);
    });
    setTimeout(function () { g.classList.add('mk-in'); }, 450);
  }

  /* -------------------------------------------------------------------------- */
  /* 4. recruiter tab + TL;DR drawer                                            */
  /* -------------------------------------------------------------------------- */
  function buildTLDR() {
    if (document.getElementById('mk-tldr')) return;
    var scrim = el('div', { id: 'mk-scrim' });
    var d = el('div', { id: 'mk-tldr', role: 'dialog', 'aria-label': 'Recruiter summary' });
    var cvHref = CVHREF || '#resume';
    var winsHtml = CFG.wins.map(function (w) { return '<li>' + w + '</li>'; }).join('');
    d.innerHTML =
      '<div class="mk-h"><h4>The 30-second brief</h4><button class="mk-close" aria-label="Close">×</button></div>' +
      '<p class="mk-fit">' + (CFG.roleFit[P.role] || CFG.roleFit['']) + '</p>' +
      '<div class="mk-avpill"><span style="width:7px;height:7px;border-radius:50%;background:#2ec26b;flex-shrink:0"></span>' + CFG.availability + '</div>' +
      '<div class="mk-sec">Three things worth knowing</div>' +
      '<ul>' + winsHtml + '</ul>' +
      '<div class="mk-sec">Next step</div>' +
      '<div class="mk-row">' +
        '<a class="mk-btn mk-primary" href="' + cvHref + '"' + (CVHREF ? ' download' : '') + '>Download CV ↓</a>' +
        '<a class="mk-btn" href="mailto:' + CFG.contactEmail + '">Email me</a>' +
        '<button class="mk-btn" id="mk-tldr-tour">Show me the best bits</button>' +
      '</div>';
    document.body.appendChild(scrim);
    document.body.appendChild(d);
    scrim.addEventListener('click', closeTLDR);
    d.querySelector('.mk-close').addEventListener('click', closeTLDR);
    d.querySelector('#mk-tldr-tour').addEventListener('click', function () { closeTLDR(); startTour(); });
  }
  function openTLDR() { buildTLDR(); document.getElementById('mk-scrim').classList.add('mk-in'); document.getElementById('mk-tldr').classList.add('mk-in'); }
  function closeTLDR() {
    var s = document.getElementById('mk-scrim'), d = document.getElementById('mk-tldr');
    if (s) s.classList.remove('mk-in'); if (d) d.classList.remove('mk-in');
  }
  function initRTab() {
    if (document.getElementById('mk-rtab')) return;
    var b = el('button', { id: 'mk-rtab' }, '✦ Recruiter view');
    b.addEventListener('click', openTLDR);
    document.body.appendChild(b);
  }

  /* -------------------------------------------------------------------------- */
  /* 5. guided highlights tour                                                  */
  /* -------------------------------------------------------------------------- */
  var tourIdx = -1, tourEl = null, lastFocus = null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tourGo(i) {
    if (i < 0 || i >= CFG.tour.length) return endTour();
    if (lastFocus) lastFocus.classList.remove('mk-tour-focus');
    tourIdx = i;
    var step = CFG.tour[i], target = document.querySelector(step.sel);
    if (target) {
      if (target.scrollIntoView) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      target.classList.add('mk-tour-focus'); lastFocus = target;
    }
    tourEl.querySelector('.mk-t-n').textContent = (i + 1) + ' / ' + CFG.tour.length;
    tourEl.querySelector('.mk-t-cap').textContent = step.cap;
    tourEl.querySelector('.mk-t-next').textContent = (i === CFG.tour.length - 1) ? 'Done' : 'Next →';
  }
  function startTour() {
    if (!tourEl) {
      tourEl = el('div', { id: 'mk-tour' },
        '<span class="mk-t-n"></span><span class="mk-t-cap"></span>' +
        '<button class="mk-t-prev">←</button>' +
        '<button class="mk-t-next">Next →</button>' +
        '<button class="mk-t-x" aria-label="End tour">×</button>');
      document.body.appendChild(tourEl);
      tourEl.querySelector('.mk-t-prev').addEventListener('click', function () { tourGo(tourIdx - 1); });
      tourEl.querySelector('.mk-t-next').addEventListener('click', function () { tourGo(tourIdx + 1); });
      tourEl.querySelector('.mk-t-x').addEventListener('click', endTour);
    }
    tourEl.classList.add('mk-in');
    tourGo(0);
  }
  function endTour() {
    if (lastFocus) { lastFocus.classList.remove('mk-tour-focus'); lastFocus = null; }
    if (tourEl) tourEl.classList.remove('mk-in');
    tourIdx = -1;
  }

  /* -------------------------------------------------------------------------- */
  /* 6. link builder (#/links) — private helper for building tracking URLs      */
  /* -------------------------------------------------------------------------- */
  function buildLinks() {
    if (document.getElementById('mk-links')) return;
    var m = el('div', { id: 'mk-links' });
    m.innerHTML =
      '<div class="mk-card">' +
        '<h4>Tracking-link builder</h4>' +
        '<p>Send each recruiter a unique link for a personal greeting + attribution.</p>' +
        '<label>Company / person</label><input id="mk-l-to" placeholder="Google">' +
        '<label>Channel</label><input id="mk-l-via" placeholder="linkedin">' +
        '<label>Role framing</label>' +
        '<select id="mk-l-role"><option value="">— none —</option><option value="ml">ML Engineer</option>' +
          '<option value="ds">Data Science</option><option value="fs">Full-stack</option><option value="auto">AI Automation</option></select>' +
        '<div class="mk-out" id="mk-l-out"></div>' +
        '<div class="mk-row"><button class="mk-btn mk-primary" id="mk-l-copy">Copy link</button>' +
          '<button class="mk-btn" id="mk-l-close">Close</button></div>' +
      '</div>';
    document.body.appendChild(m);
    var to = m.querySelector('#mk-l-to'), via = m.querySelector('#mk-l-via'),
        role = m.querySelector('#mk-l-role'), out = m.querySelector('#mk-l-out');
    function rebuild() {
      var base = location.origin + location.pathname;
      var qs = [];
      if (to.value.trim()) qs.push('to=' + encodeURIComponent(to.value.trim()));
      if (via.value.trim()) qs.push('via=' + encodeURIComponent(via.value.trim()));
      if (role.value) qs.push('role=' + role.value);
      out.textContent = base + (qs.length ? '?' + qs.join('&') : '') + '#/';
    }
    [to, via].forEach(function (i) { i.addEventListener('input', rebuild); });
    role.addEventListener('change', rebuild);
    m.querySelector('#mk-l-copy').addEventListener('click', function () {
      try { navigator.clipboard.writeText(out.textContent); this.textContent = 'Copied ✓'; var b = this; setTimeout(function () { b.textContent = 'Copy link'; }, 1400); } catch (e) {}
    });
    m.querySelector('#mk-l-close').addEventListener('click', function () { location.hash = '#/'; });
    rebuild();
  }
  function syncLinksRoute() {
    var open = location.hash.indexOf('#/links') === 0;
    if (open) buildLinks();
    var m = document.getElementById('mk-links');
    if (m) m.classList.toggle('mk-in', open);
  }

  /* -------------------------------------------------------------------------- */
  /* 7. in-flow tweaks re-applied on every render (availability, role, tour btn)*/
  /* -------------------------------------------------------------------------- */
  function enhanceFramework() {
    var h1 = document.querySelector('[data-r="hero"] h1');
    if (!h1) return; // not on home

    // availability pill in the hero eyebrow
    var eyebrow = h1.previousElementSibling;
    if (eyebrow && !eyebrow.querySelector('#mk-avail')) {
      eyebrow.appendChild(el('span', { id: 'mk-avail' },
        '<span class="mk-live"></span>' + CFG.availability));
    }

    // role headline reframe
    if (P.role && CFG.roleHeadline[P.role] && h1.getAttribute('data-mk-role') !== P.role) {
      h1.innerHTML = CFG.roleHeadline[P.role].replace('<em>', '<em style="font-style:italic;color:var(--accent)">');
      h1.setAttribute('data-mk-role', P.role);
    }

    // CTA row: tour button + role-specific CV target (anchored to the hero's "See the work" link)
    var seeWork = h1.parentElement && h1.parentElement.querySelector('a[href="#work"]');
    var ctaRow = seeWork && seeWork.parentElement;
    if (ctaRow) {
      if (!ctaRow.querySelector('#mk-tour-btn')) {
        var tb = el('button', { id: 'mk-tour-btn', type: 'button' }, '✦ Show me the best bits');
        tb.addEventListener('click', startTour);
        ctaRow.appendChild(tb);
      }
      if (CVHREF) {
        var cvLink = ctaRow.querySelector('a[href="#resume"]');
        if (cvLink && cvLink.getAttribute('href') !== CVHREF) {
          cvLink.setAttribute('href', CVHREF); cvLink.setAttribute('download', '');
        }
      }
    }

    // reorder work cards per role
    if (P.role && CFG.roleProjects[P.role]) {
      var grid = document.querySelector('[data-r="work"]');
      if (grid && grid.getAttribute('data-mk-ordered') !== P.role) {
        var order = CFG.roleProjects[P.role];
        var cards = Array.prototype.slice.call(grid.querySelectorAll('a[href^="#/project/"]'));
        if (cards.length) {
          cards.sort(function (a, b) {
            function rank(x) { var s = x.getAttribute('href').replace('#/project/', ''); var i = order.indexOf(s); return i < 0 ? 99 : i; }
            return rank(a) - rank(b);
          });
          cards.forEach(function (c) { grid.appendChild(c); });
          grid.setAttribute('data-mk-ordered', P.role);
        }
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /* boot                                                                       */
  /* -------------------------------------------------------------------------- */
  function boot() {
    injectStyle();
    initAnalytics();
    initNotify();
    initGreeting();
    initRTab();
    syncLinksRoute();

    // keep in-flow tweaks alive across app re-renders (debounced, idempotent)
    var pending = false;
    function schedule() { if (pending) return; pending = true; setTimeout(function () { pending = false; enhanceFramework(); }, 120); }
    enhanceFramework();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });

    window.addEventListener('hashchange', function () { syncLinksRoute(); schedule(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeTLDR(); endTour(); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

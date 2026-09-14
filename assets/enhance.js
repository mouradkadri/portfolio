/* =============================================================================
 * enhance.js — visitor analytics + curated "best bits" highlights reel
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

    /* --- availability signal (date computed, never hardcoded stale) --- */
    availableFrom: '2026-06',                         // YYYY-MM you become available
    availabilitySuffix: 'ML / AI Engineering · Tunis · EU',

    /* --- role framing (?role=ml|ds|fs|auto) — invisible unless the param is set --- */
    roleHeadline: {
      ml:  'I build machine learning systems that <em>run in production</em>, not in notebooks.',
      ds:  'I turn messy, real-world data into <em>decisions teams trust</em>.',
      fs:  'I ship <em>full-stack products</em> with ML at the core, not bolted on.',
      auto:'I design <em>autonomous agents</em> that close the loop, no human in the seat.'
    },
    /* home shows these 5 cards; order them per role (by project slug) */
    roleProjects: {
      ml:  ['bte-voice-agent', 'exaq-ocr', 'erp-rag-agent', 'ai-resource-hub', 'goosejobs'],
      ds:  ['exaq-ocr', 'bte-voice-agent', 'goosejobs', 'erp-rag-agent', 'ai-resource-hub'],
      fs:  ['goosejobs', 'ai-resource-hub', 'erp-rag-agent', 'bte-voice-agent', 'exaq-ocr'],
      auto:['bte-voice-agent', 'erp-rag-agent', 'ai-resource-hub', 'exaq-ocr', 'goosejobs']
    },
    roleCV: { ml: 'cvML', ds: 'cvDS', fs: 'cvFS', auto: 'cvAuto' },

    /* curated highlights reel — the real "best bits" */
    reel: [
      {
        kicker: 'Banque de Tunisie et des Émirats · production',
        title: 'An autonomous voice agent that collects debt',
        blurb: 'Calls debtors, authenticates them, negotiates payment and closes the loop — entirely on-premises, no human in the seat.',
        metrics: ['1.05 s end-to-end', '98.1% intent F1', '39 intents', 'on-prem'],
        href: '#/project/bte-voice-agent'
      },
      {
        kicker: 'Exaq · document intelligence',
        title: 'OCR that erases manual data entry',
        blurb: 'A YOLOv13 + TrOCR pipeline that reads real-world forms and hands structured fields straight to the ERP.',
        metrics: ['97% field accuracy', '−85% entry time', 'YOLOv13 + TrOCR'],
        href: '#/project/exaq-ocr'
      },
      {
        kicker: 'Breadth · shipped, not shelved',
        title: '11 projects across the ML stack',
        blurb: 'RAG systems, an MLOps pipeline, and GooseJobs — a SaaS side project running in the wild.',
        metrics: ['11 projects', 'RAG · MLOps', 'GooseJobs SaaS'],
        href: '#/project/goosejobs'
      },
      {
        kicker: 'The numbers, in one place',
        title: 'Impact at a glance',
        blurb: 'Every claim here is backed by a shipped system. Grab the CV or reach out — I reply fast.',
        metrics: ['1.05 s', '98.1%', '97%', '11 projects'],
        href: '#resume',
        cta: 'See the CV →'
      }
    ]
  };

  /* -------------------------------------------------------------------------- */
  /* helpers                                                                    */
  /* -------------------------------------------------------------------------- */
  var isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:';
  function clean(s) { return (s || '').replace(/[<>"'`]/g, '').trim().slice(0, 60); }
  function slug(s)  { return clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} }
  function esc(s)   { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'style') n.style.cssText = attrs[k]; else n.setAttribute(k, attrs[k]); }
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* Availability text, computed from today's date so it never goes stale. */
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function availabilityText() {
    var m = /^(\d{4})-(\d{2})$/.exec(CFG.availableFrom || '');
    var lead = 'Available now';
    if (m) {
      var target = new Date(+m[1], +m[2] - 1, 1);
      var now = new Date(), cur = new Date(now.getFullYear(), now.getMonth(), 1);
      if (cur < target) lead = 'Available ' + MONTHS[+m[2] - 1] + ' ' + m[1];
    }
    return CFG.availabilitySuffix ? (lead + ' · ' + CFG.availabilitySuffix) : lead;
  }

  var params = new URLSearchParams(location.search);
  var P = {
    to:   clean(params.get('to')),
    via:  clean(params.get('via')),
    role: (function () { var r = slug(params.get('role')); return CFG.roleHeadline[r] ? r : ''; })()
  };
  var CVKEY = P.role && CFG.roleCV[P.role];
  var CVHREF = (CVKEY && window.__resources && window.__resources[CVKEY]) || null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------------------------------- */
  /* styles                                                                     */
  /* -------------------------------------------------------------------------- */
  function injectStyle() {
    if (document.getElementById('mk-enhance-style')) return;
    var s = el('style', { id: 'mk-enhance-style' });
    s.textContent = [
      /* availability pill (injected into hero eyebrow) */
      '#mk-avail{display:inline-flex;align-items:center;gap:7px;padding:4px 10px;border:1px solid var(--hair);border-radius:100px;background:var(--soft);font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.04em;text-transform:none;color:var(--body);white-space:nowrap}',
      '#mk-avail .mk-live{width:7px;height:7px;border-radius:50%;background:#2ec26b;box-shadow:0 0 0 0 rgba(46,194,107,.5);animation:mkPulse 2s infinite}',
      '@keyframes mkPulse{0%{box-shadow:0 0 0 0 rgba(46,194,107,.5)}70%{box-shadow:0 0 0 7px rgba(46,194,107,0)}100%{box-shadow:0 0 0 0 rgba(46,194,107,0)}}',
      /* hero "best bits" button */
      '#mk-reel-btn{display:inline-flex;align-items:center;gap:9px;padding:14px 20px;min-height:44px;border:1px dashed var(--accent);color:var(--accent);background:var(--accent-soft);font-size:14px;font-weight:500;border-radius:2px;cursor:pointer;font-family:inherit;transition:background .2s ease,color .2s ease,border-color .2s ease}',
      '#mk-reel-btn:hover{background:var(--accent);color:#fff;border-style:solid}',
      '#mk-reel-btn .mk-spark{transition:transform .4s cubic-bezier(.2,.7,.2,1)}',
      '#mk-reel-btn:hover .mk-spark{transform:rotate(90deg) scale(1.15)}',
      /* reel overlay */
      '#mk-reel{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(10,10,8,.62);opacity:0;transition:opacity .32s ease}',
      '#mk-reel.mk-in{display:flex;opacity:1}',
      '#mk-reel .mk-card{position:relative;width:min(560px,96vw);max-height:92vh;overflow-y:auto;background:var(--bg);border:1px solid var(--hair);border-radius:8px;box-shadow:0 24px 80px rgba(0,0,0,.42);padding:30px 30px 24px;transform:translateY(14px) scale(.985);transition:transform .32s cubic-bezier(.2,.7,.2,1)}',
      '#mk-reel.mk-in .mk-card{transform:none}',
      '#mk-reel .mk-x{position:absolute;top:12px;right:12px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:none;border:none;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;border-radius:2px}',
      '#mk-reel .mk-x:hover{color:var(--ink);background:var(--soft)}',
      '#mk-reel .mk-kick{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 40px 12px 0}',
      '#mk-reel h4{font-family:"Instrument Serif",serif;font-weight:400;font-size:clamp(26px,4.4vw,34px);line-height:1.05;letter-spacing:-.02em;margin:0 0 12px;color:var(--ink)}',
      '#mk-reel .mk-blurb{font-size:14.5px;line-height:1.6;color:var(--body);margin:0 0 18px}',
      '#mk-reel .mk-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px}',
      '#mk-reel .mk-chip{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.03em;color:var(--ink);background:var(--soft);border:1px solid var(--hair);border-radius:100px;padding:6px 11px;opacity:0;transform:translateY(6px);animation:mkChip .4s ease forwards}',
      '@keyframes mkChip{to{opacity:1;transform:none}}',
      '#mk-reel .mk-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:16px}',
      '#mk-reel .mk-see{display:inline-flex;align-items:center;gap:8px;padding:11px 16px;min-height:44px;background:var(--ink);color:var(--bg);border:1px solid var(--ink);font-size:13px;font-weight:500;border-radius:2px;text-decoration:none;cursor:pointer}',
      '#mk-reel .mk-see:hover{background:var(--accent);border-color:var(--accent);color:#fff}',
      '#mk-reel .mk-nav{margin-left:auto;display:flex;align-items:center;gap:8px}',
      '#mk-reel .mk-arrow{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:1px solid var(--hair);background:var(--panel);color:var(--ink);font-size:15px;cursor:pointer;border-radius:2px}',
      '#mk-reel .mk-arrow:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}',
      '#mk-reel .mk-arrow:disabled{opacity:.35;cursor:default}',
      '#mk-reel .mk-dots{display:flex;gap:7px;margin:16px 0 2px;justify-content:center}',
      '#mk-reel .mk-dot{width:8px;height:8px;padding:0;border-radius:50%;border:1px solid var(--hair);background:transparent;cursor:pointer;transition:background .2s,border-color .2s,transform .2s}',
      '#mk-reel .mk-dot.on{background:var(--accent);border-color:var(--accent);transform:scale(1.25)}',
      '@media (prefers-reduced-motion: reduce){#mk-reel,#mk-reel .mk-card{transition:none}#mk-reel .mk-chip{animation:none;opacity:1;transform:none}}',
      '@media (max-width:520px){#mk-reel .mk-card{padding:26px 20px 20px}#mk-reel .mk-foot{gap:10px}#mk-reel .mk-see{flex:1;justify-content:center}#mk-reel .mk-nav{margin-left:0;width:100%;justify-content:flex-end}}',

      /* --- scroll progress bar (JS-driven scaleX) --- */
      '#mk-scrollbar{position:fixed;top:0;left:0;right:0;height:3px;z-index:85;transform:scaleX(0);transform-origin:0 50%;background:linear-gradient(90deg,var(--accent),var(--warm,var(--accent)));box-shadow:0 0 8px var(--accent-soft);will-change:transform;pointer-events:none}',

      /* --- scroll-driven reveals (CSS view-timeline; degrades to no-op) ---------
         Uses the independent `translate` property so element `transform` (hover
         lift on work cards) is never overridden by the finished animation. */
      '@keyframes mkReveal{from{opacity:0;translate:0 30px}to{opacity:1;translate:0 0}}',
      '@keyframes mkRevealSm{from{opacity:0;translate:0 18px}to{opacity:1;translate:0 0}}',
      '@keyframes mkZoom{from{opacity:0;scale:.965}to{opacity:1;scale:1}}',
      '@supports (animation-timeline: view()){@media (prefers-reduced-motion: no-preference){',
        '[data-r="wcard"]{animation:mkReveal linear both;animation-timeline:view();animation-range:entry 2% cover 22%}',
        '[data-r="wrap"] section > div:first-child h2{animation:mkRevealSm linear both;animation-timeline:view();animation-range:entry 0% entry 60%}',
        'image-slot:not(#hero-portrait){animation:mkZoom linear both;animation-timeline:view();animation-range:entry 4% cover 20%}',
        '[data-r="pstats"] > *,[data-r="edu"] > *{animation:mkRevealSm linear both;animation-timeline:view();animation-range:entry 2% entry 65%}',
      '}}'
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
  /* 3. curated "best bits" highlights reel (body-level; re-render immune)       */
  /* -------------------------------------------------------------------------- */
  var reelIdx = 0, reelEl = null, lastFocus = null, touchX = null;

  function buildReel() {
    if (reelEl) return reelEl;
    reelEl = el('div', { id: 'mk-reel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Highlights' });
    reelEl.innerHTML =
      '<div class="mk-card" tabindex="-1">' +
        '<button class="mk-x" aria-label="Close">×</button>' +
        '<p class="mk-kick"></p>' +
        '<h4></h4>' +
        '<p class="mk-blurb"></p>' +
        '<div class="mk-chips"></div>' +
        '<div class="mk-foot">' +
          '<a class="mk-see" href="#"></a>' +
          '<div class="mk-nav">' +
            '<button class="mk-arrow mk-prev" aria-label="Previous">←</button>' +
            '<button class="mk-arrow mk-next" aria-label="Next">→</button>' +
          '</div>' +
        '</div>' +
        '<div class="mk-dots" role="tablist"></div>' +
      '</div>';
    document.body.appendChild(reelEl);

    reelEl.addEventListener('click', function (e) { if (e.target === reelEl) closeReel(); });
    reelEl.querySelector('.mk-x').addEventListener('click', closeReel);
    reelEl.querySelector('.mk-prev').addEventListener('click', function () { reelGo(reelIdx - 1); });
    reelEl.querySelector('.mk-next').addEventListener('click', function () { reelGo(reelIdx + 1); });
    reelEl.querySelector('.mk-see').addEventListener('click', function () {
      // let the browser follow the hash link, but close the overlay first
      closeReel();
    });

    // swipe on touch devices
    var card = reelEl.querySelector('.mk-card');
    card.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    card.addEventListener('touchend', function (e) {
      if (touchX == null) return;
      var dx = e.changedTouches[0].clientX - touchX; touchX = null;
      if (Math.abs(dx) > 45) reelGo(reelIdx + (dx < 0 ? 1 : -1));
    }, { passive: true });

    return reelEl;
  }

  function reelGo(i) {
    var reel = CFG.reel;
    if (i < 0) i = 0; if (i >= reel.length) i = reel.length - 1;
    reelIdx = i;
    var it = reel[i];
    reelEl.querySelector('.mk-kick').textContent = it.kicker || '';
    reelEl.querySelector('h4').textContent = it.title || '';
    reelEl.querySelector('.mk-blurb').textContent = it.blurb || '';
    var chips = reelEl.querySelector('.mk-chips');
    chips.innerHTML = (it.metrics || []).map(function (m, k) {
      return '<span class="mk-chip" style="animation-delay:' + (reduce ? 0 : k * 55) + 'ms">' + esc(m) + '</span>';
    }).join('');
    var see = reelEl.querySelector('.mk-see');
    var href = it.href || '#';
    // role-specific CV download when the slide points at the resume section
    if (it.href === '#resume' && CVHREF) { href = CVHREF; see.setAttribute('download', ''); }
    else { see.removeAttribute('download'); }
    see.setAttribute('href', href);
    see.textContent = it.cta || 'See project →';
    reelEl.querySelector('.mk-prev').disabled = (i === 0);
    reelEl.querySelector('.mk-next').disabled = (i === reel.length - 1);
    // dots
    var dots = reelEl.querySelector('.mk-dots');
    dots.innerHTML = reel.map(function (_, k) {
      return '<button class="mk-dot' + (k === i ? ' on' : '') + '" role="tab" aria-label="Highlight ' + (k + 1) + '" data-k="' + k + '"></button>';
    }).join('');
    Array.prototype.forEach.call(dots.querySelectorAll('.mk-dot'), function (d) {
      d.addEventListener('click', function () { reelGo(+d.getAttribute('data-k')); });
    });
  }

  function openReel() {
    buildReel();
    lastFocus = document.activeElement;
    reelIdx = 0; reelGo(0);
    reelEl.classList.add('mk-in');
    setTimeout(function () { var c = reelEl.querySelector('.mk-card'); if (c) c.focus(); }, 40);
  }
  function closeReel() {
    if (!reelEl) return;
    reelEl.classList.remove('mk-in');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }
  function reelOpen() { return reelEl && reelEl.classList.contains('mk-in'); }

  /* -------------------------------------------------------------------------- */
  /* 4. scroll progress bar (body-level, rAF-throttled, re-render immune)        */
  /* -------------------------------------------------------------------------- */
  function initScrollBar() {
    var bar = document.getElementById('mk-scrollbar');
    if (!bar) { bar = el('div', { id: 'mk-scrollbar', 'aria-hidden': 'true' }); document.body.appendChild(bar); }
    var ticking = false;
    function paint() {
      ticking = false;
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    paint();
  }

  /* -------------------------------------------------------------------------- */
  /* 5. in-flow tweaks re-applied on every render (availability, role, button)  */
  /* -------------------------------------------------------------------------- */
  function enhanceFramework() {
    var h1 = document.querySelector('[data-r="hero"] h1');
    if (!h1) return; // not on home

    var avail = availabilityText();

    // availability pill in the hero eyebrow
    var eyebrow = h1.previousElementSibling;
    if (eyebrow && !eyebrow.querySelector('#mk-avail')) {
      eyebrow.appendChild(el('span', { id: 'mk-avail' }, '<span class="mk-live"></span>' + esc(avail)));
    }

    // role headline reframe (only with ?role=)
    if (P.role && CFG.roleHeadline[P.role] && h1.getAttribute('data-mk-role') !== P.role) {
      h1.innerHTML = CFG.roleHeadline[P.role].replace('<em>', '<em style="font-style:italic;color:var(--accent)">');
      h1.setAttribute('data-mk-role', P.role);
    }

    // CTA row: "best bits" button + role-specific CV target
    var seeWork = h1.parentElement && h1.parentElement.querySelector('a[href="#work"]');
    var ctaRow = seeWork && seeWork.parentElement;
    if (ctaRow) {
      if (!ctaRow.querySelector('#mk-reel-btn')) {
        // No per-node listener: a delegated document handler (see boot) owns the click,
        // so the button keeps working even as the framework re-renders this subtree.
        ctaRow.appendChild(el('button', { id: 'mk-reel-btn', type: 'button' },
          '<span class="mk-spark" aria-hidden="true">✦</span> Show me the best bits'));
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
    initScrollBar();

    // keep in-flow tweaks alive across app re-renders (debounced, idempotent)
    var pending = false;
    function schedule() { if (pending) return; pending = true; setTimeout(function () { pending = false; enhanceFramework(); }, 120); }
    enhanceFramework();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });

    window.addEventListener('hashchange', schedule);

    // delegated click: survives every hero re-render (the old per-node listener didn't)
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('#mk-reel-btn')) { e.preventDefault(); openReel(); }
    });

    // keyboard: Esc closes, arrows navigate while the reel is open
    document.addEventListener('keydown', function (e) {
      if (!reelOpen()) return;
      if (e.key === 'Escape') closeReel();
      else if (e.key === 'ArrowRight') reelGo(reelIdx + 1);
      else if (e.key === 'ArrowLeft') reelGo(reelIdx - 1);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

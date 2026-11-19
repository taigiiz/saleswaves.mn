/* Saleswaves v2 — interface: loader, intro, scroll state, reveals, i18n, form. */
(function () {
  'use strict';
  window.SWUI = true;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const S = (window.SWState = window.SWState || { scroll: 0, hero: 0, route: 0, globe: 0 });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  if (G && ST) G.registerPlugin(ST);
  if (!G) root.classList.remove('js');

  /* ---------------- Language ---------------- */
  const dict = window.SW_I18N || { en: {}, mn: {} };
  const i18nEls = $$('[data-i18n]');
  i18nEls.forEach((el) => { el.dataset.mn = el.innerHTML; });
  const mnTitle = document.title;
  let lang = 'mn';
  try {
    const q = new URLSearchParams(location.search).get('lang');
    lang = q === 'en' || q === 'mn' ? q : (localStorage.getItem('sw-lang') || 'mn');
  } catch (e) { /* storage unavailable */ }

  function applyLang(l) {
    lang = l === 'en' ? 'en' : 'mn';
    i18nEls.forEach((el) => {
      const v = lang === 'en' ? dict.en[el.dataset.i18n] : el.dataset.mn;
      if (v != null) el.innerHTML = v;
    });
    root.lang = lang;
    document.title = lang === 'en' ? dict.en._title : mnTitle;
    $('#langToggle').textContent = lang === 'en' ? 'MN' : 'EN';
    fillMarquee();
    splitTitle();
    try { localStorage.setItem('sw-lang', lang); } catch (e) { /* ignore */ }
  }

  /* ---------------- Marquee (duplicate for seamless loop) ---------------- */
  function fillMarquee() {
    const tr = $('.marquee__track');
    if (!tr) return;
    const base = tr.innerHTML.split('<!--dup-->')[0];
    tr.innerHTML = base + '<!--dup-->' + base;
  }

  /* ---------------- Hero title split into words ---------------- */
  const title = $('#heroTitle');
  function splitTitle() {
    if (!title) return;
    const frag = document.createDocumentFragment();
    const wrap = (word, em) => {
      const w = document.createElement('span'); w.className = 'w';
      const inner = document.createElement('span');
      if (em) { const e = document.createElement('em'); e.textContent = word; inner.appendChild(e); }
      else inner.textContent = word;
      w.appendChild(inner);
      return w;
    };
    Array.from(title.childNodes).forEach((n) => {
      const isEm = n.nodeType === 1 && n.tagName === 'EM';
      const text = n.textContent;
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
        else frag.appendChild(wrap(part, isEm));
      });
    });
    title.innerHTML = '';
    title.appendChild(frag);
    title.style.visibility = 'visible';
  }

  /* ---------------- Loader + intro ---------------- */
  const loader = $('#loader');
  const bar = $('#loaderBar');
  let introDone = false;
  if (bar) requestAnimationFrame(() => { bar.style.width = '45%'; });

  function intro() {
    if (introDone) return;
    introDone = true;
    if (bar) bar.style.width = '100%';
    setTimeout(() => {
      loader && loader.classList.add('is-done');
      document.body.classList.remove('is-loading');
      if (!G || reduce) {
        $$('[data-hero]').forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
        return;
      }
      const tl = G.timeline({ defaults: { ease: 'expo.out' } });
      tl.from('#heroTitle .w > span', { yPercent: 110, rotate: 4, duration: 1.3, stagger: 0.07 }, 0.1)
        .to('[data-hero]', { opacity: 1, y: 0, duration: 1.2, stagger: 0.1 }, 0.25)
        .from('.nav__inner', { y: -30, opacity: 0, duration: 1 }, 0.2);
    }, 250);
  }

  applyLang(lang);
  if (window.SWSceneReady) setTimeout(intro, 300);
  else window.addEventListener('sw:ready', () => setTimeout(intro, 300), { once: true });
  setTimeout(intro, 2600); // never block on WebGL

  $('#langToggle').addEventListener('click', () => {
    applyLang(lang === 'en' ? 'mn' : 'en');
    if (G && !reduce) G.from('#heroTitle .w > span', { yPercent: 110, duration: 0.9, stagger: 0.05, ease: 'expo.out' });
    ST && ST.refresh();
  });

  /* ---------------- Nav ---------------- */
  const nav = $('#nav');
  const burger = $('#burger');
  burger.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });
  $$('#mnav a').forEach((a) => a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }));

  const navLinks = $$('.nav__links a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);

  /* ---------------- Scroll state (drives the WebGL scene) ---------------- */
  const route = $('#route');
  const steps = $$('#steps .step');
  const meter = $('#routeMeter');
  const progress = $('#progressBar');
  let lastY = 0, ticking = false, activeStep = -1;

  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    S.scroll = max > 0 ? y / max : 0;
    S.hero = y / vh;
    if (progress) progress.style.transform = `scaleX(${S.scroll})`;

    nav.classList.toggle('is-solid', y > 30);
    if (!nav.classList.contains('is-open')) nav.classList.toggle('is-hidden', y > 700 && y > lastY + 2);
    if (y < lastY - 2) nav.classList.remove('is-hidden');
    lastY = y;

    if (route) {
      const r = route.getBoundingClientRect();
      const total = r.height - vh;
      const p = Math.min(1, Math.max(0, -r.top / total));
      S.route = p;
      S.globe = r.top < vh * 0.55 && r.bottom > vh * 0.45 ? 1 : 0;
      const idx = Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999));
      if (idx !== activeStep) {
        activeStep = idx;
        steps.forEach((s, i) => {
          s.classList.toggle('is-active', i === idx);
          s.classList.toggle('is-done', i < idx);
        });
      }
      if (meter) meter.style.transform = `scaleX(${p})`;
    }

    let current = null;
    sections.forEach((sec, i) => {
      const b = sec.getBoundingClientRect();
      if (b.top < vh * 0.4 && b.bottom > vh * 0.4) current = navLinks[i];
    });
    navLinks.forEach((a) => a.classList.toggle('is-current', a === current));
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------------- Reveals, counters, parallax ---------------- */
  function count(el) {
    const end = parseFloat(el.dataset.count);
    if (!G || reduce) { el.textContent = String(end); return; }
    const o = { v: 0 };
    G.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = String(Math.round(o.v)); } });
  }

  if (G && ST && !reduce) {
    ST.batch('[data-reveal]', {
      start: 'top 88%',
      once: true,
      onEnter: (b) => G.to(b, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.09, overwrite: true }),
    });
    $$('[data-count]').forEach((el) => ST.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => count(el) }));
    $$('[data-parallax] img').forEach((img) => {
      G.fromTo(img, { yPercent: -10 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    G.to('.shipcard__line', { '--p': '84%', duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    G.from('.stat b', { scale: 0.85, duration: 1.2, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.stats', start: 'top 85%' } });
  } else {
    $$('[data-reveal]').forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { count(e.target); io.unobserve(e.target); } }));
      $$('[data-count]').forEach((el) => io.observe(el));
    } else $$('[data-count]').forEach(count);
  }

  /* ---------------- Tilt + magnetic (desktop only) ---------------- */
  if (finePointer && !reduce) {
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${x * 100}%`);
        el.style.setProperty('--my', `${y * 100}%`);
        el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 7}deg) rotateY(${(x - 0.5) * 9}deg) translateZ(0)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1)';
        el.style.transform = '';
        setTimeout(() => { el.style.transition = ''; }, 600);
      });
    });
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.18}px, ${y * 0.3}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1), background .3s, box-shadow .3s';
        el.style.transform = '';
        setTimeout(() => { el.style.transition = ''; }, 500);
      });
    });
  }

  /* ---------------- FAQ: keep one open ---------------- */
  const qas = $$('.qa');
  qas.forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) qas.forEach((o) => { if (o !== d) o.open = false; });
    ST && ST.refresh();
  }));

  /* ---------------- Contact form → mailto ---------------- */
  const form = $('#contactForm');
  const note = $('#formNote');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = (dict[lang] && dict[lang]._form) || dict.mn._form;
    const fd = new FormData(form);
    let ok = true;
    ['name', 'phone', 'message'].forEach((n) => {
      const el = form.elements[n];
      const bad = !String(fd.get(n) || '').trim();
      el.closest('.field').classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { note.className = 'form__note err'; note.textContent = t.invalid; return; }
    const L = t.labels;
    const body = [
      `${L.type}: ${t.types[fd.get('type')] || fd.get('type')}`,
      `${L.name}: ${fd.get('name')}`,
      `${L.phone}: ${fd.get('phone')}`,
      fd.get('email') ? `${L.email}: ${fd.get('email')}` : '',
      '',
      `${L.message}:`,
      String(fd.get('message')),
    ].filter((x, i) => x !== '' || i === 4).join('\n');
    window.location.href = `mailto:info@saleswaves.mn?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(body)}`;
    note.className = 'form__note ok';
    note.textContent = t.ok;
  });
  form.addEventListener('input', (e) => {
    const f = e.target.closest('.field');
    if (f && e.target.value.trim()) f.classList.remove('is-invalid');
  });
})();

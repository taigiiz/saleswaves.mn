// Saleswaves v2 — page behaviour: language, header, reveal, journey sync, form.
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const root = document.documentElement;
root.classList.add('js');
const S = (window.SWState = window.SWState || { journey: 0, journeyVisible: true });

/* ---------------- Language ---------------- */
const dict = window.SW_I18N || { en: {}, mn: {} };
const i18nEls = $$('[data-i18n]');
i18nEls.forEach((el) => { el.dataset.mn = el.innerHTML; });
const mnTitle = document.title;
let lang = 'mn';
try {
  const q = new URLSearchParams(location.search).get('lang');
  lang = q === 'en' || q === 'mn' ? q : localStorage.getItem('sw-lang') || 'mn';
} catch (e) { /* storage blocked */ }
function applyLang(l) {
  lang = l === 'en' ? 'en' : 'mn';
  i18nEls.forEach((el) => {
    const v = lang === 'en' ? dict.en[el.dataset.i18n] : el.dataset.mn;
    if (v != null) el.innerHTML = v;
  });
  root.lang = lang;
  document.title = lang === 'en' ? dict.en._title : mnTitle;
  $('#langToggle').textContent = lang === 'en' ? 'MN' : 'EN';
  try { localStorage.setItem('sw-lang', lang); } catch (e) { /* ignore */ }
}
applyLang(lang);
$('#langToggle').addEventListener('click', () => { applyLang(lang === 'en' ? 'mn' : 'en'); setPlayState(playState); });

/* ---------------- Header ---------------- */
const header = $('#header');
const burger = $('#burger');
burger.addEventListener('click', () => {
  const open = !header.classList.contains('is-open');
  header.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
});
$$('#mnav a').forEach((a) => a.addEventListener('click', () => { header.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }));
const navLinks = $$('.nav a');
const navTargets = navLinks.map((a) => $(a.getAttribute('href')));

/* ---------------- Reveal + counters ---------------- */
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  io.unobserve(e.target);
}), { rootMargin: '0px 0px -10% 0px' });
$$('.rv').forEach((el) => io.observe(el));

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const countIO = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  countIO.unobserve(e.target);
  const el = e.target, end = +el.dataset.count, suf = el.dataset.suffix || '';
  if (reduce) return;
  const t0 = performance.now(), dur = 1400;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur), v = Math.round(end * (1 - (1 - k) ** 3));
    el.textContent = v + suf;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}), { threshold: 0.6 });
$$('[data-count]').forEach((el) => countIO.observe(el));

/* ---------------- Journey ---------------- */
const journey = $('#journey');
const sticky = $('.journey__sticky', journey);
const tabs = $$('#jtabs button');
const panels = $$('#jpanels .jpanel');
const CH = [0, 0.13, 0.36, 0.56, 0.86, 1];
const END = 0.965;
let active = -1;

function scrollRange() {
  const r = journey.getBoundingClientRect();
  return { top: r.top + scrollY, len: journey.offsetHeight - sticky.offsetHeight };
}
function onScroll() {
  const { top, len } = scrollRange();
  const p = Math.min(1, Math.max(0, (scrollY - top) / len));
  S.journey = p;
  const r = journey.getBoundingClientRect();
  S.journeyVisible = r.bottom > 0 && r.top < innerHeight;

  let current = null;
  navTargets.forEach((t, i) => { if (!t) return; const b = t.getBoundingClientRect(); if (b.top < innerHeight * 0.35 && b.bottom > innerHeight * 0.35) current = navLinks[i]; });
  navLinks.forEach((a) => a.classList.toggle('is-current', a === current));
}
function onJourneyProgress(p) {
  let idx = 0;
  while (idx < 4 && p >= CH[idx + 1]) idx++;
  if (idx !== active) {
    active = idx;
    tabs.forEach((b, i) => { b.classList.toggle('is-active', i === idx); b.setAttribute('aria-current', i === idx ? 'step' : 'false'); });
    panels.forEach((pn, i) => pn.classList.toggle('is-active', i === idx));
    $('#jcur').textContent = String(idx + 1).padStart(2, '0');
    const t = tabs[idx];
    if (t && t.parentElement.parentElement.scrollWidth > t.parentElement.parentElement.clientWidth) {
      t.parentElement.parentElement.scrollTo({ left: t.parentElement.offsetLeft - 16, behavior: 'smooth' });
    }
  }
  $('#jbar').style.transform = `scaleX(${p})`;
  const end = p >= END;
  journey.classList.toggle('is-end', end);
  $('#jend').classList.toggle('is-on', end);
}
tabs.forEach((b, i) => b.addEventListener('click', () => {
  stopAuto();
  autoOffered = true; // the visitor is navigating by hand
  const { top, len } = scrollRange();
  const target = i === 0 ? 0.005 : CH[i] + 0.012;
  window.scrollTo({ top: top + len * target, behavior: 'smooth' });
}));
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();
onJourneyProgress(S.journey);

/* ---------------- Journey autoplay ---------------- */
// Plays the journey by scrolling the page at a steady pace. Starts by itself once the visitor
// rests inside the journey; any manual scroll, key or touch hands control back.
const playBtn = $('#jplay');
const AUTO_SECONDS = 48;   // full journey, start to finish
const AUTO_END = 0.985;
let playState = 'paused', autoP = 0, autoY = -1, autoLast = 0, autoRaf = 0, autoOffered = false, idleTimer = 0, selfStartedAt = -1e9;
function setPlayState(st) {
  playState = st;
  playBtn.dataset.state = st;
  const t = (dict[lang] && dict[lang]._play) || dict.mn._play;
  playBtn.setAttribute('aria-label', st === 'playing' ? t.pause : st === 'ended' ? t.replay : t.play);
  journey.classList.toggle('is-auto', st === 'playing');
}
function autoStep(now) {
  if (playState !== 'playing') return;
  const dt = Math.min(0.25, (now - autoLast) / 1000);
  autoLast = now;
  autoP = Math.min(AUTO_END, autoP + dt / AUTO_SECONDS);
  const { top, len } = scrollRange();
  autoY = top + len * autoP;
  window.scrollTo({ top: autoY, behavior: 'instant' });
  if (autoP >= AUTO_END) { autoY = -1; setPlayState('ended'); return; }
  autoRaf = requestAnimationFrame(autoStep);
}
function startAuto(fromStart) {
  clearTimeout(idleTimer);
  autoOffered = true;
  const { top, len } = scrollRange();
  autoP = fromStart || S.journey >= AUTO_END - 0.005 ? 0 : Math.max(0, (scrollY - top) / len);
  if (scrollY < top - 2 || fromStart) window.scrollTo({ top: top + len * autoP, behavior: 'instant' });
  setPlayState('playing');
  autoLast = performance.now();
  cancelAnimationFrame(autoRaf);
  autoRaf = requestAnimationFrame(autoStep);
}
function stopAuto() {
  clearTimeout(idleTimer);
  if (playState !== 'playing') return;
  cancelAnimationFrame(autoRaf);
  autoY = -1;
  setPlayState('paused');
}
playBtn.addEventListener('click', () => {
  // a click that lands just as autoplay started by itself meant "play", not "pause"
  if (playState === 'playing' && performance.now() - selfStartedAt < 1500) return;
  if (playState === 'playing') stopAuto(); else startAuto(playState === 'ended');
});
// the visitor takes over
['wheel', 'touchstart'].forEach((ev) => addEventListener(ev, (e) => { if (!e.target.closest || !e.target.closest('#jplay')) stopAuto(); }, { passive: true }));
addEventListener('keydown', (e) => {
  if (e.key === ' ' && e.target === playBtn) return; // space on the button toggles it
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) stopAuto();
});
addEventListener('scroll', () => {
  // scrollbar drag, anchor links, … — anything that moved the page away from where autoplay put it
  if (playState === 'playing' && autoY >= 0 && Math.abs(scrollY - autoY) > 6) stopAuto();
  if (playState === 'ended' && S.journey < AUTO_END - 0.02) setPlayState('paused');
  else if (playState === 'paused' && S.journey >= AUTO_END - 0.005) setPlayState('ended');
  // first visit: start on its own after a short rest inside the pinned journey
  if (!autoOffered && !reduce && playState === 'paused') {
    clearTimeout(idleTimer);
    const r = journey.getBoundingClientRect();
    if (r.top <= sticky.offsetTop + 2 && r.bottom >= innerHeight && S.journey < 0.9) idleTimer = setTimeout(() => { if (!autoOffered && playState === 'paused' && !document.hidden) { selfStartedAt = performance.now(); startAuto(false); } }, 1400);
  }
}, { passive: true });
setPlayState('paused');

// Boot WebGL once the page has settled.
function canWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
if (canWebGL()) {
  import('./journey/journey.js?v=4').then(({ initJourney }) => {
    initJourney($('#journeyCanvas'), {
      onReady: () => $('#jload').classList.add('is-done'),
      onProgress: onJourneyProgress,
      onError: () => { $('#jload').innerHTML = '<b>3D дүрслэл ачаалагдсангүй</b>'; },
    });
  }).catch((e) => {
    console.error(e);
    $('#jload').innerHTML = '<b>3D дүрслэл ачаалагдсангүй</b>';
  });
} else {
  $('#jload').innerHTML = '<b>Таны төхөөрөмж 3D дүрслэл дэмжихгүй байна</b>';
  addEventListener('scroll', () => onJourneyProgress(S.journey), { passive: true });
}

/* ---------------- Contact form → mailto ---------------- */
const form = $('#contactForm');
const note = $('#formNote');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const t = (dict[lang] && dict[lang]._form) || dict.mn._form;
  const fd = new FormData(form);
  let ok = true;
  ['name', 'phone', 'message'].forEach((n) => {
    const bad = !String(fd.get(n) || '').trim();
    form.elements[n].closest('.field').classList.toggle('is-invalid', bad);
    if (bad) ok = false;
  });
  if (!ok) { note.className = 'form__note err'; note.textContent = t.invalid; return; }
  const L = t.labels;
  const lines = [
    `${L.type}: ${t.types[fd.get('type')]}`,
    `${L.name}: ${fd.get('name')}`,
    `${L.phone}: ${fd.get('phone')}`,
  ];
  if (fd.get('email')) lines.push(`${L.email}: ${fd.get('email')}`);
  lines.push('', `${L.message}:`, String(fd.get('message')));
  location.href = `mailto:info@saleswaves.mn?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  note.className = 'form__note ok';
  note.textContent = t.ok;
});
form.addEventListener('input', (e) => { const f = e.target.closest('.field'); if (f && e.target.value.trim()) f.classList.remove('is-invalid'); });

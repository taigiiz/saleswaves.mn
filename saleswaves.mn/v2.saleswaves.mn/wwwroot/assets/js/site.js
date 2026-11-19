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
$('#langToggle').addEventListener('click', () => applyLang(lang === 'en' ? 'mn' : 'en'));

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
  const { top, len } = scrollRange();
  const target = i === 0 ? 0.005 : CH[i] + 0.012;
  window.scrollTo({ top: top + len * target, behavior: 'smooth' });
}));
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();
onJourneyProgress(S.journey);

// Boot WebGL once the page has settled.
function canWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
if (canWebGL()) {
  import('./journey/journey.js?v=3').then(({ initJourney }) => {
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

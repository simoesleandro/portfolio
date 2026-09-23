/* =========================================================
   Leandro Simões — portfolio · scroll story
   ---------------------------------------------------------
   Aprimoramento progressivo: sem este arquivo a página é
   uma sequência normal de seções, todas visíveis.
   Com ele (e sem prefers-reduced-motion), cada capítulo
   vira uma cena "sticky" e três variáveis CSS conduzem a
   narrativa:
     --e  entrada  (0 → 1 enquanto o capítulo sobe na tela)
     --p  revelação (0 → 1 enquanto a cena está fixada)
     --q  saída    (0 → 1 enquanto o próximo capítulo cobre)
   ========================================================= */
(() => {
  'use strict';

  const root = document.documentElement;
  const chapters = [...document.querySelectorAll('.chapter')];
  const header = document.getElementById('site-header');
  const footer = document.querySelector('.site-footer');
  const bar = document.getElementById('progress-bar');
  const dotsEl = document.getElementById('chapter-dots');
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

  /* ---------------- estado ---------------- */
  let story = false;
  let metrics = [];
  let ticking = false;
  let activeIdx = -1;
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;

  const themes = chapters.map(ch => {
    const cs = getComputedStyle(ch);
    return {
      tone: ch.dataset.tone || 'dark',
      scene: cs.getPropertyValue('--scene').trim(),
      fg: cs.getPropertyValue('--fg').trim(),
      mark: cs.getPropertyValue('--mark').trim()
    };
  });

  chapters.forEach(() => dotsEl.appendChild(document.createElement('li')));
  const dots = [...dotsEl.children];

  /* ---------------- medição ---------------- */
  function measure() {
    const vh = window.innerHeight;

    chapters.forEach(ch => {
      const stage = ch.firstElementChild;
      if (story) {
        const h = stage.offsetHeight;
        ch.style.setProperty('--stage-h', h + 'px');
        // cenas mais altas que a tela fixam pela base: nada fica inacessível
        stage.style.setProperty('--stick', Math.min(0, vh - h) + 'px');
      } else {
        ch.style.removeProperty('--stage-h');
        stage.style.removeProperty('--stick');
      }
    });

    metrics = chapters.map((ch, i) => {
      const stage = ch.firstElementChild;
      const top = ch.getBoundingClientRect().top + window.scrollY;
      const next = chapters[i + 1];
      const span = next ? next.getBoundingClientRect().top + window.scrollY - top : ch.offsetHeight;
      const pinStart = Math.min(0, vh - stage.offsetHeight);
      const coverStart = vh - span;
      return {
        ch,
        top,
        pinStart,
        coverStart,
        range: Math.max(1, pinStart - coverStart),
        hasNext: !!next,
        last: { e: -1, p: -1, q: -1 }
      };
    });
  }

  function setVar(m, name, value) {
    if (Math.abs(m.last[name] - value) < 0.0005) return;
    m.last[name] = value;
    m.ch.style.setProperty('--' + name, value.toFixed(4));
  }

  /* ---------------- quadro a quadro ---------------- */
  function update() {
    ticking = false;
    const vh = window.innerHeight;
    const y = window.scrollY;
    const probe = header.offsetHeight / 2;
    let active = 0;

    for (let i = 0; i < metrics.length; i++) {
      const m = metrics[i];
      const t = m.top - y;

      if (story) {
        setVar(m, 'e', clamp01((vh - t) / vh));
        setVar(m, 'p', clamp01((m.pinStart - t) / m.range));
        setVar(m, 'q', m.hasNext ? clamp01((m.coverStart - t) / vh) : 0);
      }
      if (t <= probe) active = i;
    }

    const overFooter = footer && footer.getBoundingClientRect().top <= probe;
    const key = overFooter ? -2 : active;
    if (key !== activeIdx) {
      activeIdx = key;
      const theme = overFooter ? { tone: 'dark', scene: '#0a0a0b', fg: '#f4f0e8', mark: '#ff5a36' } : themes[active];
      header.dataset.tone = theme.tone;
      header.style.setProperty('--hdr-bg', theme.scene);
      root.style.setProperty('--hdr-accent', theme.mark);
      root.style.setProperty('--chrome-fg', theme.fg);
      dots.forEach((d, i) => d.classList.toggle('is-active', i === active));
    }

    const total = document.documentElement.scrollHeight - vh;
    bar.style.setProperty('--page-p', total > 0 ? clamp01(y / total).toFixed(4) : '0');
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  /* ---------------- liga / desliga o modo story ---------------- */
  function resetVars() {
    chapters.forEach(ch => ['--e', '--p', '--q', '--stage-h'].forEach(v => ch.style.removeProperty(v)));
  }

  function setStory(on) {
    try {
      story = on;
      root.classList.toggle('js-story', on);
      if (!on) resetVars();
      measure();
      update();
    } catch (err) {
      // qualquer falha devolve a página ao fluxo normal, com tudo visível
      story = false;
      root.classList.remove('js-story');
      resetVars();
      if (window.console) console.error(err);
    }
  }

  setStory(!reduceMQ.matches);

  const onMotionPref = () => setStory(!reduceMQ.matches);
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onMotionPref);
  else if (reduceMQ.addListener) reduceMQ.addListener(onMotionPref);

  window.addEventListener('scroll', requestUpdate, { passive: true });

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // barra de endereço do mobile muda a altura em ~60px: não re-medir por isso
    if (w !== lastW || Math.abs(h - lastH) > 120) {
      lastW = w;
      lastH = h;
      measure();
    }
    requestUpdate();
  });

  if ('ResizeObserver' in window) {
    let pending = false;
    const ro = new ResizeObserver(() => {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(() => {
        pending = false;
        measure();
        update();
      });
    });
    chapters.forEach(ch => ro.observe(ch.firstElementChild));
  }

  /* ---------------- âncoras: parar no ponto em que a cena está revelada ---------------- */
  function chapterIndexFor(hash) {
    if (!hash || hash.length < 2) return -1;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    const ch = el && el.closest('.chapter');
    return ch ? chapters.indexOf(ch) : -1;
  }

  function targetFor(idx) {
    const m = metrics[idx];
    if (!story || idx === 0) return idx === 0 ? 0 : m.top;
    return m.top - (m.pinStart - m.range * 0.78);
  }

  function goTo(idx, smooth) {
    window.scrollTo({ top: Math.round(targetFor(idx)), behavior: smooth ? 'smooth' : 'auto' });
    const ch = chapters[idx];
    if (!ch.hasAttribute('tabindex')) ch.setAttribute('tabindex', '-1');
    ch.focus({ preventScroll: true });
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !story) return;
    const idx = chapterIndexFor(a.getAttribute('href'));
    if (idx < 0) return;
    e.preventDefault();
    goTo(idx, true);
    if (history.pushState) history.pushState(null, '', '#' + chapters[idx].id);
  });

  // link direto (ex.: /portfolio/#sentinela): o navegador rola até o topo do
  // capítulo no load; depois disso ajustamos para a cena já revelada
  const initialIdx = chapterIndexFor(location.hash);

  window.addEventListener('load', () => {
    measure();
    update();
    if (story && initialIdx > 0) window.requestAnimationFrame(() => goTo(initialIdx, false));
  });

  /* ---------------- menu mobile ---------------- */
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  function openNav() {
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Fechar menu de navegação');
    navMenu.classList.add('open');
  }

  function closeNav() {
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Abrir menu de navegação');
    navMenu.classList.remove('open');
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      if (navToggle.getAttribute('aria-expanded') === 'true') closeNav();
      else openNav();
    });
    navMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
    document.addEventListener('click', e => {
      if (navToggle.getAttribute('aria-expanded') !== 'true') return;
      if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) closeNav();
    });
  }

  /* ---------------- lightbox dos screenshots ---------------- */
  const overlay = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbClose = document.getElementById('lightbox-close');
  const inertTargets = [document.getElementById('main'), header, footer].filter(Boolean);
  const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  let lastFocused = null;

  function openLightbox(trigger, src, alt) {
    lastFocused = trigger;
    lbImg.src = src;
    lbImg.alt = alt;
    overlay.hidden = false;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    inertTargets.forEach(el => { el.inert = true; });
    lbClose.focus();
  }

  function closeLightbox() {
    overlay.classList.remove('active');
    overlay.hidden = true;
    document.body.style.overflow = '';
    lbImg.removeAttribute('src');
    lbImg.alt = '';
    inertTargets.forEach(el => { el.inert = false; });
    if (lastFocused) {
      lastFocused.focus({ preventScroll: true });
      lastFocused = null;
    }
  }

  document.querySelectorAll('[data-lightbox]').forEach(btn => {
    btn.addEventListener('click', () => {
      const img = btn.querySelector('img');
      openLightbox(btn, img.currentSrc || img.src, img.alt);
    });
  });

  overlay.addEventListener('click', e => {
    if (e.target !== lbImg) closeLightbox();
  });
  lbClose.addEventListener('click', closeLightbox);

  overlay.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || !overlay.classList.contains('active')) return;
    const focusable = [...overlay.querySelectorAll(FOCUSABLE)].filter(el => !el.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (overlay.classList.contains('active')) closeLightbox();
    if (navToggle && navToggle.getAttribute('aria-expanded') === 'true') closeNav();
  });
})();

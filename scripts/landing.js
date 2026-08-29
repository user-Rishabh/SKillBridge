/* ══════════════════════════════════════════════════════════════
   SKILLBRIDGE — LANDING PAGE JAVASCRIPT (NOMU-INSPIRED LIVELY)
   Warm Cream & Peach/Terracotta Palette • Live Counters • Rotating Micro-Copy
   ══════════════════════════════════════════════════════════════ */

/* ── Scroll Progress Bar ───────────────────────────────────── */
(function initScrollProgress() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const total    = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (total > 0 ? (scrolled / total) * 100 : 0) + '%';
  }, { passive: true });
})();


/* ── Navbar Scroll State (Static Styling, Elevation on Scroll) ─ */
(function initNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
  }, { passive: true });
})();


/* ── Scroll Reveal ─────────────────────────────────────────── */
(function initScrollReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const delay = el.dataset.delay || 0;
        setTimeout(() => el.classList.add('revealed'), +delay);
        io.unobserve(el);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
})();


/* ── Playful Rotating Micro-Copy (Nomu-inspired) ────────────── */
(function initRotatingMicroCopy() {
  const container = document.getElementById('hero-microcopy');
  if (!container) return;

  const phrases = [
    { icon: "✦", text: "Analyzing your skills in real-time..." },
    { icon: "✳", text: "Mapping your missing prerequisite gaps..." },
    { icon: "✶", text: "Building your milestone roadmap..." },
    { icon: "✧", text: "Calculating verified job readiness..." },
    { icon: "✦", text: "Matching live hiring partner standards..." }
  ];

  let index = 0;
  const iconEl = container.querySelector('.microcopy-icon');
  const textEl = container.querySelector('.microcopy-text');

  if (!iconEl || !textEl) return;

  setInterval(() => {
    container.classList.add('fade-out');
    setTimeout(() => {
      index = (index + 1) % phrases.length;
      iconEl.textContent = phrases[index].icon;
      textEl.textContent = phrases[index].text;
      container.classList.remove('fade-out');
    }, 250);
  }, 2300);
})();


/* ── Live Counters Up-Animation (1.2s Ease-Out) ────────────── */
(function initLiveCounters() {
  const counterElements = document.querySelectorAll('[data-counter]');
  if (!counterElements.length) return;

  function easeOutQuad(t) {
    return t * (2 - t);
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseFloat(el.getAttribute('data-target') || '0');
        const prefix = el.getAttribute('data-prefix') || '';
        const suffix = el.getAttribute('data-suffix') || '';
        const duration = 1200;
        const start = performance.now();

        function animate(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const current = Math.floor(easeOutQuad(progress) * target);

          el.textContent = `${prefix}${current.toLocaleString()}${suffix}`;

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            el.textContent = `${prefix}${target.toLocaleString()}${suffix}`;
          }
        }

        requestAnimationFrame(animate);
        io.unobserve(el);
      }
    });
  }, { threshold: 0.2 });

  counterElements.forEach(el => io.observe(el));
})();


/* ── Hero: Circular Progress Ring Animation ────────────────── */
(function initRing() {
  const ringFill = document.getElementById('ring-fill');
  const ringPct  = document.getElementById('ring-pct');
  if (!ringFill || !ringPct) return;

  const TARGET  = 72;    // %
  const RADIUS  = 50;
  const CIRCUM  = 2 * Math.PI * RADIUS; // ≈ 314.16
  const DURATION = 1500; // ms

  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      setTimeout(() => {
        const start = performance.now();
        function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

        function step(now) {
          const t   = Math.min((now - start) / DURATION, 1);
          const pct = easeOut(t) * TARGET;
          const offset = CIRCUM - (pct / 100) * CIRCUM;
          ringFill.style.strokeDashoffset = offset;
          ringPct.textContent = Math.round(pct) + '%';
          if (t < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
      }, 300);
      io.disconnect();
    }
  }, { threshold: 0.2 });

  const heroCard = document.querySelector('.hero-dashboard-card');
  if (heroCard) io.observe(heroCard);
})();


/* ── Skill Bars Animated Fill on Scroll ────────────────────── */
(function initSkillBars() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bars = entry.target.querySelectorAll('.bar-fill');
        bars.forEach((bar, i) => {
          setTimeout(() => bar.classList.add('animated'), i * 180);
        });
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });

  document.querySelectorAll('.skill-bars, .dp-skills, .weak-list').forEach(el => io.observe(el));
})();


/* ── FAQ Accordion ─────────────────────────────────────────── */
(function initFAQ() {
  const items = document.querySelectorAll('.faq-item');
  items.forEach(item => {
    const btn = item.querySelector('.faq-q');
    const ans = item.querySelector('.faq-a');
    if (!btn || !ans) return;

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach(i => {
        i.classList.remove('open');
        const a = i.querySelector('.faq-a');
        if (a) a.style.maxHeight = '0';
      });
      if (!isOpen) {
        item.classList.add('open');
        ans.style.maxHeight = ans.scrollHeight + 'px';
      }
    });
  });
})();


/* ── Smooth anchor scroll for nav links ────────────────────── */
(function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();

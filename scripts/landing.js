/* ══════════════════════════════════════════════════════════════
   SKILLBRIDGE — LANDING PAGE JAVASCRIPT (REDESIGNED)
   Career Navigation + Skill Verification System
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


/* ── Navbar Scroll State ───────────────────────────────────── */
(function initNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
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


/* ── Hero: Circular Progress Ring Animation ────────────────── */
(function initRing() {
  const ringFill = document.getElementById('ring-fill');
  const ringPct  = document.getElementById('ring-pct');
  if (!ringFill || !ringPct) return;

  const TARGET  = 72;    // %
  const RADIUS  = 50;
  const CIRCUM  = 2 * Math.PI * RADIUS; // ≈ 314.16
  const DURATION = 1500; // ms

  // Animate after brief delay on page load
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
  }, 400);
})();


/* ── Skill Bars Animated Fill ──────────────────────────────── */
(function initSkillBars() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bars = entry.target.querySelectorAll('.bar-fill');
        bars.forEach((bar, i) => {
          setTimeout(() => bar.classList.add('animated'), i * 200);
        });
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  // Animate hero skill bars immediately after ring
  const heroSkills = document.querySelector('.hdc-skills');
  if (heroSkills) {
    setTimeout(() => {
      heroSkills.querySelectorAll('.bar-fill').forEach((bar, i) => {
        setTimeout(() => bar.classList.add('animated'), 600 + i * 200);
      });
    }, 0);
  }

  // All other skill-bar groups trigger on scroll
  document.querySelectorAll('.skill-bars:not(.hdc-skills), .dp-skills, .weak-list').forEach(el => io.observe(el));
})();


/* ── Steps Line Draw on Scroll ─────────────────────────────── */
(function initStepsLine() {
  const line = document.getElementById('steps-line');
  const row  = document.getElementById('steps-row');
  if (!line || !row) return;

  const io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      line.classList.add('animated');
      io.disconnect();
    }
  }, { threshold: 0.3 });

  io.observe(row);
})();


/* ── Dashboard Preview: Count-up Score & Bar Trigger ──────── */
(function initDashboardPreview() {
  const mockDash = document.querySelector('.mock-dashboard');
  if (!mockDash) return;

  let triggered = false;

  const io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !triggered) {
      triggered = true;

      // Animate dp-skills bars
      mockDash.querySelectorAll('.dp-skills .bar-fill, .weak-list .bar-fill').forEach((bar, i) => {
        setTimeout(() => bar.classList.add('animated'), i * 150);
      });

      io.disconnect();
    }
  }, { threshold: 0.2 });

  io.observe(mockDash);
})();


/* ── Comparison Table Row Reveal ───────────────────────────── */
(function initTableRows() {
  const rows = document.querySelectorAll('.trow');
  if (!rows.length) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        rows.forEach((row, i) => {
          setTimeout(() => row.classList.add('revealed'), i * 100);
        });
        io.disconnect();
      }
    });
  }, { threshold: 0.15 });

  const table = document.querySelector('.table-wrap');
  if (table) io.observe(table);
})();


/* ── CTA Floating Particles ────────────────────────────────── */
(function initCTAParticles() {
  const container = document.getElementById('cta-particles');
  if (!container) return;

  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'cta-particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      bottom: ${Math.random() * -20}%;
      width: ${2 + Math.random() * 4}px;
      height: ${2 + Math.random() * 4}px;
      opacity: ${0.1 + Math.random() * 0.4};
      animation-duration: ${5 + Math.random() * 10}s;
      animation-delay: ${Math.random() * 6}s;
    `;
    container.appendChild(p);
  }
})();


/* ── Button Ripple Effect ──────────────────────────────────── */
(function initRipple() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const rect   = btn.getBoundingClientRect();
      const size   = Math.max(rect.width, rect.height);
      const x      = e.clientX - rect.left - size / 2;
      const y      = e.clientY - rect.top  - size / 2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.cssText = `
        width: ${size}px; height: ${size}px;
        left: ${x}px; top: ${y}px;
        position: absolute;
        border-radius: 50%;
        background: rgba(255,255,255,0.25);
        transform: scale(0);
        animation: ripple-anim 0.45s linear;
        pointer-events: none;
      `;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    });
  });
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

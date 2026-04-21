/* ══════════════════════════════════════════════════════════════
   SKILLBRIDGE — LANDING PAGE JAVASCRIPT
   Emerald & Slate Design System
   ══════════════════════════════════════════════════════════════ */

/* ── Custom Cursor ─────────────────────────────────────────── */
(function initCursor() {
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  let rX = 0, rY = 0, mX = 0, mY = 0;

  document.addEventListener('mousemove', e => {
    mX = e.clientX;
    mY = e.clientY;
    dot.style.left  = mX + 'px';
    dot.style.top   = mY + 'px';
  });

  function animRing() {
    rX += (mX - rX) * 0.12;
    rY += (mY - rY) * 0.12;
    ring.style.left = rX + 'px';
    ring.style.top  = rY + 'px';
    requestAnimationFrame(animRing);
  }
  animRing();

  document.querySelectorAll('a, button, .inno-card, .testi-card, .mentor-card, .project-card, .faq-q').forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('hovered'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hovered'));
  });
})();

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
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const delay = el.dataset.delay || 0;
        setTimeout(() => {
          el.classList.add('revealed');
        }, +delay);
        io.unobserve(el);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
  document.querySelectorAll('[data-stagger]').forEach(el => io.observe(el));
})();

/* ── Skill Bars Animated Fill ──────────────────────────────── */
(function initSkillBars() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.bar-fill').forEach(bar => {
          bar.classList.add('animated');
        });
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.skill-bars, .port-bars').forEach(el => io.observe(el));
})();

/* ── Feature Tabs ──────────────────────────────────────────── */
(function initTabs() {
  const btns   = document.querySelectorAll('.tab-btn');
  const panes  = document.querySelectorAll('.tab-pane');
  const ink    = document.getElementById('tab-ink');

  function setActive(btn) {
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // move ink
    if (ink) {
      ink.style.left  = btn.offsetLeft + 'px';
      ink.style.width = btn.offsetWidth + 'px';
    }
    // switch pane
    const targetId = btn.dataset.tab;
    panes.forEach(p => {
      p.classList.remove('active', 'tab-visible');
    });
    const target = document.getElementById(targetId);
    if (!target) return;
    target.classList.add('active');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        target.classList.add('tab-visible');
        // animate skill bars inside newly visible tab
        target.querySelectorAll('.bar-fill').forEach(bar => bar.classList.add('animated'));
        // build heatmap if portfolio tab
        if (targetId === 'tab-portfolio') buildHeatmap();
      });
    });
  }

  btns.forEach(btn => {
    btn.addEventListener('click', () => setActive(btn));
  });

  // init ink position
  const activeBtn = document.querySelector('.tab-btn.active');
  if (activeBtn && ink) {
    setTimeout(() => {
      ink.style.left  = activeBtn.offsetLeft + 'px';
      ink.style.width = activeBtn.offsetWidth + 'px';
    }, 100);
  }
  // animate first tab bars immediately
  document.querySelectorAll('#tab-roadmap .bar-fill').forEach(b => b.classList.add('animated'));
})();

/* ── GitHub Heatmap Builder ────────────────────────────────── */
function buildHeatmap() {
  const grid = document.getElementById('github-heatmap');
  if (!grid || grid.children.length > 0) return;
  const levels = [0,0,0,1,1,2,2,3,3,4,2,1,0,0,1,2,3,4,3,2,1,0,0,0,
                  1,2,2,3,4,4,3,2,1,0,0,1,1,2,3,3,4,2,1,0,0,0,1,2,
                  3,4,4,3,2,1,0,0,1,2,3,4,3,2,1,0,0,0,1,2,3,4,3,2,
                  1,0,0,1,2,3,4,3,2,1,0];
  levels.slice(0, 84).forEach((lvl, i) => {
    const cell = document.createElement('div');
    cell.className = `heat-cell heat-${lvl}`;
    cell.style.animationDelay = (i * 8) + 'ms';
    grid.appendChild(cell);
  });
}

/* ── Counter Animation ─────────────────────────────────────── */
(function initCounters() {
  const DISPLAYS = {
    'sn-0': '15L+',
    'sn-1': '500+',
    'sn-2': '98%',
    'sn-3': '4.9★'
  };
  const ENDS = { 'sn-0': 15, 'sn-1': 500, 'sn-2': 98, 'sn-3': 49 };

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function animCounter(el) {
    const id   = el.id;
    const end  = ENDS[id] || 0;
    const disp = DISPLAYS[id] || end + '';
    const dur  = 2000;
    const start = performance.now();

    // Determine suffix for intermediate counts
    const suffix = disp.replace(/[0-9.]/g, '');

    function step(now) {
      const t = Math.min((now - start) / dur, 1);
      const val = Math.floor(easeOutCubic(t) * end);
      // Use formatted display on completion
      if (t >= 1) {
        el.textContent = disp;
      } else {
        el.textContent = val + (suffix || '');
      }
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.stat-num').forEach(animCounter);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  const statsSection = document.getElementById('stats');
  if (statsSection) io.observe(statsSection);
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
      // close all
      items.forEach(i => {
        i.classList.remove('open');
        const a = i.querySelector('.faq-a');
        if (a) a.style.maxHeight = '0';
      });
      // open clicked if it was closed
      if (!isOpen) {
        item.classList.add('open');
        ans.style.maxHeight = ans.scrollHeight + 'px';
      }
    });
  });
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

/* ── Timeline SVG Line Draw on Scroll ─────────────────────── */
(function initTimelineLine() {
  const tl   = document.getElementById('timeline');
  const line = document.getElementById('tl-line');
  if (!tl || !line) return;

  const io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      const totalH = tl.offsetHeight;
      line.setAttribute('y2', totalH);
      io.disconnect();
    }
  }, { threshold: 0.1 });

  io.observe(tl);
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

/* ── Initialize Heatmap on page load (portfolio tab hidden) ── */
document.addEventListener('DOMContentLoaded', () => {
  // pre-build heatmap so it's ready when portfolio tab opens
  // (buildHeatmap guards against double build)
  // trigger bar animations for visible tab
  document.querySelectorAll('#tab-roadmap .bar-fill').forEach(b => {
    setTimeout(() => b.classList.add('animated'), 400);
  });
});

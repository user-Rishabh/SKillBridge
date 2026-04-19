/* ══════════════════════════════════════════════════════════════
   SKILLBRIDGE — LANDING PAGE JAVASCRIPT
   All interactions: cursor, particles, tabs, stats, ripple,
   scroll progress, reveal, heatmap, FAQ, terminal
   ══════════════════════════════════════════════════════════════ */

// ── 1. CUSTOM CURSOR ────────────────────────────────────────
const cursorDot = document.getElementById('cursor-dot');
const cursorOutline = document.getElementById('cursor-outline');

let mouseX = 0, mouseY = 0;
let outlineX = 0, outlineY = 0;

window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    // Dot follows exactly
    cursorDot.style.left = mouseX + 'px';
    cursorDot.style.top  = mouseY + 'px';
});

// Outline follows with smooth lag (lerp 0.12)
function animateCursorOutline() {
    outlineX += (mouseX - outlineX) * 0.12;
    outlineY += (mouseY - outlineY) * 0.12;
    cursorOutline.style.left = outlineX + 'px';
    cursorOutline.style.top  = outlineY + 'px';
    requestAnimationFrame(animateCursorOutline);
}
animateCursorOutline();

// Hover enlargement
function addCursorHover(selector) {
    document.querySelectorAll(selector).forEach(el => {
        el.addEventListener('mouseenter', () => cursorOutline.classList.add('hovered'));
        el.addEventListener('mouseleave', () => cursorOutline.classList.remove('hovered'));
    });
}
addCursorHover('a, button, .glass-panel, .company-pill, .project-card, .mentor-card, .stat-card, .faq-trigger, .tab-btn');

// Click pulse
document.addEventListener('mousedown', e => {
    const ring = document.createElement('div');
    ring.className = 'cursor-pulse-ring';
    ring.style.left = e.clientX + 'px';
    ring.style.top  = e.clientY + 'px';
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 500);
});

// ── 2. BUTTON CLICK RIPPLE ──────────────────────────────────
document.addEventListener('click', e => {
    const btn = e.target.classList.contains('btn-premium')
        ? e.target
        : e.target.closest('.btn-premium');
    if (!btn) return;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width  = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left   = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top    = (e.clientY - rect.top  - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
});

// ── 3. SCROLL PROGRESS BAR ──────────────────────────────────
const progressBar = document.getElementById('progress-bar');
const backToTop   = document.getElementById('back-to-top');

window.addEventListener('scroll', () => {
    const total    = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (window.scrollY / total) * 100;
    progressBar.style.width = progress + '%';

    // Back-to-top visibility
    if (window.scrollY > 500) backToTop.classList.add('visible');
    else backToTop.classList.remove('visible');

    // Navbar shadow on scroll
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 60) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
});

backToTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

// ── 4. SECTION REVEAL (IntersectionObserver) ────────────────
const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('reveal');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('[data-animate="fade-up"]').forEach(el => revealObserver.observe(el));

// ── 5. TAB SWITCHING ────────────────────────────────────────
const tabButtons  = document.querySelectorAll('.tab-btn');
const tabPanes    = document.querySelectorAll('.tab-content-pane');
const tabIndicator = document.getElementById('tab-indicator');

function updateIndicator(activeBtn) {
    const btnRect  = activeBtn.getBoundingClientRect();
    const navRect  = document.getElementById('tabs-nav').getBoundingClientRect();
    tabIndicator.style.left  = (btnRect.left - navRect.left) + 'px';
    tabIndicator.style.width = btnRect.width + 'px';
}

// Init indicator position
window.addEventListener('load', () => {
    const activeBtn = document.querySelector('.tab-btn.active');
    if (activeBtn) updateIndicator(activeBtn);
    // Make first tab visible
    const firstPane = document.querySelector('.tab-content-pane.active');
    if (firstPane) {
        setTimeout(() => firstPane.classList.add('tab-visible'), 50);
    }
});

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;

        // Deactivate all
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => {
            p.classList.remove('active', 'tab-visible');
        });

        // Activate clicked
        btn.classList.add('active');
        updateIndicator(btn);

        const targetPane = document.getElementById(tabId);
        targetPane.classList.add('active');
        // Trigger slide-in after display:grid is set
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                targetPane.classList.add('tab-visible');
            });
        });
    });
});

// ── 6. STATS COUNT-UP (on scroll) ───────────────────────────
const statDefs = [
    { id: 'stat-0', end: 15,  display: '15L+', duration: 1800 },
    { id: 'stat-1', end: 500, display: '500+', duration: 2000 },
    { id: 'stat-2', end: 98,  display: '98%',  duration: 1600 },
    { id: 'stat-3', end: 49,  display: '4.9★', duration: 1500 },
];

// Special formatting for stat-3 (4.9★)
function formatStatValue(id, value, max) {
    if (id === 'stat-3') {
        return (4 + (value / max) * 0.9).toFixed(1) + '★';
    }
    if (id === 'stat-0') {
        return value + 'L+';
    }
    if (id === 'stat-1') {
        return value + '+';
    }
    if (id === 'stat-2') {
        return value + '%';
    }
    return value;
}

function animateCountUp(el, end, duration, id) {
    let start = null;
    function step(ts) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(eased * end);
        el.textContent = formatStatValue(id, current, end);
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = statDefs.find(s => s.id === id)?.display || el.textContent;
    }
    requestAnimationFrame(step);
}

const statsObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const card = entry.target;
            card.classList.add('counting');
            const id    = card.querySelector('.stat-number')?.id;
            const def   = statDefs.find(s => s.id === id);
            const el    = document.getElementById(id);
            if (def && el) {
                animateCountUp(el, def.end, def.duration, def.id);
            }
            statsObserver.unobserve(card);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-card').forEach(card => statsObserver.observe(card));

// ── 7. HERO HEADLINE STAGGER ─────────────────────────────────
const heroHeading = document.getElementById('hero-heading');
const heroText    = 'Architect\u00A0Your Future.';
heroHeading.innerHTML = heroText.split(' ').map((word, i) =>
    `<span class="word-slide-up" style="animation-delay:${i * 0.12}s"><span>${word}&nbsp;</span></span>`
).join('');

// ── 8. TERMINAL TYPEWRITER ───────────────────────────────────
const terminalContent = document.getElementById('terminal-content');
const termLines = [
    { text: '$ skillbridge diagnose --user="you"',        color: '#E94560', delay: 0 },
    { text: '>> INITIALIZING AI CORE...',                  color: '#555',    delay: 800 },
    { text: '>> SCANNING 12,402 CAREER PATHS...',          color: '#555',    delay: 1600 },
    { text: '>> ANALYZING SKILL GAPS...',                   color: '#555',    delay: 2400 },
    { text: '>> GENERATING OPTIMAL ROADMAP...',             color: '#27C93F', delay: 3200 },
    { text: '>> PATH READY: FULL STACK ARCHITECT ✓',        color: '#27C93F', delay: 4000 },
    { text: '>> MATCHING 23 HIRING PARTNERS...',            color: '#F5A623', delay: 4800 },
    { text: '>> 3 COMPANIES INTERESTED IN YOUR PROFILE',    color: '#F5A623', delay: 5600 },
];

let lineIdx = 0;
function typeNextLine() {
    if (lineIdx >= termLines.length) return;
    const spec = termLines[lineIdx];
    const line = document.createElement('div');
    line.style.color = spec.color;
    line.style.marginBottom = '10px';
    line.style.opacity = '0';
    terminalContent.appendChild(line);
    line.style.opacity = '1';
    let charIdx = 0;
    const speed = 28;
    const interval = setInterval(() => {
        if (charIdx < spec.text.length) {
            line.textContent += spec.text[charIdx++];
        } else {
            clearInterval(interval);
            lineIdx++;
            setTimeout(typeNextLine, 400);
        }
    }, speed);
}
setTimeout(typeNextLine, 700);

// ── 9. FAQ ACCORDION ─────────────────────────────────────────
document.querySelectorAll('.faq-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
        const item = trigger.parentElement;
        const isOpen = item.classList.contains('open');
        // Close all
        document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
    });
});

// ── 10. GITHUB HEATMAP ───────────────────────────────────────
function buildHeatmap() {
    const heatmap = document.getElementById('github-heatmap');
    if (!heatmap) return;
    const weeks = 26, days = 7;
    const colors = ['#0d0d0d', '#1a1a1a', 'rgba(233,69,96,0.25)', 'rgba(233,69,96,0.5)', 'rgba(233,69,96,0.8)', '#E94560'];
    for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < days; d++) {
            const cell = document.createElement('div');
            cell.className = 'hm-cell';
            // Weighted random: more low values = realistic
            const rand = Math.pow(Math.random(), 2.2);
            const level = Math.floor(rand * colors.length);
            cell.style.background = colors[Math.min(level, colors.length - 1)];
            cell.style.borderRadius = '2px';
            cell.title = `${Math.floor(rand * 12)} contributions`;
            heatmap.appendChild(cell);
        }
    }
}
buildHeatmap();

// ── 11. PARTICLE CANVAS ──────────────────────────────────────
const canvas = document.getElementById('particle-canvas');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    });

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.size = Math.random() * 1.5 + 0.3;
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = -(Math.random() * 0.4 + 0.1);
            this.opacity = Math.random() * 0.5 + 0.1;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.y < -5) this.reset();
        }
        draw() {
            ctx.fillStyle = `rgba(255,255,255,${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const particles = Array.from({ length: 70 }, () => new Particle());

    function animateParticles() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animateParticles);
    }
    animateParticles();
}

// ── 12. SKILL BAR ANIMATE ON PORTFOLIO TAB ───────────────────
function animateSkillBars() {
    document.querySelectorAll('.skill-bar-fill').forEach(bar => {
        const width = bar.style.width;
        bar.style.width = '0';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                bar.style.width = width;
            });
        });
    });
}

// Trigger skill bars when portfolio tab is shown
document.querySelector('[data-tab="tab-portfolio"]')?.addEventListener('click', () => {
    setTimeout(animateSkillBars, 100);
});

// ── 13. NAVBAR HIDE ON SCROLL DOWN ───────────────────────────
let lastScrollY = 0;
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY > lastScrollY && currentScrollY > 150) {
        navbar.style.transform = 'translateY(-100%)';
    } else {
        navbar.style.transform = 'translateY(0)';
    }
    lastScrollY = currentScrollY;
});

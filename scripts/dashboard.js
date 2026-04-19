const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('sidebar-toggle');
const themeToggleDash = document.getElementById('theme-toggle-dash');
const userDisplayName = document.getElementById('user-display-name');
const dashboardDate = document.getElementById('dashboard-date');

// Set Date
if (dashboardDate) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dashboardDate.textContent = "Today is " + new Date().toLocaleDateString('en-US', options);
}

if (toggleBtn) {
    toggleBtn.onclick = () => {
        sidebar.classList.toggle('collapsed');
    };
}

// Stats Animation
function animateCounter(id, target, isPercent = false) {
    const el = document.getElementById(id);
    if (!el) return;
    
    let count = 0;
    const duration = 1500; 
    const startTime = performance.now();
    
    const update = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (outQuad)
        const easedProgress = progress * (2 - progress);
        count = easedProgress * target;
        
        if (id === 'stat-projects') {
            el.innerText = `${Math.floor(count)}/10`;
        } else {
            el.innerText = Math.floor(count) + (isPercent ? '%' : '+');
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            if (id === 'stat-projects') el.innerText = `${target}/10`;
            else el.innerText = target + (isPercent ? '%' : '+');
        }
    };
    requestAnimationFrame(update);
}

// Sync theme in dashboard
if (themeToggleDash) {
    const icon = themeToggleDash.querySelector('i');
    themeToggleDash.onclick = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        icon.setAttribute('data-lucide', newTheme === 'dark' ? 'sun' : 'moon');
        lucide.createIcons();
    };
}

// Run animations on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        animateCounter('skill-score-val', 67, true);
        animateCounter('stat-projects', 4);
        animateCounter('mentors-met-val', 2);
        animateCounter('placement-rate-val', 72, true);
    }, 500);
});

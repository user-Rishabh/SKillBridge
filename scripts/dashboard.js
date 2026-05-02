/**
 * SkillBridge Dashboard Core Logic
 * Handles theme persistence, sidebar interactions, and dynamic UI updates.
 */

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initInteractions();
    animateComponents();
});

/**
 * Sync theme from localStorage and handle toggle
 */
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const target = current === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', target);
        localStorage.setItem('theme', target);
        updateThemeIcon(target);
    };
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
        icon.setAttribute('data-lucide', theme === 'light' ? 'sun' : 'moon');
        if (window.lucide) window.lucide.createIcons();
    }
}

/**
 * Component-specific interactions
 */
function initInteractions() {
    // New Session CTA
    const newSessionBtn = document.getElementById('new-session-btn');
    if (newSessionBtn) {
        newSessionBtn.onclick = () => {
            console.log('New session requested');
            // Logic for opening modal or redirecting
        };
    }

    // Heatmap Tooltips (Optional)
    const cells = document.querySelectorAll('.heat-cell');
    cells.forEach(cell => {
        cell.addEventListener('mouseenter', (e) => {
            // Logic for showing activity count
        });
    });
}

/**
 * Entry animations for dashboard components
 */
function animateComponents() {
    const bar = document.getElementById('roadmap-progress-bar');
    if (bar) {
        setTimeout(() => {
            bar.style.width = '40%';
        }, 300);
    }
}

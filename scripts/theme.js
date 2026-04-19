function initTheme() {
    const html = document.documentElement;
    const savedTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);

    // Initial icon update
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        updateIcon(btn, savedTheme);
    });

    // Handle all theme toggle buttons
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.theme-toggle-btn');
        if (btn) {
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            // Update all toggle icons on the page
            document.querySelectorAll('.theme-toggle-btn').forEach(b => {
                updateIcon(b, newTheme);
            });
        }
    });
}

function updateIcon(btn, theme) {
    const icon = btn.querySelector('i');
    if (icon) {
        icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

document.addEventListener('DOMContentLoaded', initTheme);

function initTheme() {
    const html = document.documentElement;
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
}

document.addEventListener('DOMContentLoaded', initTheme);

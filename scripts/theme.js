// Unified Theme Engine for SkillBridge
// Prevents screen flash by executing immediately on document element
(function() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
})();

const SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'day' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcons();
  console.log(`[Theme] Theme switched to: ${newTheme}`);
}

function updateThemeIcons() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const toggleBtns = document.querySelectorAll('.theme-toggle-btn, #theme-toggle');
  toggleBtns.forEach(btn => {
    if (theme === 'day') {
      btn.innerHTML = MOON_SVG;
      btn.setAttribute('title', 'Switch to Night Mode');
      btn.setAttribute('aria-label', 'Switch to Night Mode');
    } else {
      btn.innerHTML = SUN_SVG;
      btn.setAttribute('title', 'Switch to Day Mode');
      btn.setAttribute('aria-label', 'Switch to Day Mode');
    }
  });
}

function initTheme() {
  updateThemeIcons();
}

// Bind button clicks and update icons when page loads
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  
  // Delegate event to body to catch dynamically loaded theme toggles
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-toggle-btn, #theme-toggle');
    if (btn) {
      e.preventDefault();
      toggleTheme();
    }
  });
});

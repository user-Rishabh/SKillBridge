// ═════════════════════════════════════════════════════════════════════
// SKILLBRIDGE — UNIFIED THEME ENGINE
// ═════════════════════════════════════════════════════════════════════

// 1. Immediately apply stored or system-preferred theme on script evaluation to prevent screen flash
(function() {
  try {
    let savedTheme = localStorage.getItem('theme');
    if (!savedTheme || (savedTheme !== 'light' && savedTheme !== 'dark')) {
      if (savedTheme === 'day') {
        savedTheme = 'light';
      } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        savedTheme = prefersDark ? 'dark' : 'light';
      }
      localStorage.setItem('theme', savedTheme);
    }
    document.documentElement.setAttribute('data-theme', savedTheme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();

const SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

let lastToggleTimestamp = 0;

function getEffectiveTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

function toggleTheme(event) {
  if (event && event.stopPropagation) {
    event.stopPropagation();
  }

  const now = Date.now();
  if (now - lastToggleTimestamp < 200) {
    return; // Prevent duplicate rapid trigger from bubbling / multiple listeners
  }
  lastToggleTimestamp = now;

  const currentTheme = getEffectiveTheme();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  
  try {
    localStorage.setItem('theme', newTheme);
    localStorage.setItem('theme_user_locked', 'true');
  } catch (e) {
    console.warn('Could not persist theme to localStorage:', e);
  }

  updateThemeIcons();

  // If on resume tab, re-render live preview to ensure theme sync
  if (typeof updateResumePreview === 'function') {
    updateResumePreview();
  }

  console.log(`[Theme] Switched theme to: ${newTheme}`);
}

function updateThemeIcons() {
  const theme = getEffectiveTheme();
  const toggleBtns = document.querySelectorAll('.theme-toggle-btn, #theme-toggle');
  toggleBtns.forEach(btn => {
    if (theme === 'dark') {
      btn.innerHTML = SUN_SVG;
      btn.setAttribute('title', 'Switch to Light Mode');
      btn.setAttribute('aria-label', 'Switch to Light Mode');
    } else {
      btn.innerHTML = MOON_SVG;
      btn.setAttribute('title', 'Switch to Dark Mode');
      btn.setAttribute('aria-label', 'Switch to Dark Mode');
    }
  });
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || saved === 'light') {
    document.documentElement.setAttribute('data-theme', saved);
  } else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = prefersDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', initialTheme);
    localStorage.setItem('theme', initialTheme);
  }
  updateThemeIcons();
}

// Bind globally on window immediately
window.toggleTheme = toggleTheme;
window.initTheme = initTheme;
window.updateThemeIcons = updateThemeIcons;

// Listen for system theme changes if user hasn't explicitly set preference
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme_user_locked')) {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      updateThemeIcons();
    }
  });
}

// Initialize on DOMContentLoaded and set up event delegation
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-toggle-btn, #theme-toggle');
    if (btn) {
      e.preventDefault();
      toggleTheme(e);
    }
  });
});

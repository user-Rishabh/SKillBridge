/**
 * SkillBridge Dashboard Core Logic
 * Handles theme persistence, sidebar interactions, and dynamic UI updates.
 */

// ── CONFIGURATION ──────────────────────────────────────────
const SUPABASE_URL = 'https://jmogxwejdrkqsrmpxxya.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptb2d4d2VqZHJrcXNybXB4eHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTczMDQsImV4cCI6MjA5MjA3MzMwNH0.0W-zyGlPlJsYOJjNfMCPIATFMfli2jwQ-vi79YXUngs';

let supabase;

console.log("🚀 SkillBridge Dashboard JS Loading...");

// Initialize everything directly since the script is loaded at the bottom of the body
initTheme();
initInteractions();
animateComponents();
initTabs();

// Supabase Initialization & Dashboard
initSupabase();
initDashboard();

function initSupabase() {
    try {
        const lib = window.supabase || window.supabasejs;
        if (lib) {
            supabase = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log("✅ Supabase client initialized");
        } else {
            console.error("❌ Supabase library not found!");
        }
    } catch (err) {
        console.error("❌ Error initializing Supabase:", err);
    }
}

// ── Record today's login ─────────────────
async function recordTodayLogin(userId) {
  const today = new Date()
    .toISOString().split('T')[0];
  
  // Insert today's date — ignore if exists
  await supabase
    .from('user_activity')
    .upsert(
      { user_id: userId, activity_date: today },
      { onConflict: 'user_id,activity_date' }
    );
}

// ── Calculate real streak ────────────────
async function calculateStreak(userId) {
  const { data } = await supabase
    .from('user_activity')
    .select('activity_date')
    .eq('user_id', userId)
    .order('activity_date', { ascending: false });

  if (!data || data.length === 0) return 0;

  let streak = 0;
  let checkDate = new Date();
  // Start from today or yesterday
  // (allow same-day login)
  const todayStr = checkDate
    .toISOString().split('T')[0];
  const latestDate = data[0].activity_date;

  // If last login not today or yesterday → streak 0
  const dayDiff = Math.floor(
    (new Date(todayStr) - new Date(latestDate))
    / (1000 * 60 * 60 * 24)
  );
  if (dayDiff > 1) return 0;

  // Count consecutive days backwards
  const dateSet = new Set(
    data.map(d => d.activity_date)
  );

  checkDate = new Date(latestDate);
  while (true) {
    const dateStr = checkDate
      .toISOString().split('T')[0];
    if (dateSet.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ── Build real weekly activity heatmap ───
async function buildActivityHeatmap(userId) {
  // Get last 12 weeks of activity
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(
    twelveWeeksAgo.getDate() - 84
  );
  const fromDate = twelveWeeksAgo
    .toISOString().split('T')[0];

  const { data } = await supabase
    .from('user_activity')
    .select('activity_date')
    .eq('user_id', userId)
    .gte('activity_date', fromDate);

  // Build set of active dates
  const activeDates = new Set(
    (data || []).map(d => d.activity_date)
  );

  // Generate 12 weeks x 7 days grid
  const heatmapEl = document.getElementById(
    'activity-heatmap'
  );
  if (!heatmapEl) return;

  heatmapEl.innerHTML = '';
  heatmapEl.style.cssText = `
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 3px;
  `;

  // Build columns (weeks) left to right
  for (let week = 11; week >= 0; week--) {
    const col = document.createElement('div');
    col.style.display = 'flex';
    col.style.flexDirection = 'column';
    col.style.gap = '3px';

    for (let day = 6; day >= 0; day--) {
      const date = new Date();
      date.setDate(
        date.getDate() - (week * 7 + day)
      );
      const dateStr = date
        .toISOString().split('T')[0];
      const isActive = activeDates.has(dateStr);
      const isFuture = date > new Date();

      const cell = document.createElement('div');
      cell.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 2px;
        background: ${
          isFuture
            ? 'transparent'
            : isActive
            ? '#059669'
            : '#E2E8F0'
        };
        opacity: ${isFuture ? '0' : '1'};
        transition: background 200ms;
      `;
      cell.title = dateStr + 
        (isActive ? ' ✓ Logged in' : '');
      col.appendChild(cell);
    }
    heatmapEl.appendChild(col);
  }
}

// ── Update streak display ────────────────
async function updateStreakDisplay(userId) {
  const streak = await calculateStreak(userId);
  
  // Update streak number wherever shown
  const streakEls = document.querySelectorAll(
    '[data-streak], #streak-count, .streak-count'
  );
  streakEls.forEach(el => {
    el.textContent = streak + ' Day Streak';
  });

  // Also update the top navbar streak
  const navStreak = document.querySelector(
    '.streak-badge, .streak-display, [class*="streak"]'
  );
  if (navStreak) {
    navStreak.innerHTML = 
      '🔥 ' + streak + ' Day Streak';
  }
}

// ── Initialize everything ────────────────
async function initDashboard() {
  if (!supabase) return;

  const { data: { session } } = 
    await supabase.auth.getSession();
  
  if (!session) {
    window.location.href = 'auth.html';
    return;
  }

  const userId = session.user.id;

  // 1. Record today's login
  await recordTodayLogin(userId);

  // 2. Update streak
  await updateStreakDisplay(userId);

  // 3. Build heatmap
  await buildActivityHeatmap(userId);

  // 4. Load user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profile) {
    const name = profile.full_name || session.user.email.split('@')[0];
    const displayNameElem = document.getElementById('user-display-name');
    const greetingNameElem = document.getElementById('greeting-name');
    const profileInitialsElem = document.getElementById('profile-initials');

    if (displayNameElem) displayNameElem.textContent = name;
    if (greetingNameElem) greetingNameElem.textContent = name.split(' ')[0];
    if (profileInitialsElem) profileInitialsElem.textContent = name.substring(0, 1).toUpperCase();

    const greetEl = document.querySelector(
      '[data-greeting], .greeting-text, h1'
    );
    if (greetEl && greetEl.tagName === 'H1') {
      greetEl.textContent = 
        'Welcome back, ' +
        (profile.full_name?.split(' ')[0] 
        || 'Student') + ' 👋';
    }
  }
}

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
        };
    }

    // Logout Logic
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        console.log("✅ Logout button found, attaching listener");
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            console.log("Logout clicked");

            if (!supabase) {
                console.error("Supabase client not available");
                return;
            }

            try {
                const { error } = await supabase.auth.signOut();

                if (error) {
                    console.error("Logout error:", error.message);
                    alert("Logout failed: " + error.message);
                } else {
                    console.log("Logout successful");
                    window.location.href = "/index.html";
                }
            } catch (err) {
                console.error("Unexpected logout error:", err);
            }
        });
    }

    // Heatmap is now built by buildActivityHeatmap() in initDashboard
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

// ── Tab Switching ─────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('[data-tab]');

  function switchTab(tabName) {
    // Hide all tab sections
    document.querySelectorAll('[id^="tab-"]').forEach(sec => {
      sec.style.display = 'none';
    });

    // Show selected section with fade-in
    const target = document.getElementById('tab-' + tabName);
    if (target) {
      target.style.display = 'block';
      target.style.opacity = '0';
      target.style.transform = 'translateY(10px)';
      setTimeout(() => {
        target.style.transition = 'opacity 300ms, transform 300ms';
        target.style.opacity = '1';
        target.style.transform = 'translateY(0)';
      }, 10);
    }

    // Update active tab styles
    tabs.forEach(t => {
      const isActive = t.dataset.tab === tabName;
      t.style.background = isActive ? 'rgba(5,150,105,0.1)' : 'transparent';
      t.style.color = isActive ? '#059669' : '';
      t.style.fontWeight = isActive ? '600' : '';
      t.style.borderLeft = isActive ? '3px solid #059669' : '3px solid transparent';
    });

    localStorage.setItem('activeTab', tabName);
  }

  // Attach click listeners
  tabs.forEach(tab => {
    tab.style.cursor = 'pointer';
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(tab.dataset.tab);
    });
  });

  // Restore last active tab
  const savedTab = localStorage.getItem('activeTab') || 'dashboard';
  switchTab(savedTab);
}

// ── Profile Save (Supabase) ───────────────
document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save-profile-btn');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const updates = {
      id: session.user.id,
      full_name: document.getElementById('edit-full-name')?.value || '',
      college: document.getElementById('edit-college')?.value || '',
      branch: document.getElementById('edit-branch')?.value || '',
      dream_job: document.getElementById('edit-dream-job')?.value || '',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('profiles').upsert(updates);
    const msg = document.getElementById('profile-save-msg');
    if (msg) {
      msg.style.display = 'flex';
      setTimeout(() => { msg.style.display = 'none'; }, 3000);
    }
    if (error) console.error('Profile save error:', error.message);
  });
});

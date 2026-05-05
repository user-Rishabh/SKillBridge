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
initDashboard().then(() => postInit());

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

// ═══════════════════════════════════════════════════════
// ── ONBOARDING + ROADMAP (New Features) ─────────────────
// ═══════════════════════════════════════════════════════

const ONBOARDING_QUESTIONS = [
  { key: 'target_role', text: 'What is your target career role? (e.g. Full-Stack Developer, Data Scientist)', options: ['Full-Stack Developer', 'Data Scientist', 'UI/UX Designer', 'DevOps Engineer'] },
  { key: 'skill_level', text: 'What is your current skill level?', options: ['Beginner', 'Intermediate', 'Advanced'] },
  { key: 'existing_skills', text: 'What existing skills do you have? (Comma separated)', options: ['HTML/CSS', 'JavaScript', 'Python', 'nothing'] },
  { key: 'hours_per_day', text: 'How many hours can you commit daily?', options: ['1-2 Hours', '3-4 Hours', '5+ Hours'] }
];

let obStep = 0;
let obData = {};

// Called from initDashboard — check if onboarding needed
async function checkOnboarding(userId) {
  const lsKey = `ob_done_${userId}`;
  if (localStorage.getItem(lsKey)) return; // Already done (local fallback)

  const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', userId).single();
  if (profile && profile.onboarding_completed) return;

  startOnboarding();
}

function startOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  obStep = 0;
  obData = {};
  document.getElementById('onboarding-chat').innerHTML = '';
  setTimeout(() => askObQuestion(), 400);

  // Wire up send button & enter key once
  const sendBtn = document.getElementById('onboarding-send-btn');
  const input = document.getElementById('onboarding-input');
  if (sendBtn) sendBtn.onclick = () => handleObInput();
  if (input) input.onkeydown = (e) => { if (e.key === 'Enter') handleObInput(); };
}

function askObQuestion() {
  if (obStep >= ONBOARDING_QUESTIONS.length) { finishOnboarding(); return; }
  const q = ONBOARDING_QUESTIONS[obStep];
  addObMsg(q.text, false);
  const opts = document.getElementById('onboarding-options');
  if (opts) {
    opts.innerHTML = '';
    q.options.forEach(o => {
      const btn = document.createElement('button');
      btn.textContent = o;
      btn.style.cssText = 'padding:6px 14px;background:white;border:1px solid #059669;color:#059669;border-radius:20px;font-size:12px;cursor:pointer;margin:2px;';
      btn.onclick = () => handleObInput(o);
      opts.appendChild(btn);
    });
  }
}

function handleObInput(val) {
  if (!val) {
    const inp = document.getElementById('onboarding-input');
    val = inp ? inp.value.trim() : '';
    if (inp) inp.value = '';
  }
  if (!val) return;
  addObMsg(val, true);
  obData[ONBOARDING_QUESTIONS[obStep].key] = val;
  obStep++;
  const opts = document.getElementById('onboarding-options');
  if (opts) opts.innerHTML = '';
  setTimeout(() => askObQuestion(), 700);
}

function addObMsg(text, isUser) {
  const chat = document.getElementById('onboarding-chat');
  if (!chat) return;
  const d = document.createElement('div');
  d.style.padding = '10px 14px';
  d.style.borderRadius = '12px';
  d.style.maxWidth = '82%';
  d.style.fontSize = '14px';
  d.style.lineHeight = '1.5';
  d.style.marginBottom = '6px';
  if (isUser) {
    d.style.alignSelf = 'flex-end';
    d.style.background = '#059669';
    d.style.color = 'white';
  } else {
    d.style.alignSelf = 'flex-start';
    d.style.background = 'white';
    d.style.border = '1px solid #E2E8F0';
    d.style.color = '#1E293B';
  }
  d.textContent = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}

async function finishOnboarding() {
  addObMsg('Great! Generating your personalized roadmap now... 🚀', false);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;

  // Save onboarding data
  await supabase.from('profiles').upsert({
    id: userId,
    dream_job: obData.target_role,
    skill_level: obData.skill_level,
    onboarding_completed: true,
    updated_at: new Date().toISOString()
  });
  localStorage.setItem(`ob_done_${userId}`, 'true');

  await generateAndSaveRoadmap(userId);

  setTimeout(() => {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.style.display = 'none';
    renderRoadmap();
  }, 1800);
}

async function generateAndSaveRoadmap(userId) {
  const target = obData.target_role || 'Full-Stack Developer';
  const roadmap = {
    title: `${target} Mastery Path`,
    focus: `Mastering ${target} essentials and advanced patterns`,
    progress: 0,
    phases: [
      { id: 1, name: 'Foundations', status: 'active', skills: ['HTML5', 'CSS3', 'JS ES6'] },
      { id: 2, name: 'Frameworks', status: 'locked', skills: ['React', 'State Mgmt', 'Routing'] },
      { id: 3, name: 'Backend', status: 'locked', skills: ['Node.js', 'DB Design', 'APIs'] },
      { id: 4, name: 'Career Prep', status: 'locked', skills: ['Portfolio', 'Interviews', 'Resume'] }
    ],
    projects: [
      { name: 'Personal Portfolio', status: 'In Progress', progress: 20, tags: ['HTML', 'CSS', 'JS'] },
      { name: 'Task Manager App', status: 'Upcoming', progress: 0, tags: ['React'] }
    ],
    skill_stats: [
      { name: 'Frontend', value: 20 },
      { name: 'Backend', value: 5 },
      { name: 'Problem Solving', value: 10 }
    ]
  };
  await supabase.from('profiles').update({ roadmap_json: roadmap }).eq('id', userId);
  return roadmap;
}

async function renderRoadmap() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { data: profile } = await supabase.from('profiles').select('roadmap_json').eq('id', session.user.id).single();
  if (!profile || !profile.roadmap_json) return;
  const r = profile.roadmap_json;

  // Phase nodes
  ['roadmap-nodes-dashboard', 'roadmap-nodes-tab'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = r.phases.map(p => `<div class="node ${p.status}">${p.status === 'active' ? '<div class="node-active-tag">You are here</div>' : ''}<span class="node-label">${p.name}</span></div>`).join('');
  });

  // Phase grid (roadmap tab)
  const pg = document.getElementById('roadmap-phase-grid');
  if (pg) {
    pg.innerHTML = r.phases.map(p => {
      const colors = p.status === 'active' ? ['#FFF7ED','#FED7AA','#92400E'] : p.status === 'completed' ? ['#F0FDF4','#BBF7D0','#065F46'] : ['#F8FAFC','#E2E8F0','#64748B'];
      return `<div style="padding:14px;background:${colors[0]};border-radius:10px;border:1px solid ${colors[1]};"><div style="font-size:13px;font-weight:700;color:${colors[2]};">${p.status === 'active' ? '⏳ In Progress' : p.status === 'completed' ? '✅ Done' : '🔒 Upcoming'}</div><div style="font-size:14px;font-weight:600;margin-top:4px;">${p.name}</div><div style="font-size:12px;color:${colors[2]};margin-top:2px;">${p.skills.join(', ')}</div></div>`;
    }).join('');
  }

  // Projects
  ['active-projects-container', 'all-projects-container'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = r.projects.map(p => `
      <div class="project-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <h4 style="font-size:15px;font-weight:700;">${p.name}</h4>
          <span class="status-badge ${p.status !== 'Completed' ? 'in-progress' : ''}">${p.status}</span>
        </div>
        <div class="tag-list" style="margin-bottom:10px;">${p.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:4px;"><span>Progress</span><span>${p.progress}%</span></div>
        <div class="progress-bg"><div class="progress-fill" style="width:${p.progress}%;"></div></div>
      </div>`).join('');
  });

  // Skills
  const sc = document.getElementById('skill-progress-container');
  if (sc) {
    sc.innerHTML = r.skill_stats.map(s => `
      <div class="skill-item">
        <div class="skill-info"><span>${s.name}</span><span>${s.value}%</span></div>
        <div class="progress-bg"><div class="progress-fill" style="width:${s.value}%;"></div></div>
      </div>`).join('');
  }
}

// Post-init: runs after original initDashboard completes
async function postInit() {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await checkOnboarding(session.user.id);
    await renderRoadmap();
  }
}

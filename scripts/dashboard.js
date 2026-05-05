/**
 * SkillBridge Dashboard — Full Logic
 */

const SUPABASE_URL = 'https://jmogxwejdrkqsrmpxxya.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptb2d4d2VqZHJrcXNybXB4eHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTczMDQsImV4cCI6MjA5MjA3MzMwNH0.0W-zyGlPlJsYOJjNfMCPIATFMfli2jwQ-vi79YXUngs';

let supabase;

console.log('🚀 SkillBridge Dashboard JS Loading...');

initTheme();
initInteractions();
initTabs();

initSupabase();
initDashboard().then(() => postInit());

// ── Supabase Init ────────────────────────────────────────────
function initSupabase() {
    try {
        const lib = window.supabase || window.supabasejs;
        if (lib) {
            supabase = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase client initialized');
        } else {
            console.error('❌ Supabase library not found!');
        }
    } catch (err) {
        console.error('❌ Error initializing Supabase:', err);
    }
}

// ── Activity Tracking ────────────────────────────────────────
async function recordTodayLogin(userId) {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('user_activity').upsert(
        { user_id: userId, activity_date: today },
        { onConflict: 'user_id,activity_date' }
    );
}

async function calculateStreak(userId) {
    const { data } = await supabase
        .from('user_activity')
        .select('activity_date')
        .eq('user_id', userId)
        .order('activity_date', { ascending: false });

    if (!data || data.length === 0) return 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const latestDate = data[0].activity_date;
    const dayDiff = Math.floor((new Date(todayStr) - new Date(latestDate)) / 86400000);
    if (dayDiff > 1) return 0;

    let streak = 0;
    const dateSet = new Set(data.map(d => d.activity_date));
    let checkDate = new Date(latestDate);
    while (true) {
        const ds = checkDate.toISOString().split('T')[0];
        if (dateSet.has(ds)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
        else break;
    }
    return streak;
}

async function buildActivityHeatmap(userId) {
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
    const fromDate = twelveWeeksAgo.toISOString().split('T')[0];
    const { data } = await supabase.from('user_activity').select('activity_date')
        .eq('user_id', userId).gte('activity_date', fromDate);

    const activeDates = new Set((data || []).map(d => d.activity_date));
    const heatmapEl = document.getElementById('activity-heatmap');
    if (!heatmapEl) return;
    heatmapEl.innerHTML = '';
    heatmapEl.style.cssText = 'display:grid;grid-template-columns:repeat(12,1fr);gap:3px;';

    for (let week = 11; week >= 0; week--) {
        const col = document.createElement('div');
        col.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
        for (let day = 6; day >= 0; day--) {
            const date = new Date();
            date.setDate(date.getDate() - (week * 7 + day));
            const ds = date.toISOString().split('T')[0];
            const isActive = activeDates.has(ds);
            const isFuture = date > new Date();
            const cell = document.createElement('div');
            cell.style.cssText = `width:12px;height:12px;border-radius:2px;background:${isFuture ? 'transparent' : isActive ? '#059669' : '#E2E8F0'};opacity:${isFuture ? '0' : '1'};transition:background 200ms;`;
            cell.title = ds + (isActive ? ' ✓' : '');
            col.appendChild(cell);
        }
        heatmapEl.appendChild(col);
    }
}

async function updateStreakDisplay(userId) {
    const streak = await calculateStreak(userId);
    const navStreak = document.querySelector('.streak-badge,[class*="streak"]');
    if (navStreak) navStreak.innerHTML = '🔥 ' + streak + ' Day Streak';
}

// ── Main Dashboard Init ──────────────────────────────────────
async function initDashboard() {
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'auth.html'; return; }

    const userId = session.user.id;
    await recordTodayLogin(userId);
    await updateStreakDisplay(userId);
    await buildActivityHeatmap(userId);

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profile) {
        const name = profile.full_name || session.user.email.split('@')[0];
        setText('user-display-name', name);
        setText('greeting-name', name.split(' ')[0]);
        setText('profile-initials', name.substring(0, 1).toUpperCase());
        setText('profile-name-display', name);
        setText('profile-email-display', session.user.email);

        const bigAvatar = document.getElementById('profile-avatar-big');
        if (bigAvatar) bigAvatar.textContent = name.substring(0, 1).toUpperCase();

        // Populate profile edit fields
        setVal('edit-full-name', profile.full_name || '');
        setVal('edit-college', profile.college_name || profile.college || '');
        setVal('edit-branch', profile.branch || '');
        setVal('edit-dream-job', profile.dream_job || '');
    }
}

// ── Post-Init: Onboarding Check + Render ────────────────────
async function postInit() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;
    const { data: profile } = await supabase.from('profiles').select('onboarding_completed,roadmap_json').eq('id', userId).single();

    if (!profile || !profile.onboarding_completed) {
        startOnboarding();
    } else {
        await renderDashboard();
    }

    // Hook Generate AI Roadmap button
    const genBtn = document.getElementById('generate-roadmap-btn');
    if (genBtn) {
        genBtn.addEventListener('click', async () => {
            const { data: { session: s } } = await supabase.auth.getSession();
            if (!s) return;
            const { data: p } = await supabase.from('profiles').select('onboarding_completed').eq('id', s.user.id).single();
            if (!p || !p.onboarding_completed) {
                startOnboarding();
            } else {
                await generateAndSaveRoadmap(s.user.id, {});
                await renderDashboard();
            }
        });
    }

    // Regenerate roadmap button (roadmap tab)
    const regenBtn = document.getElementById('regenerate-roadmap-btn');
    if (regenBtn) {
        regenBtn.addEventListener('click', () => startOnboarding());
    }

    // Roadmap tab Generate button
    const roadmapTabBtn = document.querySelector('#tab-roadmap .btn-primary');
    if (roadmapTabBtn) {
        roadmapTabBtn.addEventListener('click', async () => {
            const goalInput = document.getElementById('roadmap-goal-input');
            const goal = goalInput ? goalInput.value.trim() : '';
            const { data: { session: s } } = await supabase.auth.getSession();
            if (!s) return;
            const tempData = { target_role: goal || 'Full-Stack Developer' };
            await generateAndSaveRoadmap(s.user.id, tempData);
            await renderDashboard();
        });
    }

    // Roadmap Summary Modal
    const viewSummaryBtn = document.getElementById('view-roadmap-summary-btn');
    const modal = document.getElementById('roadmap-summary-modal');
    const closeModal = document.getElementById('close-roadmap-modal');
    if (viewSummaryBtn && modal) {
        viewSummaryBtn.addEventListener('click', async () => {
            const { data: { session: s } } = await supabase.auth.getSession();
            if (!s) return;
            const { data: p } = await supabase.from('profiles').select('roadmap_json').eq('id', s.user.id).single();
            const r = p?.roadmap_json;
            const content = document.getElementById('roadmap-summary-content');
            if (content && r) {
                content.innerHTML = `
                  <p><strong>🎯 Goal:</strong> ${r.title || ''}</p>
                  <p><strong>📌 Focus:</strong> ${r.focus || ''}</p>
                  <p><strong>📈 Progress:</strong> ${r.progress || 0}%</p>
                  <h4 style="margin:16px 0 8px;">Phases</h4>
                  ${(r.phases || []).map(p => `<div style="margin-bottom:8px;padding:10px;background:#F8FAFC;border-radius:8px;">
                    <strong>${p.name}</strong> — ${p.status}<br>
                    <span style="font-size:12px;color:#64748B;">${(p.skills || []).join(', ')}</span>
                  </div>`).join('')}`;
            } else if (content) {
                content.innerHTML = '<p style="color:#64748B;">No roadmap generated yet.</p>';
            }
            modal.style.display = 'flex';
        });
    }
    if (closeModal && modal) closeModal.addEventListener('click', () => modal.style.display = 'none');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    // Reset Roadmap
    const resetBtn = document.getElementById('reset-roadmap-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (!confirm('Reset your roadmap? This will restart onboarding.')) return;
            const { data: { session: s } } = await supabase.auth.getSession();
            if (!s) return;
            await supabase.from('profiles').update({ onboarding_completed: false, roadmap_json: null }).eq('id', s.user.id);
            localStorage.removeItem(`ob_done_${s.user.id}`);
            startOnboarding();
        });
    }

    // Profile Save
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!supabase) return;
            const { data: { session: s } } = await supabase.auth.getSession();
            if (!s) return;
            const updates = {
                id: s.user.id,
                full_name: getVal('edit-full-name'),
                college_name: getVal('edit-college'),
                branch: getVal('edit-branch'),
                dream_job: getVal('edit-dream-job'),
                updated_at: new Date().toISOString()
            };
            const { error } = await supabase.from('profiles').upsert(updates);
            const msg = document.getElementById('profile-save-msg');
            if (msg) { msg.style.display = 'flex'; setTimeout(() => { msg.style.display = 'none'; }, 3000); }
            if (error) console.error('Profile save error:', error.message);
        });
    }
}

// ── Render Dashboard from DB ─────────────────────────────────
async function renderDashboard() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: profile } = await supabase.from('profiles').select('roadmap_json').eq('id', session.user.id).single();
    if (!profile || !profile.roadmap_json) {
        // Reset stats to zero
        setText('stat-progress', '0%');
        setText('stat-projects', '0');
        setText('stat-skills', '0');
        setText('stat-placement', '0%');
        return;
    }

    const r = profile.roadmap_json;

    // Update focus text
    setText('roadmap-focus-text', r.focus || 'Your personalized roadmap is ready.');

    // Progress bar
    const progress = r.progress || 0;
    const bars = ['roadmap-progress-bar', 'roadmap-tab-progress-bar'];
    bars.forEach(id => { const el = document.getElementById(id); if (el) el.style.width = progress + '%'; });

    // Stats
    const completedProjects = (r.projects || []).filter(p => p.status === 'Completed').length;
    const totalSkills = (r.skill_stats || []).length;
    const placementReadiness = Math.round(progress * 0.8);
    setText('stat-progress', progress + '%');
    setText('stat-projects', completedProjects);
    setText('stat-skills', totalSkills);
    setText('stat-placement', placementReadiness + '%');

    // Roadmap nodes
    ['roadmap-nodes-dashboard', 'roadmap-nodes-tab'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = (r.phases || []).map(p =>
            `<div class="node ${p.status}">${p.status === 'active' ? '<div class="node-active-tag">You are here</div>' : ''}<span class="node-label">${p.name}</span></div>`
        ).join('');
    });

    // Phase grid
    const pg = document.getElementById('roadmap-phase-grid');
    if (pg) {
        pg.innerHTML = (r.phases || []).map(p => {
            const colors = p.status === 'active' ? ['#FFF7ED','#FED7AA','#92400E']
                : p.status === 'completed' ? ['#F0FDF4','#BBF7D0','#065F46']
                : ['#F8FAFC','#E2E8F0','#64748B'];
            return `<div style="padding:14px;background:${colors[0]};border-radius:10px;border:1px solid ${colors[1]};">
              <div style="font-size:13px;font-weight:700;color:${colors[2]};">${p.status === 'active' ? '⏳ In Progress' : p.status === 'completed' ? '✅ Done' : '🔒 Upcoming'}</div>
              <div style="font-size:14px;font-weight:600;margin-top:4px;">${p.name}</div>
              <div style="font-size:12px;color:${colors[2]};margin-top:2px;">${(p.skills || []).join(', ')}</div>
            </div>`;
        }).join('');
    }

    // Projects
    ['active-projects-container', 'all-projects-container'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (!r.projects || r.projects.length === 0) {
            el.innerHTML = '<div style="font-size:14px;color:var(--text-secondary);">No projects yet.</div>';
            return;
        }
        el.innerHTML = r.projects.map(p => `
          <div class="project-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
              <h4 style="font-size:15px;font-weight:700;">${p.name}</h4>
              <span class="status-badge ${p.status !== 'Completed' ? 'in-progress' : ''}">${p.status}</span>
            </div>
            <div class="tag-list" style="margin-bottom:10px;">${(p.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}</div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:4px;"><span>Progress</span><span>${p.progress}%</span></div>
            <div class="progress-bg"><div class="progress-fill" style="width:${p.progress}%;"></div></div>
          </div>`).join('');
    });

    // Skills
    const sc = document.getElementById('skill-progress-container');
    if (sc) {
        if (!r.skill_stats || r.skill_stats.length === 0) {
            sc.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);">No data yet.</div>';
        } else {
            sc.innerHTML = r.skill_stats.map(s => `
              <div class="skill-item">
                <div class="skill-info"><span>${s.name}</span><span>${s.value}%</span></div>
                <div class="progress-bg"><div class="progress-fill" style="width:${s.value}%;"></div></div>
              </div>`).join('');
        }
    }

    // Skill Badges
    const badges = document.getElementById('skill-badges-container');
    if (badges && r.skill_stats && r.skill_stats.length > 0) {
        badges.innerHTML = r.skill_stats.map(s => `
          <div style="padding:6px 14px;background:#F0FDF4;color:#059669;border-radius:20px;font-size:12px;font-weight:600;border:1px solid #BBF7D0;">
            🏅 ${s.name}
          </div>`).join('');
    }

    if (window.lucide) window.lucide.createIcons();
}

// ── Generate & Save Roadmap ──────────────────────────────────
async function generateAndSaveRoadmap(userId, data) {
    const target = data.target_role || obData.target_role || 'Full-Stack Developer';
    const level = data.skill_level || obData.skill_level || 'Beginner';
    const hours = data.hours_per_day || obData.hours_per_day || '1-2 Hours';

    const roadmap = {
        title: `${target} Mastery Path`,
        focus: `Mastering ${target} essentials — Level: ${level}, Daily: ${hours}`,
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

// ── Onboarding Flow ──────────────────────────────────────────
const ONBOARDING_QUESTIONS = [
    { key: 'target_role', text: 'What is your target career role? (e.g. Full-Stack Developer, Data Scientist)', options: ['Full-Stack Developer', 'Data Scientist', 'UI/UX Designer', 'DevOps Engineer'] },
    { key: 'skill_level', text: 'What is your current skill level?', options: ['Beginner', 'Intermediate', 'Advanced'] },
    { key: 'existing_skills', text: 'What existing skills do you have? (Comma separated)', options: ['HTML/CSS', 'JavaScript', 'Python', 'None'] },
    { key: 'hours_per_day', text: 'How many hours can you commit daily?', options: ['1-2 Hours', '3-4 Hours', '5+ Hours'] }
];

let obStep = 0;
let obData = {};

async function checkOnboarding(userId) {
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
    d.style.cssText = `padding:10px 14px;border-radius:12px;max-width:82%;font-size:14px;line-height:1.5;margin-bottom:6px;align-self:${isUser ? 'flex-end' : 'flex-start'};background:${isUser ? '#059669' : 'white'};color:${isUser ? 'white' : '#1E293B'};${isUser ? '' : 'border:1px solid #E2E8F0;'}`;
    d.textContent = text;
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
}

async function finishOnboarding() {
    addObMsg('Great! Generating your personalized roadmap now... 🚀', false);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;

    // Save all 4 onboarding fields to profiles table
    await supabase.from('profiles').upsert({
        id: userId,
        goal: obData.target_role || '',
        current_level: obData.skill_level || '',
        skills: obData.existing_skills || '',
        timeline: obData.hours_per_day || '',
        dream_job: obData.target_role || '',
        onboarding_completed: true,
        updated_at: new Date().toISOString()
    });
    localStorage.setItem(`ob_done_${userId}`, 'true');

    await generateAndSaveRoadmap(userId, obData);

    setTimeout(async () => {
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) overlay.style.display = 'none';
        await renderDashboard();
    }, 1800);
}

// ── Theme ────────────────────────────────────────────────────
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

// ── Interactions ─────────────────────────────────────────────
function initInteractions() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!supabase) return;
            try {
                const { error } = await supabase.auth.signOut();
                if (error) { alert('Logout failed: ' + error.message); }
                else { window.location.href = '/index.html'; }
            } catch (err) { console.error('Unexpected logout error:', err); }
        });
    }
}

// ── Tab Switching ─────────────────────────────────────────────
function initTabs() {
    const tabs = document.querySelectorAll('[data-tab]');
    function switchTab(tabName) {
        document.querySelectorAll('[id^="tab-"]').forEach(sec => { sec.style.display = 'none'; });
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
        tabs.forEach(t => {
            const isActive = t.dataset.tab === tabName;
            t.style.background = isActive ? 'rgba(5,150,105,0.1)' : 'transparent';
            t.style.color = isActive ? '#059669' : '';
            t.style.fontWeight = isActive ? '600' : '';
            t.style.borderLeft = isActive ? '3px solid #059669' : '3px solid transparent';
        });
        localStorage.setItem('activeTab', tabName);
    }
    tabs.forEach(tab => {
        tab.style.cursor = 'pointer';
        tab.addEventListener('click', (e) => { e.preventDefault(); switchTab(tab.dataset.tab); });
    });
    const savedTab = localStorage.getItem('activeTab') || 'dashboard';
    switchTab(savedTab);
}

// ── Helpers ──────────────────────────────────────────────────
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }

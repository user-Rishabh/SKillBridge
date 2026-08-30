// ══════════════════════════════════════════════════════════════════
// SKILLBRIDGE DASHBOARD FEATURES & CORE ENGINES
// ══════════════════════════════════════════════════════════════════

// ── Dashboard Initialization ─────────────────────────────────
async function initDashboard(profile) {
  if (!profile) {
    console.error('No profile data provided to initDashboard');
    return;
  }
  
  window.currentUserName = profile.full_name || 'Student';
  window.currentUserId = profile.id || (window.supabase?.auth?.user()?.id);
  
  // 1. Update greeting and sub-greeting
  const greetEl = document.getElementById('greeting-text');
  if (greetEl) {
    const firstName = (window.currentUserName || 'Student').split(' ')[0];
    greetEl.textContent = `Welcome back, ${firstName} 👋`;
  }
  
  const subEl = document.getElementById('greeting-sub');
  if (subEl) {
    const goalText = typeof getGoalText === 'function' ? getGoalText(profile.goal) : (profile.goal || '');
    subEl.textContent = goalText ? `Path: ${goalText}` : 'Set your goal to start';
  }

  // 2. Load XP display
  const xpEl = document.getElementById('xp-display-text');
  if (xpEl) {
    xpEl.textContent = `Level ${profile.level || 1} · ${profile.xp || 0} XP`;
  }

  // 3. Load all dashboard core data
  try {
    await Promise.all([
      typeof loadDashboardStats === 'function' ? loadDashboardStats() : Promise.resolve(),
      typeof updateStreakDisplay === 'function' ? updateStreakDisplay(profile.id) : Promise.resolve(),
      buildActivityHeatmap(profile.id),
      loadTodaysFocus(),
      loadShortRoadmap(profile.roadmap_data),
      loadNotifications(profile.notifications)
    ]);
    if (typeof recordTodayLogin === 'function') {
      recordTodayLogin(profile.id);
    }
    console.log('✅ SkillBridge Dashboard initialized successfully');
  } catch(err) {
    console.error('Dashboard load error:', err);
  }
}

// ── Notifications System ─────────────────────────────────────
function toggleNotifications() {
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;
  const isVisible = dropdown.style.display === 'block';
  dropdown.style.display = isVisible ? 'none' : 'block';
}

async function loadNotifications(notifs) {
  const list = document.getElementById('notif-list');
  const count = document.getElementById('notif-count');
  const enableBtn = document.getElementById('enable-notif-btn');

  if (enableBtn) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      enableBtn.style.display = 'inline-flex';
    } else {
      enableBtn.style.display = 'none';
    }
  }

  const data = notifs || [];
  if (data.length > 0) {
    if (count) {
      count.textContent = data.length;
      count.style.display = 'flex';
    }
    if (list) {
      list.innerHTML = data.map(n => `
        <div style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); cursor:pointer; transition:background-color 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
          <div style="font-size:13px; font-weight:600; color:white; margin-bottom:2px;">${n.title || 'Alert'}</div>
          <div style="font-size:12px; color:#94A3B8;">${n.message || ''}</div>
          <div style="font-size:10px; color:#64748B; margin-top:4px;">${n.time || 'Just now'}</div>
        </div>
      `).join('');
    }
  } else {
    if (count) count.style.display = 'none';
    if (list) list.innerHTML = `<div style="padding:30px; text-align:center; color:#64748B; font-size:13px;">No new notifications</div>`;
  }
}

async function clearNotifications() {
  if (!window.currentUserId) return;
  await supabase.from('profiles').update({ notifications: [] }).eq('id', window.currentUserId);
  loadNotifications([]);
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    if (typeof showToast === 'function') showToast('This browser does not support desktop notifications', 'warning');
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    if (typeof showToast === 'function') showToast('🎉 Desktop notifications enabled!');
    await addNotification('🔔 Notifications Enabled', 'You will now receive desktop alerts for task completions and level ups.');
  } else {
    if (typeof showToast === 'function') showToast('Notifications disabled. Enable them in browser settings.', 'info');
  }
  const enableBtn = document.getElementById('enable-notif-btn');
  if (enableBtn) {
    enableBtn.style.display = (permission === 'default') ? 'inline-flex' : 'none';
  }
}

async function addNotification(title, message) {
  if (!window.currentUserId) return;
  const { data: profile } = await supabase.from('profiles').select('notifications').eq('id', window.currentUserId).single();
  const currentNotifs = profile?.notifications || [];
  
  const newNotif = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    title,
    message,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    created_at: new Date().toISOString()
  };

  const updatedNotifs = [newNotif, ...currentNotifs].slice(0, 50);
  await supabase.from('profiles').update({ notifications: updatedNotifs }).eq('id', window.currentUserId);
  
  loadNotifications(updatedNotifs);
  if (typeof showToast === 'function') showToast(`${title}: ${message}`);
}

// ── Theme Management ─────────────────────────────────────────
function toggleTheme() {
  // Theme is locked to dark mode.
}

function initTheme() {
  if (typeof updateThemeIcons === 'function') {
    updateThemeIcons();
  }
}

// ── XP & Progression ─────────────────────────────────────────
function loadXPDisplay(profile) {
  const xp = profile?.xp || 0;
  const level = profile?.level || 1;
  const text = document.getElementById('xp-display-text');
  if (text) text.textContent = `Level ${level} · ${xp} XP`;
}

function showXPDetails() {
  alert("XP Breakdown: Complete tasks (+15-50 XP), finish projects (+100 XP), and maintain daily streaks!");
}

// ── Session History ──────────────────────────────────────────
async function startNewSession() {
  const startTime = new Date().toISOString();
  const sessionName = prompt("What are you focusing on this session?", "Learning React");
  if (!sessionName) return;

  if (typeof showToast === 'function') showToast("Session started! Timer is running.");

  const { data: profile } = await supabase.from('profiles').select('session_history').eq('id', window.currentUserId).single();
  const history = profile?.session_history || [];
  history.unshift({ name: sessionName, started: startTime, status: 'active' });

  await supabase.from('profiles').update({ session_history: history }).eq('id', window.currentUserId);
}

// ── Today's Focus ────────────────────────────────────────────
async function loadTodaysFocus() {
  const titleEl = document.getElementById('cc-focus-title');
  const descEl = document.getElementById('cc-focus-desc');
  const xpEl = document.getElementById('cc-focus-xp');
  const catEl = document.getElementById('cc-focus-category');
  const diffEl = document.getElementById('cc-focus-difficulty');
  const progressEl = document.getElementById('cc-focus-progress');
  const btnEl = document.getElementById('cc-focus-btn');

  if (!titleEl) return;

  const { data: dbTasks } = await supabase.from('tasks')
    .select('*')
    .eq('user_id', window.currentUserId);

  if (!dbTasks || dbTasks.length === 0) {
    titleEl.textContent = "Welcome to SkillBridge! 👋";
    if (descEl) descEl.textContent = "Please generate your personalized career roadmap in the AI Roadmap tab to start receiving your focus tasks.";
    if (xpEl) xpEl.style.display = 'none';
    if (catEl) catEl.style.display = 'none';
    if (diffEl) diffEl.style.display = 'none';
    if (progressEl) progressEl.textContent = "Progress: 0/0";
    if (btnEl) {
      btnEl.textContent = "Generate Roadmap ⚡";
      btnEl.onclick = () => switchTab('roadmap');
    }
    return;
  }

  const { data: profile } = await supabase.from('profiles')
    .select('roadmap_data')
    .eq('id', window.currentUserId)
    .single();

  const roadmap = profile?.roadmap_data;
  let tasks = [...dbTasks];

  if (roadmap?.phases) {
    const taskOrder = [];
    roadmap.phases.forEach(p => (p.tasks || []).forEach(t => taskOrder.push(t.title)));
    tasks.sort((a, b) => taskOrder.indexOf(a.title) - taskOrder.indexOf(b.title));
  }

  const activeTask = tasks.find(t => t.status !== 'completed');

  if (!activeTask) {
    titleEl.textContent = "Roadmap Completed! 🎉";
    if (descEl) descEl.textContent = "Outstanding work! You have completed all the tasks in your career roadmap. Go to the Placement section to test your job readiness.";
    if (xpEl) xpEl.style.display = 'none';
    if (catEl) catEl.style.display = 'none';
    if (diffEl) diffEl.style.display = 'none';
    if (progressEl) progressEl.textContent = "Progress: 100%";
    if (btnEl) {
      btnEl.textContent = "Start Placements 💼";
      btnEl.onclick = () => switchTab('placement');
    }
    return;
  }

  if (xpEl) {
    xpEl.style.display = 'inline-flex';
    const xpReward = activeTask.difficulty === 'Hard' ? 50 : activeTask.difficulty === 'Medium' ? 30 : 15;
    xpEl.textContent = `+${xpReward} XP`;
  }
  if (catEl) {
    catEl.style.display = 'inline-flex';
    catEl.textContent = activeTask.roadmap_phase || "Core Topic";
  }
  if (diffEl) {
    diffEl.style.display = 'inline-flex';
    diffEl.textContent = `${activeTask.difficulty || 'Medium'} Difficulty`;
    diffEl.className = `cc-badge ${activeTask.difficulty === 'Hard' ? 'badge-rose' : activeTask.difficulty === 'Medium' ? 'badge-amber' : 'badge-cyan'}`;
  }
  
  titleEl.textContent = activeTask.title;
  if (descEl) descEl.textContent = getTaskDescription(activeTask.title);
  if (progressEl) progressEl.textContent = "Progress: 0/1";
  
  if (btnEl) {
    btnEl.textContent = "Start Task →";
    btnEl.onclick = (e) => {
      e.stopPropagation();
      if (typeof openTaskDetail === 'function') openTaskDetail(activeTask.id);
      else if (typeof switchTab === 'function') switchTab('tasks');
    };
  }
}

function getTaskDescription(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("react") || t.includes("component") || t.includes("hook")) {
    return `Master component structure, lifecycle, and dynamic state management in modern React applications.`;
  }
  if (t.includes("javascript") || t.includes("es6") || t.includes("js")) {
    return `Explore advanced syntax, asynchronous patterns, DOM operations, and closures in JavaScript.`;
  }
  if (t.includes("html") || t.includes("css") || t.includes("flexbox") || t.includes("layout")) {
    return `Develop responsive, semantic web page layouts with flexbox, grid, CSS custom properties, and SEO practices.`;
  }
  if (t.includes("node") || t.includes("express") || t.includes("backend") || t.includes("api")) {
    return `Design high-performance REST APIs, configure routes, set up middlewares, and interface with datastores.`;
  }
  if (t.includes("sql") || t.includes("database") || t.includes("mongo") || t.includes("postgres")) {
    return `Learn database design, indices optimization, connection pooling, and complex querying.`;
  }
  if (t.includes("git") || t.includes("github") || t.includes("version")) {
    return `Master source code control, branching models, pull request reviews, and remote collaborative workflows.`;
  }
  if (t.includes("design") || t.includes("ui") || t.includes("ux") || t.includes("wireframe") || t.includes("figma")) {
    return `Analyze user flows, build high-fidelity interactive wireframes, and design consistent UI component libraries.`;
  }
  return `Learn, practice, and implement ${title} to build key specialization projects and boost placement readiness.`;
}

async function completeFocusTask(id) {
  const { data: task } = await supabase.from('tasks').select('title').eq('id', id).single();
  await supabase.from('tasks').update({ status: 'completed' }).eq('id', id);
  if (typeof addNotification === 'function') {
    await addNotification('✅ Focus Task Completed', `You completed "${task?.title || 'a task'}" and earned 10 XP!`);
  }
  loadTodaysFocus();
  if (typeof loadDashboardStats === 'function') loadDashboardStats();
}

// ── Activity Heatmap ─────────────────────────────────────────
async function buildActivityHeatmap(userId) {
  const grid = document.getElementById('heatmap-grid');
  if (!grid || !userId) return;

  const { data } = await supabase.from('user_activity')
    .select('activity_date')
    .eq('user_id', userId)
    .order('activity_date', { ascending: true });

  const activeDates = new Set((data || []).map(d => d.activity_date));
  const today = new Date();
  grid.innerHTML = '';

  const currentDay = today.getDay();

  for (let i = 0; i < 12; i++) {
    const col = document.createElement('div');
    col.style.display = 'flex';
    col.style.flexDirection = 'column';
    col.style.gap = '3px';

    for (let j = 0; j < 7; j++) {
      const date = new Date(today);
      const daysOffset = (11 - i) * 7 + (currentDay - j);
      date.setDate(today.getDate() - daysOffset);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayVal = String(date.getDate()).padStart(2, '0');
      const ds = `${year}-${month}-${dayVal}`;

      const isActive = activeDates.has(ds);
      const isFuture = date > today;

      const cell = document.createElement('div');
      cell.className = 'heat-cell';
      cell.style.width = '12px';
      cell.style.height = '12px';
      cell.style.borderRadius = '2px';

      if (isFuture) {
        cell.style.background = 'transparent';
        cell.style.pointerEvents = 'none';
      } else {
        cell.style.background = isActive ? '#6F9FBE' : '#EEF2F4';
        cell.style.border = '1px solid #E4E1DE';
        cell.title = `${ds} (${isActive ? 'Active' : 'No activity'})`;
        
        cell.style.transition = 'transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease';
        cell.onmouseover = () => {
          cell.style.transform = 'scale(1.3)';
          if (isActive) {
            cell.style.boxShadow = '0 0 8px rgba(111, 159, 190, 0.4)';
            cell.style.background = '#4F7896';
          } else {
            cell.style.background = '#DCECF6';
          }
        };
        cell.onmouseout = () => {
          cell.style.transform = 'scale(1)';
          cell.style.background = isActive ? '#6F9FBE' : '#EEF2F4';
          cell.style.boxShadow = 'none';
        };
      }
      col.appendChild(cell);
    }
    grid.appendChild(col);
  }

  const activeCount = document.getElementById('active-days-count');
  if (activeCount) activeCount.textContent = `${activeDates.size} Days Active`;
}

function loadShortRoadmap(roadmap) {
  if (typeof loadDashboardStats === 'function') loadDashboardStats();
}

function getCareerTrackFromGoal(goal) {
  if (!goal) return { track: "Software Development", spec: "Frontend Development" };
  let trueGoalText = goal;
  if (typeof goal === 'string' && goal.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(goal);
      if (parsed && typeof parsed === 'object' && 'goal' in parsed) {
        trueGoalText = parsed.goal || "";
      }
    } catch (e) {
      console.warn("Failed to parse JSON goal in getCareerTrackFromGoal:", e);
    }
  } else if (typeof goal === 'object' && goal !== null) {
    trueGoalText = goal.goal || "";
  }
  const g = String(trueGoalText).toLowerCase();
  if (g.includes("ui") || g.includes("ux") || g.includes("design") || g.includes("product designer") || g.includes("researcher")) {
    return { track: "UI/UX & Design", spec: trueGoalText };
  }
  if (g.includes("frontend") || g.includes("backend") || g.includes("full stack") || g.includes("fullstack") || g.includes("software") || g.includes("mobile") || g.includes("web dev") || g.includes("developer")) {
    return { track: "Software Development", spec: trueGoalText };
  }
  if (g.includes("ai") || g.includes("machine learning") || g.includes("ml") || g.includes("data") || g.includes("science") || g.includes("analyst")) {
    if (g.includes("business") || g.includes("product")) {
      return { track: "Product & Business", spec: trueGoalText };
    }
    return { track: "AI & Data", spec: trueGoalText };
  }
  if (g.includes("devops") || g.includes("cloud") || g.includes("sre") || g.includes("platform") || g.includes("infrastructure")) {
    return { track: "Cloud & DevOps", spec: trueGoalText };
  }
  if (g.includes("cyber") || g.includes("security") || g.includes("soc") || g.includes("appsec") || g.includes("infosec")) {
    return { track: "Cybersecurity", spec: trueGoalText };
  }
  if (g.includes("product manager") || g.includes("pm") || g.includes("business") || g.includes("project manager") || g.includes("analyst")) {
    return { track: "Product & Business", spec: trueGoalText };
  }
  return { track: "Software Development", spec: trueGoalText };
}

function confirmCareerTrackSwitch(roleName) {
  const modal = document.getElementById('switch-track-modal');
  const roleNameEl = document.getElementById('switch-role-name');
  const confirmBtn = document.getElementById('confirm-switch-btn');
  if (roleNameEl) roleNameEl.textContent = roleName;
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      executeCareerTrackSwitch(roleName);
    };
  }
  if (modal) modal.style.display = 'flex';
}

function closeSwitchTrackModal() {
  const modal = document.getElementById('switch-track-modal');
  if (modal) modal.style.display = 'none';
}

async function executeCareerTrackSwitch(roleName) {
  closeSwitchTrackModal();
  if (typeof showToast === 'function') showToast(`Switching path to ${roleName}...`, 'info');
  const goalInput = document.getElementById('roadmap-goal-input');
  if (goalInput) goalInput.value = roleName;
  if (typeof switchTab === 'function') switchTab('roadmap');
  await supabase.from('profiles').update({ goal: roleName }).eq('id', window.currentUserId);
  generateNewRoadmap();
}

function getRoadmapPrompt(goal) {
  return `You are a Principal Software Engineer and Technical Director.
Create a strictly sequential, technical learning roadmap for: "${goal}".
CRITICAL RULES:
1. ONLY technical, domain-specific programming, algorithmic, mathematical, and engineering milestones.
2. ABSOLUTELY NO generic orientation, soft-skill, SWOT analysis, or generic goal-setting tasks.
3. If the goal is Data Scientist / AI / ML, tasks MUST focus on Python, Statistics & Probability, NumPy/Pandas, SQL for Analytics, Exploratory Data Analysis, Scikit-Learn Machine Learning, PyTorch Deep Learning, and MLOps deployment.
4. Each phase must contain exactly 4 technical tasks with real documentation URLs and 1 practical capstone project.

Return ONLY this exact JSON structure:
{"title":"${goal} Roadmap","totalWeeks":16,"jobReadinessTarget":"4 months","phases":[{"phase":"Phase 1 • Title","name":"Phase 1 • Title","description":"Description","weeks":"Week 1-4","skills":["Skill1","Skill2","Skill3","Skill4"],"project":"Project Name","status":"current","tasks":[{"title":"Task Title","difficulty":"Easy","resource":"https://developer.mozilla.org"}]}]}`;
}
window.getRoadmapPrompt = getRoadmapPrompt;

async function generateNewRoadmap() {
  const goalInput = document.getElementById('roadmap-goal-input');
  const goal = goalInput?.value || "Data Scientist";
  if (typeof resetUserProgressAndRegenerate === 'function') {
    await resetUserProgressAndRegenerate(goal);
    return;
  }
}

async function renderFullRoadmap(roadmap) {
  const display = document.getElementById('full-roadmap-display');
  if (!display) return;

  display.innerHTML = `
    <div style="text-align:center; padding:40px;">
      <div style="font-size:24px; animation: spin 1s linear infinite; display: inline-block;">⏳</div>
      <div style="margin-top:12px; color:#64748B;">Loading latest roadmap progress...</div>
    </div>
  `;

  const [tasksRes, projectsRes, profileRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', window.currentUserId),
    supabase.from('projects').select('status').eq('user_id', window.currentUserId),
    supabase.from('profiles').select('goal, level, xp, roadmap_data').eq('id', window.currentUserId).single()
  ]);

  const dbTasksList = tasksRes.data || [];
  const dbProjectsList = projectsRes.data || [];
  const profile = profileRes.data;
  const activeRoadmap = profile?.roadmap_data || roadmap;

  const roadmapTaskTitles = new Set();
  if (activeRoadmap && activeRoadmap.phases) {
    activeRoadmap.phases.forEach(phase => {
      (phase.tasks || []).forEach(task => {
        if (task.title) roadmapTaskTitles.add(task.title.toLowerCase().trim());
      });
    });
  }

  const roadmapTasks = dbTasksList.filter(t => t.title && roadmapTaskTitles.has(t.title.toLowerCase().trim()));
  const completedTasksCount = roadmapTasks.filter(t => t.status === 'completed').length;
  const totalTasksCount = roadmapTasks.length || 1;
  const overallPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
  const completedProjects = dbProjectsList.filter(p => p.status === 'completed').length;
  const currentLevel = profile?.level || 1;

  const phasesMap = {};
  roadmapTasks.forEach(task => {
    const phaseName = task.roadmap_phase || 'General Prep';
    if (!phasesMap[phaseName]) phasesMap[phaseName] = [];
    phasesMap[phaseName].push(task);
  });

  const roadmapPhases = activeRoadmap.phases || [];
  const stageTasks = [[], [], []];
  const stagePhaseDescriptions = ["", "", ""];

  roadmapPhases.forEach((p, idx) => {
    const pName = p.phase || p.name;
    const pTasks = phasesMap[pName] || (p.tasks || []).map(t => ({
      title: t.title,
      difficulty: t.difficulty || 'Medium',
      status: 'pending'
    }));

    if (idx === 0) {
      stageTasks[0] = pTasks;
      stagePhaseDescriptions[0] = p.description || "Master foundational principles and concepts.";
    } else if (idx === 1) {
      stageTasks[1] = pTasks;
      stagePhaseDescriptions[1] = p.description || "Develop core skills and interface mastery.";
    } else {
      stageTasks[2] = stageTasks[2].concat(pTasks);
      stagePhaseDescriptions[2] = p.description || "Master advanced concepts and specialize.";
    }
  });

  const phase1Total = stageTasks[0].length;
  const phase1Completed = stageTasks[0].filter(t => t.status === 'completed').length;
  const phase1Pct = phase1Total > 0 ? Math.round((phase1Completed / phase1Total) * 100) : 0;
  const isPhase1Done = phase1Total > 0 && phase1Completed === phase1Total;

  const phase2Total = stageTasks[1].length;
  const phase2Completed = stageTasks[1].filter(t => t.status === 'completed').length;
  const phase2Pct = phase2Total > 0 ? Math.round((phase2Completed / phase2Total) * 100) : 0;
  const isPhase2Done = phase2Total > 0 && phase2Completed === phase2Total;

  const phase3Total = stageTasks[2].length || 1;
  const phase3Completed = stageTasks[2].filter(t => t.status === 'completed').length;
  const phase3Pct = Math.round((phase3Completed / phase3Total) * 100);
  const isPhase3Done = phase3Completed === phase3Total && stageTasks[2].length > 0;

  let activePhaseIndex = 0;
  if (isPhase1Done) activePhaseIndex = 1;
  if (isPhase1Done && isPhase2Done) activePhaseIndex = 2;
  if (isPhase1Done && isPhase2Done && isPhase3Done) activePhaseIndex = 3;
  if (isPhase1Done && isPhase2Done && isPhase3Done && completedProjects >= 3) activePhaseIndex = 4;

  const isProjectsUnlocked = isPhase3Done;
  const projectsPct = isProjectsUnlocked ? Math.min(100, Math.round((completedProjects / 3) * 100)) : 0;
  const isProjectsDone = isProjectsUnlocked && completedProjects >= 3;

  const isJobReadyUnlocked = isProjectsDone;
  const placementProgressItems = [
    (typeof placementProgress !== 'undefined') ? placementProgress.resume : false,
    completedProjects >= 1,
    (typeof placementProgress !== 'undefined') ? placementProgress.r1 : false,
    (typeof placementProgress !== 'undefined') ? placementProgress.r2 : false,
    (typeof placementProgress !== 'undefined') ? placementProgress.r3 : false
  ];
  const placementCompletedCount = placementProgressItems.filter(Boolean).length;
  const jobReadyPct = isJobReadyUnlocked ? Math.round((placementCompletedCount / 5) * 100) : 0;

  const getStageStatusDetails = (idx) => {
    if (idx === 0) return { statusClass: isPhase1Done ? 'completed' : 'current', statusText: isPhase1Done ? '✓ Complete' : '● Current', pctText: `${phase1Pct}%` };
    if (idx === 1) {
      if (!isPhase1Done) return { statusClass: 'locked', statusText: '🔒 Locked', pctText: 'Locked' };
      return { statusClass: isPhase2Done ? 'completed' : 'current', statusText: isPhase2Done ? '✓ Complete' : '● Current', pctText: `${phase2Pct}%` };
    }
    if (idx === 2) {
      if (!isPhase2Done) return { statusClass: 'locked', statusText: '🔒 Locked', pctText: 'Locked' };
      return { statusClass: isPhase3Done ? 'completed' : 'current', statusText: isPhase3Done ? '✓ Complete' : '● Current', pctText: `${phase3Pct}%` };
    }
    if (idx === 3) {
      if (!isProjectsUnlocked) return { statusClass: 'locked', statusText: '🔒 Locked', pctText: 'Locked' };
      return { statusClass: isProjectsDone ? 'completed' : 'current', statusText: isProjectsDone ? '✓ Complete' : '● Current', pctText: `${projectsPct}%` };
    }
    if (idx === 4) {
      if (!isJobReadyUnlocked) return { statusClass: 'locked', statusText: '🔒 Locked', pctText: 'Locked' };
      const isJobReadyDone = placementCompletedCount === 5;
      return { statusClass: isJobReadyDone ? 'completed' : 'current', statusText: isJobReadyDone ? '✓ Complete' : '● Current', pctText: `${jobReadyPct}%` };
    }
  };

  const s1 = getStageStatusDetails(0);
  const s2 = getStageStatusDetails(1);
  const s3 = getStageStatusDetails(2);
  const s4 = getStageStatusDetails(3);
  const s5 = getStageStatusDetails(4);

  const goalTitle = typeof getGoalText === 'function' ? getGoalText(profile?.goal) : (profile?.goal || "Frontend Developer");
  const activePhaseNameText = activePhaseIndex === 0 ? "Foundation" : activePhaseIndex === 1 ? "Core Skills" : activePhaseIndex === 2 ? "Advanced Skills" : activePhaseIndex === 3 ? "Real-World Projects" : "Job Ready Prep";

  const activeTask = roadmapTasks
    .sort((a, b) => {
      if (activeRoadmap?.phases) {
        const taskOrder = [];
        activeRoadmap.phases.forEach(p => (p.tasks || []).forEach(t => taskOrder.push(t.title)));
        return taskOrder.indexOf(a.title) - taskOrder.indexOf(b.title);
      }
      return 0;
    })
    .find(t => t.status !== 'completed');

  let currentFocusHTML = "";
  if (activeTask) {
    const focusXP = activeTask.difficulty === 'Hard' ? 50 : activeTask.difficulty === 'Medium' ? 30 : 15;
    currentFocusHTML = `
      <div style="background: var(--bg-tertiary); border: 1.5px solid var(--border-strong); border-radius: 12px; padding: 18px; margin-top: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: #1B6344; text-transform: uppercase;">Current Focus</span>
          <span class="cc-badge badge-cyan">${activeTask.difficulty} · +${focusXP} XP</span>
        </div>
        <h4 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 4px 0;">${activeTask.title}</h4>
        <p style="font-size: 12px; color: var(--text-secondary); margin: 6px 0 14px 0; line-height: 1.4;">
          ${getTaskDescription(activeTask.title)}
        </p>
        <button onclick="if(typeof openTaskDetail === 'function') openTaskDetail('${activeTask.id}'); else window.switchTab('tasks');" class="btn-primary" style="padding: 8px 16px; font-size: 12px; border-radius: 8px;">
          Continue Learning →
        </button>
      </div>
    `;
  } else {
    currentFocusHTML = `
      <div style="background: var(--success-light); border: 1.5px solid var(--success); border-radius: 12px; padding: 18px; margin-top: 20px; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 6px;">🎉</div>
        <h4 style="font-size: 16px; font-weight: 700; color: #1B6344; margin: 4px 0;">Roadmap Fully Mastered!</h4>
        <p style="font-size: 12px; color: var(--text-secondary); margin: 6px 0 0 0; line-height: 1.4;">
          You have completed all skills and are ready to tackle projects or start mock placement interviews.
        </p>
      </div>
    `;
  }

  const activePhaseObjName = activePhaseIndex === 0 ? "Phase 01 — Foundation" : activePhaseIndex === 1 ? "Phase 02 — Core Skills" : activePhaseIndex === 2 ? "Phase 03 — Advanced Skills" : activePhaseIndex === 3 ? "Phase 04 — Real-World Projects" : "Phase 05 — Job Ready";
  const activePhaseObjDesc = activePhaseIndex === 0 ? stagePhaseDescriptions[0] : activePhaseIndex === 1 ? stagePhaseDescriptions[1] : activePhaseIndex === 2 ? stagePhaseDescriptions[2] : activePhaseIndex === 3 ? "Apply your skills by building projects that demonstrate real-world ability." : "Turn your skills and projects into a complete placement-ready profile.";
  const activePhasePctVal = activePhaseIndex === 0 ? phase1Pct : activePhaseIndex === 1 ? phase2Pct : activePhaseIndex === 2 ? phase3Pct : activePhaseIndex === 3 ? projectsPct : jobReadyPct;

  const activePhaseSkillsMasteredCount = activePhaseIndex === 0 ? phase1Completed : activePhaseIndex === 1 ? phase2Completed : activePhaseIndex === 2 ? phase3Completed : activePhaseIndex === 3 ? completedProjects : placementCompletedCount;
  const activePhaseSkillsTotalCount = activePhaseIndex === 0 ? phase1Total : activePhaseIndex === 1 ? phase2Total : activePhaseIndex === 2 ? phase3Total : activePhaseIndex === 3 ? 3 : 5;

  let skillsChipsHTML = "";
  if (activePhaseIndex <= 2) {
    skillsChipsHTML = stageTasks[activePhaseIndex].map(t => `
      <span class="rm-skill-tag ${t.status === 'completed' ? 'mastered' : activeTask && activeTask.id === t.id ? 'active' : ''}">
        ${t.status === 'completed' ? '✓' : '•'} ${t.title}
      </span>
    `).join('');
  } else if (activePhaseIndex === 3) {
    const projNames = ["Mobile Banking App", "E-commerce UX Case Study", "SaaS Dashboard"];
    skillsChipsHTML = projNames.map((n, idx) => `
      <span class="rm-skill-tag ${completedProjects > idx ? 'mastered' : 'active'}">
        ${completedProjects > idx ? '✓' : '•'} ${n}
      </span>
    `).join('');
  } else {
    const jobReadyItems = ["Resume Optimization", "Project Showcase", "Aptitude Tests", "Technical Case Studies", "Live Mock Interview"];
    skillsChipsHTML = jobReadyItems.map((n, idx) => `
      <span class="rm-skill-tag ${placementProgressItems[idx] ? 'mastered' : 'active'}">
        ${placementProgressItems[idx] ? '✓' : '•'} ${n}
      </span>
    `).join('');
  }

  const html = `
    <div class="cc-card cc-hero" style="margin-bottom: 24px;">
      <div>
        <div class="cc-badge badge-purple" style="background: #FFFFFF; color: #9C4119; border: 1px solid rgba(232, 148, 106, 0.4); font-weight: 800; margin-bottom: 8px;">🎯 ACTIVE PATHWAY</div>
        <h2 style="font-size: 26px; font-weight: 800; color: var(--text-primary); margin: 4px 0;">${goalTitle}</h2>
        <div style="font-size: 13px; color: #4A3B30; font-weight: 500; line-height: 1.4; margin-bottom: 16px; max-width: 500px;">
          Personalized roadmap based on: Current skill level • Career goal • Existing skills • Completed tasks • Projects • Learning progress
        </div>
        
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span class="cc-badge badge-amber">Level ${currentLevel}</span>
          <span class="cc-badge badge-purple">${activePhaseNameText}</span>
          <span class="cc-badge badge-cyan">${completedTasksCount} / ${totalTasksCount} Skills Mastered</span>
          <span class="cc-badge badge-rose">${completedProjects} Project${completedProjects !== 1 ? 's' : ''} Completed</span>
        </div>
      </div>
      
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">
          <span>Overall Progress</span>
          <span>${overallPct}% Complete</span>
        </div>
        <div class="cc-progress-container" style="margin-bottom: 20px;">
          <div class="cc-progress-bar" style="width: ${overallPct}%;"></div>
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button onclick="window.switchTab('tasks')" class="btn-primary" style="flex: 1; justify-content: center; padding: 12px; border-radius: 10px;">
            Continue Learning →
          </button>
          <button onclick="openAdjustRoadmapModal()" class="btn-outline" style="flex: 1; justify-content: center; padding: 12px; border-radius: 10px;">
            Adjust Goals
          </button>
        </div>
      </div>
    </div>

    <div class="cc-card" style="margin-bottom: 24px;">
      <div class="cc-badge badge-cyan" style="margin-bottom: 12px;">🗺️ YOUR CAREER JOURNEY</div>
      <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0 0 16px 0;">Journey Milestones</h3>
      
      <div class="rm-timeline-grid">
        <div class="rm-stage-card ${s1.statusClass}">
          <span class="rm-stage-num">01</span>
          <h4 class="rm-stage-title" style="margin: 6px 0;">Foundation</h4>
          <span class="rm-stage-status">${s1.statusText} (${s1.pctText})</span>
        </div>
        <div class="rm-stage-card ${s2.statusClass}">
          <span class="rm-stage-num">02</span>
          <h4 class="rm-stage-title" style="margin: 6px 0;">Core Skills</h4>
          <span class="rm-stage-status">${s2.statusText} (${s2.pctText})</span>
        </div>
        <div class="rm-stage-card ${s3.statusClass}">
          <span class="rm-stage-num">03</span>
          <h4 class="rm-stage-title" style="margin: 6px 0;">Advanced</h4>
          <span class="rm-stage-status">${s3.statusText} (${s3.pctText})</span>
        </div>
        <div class="rm-stage-card ${s4.statusClass}">
          <span class="rm-stage-num">04</span>
          <h4 class="rm-stage-title" style="margin: 6px 0;">Projects</h4>
          <span class="rm-stage-status">${s4.statusText} (${s4.pctText})</span>
        </div>
        <div class="rm-stage-card ${s5.statusClass}">
          <span class="rm-stage-num">05</span>
          <h4 class="rm-stage-title" style="margin: 6px 0;">Job Ready</h4>
          <span class="rm-stage-status">${s5.statusText} (${s5.pctText})</span>
        </div>
      </div>
    </div>

    <div class="cc-card cc-card-highlight" style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
        <div>
          <div class="cc-badge badge-rose" style="margin-bottom: 8px;">🎯 ACTIVE OBJECTIVE</div>
          <h3 style="font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px 0;">${activePhaseObjName}</h3>
          <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0; max-width: 600px;">
            ${activePhaseObjDesc}
          </p>
        </div>
        <div style="text-align: right; min-width: 120px;">
          <div style="font-size: 24px; font-weight: 800; color: var(--pill-green);">${activePhasePctVal}%</div>
          <div style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">${activePhaseSkillsMasteredCount} / ${activePhaseSkillsTotalCount} Mastered</div>
        </div>
      </div>
      
      <div class="cc-progress-container" style="margin-bottom: 20px;">
        <div class="cc-progress-bar" style="width: ${activePhasePctVal}%;"></div>
      </div>
      
      <div style="margin-bottom: 12px;">
        <h4 style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em; margin-top: 0;">
          Skills you will master:
        </h4>
        <div class="rm-skill-grid">
          ${skillsChipsHTML}
        </div>
      </div>
      
      ${currentFocusHTML}
    </div>

    <div>
      <h3 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 28px 0 16px 0; display: flex; align-items: center; gap: 8px;">
        ⚙️ Complete Roadmap Timeline
      </h3>
      
      <div id="rm-accordion-0" class="rm-accordion-item ${activePhaseIndex === 0 ? 'open active' : ''}">
        <div class="rm-accordion-header" onclick="togglePhaseAccordion(0)">
          <div>
            <span class="cc-badge ${isPhase1Done ? 'badge-cyan' : 'badge-purple'}" style="margin-right: 12px;">
              ${isPhase1Done ? '✓ Phase 01' : '🎯 Phase 01'}
            </span>
            <strong style="color: var(--text-primary); font-size: 14px;">Foundation</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 12px; font-weight: 700; color: ${isPhase1Done ? '#1B6344' : 'var(--text-secondary)'};">${phase1Pct}% Complete</span>
            <span style="font-size: 14px; color: var(--text-secondary);">▼</span>
          </div>
        </div>
        <div class="rm-accordion-content">
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0;">
            ${stagePhaseDescriptions[0]}
          </p>
          <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px; margin-top: 0;">Checkpoints:</div>
          <div class="rm-skill-grid">
            ${stageTasks[0].map(t => `
              <span class="rm-skill-tag ${t.status === 'completed' ? 'mastered' : ''}">
                ${t.status === 'completed' ? '✓' : '•'} ${t.title}
              </span>
            `).join('')}
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 20px; border-top: 1px solid var(--border); padding-top: 16px;">
            <button onclick="window.switchTab('tasks')" class="btn-primary" style="padding: 8px 16px; font-size: 12px; border-radius: 8px;">
              Open Workspace ➔
            </button>
          </div>
        </div>
      </div>

      <div id="rm-accordion-1" class="rm-accordion-item ${activePhaseIndex === 1 ? 'open active' : ''}">
        <div class="rm-accordion-header" onclick="togglePhaseAccordion(1)">
          <div>
            <span class="cc-badge ${!isPhase1Done ? 'badge-rose' : isPhase2Done ? 'badge-cyan' : 'badge-purple'}" style="margin-right: 12px;">
              ${!isPhase1Done ? '🔒 Phase 02' : isPhase2Done ? '✓ Phase 02' : '🎯 Phase 02'}
            </span>
            <strong style="color: var(--text-primary); font-size: 14px;">Core Skills</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 12px; font-weight: 700; color: ${isPhase2Done ? '#1B6344' : 'var(--text-secondary)'};">${isPhase1Done ? phase2Pct + '%' : 'Locked'}</span>
            <span style="font-size: 14px; color: var(--text-secondary);">▼</span>
          </div>
        </div>
        <div class="rm-accordion-content">
          ${!isPhase1Done ? `
            <div style="text-align: center; padding: 12px; color: var(--text-secondary); font-size: 13px;">
              Complete Phase 01: Foundation to unlock core roadmap skills.
            </div>
          ` : `
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0;">
              ${stagePhaseDescriptions[1]}
            </p>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px; margin-top: 0;">Checkpoints:</div>
            <div class="rm-skill-grid">
              ${stageTasks[1].map(t => `
                <span class="rm-skill-tag ${t.status === 'completed' ? 'mastered' : ''}">
                  ${t.status === 'completed' ? '✓' : '•'} ${t.title}
                </span>
              `).join('')}
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 20px; border-top: 1px solid var(--border); padding-top: 16px;">
              <button onclick="window.switchTab('tasks')" class="btn-primary" style="padding: 8px 16px; font-size: 12px; border-radius: 8px;">
                Open Workspace ➔
              </button>
            </div>
          `}
        </div>
      </div>

      <div id="rm-accordion-2" class="rm-accordion-item ${activePhaseIndex === 2 ? 'open active' : ''}">
        <div class="rm-accordion-header" onclick="togglePhaseAccordion(2)">
          <div>
            <span class="cc-badge ${!isPhase2Done ? 'badge-rose' : isPhase3Done ? 'badge-cyan' : 'badge-purple'}" style="margin-right: 12px;">
              ${!isPhase2Done ? '🔒 Phase 03' : isPhase3Done ? '✓ Phase 03' : '🎯 Phase 03'}
            </span>
            <strong style="color: var(--text-primary); font-size: 14px;">Advanced Skills</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 12px; font-weight: 700; color: ${isPhase3Done ? '#1B6344' : 'var(--text-secondary)'};">${isPhase2Done ? phase3Pct + '%' : 'Locked'}</span>
            <span style="font-size: 14px; color: var(--text-secondary);">▼</span>
          </div>
        </div>
        <div class="rm-accordion-content">
          ${!isPhase2Done ? `
            <div style="text-align: center; padding: 12px; color: var(--text-secondary); font-size: 13px;">
              Complete Phase 02: Core Skills to unlock advanced specialization topics.
            </div>
          ` : `
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0;">
              ${stagePhaseDescriptions[2]}
            </p>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px; margin-top: 0;">Checkpoints:</div>
            <div class="rm-skill-grid">
              ${stageTasks[2].map(t => `
                <span class="rm-skill-tag ${t.status === 'completed' ? 'mastered' : ''}">
                  ${t.status === 'completed' ? '✓' : '•'} ${t.title}
                </span>
              `).join('')}
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 20px; border-top: 1px solid var(--border); padding-top: 16px;">
              <button onclick="window.switchTab('tasks')" class="btn-primary" style="padding: 8px 16px; font-size: 12px; border-radius: 8px;">
                Open Workspace ➔
              </button>
            </div>
          `}
        </div>
      </div>

      <div id="rm-accordion-3" class="rm-accordion-item ${activePhaseIndex === 3 ? 'open active' : ''}">
        <div class="rm-accordion-header" onclick="togglePhaseAccordion(3)">
          <div>
            <span class="cc-badge ${!isProjectsUnlocked ? 'badge-rose' : isProjectsDone ? 'badge-cyan' : 'badge-purple'}" style="margin-right: 12px;">
              ${!isProjectsUnlocked ? '🔒 Phase 04' : isProjectsDone ? '✓ Phase 04' : '🎯 Phase 04'}
            </span>
            <strong style="color: var(--text-primary); font-size: 14px;">Real-World Projects</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 12px; font-weight: 700; color: ${isProjectsDone ? '#1B6344' : 'var(--text-secondary)'};">${isProjectsUnlocked ? projectsPct + '%' : 'Locked'}</span>
            <span style="font-size: 14px; color: var(--text-secondary);">▼</span>
          </div>
        </div>
        <div class="rm-accordion-content">
          ${!isProjectsUnlocked ? `
            <div style="text-align: center; padding: 12px; color: var(--text-secondary); font-size: 13px;">
              Complete Phase 03: Advanced Skills to unlock real-world project portfolios.
            </div>
          ` : `
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0;">
              Apply your skills by building projects that demonstrate real-world capability.
            </p>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px; margin-top: 0;">Core Capstone Portfolios:</div>
            <div class="rm-skill-grid">
              <span class="rm-skill-tag ${completedProjects >= 1 ? 'mastered' : 'active'}">
                ${completedProjects >= 1 ? '✓' : '•'} Mobile Banking Application
              </span>
              <span class="rm-skill-tag ${completedProjects >= 2 ? 'mastered' : 'active'}">
                ${completedProjects >= 2 ? '✓' : '•'} E-commerce UX Case Study
              </span>
              <span class="rm-skill-tag ${completedProjects >= 3 ? 'mastered' : 'active'}">
                ${completedProjects >= 3 ? '✓' : '•'} SaaS Dashboard Interface
              </span>
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 20px; border-top: 1px solid var(--border); padding-top: 16px;">
              <button onclick="window.switchTab('projects')" class="btn-primary" style="padding: 8px 16px; font-size: 12px; border-radius: 8px;">
                Manage Project Sandbox ➔
              </button>
            </div>
          `}
        </div>
      </div>

      <div id="rm-accordion-4" class="rm-accordion-item ${activePhaseIndex === 4 ? 'open active' : ''}">
        <div class="rm-accordion-header" onclick="togglePhaseAccordion(4)">
          <div>
            <span class="cc-badge ${!isJobReadyUnlocked ? 'badge-rose' : placementCompletedCount === 5 ? 'badge-cyan' : 'badge-purple'}" style="margin-right: 12px;">
              ${!isJobReadyUnlocked ? '🔒 Phase 05' : placementCompletedCount === 5 ? '✓ Phase 05' : '🎯 Phase 05'}
            </span>
            <strong style="color: var(--text-primary); font-size: 14px;">Job Ready</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 12px; font-weight: 700; color: ${placementCompletedCount === 5 ? '#1B6344' : 'var(--text-secondary)'};">${isJobReadyUnlocked ? jobReadyPct + '%' : 'Locked'}</span>
            <span style="font-size: 14px; color: var(--text-secondary);">▼</span>
          </div>
        </div>
        <div class="rm-accordion-content">
          ${!isJobReadyUnlocked ? `
            <div style="text-align: center; padding: 12px; color: var(--text-secondary); font-size: 13px;">
              Complete Phase 04: Real-World Projects to unlock mock placement and profile screening.
            </div>
          ` : `
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0;">
              Turn your skills and projects into a complete placement-ready profile.
            </p>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px; margin-top: 0;">Checklist:</div>
            <div class="rm-skill-grid">
              <span class="rm-skill-tag ${placementProgressItems[0] ? 'mastered' : 'active'}">
                ${placementProgressItems[0] ? '✓' : '•'} Resume Optimization
              </span>
              <span class="rm-skill-tag ${placementProgressItems[1] ? 'mastered' : 'active'}">
                ${placementProgressItems[1] ? '✓' : '•'} Project Showcase
              </span>
              <span class="rm-skill-tag ${placementProgressItems[2] ? 'mastered' : 'active'}">
                ${placementProgressItems[2] ? '✓' : '•'} Interview Preparation
              </span>
              <span class="rm-skill-tag ${placementProgressItems[3] ? 'mastered' : 'active'}">
                ${placementProgressItems[3] ? '✓' : '•'} Case Study Presentation
              </span>
              <span class="rm-skill-tag ${placementProgressItems[4] ? 'mastered' : 'active'}">
                ${placementProgressItems[4] ? '✓' : '•'} Mock Interview
              </span>
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 20px; border-top: 1px solid var(--border); padding-top: 16px;">
              <button onclick="window.switchTab('placement')" class="btn-primary" style="padding: 8px 16px; font-size: 12px; border-radius: 8px;">
                Enter Placement Board ➔
              </button>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  if (display) {
    display.innerHTML = html;
    display.style.display = 'block';
  }
}

function togglePhaseAccordion(idx) {
  const item = document.getElementById(`rm-accordion-${idx}`);
  if (!item) return;
  const isOpen = item.classList.contains('open');
  if (isOpen) {
    item.classList.remove('open');
  } else {
    document.querySelectorAll('.rm-accordion-item').forEach(el => el.classList.remove('open'));
    item.classList.add('open');
  }
}

function openAdjustRoadmapModal() {
  const modal = document.getElementById('adjust-roadmap-modal');
  if (modal) modal.style.display = 'flex';
}

function closeAdjustRoadmapModal() {
  const modal = document.getElementById('adjust-roadmap-modal');
  if (modal) modal.style.display = 'none';
}

async function submitRoadmapAdjustment() {
  closeAdjustRoadmapModal();
  const status = document.getElementById('roadmap-gen-status');
  const display = document.getElementById('full-roadmap-display');
  if (status) status.style.display = 'block';
  if (display) display.style.display = 'none';

  const checkboxes = document.querySelectorAll('input[name="adjust-opt"]:checked');
  const options = Array.from(checkboxes).map(cb => cb.parentNode.textContent.trim().replace(/\s+/g, ' '));
  
  if (options.length === 0) {
    if (typeof showToast === 'function') showToast("Please select at least one option to adapt your roadmap", "warning");
    if (status) status.style.display = 'none';
    if (display) display.style.display = 'block';
    return;
  }

  try {
    const { data: profile } = await supabase.from('profiles').select('goal, roadmap_data').eq('id', window.currentUserId).single();
    const goal = profile?.goal || "Frontend Developer";
    const oldRoadmap = profile?.roadmap_data;

    const prompt = `You are an expert career coach modifying an existing study roadmap.
Goal: "${goal}"
Selected adjustments requested by the student:
${options.map(opt => `- ${opt}`).join('\n')}

Here is the current roadmap data:
${JSON.stringify(oldRoadmap, null, 2)}

Please revise the tasks, checkpoints, and descriptions in this roadmap to reflect the student's settings. 
Maintain the JSON format precisely, including:
- "title" (roadmap title)
- "phases" (array of 4 objects)
  - Each phase has: "phase", "description", and "tasks" (array of 4 specific learning tasks).
  - Each task has: "title", "difficulty" (Easy/Medium/Hard), "status" (default to "pending").

Return ONLY the valid JSON object. Do not include markdown code block markers or introductory/closing text.`;

    const result = await callAI(prompt, 2000);
    const jsonMatch = result?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response from AI");
    }
    const newRoadmap = JSON.parse(jsonMatch[0]);

    await supabase.from('profiles').update({ roadmap_data: newRoadmap }).eq('id', window.currentUserId);
    if (typeof saveTasksFromRoadmap === 'function') {
      await saveTasksFromRoadmap(newRoadmap, window.currentUserId);
    }

    if (typeof showToast === 'function') showToast("✨ Roadmap adapted successfully!", "success");
    if (typeof loadRoadmapTab === 'function') await loadRoadmapTab();
  } catch (err) {
    console.error("Adjustment Error:", err);
    if (typeof showToast === 'function') showToast("Failed to adapt roadmap. Please try again.", "error");
    if (status) status.style.display = 'none';
    if (display) display.style.display = 'block';
  }
}

async function completeRoadmapTask(pIdx, tIdx) {
  const { data: profile } = await supabase.from('profiles').select('roadmap_data').eq('id', window.currentUserId).single();
  const roadmap = profile?.roadmap_data;
  if (!roadmap || !roadmap.phases || !roadmap.phases[pIdx] || !roadmap.phases[pIdx].tasks[tIdx]) return;

  const task = roadmap.phases[pIdx].tasks[tIdx];
  task.status = task.status === 'completed' ? 'pending' : 'completed';

  await supabase.from('profiles').update({ roadmap_data: roadmap }).eq('id', window.currentUserId);
  renderFullRoadmap(roadmap);
  loadShortRoadmap(roadmap);

  if (task.status === 'completed') {
    if (typeof showToast === 'function') showToast("Checkpoint reached! +25 XP");
  }
}

function downloadRoadmapPDF() {
  window.print();
}

// Attach all functions to window
window.initDashboard = initDashboard;
window.toggleNotifications = toggleNotifications;
window.loadNotifications = loadNotifications;
window.clearNotifications = clearNotifications;
window.requestNotificationPermission = requestNotificationPermission;
window.addNotification = addNotification;
window.toggleTheme = toggleTheme;
window.initTheme = initTheme;
window.loadXPDisplay = loadXPDisplay;
window.showXPDetails = showXPDetails;
window.startNewSession = startNewSession;
window.loadTodaysFocus = loadTodaysFocus;
window.getTaskDescription = getTaskDescription;
window.completeFocusTask = completeFocusTask;
window.buildActivityHeatmap = buildActivityHeatmap;
window.loadShortRoadmap = loadShortRoadmap;
window.getCareerTrackFromGoal = getCareerTrackFromGoal;
window.confirmCareerTrackSwitch = confirmCareerTrackSwitch;
window.closeSwitchTrackModal = closeSwitchTrackModal;
window.executeCareerTrackSwitch = executeCareerTrackSwitch;
window.generateNewRoadmap = generateNewRoadmap;
window.renderFullRoadmap = renderFullRoadmap;
window.togglePhaseAccordion = togglePhaseAccordion;
window.openAdjustRoadmapModal = openAdjustRoadmapModal;
window.closeAdjustRoadmapModal = closeAdjustRoadmapModal;
window.submitRoadmapAdjustment = submitRoadmapAdjustment;
window.completeRoadmapTask = completeRoadmapTask;
window.downloadRoadmapPDF = downloadRoadmapPDF;

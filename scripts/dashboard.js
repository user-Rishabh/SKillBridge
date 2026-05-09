/**
 * SkillBridge Dashboard — Full Logic
 */

const SUPABASE_URL = 'https://jmogxwejdrkqsrmpxxya.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptb2d4d2VqZHJrcXNybXB4eHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTczMDQsImV4cCI6MjA5MjA3MzMwNH0.0W-zyGlPlJsYOJjNfMCPIATFMfli2jwQ-vi79YXUngs';
const OPENROUTER_KEY = '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';
const YOUTUBE_API_KEY = 'AIzaSyDE3b7vCrg4HMwQLtjCcbmGMLp6-vZ4Lao';

let supabase;
let currentUserId;
let currentUserName;

// Onboarding State
let currentStep = 0;
let onboardingData = {
    name: '',
    goal: '',
    currentLevel: '',
    skills: '',
    timeline: '',
    learningStyle: '',
    educationLevel: ''
};

const conversation = [
    { 
        key: 'goal', 
        question: (d) => `Nice to meet you, ${d.name}! What is your target career role? (e.g. Frontend Developer, Data Scientist)`, 
        quickReplies: ['Frontend Developer', 'Backend Developer', 'Data Scientist', 'UI/UX Designer'] 
    },
    { 
        key: 'currentLevel', 
        question: () => `What is your current skill level in this field?`, 
        quickReplies: ['Beginner', 'Intermediate', 'Advanced'] 
    },
    { 
        key: 'skills', 
        question: () => `What existing skills do you already have? (e.g. HTML, Python, None)`, 
        quickReplies: ['HTML/CSS', 'JavaScript', 'Python', 'None'] 
    },
    { 
        key: 'timeline', 
        question: () => `How many hours can you commit to learning every day?`, 
        quickReplies: ['1-2 Hours', '3-4 Hours', '5+ Hours'] 
    },
    { 
        key: 'learningStyle', 
        question: () => `What is your preferred learning style?`, 
        quickReplies: ['Video tutorials', 'Reading docs', 'Hands-on projects', 'Mixed'] 
    },
    { 
        key: 'educationLevel', 
        question: () => `What is your current education level?`, 
        quickReplies: ['School (10th/12th)', 'College 1st/2nd year', 'College 3rd/4th year', 'Graduate'] 
    }
];

console.log('🚀 SkillBridge Dashboard JS Loading...');

initTheme();
initInteractions();
initTabs();
initSupabase();
checkOnboarding();

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

// ── Onboarding Check ─────────────────────────────────────────
async function checkOnboarding() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    window.location.href = 'auth.html';
    return;
  }

  currentUserId = session.user.id;

  const { data: profile, error } = await supabase
      .from('profiles')
      .select('onboarding_completed, full_name, goal, roadmap_data, xp, level')
      .eq('id', session.user.id)
      .single();

  console.log('Profile check:', profile);

  if (profile?.onboarding_completed === true) {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.style.display = 'none';
    loadDashboard(profile);
  } else {
    showOnboarding(profile);
  }
}

function showOnboarding(profile) {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.style.opacity = '0';
        requestAnimationFrame(() => {
            overlay.style.transition = 'opacity 400ms ease';
            overlay.style.opacity = '1';
        });
    }
  
    onboardingData.name = profile?.full_name?.split(' ')[0] || 'there';
    currentUserName = onboardingData.name;
  
    addMessage('Hey ' + onboardingData.name + '! 👋 Welcome to SkillBridge AI.<br><br>I\'ll build your personalized career roadmap in just 2 minutes.<br><br>Ready? Let\'s go! 🚀');
  
    setTimeout(() => {
        addMessage(conversation[0].question(onboardingData));
        showQuickReplies(conversation[0].quickReplies);
    }, 800);
}

function addMessage(text, isUser = false) {
    const chat = document.getElementById('chat-messages');
    if (!chat) return;
    const d = document.createElement('div');
    d.style.cssText = `padding: 12px 16px; border-radius: 16px; max-width: 85%; font-size: 14px; line-height: 1.5; margin-bottom: 8px; align-self: ${isUser ? 'flex-end' : 'flex-start'}; background: ${isUser ? '#059669' : 'rgba(255,255,255,0.06)'}; color: ${isUser ? 'white' : '#E2E8F0'}; ${isUser ? '' : 'border: 1px solid rgba(255,255,255,0.1);'} animation: fadeUp 300ms ease-out both;`;
    d.innerHTML = text;
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
}

function showQuickReplies(replies) {
    const area = document.getElementById('quick-replies');
    if (!area) return;
    area.innerHTML = '';
    replies.forEach((reply, i) => {
        const btn = document.createElement('button');
        btn.textContent = reply;
        btn.style.cssText = `background: rgba(5,150,105,0.08); border: 1px solid rgba(5,150,105,0.25); color: #34D399; padding: 7px 14px; border-radius: 20px; font-size: 12px; cursor: pointer; transition: all 200ms; animation: fadeUp 300ms ease-out; animation-delay: ${i * 60}ms; animation-fill-mode: both; white-space: nowrap;`;
        btn.onmouseover = () => { btn.style.background = 'rgba(5,150,105,0.2)'; btn.style.borderColor = 'rgba(5,150,105,0.5)'; btn.style.transform = 'scale(1.03)'; };
        btn.onmouseout = () => { btn.style.background = 'rgba(5,150,105,0.08)'; btn.style.borderColor = 'rgba(5,150,105,0.25)'; btn.style.transform = 'scale(1)'; };
        btn.onclick = () => { document.getElementById('chat-input').value = reply; sendChatAnswer(); };
        area.appendChild(btn);
    });
}

function updateOnboardingProgress() {
    const pct = Math.round((currentStep / conversation.length) * 100);
    const bar = document.getElementById('onboarding-progress');
    if (bar) bar.style.width = pct + '%';
    const indicator = document.getElementById('step-indicator');
    if (indicator) indicator.textContent = `Step ${Math.min(currentStep + 1, conversation.length)} of ${conversation.length}`;
}

async function sendChatAnswer() {
    const input = document.getElementById('chat-input');
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    addMessage(val, true);
    onboardingData[conversation[currentStep].key] = val;
    currentStep++;
    updateOnboardingProgress();
    const area = document.getElementById('quick-replies');
    if (area) area.innerHTML = '';
    if (currentStep < conversation.length) {
        setTimeout(() => {
            const nextQ = conversation[currentStep];
            addMessage(nextQ.question(onboardingData));
            showQuickReplies(nextQ.quickReplies);
        }, 600);
    } else {
        await finishOnboarding();
    }
}

async function finishOnboarding() {
    await supabase.from('profiles').update({
        goal: onboardingData.goal,
        current_level: onboardingData.currentLevel,
        skills: onboardingData.skills,
        timeline: onboardingData.timeline,
        learning_style: onboardingData.learningStyle,
        education_level: onboardingData.educationLevel,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
    }).eq('id', currentUserId);

    await generateRoadmapWithAI();
}

// ── FIX 5: ROADMAP GENERATION DEBUG ──────────────────────────
async function generateRoadmapWithAI() {
  console.log('Starting roadmap generation...');
  console.log('Goal:', onboardingData.goal);
  console.log('Level:', onboardingData.currentLevel);
  
  hideTyping();
  addMessage('🧠 Perfect! I have everything I need.<br><br>Building your personalized roadmap...<br>⏳ This takes about 15 seconds');
  showTyping();

  const inputArea = document.getElementById('chat-input-area');
  if (inputArea) inputArea.style.display = 'none';

  const prompt = `You are a career expert.
Create a strictly sequential learning roadmap for an Indian student.
Goal: ${onboardingData.goal || 'Software Developer'}
Level: ${onboardingData.currentLevel || 'Beginner'}
Skills: ${onboardingData.skills || 'None'}
Time: ${onboardingData.timeline || '1 hour/day'}

Return ONLY this exact JSON structure:
{"title":"${onboardingData.goal} Roadmap","totalWeeks":16,"jobReadinessTarget":"4 months","phases":[{"phase":"Phase 1 Name","weeks":"Week 1-4","skills":["skill1","skill2","skill3"],"project":"project idea","status":"current","tasks":[{"title":"Task Title","difficulty":"Easy","resource":"URL"}]}]}

CRITICAL RULES:
1. Tasks must be in logical order (basics first).
2. Each phase must contain exactly 3-4 tasks.
3. Tasks must be highly relevant to ${onboardingData.goal}.
Return ONLY the JSON. No explanation.`;

  try {
    console.log('Calling OpenRouter API...');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'SkillBridge'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.3
        })
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('API Error:', errData);
      throw new Error('API failed: ' + response.status);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const roadmap = JSON.parse(jsonMatch[0]);
    hideTyping();
    await saveAndShowRoadmap(roadmap);

  } catch (error) {
    console.error('Roadmap error:', error);
    hideTyping();
    const fallback = getSmartFallback(onboardingData.goal || 'Software Developer');
    await saveAndShowRoadmap(fallback);
  }
}

async function saveAndShowRoadmap(roadmap) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase.from('profiles').update({
      goal: onboardingData.goal,
      current_level: onboardingData.currentLevel,
      timeline: onboardingData.timeline,
      roadmap_data: roadmap,
      onboarding_completed: true
  }).eq('id', session.user.id);

  if (error) console.error('Save error:', error);

  // Save tasks from roadmap phases
  await saveTasksFromRoadmap(roadmap, session.user.id);

  // Save Projects
  if (roadmap.phases) {
    const projects = roadmap.phases.map(p => ({
        user_id: session.user.id,
        name: p.project || 'Phase Project',
        description: `Final project for ${p.phase}`,
        status: 'Upcoming',
        progress: 0,
        roadmap_phase: p.phase || p.name,
        tags: p.skills
    }));
    await supabase.from('projects').delete().eq('user_id', session.user.id);
    await supabase.from('projects').insert(projects);
  }

  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 500ms';
    setTimeout(() => { overlay.style.display = 'none'; window.location.reload(); }, 500);
  }
}

async function saveTasksFromRoadmap(roadmap, userId) {
  if (!roadmap?.phases) return;
  const tasks = [];
  roadmap.phases.forEach(phase => {
    (phase.tasks || []).forEach(task => {
      tasks.push({
        user_id: userId,
        title: task.title,
        difficulty: task.difficulty || 'Medium',
        resource_link: task.resource || '',
        roadmap_phase: phase.phase || phase.name,
        status: phase.status === 'current' ? 'pending' : 'locked'
      });
    });
  });
  if (tasks.length > 0) {
    await supabase.from('tasks').delete().eq('user_id', userId);
    await supabase.from('tasks').insert(tasks);
    console.log('Tasks saved:', tasks.length);
  }
}

// ── TASK SYSTEM: TIMELINE & QUIZ ONLY ──────────────────────
async function loadTasks() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const [tasksRes, profileRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', session.user.id),
    supabase.from('profiles').select('roadmap_data').eq('id', session.user.id).single()
  ]);

  let tasks = tasksRes.data || [];
  const roadmap = profileRes.data?.roadmap_data;

  if (tasks.length === 0 && roadmap) {
    await saveTasksFromRoadmap(roadmap, session.user.id);
    const { data: retryTasks } = await supabase.from('tasks').select('*').eq('user_id', session.user.id);
    tasks = retryTasks || [];
  }

  // Sort tasks by roadmap sequence
  if (roadmap?.phases) {
    const taskOrder = [];
    roadmap.phases.forEach(p => (p.tasks || []).forEach(t => taskOrder.push(t.title)));
    tasks.sort((a, b) => taskOrder.indexOf(a.title) - taskOrder.indexOf(b.title));
  }

  renderTasks(tasks);
}

function renderTasks(tasks) {
  const container = document.getElementById('tasks-container') || document.querySelector('[data-section="tasks"]');
  if (!container) return;

  const pending = tasks.filter(t => t.status !== 'completed');
  const completed = tasks.filter(t => t.status === 'completed');

  container.innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:24px;padding-bottom:12px;border-bottom:1px solid var(--color-border);">
      <button onclick="filterTasks('all')" id="filter-all" style="padding:8px 18px;border-radius:12px;font-size:13px;font-weight:600;border:1px solid #059669;background:#059669;color:white;cursor:pointer;transition:all 200ms;">Mastery Path (${tasks.length})</button>
      <button onclick="filterTasks('pending')" id="filter-pending" style="padding:8px 18px;border-radius:12px;font-size:13px;font-weight:600;border:1px solid var(--color-border);background:transparent;cursor:pointer;transition:all 200ms;">Next Steps (${pending.length})</button>
      <button onclick="filterTasks('completed')" id="filter-completed" style="padding:8px 18px;border-radius:12px;font-size:13px;font-weight:600;border:1px solid var(--color-border);background:transparent;cursor:pointer;transition:all 200ms;">Completed (${completed.length})</button>
    </div>
    <div id="tasks-list" style="position:relative; padding-left:20px;"></div>
  `;

  window.allTasks = tasks;
  filterTasks('all');
}

function filterTasks(filter) {
  const tasks = window.allTasks || [];
  const list = document.getElementById('tasks-list');
  if (!list) return;

  ['all','pending','completed'].forEach(f => {
    const btn = document.getElementById('filter-' + f);
    if (!btn) return;
    if (f === filter) {
      btn.style.background = '#059669'; btn.style.color = 'white'; btn.style.borderColor = '#059669';
    } else {
      btn.style.background = 'transparent'; btn.style.color = 'inherit'; btn.style.borderColor = 'var(--color-border)';
    }
  });

  const isCompletedView = filter === 'completed';
  const isPendingView = filter === 'pending';

  list.innerHTML = `<div style="position:absolute;left:29px;top:0;bottom:0;width:2px;background:linear-gradient(to bottom, #059669 0%, #E2E8F0 100%);z-index:0;"></div>`;

  let previousCompleted = true;
  tasks.forEach((task) => {
    const isDone = task.status === 'completed';
    const isVisible = filter === 'all' || (isCompletedView ? isDone : !isDone);
    
    if (isVisible) {
      list.innerHTML += renderTaskCard(task, previousCompleted);
    }
    if (!isDone) previousCompleted = false;
  });

  if (list.children.length <= 1) {
    list.innerHTML = `<div style="text-align:center;padding:60px;color:#94A3B8;">${isCompletedView ? '🎯 No mastered skills yet — complete your first quiz!' : '✅ Roadmap fully mastered! You are job ready!'}</div>`;
  }
}

function renderTaskCard(task, isUnlocked = true) {
  const isDone = task.status === 'completed';
  const isLocked = !isUnlocked && !isDone;
  const isActive = isUnlocked && !isDone;
  const diffColor = { 'Easy': '#10B981', 'Medium': '#F59E0B', 'Hard': '#EF4444' }[task.difficulty] || '#94A3B8';

  return `
    <div id="task-card-${task.id}" 
      style="
        position:relative;
        background:${isDone ? '#F0FDF4' : isActive ? 'white' : '#F8FAFC'};
        border:1px solid ${isActive ? '#059669' : isDone ? 'rgba(5,150,105,0.2)' : '#E2E8F0'};
        border-radius:16px;
        padding:20px;
        padding-left:50px;
        margin-bottom:20px;
        transition:all 300ms cubic-bezier(0.4, 0, 0.2, 1);
        cursor:${isLocked ? 'not-allowed' : 'pointer'};
        z-index:1;
        ${isActive ? 'box-shadow: 0 10px 25px -5px rgba(5, 150, 105, 0.1), 0 8px 10px -6px rgba(5, 150, 105, 0.1);' : ''}
      " 
      onclick="${isLocked ? '' : `openTaskDetail('${task.id}')`}"
      onmouseover="${isLocked ? '' : `this.style.transform='translateX(8px)'; if(!${isDone}) this.style.borderColor='#059669';`}"
      onmouseout="this.style.transform='translateX(0)'; this.style.borderColor='${isActive ? '#059669' : isDone ? 'rgba(5,150,105,0.2)' : '#E2E8F0'}';"
    >
      <div style="position:absolute;left:-1px;top:28px;width:20px;height:20px;border-radius:50%;background:${isDone ? '#059669' : isActive ? '#059669' : '#CBD5E1'};border:4px solid white;box-shadow: 0 0 0 4px ${isDone || isActive ? 'rgba(5,150,105,0.1)' : 'transparent'};z-index:2;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:15px;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <span style="font-weight:600;font-size:15px;color:${isLocked ? '#94A3B8' : '#1E293B'};">${task.title}</span>
            ${isDone ? '<span style="background:#DCFCE7;color:#166534;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700;">MASTERED ✓</span>' : ''}
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <span style="font-size:11px;padding:3px 10px;border-radius:8px;background:${isLocked ? '#E2E8F0' : diffColor + '15'};color:${isLocked ? '#64748B' : diffColor};font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${task.difficulty}</span>
            <span style="font-size:12px;color:#64748B;">•</span>
            <span style="font-size:12px;color:#64748B;font-weight:500;">${task.roadmap_phase}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          ${isActive ? `<button onclick="event.stopPropagation();startQuiz('${task.id}','${task.title.replace(/'/g,"\\'")}','${task.roadmap_phase || ''}')" style="background:#059669;color:white;border:none;padding:8px 16px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 200ms;" onmouseover="this.style.background='#047857';this.style.transform='scale(1.05)'" onmouseout="this.style.background='#059669';this.style.transform='scale(1)'"><span>🎯</span> Take Quiz</button>` : isLocked ? `<div style="display:flex;align-items:center;gap:6px;color:#94A3B8;font-size:12px;font-weight:500;"><span>🔒</span> Locked</div>` : `<div style="color:#059669;font-size:20px;">★</div>`}
        </div>
      </div>
    </div>
  `;
}

// ── DEPRECATED: MANUAL ACTIONS REMOVED ──────────────────────
async function undoTask(taskId) { 
  console.log('Manual undo disabled. Quiz Mastery required.'); 
}

async function recalculateStats(userId) {
    const { data: tasks } = await supabase.from('tasks').select('status').eq('user_id', userId);
    const completed = tasks?.filter(t => t.status === 'completed').length || 0;
    const total = tasks?.length || 1;
    const progress = Math.round((completed / total) * 100);
    await supabase.from('profiles').update({ progress_percent: progress, skills_learned: completed }).eq('id', userId);
    loadDashboardStats();
}

// ── FIX 3: AI QUIZ + XP SYSTEM ──────────────────────────────
function openTaskDetail(taskId) {
  const task = window.allTasks?.find(t => t.id === taskId);
  if (!task) return;
  
  const modal = document.createElement('div');
  modal.id = 'task-detail-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;`;
  
  const diffColor = { 'Easy':'#10B981', 'Medium':'#F59E0B', 'Hard':'#EF4444' }[task.difficulty] || '#94A3B8';

  modal.innerHTML = `
    <div style="
      background:white;
      border-radius:24px;
      padding:32px;
      max-width:520px;width:100%;
      box-shadow:0 24px 60px rgba(0,0,0,0.2);
    ">
      <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
        <div>
          <span style="font-size:11px;padding:4px 12px;border-radius:12px;background:${diffColor}15;color:${diffColor};font-weight:700;text-transform:uppercase;">
            ${task.difficulty}
          </span>
          <h3 style="margin-top:12px;font-size:22px;font-weight:700;color:#0F172A;line-height:1.3;">
            ${task.title}
          </h3>
        </div>
        <button onclick="document.getElementById('task-detail-modal').remove()" 
          style="background:#F1F5F9;border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748B;transition:all 200ms;"
          onmouseover="this.style.background='#E2E8F0';this.style.color='#0F172A'"
        >✕</button>
      </div>

      <div style="font-size:14px;color:#64748B;margin-bottom:24px;display:flex;align-items:center;gap:8px;">
        <span style="background:#F1F5F9;padding:4px 10px;border-radius:8px;">📍 ${task.roadmap_phase}</span>
      </div>

      ${task.resource_link ? `
        <div style="margin-bottom:24px;">
          <div style="font-size:12px;font-weight:700;color:#94A3B8;text-transform:uppercase;margin-bottom:10px;">Learning Material</div>
          <a href="${task.resource_link}" target="_blank" 
            style="display:flex;align-items:center;gap:12px;padding:16px;background:#F8FAFC;color:#059669;border-radius:16px;text-decoration:none;border:1px solid #E2E8F0;transition:all 200ms;"
            onmouseover="this.style.borderColor='#059669';this.style.background='#F0FDF4'"
            onmouseout="this.style.borderColor='#E2E8F0';this.style.background='#F8FAFC'"
          >
            <span style="font-size:20px;">📚</span>
            <div>
              <div style="font-weight:600;font-size:14px;">Study Resource</div>
              <div style="font-size:12px;color:#64748B;">Open documentation or tutorial</div>
            </div>
            <span style="margin-left:auto;">→</span>
          </a>
        </div>
      ` : ''}

      <div style="background:linear-gradient(135deg,#ECFDF5,#D1FAE5);border-radius:16px;padding:20px;margin-bottom:28px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:14px;font-weight:700;color:#065F46;">Skill Assessment</div>
            <div style="font-size:12px;color:#047857;margin-top:2px;">Must score 80% to unlock next step</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:800;color:#059669;">+${task.difficulty==='Hard'?50:task.difficulty==='Medium'?30:15} XP</div>
          </div>
        </div>
      </div>

      <button onclick="document.getElementById('task-detail-modal').remove();startQuiz('${task.id}','${task.title.replace(/'/g,"\\'")}','${task.roadmap_phase||''}')" 
        style="width:100%;background:#059669;color:white;border:none;padding:16px;border-radius:16px;font-size:15px;font-weight:700;cursor:pointer;transition:all 200ms;box-shadow: 0 4px 12px rgba(5,150,105,0.25);"
        onmouseover="this.style.background='#047857';this.style.transform='translateY(-2px)'"
        onmouseout="this.style.background='#059669';this.style.transform='translateY(0)'"
      >🎯 Begin Assessment</button>
    </div>
  `;
  document.body.appendChild(modal);
}

async function startQuiz(taskId, taskTitle, phase) {
  showQuizLoading();
  const prompt = `Create a quiz for a student learning: Topic: "${taskTitle}" Phase: "${phase}" Generate exactly 5 multiple choice questions. Return ONLY valid JSON: { "questions": [ { "q": "question text", "options": ["A","B","C","D"], "answer": 0, "explanation": "why this is correct" } ] } answer is 0-indexed. Make questions practical and relevant to Indian job interviews.`;
  const result = await callAI(prompt, 600);
  let quiz;
  try { const match = result?.match(/\{[\s\S]*\}/); quiz = JSON.parse(match?.[0] || '{}'); } catch(e) { quiz = getFallbackQuiz(taskTitle); }
  if (!quiz.questions?.length) quiz = getFallbackQuiz(taskTitle);
  showQuizModal(taskId, taskTitle, quiz);
}

function getFallbackQuiz(topic) {
  return { questions: [ { q: `What is the primary purpose of ${topic}?`, options: ["To improve code readability", "To solve specific technical problems", "To increase application speed", "All of the above"], answer: 3, explanation: "All these are valid goals!" }, { q: `Which is a best practice in ${topic}?`, options: ["Write clean, documented code", "Avoid using version control", "Skip testing", "Hardcode all values"], answer: 0, explanation: "Clean code is always best practice" }, { q: `${topic} is commonly used in:`, options: ["Frontend development", "Backend development", "Full stack development", "All of the above"], answer: 3, explanation: "Modern dev uses all paradigms" }, { q: `What should you do after learning ${topic}?`, options: ["Build a project to practice", "Just read more theory", "Skip to next topic", "Memorize syntax only"], answer: 0, explanation: "Hands-on practice is key!" }, { q: `How do you verify your ${topic} skills?`, options: ["Build real projects", "Take interviews", "Contribute to open source", "All of the above"], answer: 3, explanation: "All help verify skills!" } ] };
}

function showQuizLoading() {
  document.getElementById('quiz-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'quiz-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);z-index:10000;display:flex;align-items:center;justify-content:center;`;
  modal.innerHTML = `<div style="text-align:center;color:white;"><div style="font-size:40px;margin-bottom:16px;">🤖</div><div style="font-size:16px;font-weight:500;">Generating your quiz...</div><div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:8px;">AI is creating personalized questions</div></div>`;
  document.body.appendChild(modal);
}

function showQuizModal(taskId, title, quiz) {
  document.getElementById('quiz-modal')?.remove();
  let currentQ = 0; let score = 0; let answers = [];
  const modal = document.createElement('div');
  modal.id = 'quiz-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(10px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;`;

  function renderQuestion() {
    const q = quiz.questions[currentQ];
    const progress = ((currentQ) / quiz.questions.length) * 100;
    modal.innerHTML = `<div style="background:white;border-radius:20px;padding:28px;max-width:540px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.3);"><div style="margin-bottom:20px;"><div style="display:flex;justify-content:space-between;font-size:12px;color:#64748B;margin-bottom:6px;"><span>Question ${currentQ+1} of ${quiz.questions.length}</span><span>Score: ${score}/${currentQ}</span></div><div style="height:4px;background:#F1F5F9;border-radius:2px;"><div style="height:100%;width:${progress}%;background:#059669;border-radius:2px;transition:width 300ms;"></div></div></div><div style="font-size:16px;font-weight:500;line-height:1.5;margin-bottom:20px;color:#0F172A;">${q.q}</div><div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">${q.options.map((opt, i) => `<button onclick="selectAnswer(${i}, ${q.answer}, '${q.explanation.replace(/'/g,"\\'")}', this)" style="text-align:left;padding:12px 16px;border-radius:10px;border:1.5px solid #E2E8F0;background:white;cursor:pointer;font-size:14px;transition:all 150ms;display:flex;align-items:center;gap:10px;" onmouseover="if(!this.disabled)this.style.borderColor='#059669';if(!this.disabled)this.style.background='#F0FDF4'" onmouseout="if(!this.disabled)this.style.borderColor='#E2E8F0';if(!this.disabled)this.style.background='white'"><span style="width:28px;height:28px;border-radius:50%;background:#F1F5F9;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;">${['A','B','C','D'][i]}</span>${opt}</button>`).join('')}</div><div id="explanation-area"></div></div>`;
  }

  window.selectAnswer = function(selected, correct, explanation, btn) {
    modal.querySelectorAll('button[onclick*="selectAnswer"]').forEach(b => b.disabled = true);
    const isCorrect = selected === correct; if (isCorrect) score++;
    answers.push({ selected, correct });
    modal.querySelectorAll('button[onclick*="selectAnswer"]').forEach((b, i) => { if (i === correct) { b.style.background = '#F0FDF4'; b.style.borderColor = '#059669'; b.style.color = '#059669'; } else if (i === selected && !isCorrect) { b.style.background = '#FEF2F2'; b.style.borderColor = '#EF4444'; b.style.color = '#EF4444'; } });
    const exp = document.getElementById('explanation-area');
    if (exp) { exp.innerHTML = `<div style="padding:12px;border-radius:10px;background:${isCorrect ? '#F0FDF4' : '#FEF2F2'};border:1px solid ${isCorrect ? '#A7F3D0' : '#FECACA'};font-size:13px;color:${isCorrect ? '#065F46' : '#991B1B'};margin-bottom:16px;">${isCorrect ? '✓ Correct! ' : '✗ Wrong. '}${explanation}</div><button onclick="nextQuestion()" style="width:100%;background:#059669;color:white;border:none;padding:12px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;">${currentQ + 1 < quiz.questions.length ? 'Next Question →' : 'See Results 🏆'}</button>`; }
  };
  window.nextQuestion = function() { currentQ++; if (currentQ < quiz.questions.length) { renderQuestion(); } else { showQuizResults(taskId, score, quiz.questions.length); } };
  renderQuestion();
  document.body.appendChild(modal);
}

async function showQuizResults(taskId, score, total) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const pct = Math.round((score/total)*100);
  const baseXP = 15;
  let xpEarned = baseXP;
  if (pct === 100) xpEarned = baseXP * 3; else if (pct >= 80) xpEarned = baseXP * 2; else if (pct >= 60) xpEarned = Math.round(baseXP * 1.5);
  await supabase.from('quiz_attempts').insert({ user_id: session.user.id, task_id: taskId, score, total, xp_earned: xpEarned });
  const { data: profile } = await supabase.from('profiles').select('xp, level').eq('id', session.user.id).single();
  const newXP = (profile?.xp || 0) + xpEarned; const newLevel = Math.floor(newXP / 100) + 1;
  await supabase.from('profiles').update({ xp: newXP, level: newLevel }).eq('id', session.user.id);
  if (pct >= 80) await completeTask(taskId, false);
  const modal = document.getElementById('quiz-modal'); if (!modal) return;
  const levelUp = newLevel > (profile?.level || 1);
  modal.innerHTML = `<div style="background:white;border-radius:20px;padding:32px;max-width:420px;width:100%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.3);"><div style="width:100px;height:100px;border-radius:50%;background:${pct>=80 ? 'linear-gradient(135deg,#059669,#34D399)' : pct>=60 ? 'linear-gradient(135deg,#F59E0B,#FCD34D)' : 'linear-gradient(135deg,#EF4444,#FCA5A5)'};display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 8px 24px rgba(5,150,105,0.3);"><div style="font-size:28px;font-weight:700;color:white;">${pct}%</div><div style="font-size:11px;color:rgba(255,255,255,0.8);">${score}/${total}</div></div><h3 style="font-size:20px;margin-bottom:6px;">${pct>=80 ? '🎉 Excellent!' : pct>=60 ? '👍 Good Job!' : '💪 Keep Practicing!'}</h3><p style="color:#64748B;font-size:14px;margin-bottom:20px;">${pct>=80 ? 'Task marked as complete!' : 'Score 80%+ to complete the task'}</p><div style="background:linear-gradient(135deg,#FEF3C7,#FDE68A);border-radius:12px;padding:16px;margin-bottom:16px;"><div style="font-size:28px;font-weight:700;color:#D97706;">+${xpEarned} XP</div><div style="font-size:13px;color:#92400E;margin-top:4px;">Total XP: ${newXP} | Level ${newLevel}</div>${levelUp ? `<div style="margin-top:8px;font-size:13px;color:#059669;font-weight:600;">🎊 Level Up! You reached Level ${newLevel}!</div>` : ''}</div><button onclick="document.getElementById('quiz-modal').remove();loadTasks();" style="width:100%;background:#059669;color:white;border:none;padding:12px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;">${pct>=80 ? '🏠 Back to Tasks' : '🔄 Try Again Later'}</button></div>`;
  loadXPDisplay();
}

// ── FIX 4: XP DISPLAY IN DASHBOARD ──────────────────────────
async function loadXPDisplay() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { data } = await supabase.from('profiles').select('xp, level').eq('id', session.user.id).single();
  const xp = data?.xp || 0; const level = data?.level || 1;
  const xpInLevel = xp % 100;
  let xpEl = document.getElementById('xp-display');
  if (!xpEl) {
    xpEl = document.createElement('div'); xpEl.id = 'xp-display';
    const streak = document.querySelector('[class*="streak"], #streak-badge');
    if (streak?.parentNode) streak.parentNode.insertBefore(xpEl, streak.nextSibling);
  }
  xpEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:rgba(245,158,11,0.1);border-radius:20px;border:1px solid rgba(245,158,11,0.2);"><span style="font-size:14px;">⚡</span><div><div style="font-size:12px;font-weight:600;color:#D97706;">Level ${level} · ${xp} XP</div><div style="height:3px;width:60px;background:#FDE68A;border-radius:2px;margin-top:2px;"><div style="height:100%;width:${xpInLevel}%;background:#D97706;border-radius:2px;"></div></div></div></div>`;
}

// ── Dashboard Loading ────────────────────────────────────────
async function loadDashboard(profile) {
    currentUserName = profile.full_name || 'Student';
    updateProfileUI(profile, '');
    loadDashboardStats();
    renderDashboard();
    loadTasks();
    loadXPDisplay();
    recordTodayLogin(currentUserId);
    updateStreakDisplay(currentUserId);
    buildActivityHeatmap(currentUserId);
}

// ── Task Completion ──────────────────────────────────────────
async function completeTask(taskId, refresh = true) {
    await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId);
    if (refresh) {
        await recalculateStats(currentUserId);
        loadTasks();
    }
}

// ── Common Logic ─────────────────────────────────────────────
async function callAI(prompt, maxTokens = 800) {
    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'HTTP-Referer': window.location.origin, 'X-Title': 'SkillBridge' },
            body: JSON.stringify({ model: 'meta-llama/llama-3.1-8b-instruct:free', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.7 })
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e) { return null; }
}

function updateProfileUI(p, email) {
    const name = p.full_name || email.split('@')[0];
    setText('user-display-name', name);
    setText('greeting-name', name.split(' ')[0]);
    setText('profile-initials', name.substring(0, 1).toUpperCase());
    setText('profile-name', name);
    setText('profile-goal', p.goal || 'Set your goal');
    setText('profile-college', (p.college_name || '') + (p.branch ? ' · ' + p.branch : ''));
    const avatar = document.getElementById('profile-avatar'); if (avatar) avatar.textContent = name.substring(0, 1).toUpperCase();
}

async function loadDashboardStats() {
    if (!supabase || !currentUserId) return;
    const [tasks, projects, certs] = await Promise.all([
        supabase.from('tasks').select('status').eq('user_id', currentUserId),
        supabase.from('projects').select('status').eq('user_id', currentUserId),
        supabase.from('certificates').select('id').eq('user_id', currentUserId)
    ]);
    const completedTasks = tasks.data?.filter(t => t.status === 'completed').length || 0;
    const totalTasks = tasks.data?.length || 1;
    const completedProjects = projects.data?.filter(p => p.status === 'completed').length || 0;
    const certsCount = certs.data?.length || 0;
    const progress = Math.round((completedTasks / totalTasks) * 100);
    const readiness = Math.min(95, Math.round(progress * 0.6 + completedProjects * 8 + certsCount * 5));
    setText('stat-progress', progress + '%');
    setText('stat-projects', completedProjects);
    setText('stat-skills', completedTasks);
    setText('stat-placement', readiness + '%');
}

async function renderDashboard() {
    if (!supabase || !currentUserId) return;
    const { data: profile } = await supabase.from('profiles').select('roadmap_json, roadmap_data').eq('id', currentUserId).single();
    const r = profile?.roadmap_data || profile?.roadmap_json;
    if (!r) return;
    setText('roadmap-focus-text', r.focus || (r.jobReadinessTarget ? `Target: Job Ready in ${r.jobReadinessTarget}` : 'Your roadmap is ready.'));
    ['roadmap-nodes-dashboard', 'roadmap-nodes-tab'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = (r.phases || []).map(p => {
            const name = p.phase || p.name || 'Phase';
            const status = p.status || 'locked';
            return `<div class="node ${status}"><span class="node-label">${name}</span></div>`;
        }).join('');
    });
}

function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('theme-toggle') && (document.getElementById('theme-toggle').onclick = () => {
        const target = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', target);
        localStorage.setItem('theme', target);
    });
}

function initInteractions() {
    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault(); await supabase.auth.signOut(); window.location.href = 'index.html';
    });
}

function initTabs() {
    const tabs = document.querySelectorAll('[data-tab]');
    function switchTab(tabName) {
        document.querySelectorAll('[id^="tab-"]').forEach(sec => { sec.style.display = 'none'; });
        const target = document.getElementById('tab-' + tabName);
        if (target) { target.style.display = 'block'; }
        tabs.forEach(t => { t.className = `nav-item ${t.dataset.tab === tabName ? 'active' : ''}`; });
        localStorage.setItem('activeTab', tabName);
        if (tabName === 'resources') searchYouTube('');
        if (tabName === 'tasks') loadTasks();
        if (tabName === 'profile') loadProfile();
    }
    tabs.forEach(tab => tab.addEventListener('click', (e) => { e.preventDefault(); switchTab(tab.dataset.tab); }));
    switchTab(localStorage.getItem('activeTab') || 'dashboard');
}

async function loadProfile() {
    const [profile, tasks, projects, certs] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', currentUserId).single(),
        supabase.from('tasks').select('status').eq('user_id', currentUserId),
        supabase.from('projects').select('status').eq('user_id', currentUserId),
        supabase.from('certificates').select('*').eq('user_id', currentUserId)
    ]);
    if (profile.data) updateProfileUI(profile.data, '');
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function showToast(msg) { console.log('Toast:', msg); }
function showTyping() { const chat = document.getElementById('chat-messages'); const typing = document.createElement('div'); typing.id = 'typing-indicator'; typing.style.cssText = 'padding:12px 16px; background:rgba(255,255,255,0.06); border-radius:16px; width:fit-content; margin-bottom:8px; display:flex; gap:4px;'; typing.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>'; chat.appendChild(typing); chat.scrollTop = chat.scrollHeight; }
function hideTyping() { document.getElementById('typing-indicator')?.remove(); }

async function searchYouTube(query) {
    if (!query) { const { data } = await supabase.from('profiles').select('goal').eq('id', currentUserId).single(); query = (data?.goal || 'Programming') + ' tutorial for beginners'; }
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=6&relevanceLanguage=en&key=${YOUTUBE_API_KEY}`);
    const data = await res.json();
    const container = document.getElementById('youtube-results');
    if (container && data.items) container.innerHTML = data.items.map(item => `<div style="border:0.5px solid var(--color-border); border-radius:12px; overflow:hidden; cursor:pointer; background:white;" onclick="window.open('https://youtube.com/watch?v=${item.id.videoId}', '_blank')"><img src="${item.snippet.thumbnails.medium.url}" style="width:100%; aspect-ratio:16/9; object-fit:cover;"><div style="padding:12px;"><div style="font-weight:600; font-size:13px; margin-bottom:6px; color:#0F172A;">${item.snippet.title.substring(0, 60)}...</div><div style="font-size:11px; color:#64748B;">${item.snippet.channelTitle}</div></div></div>`).join('');
}

async function recordTodayLogin(userId) { const today = new Date().toISOString().split('T')[0]; await supabase.from('user_activity').upsert({ user_id: userId, activity_date: today }, { onConflict: 'user_id,activity_date' }); }
async function updateStreakDisplay(userId) { const streak = await calculateStreak(userId); const navStreak = document.getElementById('streak-badge'); if (navStreak) navStreak.innerHTML = '🔥 ' + streak + ' Day Streak'; }
async function calculateStreak(userId) { const { data } = await supabase.from('user_activity').select('activity_date').eq('user_id', userId).order('activity_date', { ascending: false }); if (!data || data.length === 0) return 0; const todayStr = new Date().toISOString().split('T')[0]; const latestDate = data[0].activity_date; const dayDiff = Math.floor((new Date(todayStr) - new Date(latestDate)) / 86400000); if (dayDiff > 1) return 0; let streak = 0; const dateSet = new Set(data.map(d => d.activity_date)); let checkDate = new Date(latestDate); while (true) { const ds = checkDate.toISOString().split('T')[0]; if (dateSet.has(ds)) { streak++; checkDate.setDate(checkDate.getDate() - 1); } else break; } return streak; }
async function buildActivityHeatmap(userId) {
    const heatmapEl = document.getElementById('activity-heatmap'); if (!heatmapEl) return;
    const twelveWeeksAgo = new Date(); twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
    const { data } = await supabase.from('user_activity').select('activity_date').eq('user_id', userId).gte('activity_date', twelveWeeksAgo.toISOString().split('T')[0]);
    const activeDates = new Set((data || []).map(d => d.activity_date));
    heatmapEl.innerHTML = ''; heatmapEl.style.cssText = 'display:grid;grid-template-columns:repeat(12,1fr);gap:3px;';
    for (let week = 11; week >= 0; week--) {
        const col = document.createElement('div'); col.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
        for (let day = 6; day >= 0; day--) {
            const date = new Date(); date.setDate(date.getDate() - (week * 7 + day)); const ds = date.toISOString().split('T')[0];
            const isActive = activeDates.has(ds); const isFuture = date > new Date();
            const cell = document.createElement('div'); cell.style.cssText = `width:12px;height:12px;border-radius:2px;background:${isFuture ? 'transparent' : isActive ? '#059669' : '#E2E8F0'};opacity:${isFuture ? '0' : '1'};`;
            cell.title = ds; col.appendChild(cell);
        }
        heatmapEl.appendChild(col);
    }
}

function getSmartFallback(goal) { return { title: goal + " Roadmap", phases: [ { phase: "Phase 1", skills: ["Skill 1"], tasks: [{title: "Task 1", difficulty: "Easy"}] } ] }; }

const style = document.createElement('style');
style.textContent = `@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .dot { width: 6px; height: 6px; background: #94A3B8; border-radius: 50%; animation: typing 1s infinite; } .dot:nth-child(2) { animation-delay: 0.2s; } .dot:nth-child(3) { animation-delay: 0.4s; } @keyframes typing { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }`;
document.head.appendChild(style);

/**
 * SkillBridge Dashboard — Full Logic
 */

// Load Environment Configuration synchronously
let ENV_CONFIG = {};
try {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', '/scripts/config.json', false);
  xhr.send(null);
  if (xhr.status === 200) {
    ENV_CONFIG = JSON.parse(xhr.responseText);
  } else {
    throw new Error(`XHR status ${xhr.status}`);
  }
} catch (err) {
  console.warn("⚠️ Could not load config.json, falling back to window.ENV_CONFIG:", err);
  ENV_CONFIG = window.ENV_CONFIG || {};
}

var supabase;
const SUPABASE_URL = ENV_CONFIG.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = ENV_CONFIG.SUPABASE_ANON_KEY || '';
const OPENROUTER_KEY = ENV_CONFIG.OPENROUTER_KEY || '';
const GEMINI_KEY = ENV_CONFIG.GEMINI_KEY || '';
const YOUTUBE_API_KEY = ENV_CONFIG.YOUTUBE_API_KEY || '';
const GROQ_API_KEY = ENV_CONFIG.GROQ_API_KEY || '';

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

async function initializeSkillBridgeApp() {
  console.log('🚀 SkillBridge App Initializing...');
  // 1. Supabase FIRST
  initSupabase();
  if (!supabase) {
    console.warn('Supabase not ready yet, retrying in 150ms...');
    setTimeout(initializeSkillBridgeApp, 150);
    return;
  }

  // 2. Theme
  initTheme();

  // 3. Check auth
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = 'auth.html';
      return;
    }

    currentUserId = session.user.id;
    window.currentUserId = session.user.id;

    // 4. Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    console.log('Profile loaded:', profile);

    // Update UI greeting and domain immediately
    if (typeof updateProfileUI === 'function') {
      updateProfileUI(profile || {}, session.user.email || '');
    }

    // 5. Init interactions & tabs
    initInteractions();
    initTabs();

    if (profile?.onboarding_completed) {
      // Hide onboarding, show dashboard
      const overlay = document.getElementById('onboarding-overlay');
      if (overlay) overlay.style.display = 'none';
      if (typeof initDashboard === 'function') {
        await initDashboard(profile);
      }
      if (typeof loadDashboardStats === 'function') {
        await loadDashboardStats();
      }
    } else {
      // Show onboarding
      showOnboarding(profile);
    }
  } catch (err) {
    console.error('Init error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSkillBridgeApp);
} else {
  initializeSkillBridgeApp();
}

function initSupabase() {
  try {
    if (window.supabase && typeof window.supabase.from === 'function') {
      supabase = window.supabase;
      return;
    }
    const lib = window.supabasejs
      || window.Supabase
      || (window.supabase && window.supabase.createClient ? window.supabase : null);
    if (!lib || !lib.createClient) {
      console.error('Supabase lib not found');
      return;
    }
    const client = lib.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
    supabase = client;
    window.supabase = client;
    window.supabaseClient = client;
    console.log('✅ Supabase client initialized and bound to window');
  } catch (err) {
    console.error('Supabase init error:', err);
  }
}

// ── Onboarding Check ─────────────────────────────────────────
async function checkOnboarding() {
  if (!supabase) {
    console.log('⚠️ supabase not initialized yet, trying to initialize now...');
    initSupabase();
    if (!supabase) {
      console.error('❌ supabase could not be initialized! Delaying checkOnboarding...');
      setTimeout(checkOnboarding, 500);
      return;
    }
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = 'auth.html';
    return;
  }

  currentUserId = session.user.id;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('onboarding_completed, full_name, goal, roadmap_data, xp, level, notifications, session_history')
    .eq('id', session.user.id)
    .single();

  console.log('Profile check result:', { profile, error });

  if (profile && profile.onboarding_completed === true) {
    console.log('✅ Onboarding already completed');
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.style.display = 'none';
    initDashboard(profile);
  } else {
    console.log('🚀 Starting onboarding flow...');
    showOnboarding(profile);
  }
}


async function showOnboarding(profile) {
  const { data: { session } } = await supabase.auth.getSession();
  const meta = session?.user?.user_metadata;
  onboardingData.name = profile?.full_name?.split(' ')[0] || meta?.full_name?.split(' ')[0] || meta?.name?.split(' ')[0] || 'there';
  currentUserName = onboardingData.name;

  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.style.opacity = '0';
    requestAnimationFrame(() => {
      overlay.style.transition = 'opacity 400ms ease';
      overlay.style.opacity = '1';
    });
  }

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
  // Use upsert instead of update to handle new users
  let { error } = await supabase.from('profiles').upsert({
    id: currentUserId,
    goal: onboardingData.goal,
    current_level: onboardingData.currentLevel,
    skills: onboardingData.skills,
    timeline: onboardingData.timeline,
    learning_style: onboardingData.learningStyle,
    education_level: onboardingData.educationLevel,
    onboarding_completed: true
  });

  if (error) {
    console.warn('❌ Full profile upsert failed (likely missing columns), trying defensive fallback update...', error);

    // Fallback: only update core columns we are confident exist in any version of profiles
    const fallbackResult = await supabase.from('profiles').update({
      goal: onboardingData.goal,
      current_level: onboardingData.currentLevel,
      timeline: onboardingData.timeline,
      onboarding_completed: true
    }).eq('id', currentUserId);

    if (fallbackResult.error) {
      console.error('❌ Onboarding fallback update also failed:', fallbackResult.error);
      showToast('Profile sync failed, but proceeding locally to generate roadmap...', 'warning');
    }
  }

  await generateRoadmapWithAI();
}

// ── FIX 5: ROADMAP GENERATION DEBUG ──────────────────────────
async function generateRoadmapWithAI() {
  console.log('Starting roadmap generation...');
  console.log('Goal:', onboardingData.goal);
  console.log('Level:', onboardingData.currentLevel);

  hideTyping();
  addMessage('🧠 Perfect! I have everything I need.<br><br>Building your personalized technical roadmap...<br>⏳ This takes about 15 seconds');
  showTyping();

  const inputArea = document.getElementById('chat-input-area');
  if (inputArea) inputArea.style.display = 'none';

  const userGoal = onboardingData.goal || 'Data Scientist';
  const prompt = `You are a Principal Software Engineer and Data Science Director.
Create a strictly sequential, technical learning roadmap for a student.
Goal: ${userGoal}
Level: ${onboardingData.currentLevel || 'Beginner'}
Skills: ${onboardingData.skills || 'None'}
Time: ${onboardingData.timeline || '1-2 Hours'}

CRITICAL RULES:
1. ONLY technical, domain-specific programming, algorithmic, mathematical, and engineering milestones.
2. ABSOLUTELY NO generic orientation, soft-skill, SWOT analysis, or generic goal-setting tasks.
3. If the goal is Data Scientist / AI / ML, tasks MUST focus on Python, Statistics & Probability, NumPy/Pandas, SQL for Analytics, Exploratory Data Analysis, Scikit-Learn Machine Learning, PyTorch Deep Learning, and MLOps deployment.
4. Each phase must contain exactly 4 technical tasks with real documentation URLs and 1 practical capstone project.

Return ONLY this exact JSON structure:
{"title":"${userGoal} Roadmap","totalWeeks":16,"jobReadinessTarget":"4 months","phases":[{"phase":"Phase 1 • Topic","name":"Phase 1 • Topic","description":"Phase description","weeks":"Week 1-4","skills":["Skill1","Skill2","Skill3","Skill4"],"project":"Project Name","status":"current","tasks":[{"title":"Task Title","difficulty":"Easy","resource":"https://developer.mozilla.org"}]}]}

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
        model: 'openrouter/free',
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
    addMessage('⚠️ I had some trouble with the AI, but I\'ve created a standard technical roadmap for you to get started! You can customize it later.');
    const fallback = getDomainRoadmapTemplate(userGoal);
    await saveAndShowRoadmap(fallback);
  }
}

function showTyping() {
  const chat = document.getElementById('chat-messages');
  if (!chat || document.getElementById('typing-indicator')) return;
  const d = document.createElement('div');
  d.id = 'typing-indicator';
  d.style.cssText = `padding: 12px 16px; border-radius: 16px; max-width: 80px; margin-bottom: 8px; align-self: flex-start; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); display: flex; gap: 4px; align-items: center; justify-content: center; animation: fadeUp 300ms ease-out both;`;
  d.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
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

  // Final success message
  addMessage('✅ Your roadmap is ready! Redirecting to your personalized dashboard...');

  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 500ms';
      setTimeout(() => {
        overlay.style.display = 'none';
        window.location.reload();
      }, 500);
    }, 1500); // Give user time to see the success message
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
// ── QUICK TEST ASSESSMENT ENGINE ──────────────────────
async function loadTasks() {
  await loadQuickTestTab();
}

const QUICK_TEST_QUESTIONS = {
  software: [
    { skill: "CSS", text: "Which CSS display property creates a grid layout container?", options: ["display: flex", "display: grid", "display: block", "display: table"], correct: 1 },
    { skill: "JavaScript", text: "Which method is commonly used to fetch data from a REST API in JavaScript?", options: ["document.query()", "fetch()", "requestData()", "getAPI()"], correct: 1 },
    { skill: "React", text: "Which hook handles side effects (e.g. data fetching) in functional components?", options: ["useState", "useEffect", "useContext", "useReducer"], correct: 1 },
    { skill: "APIs", text: "What HTTP status code represents a successful REST API request?", options: ["200 OK", "404 Not Found", "500 Internal Error", "301 Redirect"], correct: 0 },
    { skill: "Git", text: "Which Git command uploads local commits to a remote repository?", options: ["git pull", "git push", "git commit", "git clone"], correct: 1 },
    { skill: "HTML", text: "Which HTML5 semantic element is most appropriate for primary navigation?", options: ["<div>", "<nav>", "<section>", "<header>"], correct: 1 },
    { skill: "React", text: "How do you pass data down to child components in React?", options: ["State", "Props", "Hooks", "Reducers"], correct: 1 },
    { skill: "JavaScript", text: "Which keyword declares a block-scoped variable that can be reassigned?", options: ["var", "let", "const", "define"], correct: 1 },
    { skill: "APIs", text: "What data format is standard for exchanging info in modern REST APIs?", options: ["XML", "JSON", "CSV", "YAML"], correct: 1 },
    { skill: "CSS", text: "Which CSS property is used to change the text color?", options: ["text-color", "font-color", "color", "background-color"], correct: 2 }
  ],
  design: [
    { skill: "Typography", text: "Which font style is generally preferred for body paragraphs to enhance readability?", options: ["Decorative", "Script", "Sans-serif", "Serif"], correct: 2 },
    { skill: "Color Theory", text: "Which color scheme uses colors next to each other on the color wheel?", options: ["Monochromatic", "Complementary", "Triadic", "Analogous"], correct: 3 },
    { skill: "Figma", text: "What feature in Figma allows creating reusable design elements that sync changes?", options: ["Groups", "Frames", "Components", "Instances"], correct: 2 },
    { skill: "Design Principles", text: "Which principle directs the user's eye to the most important element first?", options: ["Contrast", "Visual Hierarchy", "Proximity", "Alignment"], correct: 1 },
    { skill: "Wireframing", text: "What is the primary goal of a low-fidelity wireframe?", options: ["Test visual styling & colors", "Establish visual layout & user flows", "Interactive components testing", "Client proposal presentation"], correct: 1 },
    { skill: "UX Research", text: "Which research method collects qualitative, open-ended feedback directly from users?", options: ["Surveys", "Usability testing interviews", "A/B testing analytics", "Heatmaps"], correct: 1 },
    { skill: "Prototyping", text: "What Figma transition enables fluid screen animations automatically?", options: ["Static", "Smart Animate", "Instant", "Overlay"], correct: 1 },
    { skill: "Design Systems", text: "What is the core building block of a consistent design system?", options: ["Images", "Design Tokens and UI components", "Font files", "Mockups"], correct: 2 },
    { skill: "Accessibility", text: "What is the minimum recommended contrast ratio for normal body text under WCAG AA?", options: ["2:1", "3:1", "4.5:1", "7:1"], correct: 2 },
    { skill: "Usability Testing", text: "What metric evaluates user frustration and error counts during product trials?", options: ["Bounce rate", "Task success rate and error count", "Click-through rate", "Conversion rate"], correct: 1 }
  ],
  data: [
    { skill: "SQL", text: "Which SQL clause filters records before aggregation in a SELECT statement?", options: ["ORDER BY", "GROUP BY", "WHERE", "HAVING"], correct: 2 },
    { skill: "Python", text: "Which data structure is mutable and ordered in Python?", options: ["Tuple", "List", "Set", "Dictionary"], correct: 1 },
    { skill: "Neural Networks", text: "What activation function is commonly used for binary classification output?", options: ["ReLU", "Sigmoid", "Tanh", "Softmax"], correct: 1 },
    { skill: "SQL", text: "Which SQL join returns all rows from the left table and matched rows from the right?", options: ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL OUTER JOIN"], correct: 1 },
    { skill: "Python", text: "Which library is primary for numerical and matrix operations in Python?", options: ["Pandas", "Matplotlib", "NumPy", "TensorFlow"], correct: 2 },
    { skill: "SQL", text: "Which keyword is used to group query results?", options: ["ORDER BY", "GROUP BY", "WHERE", "SORT"], correct: 1 },
    { skill: "Neural Networks", text: "Which optimizer is widely preferred for adaptive learning rate gradient descent?", options: ["SGD", "Adam", "Adagrad", "RMSprop"], correct: 1 },
    { skill: "Data Cleaning", text: "How do you typically handle missing numerical values in a feature column?", options: ["Delete the column", "Impute with mean/median or drop rows", "Fill with zeros", "Ignore them"], correct: 1 },
    { skill: "SQL", text: "Which SQL aggregation function computes the average?", options: ["SUM", "COUNT", "AVG", "MIN"], correct: 2 },
    { skill: "Python", text: "Which function gets the length of a list in Python?", options: ["size()", "length()", "len()", "count()"], correct: 2 }
  ]
};



async function loadQuickTestTab() {
  if (!supabase || !currentUserId) return;

  // 1. Fetch user profile data
  const { data: profile } = await supabase.from('profiles').select('goal, session_history').eq('id', currentUserId).single();
  const goal = profile?.goal || "Frontend Developer";
  const history = profile?.session_history || [];

  // 2. Identify career track
  const trackInfo = getCareerTrackFromGoal(goal);
  document.getElementById('qt-current-path').textContent = trackInfo.spec;
  document.getElementById('qt-test-path').textContent = trackInfo.spec;

  // 3. Filter assessment history
  const assessments = history.filter(h => h.type === 'assessment');

  if (assessments.length > 0) {
    const latest = assessments[0];

    // Render score box
    document.getElementById('qt-score-box').innerHTML = `
      <div id="qt-overall-score" style="font-size: 48px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">${latest.score}%</div>
      <div id="qt-score-level" style="font-size: 14px; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px;">
        ${latest.score >= 80 ? 'Strong Performance' : latest.score >= 60 ? 'Good Progress' : 'Needs Improvement'}
      </div>
      <div class="cc-progress-container" style="max-width: 260px; margin: 0 auto;">
        <div id="qt-overall-bar" class="cc-progress-bar" style="width: ${latest.score}%;"></div>
      </div>
    `;

    document.getElementById('qt-last-tested').textContent = `Last tested: ${latest.date}`;

    // Render skill breakdowns
    const breakdownHTML = Object.entries(latest.skills).map(([skillName, score]) => {
      const level = score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Developing' : 'Needs Improvement';
      const color = score >= 80 ? '#1B6344' : score >= 60 ? '#1B6344' : score >= 40 ? '#8A5E12' : '#992604';
      return `
        <div>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
            <span style="color:var(--text-primary); font-weight:700;">${skillName}</span>
            <span style="color:${color}; font-weight:700;">${score}% · ${level}</span>
          </div>
          <div class="cc-progress-container">
            <div class="cc-progress-bar" style="width: ${score}%; background: ${color};"></div>
          </div>
        </div>
      `;
    }).join('');
    document.getElementById('qt-skill-breakdown-list').innerHTML = breakdownHTML;

    // AI Insight
    document.getElementById('qt-ai-insight').textContent = latest.insight;

    // Recommendation card
    document.getElementById('qt-recommendation-title').textContent = latest.weakSkill;
    const weakScore = latest.skills[latest.weakSkill] || 0;
    document.getElementById('qt-recommendation-score').textContent = `${weakScore}%`;

    // History list
    const historyHTML = assessments.slice(0, 5).map((a, aIdx) => {
      let diffText = "";
      if (aIdx < assessments.length - 1) {
        const prev = assessments[aIdx + 1];
        const diff = a.score - prev.score;
        if (diff > 0) diffText = `<span style="color:#1B6344; font-size:11px; font-weight:600; margin-top:2px; display:block;">↑ +${diff}% from previous test</span>`;
        else if (diff < 0) diffText = `<span style="color:#992604; font-size:11px; font-weight:600; margin-top:2px; display:block;">↓ ${diff}% from previous test</span>`;
      }
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--bg-tertiary); border:1px solid var(--border); border-radius:10px; font-size:13px;">
          <div>
            <strong style="color:var(--text-primary); font-weight:700;">${a.date}</strong>
            <div style="color:var(--text-secondary); font-size:11px; margin-top:2px; font-weight:500;">${a.trackName}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:800; color:var(--text-primary);">${a.score}%</div>
            ${diffText}
          </div>
        </div>
      `;
    }).join('');
    document.getElementById('qt-history-list').innerHTML = historyHTML;
  } else {
    // Welcome / No Assessment taken yet state
    document.getElementById('qt-score-box').innerHTML = `
      <div style="padding: 30px 0; color: var(--text-muted); font-size: 13px;">
        You haven't taken your first assessment yet.
      </div>
    `;
    document.getElementById('qt-last-tested').textContent = "Last tested: Never";

    // Placeholder skill list based on track
    const placeholderSkills = trackInfo.track === "UI/UX & Design" ? ["Typography", "Color Theory", "Figma", "Design Principles", "UX Research"] : ["JavaScript", "React", "CSS", "APIs", "Git"];
    document.getElementById('qt-skill-breakdown-list').innerHTML = placeholderSkills.map(skillName => `
      <div>
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
          <span style="color:#ffffff; font-weight:600;">${skillName}</span>
          <span style="color:var(--text-muted); font-weight:700;">--</span>
        </div>
        <div class="cc-progress-container">
          <div class="cc-progress-bar" style="width: 0%;"></div>
        </div>
      </div>
    `).join('');

    document.getElementById('qt-ai-insight').textContent = "Take your first assessment to unlock personalized recommendations and tailor your study roadmap.";
    document.getElementById('qt-recommendation-title').textContent = "API Integration";
    document.getElementById('qt-recommendation-score').textContent = "Pending";
    document.getElementById('qt-history-list').innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding: 12px 0;">No previous assessments found.</div>`;
  }
}

function startQuickTest() {
  // Hide success and dashboard
  document.getElementById('qt-dashboard-view').style.display = 'none';
  document.getElementById('qt-success-view').style.display = 'none';
  document.getElementById('qt-analysis-view').style.display = 'none';

  // Get user path and select matching question pool
  const pathTitle = document.getElementById('qt-current-path').textContent || "Frontend Development";
  let pool = QUICK_TEST_QUESTIONS.software;
  const normalized = pathTitle.toLowerCase();
  if (normalized.includes("design") || normalized.includes("ui") || normalized.includes("ux")) {
    pool = QUICK_TEST_QUESTIONS.design;
  } else if (normalized.includes("ml") || normalized.includes("ai") || normalized.includes("data") || normalized.includes("scientist")) {
    pool = QUICK_TEST_QUESTIONS.data;
  }

  window.qtQuestions = pool;
  window.qtAnswers = new Array(pool.length).fill(null);
  window.qtCurrentIndex = 0;

  // Show test panel
  document.getElementById('qt-test-view').style.display = 'block';
  renderQtQuestion();
}

function renderQtQuestion() {
  const index = window.qtCurrentIndex;
  const questions = window.qtQuestions;
  const currentQ = questions[index];

  document.getElementById('qt-question-counter').textContent = `${index + 1} / ${questions.length}`;
  const progressPct = Math.round(((index + 1) / questions.length) * 100);
  document.getElementById('qt-test-progress-bar').style.width = `${progressPct}%`;
  document.getElementById('qt-question-text').textContent = currentQ.text;

  // Render options
  const savedAnswer = window.qtAnswers[index];
  const optionsHTML = currentQ.options.map((opt, optIdx) => {
    const isSelected = savedAnswer === optIdx;
    return `
      <label 
        style="
          display: flex; 
          align-items: center; 
          gap: 12px; 
          padding: 14px 18px; 
          border-radius: 10px; 
          background: ${isSelected ? 'rgba(0, 229, 255, 0.04)' : 'rgba(255,255,255,0.02)'}; 
          border: 1.5px solid ${isSelected ? 'var(--emerald)' : 'var(--border)'}; 
          cursor: pointer; 
          user-select: none; 
          transition: all 0.2s;
        "
        onmouseover="this.style.borderColor='rgba(0, 229, 255, 0.4)';"
        onmouseout="this.style.borderColor='${isSelected ? 'var(--emerald)' : 'var(--border)'}';"
      >
        <input 
          type="radio" 
          name="qt-answer-opt" 
          value="${optIdx}" 
          ${isSelected ? 'checked' : ''} 
          onclick="selectQtAnswer(${optIdx})"
          style="accent-color: var(--emerald); width: 16px; height: 16px; margin: 0;"
        >
        <span style="font-size: 13px; color: ${isSelected ? '#ffffff' : 'var(--text-secondary)'}; font-weight: ${isSelected ? '600' : '500'};">
          ${opt}
        </span>
      </label>
    `;
  }).join('');

  document.getElementById('qt-options-container').innerHTML = optionsHTML;

  // Toggle prev/next button views
  document.getElementById('qt-prev-btn').style.visibility = index === 0 ? 'hidden' : 'visible';
  document.getElementById('qt-next-btn').textContent = index === questions.length - 1 ? 'Submit Test' : 'Next →';
}

function selectQtAnswer(optionIdx) {
  window.qtAnswers[window.qtCurrentIndex] = optionIdx;
  renderQtQuestion();
}

function prevQuestion() {
  if (window.qtCurrentIndex > 0) {
    window.qtCurrentIndex--;
    renderQtQuestion();
  }
}

async function nextQuestion() {
  const index = window.qtCurrentIndex;
  const answers = window.qtAnswers;

  if (answers[index] === null) {
    showToast("Please select an answer to continue.", "info");
    return;
  }

  if (index < window.qtQuestions.length - 1) {
    window.qtCurrentIndex++;
    renderQtQuestion();
  } else {
    await finishQuickTest();
  }
}

function exitQuickTest() {
  if (confirm("Are you sure you want to exit the test? Your current progress will not be saved.")) {
    resetQuickTestView();
  }
}

function resetQuickTestView() {
  document.getElementById('qt-test-view').style.display = 'none';
  document.getElementById('qt-analysis-view').style.display = 'none';
  document.getElementById('qt-success-view').style.display = 'none';
  document.getElementById('qt-dashboard-view').style.display = 'block';
  loadQuickTestTab();
}

async function finishQuickTest() {
  document.getElementById('qt-test-view').style.display = 'none';
  document.getElementById('qt-analysis-view').style.display = 'block';

  // 1. Calculate Score
  const questions = window.qtQuestions;
  const answers = window.qtAnswers;
  let correctCount = 0;

  // Tracks category totals
  const categoryStats = {}; // { CSS: { correct: 0, total: 0 } }

  questions.forEach((q, idx) => {
    const isCorrect = answers[idx] === q.correct;
    if (isCorrect) correctCount++;

    if (!categoryStats[q.skill]) {
      categoryStats[q.skill] = { correct: 0, total: 0 };
    }
    categoryStats[q.skill].total++;
    if (isCorrect) categoryStats[q.skill].correct++;
  });

  const pctScore = Math.round((correctCount / questions.length) * 100);

  // Compile skill percentages
  const skillScores = {};
  Object.entries(categoryStats).forEach(([skill, stat]) => {
    skillScores[skill] = Math.round((stat.correct / stat.total) * 100);
  });

  // Identify weak skill (lowest score, default to APIs/Design Principles if no issues)
  let weakSkill = "APIs";
  let minScore = 101;
  Object.entries(skillScores).forEach(([skill, score]) => {
    if (score < minScore) {
      minScore = score;
      weakSkill = skill;
    }
  });

  // Adjust name for search query matching in roadmap
  if (weakSkill === "Typography") weakSkill = "Typography";
  else if (weakSkill === "APIs") weakSkill = "API Integration";

  // Simulate AI Insight tailoring based on weak skill
  const pathTitle = document.getElementById('qt-current-path').textContent || "Frontend Development";
  const insightText = `Your overall score is ${pctScore}%. While you have demonstrated good core competency, ${weakSkill} is currently identified as your primary skill gap. Atlas recommends focusing on this checkpoint next to enhance your job readiness.`;

  // 2. Perform Roadmap reordering adaptation
  await adaptRoadmapForWeakSkill(weakSkill);

  // 3. Save to profile session history
  const { data: profile } = await supabase.from('profiles').select('session_history').eq('id', currentUserId).single();
  const history = profile?.session_history || [];

  const newAttempt = {
    type: 'assessment',
    score: pctScore,
    correct: correctCount,
    total: questions.length,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    trackName: pathTitle,
    skills: skillScores,
    insight: insightText,
    weakSkill: weakSkill
  };

  history.unshift(newAttempt);
  await supabase.from('profiles').update({ session_history: history }).eq('id', currentUserId);

  // Simulate analysis animation duration
  setTimeout(() => {
    document.getElementById('qt-analysis-view').style.display = 'none';
    document.getElementById('qt-success-score').textContent = `${pctScore}%`;
    document.getElementById('qt-success-gap').textContent = weakSkill;
    document.getElementById('qt-success-view').style.display = 'block';

    // Proactively refresh other tabs
    loadDashboardStats();
  }, 2200);
}

async function adaptRoadmapForWeakSkill(weakSkill) {
  try {
    const { data: profile } = await supabase.from('profiles').select('roadmap_data').eq('id', currentUserId).single();
    if (!profile || !profile.roadmap_data) return;

    const roadmap = profile.roadmap_data;
    if (!roadmap.phases || roadmap.phases.length === 0) return;

    const weakSkillNormalized = weakSkill.toLowerCase();
    const isMatchingTask = (title) => {
      const t = title.toLowerCase();
      if (weakSkillNormalized.includes("api") && (t.includes("api") || t.includes("fetch") || t.includes("ajax") || t.includes("endpoint") || t.includes("request"))) return true;
      if (weakSkillNormalized.includes("react") && (t.includes("react") || t.includes("component") || t.includes("hook"))) return true;
      if (weakSkillNormalized.includes("css") && (t.includes("css") || t.includes("style") || t.includes("layout") || t.includes("flexbox"))) return true;
      if (weakSkillNormalized.includes("git") && (t.includes("git") || t.includes("github") || t.includes("version"))) return true;
      if (weakSkillNormalized.includes("javascript") && (t.includes("javascript") || t.includes("es6") || t.includes("js"))) return true;
      if (weakSkillNormalized.includes("figma") && (t.includes("figma") || t.includes("wireframe") || t.includes("prototype"))) return true;
      if (weakSkillNormalized.includes("typography") && (t.includes("typography") || t.includes("font") || t.includes("text"))) return true;
      return t.includes(weakSkillNormalized);
    };

    // Query tasks to determine completed statuses
    const { data: dbTasks } = await supabase.from('tasks').select('*').eq('user_id', currentUserId);
    const completedTaskTitles = new Set((dbTasks || []).filter(t => t.status === 'completed').map(t => t.title));

    // Find the active phase index
    let activePhaseIndex = -1;
    for (let pIdx = 0; pIdx < roadmap.phases.length; pIdx++) {
      const phase = roadmap.phases[pIdx];
      const hasUncompleted = (phase.tasks || []).some(t => !completedTaskTitles.has(t.title));
      if (hasUncompleted) {
        activePhaseIndex = pIdx;
        break;
      }
    }

    if (activePhaseIndex !== -1) {
      const activePhase = roadmap.phases[activePhaseIndex];
      const tasksList = activePhase.tasks || [];

      const completedTasks = tasksList.filter(t => completedTaskTitles.has(t.title));
      const uncompletedTasks = tasksList.filter(t => !completedTaskTitles.has(t.title));

      const matchingUncompleted = uncompletedTasks.filter(t => isMatchingTask(t.title));
      const otherUncompleted = uncompletedTasks.filter(t => !isMatchingTask(t.title));

      if (matchingUncompleted.length > 0) {
        // Reorder tasks inside this phase
        activePhase.tasks = [...completedTasks, ...matchingUncompleted, ...otherUncompleted];
        console.log(`Reordered Phase ${activePhaseIndex + 1} tasks to prioritize:`, matchingUncompleted.map(t => t.title));
      } else {
        // If not found in active phase, look in subsequent phases
        let foundTask = null;
        let foundPIdx = -1;
        let foundTIdx = -1;
        for (let pIdx = activePhaseIndex + 1; pIdx < roadmap.phases.length; pIdx++) {
          const phase = roadmap.phases[pIdx];
          const matchIdx = (phase.tasks || []).findIndex(t => !completedTaskTitles.has(t.title) && isMatchingTask(t.title));
          if (matchIdx !== -1) {
            foundTask = phase.tasks[matchIdx];
            foundPIdx = pIdx;
            foundTIdx = matchIdx;
            break;
          }
        }
        if (foundTask && foundPIdx !== -1) {
          // Remove from later phase
          roadmap.phases[foundPIdx].tasks.splice(foundTIdx, 1);
          // Insert into current phase right after completed tasks
          activePhase.tasks = [...completedTasks, foundTask, ...uncompletedTasks];
          console.log("Moved task from later phase to current focus:", foundTask.title);
        }
      }

      // Save updated roadmap data in Supabase
      await supabase.from('profiles').update({ roadmap_data: roadmap }).eq('id', currentUserId);

      // Re-sync standard database tasks table
      await saveTasksFromRoadmap(roadmap, currentUserId);
    }
  } catch (err) {
    console.error("Roadmap adaptation error:", err);
  }
}

async function startRecommendedLearning(targetTopic) {
  if (!targetTopic || typeof targetTopic !== 'string') {
    const recTitle = document.getElementById('qt-recommendation-title')?.textContent?.trim();
    const successGap = document.getElementById('qt-success-gap')?.textContent?.trim();
    targetTopic = recTitle || successGap || '';
  }

  const { data: dbTasks } = await supabase.from('tasks').select('*').eq('user_id', currentUserId);
  
  if (targetTopic && targetTopic !== '') {
    // 1. Check if user already has a task matching this topic
    const matchedTask = dbTasks?.find(t => 
      (t.title && t.title.toLowerCase().includes(targetTopic.toLowerCase())) ||
      (t.roadmap_phase && t.roadmap_phase.toLowerCase().includes(targetTopic.toLowerCase()))
    );

    if (matchedTask) {
      openTaskDetail(matchedTask.id);
      return;
    }

    // 2. If no matching task in DB, directly open the high-fidelity course notes generator for this topic!
    generateCourseNotes(`rec-${Date.now()}`, targetTopic);
    return;
  }

  if (!dbTasks || dbTasks.length === 0) {
    switchTab('roadmap');
    return;
  }

  // Find first uncompleted task
  const activeTask = dbTasks.find(t => t.status !== 'completed');
  if (activeTask) {
    // Open task study details hub
    openTaskDetail(activeTask.id);
  } else {
    switchTab('roadmap');
  }
}

// Bind to window context
window.startQuickTest = startQuickTest;
window.renderQtQuestion = renderQtQuestion;
window.selectQtAnswer = selectQtAnswer;
window.prevQuestion = prevQuestion;
window.nextQuestion = nextQuestion;
window.exitQuickTest = exitQuickTest;
window.resetQuickTestView = resetQuickTestView;
window.finishQuickTest = finishQuickTest;
window.startRecommendedLearning = startRecommendedLearning;

function filterTasks(status) {
  const cards = document.querySelectorAll('.task-card-item');
  const buttons = document.querySelectorAll('.task-filter-btn');

  buttons.forEach(btn => {
    if (btn.id === `filter-${status}`) {
      btn.style.background = '#059669';
      btn.style.color = 'white';
      btn.style.borderColor = '#059669';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#64748B';
      btn.style.borderColor = '#E2E8F0';
    }
  });

  cards.forEach(card => {
    const cardStatus = card.getAttribute('data-task-status');
    if (status === 'all') {
      card.style.display = 'block';
    } else if (status === 'pending') {
      if (cardStatus !== 'completed') {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    } else if (status === 'completed') {
      if (cardStatus === 'completed') {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    }
  });
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
function closeTaskDetailModal(callback) {
  const modal = document.getElementById('task-detail-modal');
  if (!modal) {
    if (typeof callback === 'function') callback();
    return;
  }
  modal.style.animation = 'taskModalBackdropOut 200ms ease-out forwards';
  const card = modal.querySelector('.task-modal-card');
  if (card) {
    card.style.animation = 'taskModalCardOut 200ms ease-out forwards';
  }
  setTimeout(() => {
    modal.remove();
    if (typeof callback === 'function') callback();
  }, 200);
}

async function openTaskDetail(taskId) {
  let task = window.allTasks?.find(t => t.id === taskId);
  if (!task) {
    const { data } = await supabase.from('tasks').select('*').eq('id', taskId).single();
    if (!data) return;
    task = data;
    if (!window.allTasks) window.allTasks = [];
    window.allTasks.push(task);
  }

  // Remove any existing instance
  const existing = document.getElementById('task-detail-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'task-detail-modal';
  modal.className = 'task-modal-overlay';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(26,21,18,0.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;animation:taskModalBackdropIn 200ms ease-out forwards;`;

  const diffText = (task.difficulty || 'Easy').toUpperCase();
  const xpValue = task.difficulty === 'Hard' ? 50 : task.difficulty === 'Medium' ? 30 : 15;

  modal.innerHTML = `
    <div class="task-modal-card" style="
      background:var(--bg-secondary, #FFFFFF);
      border:1.5px solid var(--border-strong, #D9C9B8);
      border-radius:24px;
      padding:32px;
      max-width:560px;width:100%;
      box-shadow:0 24px 60px rgba(26, 21, 18, 0.15);
      max-height:90vh;
      overflow-y:auto;
      position:relative;
      animation:taskModalCardIn 200ms ease-out forwards;
    ">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <span class="task-modal-diff-badge" style="font-size:11px;padding:4px 12px;border-radius:12px;background:var(--accent-soft, #F3D9C4);color:var(--accent-hover, #D67D52);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;display:inline-block;">
            ${diffText}
          </span>
          <h3 class="task-modal-title" style="margin-top:12px;margin-bottom:0;font-size:22px;font-weight:700;color:var(--text-primary, #1A1512);line-height:1.3;">
            ${task.title}
          </h3>
        </div>
        <button onclick="closeTaskDetailModal()" class="task-modal-close-btn"
          style="background:var(--bg-tertiary, #F5EDE4);border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-secondary, #6B5D52);font-size:14px;font-weight:700;transition:all 200ms;flex-shrink:0;margin-left:12px;"
          onmouseover="this.style.background='var(--border, #E8DDD1)';this.style.color='var(--text-primary, #1A1512)';this.style.transform='scale(1.05)'"
          onmouseout="this.style.background='var(--bg-tertiary, #F5EDE4)';this.style.color='var(--text-secondary, #6B5D52)';this.style.transform='scale(1)'"
          title="Close"
        >✕</button>
      </div>

      <div style="font-size:14px;margin-bottom:24px;display:flex;align-items:center;gap:8px;">
        <span class="task-modal-phase-tag" style="background:var(--bg-tertiary, #F5EDE4);color:var(--text-secondary, #6B5D52);font-size:13px;font-weight:600;padding:5px 12px;border-radius:8px;display:inline-flex;align-items:center;gap:6px;">📍 ${task.roadmap_phase || 'Foundation Building'}</span>
      </div>

      <div style="margin-bottom:24px;">
        <div class="task-modal-section-label" style="font-size:12px;font-weight:700;color:var(--text-muted, #A69A8D);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Learning Resources</div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <!-- Link 1: Documentation -->
          <a href="${task.resource_link || 'https://developer.mozilla.org'}" target="_blank" class="task-modal-doc-card"
            style="display:flex;flex-direction:column;gap:8px;padding:16px;background:var(--bg-secondary, #FFFFFF);border-radius:16px;text-decoration:none;border:1.5px solid var(--border, #E8DDD1);transition:all 200ms;"
            onmouseover="this.style.borderColor='var(--accent-primary, #E8946A)';this.style.background='var(--bg-primary, #FDF8F3)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border, #E8DDD1)';this.style.background='var(--bg-secondary, #FFFFFF)';this.style.transform='translateY(0)'"
          >
            <span style="font-size:20px;">🌐</span>
            <div>
              <div style="font-weight:700;font-size:13px;color:var(--text-primary, #1A1512);">Official Docs</div>
              <div style="font-size:11px;color:var(--text-secondary, #6B5D52);">External tutorial</div>
            </div>
          </a>

          <!-- Link 2: AI Study Hub -->
          <button onclick="closeTaskDetailModal(() => generateCourseNotes('${task.id}', '${task.title.replace(/'/g, "\\'")}'))" class="task-modal-study-card"
            style="display:flex;flex-direction:column;gap:8px;padding:16px;background:var(--accent-soft, #F3D9C4);border-radius:16px;border:2px solid var(--accent-primary, #E8946A);cursor:pointer;text-align:left;transition:all 200ms;"
            onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 14px rgba(232,148,106,0.25)';this.style.borderColor='var(--accent-hover, #D67D52)'"
            onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='var(--accent-primary, #E8946A)'"
          >
            <span style="font-size:20px;">📖</span>
            <div>
              <div style="font-weight:700;font-size:13px;color:var(--text-primary, #1A1512);">Study Hub</div>
              <div style="font-size:11px;color:var(--accent-hover, #D67D52);font-weight:600;">Docs & Video Guide</div>
            </div>
          </button>
        </div>
      </div>

      <!-- Notes Preview Area -->
      <div id="course-notes-container" style="display:none;margin-bottom:24px;padding:16px;background:var(--bg-primary, #FDF8F3);border-radius:16px;border:1.5px solid var(--border, #E8DDD1);font-size:14px;color:var(--text-secondary, #6B5D52);line-height:1.6;">
        <div id="notes-content"></div>
      </div>

      <div class="task-modal-banner" style="background:var(--accent-soft, #F3D9C4);border-radius:16px;padding:20px;margin-bottom:28px;border:1px solid var(--border, #E8DDD1);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text-primary, #1A1512);">Skill Assessment</div>
            <div style="font-size:12px;color:var(--text-secondary, #6B5D52);margin-top:2px;">Must score 80% to unlock next step</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:800;color:var(--accent-hover, #D67D52);">+${xpValue} XP</div>
          </div>
        </div>
      </div>

      <button onclick="closeTaskDetailModal(() => startQuiz('${task.id}','${task.title.replace(/'/g, "\\'")}','${task.roadmap_phase || ''}'))" class="task-modal-cta-btn"
        style="width:100%;background:var(--accent-primary, #E8946A);color:#FFFFFF;border:none;padding:16px;border-radius:16px;font-size:15px;font-weight:700;cursor:pointer;transition:all 200ms;box-shadow:0 4px 12px rgba(232,148,106,0.25);"
        onmouseover="this.style.background='var(--accent-hover, #D67D52)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(232,148,106,0.35)'"
        onmouseout="this.style.background='var(--accent-primary, #E8946A)';this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(232,148,106,0.25)'"
      >🎯 Begin Assessment</button>
    </div>
  `;

  modal.onclick = (e) => {
    if (e.target === modal) closeTaskDetailModal();
  };

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeTaskDetailModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(modal);
}

function closeCourseViewerModal(callback) {
  const modal = document.getElementById('course-viewer-modal');
  if (!modal) {
    if (typeof callback === 'function') callback();
    return;
  }
  modal.style.animation = 'viewerFadeOut 200ms ease-out forwards';
  setTimeout(() => {
    modal.remove();
    if (typeof callback === 'function') callback();
  }, 200);
}
window.closeCourseViewerModal = closeCourseViewerModal;

async function generateCourseNotes(taskId, title) {
  // Remove any existing viewer modal instance
  const existing = document.getElementById('course-viewer-modal');
  if (existing) existing.remove();

  // Create high-fidelity warm cream/peach popup for course notes
  const viewer = document.createElement('div');
  viewer.id = 'course-viewer-modal';
  viewer.className = 'viewer-modal-overlay';
  viewer.style.cssText = `
    position: fixed;
    inset: 0;
    background-color: var(--bg-primary, #FDF8F3);
    background-image:
      linear-gradient(rgba(232, 221, 209, 0.45) 1px, transparent 1px),
      linear-gradient(90deg, rgba(232, 221, 209, 0.45) 1px, transparent 1px);
    background-size: 48px 48px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow-y: auto;
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    color: var(--text-primary, #1A1512);
    animation: viewerFadeIn 0.3s ease-out both;
  `;

  viewer.innerHTML = `
    <nav class="viewer-nav" style="padding:16px 40px;background:var(--bg-secondary, #FFFFFF);border-bottom:1.5px solid var(--border, #E8DDD1);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:20;box-shadow:0 2px 8px rgba(26, 21, 18, 0.04);">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="background:var(--accent-primary, #E8946A);color:#FFFFFF;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;box-shadow:0 2px 8px rgba(232,148,106,0.3);">SB</div>
        <div>
          <div style="font-size:11px;color:var(--text-muted, #A69A8D);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">COURSE CONTENT</div>
          <div style="font-size:16px;color:var(--text-primary, #1A1512);font-weight:700;">${title}</div>
        </div>
      </div>
      <button onclick="closeCourseViewerModal()" 
        style="background:var(--bg-tertiary, #F5EDE4);border:1.5px solid var(--border, #E8DDD1);padding:8px 18px;border-radius:10px;font-weight:700;font-size:13px;color:var(--text-primary, #1A1512);cursor:pointer;transition:all 200ms;"
        onmouseover="this.style.background='var(--border, #E8DDD1)';this.style.borderColor='var(--border-strong, #D9C9B8)';this.style.transform='translateY(-1px)';"
        onmouseout="this.style.background='var(--bg-tertiary, #F5EDE4)';this.style.borderColor='var(--border, #E8DDD1)';this.style.transform='translateY(0)';"
      >Close Viewer</button>
    </nav>

    <div style="max-width:1050px;margin:0 auto;width:100%;padding:40px 20px;display:grid;grid-template-columns:1.55fr 1fr;gap:32px;align-items:start;box-sizing:border-box;">
      <!-- Left: Notes Content -->
      <div id="viewer-content">
        <div class="viewer-card" style="text-align:center;padding:80px 20px;">
          <div class="shimmer-light" style="height:28px;width:60%;margin:0 auto 16px;border-radius:8px;"></div>
          <div class="shimmer-light" style="height:18px;width:40%;margin:0 auto 32px;border-radius:8px;"></div>
          <p style="color:var(--accent-hover, #D67D52);font-weight:700;font-size:16px;margin:0;">✨ Our AI is drafting your comprehensive study notes...</p>
        </div>
      </div>

      <!-- Right: Video & Resources -->
      <div style="display:flex;flex-direction:column;gap:24px;">
        <!-- Card 1: Video Masterclass -->
        <div class="viewer-card" style="padding:24px;">
          <h4 style="margin:0 0 16px 0;font-size:14px;font-weight:700;color:var(--text-primary, #1A1512);display:flex;align-items:center;gap:8px;">
            <span style="color:var(--accent-primary, #E8946A);font-size:18px;">🎥</span> Video Masterclass
          </h4>
          <div id="viewer-video" style="aspect-ratio:16/9;background:var(--bg-tertiary, #F5EDE4);border:1.5px solid var(--border, #E8DDD1);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:var(--text-muted, #A69A8D);font-size:13px;font-weight:600;">
            Searching for best tutorial...
          </div>
        </div>

        <!-- Card 2: Quick Challenge -->
        <div style="background:var(--accent-soft, #F3D9C4);border:1.5px solid var(--accent-primary, #E8946A);border-radius:20px;padding:24px;box-shadow:0 6px 20px rgba(232,148,106,0.12);">
          <h4 style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:var(--accent-hover, #D67D52);display:flex;align-items:center;gap:6px;">🚀 Quick Challenge</h4>
          <p style="font-size:14px;line-height:1.55;margin:0 0 20px 0;color:var(--text-primary, #1A1512);font-weight:500;">Master this topic to earn +30 XP and unlock the next phase of your roadmap.</p>
          <button onclick="closeCourseViewerModal()" 
            style="width:100%;background:var(--accent-primary, #E8946A);color:#FFFFFF;border:none;padding:13px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(232,148,106,0.25);transition:all 200ms;"
            onmouseover="this.style.background='var(--accent-hover, #D67D52)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(232,148,106,0.35)';"
            onmouseout="this.style.background='var(--accent-primary, #E8946A)';this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(232,148,106,0.25)';"
          >Return to Dashboard</button>
        </div>

        <!-- Card 3: Task Completion -->
        <div class="viewer-card" style="padding:24px;">
          <h4 style="margin:0 0 10px 0;font-size:13px;font-weight:700;color:var(--text-primary, #1A1512);display:flex;align-items:center;gap:8px;letter-spacing:0.5px;">
            <span style="color:var(--success, #7FA98A);font-weight:800;font-size:15px;">✓</span> TASK COMPLETION
          </h4>
          <p style="font-size:13px;line-height:1.55;color:var(--text-secondary, #6B5D52);margin:0 0 18px 0;">
            Finished studying this topic and the video masterclass? Mark it as complete to advance your roadmap progress.
          </p>
          <button onclick="markTaskFromNotes('${taskId}')" 
            style="width:100%;background:var(--accent-primary, #E8946A);color:#FFFFFF;border:none;padding:13px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(232,148,106,0.25);transition:all 200ms;"
            onmouseover="this.style.background='var(--accent-hover, #D67D52)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(232,148,106,0.35)';"
            onmouseout="this.style.background='var(--accent-primary, #E8946A)';this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(232,148,106,0.25)';"
          >Mark as Complete ✓</button>
        </div>
      </div>
    </div>
  `;

  // Escape key handler
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeCourseViewerModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(viewer);

  // 1. Load Video (YouTube)
  const videoArea = document.getElementById('viewer-video');
  searchYouTube(title).then(videos => {
    if (videos && videos.length > 0) {
      videoArea.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videos[0].id.videoId}" frameborder="0" allowfullscreen style="border:none;width:100%;height:100%;"></iframe>`;
    } else {
      const fallbackUrl = getFallbackVideoUrl(title);
      videoArea.innerHTML = `<iframe width="100%" height="100%" src="${fallbackUrl}" frameborder="0" allowfullscreen style="border:none;width:100%;height:100%;"></iframe>`;
    }
  }).catch(() => {
    const fallbackUrl = getFallbackVideoUrl(title);
    if (fallbackUrl) {
      videoArea.innerHTML = `<iframe width="100%" height="100%" src="${fallbackUrl}" frameborder="0" allowfullscreen style="border:none;width:100%;height:100%;"></iframe>`;
    } else {
      videoArea.innerHTML = `
        <div style="text-align:center;padding:20px;background:var(--bg-tertiary, #F5EDE4);width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;">
          <div style="font-size:22px;margin-bottom:6px;">▶️</div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary, #1A1512);margin-bottom:3px;">Video tutorial unavailable</div>
          <div style="font-size:11.5px;color:var(--text-secondary, #6B5D52);">Explore the study guide on the left.</div>
        </div>
      `;
    }
  });

  // 2. Generate Notes
  const prompt = `Write a deep-dive technical article for: "${title}". 
  Include:
  - Theoretical Background
  - Step-by-step Implementation Guide
  - Common Pitfalls and Best Practices
  - 3 Complex Code Examples with explanations
  - A summary "Cheat Sheet" at the end.
  
  Format in semantic HTML. Use clear headings (h2, h3), lists, and paragraphs. Return ONLY the content.`;

  const result = await callAI(prompt, 1200);
  const contentArea = document.getElementById('viewer-content');
  if (result) {
    const cleanHTML = result.replace(/```html|```/g, '').trim();
    contentArea.innerHTML = `
      <div class="viewer-card viewer-markdown">
        <h1 style="font-size:28px;font-weight:800;color:var(--text-primary, #1A1512);margin-top:0;margin-bottom:24px;border-bottom:1.5px solid var(--border, #E8DDD1);padding-bottom:16px;line-height:1.3;">${title}</h1>
        ${cleanHTML}
      </div>
    `;
  } else {
    // Fallback if AI fails: show local course notes!
    const localHTML = getLocalCourseNotes(title);
    contentArea.innerHTML = `
      <div class="viewer-card viewer-markdown">
        <h1 style="font-size:28px;font-weight:800;color:var(--text-primary, #1A1512);margin-top:0;margin-bottom:24px;border-bottom:1.5px solid var(--border, #E8DDD1);padding-bottom:16px;line-height:1.3;">${title}</h1>
        ${localHTML}
        <div style="margin-top:24px;padding:14px 16px;background:var(--accent-soft, #F3D9C4);border:1px solid var(--accent-primary, #E8946A);border-radius:10px;font-size:12.5px;color:var(--accent-hover, #D67D52);font-weight:600;display:flex;align-items:center;gap:8px;">
          <span>💡</span> Local study guide loaded. AI notes generator is currently busy.
        </div>
      </div>
    `;
  }
}

async function markTaskFromNotes(taskId) {
  try {
    closeCourseViewerModal();

    // Call existing task completion logic
    await completeTask(taskId, true);

    // Show toast
    showToast("Task marked as completed! Roadmap updated.", "success");

    // Reload dashboard stats and roadmap UI
    await loadDashboardStats();
    if (typeof loadRoadmapTab === 'function') loadRoadmapTab();
  } catch (err) {
    console.error("Error marking task complete from notes:", err);
  }
}
window.markTaskFromNotes = markTaskFromNotes;

function getLocalCourseNotes(title) {
  const t = title.toLowerCase();

  if (t.includes("swot")) {
    return `
      <h2>Introduction to Personal SWOT Analysis</h2>
      <p>A SWOT Analysis is a strategic planning tool used to identify and analyze the internal and external factors that can impact a project, business, or personal career path.</p>
      
      <h3>1. Internal Factors: Strengths & Weaknesses</h3>
      <p>Internal factors are characteristics that you have control over. They represent your current status:</p>
      <ul>
        <li><strong>Strengths (S):</strong> Capabilities, skills, advantages, certifications, and strong relationships. Examples include advanced JavaScript skills or experience in UX prototyping.</li>
        <li><strong>Weaknesses (W):</strong> Areas that require improvement, lack of resources, or skill gaps. Examples include limited experience in database design or public speaking.</li>
      </ul>
      
      <h3>2. External Factors: Opportunities & Threats</h3>
      <p>External factors are outside your direct control, arising from industry trends or environmental changes:</p>
      <ul>
        <li><strong>Opportunities (O):</strong> Emerging technologies, industry shifts, or networking channels that can accelerate your path. Examples include rising demand for React developers or college campus hiring events.</li>
        <li><strong>Threats (T):</strong> Market competition, changing tech requirements, or economic downturns. Examples include rapid shifts towards AI coding tools or high candidate competition.</li>
      </ul>
      
      <h3>3. Creating Your Personal Strategy</h3>
      <p>Once you outline your SWOT matrix, translate it into action: use your strengths to capture opportunities, mitigate weaknesses, and prepare safeguards against industry threats.</p>
    `;
  }

  if (t.includes("api") || t.includes("fetch")) {
    return `
      <h2>REST APIs & Async Fetching</h2>
      <p>Representational State Transfer (REST) is an architectural style for designing networked applications. It relies on a stateless, client-server protocol—almost always HTTP.</p>
      
      <h3>1. HTTP Methods</h3>
      <p>REST APIs use standard HTTP verbs to perform actions (often referred to as CRUD operations):</p>
      <ul>
        <li><code>GET</code>: Retrieve data from a server (e.g. fetching a user profile).</li>
        <li><code>POST</code>: Submit data to create a new resource on the server.</li>
        <li><code>PUT</code> / <code>PATCH</code>: Update an existing resource.</li>
        <li><code>DELETE</code>: Remove a resource.</li>
      </ul>
      
      <h3>2. The Fetch API in JavaScript</h3>
      <p>Modern JavaScript uses <code>fetch()</code> to make asynchronous requests. It returns a <code>Promise</code> that resolves into a Response object.</p>
      <pre><code>fetch('https://api.skillbridge.com/v1/roadmap')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));</code></pre>
      
      <h3>3. Common HTTP Status Codes</h3>
      <ul>
        <li><code>200 OK</code>: The request succeeded.</li>
        <li><code>201 Created</code>: A new resource was created successfully.</li>
        <li><code>400 Bad Request</code>: The server could not understand the request due to invalid syntax.</li>
        <li><code>401 Unauthorized</code>: Authentication is required.</li>
        <li><code>404 Not Found</code>: The server cannot find the requested resource.</li>
      </ul>
    `;
  }

  if (t.includes("react")) {
    return `
      <h2>React Functional Components & Hooks</h2>
      <p>React is a popular JavaScript library for building user interfaces, focused on components, virtual DOM representation, and reactive data flow.</p>
      
      <h3>1. Component Basics</h3>
      <p>Functional components are standard JavaScript functions that return JSX (JavaScript XML) which describes what the UI should look like.</p>
      <pre><code>function Welcome(props) {
  return &lt;h1&gt;Hello, {props.name}&lt;/h1&gt;;
}</code></pre>
      
      <h3>2. State & Props</h3>
      <ul>
        <li><strong>Props:</strong> Read-only attributes passed down from parent to child components to configure them.</li>
        <li><strong>State:</strong> Internal component data storage that triggers automatic component re-rendering when updated.</li>
      </ul>
      
      <h3>3. React hooks (useState & useEffect)</h3>
      <p>Hooks let functional components use state and other React lifecycle features.</p>
      <ul>
        <li><code>useState</code>: Declares a reactive state variable.</li>
        <li><code>useEffect</code>: Handles side effects such as data fetching, subscriptions, or manually updating the DOM.</li>
      </ul>
    `;
  }

  if (t.includes("python") || t.includes("oop") || t.includes("data structure")) {
    return `
      <h2>Python for Data Science & OOP</h2>
      <p>Python is the premier language for Data Science and Machine Learning due to its clear syntax, rich ecosystem of scientific packages, and flexible object-oriented capabilities.</p>
      
      <h3>1. Core Data Structures</h3>
      <ul>
        <li><strong>Lists:</strong> Ordered, mutable collections: <code>[1, 2, 'data', 4.5]</code>.</li>
        <li><strong>Dictionaries:</strong> Key-value hash maps with O(1) lookup time: <code>{'metric': 'accuracy', 'score': 0.94}</code>.</li>
        <li><strong>Sets:</strong> Unordered collections of unique elements with set operations (union, intersection).</li>
        <li><strong>Tuples:</strong> Immutable sequences used for fixed data structures and function return values.</li>
      </ul>
      
      <h3>2. Object-Oriented Programming (OOP) in Data Pipelines</h3>
      <pre><code>class DataTransformer:
    def __init__(self, scaler_type='standard'):
        self.scaler_type = scaler_type
        self.mean_ = None
        
    def fit_transform(self, X):
        self.mean_ = sum(X) / len(X)
        return [(x - self.mean_) for x in X]</code></pre>
      
      <h3>3. List Comprehensions & Generator Expressions</h3>
      <p>Concise idioms to filter and transform feature columns efficiently without explicit for loops:</p>
      <pre><code>scaled_features = [x * 2 for x in raw_data if x is not None]</code></pre>
    `;
  }

  if (t.includes("statistic") || t.includes("probability") || t.includes("hypothesis") || t.includes("distribution")) {
    return `
      <h2>Applied Statistics & Probability Distributions</h2>
      <p>Statistical theory provides the foundation for data validation, A/B testing, exploratory data analysis, and predictive model inference.</p>
      
      <h3>1. Descriptive vs Inferential Statistics</h3>
      <ul>
        <li><strong>Descriptive:</strong> Summarizes central tendency (Mean, Median, Mode) and dispersion (Variance, Standard Deviation, IQR).</li>
        <li><strong>Inferential:</strong> Draws conclusions about population parameters from sample data using confidence intervals and hypothesis testing.</li>
      </ul>
      
      <h3>2. Common Probability Distributions</h3>
      <ul>
        <li><strong>Gaussian (Normal):</strong> Bell-shaped curve defined by mean $\\mu$ and variance $\\sigma^2$ (governed by the Central Limit Theorem).</li>
        <li><strong>Binomial Distribution:</strong> Models the number of successes in $n$ independent Bernoulli trials.</li>
        <li><strong>Poisson Distribution:</strong> Models the probability of a given number of events happening in a fixed interval of time/space.</li>
      </ul>
      
      <h3>3. Hypothesis Testing (p-values & Significance)</h3>
      <p>Formulate Null ($H_0$) and Alternative ($H_1$) hypotheses. When $p < \\alpha$ (typically $0.05$), we reject the null hypothesis in favor of statistical significance.</p>
    `;
  }

  if (t.includes("sql") || t.includes("database") || t.includes("join") || t.includes("aggregation")) {
    return `
      <h2>SQL for Data Analysis & Analytics Engineering</h2>
      <p>SQL is the standard language for querying, transforming, and extracting structured tabular data from relational databases and cloud data warehouses.</p>
      
      <h3>1. Joins & Aggregations</h3>
      <pre><code>SELECT 
    d.department_name,
    COUNT(e.emp_id) AS total_employees,
    AVG(e.salary) AS avg_salary
FROM departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id
GROUP BY d.department_name
HAVING COUNT(e.emp_id) > 5
ORDER BY avg_salary DESC;</code></pre>
      
      <h3>2. Window Functions</h3>
      <p>Perform calculations across a set of table rows that are related to the current row without collapsing the output rows:</p>
      <pre><code>SELECT 
    user_id,
    order_date,
    amount,
    SUM(amount) OVER (PARTITION BY user_id ORDER BY order_date) AS running_total,
    RANK() OVER (ORDER BY amount DESC) AS spending_rank
FROM orders;</code></pre>
    `;
  }

  if (t.includes("pandas") || t.includes("numpy") || t.includes("wrangling") || t.includes("eda")) {
    return `
      <h2>Data Wrangling with Pandas & NumPy</h2>
      <p>Pandas and NumPy form the bedrock of data ingestion, missing value imputation, grouping, and feature transformation in Python.</p>
      
      <h3>1. Vectorized Operations with NumPy</h3>
      <pre><code>import numpy as np
arr = np.array([10, 20, 30, 40])
normalized = (arr - np.mean(arr)) / np.std(arr)</code></pre>
      
      <h3>2. Pandas DataFrame Manipulation</h3>
      <pre><code>import pandas as pd
df = pd.read_csv('dataset.csv')

# Handle missing data & filter outliers
df['age'].fillna(df['age'].median(), inplace=True)
cleaned_df = df[df['salary'] > 0].groupby('category').agg({'revenue': 'sum'})</code></pre>
    `;
  }

  if (t.includes("machine learning") || t.includes("scikit") || t.includes("regression") || t.includes("classification") || t.includes("xgboost")) {
    return `
      <h2>Supervised & Unsupervised Machine Learning</h2>
      <p>Machine Learning enables algorithmic models to learn patterns from historical training data to make predictions or cluster unlabelled observations.</p>
      
      <h3>1. Supervised Learning Pipeline (Scikit-Learn)</h3>
      <pre><code>from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
model = RandomForestClassifier(n_estimators=100, max_depth=10)
model.fit(X_train, y_train)

preds = model.predict(X_test)
print(classification_report(y_test, preds))</code></pre>
      
      <h3>2. Model Evaluation Metrics</h3>
      <ul>
        <li><strong>Classification:</strong> Precision, Recall, F1-Score, ROC-AUC curve.</li>
        <li><strong>Regression:</strong> RMSE (Root Mean Squared Error), MAE, R² score.</li>
      </ul>
    `;
  }

  if (t.includes("deep learning") || t.includes("pytorch") || t.includes("neural") || t.includes("perceptron") || t.includes("cnn") || t.includes("rnn")) {
    return `
      <h2>Neural Networks & Deep Learning Architectures</h2>
      <p>Artificial Neural Networks (ANNs) form the backbone of modern AI. They consist of layered interconnected neurons (nodes) that transform input features into high-level predictions through weighted sums, non-linear activation functions, and backpropagation.</p>
      
      <h3>1. Core Neural Network Mechanics</h3>
      <ul>
        <li><strong>Perceptron / Artificial Neuron:</strong> Computes $z = \\sum (w_i \\cdot x_i) + b$, passed through an activation function $\\sigma(z)$.</li>
        <li><strong>Activation Functions:</strong> 
          <ul>
            <li><code>ReLU (Rectified Linear Unit)</code>: $\\max(0, x)$ — standard for hidden layers to prevent vanishing gradients.</li>
            <li><code>Sigmoid</code>: $\\frac{1}{1 + e^{-x}}$ — maps outputs to $(0, 1)$ for binary classification.</li>
            <li><code>Softmax</code>: Normalizes logit vectors into probability distributions for multi-class classification.</li>
          </ul>
        </li>
        <li><strong>Loss Functions & Backpropagation:</strong> Uses gradient descent (e.g., Adam, SGD) and chain-rule calculus to update weights and minimize loss (Cross-Entropy, MSE).</li>
      </ul>

      <h3>2. PyTorch Neural Network Implementation</h3>
      <pre><code>import torch
import torch.nn as nn
import torch.optim as optim

class NeuralNetwork(nn.Module):
    def __init__(self, input_features=784, hidden_units=128, num_classes=10):
        super(NeuralNetwork, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(input_features, hidden_units),
            nn.ReLU(),
            nn.Dropout(0.25),
            nn.Linear(hidden_units, 64),
            nn.ReLU(),
            nn.Linear(64, num_classes)
        )
        
    def forward(self, x):
        return self.network(x)

# Instantiate model, loss function, and Adam optimizer
model = NeuralNetwork()
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)</code></pre>
      
      <h3>3. Key Optimization Best Practices</h3>
      <ul>
        <li><strong>Batch Normalization:</strong> Accelerates training and stabilizes deep architectures.</li>
        <li><strong>Dropout:</strong> Randomly deactivates neurons during training to prevent overfitting.</li>
        <li><strong>Learning Rate Schedulers:</strong> Decays learning rate over epochs for fine-grained convergence.</li>
      </ul>
    `;
  }

  if (t.includes("conference") || t.includes("speaking") || t.includes("communication") || t.includes("presentation") || t.includes("soft skill") || t.includes("industry event")) {
    return `
      <h2>Technical Public Speaking & Industry Presentations</h2>
      <p>Communicating complex engineering and scientific concepts at industry conferences, meetups, and team tech-talks is a superpower for accelerating career leadership and impact.</p>
      
      <h3>1. Structuring an Engaging Tech Talk</h3>
      <ul>
        <li><strong>The Hook (First 2 Mins):</strong> Clearly state the real-world problem, failure mode, or latency issue you set out to solve.</li>
        <li><strong>The Architecture & Journey:</strong> Share the trade-offs, dead-ends, and key architectural decisions that made your solution work.</li>
        <li><strong>Live Demo / Code Walkthrough:</strong> Keep code snippets concise (max 10-15 lines per slide) and highlight only key logic.</li>
        <li><strong>Actionable Takeaways:</strong> Summarize 3 key insights the audience can apply to their own repositories tomorrow.</li>
      </ul>

      <h3>2. Delivery & Presentation Best Practices</h3>
      <ul>
        <li><strong>Pacing & Vocal Variety:</strong> Speak at an intentional tempo (~130-150 wpm) and use pauses for dramatic emphasis on key statistics.</li>
        <li><strong>Handling Audience Q&A:</strong> Always repeat the question before answering. If you don't know the answer, say <em>"Great question — here's how I'd approach testing that, let's connect offline!"</em>.</li>
        <li><strong>Slide Design:</strong> Prioritize clear diagrams and high-contrast visuals over dense bulleted walls of text.</li>
      </ul>
    `;
  }

  if (t.includes("api") || t.includes("rest") || t.includes("integration") || t.includes("endpoint") || t.includes("http")) {
    return `
      <h2>RESTful API Design & Fullstack Integration</h2>
      <p>APIs (Application Programming Interfaces) bridge the communication between client applications, external services, and database backends using standardized HTTP methods and JSON payloads.</p>
      
      <h3>1. REST Architectural Principles</h3>
      <ul>
        <li><code>GET /api/resources</code>: Retrieve data (Idempotent & Safe).</li>
        <li><code>POST /api/resources</code>: Create a new resource.</li>
        <li><code>PUT /api/resources/:id</code>: Replace an entire resource.</li>
        <li><code>PATCH /api/resources/:id</code>: Partially modify specific fields.</li>
        <li><code>DELETE /api/resources/:id</code>: Remove a resource.</li>
      </ul>

      <h3>2. Production Fetch with Async/Await & Error Handling</h3>
      <pre><code>async function fetchUserProfile(userId) {
  try {
    const response = await fetch(\`/api/users/\${userId}\`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${localStorage.getItem('token')}\`
      }
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}</code></pre>
    `;
  }

  // Generic fallback topic
  return `
    <h2>Understanding ${title}</h2>
    <p>This module provides a comprehensive technical introduction to <strong>${title}</strong>, outlining key principles, methods, and practical use cases designed to build your career competency.</p>
    
    <h3>1. Core Concepts</h3>
    <p>To master this topic, focus on the underlying architecture, workflows, and standard industry tools. Review relevant guides and official documentation regularly to reinforce your foundation.</p>
    
    <h3>2. Actionable Learning Checklist</h3>
    <ul>
      <li>Read official documentation and explore sample implementations.</li>
      <li>Watch the suggested video masterclass to see practical demonstrations.</li>
      <li>Build a mini-project or solve exercises to test your hands-on mastery.</li>
      <li>Mark this checkpoint complete to advance your career roadmap.</li>
    </ul>
  `;
}

function getFallbackVideoUrl(title) {
  const t = title.toLowerCase();
  if (t.includes('neural') || t.includes('deep learning') || t.includes('perceptron') || t.includes('cnn') || t.includes('rnn')) {
    return 'https://www.youtube.com/embed/aircAruvnKk'; // 3Blue1Brown Neural Networks
  }
  if (t.includes('machine learning') || t.includes('scikit') || t.includes('regression') || t.includes('classification')) {
    return 'https://www.youtube.com/embed/i_LwzRVP7bg'; // freeCodeCamp Machine Learning
  }
  if (t.includes('generative ai') || t.includes('genai') || t.includes('llm') || t.includes('transformer') || t.includes('gpt')) {
    return 'https://www.youtube.com/embed/zjkBMFhNj_g'; // Intro to Large Language Models - Karpathy
  }
  if (t.includes('math') || t.includes('linear algebra') || t.includes('calculus')) {
    return 'https://www.youtube.com/embed/fNk_zzaMoSs'; // 3Blue1Brown Linear Algebra
  }
  if (t.includes('conference') || t.includes('speaking') || t.includes('presentation') || t.includes('communication') || t.includes('speech')) {
    return 'https://www.youtube.com/embed/i5mYphUo680'; // Julian Treasure TED Talk
  }
  if (t.includes('interview') || t.includes('resume') || t.includes('career') || t.includes('soft skill')) {
    return 'https://www.youtube.com/embed/1mHjMNZZvFo';
  }
  if (t.includes('api') || t.includes('rest') || t.includes('endpoint') || t.includes('postman')) {
    return 'https://www.youtube.com/embed/0sOvCWFmrtA'; // APIs for Beginners
  }
  if (t.includes('swot')) {
    return 'https://www.youtube.com/embed/JXXHqM-m1tU';
  }
  if (t.includes('figma')) {
    return 'https://www.youtube.com/embed/jwCmGoU2xo4';
  }
  if (t.includes('typography')) {
    return 'https://www.youtube.com/embed/sByzHoiYFX0';
  }
  if (t.includes('color theory') || t.includes('palette')) {
    return 'https://www.youtube.com/embed/GyVMoeQRL24';
  }
  if (t.includes('wireframe') || t.includes('wireframing')) {
    return 'https://www.youtube.com/embed/0gU32TszVOM';
  }
  if (t.includes('router') || t.includes('routing')) {
    return 'https://www.youtube.com/embed/c02YoWR9gSY';
  }
  if (t.includes('hooks') || t.includes('state') || t.includes('prop') || t.includes('react')) {
    return 'https://www.youtube.com/embed/Ke90Tje7VS0';
  }
  if (t.includes('django')) {
    return 'https://www.youtube.com/embed/rHux0gMZ3Eg';
  }
  if (t.includes('python')) {
    return 'https://www.youtube.com/embed/_uQrJ0TkZlc';
  }
  if (t.includes('flexbox') || t.includes('grid') || t.includes('css')) {
    return 'https://www.youtube.com/embed/3YWtZ3H1JCY';
  }
  if (t.includes('html')) {
    return 'https://www.youtube.com/embed/pQN-pnXPaVg';
  }
  if (t.includes('dsa') || t.includes('data structure') || t.includes('algorithm') || t.includes('tree') || t.includes('sort') || t.includes('search')) {
    return 'https://www.youtube.com/embed/RBSGKlAvoiM';
  }
  if (t.includes('sql') || t.includes('database') || t.includes('mongodb') || t.includes('postgres')) {
    return 'https://www.youtube.com/embed/HXV3zeQKqGY';
  }
  if (t.includes('git') || t.includes('github') || t.includes('version control')) {
    return 'https://www.youtube.com/embed/RGOj5yH7evk';
  }
  if (t.includes('system design') || t.includes('architecture')) {
    return 'https://www.youtube.com/embed/SxgOkLpbV00';
  }
  if (t.includes('node') || t.includes('express') || t.includes('backend')) {
    return 'https://www.youtube.com/embed/Oe421EPjeBE';
  }
  if (t.includes('docker') || t.includes('kubernetes') || t.includes('devops')) {
    return 'https://www.youtube.com/embed/fqMOX6JJhGo';
  }
  if (t.includes('next') || t.includes('ssr')) {
    return 'https://www.youtube.com/embed/843nec-IvW0';
  }
  if (t.includes('typescript') || t.includes('ts')) {
    return 'https://www.youtube.com/embed/d56mG7DezGs';
  }
  return 'https://www.youtube.com/embed/W6NZfCO5SIk';
}

async function searchYouTube(query) {
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)} tutorial&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`);
    if (!res.ok) throw new Error('YouTube API error status: ' + res.status);
    const data = await res.json();
    return data.items || null;
  } catch (e) {
    console.warn('YouTube API call failed, using static fallback:', e);
    return null;
  }
}

async function startQuiz(taskId, taskTitle, phase) {
  showQuizLoading();
  const prompt = `Create a quiz for a student learning: Topic: "${taskTitle}" Phase: "${phase}" Generate exactly 5 multiple choice questions. Return ONLY valid JSON: { "questions": [ { "q": "question text", "options": ["A","B","C","D"], "answer": 0, "explanation": "why this is correct" } ] } answer is 0-indexed. Make questions practical and relevant to Indian job interviews.`;
  const result = await callAI(prompt, 600);
  let quiz;
  try { const match = result?.match(/\{[\s\S]*\}/); quiz = JSON.parse(match?.[0] || '{}'); } catch (e) { quiz = getFallbackQuiz(taskTitle); }
  if (!quiz.questions?.length) quiz = getFallbackQuiz(taskTitle);
  showQuizModal(taskId, taskTitle, quiz, phase);
}

function getFallbackQuiz(topic) {
  return { questions: [{ q: `What is the primary purpose of ${topic}?`, options: ["To improve code readability", "To solve specific technical problems", "To increase application speed", "All of the above"], answer: 3, explanation: "All these are valid goals!" }, { q: `Which is a best practice in ${topic}?`, options: ["Write clean, documented code", "Avoid using version control", "Skip testing", "Hardcode all values"], answer: 0, explanation: "Clean code is always best practice" }, { q: `${topic} is commonly used in:`, options: ["Frontend development", "Backend development", "Full stack development", "All of the above"], answer: 3, explanation: "Modern dev uses all paradigms" }, { q: `What should you do after learning ${topic}?`, options: ["Build a project to practice", "Just read more theory", "Skip to next topic", "Memorize syntax only"], answer: 0, explanation: "Hands-on practice is key!" }, { q: `How do you verify your ${topic} skills?`, options: ["Build real projects", "Take interviews", "Contribute to open source", "All of the above"], answer: 3, explanation: "All help verify skills!" }] };
}

function showQuizLoading() {
  document.getElementById('quiz-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'quiz-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(5,1,13,0.95);backdrop-filter:blur(20px);z-index:10000;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;`;
  modal.innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:50px;margin-bottom:20px;animation:pulse 1.5s infinite;">🤖</div>
      <div style="font-size:18px;font-weight:700;color:#FFFFFF;margin-bottom:8px;">Generating Your Quiz...</div>
      <p style="font-size:13px;color:#94A3B8;margin:0 0 20px;">AI is creating personalized questions for you</p>
      <div class="shimmer-dark" style="height:4px;width:160px;margin:0 auto;border-radius:2px;"></div>
    </div>
  `;
  document.body.appendChild(modal);
}

function showQuizModal(taskId, title, quiz, phase) {
  document.getElementById('quiz-modal')?.remove();
  let currentQ = 0; let score = 0; let answers = [];
  const modal = document.createElement('div');
  modal.id = 'quiz-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(5,1,13,0.9);backdrop-filter:blur(20px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;font-family:'Inter',sans-serif;color:#FFFFFF;animation:viewerFadeIn 0.3s ease-out both;`;

  function renderQuestion() {
    const q = quiz.questions[currentQ];
    const progress = ((currentQ) / quiz.questions.length) * 100;
    modal.innerHTML = `
      <div style="background:#FFFFFF;border:1px solid var(--border);border-radius:24px;padding:32px;max-width:540px;width:100%;box-shadow:0 20px 60px rgba(23,40,58,0.15);backdrop-filter:blur(10px);">
        <div style="margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:8px;font-weight:600;">
            <span>QUESTION ${currentQ + 1} OF ${quiz.questions.length}</span>
            <span style="color:var(--primary-dark);">SCORE: ${score}/${currentQ}</span>
          </div>
          <div style="height:6px;background:#E7EEF2;border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${progress}%;background:var(--primary);border-radius:3px;transition:width 300ms;"></div>
          </div>
        </div>
        <div style="font-size:16px;font-weight:600;line-height:1.6;margin-bottom:24px;color:var(--navy);">${q.q}</div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">
          ${q.options.map((opt, i) => `
            <button onclick="selectAnswer(${i}, ${q.answer}, '${q.explanation.replace(/'/g, "\\'")}', this)" 
              style="text-align:left;padding:14px 18px;border-radius:12px;border:1.5px solid var(--border);background:#FFFFFF;color:var(--navy);cursor:pointer;font-size:14px;transition:all 150ms;display:flex;align-items:center;gap:12px;" 
              onmouseover="if(!this.disabled){this.style.borderColor='var(--primary)';this.style.background='var(--surface-blue)';}" 
              onmouseout="if(!this.disabled){this.style.borderColor='var(--border)';this.style.background='#FFFFFF';}"
            >
              <span style="width:28px;height:28px;border-radius:50%;background:var(--surface-blue);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;color:var(--primary-dark);">
                ${['A', 'B', 'C', 'D'][i]}
              </span>
              ${opt}
            </button>
          `).join('')}
        </div>
        <div id="explanation-area"></div>
      </div>
    `;
  }

  window.selectAnswer = function (selected, correct, explanation, btn) {
    modal.querySelectorAll('button[onclick*="selectAnswer"]').forEach(b => b.disabled = true);
    const isCorrect = selected === correct; if (isCorrect) score++;
    answers.push({ selected, correct });
    modal.querySelectorAll('button[onclick*="selectAnswer"]').forEach((b, i) => { if (i === correct) { b.style.background = '#EDF6F1'; b.style.borderColor = 'var(--success)'; b.style.color = '#4F8068'; } else if (i === selected && !isCorrect) { b.style.background = '#FAEEEE'; b.style.borderColor = 'var(--danger)'; b.style.color = '#9B5959'; } });
    const exp = document.getElementById('explanation-area');
    if (exp) { exp.innerHTML = `<div style="padding:14px 18px;border-radius:12px;background:${isCorrect ? '#EDF6F1' : '#FAEEEE'};border:1px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'};font-size:13px;color:${isCorrect ? '#4F8068' : '#9B5959'};margin-bottom:20px;line-height:1.5;">${isCorrect ? '✓ Correct! ' : '✗ Incorrect. '}${explanation}</div><button onclick="nextQuestion()" style="width:100%;background:var(--primary);color:#FFFFFF;border:none;padding:14px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(79,120,150,0.25);transition:all 200ms;" onmouseover="this.style.background='var(--primary-dark)';" onmouseout="this.style.background='var(--primary)';">${currentQ + 1 < quiz.questions.length ? 'Next Question →' : 'See Results 🏆'}</button>`; }
  };
  window.nextQuestion = function () { currentQ++; if (currentQ < quiz.questions.length) { renderQuestion(); } else { showQuizResults(taskId, score, quiz.questions.length, title, phase); } };
  renderQuestion();
  document.body.appendChild(modal);
}

window.retryQuizNotes = async function (taskTitle) {
  const notesArea = document.getElementById('quiz-results-notes');
  if (!notesArea) return;
  notesArea.innerHTML = `
    <div style="text-align:center;padding:60px 0;">
      <div class="shimmer-dark" style="height:24px;width:70%;margin:0 auto 16px;border-radius:6px;"></div>
      <div class="shimmer-dark" style="height:16px;width:40%;margin:0 auto 24px;border-radius:6px;"></div>
      <p style="color:var(--fuchsia);font-weight:600;font-size:15px;margin:0;">✨ Retrying study notes draft for ${taskTitle}...</p>
    </div>
  `;
  const notesPrompt = `Generate a comprehensive, high-fidelity study note for a student learning about the topic "${taskTitle}". 
  Provide clear headings: "Core Concepts", "Implementation Details", and "Common Pitfalls". 
  Format it beautifully in clean, readable HTML paragraphs, code blocks, lists, and bold text. Keep it focused and clear. Do not wrap in markdown quotes.`;
  const notesContent = await callAI(notesPrompt, 800);
  if (notesContent) {
    notesArea.innerHTML = `<div class="viewer-markdown">${notesContent}</div>`;
  } else {
    notesArea.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <p style="color:#EF4444;font-size:14px;">⚠️ Failed to load study notes.</p>
        <button onclick="retryQuizNotes('${taskTitle}')" style="background:var(--fuchsia);border:none;color:white;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;margin-top:10px;">Retry Generation</button>
      </div>
    `;
  }
};

async function showQuizResults(taskId, score, total, taskTitle, phase) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const pct = Math.round((score / total) * 100);
  const baseXP = 15;
  let xpEarned = baseXP;
  if (pct === 100) xpEarned = baseXP * 3; else if (pct >= 80) xpEarned = baseXP * 2; else if (pct >= 60) xpEarned = Math.round(baseXP * 1.5);
  await supabase.from('quiz_attempts').insert({ user_id: session.user.id, task_id: taskId, score, total, xp_earned: xpEarned });
  const { data: profile } = await supabase.from('profiles').select('xp, level').eq('id', session.user.id).single();
  const newXP = (profile?.xp || 0) + xpEarned; const newLevel = Math.floor(newXP / 100) + 1;
  await supabase.from('profiles').update({ xp: newXP, level: newLevel }).eq('id', session.user.id);

  // Notification for Quiz completion
  await addNotification(
    pct >= 80 ? '🎉 Quiz Passed!' : '👍 Quiz Attempted',
    `You scored ${pct}% on the quiz and earned +${xpEarned} XP.`
  );

  const levelUp = newLevel > (profile?.level || 1);
  if (levelUp) {
    await addNotification('🎊 Level Up!', `Congratulations! You leveled up to Level ${newLevel}!`);
  }

  if (pct >= 80) await completeTask(taskId, false);
  const modal = document.getElementById('quiz-modal'); if (!modal) return;

  modal.style.cssText = `position:fixed;inset:0;background:rgba(5,1,13,0.95);backdrop-filter:blur(25px);z-index:10000;display:flex;flex-direction:column;overflow-y:auto;font-family:'Inter',sans-serif;color:#FFFFFF;animation:viewerFadeIn 0.4s ease-out both;`;

  modal.innerHTML = `
    <style>
      .quiz-results-container {
        max-width: 1000px;
        margin: 0 auto;
        width: 100%;
        padding: 40px 20px;
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 32px;
      }
      @media (max-width: 768px) {
        .quiz-results-container {
          grid-template-columns: 1fr;
        }
      }
      .quiz-card {
        background: rgba(12, 5, 31, 0.65);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 24px;
        padding: 28px;
        backdrop-filter: blur(12px);
      }
    </style>

    <nav style="padding:16px 40px;background:rgba(12, 5, 31, 0.85);border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10;backdrop-filter:blur(8px);">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="background:var(--fuchsia);color:white;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;box-shadow:0 0 12px rgba(217,70,239,0.4);">SB</div>
        <div>
          <div style="font-size:12px;color:#94A3B8;font-weight:600;">QUIZ COMPLETED</div>
          <div style="font-size:16px;color:#FFFFFF;font-weight:700;">${taskTitle}</div>
        </div>
      </div>
      <button onclick="document.getElementById('quiz-modal').remove();loadTasks();" 
        style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);padding:8px 20px;border-radius:12px;font-weight:700;color:#FFFFFF;cursor:pointer;transition:all 200ms;"
        onmouseover="this.style.background='var(--fuchsia)';this.style.borderColor='var(--fuchsia)';"
        onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.borderColor='rgba(255,255,255,0.1)';"
      >Done & Exit</button>
    </nav>

    <div class="quiz-results-container">
      <!-- Left Column: Video & Study Notes -->
      <div style="display:flex;flex-direction:column;gap:24px;">
        <!-- 1. Video Tutorial -->
        <div class="quiz-card">
          <h4 style="margin:0 0 16px;font-size:14px;color:#FFFFFF;display:flex;align-items:center;gap:8px;">
            🎥 Topic Masterclass
          </h4>
          <div id="quiz-results-video" style="aspect-ratio:16/9;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#94A3B8;font-size:12px;">
            Searching for topic video tutorial...
          </div>
        </div>

        <!-- 2. AI Study Notes -->
        <div class="quiz-card" style="min-height:300px;">
          <h4 style="margin:0 0 16px;font-size:14px;color:#FFFFFF;display:flex;align-items:center;gap:8px;">
            📝 Quiz Topic Study Guide
          </h4>
          <div id="quiz-results-notes">
            <div style="text-align:center;padding:60px 0;">
              <div class="shimmer-dark" style="height:24px;width:70%;margin:0 auto 16px;border-radius:6px;"></div>
              <div class="shimmer-dark" style="height:16px;width:40%;margin:0 auto 24px;border-radius:6px;"></div>
              <p style="color:var(--fuchsia);font-weight:600;font-size:15px;margin:0;">✨ Preparing customized study notes based on this topic...</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Performance and Actions -->
      <div style="display:flex;flex-direction:column;gap:24px;">
        <!-- Score Card -->
        <div class="quiz-card" style="text-align:center;">
          <div style="width:110px;height:110px;border-radius:50%;background:${pct >= 80 ? 'linear-gradient(135deg,#059669,#34D399)' : pct >= 60 ? 'linear-gradient(135deg,#F59E0B,#FCD34D)' : 'linear-gradient(135deg,#EF4444,#FCA5A5)'};display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 8px 30px rgba(217,70,239,0.25);position:relative;border:4px solid rgba(255,255,255,0.1);">
            <div style="font-size:32px;font-weight:800;color:white;line-height:1;">${pct}%</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.8);margin-top:4px;">${score}/${total}</div>
          </div>

          <h3 style="font-size:20px;margin:0 0 8px;font-weight:700;">
            ${pct >= 80 ? '🎉 Excellent Work!' : pct >= 60 ? '👍 Good Effort!' : '💪 Keep Practicing!'}
      <div style="background:var(--surface-blue);border:1px solid var(--border-blue);border-radius:16px;padding:20px;margin-bottom:24px;">
            <div style="font-size:32px;font-weight:800;color:var(--navy);">+${xpEarned} XP</div>
            <div style="font-size:12px;color:var(--primary-dark);margin-top:6px;font-weight:600;">Total XP: ${newXP} | Level ${newLevel}</div>
            ${levelUp ? `<div style="margin-top:12px;font-size:12px;color:var(--success);font-weight:700;animation:bounce 1s infinite;">🎊 LEVEL UP! Reached Level ${newLevel}!</div>` : ''}
          </div>

          <button onclick="document.getElementById('quiz-modal').remove();loadTasks();" 
            style="width:100%;background:var(--primary);color:#FFFFFF;border:none;padding:14px;border-radius:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(79,120,150,0.25);transition:all 200ms;margin-bottom:12px;"
            onmouseover="this.style.background='var(--primary-dark)';this.style.transform='translateY(-2px)';"
            onmouseout="this.style.background='var(--primary)';this.style.transform='translateY(0)';"
          >
            ${pct >= 80 ? 'Back to Tasks ✓' : 'Back to Dashboard'}
          </button>
          
          ${pct < 80 ? `
            <button onclick="document.getElementById('quiz-modal').remove();startQuiz('${taskId}', '${taskTitle}', '${phase}');" 
              style="width:100%;background:#FFFFFF;border:1px solid var(--border);color:var(--navy);padding:14px;border-radius:12px;font-weight:700;cursor:pointer;transition:all 200ms;"
              onmouseover="this.style.background='var(--surface-blue)';"
              onmouseout="this.style.background='#FFFFFF';"
            >
              🔄 Try Quiz Again
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  loadXPDisplay();

  // Load YouTube Video
  searchYouTube(taskTitle).then(videos => {
    const videoArea = document.getElementById('quiz-results-video');
    if (videoArea) {
      if (videos && videos.length > 0) {
        videoArea.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videos[0].id.videoId}" frameborder="0" allowfullscreen style="border:none;"></iframe>`;
      } else {
        const fallbackUrl = getFallbackVideoUrl(taskTitle);
        videoArea.innerHTML = `<iframe width="100%" height="100%" src="${fallbackUrl}" frameborder="0" allowfullscreen style="border:none;"></iframe>`;
      }
    }
  }).catch(() => {
    const videoArea = document.getElementById('quiz-results-video');
    if (videoArea) {
      const fallbackUrl = getFallbackVideoUrl(taskTitle);
      videoArea.innerHTML = `<iframe width="100%" height="100%" src="${fallbackUrl}" frameborder="0" allowfullscreen style="border:none;"></iframe>`;
    }
  });

  // Load AI Study Notes
  const notesPrompt = `Generate a comprehensive, high-fidelity study note for a student learning about the topic "${taskTitle}". 
  Provide clear headings: "Core Concepts", "Implementation Details", and "Common Pitfalls". 
  Format it beautifully in clean, readable HTML paragraphs, code blocks, lists, and bold text. Keep it focused and clear. Do not wrap in markdown quotes.`;

  callAI(notesPrompt, 800).then(notesContent => {
    const notesArea = document.getElementById('quiz-results-notes');
    if (notesArea) {
      if (notesContent) {
        notesArea.innerHTML = `<div class="viewer-markdown">${notesContent}</div>`;
      } else {
        notesArea.innerHTML = `
          <div style="text-align:center;padding:20px;">
            <p style="color:#EF4444;font-size:14px;">⚠️ Failed to load study notes.</p>
            <button onclick="retryQuizNotes('${taskTitle}')" style="background:var(--fuchsia);border:none;color:white;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;margin-top:10px;">Retry Generation</button>
          </div>
        `;
      }
    }
  });
}

window.retryQuizNotes = async function (taskTitle) {
  const notesArea = document.getElementById('quiz-results-notes');
  if (!notesArea) return;
  notesArea.innerHTML = `
    <div style="text-align:center;padding:60px 0;">
      <div class="shimmer-dark" style="height:24px;width:70%;margin:0 auto 16px;border-radius:6px;"></div>
      <div class="shimmer-dark" style="height:16px;width:40%;margin:0 auto 24px;border-radius:6px;"></div>
      <p style="color:var(--fuchsia);font-weight:600;font-size:15px;margin:0;">✨ Retrying study notes draft for ${taskTitle}...</p>
    </div>
  `;
  const notesPrompt = `Generate a comprehensive, high-fidelity study note for a student learning about the topic "${taskTitle}". 
  Provide clear headings: "Core Concepts", "Implementation Details", and "Common Pitfalls". 
  Format it beautifully in clean, readable HTML paragraphs, code blocks, lists, and bold text. Keep it focused and clear. Do not wrap in markdown quotes.`;
  const notesContent = await callAI(notesPrompt, 800);
  if (notesContent) {
    notesArea.innerHTML = `<div class="viewer-markdown">${notesContent}</div>`;
  } else {
    notesArea.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <p style="color:#EF4444;font-size:14px;">⚠️ Failed to load study notes.</p>
        <button onclick="retryQuizNotes('${taskTitle}')" style="background:var(--fuchsia);border:none;color:white;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;margin-top:10px;">Retry Generation</button>
      </div>
    `;
  }
};

// ── Core dashboard features loaded via scripts/dashboard_features.js ──

async function callAI(prompt, maxTokens = 800) {
  // 1. Try Groq (Ultra-fast)
  if (GROQ_API_KEY) {
    const groqModels = ['llama3-8b-8192', 'llama3-70b-8192', 'llama-3.1-8b-instant', 'gemma2-9b-it'];
    for (const model of groqModels) {
      try {
        console.log(`[callAI] Attempting prompt with Groq model: ${model}...`);
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0.7
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            console.log(`[callAI] Success with Groq model: ${model}`);
            return content;
          }
        } else {
          const errBody = await res.json().catch(() => ({}));
          console.warn(`[callAI] Groq (${model}) returned status:`, res.status, errBody);
          if (res.status === 401 || res.status === 403) break;
          if (res.status === 404) continue; // try next model
        }
      } catch (e) {
        console.error(`[callAI] Groq (${model}) call failed:`, e);
      }
    }
  }

  // 2. Try Gemini API
  if (GEMINI_KEY) {
    const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'];
    for (const model of geminiModels) {
      try {
        console.log(`[callAI] Attempting prompt with Gemini model: ${model}...`);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: maxTokens,
              temperature: 0.7
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            console.log(`[callAI] Success with Gemini model: ${model}`);
            return content;
          }
        } else {
          const errBody = await res.json().catch(() => ({}));
          console.warn(`[callAI] Gemini (${model}) returned status:`, res.status, errBody);
          if (res.status === 400 || res.status === 403) break;
        }
      } catch (e) {
        console.error(`[callAI] Gemini (${model}) call failed:`, e);
      }
    }
  }

  // 3. Try OpenRouter as final fallback
  if (OPENROUTER_KEY) {
    const models = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-v4-flash:free',
      'openrouter/free'
    ];
    for (const model of models) {
      try {
        console.log(`[callAI] Attempting prompt with OpenRouter model: ${model}`);
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_KEY}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'SkillBridge'
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0.7
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            console.log(`[callAI] Success with OpenRouter model: ${model}`);
            return content;
          }
        } else {
          const errBody = await res.json().catch(() => ({}));
          console.warn(`[callAI] OpenRouter (${model}) returned status ${res.status}:`, errBody);
          if (res.status === 401 || res.status === 402) break;
        }
      } catch (e) {
        console.error(`[callAI] OpenRouter (${model}) failed:`, e);
      }
    }
  }

  return null;
}

// ── RESUME & PORTFOLIO FUNCTIONS ─────────────────────────────
let resumeData = {
  basics: { name: '', email: '', phone: '', location: '', summary: '' },
  experience: [],
  education: [],
  skills: [],
  projects: []
};

function switchResumeSection(sectionId, btnEl) {
  document.querySelectorAll('.resume-section-form').forEach(f => f.style.display = 'none');
  const target = document.getElementById(`resume-editor-${sectionId}`);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.resume-nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = btnEl || (window.event && (window.event.currentTarget || window.event.target)) || document.querySelector(`.resume-nav-btn[data-section="${sectionId}"]`);
  if (activeBtn && activeBtn.classList) {
    activeBtn.classList.add('active');
  }
}

function addResumeItem(type) {
  const container = document.getElementById(`${type}-list`);
  if (!container) return;
  const id = Date.now();
  const item = document.createElement('div');
  item.className = 'resume-item-card';
  item.dataset.id = id;

  if (type === 'experience') {
    item.innerHTML = `
      <div style="display:grid;gap:8px;">
        <input type="text" placeholder="Company Name" class="form-input" oninput="updateResumePreview()">
        <input type="text" placeholder="Role / Position" class="form-input" oninput="updateResumePreview()">
        <input type="text" placeholder="Years / Duration (e.g. 2023 - 2024)" class="form-input" oninput="updateResumePreview()">
        <textarea placeholder="Key contributions & achievements..." class="form-input" style="min-height:70px;resize:vertical;" oninput="updateResumePreview()"></textarea>
      </div>
      <button onclick="this.parentElement.remove();updateResumePreview()" class="remove-btn">✕</button>
    `;
  } else if (type === 'education') {
    item.innerHTML = `
      <div style="display:grid;gap:8px;">
        <input type="text" placeholder="University / College" class="form-input" oninput="updateResumePreview()">
        <input type="text" placeholder="Degree / Field of Study" class="form-input" oninput="updateResumePreview()">
        <input type="text" placeholder="Year (e.g. 2022 - 2026)" class="form-input" oninput="updateResumePreview()">
      </div>
      <button onclick="this.parentElement.remove();updateResumePreview()" class="remove-btn">✕</button>
    `;
  } else if (type === 'projects') {
    item.innerHTML = `
      <div style="display:grid;gap:8px;">
        <input type="text" placeholder="Project Name" class="form-input" oninput="updateResumePreview()">
        <textarea placeholder="Description & technologies used..." class="form-input" style="min-height:70px;resize:vertical;" oninput="updateResumePreview()"></textarea>
      </div>
      <button onclick="this.parentElement.remove();updateResumePreview()" class="remove-btn">✕</button>
    `;
  }
  container.appendChild(item);
  updateResumePreview();
}

function updateResumePreview() {
  const page = document.getElementById('resume-page');
  if (!page) return;

  const name = document.getElementById('res-name')?.value?.trim() || currentUserName || 'RISHABH SHARMA';
  const email = document.getElementById('res-email')?.value?.trim() || 'student@skillbridge.edu';
  const phone = document.getElementById('res-phone')?.value?.trim() || '+91 98765 43210';
  const location = document.getElementById('res-location')?.value?.trim() || 'Mumbai, India';
  const summary = document.getElementById('res-summary')?.value?.trim() || 'Driven and goal-oriented tech student aspiring to build scalable, high-performance solutions with modern industry practices.';
  const rawSkills = document.getElementById('res-skills-input')?.value || 'Python, SQL, Machine Learning, Data Structures, Git';
  const skills = rawSkills.split(',').map(s => s.trim()).filter(s => s);

  const expCards = Array.from(document.querySelectorAll('#experience-list .resume-item-card'));
  const eduCards = Array.from(document.querySelectorAll('#education-list .resume-item-card'));
  const projCards = Array.from(document.querySelectorAll('#projects-list .resume-item-card'));

  let html = `
    <div style="border-bottom:2px solid var(--border-strong, #D9C9B8);padding-bottom:14px;margin-bottom:16px;text-align:center;">
      <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:800;letter-spacing:1px;color:var(--text-primary, #1A1512);text-transform:uppercase;">${name}</h1>
      <div style="font-size:12px;color:var(--text-secondary, #5C4D42);display:flex;justify-content:center;flex-wrap:wrap;gap:12px;font-weight:600;">
        <span>📍 ${location}</span>
        <span>📞 ${phone}</span>
        <span>✉️ ${email}</span>
      </div>
    </div>
    
    ${summary ? `
      <div style="margin-bottom:16px;">
        <h3 style="font-size:12.5px;font-weight:800;color:var(--accent-hover, #D67D52);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1.5px solid var(--border, #E8DDD1);padding-bottom:4px;margin:0 0 6px 0;">Professional Summary</h3>
        <p style="font-size:12px;line-height:1.5;color:var(--text-primary, #1A1512);margin:0;text-align:justify;">${summary}</p>
      </div>
    ` : ''}

    ${skills.length > 0 ? `
      <div style="margin-bottom:16px;">
        <h3 style="font-size:12.5px;font-weight:800;color:var(--accent-hover, #D67D52);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1.5px solid var(--border, #E8DDD1);padding-bottom:4px;margin:0 0 6px 0;">Technical Skills</h3>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
          ${skills.map(s => `<span style="background:var(--bg-tertiary, #F5EDE4);color:var(--text-primary, #1A1512);padding:3px 9px;border-radius:6px;font-size:11.5px;font-weight:700;border:1px solid var(--border-strong, #D9C9B8);">${s}</span>`).join('')}
        </div>
      </div>
    ` : ''}

    ${expCards.length > 0 ? `
      <div style="margin-bottom:16px;">
        <h3 style="font-size:12.5px;font-weight:800;color:var(--accent-hover, #D67D52);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1.5px solid var(--border, #E8DDD1);padding-bottom:4px;margin:0 0 8px 0;">Work Experience</h3>
        ${expCards.map(card => {
    const inputs = card.querySelectorAll('input, textarea');
    const company = inputs[0]?.value || 'Company / Organization';
    const role = inputs[1]?.value || 'Role / Position';
    const years = inputs[2]?.value || '2023 - Present';
    const desc = inputs[3]?.value || '';
    return `
            <div style="margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--text-primary, #1A1512);">
                <span>${role} — <span style="font-weight:600;color:var(--text-secondary, #5C4D42);">${company}</span></span>
                <span style="color:var(--text-muted, #8C7C6F);font-size:11px;">${years}</span>
              </div>
              ${desc ? `<p style="font-size:11.5px;color:var(--text-secondary, #5C4D42);margin:3px 0 0 0;line-height:1.4;">${desc}</p>` : ''}
            </div>
          `;
  }).join('')}
      </div>
    ` : ''}

    ${projCards.length > 0 ? `
      <div style="margin-bottom:16px;">
        <h3 style="font-size:12.5px;font-weight:800;color:var(--accent-hover, #D67D52);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1.5px solid var(--border, #E8DDD1);padding-bottom:4px;margin:0 0 8px 0;">Key Projects</h3>
        ${projCards.map(card => {
    const inputs = card.querySelectorAll('input, textarea');
    const title = inputs[0]?.value || 'Project Title';
    const desc = inputs[1]?.value || '';
    return `
            <div style="margin-bottom:10px;">
              <div style="font-size:12px;font-weight:700;color:var(--text-primary, #1A1512);">🚀 ${title}</div>
              ${desc ? `<p style="font-size:11.5px;color:var(--text-secondary, #5C4D42);margin:3px 0 0 0;line-height:1.4;">${desc}</p>` : ''}
            </div>
          `;
  }).join('')}
      </div>
    ` : ''}

    ${eduCards.length > 0 ? `
      <div style="margin-bottom:12px;">
        <h3 style="font-size:12.5px;font-weight:800;color:var(--accent-hover, #D67D52);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1.5px solid var(--border, #E8DDD1);padding-bottom:4px;margin:0 0 8px 0;">Education</h3>
        ${eduCards.map(card => {
    const inputs = card.querySelectorAll('input');
    const school = inputs[0]?.value || 'University / Institution';
    const degree = inputs[1]?.value || 'Degree / Stream';
    const year = inputs[2]?.value || 'Graduation Year';
    return `
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">
              <div>
                <strong style="color:var(--text-primary, #1A1512);">${degree}</strong>
                <div style="color:var(--text-secondary, #5C4D42);font-size:11.5px;">${school}</div>
              </div>
              <span style="color:var(--text-muted, #8C7C6F);font-size:11.5px;font-weight:600;">${year}</span>
            </div>
          `;
  }).join('')}
      </div>
    ` : ''}
  `;
  page.innerHTML = html;
}

async function loadResumeTab() {
  const nameEl = document.getElementById('res-name');
  const emailEl = document.getElementById('res-email');
  const phoneEl = document.getElementById('res-phone');
  const locEl = document.getElementById('res-location');
  const sumEl = document.getElementById('res-summary');
  const skillsEl = document.getElementById('res-skills-input');

  if (nameEl && !nameEl.value) {
    if (typeof supabase !== 'undefined' && currentUserId) {
      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
        if (profile) {
          const goalText = getGoalText(profile.goal) || 'Software Developer';
          const { college, branch } = getProfileCollege(profile);
          nameEl.value = profile.full_name || currentUserName || '';
          if (emailEl && !emailEl.value) emailEl.value = profile.email || 'user@example.com';
          if (phoneEl && !phoneEl.value) phoneEl.value = '+91 98765 43210';
          if (locEl && !locEl.value) locEl.value = 'Mumbai, India';
          if (sumEl && !sumEl.value) sumEl.value = `Driven and ambitious ${goalText} with strong foundational problem-solving abilities and practical hands-on project experience.`;
          if (skillsEl && !skillsEl.value) {
            skillsEl.value = goalText.toLowerCase().includes('data')
              ? 'Python, SQL, Machine Learning, Pandas, Scikit-Learn, Git'
              : 'JavaScript, React, Node.js, HTML5, CSS3, REST APIs, Git';
          }
          const eduList = document.getElementById('education-list');
          if (eduList && eduList.children.length === 0) {
            const item = document.createElement('div');
            item.className = 'resume-item-card';
            item.innerHTML = `
              <div style="display:grid;gap:8px;">
                <input type="text" value="${college || 'IIT Bombay'}" placeholder="University / College" class="form-input" oninput="updateResumePreview()">
                <input type="text" value="${branch ? 'B.Tech in ' + branch : 'B.Tech Computer Science'}" placeholder="Degree" class="form-input" oninput="updateResumePreview()">
                <input type="text" value="2022 - 2026" placeholder="Year" class="form-input" oninput="updateResumePreview()">
              </div>
              <button onclick="this.parentElement.remove();updateResumePreview()" class="remove-btn">✕</button>
            `;
            eduList.appendChild(item);
          }
          const projList = document.getElementById('projects-list');
          if (projList && projList.children.length === 0) {
            const item = document.createElement('div');
            item.className = 'resume-item-card';
            item.innerHTML = `
              <div style="display:grid;gap:8px;">
                <input type="text" value="AI Career Recommendation System" placeholder="Project Name" class="form-input" oninput="updateResumePreview()">
                <textarea placeholder="Description..." class="form-input" style="min-height:60px;resize:vertical;" oninput="updateResumePreview()">Developed an intelligent system to evaluate user skillsets, roadmap checkpoints, and interview readiness.</textarea>
              </div>
              <button onclick="this.parentElement.remove();updateResumePreview()" class="remove-btn">✕</button>
            `;
            projList.appendChild(item);
          }
        }
      } catch (e) {
        console.warn('Error prefilling resume:', e);
      }
    }
  }
  updateResumePreview();
}

function downloadResumePDF() {
  const page = document.getElementById('resume-page');
  if (!page) return;
  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { window.print(); return; }
    const doc = new jsPDF('p', 'pt', 'a4');
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    const name = document.getElementById('res-name')?.value || 'RESUME';
    const lines = doc.splitTextToSize(page.innerText, 500);
    doc.text(lines, 40, 50);
    doc.save(`${name.replace(/\s+/g, '_')}_Resume.pdf`);
  } catch (err) { window.print(); }
}

async function generateAIResume() {
  const btn = event?.currentTarget || event?.target;
  const originalText = btn ? btn.innerHTML : '✨ AI Auto-Fill';
  if (btn) { btn.innerHTML = '✨ Generating...'; btn.disabled = true; }
  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
    const { data: tasks } = await supabase.from('tasks').select('title').eq('user_id', currentUserId).eq('status', 'completed');
    const skillsList = (tasks || []).map(t => t.title).join(', ') || 'Web Development, Problem Solving';
    const goalText = getGoalText(profile.goal);
    const prompt = `Generate a JSON object for a professional resume for: ${goalText}. User Skills: ${skillsList}. RETURN ONLY VALID JSON. Structure: name, email, phone, location, summary, skills (array), experience (array of objects), education (array), projects (array).`;
    const result = await callAI(prompt, 1200);
    if (result) {
      const data = JSON.parse(result.match(/\{[\s\S]*\}/)[0]);
      if (document.getElementById('res-name')) document.getElementById('res-name').value = data.name || '';
      if (document.getElementById('res-skills-input')) document.getElementById('res-skills-input').value = (data.skills || []).join(', ');
      updateResumePreview();
      showToast('Resume auto-filled successfully!');
    }
  } catch (err) { showToast('Failed to auto-fill resume', 'error'); } finally { if (btn) { btn.innerHTML = originalText; btn.disabled = false; } }
}

function exportJSONResume() {
  const name = document.getElementById('res-name')?.value?.trim() || currentUserName || 'Student';
  const email = document.getElementById('res-email')?.value?.trim() || '';
  const phone = document.getElementById('res-phone')?.value?.trim() || '';
  const location = document.getElementById('res-location')?.value?.trim() || '';
  const summary = document.getElementById('res-summary')?.value?.trim() || '';
  const rawSkills = document.getElementById('res-skills-input')?.value || '';
  const skills = rawSkills.split(',').map(s => s.trim()).filter(Boolean);

  const experience = Array.from(document.querySelectorAll('#experience-list .resume-item-card')).map(card => {
    const inputs = card.querySelectorAll('input, textarea');
    return {
      company: inputs[0]?.value || '',
      role: inputs[1]?.value || '',
      years: inputs[2]?.value || '',
      description: inputs[3]?.value || ''
    };
  });

  const education = Array.from(document.querySelectorAll('#education-list .resume-item-card')).map(card => {
    const inputs = card.querySelectorAll('input');
    return {
      institution: inputs[0]?.value || '',
      degree: inputs[1]?.value || '',
      year: inputs[2]?.value || ''
    };
  });

  const projects = Array.from(document.querySelectorAll('#projects-list .resume-item-card')).map(card => {
    const inputs = card.querySelectorAll('input, textarea');
    return {
      title: inputs[0]?.value || '',
      description: inputs[1]?.value || ''
    };
  });

  const json = {
    basics: { name, email, phone, location, summary },
    skills,
    experience,
    education,
    projects
  };

  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_resume.json`;
  a.click();
}

function analyzeResume(input) {
  const msg = document.getElementById('resume-suggestions');
  if (msg) msg.textContent = '🔍 Analyzing resume for keywords and ATS compatibility...';
  setTimeout(() => {
    if (msg) msg.textContent = '✅ Analysis complete: Strong focus on technical skills. Suggestion: Add more project impact metrics.';
  }, 2000);
}

window.analyzeResume = analyzeResume;

window.switchResumeSection = switchResumeSection;
window.addResumeItem = addResumeItem;
window.updateResumePreview = updateResumePreview;
window.loadResumeTab = loadResumeTab;
window.downloadResumePDF = downloadResumePDF;
window.generateAIResume = generateAIResume;
window.exportJSONResume = exportJSONResume;

async function saveProfile() {
  const goalValue = document.getElementById('edit-dreamjob')?.value || '';
  const collegeValue = document.getElementById('edit-college-name')?.value || '';
  const branchValue = document.getElementById('edit-branch')?.value || '';

  // Serialize college and branch inside the goal field
  const serializedGoal = JSON.stringify({
    goal: goalValue,
    college_name: collegeValue,
    branch: branchValue
  });

  const updates = {
    full_name: document.getElementById('edit-name')?.value,
    goal: serializedGoal
  };

  const { error } = await supabase.from('profiles').update(updates).eq('id', currentUserId);
  if (error) {
    console.error('Save profile error:', error);
    showToast('Failed to save profile', 'error');
  } else {
    showToast('Profile updated!', 'success');
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
    if (profile) updateProfileUI(profile, '');
  }
}

function changeTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  localStorage.setItem('theme', theme === 'dark' ? 'dark' : 'light');
}

// ── Task Completion ──────────────────────────────────────────
async function completeTask(taskId, refresh = true) {
  const { data: task } = await supabase.from('tasks').select('title').eq('id', taskId).single();
  await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId);
  await addNotification('✅ Task Completed', `You successfully completed the task: "${task?.title || 'a task'}".`);
  if (refresh) {
    await recalculateStats(currentUserId);
    loadTasks();
  }
}

// ── Common Logic (Unified callAI defined above) ───────────────

function updateProfileUI(p, email = '') {
  try {
    p = p || {};
    let emailStr = typeof email === 'string' ? email : '';
    let name = p.full_name || (emailStr && emailStr.includes('@') ? emailStr.split('@')[0] : '') || 'Student';
    currentUserName = name;

    const firstName = name.trim().split(' ')[0] || 'Student';
    setText('user-display-name', name);
    setText('greeting-name', firstName);
    setText('greeting-text', `Welcome back, ${firstName} 👋`);

    const goalText = typeof getGoalText === 'function' ? getGoalText(p.goal) : (p.goal || '');
    const { college, branch } = typeof getProfileCollege === 'function' ? getProfileCollege(p) : { college: '', branch: '' };

    setText('greeting-sub', goalText ? `Path: ${goalText}` : 'Track your career milestones and job readiness');
    setText('profile-initials', name.substring(0, 1).toUpperCase() || 'S');
    setText('profile-name', name);
    setText('profile-goal', goalText || 'Software Development');
    setText('profile-college', (college || '') + (branch ? ' · ' + branch : ''));

    // Update Career Track Domain & Specialization cards
    const trackInfo = typeof getCareerTrackFromGoal === 'function' ? getCareerTrackFromGoal(p.goal || goalText) : { track: 'Software Development', spec: goalText || 'Frontend Development' };
    setText('cc-hero-track', trackInfo.track);
    setText('cc-hero-spec', trackInfo.spec || goalText || trackInfo.track);

    const avatar = document.getElementById('profile-avatar');
    if (avatar) avatar.textContent = name.substring(0, 1).toUpperCase() || 'S';

    // Set edit form input values so they are visible and editable
    const editNameEl = document.getElementById('edit-name');
    if (editNameEl) editNameEl.value = p.full_name || '';
    const editCollegeEl = document.getElementById('edit-college-name');
    if (editCollegeEl) editCollegeEl.value = college || '';
    const editBranchEl = document.getElementById('edit-branch');
    if (editBranchEl) editBranchEl.value = branch || 'Computer Science';
    const editDreamjobEl = document.getElementById('edit-dreamjob');
    if (editDreamjobEl) editDreamjobEl.value = goalText || '';
  } catch (e) {
    console.error("Error in updateProfileUI:", e);
    setText('greeting-text', 'Welcome back 👋');
    setText('greeting-sub', 'Track your career milestones and job readiness');
  }
}

function getGoalText(goalField) {
  if (!goalField) return '';
  try { const parsed = JSON.parse(goalField); if (parsed && typeof parsed === 'object' && 'goal' in parsed) return parsed.goal || ''; } catch (e) { } return goalField;
}
function getProfileCollege(p) { let college = '', branch = ''; if (!p || !p.goal) return { college, branch }; try { const parsed = JSON.parse(p.goal); if (parsed && typeof parsed === 'object') { college = parsed.college_name || ''; branch = parsed.branch || ''; } } catch (e) { } return { college, branch }; }

function getCareerTrackFromGoal(goal) {
  if (!goal) return { track: "Software Development", spec: "Frontend Development" };
  let trueGoalText = goal;
  if (typeof goal === 'string' && goal.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(goal);
      if (parsed && typeof parsed === 'object' && 'goal' in parsed) {
        trueGoalText = parsed.goal || "";
      }
    } catch (e) { }
  } else if (typeof goal === 'object' && goal !== null) {
    trueGoalText = goal.goal || "";
  }
  const g = String(trueGoalText).toLowerCase();
  if (g.includes("ui") || g.includes("ux") || g.includes("design") || g.includes("product designer") || g.includes("researcher")) {
    return { track: "UI/UX & Design", spec: trueGoalText || "Product Design" };
  }
  if (g.includes("frontend") || g.includes("backend") || g.includes("full stack") || g.includes("fullstack") || g.includes("software") || g.includes("mobile") || g.includes("web dev") || g.includes("developer")) {
    return { track: "Software Development", spec: trueGoalText || "Full Stack Developer" };
  }
  if (g.includes("ai") || g.includes("machine learning") || g.includes("ml") || g.includes("data") || g.includes("science") || g.includes("analyst")) {
    if (g.includes("business") || g.includes("product")) {
      return { track: "Product & Business", spec: trueGoalText || "Business Analyst" };
    }
    return { track: "AI & Data", spec: trueGoalText || "Data Scientist" };
  }
  if (g.includes("devops") || g.includes("cloud") || g.includes("sre") || g.includes("platform") || g.includes("infrastructure")) {
    return { track: "Cloud & DevOps", spec: trueGoalText || "DevOps Engineer" };
  }
  if (g.includes("cyber") || g.includes("security") || g.includes("soc") || g.includes("appsec") || g.includes("infosec")) {
    return { track: "Cybersecurity", spec: trueGoalText || "Cybersecurity Analyst" };
  }
  if (g.includes("product manager") || g.includes("pm") || g.includes("project manager")) {
    return { track: "Product & Business", spec: trueGoalText || "Product Manager" };
  }
  return { track: "Software Development", spec: trueGoalText || "Software Development" };
}







async function loadDashboardStats() {
  if (!supabase || !currentUserId) return;

  // 1. Fetch data from Supabase
  const [profileRes, tasksRes, projectsRes, placementRes] = await Promise.all([
    supabase.from('profiles').select('goal, level, xp, roadmap_data').eq('id', currentUserId).single(),
    supabase.from('tasks').select('*').eq('user_id', currentUserId),
    supabase.from('projects').select('status').eq('user_id', currentUserId),
    supabase.from('placement_attempts').select('*').eq('user_id', currentUserId)
  ]);

  const profile = profileRes.data;
  const dbTasks = tasksRes.data || [];
  const dbProjects = projectsRes.data || [];
  const placementAttempts = placementRes.data || [];

  // 2. Compute dynamic metrics based on active AI Roadmap tasks only
  const roadmap = profile?.roadmap_data;
  const roadmapTaskTitles = new Set();
  if (roadmap && roadmap.phases) {
    roadmap.phases.forEach(phase => {
      (phase.tasks || []).forEach(task => {
        if (task.title) roadmapTaskTitles.add(task.title.toLowerCase().trim());
      });
    });
  }
  const roadmapTasks = dbTasks.filter(t => t.title && roadmapTaskTitles.has(t.title.toLowerCase().trim()));

  const completedTasks = roadmapTasks.filter(t => t.status === 'completed').length;
  const totalTasks = roadmapTasks.length || 1;
  const careerProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const completedProjects = dbProjects.filter(p => p.status === 'completed').length;

  // XP & Level
  const currentLevel = profile?.level || 1;

  // Placement/Interview progress calculations
  let resumeUploaded = false;
  let r1Passed = false;
  let r2Passed = false;
  let r3Passed = false;

  // Let's also check if there's a global placementProgress in memory
  if (typeof placementProgress !== 'undefined') {
    resumeUploaded = placementProgress.resume;
    r1Passed = placementProgress.r1;
    r2Passed = placementProgress.r2;
    r3Passed = placementProgress.r3;
  }

  // Fallback to check DB attempts if not loaded in memory
  if (placementAttempts.length > 0) {
    placementAttempts.forEach(att => {
      if (att.round === 1 && att.passed) r1Passed = true;
      if (att.round === 2 && att.passed) r2Passed = true;
      if (att.round === 3 && att.passed) r3Passed = true;
    });
    if (typeof placementProgress !== 'undefined' && placementProgress.resume) {
      resumeUploaded = true;
    }
  }

  // 3. Update Career Track Hero
  const goal = profile?.goal || "Frontend Developer";
  const { track, spec } = getCareerTrackFromGoal(goal);

  setText('cc-hero-track', track);
  setText('cc-hero-spec', spec);
  setText('cc-hero-level', `Level ${currentLevel}`);
  setText('cc-hero-skills', `${completedTasks} Skills Mastered`);
  setText('cc-hero-projects', `${completedProjects} Project${completedProjects !== 1 ? 's' : ''} Completed`);

  // Find current active phase based on tasks
  let activePhaseName = "Phase 1 • Orientation";
  let activePhaseTasks = [];
  let activePhaseIndex = 0;

  if (roadmap && roadmap.phases && roadmap.phases.length > 0) {
    let foundActive = false;
    for (let idx = 0; idx < roadmap.phases.length; idx++) {
      const phase = roadmap.phases[idx];
      const phaseTasks = dbTasks.filter(t => t.roadmap_phase === (phase.phase || phase.name));
      const phaseCompletedCount = phaseTasks.filter(t => t.status === 'completed').length;

      if (phaseTasks.length > 0 && phaseCompletedCount < phaseTasks.length && !foundActive) {
        activePhaseName = phase.phase || phase.name || `Phase ${idx + 1}`;
        activePhaseTasks = phaseTasks;
        activePhaseIndex = idx;
        foundActive = true;
      }
    }
    if (!foundActive) {
      const lastPhase = roadmap.phases[roadmap.phases.length - 1];
      activePhaseName = lastPhase.phase || lastPhase.name || "Completed";
      activePhaseIndex = roadmap.phases.length - 1;
      activePhaseTasks = dbTasks.filter(t => t.roadmap_phase === (lastPhase.phase || lastPhase.name));
    }
  }

  setText('cc-hero-phase', activePhaseName);
  setText('cc-hero-progress-label', `${careerProgress}% Career Progress`);

  const heroBar = document.getElementById('cc-hero-progress-bar');
  if (heroBar) heroBar.style.width = `${careerProgress}%`;

  // 4. Calculate Career Readiness Metrics
  const skillsScore = careerProgress;
  const projectsScore = Math.min(100, Math.round((completedProjects / 3) * 100));
  const resumeScore = resumeUploaded ? 90 : 20;

  let interviewScore = 15; // baseline
  if (r1Passed) interviewScore += 25;
  if (r2Passed) interviewScore += 25;
  if (r3Passed) interviewScore += 35;

  const readinessScore = Math.round((skillsScore + projectsScore + resumeScore + interviewScore) / 4);

  // Update Career Readiness elements in DOM
  setText('cc-readiness-val', `${readinessScore}%`);
  const fillCircle = document.getElementById('cc-readiness-fill');
  if (fillCircle) {
    const offset = 440 - (440 * readinessScore) / 100;
    fillCircle.style.strokeDashoffset = offset;
  }

  setText('cc-readiness-skills-val', `${skillsScore}%`);
  const skillsBar = document.getElementById('cc-readiness-skills-bar');
  if (skillsBar) skillsBar.style.width = `${skillsScore}%`;

  setText('cc-readiness-projects-val', `${projectsScore}%`);
  const projectsBar = document.getElementById('cc-readiness-projects-bar');
  if (projectsBar) projectsBar.style.width = `${projectsScore}%`;

  setText('cc-readiness-resume-val', `${resumeScore}%`);
  const resumeBar = document.getElementById('cc-readiness-resume-bar');
  if (resumeBar) resumeBar.style.width = `${resumeScore}%`;

  setText('cc-readiness-interview-val', `${interviewScore}%`);
  const interviewBar = document.getElementById('cc-readiness-interview-bar');
  if (interviewBar) interviewBar.style.width = `${interviewScore}%`;

  // Diagnostic message
  let diagnosticMsg = "You're making good progress. Focus on projects and interview preparation next.";
  const scores = [
    { name: 'skills', val: skillsScore, msg: "Focus on completing roadmap tasks to master core skills." },
    { name: 'projects', val: projectsScore, msg: "Focus on building more projects to boost your practical depth." },
    { name: 'resume', val: resumeScore, msg: "Focus on uploading and analyzing your resume in the Placement section." },
    { name: 'interview', val: interviewScore, msg: "Focus on mock interviews and technical preparation next." }
  ];

  scores.sort((a, b) => a.val - b.val);
  if (scores[0].val < 80) {
    diagnosticMsg = `${scores[0].msg}`;
  } else {
    diagnosticMsg = "Outstanding! You are highly prepared for job placements. Take the final interviews!";
  }
  setText('cc-readiness-message', diagnosticMsg);

  // 5. Update Next Milestone
  if (roadmap && roadmap.phases && roadmap.phases.length > 0) {
    const activePhase = roadmap.phases[activePhaseIndex];
    const phaseTasks = dbTasks.filter(t => t.roadmap_phase === (activePhase.phase || activePhase.name));
    const phaseCompleted = phaseTasks.filter(t => t.status === 'completed').length;
    const phaseTotal = phaseTasks.length || 1;
    const milestonePct = Math.round((phaseCompleted / phaseTotal) * 100);

    setText('cc-milestone-title', `Complete ${activePhase.phase || activePhase.name}`);
    setText('cc-milestone-requirements', `${phaseCompleted} / ${phaseTotal} phase requirements completed`);

    const milestoneBar = document.getElementById('cc-milestone-progress-bar');
    if (milestoneBar) milestoneBar.style.width = `${milestonePct}%`;

    const xpReward = 150 + activePhaseIndex * 50;
    setText('cc-milestone-reward', `REWARD: +${xpReward} XP`);
  } else {
    setText('cc-milestone-title', "Generate Your Career Roadmap");
    setText('cc-milestone-requirements', "No milestone active yet");
    const milestoneBar = document.getElementById('cc-milestone-progress-bar');
    if (milestoneBar) milestoneBar.style.width = "0%";
    setText('cc-milestone-reward', "REWARD: +150 XP");
  }
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
  if (typeof updateThemeIcons === 'function') {
    updateThemeIcons();
  }
}

function initInteractions() {
  document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault(); await supabase.auth.signOut(); window.location.href = 'index.html';
  });
}

function initTabs() {
  const tabs = document.querySelectorAll('[data-tab]');
  function switchTab(tabName) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (typeof r2IsListening !== 'undefined' && r2IsListening && r2Recognition) {
      r2Recognition.stop();
    }
    document.querySelectorAll('[id^="tab-"]').forEach(sec => {
      sec.style.display = 'none';
      sec.classList.remove('tab-pane-enter');
    });
    const target = document.getElementById('tab-' + tabName);
    if (target) {
      target.style.display = 'block';
      // Force reflow to trigger animation restart
      void target.offsetWidth;
      target.classList.add('tab-pane-enter');
    }
    tabs.forEach(t => { t.className = `nav-item ${t.dataset.tab === tabName ? 'active' : ''}`; });
    localStorage.setItem('activeTab', tabName);
    if (tabName === 'roadmap') loadRoadmapTab();
    if (tabName === 'resources') loadResourcesTab();
    if (tabName === 'tasks') loadTasks();
    if (tabName === 'projects') loadProjects();
    if (tabName === 'profile') loadProfile();
    if (tabName === 'placement') initPlacementTab();
    if (tabName === 'mentorship') initMentorChat();
    if (tabName === 'resume') loadResumeTab();

  }
  window.switchTab = switchTab;
  tabs.forEach(tab => tab.addEventListener('click', (e) => { e.preventDefault(); switchTab(tab.dataset.tab); }));
  switchTab(localStorage.getItem('activeTab') || 'dashboard');
}

async function loadRoadmapTab() {
  if (!supabase || !currentUserId) return;
  const status = document.getElementById('roadmap-gen-status');
  const display = document.getElementById('full-roadmap-display');

  if (status) status.style.display = 'none';
  if (display) display.style.display = 'none';

  const { data: profile } = await supabase.from('profiles').select('roadmap_data').eq('id', currentUserId).single();

  if (profile && profile.roadmap_data) {
    await renderFullRoadmap(profile.roadmap_data);
    if (display) display.style.display = 'block';
  } else {
    if (display) {
      display.innerHTML = `
        <div style="text-align:center; padding:40px; background:var(--bg-card); border-radius:14px; border:1px solid var(--border); margin-bottom:20px; backdrop-filter:blur(20px);">
          <div style="font-size:32px; margin-bottom:12px;">🗺️</div>
          <div style="font-size:16px; font-weight:600; color:#ffffff; margin-bottom:6px;">No roadmap generated yet</div>
          <p style="font-size:13px; color:var(--text-muted); max-width:320px; margin:0 auto 16px;">We will load your career goal from your profile and build your customized AI study path!</p>
          <button onclick="generateNewRoadmap()" class="btn-primary" style="padding:10px 20px; border-radius:10px;">Generate My Path 🤖</button>
        </div>
      `;
      display.style.display = 'block';
    }
  }
}

async function loadProfile() {
  const [profile, tasks, projects, certs] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', currentUserId).single(),
    supabase.from('tasks').select('status').eq('user_id', currentUserId),
    supabase.from('projects').select('status').eq('user_id', currentUserId),
    supabase.from('certificates').select('*').eq('user_id', currentUserId)
  ]);
  if (profile.data) {
    updateProfileUI(profile.data, '');
    const completedTasks = tasks.data?.filter(t => t.status === 'completed').length || 0;
    const completedProjects = projects.data?.filter(p => p.status === 'completed').length || 0;
    const certsCount = certs.data?.length || 0;
    setText('p-tasks', completedTasks);
    setText('p-projects', completedProjects);
    setText('p-certs', certsCount);
  }
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function showToast(msg, type = 'success') {
  console.log('Toast:', msg, type);

  // Trigger HTML5 notification if granted
  if (Notification.permission === 'granted') {
    try {
      new Notification('SkillBridge', { body: msg });
    } catch (e) {
      console.warn('Native notification failed:', e);
    }
  }

  // Find or create toast container
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 99999;
      pointer-events: none;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    `;
    document.body.appendChild(container);
  }

  // Create toast card
  const toast = document.createElement('div');
  toast.style.cssText = `
    min-width: 320px;
    max-width: 420px;
    border-radius: 12px;
    padding: 16px 20px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    display: flex;
    align-items: center;
    gap: 12px;
    pointer-events: auto;
    transform: translateX(50px);
    opacity: 0;
    transition: all 400ms cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  `;

  // Type customization
  let accentColor = '#10B981';
  let color = '#065F46'; // success dark text
  let bg = 'rgba(240, 253, 244, 0.9)'; // success soft bg
  let border = '1px solid rgba(16, 185, 129, 0.2)'; // success border
  let icon = '✓';

  const lowerType = String(type).toLowerCase();
  if (lowerType === 'error' || lowerType === 'danger' || lowerType === 'failed') {
    accentColor = '#EF4444';
    color = '#991B1B';
    bg = 'rgba(254, 242, 242, 0.9)';
    border = '1px solid rgba(239, 68, 68, 0.2)';
    icon = '✕';
  } else if (lowerType === 'info') {
    accentColor = '#0EA5E9';
    color = '#075985';
    bg = 'rgba(240, 249, 255, 0.9)';
    border = '1px solid rgba(14, 165, 233, 0.2)';
    icon = 'ℹ️';
  } else if (lowerType === 'warning') {
    accentColor = '#F59E0B';
    color = '#92400E';
    bg = 'rgba(255, 251, 235, 0.9)';
    border = '1px solid rgba(245, 158, 11, 0.2)';
    icon = '⚠️';
  }

  toast.style.background = bg;
  toast.style.border = border;
  toast.style.borderLeft = `4px solid ${accentColor}`;
  toast.style.color = color;

  // Inside Toast content with structured, micro-animated nodes
  toast.innerHTML = `
    <div style="width: 28px; height: 28px; border-radius: 50%; background: ${accentColor}20; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; color: ${accentColor}; flex-shrink: 0;">
      ${icon}
    </div>
    <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
      <span style="font-size: 13px; font-weight: 600; line-height: 1.4;">${msg}</span>
    </div>
    <button style="background: none; border: none; color: inherit; opacity: 0.5; cursor: pointer; font-size: 14px; padding: 4px; margin-left: 8px; line-height: 1; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: all 200ms;" 
      onmouseover="this.style.opacity='1'; this.style.background='${accentColor}15';" 
      onmouseout="this.style.opacity='0.5'; this.style.background='none';" 
      onclick="this.parentElement.style.opacity='0'; this.parentElement.style.transform='translateX(50px) scale(0.95)'; setTimeout(() => { this.parentElement.remove(); }, 350);">✕</button>
  `;

  container.appendChild(toast);

  // Trigger smooth enter animation
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  // Auto-dismiss after 4.5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.transform = 'translateX(50px) scale(0.95)';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 350);
    }
  }, 4500);
}
function showTyping() { const chat = document.getElementById('chat-messages'); const typing = document.createElement('div'); typing.id = 'typing-indicator'; typing.style.cssText = 'padding:12px 16px; background:rgba(255,255,255,0.06); border-radius:16px; width:fit-content; margin-bottom:8px; display:flex; gap:4px;'; typing.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>'; chat.appendChild(typing); chat.scrollTop = chat.scrollHeight; }
function hideTyping() { document.getElementById('typing-indicator')?.remove(); }

async function searchYouTube(query) {
  if (!query) { const { data } = await supabase.from('profiles').select('goal').eq('id', currentUserId).single(); query = (getGoalText(data?.goal) || 'Programming') + ' tutorial for beginners'; }
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=6&relevanceLanguage=en&key=${YOUTUBE_API_KEY}`);
  const data = await res.json();
  const container = document.getElementById('youtube-results');
  if (container && data.items) container.innerHTML = data.items.map(item => `<div style="border:0.5px solid var(--color-border); border-radius:12px; overflow:hidden; cursor:pointer; background:white;" onclick="window.open('https://youtube.com/watch?v=${item.id.videoId}', '_blank')"><img src="${item.snippet.thumbnails.medium.url}" style="width:100%; aspect-ratio:16/9; object-fit:cover;"><div style="padding:12px;"><div style="font-weight:600; font-size:13px; margin-bottom:6px; color:#0F172A;">${item.snippet.title.substring(0, 60)}...</div><div style="font-size:11px; color:#64748B;">${item.snippet.channelTitle}</div></div></div>`).join('');
}

async function recordTodayLogin(userId) { const today = new Date().toISOString().split('T')[0]; await supabase.from('user_activity').upsert({ user_id: userId, activity_date: today }, { onConflict: 'user_id,activity_date' }); }
async function updateStreakDisplay(userId) { const streak = await calculateStreak(userId); const navStreak = document.getElementById('streak-badge'); if (navStreak) navStreak.innerHTML = '🔥 ' + streak + ' Day Streak'; }
async function calculateStreak(userId) { const { data } = await supabase.from('user_activity').select('activity_date').eq('user_id', userId).order('activity_date', { ascending: false }); if (!data || data.length === 0) return 0; const todayStr = new Date().toISOString().split('T')[0]; const latestDate = data[0].activity_date; const dayDiff = Math.floor((new Date(todayStr) - new Date(latestDate)) / 86400000); if (dayDiff > 1) return 0; let streak = 0; const dateSet = new Set(data.map(d => d.activity_date)); let checkDate = new Date(latestDate); while (true) { const ds = checkDate.toISOString().split('T')[0]; if (dateSet.has(ds)) { streak++; checkDate.setDate(checkDate.getDate() - 1); } else break; } return streak; }


function getDomainRoadmapTemplate(goal) {
  const g = String(goal || '').toLowerCase();
  
  if (g.includes('data') || g.includes('ai') || g.includes('machine learning') || g.includes('ml') || g.includes('analyst') || g.includes('scientist')) {
    return {
      title: "Data Scientist Roadmap",
      totalWeeks: 16,
      jobReadinessTarget: "4 months",
      phases: [
        {
          phase: "Phase 1 • Python & Applied Statistics",
          name: "Phase 1 • Python & Applied Statistics",
          description: "Master Python programming fundamentals, data structures, and core statistical foundations required for data modeling.",
          weeks: "Week 1-4",
          skills: ["Python", "Statistics", "SQL", "Probability"],
          project: "Exploratory Financial Market Data Analysis",
          status: "current",
          tasks: [
            { title: "Python for Data Analysis: Data Structures & OOP", difficulty: "Easy", resource: "https://docs.python.org/3/tutorial/" },
            { title: "Descriptive & Inferential Statistics", difficulty: "Easy", resource: "https://www.khanacademy.org/math/statistics-probability" },
            { title: "Probability Distributions & Hypothesis Testing", difficulty: "Medium", resource: "https://online.stat.psu.edu/stat500/" },
            { title: "SQL Mastery: Complex Joins, Aggregations & Window Functions", difficulty: "Medium", resource: "https://mode.com/sql-tutorial/" }
          ]
        },
        {
          phase: "Phase 2 • Data Wrangling & Feature Engineering",
          name: "Phase 2 • Data Wrangling & Feature Engineering",
          description: "Clean, manipulate, and explore real-world datasets with NumPy and Pandas, and engineer predictive features.",
          weeks: "Week 5-8",
          skills: ["Pandas", "NumPy", "EDA", "Feature Engineering"],
          project: "Customer Churn Prediction & Feature Pipeline",
          status: "locked",
          tasks: [
            { title: "Advanced Pandas: Data Cleaning & Transformations", difficulty: "Medium", resource: "https://pandas.pydata.org/docs/user_guide/" },
            { title: "Matrix Computations & Vectorization with NumPy", difficulty: "Medium", resource: "https://numpy.org/doc/stable/user/absolute_beginners.html" },
            { title: "Exploratory Data Analysis with Matplotlib & Seaborn", difficulty: "Medium", resource: "https://seaborn.pydata.org/tutorial.html" },
            { title: "Feature Engineering & Dimensionality Reduction (PCA)", difficulty: "Hard", resource: "https://scikit-learn.org/stable/modules/preprocessing.html" }
          ]
        },
        {
          phase: "Phase 3 • Machine Learning Algorithms",
          name: "Phase 3 • Machine Learning Algorithms",
          description: "Implement supervised and unsupervised machine learning algorithms using Scikit-Learn with rigorous model validation.",
          weeks: "Week 9-12",
          skills: ["Scikit-Learn", "XGBoost", "Clustering", "Model Evaluation"],
          project: "End-to-End Housing Price ML Predictor",
          status: "locked",
          tasks: [
            { title: "Supervised Learning: Regression & Classification", difficulty: "Medium", resource: "https://scikit-learn.org/stable/supervised_learning.html" },
            { title: "Ensemble Methods: Random Forests & XGBoost", difficulty: "Hard", resource: "https://xgboost.readthedocs.io/en/stable/" },
            { title: "Unsupervised Learning: K-Means & Hierarchical Clustering", difficulty: "Medium", resource: "https://scikit-learn.org/stable/modules/clustering.html" },
            { title: "Model Evaluation Metrics, ROC-AUC & Cross-Validation", difficulty: "Hard", resource: "https://scikit-learn.org/stable/modules/model_evaluation.html" }
          ]
        },
        {
          phase: "Phase 4 • Deep Learning, NLP & MLOps Deployment",
          name: "Phase 4 • Deep Learning, NLP & MLOps Deployment",
          description: "Build neural network architectures, apply transformer models, and deploy production machine learning inference APIs.",
          weeks: "Week 13-16",
          skills: ["PyTorch", "Transformers", "FastAPI", "MLOps"],
          project: "Production AI Sentiment Analysis API with PyTorch",
          status: "locked",
          tasks: [
            { title: "Neural Networks & PyTorch Fundamentals", difficulty: "Hard", resource: "https://pytorch.org/tutorials/beginner/basics/intro.html" },
            { title: "Natural Language Processing with Transformers & HuggingFace", difficulty: "Hard", resource: "https://huggingface.co/docs/transformers/index" },
            { title: "ML Model Deployment with FastAPI & Docker", difficulty: "Hard", resource: "https://fastapi.tiangolo.com/tutorial/" },
            { title: "MLOps: Experiment Tracking with MLflow & CI/CD", difficulty: "Hard", resource: "https://mlflow.org/docs/latest/index.html" }
          ]
        }
      ]
    };
  }

  if (g.includes('design') || g.includes('ui') || g.includes('ux') || g.includes('product designer')) {
    return {
      title: "UI/UX & Product Design Roadmap",
      totalWeeks: 16,
      jobReadinessTarget: "4 months",
      phases: [
        {
          phase: "Phase 1 • Design Fundamentals & Figma",
          name: "Phase 1 • Design Fundamentals & Figma",
          description: "Master visual hierarchy, typography, color theory, and Figma component architecture.",
          weeks: "Week 1-4",
          skills: ["Figma", "Auto-Layout", "Design Tokens", "Typography"],
          project: "Comprehensive Design System & UI Kit in Figma",
          status: "current",
          tasks: [
            { title: "Color Theory, Typography & Spacing Systems", difficulty: "Easy", resource: "https://www.figma.com/resource-library/" },
            { title: "Figma Components, Auto-Layout & Design Tokens", difficulty: "Medium", resource: "https://help.figma.com/hc/en-us/articles/360040451373" },
            { title: "Wireframing & Information Architecture", difficulty: "Easy", resource: "https://www.interaction-design.org/literature/topics/wireframing" },
            { title: "WCAG AA Accessibility Standards & Usability Heuristics", difficulty: "Medium", resource: "https://www.w3.org/WAI/standards-guidelines/wcag/" }
          ]
        },
        {
          phase: "Phase 2 • User Research & Interaction Design",
          name: "Phase 2 • User Research & Interaction Design",
          description: "Conduct user discovery interviews, craft personas, and build interactive high-fidelity prototypes.",
          weeks: "Week 5-8",
          skills: ["User Research", "Journey Maps", "Prototyping", "User Testing"],
          project: "End-to-End Fintech Mobile App UX Case Study",
          status: "locked",
          tasks: [
            { title: "User Persona Creation & Journey Mapping", difficulty: "Medium", resource: "https://www.nngroup.com/articles/customer-journey-mapping/" },
            { title: "Interactive High-Fidelity Prototyping & Smart Animate", difficulty: "Medium", resource: "https://help.figma.com/hc/en-us/articles/360040314193" },
            { title: "Usability Testing & Feedback Synthesis", difficulty: "Medium", resource: "https://www.nngroup.com/articles/usability-testing-101/" },
            { title: "Mobile-First Responsive Interface Patterns", difficulty: "Medium", resource: "https://material.io/design" }
          ]
        },
        {
          phase: "Phase 3 • Advanced Product Strategy & Handoff",
          name: "Phase 3 • Advanced Product Strategy & Handoff",
          description: "Design multi-brand design systems, micro-interactions, and developer handoff documentation.",
          weeks: "Week 9-12",
          skills: ["Design Systems", "Motion Design", "Data-Driven UX", "Handoff"],
          project: "Enterprise SaaS Analytics Suite Case Study",
          status: "locked",
          tasks: [
            { title: "Multi-Brand Design Tokens & Governance", difficulty: "Hard", resource: "https://designsystemsrepo.com/" },
            { title: "Micro-Interactions & Motion Design in Prototyping", difficulty: "Hard", resource: "https://www.interaction-design.org/literature/topics/micro-interactions" },
            { title: "Data-Driven Design & A/B Testing Analytics", difficulty: "Hard", resource: "https://www.optimizely.com/optimization-glossary/ab-testing/" },
            { title: "Developer Handoff & Design QA Workflows", difficulty: "Medium", resource: "https://help.figma.com/hc/en-us/articles/1500004362141" }
          ]
        }
      ]
    };
  }

  // Default Software Development / Frontend / Full Stack
  return {
    title: "Software Development Roadmap",
    totalWeeks: 16,
    jobReadinessTarget: "4 months",
    phases: [
      {
        phase: "Phase 1 • Modern JavaScript & Web Architecture",
        name: "Phase 1 • Modern JavaScript & Web Architecture",
        description: "Master modern ES6+ JavaScript, asynchronous workflows, DOM manipulation, and responsive web layouts.",
        weeks: "Week 1-4",
        skills: ["JavaScript", "Async/Await", "DOM", "CSS Grid"],
        project: "Interactive Portfolio & Task Engine",
        status: "current",
        tasks: [
          { title: "Modern JavaScript (ES6+), Closures & Prototypes", difficulty: "Easy", resource: "https://javascript.info/" },
          { title: "DOM Manipulation & Async Event Loop", difficulty: "Easy", resource: "https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model" },
          { title: "Fetch API, REST Endpoints & Error Handling", difficulty: "Medium", resource: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API" },
          { title: "Responsive CSS Grid & Flexbox Layouts", difficulty: "Easy", resource: "https://css-tricks.com/snippets/css/complete-guide-grid/" }
        ]
      },
      {
        phase: "Phase 2 • React Ecosystem & State Management",
        name: "Phase 2 • React Ecosystem & State Management",
        description: "Build robust single-page applications with React functional components, hooks, routing, and global state.",
        weeks: "Week 5-8",
        skills: ["React", "Custom Hooks", "Redux", "API Integration"],
        project: "Full-Featured SaaS Dashboard Application",
        status: "locked",
        tasks: [
          { title: "React Functional Components & Custom Hooks", difficulty: "Medium", resource: "https://react.dev/learn" },
          { title: "Global State Management with Redux Toolkit / Zustand", difficulty: "Medium", resource: "https://redux-toolkit.js.org/" },
          { title: "React Router & Protected Route Navigation", difficulty: "Medium", resource: "https://reactrouter.com/" },
          { title: "Consuming REST & GraphQL APIs in React", difficulty: "Medium", resource: "https://react.dev/learn/synchronizing-with-effects" }
        ]
      },
      {
        phase: "Phase 3 • Backend Services & Database Design",
        name: "Phase 3 • Backend Services & Database Design",
        description: "Design and implement REST APIs, database schemas, authentication, and secure server-side logic.",
        weeks: "Week 9-12",
        skills: ["Node.js", "PostgreSQL", "Next.js", "JWT Auth"],
        project: "Multi-User E-Commerce Platform with Auth & Payments",
        status: "locked",
        tasks: [
          { title: "Node.js & Express.js REST API Architecture", difficulty: "Medium", resource: "https://expressjs.com/" },
          { title: "Relational & NoSQL Database Schema Design (PostgreSQL / MongoDB)", difficulty: "Hard", resource: "https://www.postgresql.org/docs/" },
          { title: "JWT Authentication, Authorization & Security Best Practices", difficulty: "Hard", resource: "https://jwt.io/introduction" },
          { title: "Server-Side Rendering with Next.js App Router", difficulty: "Hard", resource: "https://nextjs.org/docs" }
        ]
      },
      {
        phase: "Phase 4 • Testing, Performance & Cloud Deployment",
        name: "Phase 4 • Testing, Performance & Cloud Deployment",
        description: "Write unit and integration test suites, containerize applications, and automate deployment pipelines.",
        weeks: "Week 13-16",
        skills: ["Docker", "CI/CD", "Testing", "Performance"],
        project: "Production Microservice Web App with Automated CI/CD",
        status: "locked",
        tasks: [
          { title: "Unit & Integration Testing with Jest & RTL", difficulty: "Hard", resource: "https://jestjs.io/" },
          { title: "Frontend Performance Optimization & Web Vitals", difficulty: "Hard", resource: "https://web.dev/vitals/" },
          { title: "Docker Containerization & Microservices Basics", difficulty: "Hard", resource: "https://docs.docker.com/" },
          { title: "CI/CD Deployment Pipelines with GitHub Actions & AWS/Vercel", difficulty: "Hard", resource: "https://docs.github.com/en/actions" }
        ]
      }
    ]
  };
}

function getSmartFallback(goal) {
  return getDomainRoadmapTemplate(goal);
}

async function resetUserProgressAndRegenerate(targetGoal) {
  if (!supabase) initSupabase();
  if (!supabase) return;
  
  if (!currentUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUserId = session.user.id;
      window.currentUserId = session.user.id;
    } else {
      window.location.href = 'auth.html';
      return;
    }
  }

  // 1. Fetch current profile goal or use provided targetGoal
  let goal = targetGoal;
  if (!goal) {
    const { data: p } = await supabase.from('profiles').select('goal').eq('id', currentUserId).single();
    goal = getGoalText(p?.goal) || 'Data Scientist';
  }

  showToast(`Regenerating ${goal} roadmap and resetting progress...`, 'info');

  // 2. Generate or obtain domain-specific technical roadmap
  let roadmap = getDomainRoadmapTemplate(goal);

  // Try calling AI for fresh custom roadmap if possible
  try {
    const prompt = `You are a Principal Technical Director. Create a strictly technical, 4-phase learning roadmap for: "${goal}".
    CRITICAL:
    - ONLY technical, domain-specific programming, algorithmic, mathematical, and engineering milestones.
    - NO generic orientation, soft skills, or SWOT analysis.
    - Each phase must contain 4 specific technical tasks with realistic difficulty levels (Easy/Medium/Hard) and 1 practical capstone project.
    
    Return ONLY valid JSON matching:
    {"title":"${goal} Roadmap","totalWeeks":16,"jobReadinessTarget":"4 months","phases":[{"phase":"Phase 1 • Title","name":"Phase 1 • Title","description":"Description","weeks":"Week 1-4","skills":["Skill1","Skill2","Skill3","Skill4"],"project":"Project Title","status":"current","tasks":[{"title":"Task Title","difficulty":"Easy","resource":"https://developer.mozilla.org"}]}]}`;
    
    const aiRes = await callAI(prompt, 1800);
    if (aiRes) {
      const match = aiRes.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.phases && parsed.phases.length >= 3) {
          roadmap = parsed;
        }
      }
    }
  } catch (e) {
    console.warn("AI generation fallback to domain template:", e);
  }

  // 3. Reset database records
  // Clear old tasks & insert new technical tasks
  await supabase.from('tasks').delete().eq('user_id', currentUserId);
  const tasksToInsert = [];
  if (roadmap.phases) {
    roadmap.phases.forEach((phase, pIdx) => {
      (phase.tasks || []).forEach(task => {
        tasksToInsert.push({
          user_id: currentUserId,
          title: task.title,
          difficulty: task.difficulty || 'Medium',
          resource_link: task.resource || '',
          roadmap_phase: phase.phase || phase.name,
          status: pIdx === 0 ? 'pending' : 'locked'
        });
      });
    });
  }
  if (tasksToInsert.length > 0) {
    await supabase.from('tasks').insert(tasksToInsert);
  }

  // Clear old projects & insert domain projects
  await supabase.from('projects').delete().eq('user_id', currentUserId);
  if (roadmap.phases) {
    const projectsToInsert = roadmap.phases.map(p => ({
      user_id: currentUserId,
      name: p.project || 'Domain Capstone Project',
      description: p.description || `Final project for ${p.phase}`,
      status: 'Upcoming',
      progress: 0,
      roadmap_phase: p.phase || p.name,
      tags: p.skills || []
    }));
    if (projectsToInsert.length > 0) {
      await supabase.from('projects').insert(projectsToInsert);
    }
  }

  // Clear placement attempts and reset placement progress
  await supabase.from('placement_attempts').delete().eq('user_id', currentUserId);
  if (typeof placementProgress !== 'undefined') {
    placementProgress.resume = false;
    placementProgress.r1 = false;
    placementProgress.r2 = false;
    placementProgress.r3 = false;
    placementProgress.r1Score = 0;
    placementProgress.r2Score = 0;
    placementProgress.r3Score = 0;
  }

  // Update profile with 0% progress and clean history
  await supabase.from('profiles').update({
    goal: goal,
    roadmap_data: roadmap,
    progress_percent: 0,
    skills_learned: 0,
    level: 1,
    xp: 0,
    session_history: [],
    notifications: [],
    onboarding_completed: true
  }).eq('id', currentUserId);

  // 4. Reload all views and UI
  const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
  if (updatedProfile) {
    updateProfileUI(updatedProfile, '');
    if (typeof initDashboard === 'function') await initDashboard(updatedProfile);
    if (typeof loadDashboardStats === 'function') await loadDashboardStats();
    if (typeof loadRoadmapTab === 'function') await loadRoadmapTab();
    if (typeof loadQuickTestTab === 'function') await loadQuickTestTab();
    if (typeof initPlacementTab === 'function') await initPlacementTab();
  }

  showToast(`🎉 ${goal} roadmap & technical modules successfully regenerated! Progress reset to 0%.`, 'success');
}
window.resetUserProgressAndRegenerate = resetUserProgressAndRegenerate;
window.getDomainRoadmapTemplate = getDomainRoadmapTemplate;

const style = document.createElement('style');
style.textContent = `
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } 
  .dot { width: 6px; height: 6px; background: #94A3B8; border-radius: 50%; animation: typing 1s infinite; } 
  .dot:nth-child(2) { animation-delay: 0.2s; } 
  .dot:nth-child(3) { animation-delay: 0.4s; } 
  @keyframes typing { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  .placement-card { background:white; border-radius:16px; border:1px solid #E2E8F0; padding:24px; margin-bottom:20px; transition: all 300ms; }
  .placement-card.locked { opacity: 0.7; filter: grayscale(1); cursor: not-allowed; }
  .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .status-passed { background: #D1FAE5; color: #059669; }
  .status-pending { background: #FEF3C7; color: #D97706; }
  .status-locked { background: #F1F5F9; color: #64748B; }
`;
document.head.appendChild(style);

// ── Global placement state ───────────────
let placementResumeText = '';
let selectedCompanyType = 'Product (FAANG)';
let placementProgress = {
  resume: false,
  r1: false,
  r2: false,
  r3: false,
  r1Score: 0,
  r2Score: 0,
  r3Score: 0
};

// ── Placement Question Bank & Coding Problems ─────────────────
const PLACEMENT_QUESTIONS = {
  aptitude: [
    {
      id: "apt_1",
      question: "A train running at the speed of 60 km/hr crosses a pole in 9 seconds. What is the length of the train?",
      options: ["120 metres", "150 metres", "324 metres", "180 metres"],
      correct: 1,
      explanation: "Speed = 60 * 5/18 = 50/3 m/s. Length = Speed * Time = 50/3 * 9 = 150 metres."
    },
    {
      id: "apt_2",
      question: "Find the missing number in the sequence: 3, 5, 9, 17, 33, ?",
      options: ["49", "60", "65", "51"],
      correct: 2,
      explanation: "The difference between consecutive terms doubles each time: +2, +4, +8, +16, and the next is +32. 33 + 32 = 65."
    },
    {
      id: "apt_3",
      question: "Choose the word that is most nearly opposite in meaning to 'OBSTINATE'.",
      options: ["Stubborn", "Flexible", "Rigid", "Dogmatic"],
      correct: 1,
      explanation: "'Obstinate' means stubborn or refusing to change; its opposite is flexible or yielding."
    },
    {
      id: "apt_4",
      question: "If a family budget is Rs. 50,000, and 25% is spent on rent, 20% on food, 15% on education, and the rest is saved, how much money is saved?",
      options: ["Rs. 20,000", "Rs. 15,000", "Rs. 25,000", "Rs. 10,000"],
      correct: 0,
      explanation: "Percentage spent = 25% + 20% + 15% = 60%. Saved = 100% - 60% = 40%. 40% of 50,000 = Rs. 20,000."
    },
    {
      id: "apt_5",
      question: "If BLUE is coded as 2-12-21-5, how is RED coded?",
      options: ["18-5-4", "19-6-5", "18-4-5", "17-5-4"],
      correct: 0,
      explanation: "Each letter is represented by its alphabetical index: B=2, L=12, U=21, E=5. For RED: R=18, E=5, D=4."
    }
  ],
  software: [
    {
      id: "sw_1",
      question: "Which of the following is NOT a JavaScript primitive data type?",
      options: ["String", "Number", "Array", "Symbol"],
      correct: 2,
      explanation: "JavaScript primitives include String, Number, Boolean, Undefined, Null, BigInt, and Symbol. Arrays are Objects."
    },
    {
      id: "sw_2",
      question: "What is encapsulation in Object-Oriented Programming?",
      options: [
        "Creating a subclass from a parent class",
        "Restricting direct access to some of an object's components",
        "The ability to process objects differently based on their data type",
        "Defining multiple methods with the same name but different parameters"
      ],
      correct: 1,
      explanation: "Encapsulation binds data and code together, restricting direct outer access through visibility modifiers (e.g. private)."
    },
    {
      id: "sw_3",
      question: "Which SQL command is used to add a new column to an existing table?",
      options: ["UPDATE TABLE", "INSERT COLUMN", "ALTER TABLE", "ADD COLUMN"],
      correct: 2,
      explanation: "The ALTER TABLE command is used to add, delete, or modify columns in an existing table structure."
    },
    {
      id: "sw_4",
      question: "What is the purpose of 'git stash'?",
      options: [
        "Delete local untracked files",
        "Push changes to a remote repository",
        "Temporarily shelves changes to work on a clean directory",
        "Merge another branch into the current one"
      ],
      correct: 2,
      explanation: "git stash saves your local modifications away and reverts the working directory to match the HEAD commit."
    },
    {
      id: "sw_5",
      question: "Which layer of the OSI model is responsible for routing data packets across networks?",
      options: ["Physical Layer", "Transport Layer", "Network Layer", "Application Layer"],
      correct: 2,
      explanation: "The Network Layer manages logical addressing (IP) and determines paths/routing for packets."
    },
    {
      id: "sw_6",
      question: "Which HTTP status code represents a successful resource creation (e.g. from a POST request)?",
      options: ["200 OK", "201 Created", "204 No Content", "400 Bad Request"],
      correct: 1,
      explanation: "The HTTP 201 Created status code indicates that the request has been fulfilled and has resulted in one or more new resources being created."
    }
  ],
  data: [
    {
      id: "ai_1",
      question: "In Python, which list method adds an element to the end of a list?",
      options: ["add()", "insert()", "append()", "push()"],
      correct: 2,
      explanation: "The list.append(x) method adds an item to the absolute end of the list in Python."
    },
    {
      id: "ai_2",
      question: "Which machine learning algorithm is commonly used for classification based on feature proximity voting?",
      options: ["Linear Regression", "K-Means", "KNN (K-Nearest Neighbors)", "Random Forest"],
      correct: 2,
      explanation: "KNN classifies objects based on the closest training examples in the feature space by majority vote."
    },
    {
      id: "ai_3",
      question: "What is the median of the following dataset: [3, 9, 4, 7, 5]?",
      options: ["4", "5", "7", "5.6"],
      correct: 1,
      explanation: "Sorted dataset: [3, 4, 5, 7, 9]. The middle term is 5."
    },
    {
      id: "ai_4",
      question: "Which SQL function is used to return the number of rows that match a specified criterion?",
      options: ["SUM()", "COUNT()", "TOTAL()", "AVG()"],
      correct: 1,
      explanation: "The COUNT() function returns the number of rows that match a specified criteria in a SELECT statement."
    },
    {
      id: "ai_5",
      question: "A fair six-sided die is rolled. What is the probability of rolling an even number?",
      options: ["1/3", "1/6", "1/2", "2/3"],
      correct: 2,
      explanation: "Even outcomes: {2, 4, 6} (3 total). Total outcomes: 6. Probability = 3/6 = 1/2."
    },
    {
      id: "ai_6",
      question: "What is the average time complexity of searching for an element in a balanced binary search tree (BST)?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      correct: 1,
      explanation: "For a balanced BST, each comparison discards half of the tree, resulting in an O(log n) average search time."
    }
  ],
  design: [
    {
      id: "ds_1",
      question: "Which UX research method is best suited for gathering qualitative, open-ended insights into user behavior?",
      options: ["A/B Testing", "Usability Testing Interviews", "Google Analytics", "Survey Questionnaires"],
      correct: 1,
      explanation: "Usability testing interviews gather qualitative details about what users experience, struggle with, and think in real-time."
    },
    {
      id: "ds_2",
      question: "What design principle dictates that elements close to each other are perceived as related?",
      options: ["Contrast", "Proximity", "Visual Hierarchy", "Alignment"],
      correct: 1,
      explanation: "The Gestalt Law of Proximity states that objects close to each other tend to be grouped together conceptually."
    },
    {
      id: "ds_3",
      question: "Which typeface style is generally preferred for printed body text (e.g. books) to increase readability?",
      options: ["Sans-serif", "Serif", "Decorative", "Script"],
      correct: 1,
      explanation: "Serifs (small details on the ends of strokes) help guide the eye along lines of text in printed mediums."
    },
    {
      id: "ds_4",
      question: "In Figma, how do you create an instance of a component?",
      options: [
        "Use the duplicate command (Ctrl+D) on a Component",
        "Drag the component from the Assets panel",
        "Group the component with another element",
        "Create a Frame around the component"
      ],
      correct: 1,
      explanation: "Dragging a component from the Assets panel or duplicating a component publishes an Instance that stays synced."
    },
    {
      id: "ds_5",
      question: "Which colors are directly opposite each other on the color wheel?",
      options: ["Analogous", "Complementary", "Monochromatic", "Triadic"],
      correct: 1,
      explanation: "Complementary colors are opposite (e.g. red and green), creating high visual contrast when placed next to each other."
    },
    {
      id: "ds_6",
      question: "Under WCAG 2.1 guidelines, what is the minimum required color contrast ratio for normal body text (Level AA)?",
      options: ["3:1", "4.5:1", "7:1", "2:1"],
      correct: 1,
      explanation: "WCAG AA requires a contrast ratio of at least 4.5:1 for normal text (under 18pt or 14pt bold) to ensure readability."
    }
  ]
};

const CODING_PROBLEMS = [
  {
    id: "two_sum",
    title: "Two Sum",
    difficulty: "Easy",
    description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
    examples: "Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: nums[0] + nums[1] == 9, so we return [0, 1].",
    constraints: "- 2 <= nums.length <= 10^4\n- -10^9 <= nums[i] <= 10^9\n- -10^9 <= target <= 10^9",
    topics: ["Array", "Hash Table"],
    testCases: [
      { input: "[2, 7, 11, 15], 9", output: "[0,1]" },
      { input: "[3, 2, 4], 6", output: "[1,2]" },
      { input: "[3, 3], 6", output: "[0,1]" }
    ],
    starterCodes: {
      javascript: `function twoSum(nums, target) {\n    // Write your code here\n    \n}`,
      python: `def two_sum(nums, target):\n    # Write your code here\n    pass`,
      cpp: `#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        \n    }\n};`,
      java: `import java.util.*;\n\nclass Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}`
    }
  },
  {
    id: "reverse_string",
    title: "Reverse String",
    difficulty: "Easy",
    description: "Write a function that reverses an array of characters in-place with O(1) extra memory.",
    examples: "Input: s = [\"h\",\"e\",\"l\",\"l\",\"o\"]\nOutput: [\"o\",\"l\",\"l\",\"e\",\"h\"]",
    constraints: "1 <= s.length <= 10^5",
    topics: ["Two Pointers", "String"],
    testCases: [
      { input: '["h","e","l","l","o"]', output: '["o","l","l","e","h"]' },
      { input: '["H","a","n","n","a","h"]', output: '["h","a","n","n","a","H"]' }
    ],
    starterCodes: {
      javascript: `function reverseString(s) {\n    // Write your code here\n    \n}`,
      python: `def reverse_string(s):\n    # Write your code here\n    pass`,
      cpp: `#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    void reverseString(vector<char>& s) {\n        \n    }\n};`,
      java: `class Solution {\n    public void reverseString(char[] s) {\n        \n    }\n}`
    }
  },
  {
    id: "fizz_buzz",
    title: "Fizz Buzz",
    difficulty: "Easy",
    description: "Given an integer `n`, return a string array answer (1-indexed) where:\n- answer[i] == \"FizzBuzz\" if i is divisible by 3 and 5.\n- answer[i] == \"Fizz\" if i is divisible by 3.\n- answer[i] == \"Buzz\" if i is divisible by 5.\n- answer[i] == i (as a string) if none of the above conditions are true.",
    examples: "Input: n = 3\nOutput: [\"1\",\"2\",\"Fizz\"]",
    constraints: "1 <= n <= 10^4",
    topics: ["Math", "Simulation"],
    testCases: [
      { input: "3", output: '["1","2","Fizz"]' },
      { input: "5", output: '["1","2","Fizz","4","Buzz"]' },
      { input: "15", output: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]' }
    ],
    starterCodes: {
      javascript: `function fizzBuzz(n) {\n    // Write your code here\n    \n}`,
      python: `def fizz_buzz(n):\n    # Write your code here\n    pass`,
      cpp: `#include <vector>\n#include <string>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<string> fizzBuzz(int n) {\n        \n    }\n};`,
      java: `import java.util.*;\n\nclass Solution {\n    public List<String> fizzBuzz(int n) {\n        \n    }\n}`
    }
  }
];

// ── Init placement tab ───────────────────
async function initPlacementTab() {
  const { data: attempts } = await supabase
    .from('placement_attempts')
    .select('*')
    .eq('user_id', currentUserId);

  // Reset progress state
  placementProgress.r1 = false;
  placementProgress.r2 = false;
  placementProgress.r3 = false;
  placementProgress.r1Score = 0;
  placementProgress.r2Score = 0;
  placementProgress.r3Score = 0;

  if (attempts && attempts.length > 0) {
    placementProgress.resume = true; // Auto-unlock resume stage if they have attempts
    attempts.forEach(att => {
      if (att.round === 1) {
        if (att.passed) placementProgress.r1 = true;
        if (att.score > placementProgress.r1Score) placementProgress.r1Score = att.score;
      }
      if (att.round === 2) {
        if (att.passed) placementProgress.r2 = true;
        if (att.score > placementProgress.r2Score) placementProgress.r2Score = att.score;
      }
      if (att.round === 3) {
        if (att.passed) placementProgress.r3 = true;
        if (att.score > placementProgress.r3Score) placementProgress.r3Score = att.score;
      }
    });
  }

  updatePlacementDashboardStats(attempts);
  updatePlacementProgress();
  triggerPlacementEntranceAnimation();

  // Check resume status
  if (typeof checkResumeStatusOnSetup === 'function') {
    checkResumeStatusOnSetup();
  }

  // Restore active session if any
  const activeSessionStr = localStorage.getItem('r3_active_session');
  if (activeSessionStr) {
    try {
      const saved = JSON.parse(activeSessionStr);
      if (Date.now() - saved.timestamp < 3600000 && saved.r3QuestionCount <= 8) {
        if (typeof showResumeInterviewModal === 'function') {
          showResumeInterviewModal(saved);
        }
      } else {
        localStorage.removeItem('r3_active_session');
        localStorage.removeItem('r3_session_id');
      }
    } catch (e) {
      localStorage.removeItem('r3_active_session');
    }
  }
}

function animateNumberCountUp(el, targetVal, durationMs = 250, suffix = '%') {
  if (!el) return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    el.textContent = `${targetVal}${suffix}`;
    return;
  }
  const startTime = performance.now();
  const startVal = 0;
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    // ease-out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startVal + (targetVal - startVal) * ease);
    el.textContent = `${current}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

function triggerPlacementEntranceAnimation() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const statCards = document.querySelectorAll('.placement-stat-card');
  statCards.forEach((card) => {
    card.classList.remove('animated-entry');
    void card.offsetWidth; // force reflow
    card.classList.add('animated-entry');
  });

  const stepCircles = document.querySelectorAll('.placement-step-circle');
  stepCircles.forEach((circle) => {
    circle.classList.remove('pop-in');
    void circle.offsetWidth; // force reflow
    circle.classList.add('pop-in');
  });
}

function updatePlacementDashboardStats(attempts) {
  const readinessStat = document.getElementById('placement-readiness-stat');
  const ringContainer = document.getElementById('placement-ring-container');
  const ringFill = document.getElementById('placement-ring-fill');
  const roundsStat = document.getElementById('placement-rounds-stat');
  const stageStat = document.getElementById('placement-stage-stat');
  const stageSubText = document.getElementById('placement-stage-sub-text');
  const stageDot = document.getElementById('stage-pulse-dot');
  const bestScoreEl = document.getElementById('placement-best-score');
  const lastDateEl = document.getElementById('placement-last-date');
  const ringSpark = document.getElementById('placement-ring-spark');

  const circumference = 150.796; // 2 * PI * 24

  if (!attempts || attempts.length === 0) {
    if (readinessStat) {
      readinessStat.innerHTML = '<span class="placement-unassessed-pill">Not Assessed</span>';
    }
    if (ringContainer) ringContainer.classList.add('pulsing');
    if (ringFill) ringFill.style.strokeDashoffset = circumference;
    if (ringSpark) ringSpark.style.display = 'none';
    if (roundsStat) roundsStat.textContent = '0 / 3';
    if (stageStat) {
      stageStat.textContent = 'Round 1';
      stageStat.style.color = 'var(--accent-primary)';
    }
    if (stageSubText) stageSubText.textContent = 'In Progress';
    if (stageDot) stageDot.style.display = 'inline-block';
    if (bestScoreEl) {
      bestScoreEl.textContent = 'N/A';
      bestScoreEl.style.color = 'var(--text-muted)';
    }
    if (lastDateEl) {
      lastDateEl.textContent = 'Never';
      lastDateEl.style.color = 'var(--text-muted)';
    }
    return;
  }

  const completedRounds = new Set();
  let bestScore = 0;
  let lastAttemptDate = null;
  let lastAttemptMs = 0;

  attempts.forEach(att => {
    completedRounds.add(att.round);
    if (att.score > bestScore) {
      bestScore = att.score;
    }
    const dateMs = Date.parse(att.created_at || att.started_at);
    if (dateMs && dateMs > lastAttemptMs) {
      lastAttemptMs = dateMs;
      lastAttemptDate = new Date(dateMs).toLocaleDateString('en-IN');
    }
  });

  const bestScores = { 1: null, 2: null, 3: null };
  attempts.forEach(att => {
    if (bestScores[att.round] === null || att.score > bestScores[att.round]) {
      bestScores[att.round] = att.score;
    }
  });

  const scoresToAverage = Object.values(bestScores).filter(s => s !== null);
  if (scoresToAverage.length > 0) {
    const avg = Math.round(scoresToAverage.reduce((a, b) => a + b, 0) / scoresToAverage.length);
    if (readinessStat) {
      readinessStat.innerHTML = `<span class="placement-headline-val" id="placement-readiness-number">${avg}%</span>`;
      const numEl = document.getElementById('placement-readiness-number');
      if (numEl) animateNumberCountUp(numEl, avg, 250, '%');
    }
    if (ringContainer) ringContainer.classList.remove('pulsing');
    if (ringFill) {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const targetOffset = circumference * (1 - avg / 100);
      if (prefersReduced) {
        ringFill.style.strokeDashoffset = targetOffset;
      } else {
        ringFill.style.strokeDashoffset = circumference;
        setTimeout(() => {
          ringFill.style.strokeDashoffset = targetOffset;
        }, 30);
      }
    }
    if (ringSpark) ringSpark.style.display = 'inline';
  } else {
    if (readinessStat) {
      readinessStat.innerHTML = '<span class="placement-unassessed-pill">Not Assessed</span>';
    }
    if (ringContainer) ringContainer.classList.add('pulsing');
    if (ringFill) ringFill.style.strokeDashoffset = circumference;
    if (ringSpark) ringSpark.style.display = 'none';
  }

  const passedRounds = new Set();
  attempts.forEach(att => {
    if (att.passed) passedRounds.add(att.round);
  });
  if (roundsStat) roundsStat.textContent = `${passedRounds.size} / 3`;

  let currentStage = 'Round 1';
  if (!placementProgress.resume) {
    currentStage = 'Resume Upload';
  } else if (!passedRounds.has(1)) {
    currentStage = 'Round 1';
  } else if (!passedRounds.has(2)) {
    currentStage = 'Round 2';
  } else if (!passedRounds.has(3)) {
    currentStage = 'Round 3';
  } else {
    currentStage = 'Placement Ready!';
  }
  if (stageStat) {
    if (currentStage === 'Placement Ready!') {
      stageStat.style.color = 'var(--pill-green)';
      stageStat.textContent = 'Placement Ready! 🎉';
      if (stageSubText) stageSubText.textContent = 'All 3 Rounds Cleared';
      if (stageDot) stageDot.style.display = 'none';
    } else {
      stageStat.style.color = 'var(--accent-primary)';
      stageStat.textContent = currentStage;
      if (stageSubText) stageSubText.textContent = 'In Progress';
      if (stageDot) stageDot.style.display = 'inline-block';
    }
  }

  if (bestScoreEl) {
    bestScoreEl.textContent = bestScore > 0 ? `${bestScore}%` : 'N/A';
    bestScoreEl.style.color = bestScore > 0 ? 'var(--text-primary)' : 'var(--text-muted)';
  }
  if (lastDateEl) {
    lastDateEl.textContent = lastAttemptDate || 'Never';
  }
}

// ── Resume Helpers ───────────────────────
function handleResumeDrop(e) {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (files.length) handleResumeFile({ files });
}

function handleResumeFile(input) {
  const file = input.files[0];
  if (!file) return;

  const isDocx = file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

  if (isPdf) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ') + ' ';
        }
        placementResumeText = text.trim();
        onResumeReady(file);
      } catch (err) {
        console.error("PDF Parsing error:", err);
        placementResumeText = `Resume File: ${file.name}\nCandidate: ${currentUserName || 'Student'}`;
        onResumeReady(file);
      }
    };
    reader.readAsArrayBuffer(file);
  } else if (isDocx) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (window.mammoth) {
          const result = await window.mammoth.extractRawText({ arrayBuffer: e.target.result });
          placementResumeText = (result.value || '').trim();
        } else {
          // Fallback text extraction
          const decoder = new TextDecoder('utf-8');
          const raw = decoder.decode(e.target.result);
          placementResumeText = raw.replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
        }
        if (!placementResumeText || placementResumeText.length < 20) {
          placementResumeText = `Resume File: ${file.name}\nCandidate Name: ${currentUserName || 'Student'}`;
        }
        onResumeReady(file);
      } catch (err) {
        console.warn("DOCX Parsing fallback:", err);
        placementResumeText = `Resume File: ${file.name}\nCandidate Name: ${currentUserName || 'Student'}`;
        onResumeReady(file);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = (e) => {
      placementResumeText = (e.target.result || '').trim();
      onResumeReady(file);
    };
    reader.readAsText(file);
  }
}

function onResumeReady(file) {
  document.getElementById('dropzone-content').innerHTML = `
    <div style="font-size:32px;margin-bottom:8px;">✅</div>
    <div style="font-size:14px;font-weight:700;color:var(--text-primary);">
      ${file.name} uploaded!
    </div>
    <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">Ready for AI ATS evaluation</div>
  `;
  document.getElementById('resume-action-buttons').style.display = 'block';
  placementProgress.resume = true;
  updatePlacementProgress();
}

async function processAndAnalyzeResume() {
  const resArea = document.getElementById('resume-analysis-result');
  resArea.innerHTML = `
    <div style="padding:28px; text-align:center; background:var(--bg-secondary); border-radius:16px; border:1.5px solid var(--border-strong);">
      <div style="font-size:28px; margin-bottom:12px; animation: pulse 1.5s infinite;">🤖</div>
      <div style="font-weight:700; font-size:15px; color:var(--text-primary);">AI is evaluating your resume...</div>
      <div style="font-size:12px; color:var(--text-secondary); margin-top:6px;">Extracting ATS keywords, domain skills, project impact, and placement readiness.</div>
    </div>
  `;

  const cleanText = (placementResumeText || '').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n').trim();
  const textLower = cleanText.toLowerCase();
  const isRealResume = cleanText.length > 100;
  console.log('[Resume Analysis] Text length:', cleanText.length);

  // ── Smart Local Resume Analyzer ──────────────────────────────────────────
  function analyzeResumeLocally(text, lower) {
    let score = 40; // base — everyone starts here
    const strengths = [];
    const improvements = [];

    // 1. Content Length (0–10 pts, proportional)
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount > 600) score += 10;
    else if (wordCount > 400) score += 7;
    else if (wordCount > 250) score += 4;
    else if (wordCount > 100) score += 1;
    else { score -= 5; improvements.push('Resume is very short — expand each section with more detail (aim for 400–600+ words).'); }

    // 2. Key Sections (up to 18 pts total, with graded penalties for missing)
    const hasExperience = /experience|internship|work history|employment/i.test(text);
    const hasEducation = /education|university|college|b\.tech|b\.e\.|bachelor|master|degree|gpa/i.test(text);
    const hasProjects = /project|github\.com|portfolio/i.test(text);
    const hasSkills = /skills|technologies|tools|frameworks|proficient/i.test(text);
    const hasContact = /(linkedin\.com|github\.com|gmail\.com|@[\w]+\.com)/i.test(text);
    const hasSummary = /summary|objective|about me|profile/i.test(text);

    if (hasExperience) { score += 7; strengths.push('Work experience or internship section demonstrates real-world professional exposure.'); }
    else { score -= 3; improvements.push('Add a Work Experience or Internships section — even short-term, freelance, or volunteer roles strengthen your profile.'); }

    if (hasEducation) score += 4;
    else { score -= 2; improvements.push('Add an Education section with degree, institution name, and expected graduation year.'); }

    if (hasProjects) { score += 7; strengths.push('Projects section with GitHub links shows practical, hands-on technical initiative beyond coursework.'); }
    else { score -= 3; improvements.push('Add a Projects section with 2–3 projects: describe the problem, tech stack used, and link to GitHub or live demo.'); }

    if (hasSkills) score += 4;
    else { score -= 2; improvements.push('Add a clearly labeled Technical Skills section grouping your languages, frameworks, tools, and databases.'); }

    if (hasContact) { score += 4; strengths.push('LinkedIn and/or GitHub profile links are present — makes it easy for recruiters to verify work.'); }
    else { score -= 2; improvements.push('Add LinkedIn profile URL and GitHub link to your header — most recruiters check these before interviews.'); }

    if (hasSummary) score += 3;
    else improvements.push("Add a 2–3 line Professional Summary at the top tailored to the role you're targeting.");

    // 3. Technical Keyword Density (proportional, 0–15 pts)
    const techKeywords = ['python','sql','machine learning','deep learning','tensorflow','pytorch','pandas','numpy',
      'scikit-learn','scikit','data analysis','statistics','tableau','power bi','r programming',
      'nlp','computer vision','llm','javascript','react','node.js','node','java','c++','c#',
      'aws','gcp','azure','docker','kubernetes','git','api','rest','database','mysql','mongodb',
      'postgresql','figma','ux','ui design','adobe','design system','user research','agile','ci/cd'];
    const foundTech = techKeywords.filter(k => lower.includes(k));
    const techScore = Math.min(15, foundTech.length * 1.5);
    score += techScore;
    if (foundTech.length >= 10) {
      strengths.push(`Excellent technical keyword coverage — ${foundTech.length} skills detected (${foundTech.slice(0,5).join(', ')}, etc.) which maximizes ATS match rates.`);
    } else if (foundTech.length >= 5) {
      strengths.push(`Good technical breadth — ${foundTech.length} skills detected: ${foundTech.slice(0,4).join(', ')}.`);
      improvements.push(`Expand technical keywords — only ${foundTech.length}/15+ detected. Add more frameworks/tools specific to your target role.`);
    } else if (foundTech.length >= 2) {
      improvements.push(`Only ${foundTech.length} tech keywords found (${foundTech.join(', ')}). ATS systems heavily filter by keyword density — list all relevant tools explicitly.`);
    } else {
      score -= 5;
      improvements.push('Almost no technical keywords detected — this resume will likely be filtered out by ATS. Add Python, SQL, Git, and your core frameworks by name.');
    }

    // 4. Measurable Impact / Metrics (0–10 pts)
    const metricMatches = (text.match(/\d+\s*%|\d+x\s|\$\s*\d+|\d+\s*(users|customers|million|k\b|projects|hours|days|seconds|ms)/gi) || []);
    if (metricMatches.length >= 4) {
      score += 10;
      strengths.push(`Strong use of quantified achievements (${metricMatches.length} metrics found) — numbers like "${metricMatches[0]}" make bullet points stand out to hiring managers.`);
    } else if (metricMatches.length >= 2) {
      score += 5;
      improvements.push(`Only ${metricMatches.length} quantified metrics found. Aim for 5+ — e.g., 'improved accuracy by 12%', 'processed 50K records/day', 'reduced latency by 30%'.`);
    } else {
      score -= 3;
      improvements.push("No measurable impact found. Add numbers to every bullet point: percentages, user counts, time saved, data volume — this is the #1 differentiator.");
    }

    // 5. Action Verbs (0–5 pts)
    const actionVerbs = ['developed','built','designed','implemented','created','led','managed','deployed',
      'automated','optimized','researched','analyzed','engineered','trained','launched','collaborated',
      'delivered','architected','integrated','scraped','modeled','predicted','visualized'];
    const foundVerbs = actionVerbs.filter(v => lower.includes(v));
    if (foundVerbs.length >= 6) score += 5;
    else if (foundVerbs.length >= 3) score += 2;
    else { improvements.push('Start every bullet point with a strong action verb: Developed, Implemented, Deployed, Automated, Engineered, etc.'); }

    // 6. Formatting Quality (0–3 pts)
    const hasBullets = /[•\-\*]/.test(text);
    if (hasBullets) score += 2;
    const lineCount = text.split('\n').filter(l => l.trim().length > 0).length;
    if (lineCount > 20) score += 1;

    // 7. Penalties for red flags
    const hasResponsibleFor = /responsible for|worked on|helped with|assisted in/gi.test(text);
    if (hasResponsibleFor) { score -= 3; improvements.push("Avoid weak phrases like 'responsible for' or 'worked on' — replace with action verbs showing ownership (e.g., 'Led', 'Delivered', 'Built')."); }

    // Final cap: realistic range 45–95
    score = Math.max(45, Math.min(95, Math.round(score)));

    // Pad to exactly 3 items each
    const strengthExtras = [
      'Resume structure follows standard chronological format recognized by ATS systems.',
      'Education credentials are clearly presented with institution and degree details.',
      'Document appears formatted for clean PDF parsing by automated screening systems.'
    ];
    const improvementExtras = [
      'Add certifications relevant to your field (e.g., Google Data Analytics, AWS Cloud Practitioner, Coursera specializations).',
      "Tailor this resume's keywords to each specific job description — generic resumes get 60% fewer callbacks.",
      'Consider adding a GitHub contribution graph screenshot or portfolio link to visually demonstrate coding activity.'
    ];
    while (strengths.length < 3) { const e = strengthExtras.find(x => !strengths.includes(x)); if (e) strengths.push(e); else break; }
    while (improvements.length < 3) { const e = improvementExtras.find(x => !improvements.includes(x)); if (e) improvements.push(e); else break; }

    return { score, strengths: strengths.slice(0,3), improvements: improvements.slice(0,3) };
  }


  // Run local analysis
  const local = analyzeResumeLocally(cleanText, textLower);
  let score = local.score;
  let strengths = local.strengths;
  let improvements = local.improvements;

  // Try AI on top — if it works, override with AI result; if not, local result stands
  try {
    const resumePrompt = `You are a resume evaluator. Analyze the resume below.
Respond with ONLY a JSON object — no markdown, no explanation, no code fences.
Format: {"score": <number 50-100>, "strengths": ["...", "...", "..."], "improvements": ["...", "...", "..."]}
- score: realistic integer based on actual content quality
- strengths: 3 SPECIFIC points about THIS resume (mention actual skills/projects/companies)
- improvements: 3 SPECIFIC, actionable gaps in THIS resume

Resume:
${cleanText.substring(0, 1800)}`;

    const result = await callAI(resumePrompt, 600);
    if (result) {
      const cleaned = result.replace(/```json\s*/gi,'').replace(/```\s*/gi,'').replace(/^[\s\S]*?(?=\{)/,'').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (!isNaN(Number(parsed.score))) score = Math.min(100, Math.max(50, Math.round(Number(parsed.score))));
        if (Array.isArray(parsed.strengths) && parsed.strengths.length > 0) strengths = parsed.strengths.slice(0,3);
        if (Array.isArray(parsed.improvements) && parsed.improvements.length > 0) improvements = parsed.improvements.slice(0,3);
        console.log('[Resume Analysis] AI override applied — score:', score);
      }
    }
  } catch(e) {
    console.log('[Resume Analysis] AI unavailable, using local analysis (score:', score, ')');
  }


  const scoreDisplay = `${score}/100`;
  const strengthsHTML = strengths.map(s => `<li style="margin-bottom:8px; line-height:1.5;">${s}</li>`).join('');
  const improvementsHTML = improvements.map(i => `<li style="margin-bottom:8px; line-height:1.5;">${i}</li>`).join('');

  resArea.innerHTML = `
    <div style="background:var(--bg-secondary); border-radius:16px; border:1.5px solid var(--border-strong); box-shadow:var(--shadow-card); overflow:hidden; margin-top:20px;">
      <div style="padding:20px 24px; background:var(--bg-secondary); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <div style="font-weight:800; font-size:16px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
          <span>📊 Resume Analysis Complete</span>
        </div>
        <div style="font-size:22px; font-weight:800; color:var(--accent-primary);">${scoreDisplay}</div>
      </div>
      <div style="padding:24px; display:grid; grid-template-columns:1fr 1fr; gap:24px;">
        <div style="background:var(--bg-tertiary); padding:18px; border-radius:12px; border:1px solid var(--border);">
          <div style="font-size:11px; font-weight:800; color:#1B6344; text-transform:uppercase; margin-bottom:12px; letter-spacing:0.05em;">Top Strengths</div>
          <ul style="padding-left:18px; font-size:13px; color:var(--text-secondary); margin:0;">
            ${strengthsHTML}
          </ul>
        </div>
        <div style="background:var(--bg-tertiary); padding:18px; border-radius:12px; border:1px solid var(--border);">
          <div style="font-size:11px; font-weight:800; color:#9C4119; text-transform:uppercase; margin-bottom:12px; letter-spacing:0.05em;">Suggested Improvements</div>
          <ul style="padding-left:18px; font-size:13px; color:var(--text-secondary); margin:0;">
            ${improvementsHTML}
          </ul>
        </div>
      </div>
      <div style="padding:16px 24px; border-top:1px solid var(--border); background:var(--bg-secondary);">
        <button onclick="scrollToRound('step-r1')" class="btn-primary" style="width:100%; padding:14px; border-radius:10px; font-weight:700; cursor:pointer; font-size:14px;">Proceed to Round 1 Test →</button>
      </div>
    </div>
  `;

  placementProgress.resume = true;
  updatePlacementProgress();
}

// ── Round 1: Aptitude + Technical MCQs ──────────
function setCompanyType(idx, btn) {
  const types = ['Product (FAANG)', 'Service (TCS/Infosys)', 'Startup'];
  selectedCompanyType = types[idx];
  document.querySelectorAll('[id^="ct-btn-"]').forEach(b => {
    b.style.background = 'transparent';
    b.style.color = '#64748B';
    b.style.borderColor = '#E2E8F0';
  });
  btn.style.background = '#059669';
  btn.style.color = 'white';
  btn.style.borderColor = '#059669';
}

let currentR1Test = null;
let r1TimerInterval;
let r1TimeLeft = 30 * 60; // 30 minutes

async function startRound1Test() {
  const area = document.getElementById('r1-test-area');
  area.innerHTML = '<div style="padding:40px;text-align:center;"><div style="font-size:24px; margin-bottom:12px; animation: pulse 1.5s infinite;">🧠</div><div style="color:var(--emerald); font-weight:600;">Selecting personalized questions for your career path...</div><div style="font-size:12px; color:var(--text-muted); margin-top:8px;">This will only take a second.</div></div>';
  area.style.display = 'block';
  document.getElementById('start-r1-btn').style.display = 'none';

  // 1. Fetch profile to get career track and weaknesses
  const { data: profile } = await supabase.from('profiles').select('goal, session_history').eq('id', currentUserId).single();
  const goal = profile?.goal || '';
  const { track } = getCareerTrackFromGoal(goal);

  // Map track to category key
  let category = 'software';
  if (track === "UI/UX & Design") {
    category = 'design';
  } else if (track === "AI & Data") {
    category = 'data';
  }

  const allAptitude = PLACEMENT_QUESTIONS.aptitude;

  // Select 5 Aptitude questions (shuffle and take all 5)
  const selectedApt = [...allAptitude].sort(() => 0.5 - Math.random()).slice(0, 5);

  // Identify weak skill from Quick Test history
  let weakSkill = '';
  if (profile?.session_history) {
    const assessments = profile.session_history.filter(h => h.type === 'assessment');
    if (assessments.length > 0) {
      weakSkill = assessments[0].weakSkill || '';
    }
  }

  // Filter technical questions and prioritize weak skill
  const techPool = PLACEMENT_QUESTIONS[category] || PLACEMENT_QUESTIONS.software;

  const selectedTech = [...techPool].sort((a, b) => {
    const aMatch = weakSkill && (a.explanation.toLowerCase().includes(weakSkill.toLowerCase()) || a.question.toLowerCase().includes(weakSkill.toLowerCase()));
    const bMatch = weakSkill && (b.explanation.toLowerCase().includes(weakSkill.toLowerCase()) || b.question.toLowerCase().includes(weakSkill.toLowerCase()));
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return 0.5 - Math.random();
  }).slice(0, 5);

  const testQuestions = [...selectedApt, ...selectedTech];
  currentR1Test = { mcqs: testQuestions };

  renderRound1(currentR1Test);
}

function renderRound1(test) {
  const area = document.getElementById('r1-test-area');
  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:var(--bg-surface); padding:12px 18px; border-radius:12px; border:1px solid var(--border); box-shadow:var(--shadow-card);">
      <div style="font-weight:600; font-size:14px; color:var(--emerald);">🕒 Time Remaining: <span id="r1-timer" style="font-weight:700; font-size:16px;">30:00</span></div>
      <div style="font-size:12px; color:var(--text-muted);">Aptitude (Q1-5) + Technical (Q6-10)</div>
    </div>
    <div style="padding:10px;">
  `;

  test.mcqs.forEach((m, i) => {
    html += `
      <div style="margin-bottom:24px; background:var(--bg-card); padding:16px; border-radius:12px; border:1px solid var(--border);">
        <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text-primary);">Q${i + 1}: ${m.question}</div>
        ${m.options.map((opt, oi) => `
          <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:13px; cursor:pointer; padding:8px 12px; background:var(--bg-surface); border-radius:8px; border:1px solid var(--border); transition:all 200ms;"
            onmouseover="this.style.borderColor='var(--fuchsia)'" onmouseout="this.style.borderColor='var(--border)'">
            <input type="radio" name="mcq-${i}" value="${oi}"> <span>${opt}</span>
          </label>
        `).join('')}
      </div>
    `;
  });

  html += `
    <button onclick="submitRound1()" id="submit-r1-btn" style="width:100%;padding:14px;background:var(--grad-brand);color:white;border:none;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer;box-shadow:var(--shadow-fuchsia);transition:all 200ms;">Submit Answers</button>
  </div>`;
  area.innerHTML = html;

  // Start Timer
  clearInterval(r1TimerInterval);
  r1TimeLeft = 30 * 60;
  r1TimerInterval = setInterval(() => {
    r1TimeLeft--;
    const m = Math.floor(r1TimeLeft / 60).toString().padStart(2, '0');
    const s = (r1TimeLeft % 60).toString().padStart(2, '0');
    const tEl = document.getElementById('r1-timer');
    if (tEl) {
      tEl.textContent = `${m}:${s}`;
      if (r1TimeLeft < 300) tEl.style.color = 'var(--rose)';
    }
    if (r1TimeLeft <= 0) {
      clearInterval(r1TimerInterval);
      showToast('Time is up! Auto-submitting...', 'warning');
      submitRound1();
    }
  }, 1000);
}

async function submitRound1() {
  clearInterval(r1TimerInterval);
  const btn = document.getElementById('submit-r1-btn');
  if (btn) {
    btn.innerHTML = 'Submitting & Evaluating...';
    btn.disabled = true;
  }

  showToast('Evaluating your answers...', 'info');

  let correctCount = 0;
  let aptitudeCorrect = 0;
  let technicalCorrect = 0;
  const answers = [];
  const strongAreas = [];
  const weakAreas = [];
  let explanationsHTML = '';

  if (currentR1Test && currentR1Test.mcqs) {
    currentR1Test.mcqs.forEach((m, i) => {
      const selected = document.querySelector(`input[name="mcq-${i}"]:checked`);
      const userAnsIdx = selected ? parseInt(selected.value) : -1;
      const isCorrect = userAnsIdx === m.correct;
      const isAptitude = i < 5;

      answers.push({
        questionId: m.id,
        userAnswer: userAnsIdx,
        correct: isCorrect
      });

      if (isCorrect) {
        correctCount++;
        if (isAptitude) aptitudeCorrect++;
        else technicalCorrect++;
        const areaName = isAptitude ? 'Aptitude Reasoning' : 'Core Technology';
        if (!strongAreas.includes(areaName)) strongAreas.push(areaName);
      } else {
        const areaName = isAptitude ? 'Aptitude Reasoning' : 'Core Technology';
        if (!weakAreas.includes(areaName)) weakAreas.push(areaName);

        explanationsHTML += `
          <div style="margin-bottom: 14px; padding: 12px; background: rgba(244,63,94,0.05); border-left: 3px solid var(--rose); border-radius: 6px; font-size:12px;">
            <strong>Q${i + 1}: ${m.question}</strong><br>
            <span style="color: var(--text-error);">Your answer: ${userAnsIdx !== -1 ? m.options[userAnsIdx] : 'No Answer'}</span><br>
            <span style="color: var(--emerald);">Correct answer: ${m.options[m.correct]}</span><br>
            <p style="margin: 6px 0 0 0; color: var(--text-secondary); font-style: italic;">${m.explanation}</p>
          </div>
        `;
      }
    });
  }

  const finalScore = correctCount * 10;
  const passed = finalScore >= 70;

  const r1Details = {
    companyType: selectedCompanyType,
    aptitudeScore: aptitudeCorrect * 20,
    technicalScore: technicalCorrect * 20,
    answers: answers
  };

  await supabase.from('placement_attempts').insert({
    user_id: currentUserId,
    round: 1,
    score: finalScore,
    passed: passed,
    details: r1Details
  });

  // Reload statistics dynamically
  const { data: refreshedAttempts } = await supabase.from('placement_attempts').select('*').eq('user_id', currentUserId);
  if (refreshedAttempts) {
    updatePlacementDashboardStats(refreshedAttempts);
  }

  document.getElementById('r1-test-area').style.display = 'none';
  const res = document.getElementById('r1-result');
  res.style.display = 'block';

  res.innerHTML = `
    <div style="padding:24px;background:var(--bg-card);border-radius:16px;border:1px solid ${passed ? 'var(--emerald)' : 'var(--rose)'};box-shadow:var(--shadow-card);">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:42px;margin-bottom:12px;text-shadow:0 0 20px ${passed ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'};">${passed ? '🎉' : '❌'}</div>
        <div style="font-size:22px;font-weight:800;color:${passed ? 'var(--emerald)' : 'var(--rose)'};">Score: ${finalScore}%</div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">(${correctCount} / 10 Correct | Aptitude: ${r1Details.aptitudeScore}% | Technical: ${r1Details.technicalScore}%)</div>
        <p style="font-size:14px;color:var(--text-secondary);margin-top:8px;">
          ${passed ? 'Outstanding! You cleared Round 1 and unlocked Round 2.' : 'Needs Improvement. You need at least 70% to unlock Round 2. Check the review below and try again!'}
        </p>
      </div>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
        <div style="background:rgba(16,185,129,0.03); border:1px solid rgba(16,185,129,0.2); padding:14px; border-radius:10px;">
          <strong style="color:var(--emerald); font-size:12px; text-transform:uppercase; display:block; margin-bottom:6px;">✓ Strengths</strong>
          <div style="font-size:13px; color:var(--text-secondary);">${strongAreas.join(', ') || 'None identified'}</div>
        </div>
        <div style="background:rgba(217,119,6,0.03); border:1px solid rgba(217,119,6,0.2); padding:14px; border-radius:10px;">
          <strong style="color:var(--amber); font-size:12px; text-transform:uppercase; display:block; margin-bottom:6px;">⚠ Areas to Improve</strong>
          <div style="font-size:13px; color:var(--text-secondary);">${weakAreas.join(', ') || 'None identified'}</div>
        </div>
      </div>

      ${explanationsHTML ? `
        <div style="background:var(--bg-surface);padding:16px;border-radius:12px;border:1px solid var(--border);max-height:240px;overflow-y:auto;margin-bottom:20px;">
          <h4 style="font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;margin-top:0;">Question Review</h4>
          ${explanationsHTML}
        </div>
      ` : ''}
      
      <div style="display:flex; gap:12px;">
        ${passed
      ? `<button onclick="scrollToRound('step-r2')" style="flex:1;padding:12px;background:var(--emerald);color:white;border:none;border-radius:10px;font-weight:600;cursor:pointer;">Proceed to Round 2 →</button>`
      : `<button onclick="retryRound1()" style="flex:1;padding:12px;background:var(--rose);color:white;border:none;border-radius:10px;font-weight:600;cursor:pointer;">Retry Round 1</button>`
    }
      </div>
    </div>
  `;

  if (passed) {
    placementProgress.r1 = true;
    placementProgress.r1Score = finalScore;
    updatePlacementProgress();
  }
}

function retryRound1() {
  document.getElementById('r1-result').style.display = 'none';
  document.getElementById('start-r1-btn').style.display = 'block';
  document.getElementById('r1-test-area').style.display = 'none';
}

window.retryRound1 = retryRound1;

// ── Round 2: Coding & DSA Challenge ──────
let currentR2Problem = null;
let currentR2Lang = 'javascript';

function startRound2Coding() {
  document.getElementById('start-r2-btn').style.display = 'none';
  document.getElementById('r2-coding-area').style.display = 'grid';

  // Set default problem
  const probSelect = document.getElementById('r2-problem-select');
  if (probSelect) {
    changeCodingProblem(probSelect.value);
  }
}

function changeCodingProblem(probId) {
  const problem = CODING_PROBLEMS.find(p => p.id === probId);
  if (!problem) return;

  currentR2Problem = problem;

  document.getElementById('r2-problem-title').textContent = problem.title + ' (' + problem.difficulty + ')';
  document.getElementById('r2-problem-desc').textContent = problem.description;
  document.getElementById('r2-problem-examples').textContent = problem.examples;
  document.getElementById('r2-problem-constraints').textContent = problem.constraints;

  // Reset console output
  document.getElementById('r2-console-panel').style.display = 'none';
  document.getElementById('r2-console-output').textContent = '';

  // Load starter code
  changeCodingLanguage(currentR2Lang);
}

function changeCodingLanguage(lang) {
  currentR2Lang = lang;
  if (!currentR2Problem) return;

  const starter = currentR2Problem.starterCodes[lang] || '';
  document.getElementById('r2-code-editor').value = starter;
}

// Local JS code executor
function runJavaScriptLocally(code, problem) {
  let passedCount = 0;
  let outputLog = "";

  try {
    let wrapperBody = "";
    if (problem.id === "two_sum") {
      wrapperBody = `${code}\nreturn twoSum(nums, target);`;
    } else if (problem.id === "reverse_string") {
      wrapperBody = `${code}\nreverseString(s);\nreturn s;`;
    } else if (problem.id === "fizz_buzz") {
      wrapperBody = `${code}\nreturn fizzBuzz(n);`;
    }

    problem.testCases.forEach((tc, idx) => {
      let testFn;
      if (problem.id === "two_sum") {
        testFn = new Function("nums", "target", wrapperBody);
      } else if (problem.id === "reverse_string") {
        testFn = new Function("s", wrapperBody);
      } else if (problem.id === "fizz_buzz") {
        testFn = new Function("n", wrapperBody);
      }

      const inputArgs = eval(`[${tc.input}]`);

      let startTime = performance.now();
      const userResult = testFn(...inputArgs);
      let duration = (performance.now() - startTime).toFixed(2);

      const expectedJSON = JSON.stringify(eval(tc.output));
      const userJSON = JSON.stringify(userResult);

      if (expectedJSON === userJSON) {
        passedCount++;
        outputLog += `✅ Test Case ${idx + 1}: Passed (${duration}ms)\n   Input: ${tc.input}\n   Output: ${userJSON}\n\n`;
      } else {
        outputLog += `❌ Test Case ${idx + 1}: Failed (${duration}ms)\n   Input: ${tc.input}\n   Expected: ${expectedJSON}\n   Got: ${userJSON}\n\n`;
      }
    });
  } catch (e) {
    outputLog = `🚨 Execution/Syntax Error:\n${e.stack || e.message}`;
  }

  return {
    testCasesPassed: passedCount,
    totalTestCases: problem.testCases.length,
    executionOutput: outputLog
  };
}

async function runCodingTestCases() {
  const consolePanel = document.getElementById('r2-console-panel');
  const consoleStatus = document.getElementById('r2-console-status');
  const consoleOutput = document.getElementById('r2-console-output');

  consolePanel.style.display = 'block';
  consoleStatus.textContent = 'Running...';
  consoleStatus.style.color = 'var(--amber)';
  consoleOutput.textContent = 'Executing test cases...';

  const code = document.getElementById('r2-code-editor').value;

  if (currentR2Lang === 'javascript') {
    const res = runJavaScriptLocally(code, currentR2Problem);
    consoleStatus.textContent = res.testCasesPassed === res.totalTestCases ? 'SUCCESS' : 'FAILED';
    consoleStatus.style.color = res.testCasesPassed === res.totalTestCases ? 'var(--emerald)' : 'var(--rose)';
    consoleOutput.textContent = res.executionOutput;
  } else {
    const prompt = `You are a sandboxed code compiler.
Challenge: ${currentR2Problem.title}
Language: ${currentR2Lang}
Code to execute:
${code}
Test cases to check:
${currentR2Problem.testCases.map((tc, idx) => `Case ${idx + 1}: Input: ${tc.input}, Expected Output: ${tc.output}`).join('\n')}

Simulate execution of this code against the test cases exactly. Make sure to check for logical bugs, syntax/compilation issues, or runtime exceptions.
Return ONLY valid JSON format:
{
  "testCasesPassed": <number>,
  "totalTestCases": ${currentR2Problem.testCases.length},
  "executionOutput": "<detailed trace of each test case and any print outputs/errors>"
}`;

    try {
      const res = await callAI(prompt);
      const parsed = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
      consoleStatus.textContent = parsed.testCasesPassed === parsed.totalTestCases ? 'SUCCESS' : 'FAILED';
      consoleStatus.style.color = parsed.testCasesPassed === parsed.totalTestCases ? 'var(--emerald)' : 'var(--rose)';
      consoleOutput.textContent = parsed.executionOutput;
    } catch (e) {
      consoleStatus.textContent = 'ERROR';
      consoleStatus.style.color = 'var(--rose)';
      consoleOutput.textContent = 'Compilation simulation failed. Please check your syntax and try again.';
    }
  }
}

async function submitCodingChallenge() {
  const code = document.getElementById('r2-code-editor').value;
  const consolePanel = document.getElementById('r2-console-panel');
  const consoleStatus = document.getElementById('r2-console-status');
  const consoleOutput = document.getElementById('r2-console-output');

  consolePanel.style.display = 'block';
  consoleStatus.textContent = 'Evaluating Submission...';
  consoleStatus.style.color = 'var(--amber)';
  consoleOutput.textContent = 'Submitting code, executing all tests, and generating qualitative review...';

  let testCasesPassed = 0;
  let totalTestCases = currentR2Problem.testCases.length;
  let traceOutput = "";

  if (currentR2Lang === 'javascript') {
    const localRes = runJavaScriptLocally(code, currentR2Problem);
    testCasesPassed = localRes.testCasesPassed;
    traceOutput = localRes.executionOutput;
  } else {
    const promptRun = `You are a sandboxed code compiler.
Challenge: ${currentR2Problem.title}
Language: ${currentR2Lang}
Code to execute:
${code}
Test cases to check:
${currentR2Problem.testCases.map((tc, idx) => `Case ${idx + 1}: Input: ${tc.input}, Expected Output: ${tc.output}`).join('\n')}

Simulate execution of this code against the test cases exactly. Make sure to check for logical bugs, syntax/compilation issues, or runtime exceptions.
Return ONLY valid JSON format:
{
  "testCasesPassed": <number>,
  "totalTestCases": ${currentR2Problem.testCases.length},
  "executionOutput": "<detailed trace of each test case and any print outputs/errors>"
}`;

    try {
      const resRun = await callAI(promptRun);
      const parsedRun = JSON.parse(resRun.match(/\{[\s\S]*\}/)[0]);
      testCasesPassed = parsedRun.testCasesPassed || 0;
      traceOutput = parsedRun.executionOutput || "";
    } catch (e) {
      testCasesPassed = 0;
      traceOutput = "Compilation/Execution simulation error.";
    }
  }

  const score = Math.round((testCasesPassed / totalTestCases) * 100);
  const passed = score >= 70;

  consoleStatus.textContent = passed ? 'PASSED' : 'FAILED';
  consoleStatus.style.color = passed ? 'var(--emerald)' : 'var(--rose)';
  consoleOutput.textContent = traceOutput;

  const promptReview = `You are a Senior Software Engineer conducting a code review.
Problem: ${currentR2Problem.title}
Language: ${currentR2Lang}
Submitted Code:
${code}

Conduct a technical code review. Evaluate:
1. Code Quality & Formatting
2. Readability
3. Algorithmic Approach
4. Complexity (Time & Space complexity)
5. Strengths
6. Potential Optimizations or Weaknesses

Return ONLY valid JSON:
{
  "codeQuality": "Poor|Fair|Good|Excellent",
  "readability": "Poor|Fair|Good|Excellent",
  "complexityExplanation": "<Time and Space complexity, e.g. O(N) time and O(N) space>",
  "strengths": "<brief 1 sentence strength>",
  "weaknesses": "<brief 1 sentence weakness>",
  "aiFeedback": "<constructive details on how they can optimize or refactor their code>"
}`;

  let review = {
    codeQuality: "Good",
    readability: "Good",
    complexityExplanation: "Depends on implementation.",
    strengths: "Core logic implemented.",
    weaknesses: "Can be optimized.",
    aiFeedback: "Good attempt! Make sure to verify edge cases and try to reduce space complexity if possible."
  };

  try {
    const resReview = await callAI(promptReview);
    const parsedReview = JSON.parse(resReview.match(/\{[\s\S]*\}/)[0]);
    review = { ...review, ...parsedReview };
  } catch (e) {
    console.log("Qualitative review fallback");
  }

  const r2Details = {
    companyType: selectedCompanyType,
    problemId: currentR2Problem.id,
    language: currentR2Lang,
    code: code,
    testCasesPassed: testCasesPassed,
    totalTestCases: totalTestCases,
    strengths: review.strengths,
    weaknesses: review.weaknesses,
    aiFeedback: review.aiFeedback
  };

  await supabase.from('placement_attempts').insert({
    user_id: currentUserId,
    round: 2,
    score: score,
    passed: passed,
    details: r2Details
  });

  const { data: refreshedAttempts } = await supabase.from('placement_attempts').select('*').eq('user_id', currentUserId);
  if (refreshedAttempts) {
    updatePlacementDashboardStats(refreshedAttempts);
  }

  document.getElementById('r2-coding-area').style.display = 'none';
  const resArea = document.getElementById('r2-result');
  resArea.style.display = 'block';

  resArea.innerHTML = `
    <div style="padding:24px;background:var(--bg-card);border-radius:16px;border:1px solid ${passed ? 'var(--emerald)' : 'var(--rose)'};box-shadow:var(--shadow-card);">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:42px;margin-bottom:12px;text-shadow:0 0 20px ${passed ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'};">${passed ? '🎉' : '❌'}</div>
        <div style="font-size:22px;font-weight:800;color:${passed ? 'var(--emerald)' : 'var(--rose)'};">Test Cases: ${testCasesPassed} / ${totalTestCases} Passed</div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">Score: ${score}%</div>
        <p style="font-size:14px;color:var(--text-secondary);margin-top:8px;">
          ${passed ? 'Superb! You cleared Round 2 and unlocked Round 3 Interview.' : 'Keep practicing. You need at least 70% passed test cases to clear Round 2.'}
        </p>
      </div>

      <div style="background:var(--bg-surface);padding:16px;border-radius:12px;border:1px solid var(--border);margin-bottom:20px; display:grid; grid-template-columns:1fr; gap:12px;">
        <h4 style="font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px 0;">Code Review & Feedback</h4>
        <div style="font-size:13px;color:var(--text-primary);line-height:1.6; display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:12px;">
          <div><strong style="color:var(--text-muted);">Code Quality:</strong> <span style="color:var(--emerald); font-weight:700;">${review.codeQuality}</span></div>
          <div><strong style="color:var(--text-muted);">Readability:</strong> <span style="color:var(--emerald); font-weight:700;">${review.readability}</span></div>
          <div><strong style="color:var(--text-muted);">Complexity:</strong> <span style="color:var(--fuchsia); font-weight:700;">${review.complexityExplanation}</span></div>
        </div>
        <div style="font-size:13px;color:var(--text-primary);line-height:1.6;">
          <strong>Strengths:</strong> ${review.strengths}<br>
          <strong style="color:var(--amber);">Weaknesses:</strong> ${review.weaknesses}<br>
          <p style="margin:8px 0 0 0; color:var(--text-secondary); font-style:italic;">${review.aiFeedback}</p>
        </div>
      </div>

      <div style="display:flex; gap:12px;">
        ${passed
      ? `<button onclick="scrollToRound('step-r3')" style="flex:1;padding:12px;background:var(--emerald);color:white;border:none;border-radius:10px;font-weight:600;cursor:pointer;">Proceed to Round 3 Interview →</button>`
      : `<button onclick="retryRound2()" style="flex:1;padding:12px;background:var(--rose);color:white;border:none;border-radius:10px;font-weight:600;cursor:pointer;">Retry Round 2</button>`
    }
      </div>
    </div>
  `;

  if (passed) {
    placementProgress.r2 = true;
    placementProgress.r2Score = score;
    updatePlacementProgress();
  }
}

function retryRound2() {
  document.getElementById('r2-result').style.display = 'none';
  document.getElementById('start-r2-btn').style.display = 'block';
  document.getElementById('r2-coding-area').style.display = 'none';
}

window.startRound2Coding = startRound2Coding;
window.changeCodingProblem = changeCodingProblem;
window.changeCodingLanguage = changeCodingLanguage;
window.runCodingTestCases = runCodingTestCases;
window.submitCodingChallenge = submitCodingChallenge;
window.retryRound2 = retryRound2;

// Expose Round 3 functions to window for inline HTML onclick/onchange attributes
window.handleResumeFile = handleResumeFile;
window.scrollToRound = scrollToRound;
window.testCameraAndMic = testCameraAndMic;
window.startVideoInterview = startVideoInterview;
window.toggleCameraTrack = toggleCameraTrack;
window.toggleMicTrack = toggleMicTrack;
window.endInterview = endVideoInterview;
window.switchInputMode = switchInputMode;
window.submitTypedAnswer = submitTypedAnswer;
window.generateFinalReport = generateFinalReport;

// ── Round 3: Conversational AI Video Interview ───────────
let r3ActiveStream = null;
let r3VideoTrack = null;
let r3AudioTrack = null;
let r3State = 'PREPARING'; // PREPARING, READY, ASKING, LISTENING, PROCESSING, EVALUATING, FINAL_EVALUATION
let r3ChatHistory = [];
let r3Evaluations = [];
let r3QuestionCount = 0;
const R3_MAX_QUESTIONS = 8;
let r3Recognition = null;
let r3IsListening = false;
let r3InterviewActive = false;
let r3InputMode = 'voice'; // voice | text

// Camera analysis vars
let r3CanvasInterval = null;
let r3PresenceEvents = [];
let r3IntegritySummary = [];
let r3PresenceStats = {
  framesChecked: 0,
  framesPresent: 0,
  engagementScore: 0,
  postureScore: 0,
  totalMotion: 0,
  totalGazeDeviation: 0
};
let r3BaseCentroidY = null;
let r3LastFrameData = null;

// Promise-based TTS so we can await it finishing before we start listening
function r3Speak(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const doSpeak = () => {
      const utt = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
        voices.find(v => v.lang.startsWith('en')) || voices[0];
      if (voice) utt.voice = voice;
      utt.rate = 0.92; utt.pitch = 1.0;
      utt.onstart = () => r3SetState('ASKING');
      utt.onend = () => { resolve(); };
      utt.onerror = () => { resolve(); };
      window.speechSynthesis.speak(utt);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); };
    } else { doSpeak(); }
  });
}

function r3SetState(state) {
  r3State = state;
  const statusEl = document.getElementById('r3-status-bar');
  if (!statusEl) return;

  const map = {
    PREPARING: ['var(--amber)', '●', 'Preparing Interview...'],
    READY: ['var(--emerald)', '●', 'Ready to Start'],
    ASKING: ['#EC4899', '🔊', 'Atlas AI is speaking...'],
    LISTENING: ['#10B981', '🎤', 'Listening — speak now'],
    PROCESSING: ['#818CF8', '⏳', 'Analyzing your answer...'],
    EVALUATING: ['#818CF8', '⏳', 'Preparing next question...'],
    FINAL_EVALUATION: ['#00E5FF', '🏆', 'Evaluating overall interview...']
  };

  const [color, icon, label] = map[state] || map.READY;
  statusEl.innerHTML = `<span style="color:${color};margin-right:6px;">${icon}</span><span style="font-size:13px;color:var(--text-secondary);font-weight:500;">${label}</span>`;

  const voiceContainer = document.getElementById('voice-input-container');
  const keyboardContainer = document.getElementById('keyboard-input-container');
  const micPulse = document.getElementById('mic-pulse-indicator');
  const liveSpeechText = document.getElementById('speech-live-text');

  if (state === 'LISTENING') {
    if (r3InputMode === 'voice') {
      if (voiceContainer) voiceContainer.style.display = 'flex';
      if (keyboardContainer) keyboardContainer.style.display = 'none';
      if (micPulse) micPulse.style.display = 'inline-block';
      if (liveSpeechText) liveSpeechText.textContent = 'Speak your answer clearly...';
    } else {
      if (voiceContainer) voiceContainer.style.display = 'none';
      if (keyboardContainer) keyboardContainer.style.display = 'flex';
      if (micPulse) micPulse.style.display = 'none';
    }
  } else {
    if (micPulse) micPulse.style.display = 'none';
    if (state !== 'PROCESSING' && state !== 'EVALUATING' && state !== 'FINAL_EVALUATION') {
      if (voiceContainer) voiceContainer.style.display = 'flex';
      if (keyboardContainer) keyboardContainer.style.display = 'none';
      if (liveSpeechText) liveSpeechText.textContent = 'Atlas AI is currently active...';
    }
  }
}

function r3AddMsg(role, text) {
  const c = document.getElementById('r3-transcript-log');
  if (!c) return;
  if (c.firstElementChild?.textContent.includes('Waiting to start') || c.firstElementChild?.textContent.includes('conversation will appear')) c.innerHTML = '';
  const isAI = role === 'ai';
  const d = document.createElement('div');
  d.style.cssText = `display:flex;flex-direction:column;align-items:${isAI ? 'flex-start' : 'flex-end'};margin-bottom:12px;`;
  d.innerHTML = `<div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em;">${isAI ? '🤖 ATLAS AI' : '👤 YOU'}</div>
    <div style="background:${isAI ? 'var(--bg-card)' : 'rgba(0,229,255,0.12)'};color:var(--text-primary);padding:10px 14px;border-radius:12px;${isAI ? 'border-top-left-radius:2px;border:1px solid var(--border);' : 'border-top-right-radius:2px;border:1px solid var(--emerald);'}font-size:13px;max-width:88%;line-height:1.6;">${text}</div>`;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

function checkResumeStatusOnSetup() {
  const resumeEl = document.getElementById('setup-status-resume');
  if (!resumeEl) return;
  const hasResume = !!(placementResumeText && placementResumeText.trim());
  if (hasResume) {
    resumeEl.textContent = '✓ Ready';
    resumeEl.style.color = 'var(--emerald)';
  } else {
    resumeEl.textContent = '✓ Ready (SkillBridge Profile)';
    resumeEl.style.color = 'var(--emerald)';
  }
}

async function testCameraAndMic() {
  const alertEl = document.getElementById('media-error-alert');
  const errorMsgEl = document.getElementById('media-error-message');
  if (alertEl) alertEl.style.display = 'none';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    r3ActiveStream = stream;
    r3VideoTrack = stream.getVideoTracks()[0];
    r3AudioTrack = stream.getAudioTracks()[0];

    // Show inside setup preview
    const video = document.getElementById('interview-video');
    if (video) {
      video.srcObject = stream;
      video.style.display = 'block';
    }
    const offMsg = document.getElementById('camera-off-msg');
    if (offMsg) offMsg.style.display = 'none';

    document.getElementById('setup-status-camera').textContent = '✓ Connected';
    document.getElementById('setup-status-camera').style.color = 'var(--emerald)';
    document.getElementById('setup-status-microphone').textContent = '✓ Connected';
    document.getElementById('setup-status-microphone').style.color = 'var(--emerald)';

    // Verify resume optimization
    checkResumeStatusOnSetup();

    // Enable Start button
    const startBtn = document.getElementById('btn-start-interview');
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.style.background = 'var(--grad-brand)';
      startBtn.style.color = '#ffffff';
      startBtn.style.cursor = 'pointer';
      startBtn.style.border = 'none';
      startBtn.style.boxShadow = 'var(--shadow-fuchsia)';
    }

  } catch (err) {
    console.error("Camera/Mic access error:", err);
    document.getElementById('setup-status-camera').textContent = '⚠ Error';
    document.getElementById('setup-status-camera').style.color = 'var(--rose)';
    document.getElementById('setup-status-microphone').textContent = '⚠ Error';
    document.getElementById('setup-status-microphone').style.color = 'var(--rose)';

    if (alertEl) {
      alertEl.style.display = 'block';
      if (errorMsgEl) errorMsgEl.textContent = 'Camera/microphone permission was denied. Please allow browser access and try again.';
    }
  }
}

async function extractResumeContext() {
  const ctx = {
    candidateName: currentUserName || 'Student',
    targetRole: selectedCompanyType || 'Software Developer',
    skills: [],
    projects: [],
    education: 'B.Tech Computer Science',
    experience: 'N/A'
  };

  try {
    const { data: profile } = await supabase.from('profiles').select('goal, roadmap_data, full_name').eq('id', currentUserId).single();
    if (profile) {
      if (profile.full_name) ctx.candidateName = profile.full_name;
      if (profile.goal) {
        try {
          const parsedGoal = JSON.parse(profile.goal);
          ctx.targetRole = parsedGoal.goal || ctx.targetRole;
          ctx.education = `${parsedGoal.branch || 'B.Tech'} (${parsedGoal.college_name || 'University'})`;
        } catch (e) {
          ctx.targetRole = profile.goal || ctx.targetRole;
        }
      }
      if (profile.roadmap_data?.phases) {
        profile.roadmap_data.phases.forEach(phase => {
          if (phase.skills) {
            phase.skills.forEach(sk => {
              if (!ctx.skills.includes(sk)) ctx.skills.push(sk);
            });
          }
        });
      }
    }
  } catch (e) {
    console.error("Profile fetch error for interview context:", e);
  }

  try {
    const { data: userProjects } = await supabase.from('projects').select('title, description, status').eq('user_id', currentUserId);
    if (userProjects) {
      userProjects.forEach(proj => {
        ctx.projects.push({
          title: proj.title,
          description: proj.description || 'Web development project',
          status: proj.status || 'Completed'
        });
      });
    }
  } catch (e) {
    console.error("Projects fetch error for interview context:", e);
  }

  if (placementResumeText && placementResumeText.trim()) {
    const parsePrompt = `You are a resume parser. Analyze this resume text and extract details.
    Resume Text:
    "${placementResumeText.substring(0, 3000)}"

    Return ONLY a valid JSON object matching this schema (do not fabricate, keep fields empty if not found):
    {
      "candidateName": "Extract name if found, otherwise keep original: ${ctx.candidateName}",
      "targetRole": "Extract target role, otherwise: ${ctx.targetRole}",
      "skills": ["Extract list of skills (max 8)"],
      "projects": [{"title": "project title", "description": "brief description"}],
      "education": "Extract degree, branch, university",
      "experience": "Extract work/internship experience details"
    }`;

    try {
      const rawRes = await callAI(parsePrompt, 1000);
      if (rawRes) {
        const jsonMatch = rawRes.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.candidateName) ctx.candidateName = parsed.candidateName;
          if (parsed.targetRole) ctx.targetRole = parsed.targetRole;
          if (parsed.skills && parsed.skills.length > 0) ctx.skills = parsed.skills;
          if (parsed.projects && parsed.projects.length > 0) {
            ctx.projects = parsed.projects.map(p => ({
              title: p.title || 'Project',
              description: p.description || '',
              status: 'Completed'
            }));
          }
          if (parsed.education) ctx.education = parsed.education;
          if (parsed.experience) ctx.experience = parsed.experience;
        }
      }
    } catch (e) {
      console.warn("AI resume parsing failed, utilizing profile details:", e);
    }
  }

  // Fallbacks if lists are empty
  if (ctx.skills.length === 0) ctx.skills = ['HTML', 'CSS', 'JavaScript', 'APIs'];
  if (ctx.projects.length === 0) ctx.projects = [{ title: 'SkillBridge Platform', description: 'Career prep ecosystem', status: 'Completed' }];

  r3PersonalizedContext = ctx;
  return ctx;
}

async function startVideoInterview() {
  r3SetState('PREPARING');

  // Verify and load stream
  if (!r3ActiveStream) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      r3ActiveStream = stream;
      r3VideoTrack = stream.getVideoTracks()[0];
      r3AudioTrack = stream.getAudioTracks()[0];
    } catch (e) {
      showToast("Camera or Microphone permission denied.", "error");
      return;
    }
  }

  // Parse Resume context in background/loading
  showToast("Personalizing interview using resume context...", "info");
  await extractResumeContext();

  // Swap panels
  document.getElementById('r3-setup-screen').style.display = 'none';
  document.getElementById('r3-interview-panel').style.display = 'block';

  const video = document.getElementById('interview-video');
  if (video) {
    video.srcObject = r3ActiveStream;
    video.style.display = 'block';
  }
  const offMsg = document.getElementById('camera-off-msg');
  if (offMsg) offMsg.style.display = 'none';
  const liveInd = document.getElementById('live-indicator');
  if (liveInd) liveInd.style.display = 'block';

  r3ChatHistory = [];
  r3Evaluations = [];
  r3PresenceEvents = [];
  r3IntegritySummary = [];
  r3QuestionCount = 0;
  r3InterviewActive = true;
  r3InputMode = 'voice';

  const sessionId = crypto.randomUUID();
  localStorage.setItem('r3_session_id', sessionId);
  saveSessionToLocalStorage();

  // Start Camera analysis
  startCameraAnalysis();

  await r3Speak('Welcome to your personalized AI Interview. Let us begin.');
  await r3NextQuestion();
}

async function r3NextQuestion() {
  if (!r3InterviewActive) return;

  r3QuestionCount++;
  document.getElementById('r3-q-num').textContent = r3QuestionCount;

  if (r3QuestionCount > R3_MAX_QUESTIONS) {
    await r3Finish();
    return;
  }

  r3SetState('PROCESSING');

  const ctx = r3PersonalizedContext;
  const historyLines = r3ChatHistory.map(h => `${h.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${h.text}`);
  const historyText = historyLines.join('\n\n');

  const stageMap = {
    1: { name: 'Stage 1 — Introduction', desc: 'Ask the candidate to introduce themselves, referencing their target career path.' },
    2: { name: 'Stage 2 — Resume Verification', desc: `Ask them a detailed technical verification question about one of their claimed skills: ${ctx.skills.slice(0, 4).join(', ')}.` },
    3: { name: 'Stage 3 — Project Deep Dive', desc: `Choose one project from their resume: ${JSON.stringify(ctx.projects[0])}. Ask what technical challenge they faced and how they solved it.` },
    4: { name: 'Stage 4 — Project Follow-Up', desc: 'Ask them a follow-up about the trade-offs of the technology choices they discussed in the previous project question.' },
    5: { name: 'Stage 5 — Technical Core Question', desc: `Ask a core technical concept question related to their target role (${ctx.targetRole}) and claimed skills (${ctx.skills.join(', ')}).` },
    6: { name: 'Stage 6 — Technical Follow-Up (Depth test)', desc: 'Ask a challenging follow-up question testing depth of knowledge based on their previous technical answer.' },
    7: { name: 'Stage 7 — Behavioral / HR Scenario', desc: 'Ask a behavioral question about handling project delay, conflict with a team member, or failure.' },
    8: { name: 'Stage 8 — Wrap-up', desc: 'Ask a final closing question such as "Why should we hire you for this role?" or checking their career interests.' }
  };

  const currentStage = stageMap[r3QuestionCount];

  // Fetch previous answer score to check depth
  let previousScoreNotice = "";
  if (r3Evaluations.length > 0) {
    const lastEval = r3Evaluations[r3Evaluations.length - 1];
    if (lastEval.depth_score < 70) {
      previousScoreNotice = "The candidate's previous answer lacked depth. Push for more specific details or examples in this question.";
    }
  }

  const prompt = `You are Atlas, an expert technical and HR interviewer conducting a resume-driven live mock interview.
  
  Candidate Details:
  - Name: ${ctx.candidateName}
  - Target Role: ${ctx.targetRole}
  - Education: ${ctx.education}
  - Skills claimed: ${ctx.skills.join(', ')}
  - Projects: ${JSON.stringify(ctx.projects)}
  - Experience: ${ctx.experience}
  
  Interview Progression: Question ${r3QuestionCount} of ${R3_MAX_QUESTIONS}
  Current Stage: ${currentStage.name} - ${currentStage.desc}
  ${previousScoreNotice}
  
  Chat Transcript:
  ${historyText || '(No messages yet)'}
  
  INSTRUCTIONS:
  1. Generate the next logical question for the interview matching the Current Stage.
  2. The question must feel realistic and adapt to previous answers.
  3. Keep the question concise: exactly 1-2 sentences.
  4. Do NOT output stage markers, greetings, question numbers, metadata, or side notes. Output ONLY the question itself.`;

  r3SetState('PROCESSING');

  const question = await callAI(prompt, 600) || "Could you describe one of your key projects and the core technologies you used?";

  r3ChatHistory.push({ role: 'ai', text: question });

  // Update display
  const textEl = document.getElementById('ai-q-display-text');
  if (textEl) textEl.textContent = question;

  r3AddMsg('ai', question);

  r3SetState('ASKING');
  await r3Speak(question);

  if (!r3InterviewActive) return;

  r3SetState('LISTENING');
  saveSessionToLocalStorage();
}

function r3Listen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast('Speech recognition not supported in this browser. Fallback to Keyboard Mode.', 'warning');
    r3InputMode = 'text';
    r3SetState('LISTENING');
    return;
  }

  if (r3Recognition) { try { r3Recognition.abort(); } catch (e) { } }
  r3Recognition = new SR();
  r3Recognition.continuous = false;
  r3Recognition.interimResults = true;
  r3Recognition.lang = 'en-US';

  let finalText = '';
  let silTimer = null;
  const liveTextEl = document.getElementById('speech-live-text');

  r3Recognition.onresult = (e) => {
    finalText = '';
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    if (liveTextEl) liveTextEl.textContent = finalText || interim || 'Listening...';

    if (silTimer) clearTimeout(silTimer);
    if (finalText.trim()) {
      silTimer = setTimeout(() => {
        try { r3Recognition.stop(); } catch (err) { }
      }, 2000);
    }
  };

  r3Recognition.onend = async () => {
    r3IsListening = false;
    if (document.getElementById('mic-pulse-indicator')) {
      document.getElementById('mic-pulse-indicator').style.display = 'none';
    }

    if (!r3InterviewActive) return;

    const ans = finalText.trim();
    if (ans) {
      submitAnswer(ans);
    } else {
      r3SetState('LISTENING');
      if (liveTextEl) liveTextEl.textContent = "No speech detected. Please speak clearly, or click Keyboard Fallback to type.";
    }
  };

  r3Recognition.onerror = async (e) => {
    r3IsListening = false;
    if (document.getElementById('mic-pulse-indicator')) {
      document.getElementById('mic-pulse-indicator').style.display = 'none';
    }
    if (!r3InterviewActive) return;

    if (e.error === 'no-speech') {
      r3SetState('LISTENING');
      if (liveTextEl) liveTextEl.textContent = "No speech detected. Please speak clearly, or click Keyboard Fallback to type.";
    } else {
      console.warn("Speech recognition error:", e.error);
      r3InputMode = 'text';
      r3SetState('LISTENING');
      showToast("Speech Recognition failed. Switched to Keyboard fallback.", "warning");
    }
  };

  r3IsListening = true;
  try { r3Recognition.start(); } catch (e) { }
}

async function submitAnswer(answerText) {
  if (!r3InterviewActive) return;

  const trimmed = answerText.trim();
  if (!trimmed || trimmed.includes("Click 'Unmute Mic'") || trimmed.includes("No speech detected")) {
    showToast("Please provide an answer by speaking or typing.", "warning");
    r3SetState('LISTENING');
    if (r3InputMode === 'voice') r3Listen();
    return;
  }

  r3ChatHistory.push({ role: 'user', text: trimmed });
  r3AddMsg('user', trimmed);

  r3SetState('PROCESSING');

  // Evaluate the answer in background
  await evaluateLastAnswer(trimmed);

  // Sync with local storage
  saveSessionToLocalStorage();

  // Load next question
  await r3NextQuestion();
}

function submitTypedAnswer() {
  const kbdInput = document.getElementById('r3-keyboard-text');
  if (!kbdInput) return;
  const val = kbdInput.value;
  submitAnswer(val);
}

function switchInputMode() {
  r3InputMode = r3InputMode === 'voice' ? 'text' : 'voice';
  const toggleBtn = document.getElementById('input-mode-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = r3InputMode === 'voice' ? 'Keyboard Fallback' : 'Speech Mode';
  }
  if (r3State === 'LISTENING') {
    r3SetState('LISTENING');
    if (r3InputMode === 'voice') r3Listen();
  }
}

async function evaluateLastAnswer(answer) {
  const lastQuestion = r3ChatHistory[r3ChatHistory.length - 2]?.text || "";
  if (!lastQuestion) return;

  const evalPrompt = `You are an expert interviewer evaluating a candidate's response to an interview question.
  
  Question asked: "${lastQuestion}"
  Candidate Answer: "${answer}"
  
  Evaluate this answer across:
  1. Technical Accuracy (score 0-100)
  2. Relevance (score 0-100)
  3. Depth of Knowledge (score 0-100)
  4. Reasoning & Problem Solving (score 0-100)
  5. Communication Quality (score 0-100)
  6. Resume Consistency (score 0-100)
  
  INSTRUCTIONS:
  - If the answer is extremely brief, incorrect, or dodges the technical details, score below 60.
  - Return ONLY a valid JSON object matching this schema:
  {
    "technical_score": <number>,
    "relevance_score": <number>,
    "depth_score": <number>,
    "reasoning_score": <number>,
    "communication_score": <number>,
    "resume_consistency_score": <number>,
    "feedback": "<brief 1-sentence description of strengths or gaps in this response. Use wording like 'candidate could not sufficiently demonstrate the skill' rather than 'lied'>"
  }`;

  try {
    const rawRes = await callAI(evalPrompt, 500);
    if (rawRes) {
      const jsonMatch = rawRes.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        r3Evaluations.push({
          question: lastQuestion,
          answer: answer,
          technical_score: parsed.technical_score || 70,
          relevance_score: parsed.relevance_score || 70,
          depth_score: parsed.depth_score || 70,
          reasoning_score: parsed.reasoning_score || 70,
          communication_score: parsed.communication_score || 70,
          resume_consistency_score: parsed.resume_consistency_score || 70,
          feedback: parsed.feedback || "Answer evaluated."
        });
        return;
      }
    }
  } catch (e) {
    console.warn("Evaluation parsing failed, using fallback:", e);
  }

  r3Evaluations.push({
    question: lastQuestion,
    answer: answer,
    technical_score: 70,
    relevance_score: 70,
    depth_score: 70,
    reasoning_score: 70,
    communication_score: 70,
    resume_consistency_score: 70,
    feedback: "Answer registered."
  });
}

function startCameraAnalysis() {
  const video = document.getElementById('interview-video');
  const canvas = document.getElementById('hidden-cv-canvas');
  if (!video || !canvas) return;
  const ctx = canvas.getContext('2d');

  r3PresenceStats = {
    framesChecked: 0,
    framesPresent: 0,
    engagementScore: 0,
    postureScore: 0,
    totalMotion: 0,
    totalGazeDeviation: 0
  };
  r3PresenceEvents = [];
  r3BaseCentroidY = null;
  r3LastFrameData = null;

  const calibrationOverlay = document.getElementById('setup-overlay-calibration');
  if (calibrationOverlay) {
    calibrationOverlay.textContent = 'Calibrating visual presence...';
    calibrationOverlay.style.color = 'var(--amber)';
  }

  logIntegrityEvent("Visual analysis calibrated");

  r3CanvasInterval = setInterval(() => {
    if (!r3InterviewActive) return;
    if (video.paused || video.ended || !r3VideoTrack || !r3VideoTrack.enabled) {
      logIntegrityEvent("Webcam is disabled or unavailable");
      return;
    }

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      let totalMass = 0;
      let centroidY = 0;
      let centroidX = 0;
      let brightnessSum = 0;

      const w = canvas.width;
      const h = canvas.height;
      const currentPixels = [];

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          brightnessSum += brightness;
          currentPixels.push(brightness);

          const weight = brightness > 50 ? brightness : 0;
          totalMass += weight;
          centroidY += y * weight;
          centroidX += x * weight;
        }
      }

      const avgBrightness = brightnessSum / (w * h);
      const avgYCentroid = totalMass > 0 ? (centroidY / totalMass) : (h / 2);
      const avgXCentroid = totalMass > 0 ? (centroidX / totalMass) : (w / 2);

      r3PresenceStats.framesChecked++;

      if (avgBrightness < 10) {
        logIntegrityEvent("Face missing / low light");
        if (calibrationOverlay) {
          calibrationOverlay.textContent = '⚠ Face missing / Covered';
          calibrationOverlay.style.color = 'var(--rose)';
        }
      } else {
        r3PresenceStats.framesPresent++;

        if (r3BaseCentroidY === null) {
          r3BaseCentroidY = avgYCentroid;
          logIntegrityEvent("Posture baseline calibrated");
          if (calibrationOverlay) {
            calibrationOverlay.textContent = 'Presence: Calibrated';
            calibrationOverlay.style.color = 'var(--emerald)';
          }
        } else {
          const yDiff = avgYCentroid - r3BaseCentroidY;
          if (yDiff > 2.2) {
            logIntegrityEvent("Slouched posture detected");
            r3PresenceStats.postureScore += 50;
            if (calibrationOverlay) {
              calibrationOverlay.textContent = '⚠ Posture: Slouched';
              calibrationOverlay.style.color = 'var(--amber)';
            }
          } else {
            r3PresenceStats.postureScore += 100;
            if (calibrationOverlay) {
              calibrationOverlay.textContent = 'Presence: Stable';
              calibrationOverlay.style.color = 'var(--emerald)';
            }
          }

          const xDiff = Math.abs(avgXCentroid - (w / 2));
          if (xDiff > 3.8) {
            logIntegrityEvent("Gaze deviation detected");
            r3PresenceStats.engagementScore += 50;
            r3PresenceStats.totalGazeDeviation++;
          } else {
            r3PresenceStats.engagementScore += 100;
          }
        }
      }

      if (r3LastFrameData !== null) {
        let frameDeltaSum = 0;
        for (let i = 0; i < currentPixels.length; i++) {
          frameDeltaSum += Math.abs(currentPixels[i] - r3LastFrameData[i]);
        }
        const avgDelta = frameDeltaSum / currentPixels.length;
        r3PresenceStats.totalMotion += avgDelta;

        if (avgDelta > 32) {
          logIntegrityEvent("Excessive movement detected");
        }
      }

      r3LastFrameData = currentPixels;

    } catch (e) {
      console.warn("Visual analyzer frame capture error:", e);
    }
  }, 1500);
}

function logIntegrityEvent(msg) {
  const timestamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const eventLogEl = document.getElementById('integrity-events-log');
  if (!eventLogEl) return;

  if (eventLogEl.firstElementChild?.textContent.includes('No alerts detected')) {
    eventLogEl.innerHTML = '';
  }

  const div = document.createElement('div');
  div.style.marginBottom = '4px';
  div.innerHTML = `<span style="color:var(--text-muted);">${timestamp}</span> — <span style="color:var(--rose); font-weight:600;">${msg}</span>`;
  eventLogEl.appendChild(div);
  eventLogEl.scrollTop = eventLogEl.scrollHeight;

  r3PresenceEvents.push({
    event_type: msg,
    timestamp: new Date().toISOString()
  });

  if (!r3IntegritySummary.includes(msg)) {
    r3IntegritySummary.push(msg);
  }
}

function saveSessionToLocalStorage() {
  if (!r3InterviewActive) return;
  const sessionState = {
    session_id: localStorage.getItem('r3_session_id') || crypto.randomUUID(),
    r3QuestionCount,
    r3ChatHistory,
    r3Evaluations,
    r3PresenceEvents,
    r3IntegritySummary,
    r3PresenceStats,
    r3PersonalizedContext,
    r3InputMode,
    timestamp: Date.now()
  };
  localStorage.setItem('r3_active_session', JSON.stringify(sessionState));
}

function showResumeInterviewModal(saved) {
  // Prevent duplicate modals
  if (document.getElementById('r3-resume-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'r3-resume-modal';
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(5,7,10,0.85); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; z-index:9999;';
  modal.innerHTML = `
    <div style="background:var(--bg-surface); border:1px solid var(--border); padding:32px; border-radius:16px; max-width:400px; text-align:center; box-shadow:var(--shadow-card);">
      <div style="font-size:42px; margin-bottom:16px; animation: pulse 1.5s infinite;">🎙</div>
      <h3 style="color:#ffffff; font-size:18px; font-weight:700; margin:0 0 8px 0;">Resume Active Interview?</h3>
      <p style="color:var(--text-secondary); font-size:13px; line-height:1.5; margin:0 0 24px 0;">We found an active interview session in progress (Question ${saved.r3QuestionCount} / 8). Would you like to resume where you left off?</p>
      <div style="display:flex; gap:12px;">
        <button id="r3-btn-resume" style="flex:1; padding:12px; background:var(--grad-brand); border:none; color:#ffffff; font-weight:600; border-radius:8px; cursor:pointer;">Resume Session</button>
        <button id="r3-btn-restart" style="flex:1; padding:12px; background:rgba(255,255,255,0.04); border:1px solid var(--border); color:#ffffff; font-weight:600; border-radius:8px; cursor:pointer;">Start Fresh</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('r3-btn-resume').onclick = () => {
    document.body.removeChild(modal);
    resumeInterviewSession(saved);
  };
  document.getElementById('r3-btn-restart').onclick = () => {
    document.body.removeChild(modal);
    localStorage.removeItem('r3_active_session');
    localStorage.removeItem('r3_session_id');
    initPlacementTab();
  };
}

async function resumeInterviewSession(saved) {
  r3QuestionCount = saved.r3QuestionCount - 1; // back one so r3NextQuestion increments to correct number
  r3ChatHistory = saved.r3ChatHistory || [];
  r3Evaluations = saved.r3Evaluations || [];
  r3PresenceEvents = saved.r3PresenceEvents || [];
  r3IntegritySummary = saved.r3IntegritySummary || [];
  r3PresenceStats = saved.r3PresenceStats || { framesChecked: 0, framesPresent: 0, engagementScore: 0, postureScore: 0, totalMotion: 0, totalGazeDeviation: 0 };
  r3PersonalizedContext = saved.r3PersonalizedContext;
  r3InputMode = saved.r3InputMode || 'voice';

  document.getElementById('r3-setup-screen').style.display = 'none';
  document.getElementById('r3-interview-panel').style.display = 'block';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    r3ActiveStream = stream;
    r3VideoTrack = stream.getVideoTracks()[0];
    r3AudioTrack = stream.getAudioTracks()[0];

    const video = document.getElementById('interview-video');
    if (video) {
      video.srcObject = stream;
      video.style.display = 'block';
    }
    const offMsg = document.getElementById('camera-off-msg');
    if (offMsg) offMsg.style.display = 'none';
    const liveInd = document.getElementById('live-indicator');
    if (liveInd) liveInd.style.display = 'block';

    r3InterviewActive = true;
    startCameraAnalysis();

    // Rebuild log
    const logEl = document.getElementById('r3-transcript-log');
    if (logEl) {
      logEl.innerHTML = '';
      r3ChatHistory.forEach(msg => {
        const isAI = msg.role === 'ai';
        const div = document.createElement('div');
        div.style.cssText = `display:flex; flex-direction:column; align-items:${isAI ? 'flex-start' : 'flex-end'}; margin-bottom:12px;`;
        div.innerHTML = `<div style="font-size:10px; color:var(--text-muted); margin-bottom:3px; text-transform:uppercase; letter-spacing:.05em;">${isAI ? '🤖 ATLAS AI' : '👤 YOU'}</div>
          <div style="background:${isAI ? 'var(--bg-card)' : 'rgba(0,229,255,0.12)'}; color:var(--text-primary); padding:10px 14px; border-radius:12px; ${isAI ? 'border-top-left-radius:2px; border:1px solid var(--border);' : 'border-top-right-radius:2px; border:1px solid var(--emerald);'} font-size:13px; max-width:88%; line-height:1.6;">${msg.text}</div>`;
        logEl.appendChild(div);
      });
      logEl.scrollTop = logEl.scrollHeight;
    }

    r3SetState('READY');
    await r3NextQuestion();

  } catch (err) {
    console.error("Resuming media access failed:", err);
    showToast("Failed to reconnect camera/microphone. Starting fresh.", "error");
    localStorage.removeItem('r3_active_session');
    localStorage.removeItem('r3_session_id');
    initPlacementTab();
  }
}

async function runResumeVerification() {
  const ctx = r3PersonalizedContext;
  if (!ctx || !ctx.skills || ctx.skills.length === 0) return [];

  const transcript = r3ChatHistory.map(h => `${h.role === 'ai' ? 'Atlas' : 'Candidate'}: ${h.text}`).join('\n');
  const verifyPrompt = `You are a technical recruiter conducting resume verification based on the interview transcript.
  
  Skills to verify: ${ctx.skills.join(', ')}
  
  Transcript:
  ${transcript}
  
  Evaluate each skill's demonstration status. Status options are: "Demonstrated", "Partially demonstrated", or "Could not sufficiently demonstrate".
  If a skill was not tested or the candidate failed to show understanding of it, choose "Could not sufficiently demonstrate".
  
  Return ONLY a valid JSON object matching this schema:
  {
    "verification": [
      { "skill": "skill name", "status": "Demonstrated|Partially demonstrated|Could not sufficiently demonstrate" }
    ]
  }`;

  try {
    const rawRes = await callAI(verifyPrompt, 1000);
    if (rawRes) {
      const jsonMatch = rawRes.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.verification || [];
      }
    }
  } catch (e) {
    console.warn("Resume verification call failed:", e);
  }

  return ctx.skills.map(skill => ({
    skill: skill,
    status: 'Partially demonstrated'
  }));
}

async function r3Finish() {
  r3InterviewActive = false;
  if (r3Recognition) { try { r3Recognition.abort(); } catch (e) { } }
  clearInterval(r3CanvasInterval);

  r3SetState('FINAL_EVALUATION');

  const textEl = document.getElementById('ai-q-display-text');
  if (textEl) textEl.textContent = 'Generating final performance report...';

  await r3Speak('The interview is now complete. Please wait while I compile your final report.');

  // Visual/Stream cleanup
  if (r3ActiveStream) {
    r3ActiveStream.getTracks().forEach(t => t.stop());
  }
  const video = document.getElementById('interview-video');
  if (video) video.style.display = 'none';
  const liveInd = document.getElementById('live-indicator');
  if (liveInd) liveInd.style.display = 'none';
  document.getElementById('camera-off-msg').style.display = 'flex';
  document.getElementById('r3-interview-panel').style.display = 'none';

  // Calculate final scores
  let avgTech = 75;
  let avgReason = 75;
  let avgResume = 75;
  let avgComm = 75;

  if (r3Evaluations.length > 0) {
    avgTech = Math.round(r3Evaluations.reduce((acc, curr) => acc + curr.technical_score, 0) / r3Evaluations.length);
    avgReason = Math.round(r3Evaluations.reduce((acc, curr) => acc + curr.reasoning_score, 0) / r3Evaluations.length);
    avgResume = Math.round(r3Evaluations.reduce((acc, curr) => acc + curr.resume_consistency_score, 0) / r3Evaluations.length);
    avgComm = Math.round(r3Evaluations.reduce((acc, curr) => acc + curr.communication_score, 0) / r3Evaluations.length);
  }

  // Calculate presence percentages
  const frames = r3PresenceStats.framesChecked || 1;
  const presentFrames = r3PresenceStats.framesPresent;
  const camPresencePct = Math.round((presentFrames / frames) * 100);
  const engagementPct = Math.round((r3PresenceStats.engagementScore) / frames) || 85;
  const posturePct = Math.round((r3PresenceStats.postureScore) / frames) || 85;
  const professionalPresencePct = Math.round((camPresencePct + engagementPct + posturePct) / 3);

  // Overall Score Calculation (Content 70%, Comm 20%, Presence 10%)
  const contentScore = Math.round((avgTech + avgReason + avgResume) / 3);
  const sc = Math.round(contentScore * 0.7 + avgComm * 0.2 + professionalPresencePct * 0.1);

  // Verify resume claims
  const verificationList = await runResumeVerification();

  const evalPrompt = `Given the final interview evaluations:
  Content Score: ${contentScore}%
  Communication Score: ${avgComm}%
  Presence Score: ${professionalPresencePct}%
  
  Answer logs: ${JSON.stringify(r3Evaluations)}
  Integrity events logged: ${r3IntegritySummary.join(', ')}
  
  Provide a final hiring decision summary (2-3 sentences). Use strictly objective, observable language (e.g. "Frequent gaze deviation detected" or "Multiple frame exits" instead of "nervous" or "liar").
  Identify:
  1. Strengths (2-3 specific evidence-based strengths).
  2. Areas to Improve (2-3 actionable areas, specifying topics like SQL, React, Communication, etc.).
  3. Actionable SkillBridge module links recommendations.
  
  Return ONLY a valid JSON object matching this schema:
  {
    "hiringDecision": "Strong Hire|Hire|No Hire",
    "summary": "assessment summary...",
    "strengths": ["strength1", "strength2"],
    "weaknesses": [{"topic": "SQL|React|Communication|etc", "feedback": "feedback text..."}],
    "feedbackAdvice": "paragraph of advice..."
  }`;

  let hire = 'Hire';
  let summary = 'The candidate demonstrated relevant technical aptitude and completed key project verification questions.';
  let strengths = ['Project experience', 'Core technical accuracy'];
  let weaknesses = [
    { topic: 'SQL', feedback: 'Struggled with complex queries and joins.' },
    { topic: 'Communication', feedback: 'Responses lacked structured reasoning.' }
  ];
  let feedbackAdvice = 'Keep technical answers structured using Concept -> Reason -> Example -> Trade-off.';

  try {
    const rawRes = await callAI(evalPrompt, 1000);
    if (rawRes) {
      const jsonMatch = rawRes.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        hire = parsed.hiringDecision || hire;
        summary = parsed.summary || summary;
        strengths = parsed.strengths || strengths;
        weaknesses = parsed.weaknesses || weaknesses;
        feedbackAdvice = parsed.feedbackAdvice || feedbackAdvice;
      }
    }
  } catch (err) {
    console.warn("AI final evaluation generation failed, using defaults:", err);
  }

  const hireColor = hire === 'Strong Hire' ? 'var(--emerald)' : hire === 'Hire' ? 'var(--amber)' : 'var(--rose)';

  const res = document.getElementById('r3-result');
  res.style.display = 'block';
  res.innerHTML = `
    <div style="padding:28px; background:var(--bg-card); border-radius:16px; border:2px solid var(--emerald); box-shadow:0 0 30px rgba(16,185,129,.15);">
      <div style="text-align:center; margin-bottom:24px;">
        <div style="font-size:48px; margin-bottom:12px;">🏆</div>
        <div style="font-size:24px; font-weight:800; color:var(--emerald);">Interview Complete!</div>
        <p style="font-size:14px; color:var(--text-secondary); margin-top:6px;">${summary}</p>
      </div>

      <!-- Core score breakdowns -->
      <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:16px; margin-bottom:20px;">
        <div style="background:var(--bg-surface); padding:18px; border-radius:12px; border:1px solid var(--border); text-align:center;">
          <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px;">Overall Interview Score</div>
          <div style="font-size:36px; font-weight:800; color:var(--fuchsia);">${sc}%</div>
        </div>
        <div style="background:var(--bg-surface); padding:18px; border-radius:12px; border:1px solid var(--border); text-align:center;">
          <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px;">Hiring Decision</div>
          <div style="font-size:24px; font-weight:700; color:${hireColor};">${hire}</div>
        </div>
      </div>

      <!-- Detailed Metrics Grid -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:20px;">
        <!-- CONTENT SCORING -->
        <div style="background:var(--bg-surface); padding:16px; border-radius:12px; border:1px solid var(--border);">
          <h4 style="font-size:12px; color:var(--emerald); text-transform:uppercase; letter-spacing:.05em; margin:0 0 12px 0;">Content Assessment</h4>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:13px; color:var(--text-secondary);">
            <div style="display:flex; justify-content:space-between;"><span>Technical Knowledge</span><span style="font-weight:600; color:#fff;">${avgTech}%</span></div>
            <div style="display:flex; justify-content:space-between;"><span>Problem Solving</span><span style="font-weight:600; color:#fff;">${avgReason}%</span></div>
            <div style="display:flex; justify-content:space-between;"><span>Resume Knowledge</span><span style="font-weight:600; color:#fff;">${avgResume}%</span></div>
            <div style="display:flex; justify-content:space-between;"><span>Communication Skill</span><span style="font-weight:600; color:#fff;">${avgComm}%</span></div>
          </div>
        </div>

        <!-- PRESENCE SCORING -->
        <div style="background:var(--bg-surface); padding:16px; border-radius:12px; border:1px solid var(--border);">
          <h4 style="font-size:12px; color:var(--fuchsia); text-transform:uppercase; letter-spacing:.05em; margin:0 0 12px 0;">Interview Presence</h4>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:13px; color:var(--text-secondary);">
            <div style="display:flex; justify-content:space-between;"><span>Camera Presence</span><span style="font-weight:600; color:#fff;">${camPresencePct}%</span></div>
            <div style="display:flex; justify-content:space-between;"><span>Gaze Engagement</span><span style="font-weight:600; color:#fff;">${engagementPct}%</span></div>
            <div style="display:flex; justify-content:space-between;"><span>Posture Index</span><span style="font-weight:600; color:#fff;">${posturePct}%</span></div>
            <div style="display:flex; justify-content:space-between;"><span>Professional Presence</span><span style="font-weight:600; color:#fff;">${professionalPresencePct}%</span></div>
          </div>
        </div>
      </div>

      <!-- RESUME VERIFICATION -->
      <div style="background:var(--bg-surface); padding:16px; border-radius:12px; border:1px solid var(--border); margin-bottom:20px;">
        <h4 style="font-size:12px; color:var(--amber); text-transform:uppercase; letter-spacing:.05em; margin:0 0 12px 0;">Resume Claim Verification</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px; color:var(--text-secondary);">
          ${verificationList.map(v => {
    let badgeColor = 'var(--rose)';
    let badgeIcon = '⚠';
    if (v.status === 'Demonstrated') { badgeColor = 'var(--emerald)'; badgeIcon = '✓'; }
    else if (v.status === 'Partially demonstrated') { badgeColor = 'var(--amber)'; badgeIcon = '~'; }
    return `<div style="display:flex; align-items:center; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
              <span>${v.skill}</span>
              <span style="color:${badgeColor}; font-weight:600; font-size:12px;">${badgeIcon} ${v.status}</span>
            </div>`;
  }).join('')}
        </div>
      </div>

      <!-- STRENGTHS & ROADMAP ADVICE -->
      <div style="background:var(--bg-surface); padding:16px; border-radius:12px; border:1px solid var(--border); margin-bottom:20px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
          <div>
            <div style="font-size:11px; color:var(--emerald); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px;">✅ Strengths</div>
            <ul style="padding-left:16px; font-size:13px; color:var(--text-secondary); line-height:1.7;">
              ${strengths.map(s => `<li>${s}</li>`).join('')}
            </ul>
          </div>
          <div>
            <div style="font-size:11px; color:var(--amber); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px;">📈 Improve (Actionable)</div>
            <ul style="padding-left:16px; font-size:13px; color:var(--text-secondary); line-height:1.7; list-style-type:none;">
              ${weaknesses.map(w => {
    let actionLink = '';
    if (w.topic.toLowerCase().includes('sql') || w.topic.toLowerCase().includes('database')) {
      actionLink = `<a href="#" onclick="window.switchTab('tasks'); return false;" style="color:var(--emerald); text-decoration:underline; font-weight:600; margin-left:6px;">Practice SQL in Tasks</a>`;
    } else if (w.topic.toLowerCase().includes('communication') || w.topic.toLowerCase().includes('hr') || w.topic.toLowerCase().includes('behavioral')) {
      actionLink = `<a href="#" onclick="window.switchTab('placement'); return false;" style="color:var(--emerald); text-decoration:underline; font-weight:600; margin-left:6px;">Practice Interview in Placement</a>`;
    } else {
      actionLink = `<a href="#" onclick="window.switchTab('roadmap'); return false;" style="color:var(--emerald); text-decoration:underline; font-weight:600; margin-left:6px;">Review Skill in Roadmap</a>`;
    }
    return `<li style="margin-bottom:8px;">⚠ <strong>${w.topic}</strong>: ${w.feedback} ${actionLink}</li>`;
  }).join('')}
            </ul>
          </div>
        </div>
      </div>

      <!-- Feedbacks advice paragraph -->
      <div style="background:var(--bg-surface); padding:16px; border-radius:12px; border:1px solid var(--border); margin-bottom:20px; font-size:13px; color:var(--text-secondary); line-height:1.5;">
        <span style="font-weight:700; color:#fff; display:block; margin-bottom:6px;">✨ AI Feedback Recommendation</span>
        ${feedbackAdvice}
      </div>

      <button onclick="generateFinalReport()" style="width:100%; padding:14px; background:var(--grad-brand); color:white; border:none; border-radius:10px; font-weight:600; font-size:15px; cursor:pointer; box-shadow:var(--shadow-fuchsia);">Download Full Placement Report</button>
    </div>
  `;

  placementProgress.r3 = true;
  placementProgress.r3Score = sc;

  // Persist structured interview session
  const activeSessionId = localStorage.getItem('r3_session_id') || crypto.randomUUID();
  await saveDetailedInterviewData(activeSessionId, sc, contentScore, avgComm, professionalPresencePct, strengths, weaknesses, feedbackAdvice, verificationList);

  // Clear active session since complete
  localStorage.removeItem('r3_active_session');
  localStorage.removeItem('r3_session_id');

  // Reload statistics dynamically
  const { data: refreshedAttempts } = await supabase.from('placement_attempts').select('*').eq('user_id', currentUserId);
  if (refreshedAttempts) {
    updatePlacementDashboardStats(refreshedAttempts);
  }

  updatePlacementProgress();
  await r3Speak(`Your interview score is ${sc} percent. hiring decision: ${hire}. Thank you for completing the interview.`);
}

async function saveDetailedInterviewData(session_id, overall_score, content_score, communication_score, presence_score, strengths, weaknesses, recommendations, verificationList) {
  const sessionObj = {
    id: session_id,
    user_id: currentUserId,
    started_at: new Date(Date.now() - 15 * 60000).toISOString(),
    completed_at: new Date().toISOString(),
    target_role: r3PersonalizedContext?.targetRole || selectedCompanyType,
    status: 'completed'
  };

  try {
    const { error: sessionErr } = await supabase.from('interview_sessions').insert(sessionObj);
    if (!sessionErr) {
      for (let i = 0; i < r3ChatHistory.length; i++) {
        if (r3ChatHistory[i].role === 'ai') {
          const q_id = crypto.randomUUID();
          await supabase.from('interview_questions').insert({
            id: q_id,
            session_id: session_id,
            question: r3ChatHistory[i].text,
            question_type: 'technical',
            sequence: i,
            skill: r3PersonalizedContext?.skills[i % r3PersonalizedContext.skills.length] || 'General'
          });

          const nextMsg = r3ChatHistory[i + 1];
          if (nextMsg && nextMsg.role === 'user') {
            const a_id = crypto.randomUUID();
            await supabase.from('interview_answers').insert({
              id: a_id,
              question_id: q_id,
              answer_text: nextMsg.text,
              timestamp: new Date().toISOString()
            });

            const matchingEval = r3Evaluations.find(ev => ev.question === r3ChatHistory[i].text);
            if (matchingEval) {
              await supabase.from('interview_evaluations').insert({
                answer_id: a_id,
                technical_score: matchingEval.technical_score,
                relevance_score: matchingEval.relevance_score,
                depth_score: matchingEval.depth_score,
                communication_score: matchingEval.communication_score,
                resume_consistency_score: matchingEval.resume_consistency_score,
                feedback: matchingEval.feedback
              });
            }
          }
        }
      }

      for (const ev of r3PresenceEvents) {
        await supabase.from('interview_presence_events').insert({
          session_id: session_id,
          event_type: ev.event_type,
          timestamp: ev.timestamp
        });
      }

      await supabase.from('interview_final_results').insert({
        session_id: session_id,
        overall_score: overall_score,
        content_score: content_score,
        communication_score: communication_score,
        presence_score: presence_score,
        integrity_summary: r3IntegritySummary,
        strengths: strengths,
        weaknesses: weaknesses.map(w => `${w.topic}: ${w.feedback}`),
        recommendations: recommendations
      });
    } else {
      throw new Error("Tables likely do not exist: " + sessionErr.message);
    }
  } catch (err) {
    console.warn("Structured tables failed (using placement_attempts details fallback):", err);

    // Save inside placement_attempts.details
    const r3Details = {
      companyType: selectedCompanyType,
      session_id: session_id,
      overall_score: overall_score,
      content_score: content_score,
      communication_score: communication_score,
      presence_score: presence_score,
      strengths: strengths,
      weaknesses: weaknesses,
      recommendations: recommendations,
      chat_history: r3ChatHistory,
      evaluations: r3Evaluations,
      presence_events: r3PresenceEvents,
      integrity_summary: r3IntegritySummary,
      resume_verification: verificationList,
      context: r3PersonalizedContext
    };

    await savePlacementAttempt(3, overall_score, overall_score >= 70, r3Details);
  }
}

async function savePlacementAttempt(round, score, passed, details = null) {
  const insertDetails = details || { companyType: selectedCompanyType };
  await supabase.from('placement_attempts').insert({
    user_id: currentUserId,
    round,
    score,
    passed,
    details: insertDetails
  });
}

async function endVideoInterview() {
  r3InterviewActive = false;
  if (r3Recognition) { try { r3Recognition.abort(); } catch (e) { } }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  clearInterval(r3CanvasInterval);
  if (r3ActiveStream) {
    r3ActiveStream.getTracks().forEach(t => t.stop());
  }
  if (!document.getElementById('r3-result').innerHTML.trim()) {
    await r3Finish();
  }
}

function toggleCameraTrack() {
  if (!r3ActiveStream) return;
  const videoTrack = r3ActiveStream.getVideoTracks()[0];
  if (!videoTrack) return;
  videoTrack.enabled = !videoTrack.enabled;

  const camBtn = document.getElementById('r3-cam-btn');
  if (camBtn) {
    camBtn.textContent = `📷 Camera: ${videoTrack.enabled ? 'ON' : 'OFF'}`;
    camBtn.style.background = videoTrack.enabled ? 'rgba(255,255,255,0.04)' : 'rgba(239, 68, 68, 0.1)';
    camBtn.style.color = videoTrack.enabled ? '#ffffff' : '#EF4444';
  }

  const cameraOffMsg = document.getElementById('camera-off-msg');
  if (cameraOffMsg) {
    cameraOffMsg.style.display = videoTrack.enabled ? 'none' : 'flex';
  }

  logIntegrityEvent(`Camera toggled ${videoTrack.enabled ? 'ON' : 'OFF'}`);
}

function toggleMicTrack() {
  if (!r3ActiveStream) return;
  const audioTrack = r3ActiveStream.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;

  const micBtn = document.getElementById('r3-mic-btn');
  if (micBtn) {
    micBtn.textContent = `🎤 Mic: ${audioTrack.enabled ? 'ON' : 'OFF'}`;
    micBtn.style.background = audioTrack.enabled ? 'rgba(255,255,255,0.04)' : 'rgba(239, 68, 68, 0.1)';
    micBtn.style.color = audioTrack.enabled ? '#ffffff' : '#EF4444';
  }

  if (!audioTrack.enabled && r3Recognition && r3IsListening) {
    try { r3Recognition.abort(); } catch (e) { }
    r3IsListening = false;
    if (document.getElementById('mic-pulse-indicator')) {
      document.getElementById('mic-pulse-indicator').style.display = 'none';
    }
  } else if (audioTrack.enabled && r3State === 'LISTENING' && !r3IsListening && r3InputMode === 'voice') {
    r3Listen();
  }

  logIntegrityEvent(`Microphone toggled ${audioTrack.enabled ? 'ON' : 'OFF'}`);
}

async function geminiCall(prompt) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  } catch (e) { return null; }
}
function updatePlacementProgress() {
  const { resume, r1, r2, r3, r1Score, r2Score, r3Score } = placementProgress;

  // 1. Calculate and update progress line width progressively across 3 segments
  let width = 0;
  if (resume) width = 33.33;
  if (r1) width = 66.66;
  if (r2 || r3) width = 100;
  const progressLine = document.getElementById('progress-line');
  if (progressLine) {
    progressLine.style.width = width + '%';
  }

  // 2. Identify active next-up step
  let activeStep = 'resume';
  if (resume && !r1) activeStep = 'r1';
  else if (resume && r1 && !r2) activeStep = 'r2';
  else if (resume && r1 && r2 && !r3) activeStep = 'r3';
  else if (resume && r1 && r2 && r3) activeStep = 'completed';

  function setCircleState(circleId, isCompleted, isActive) {
    const el = document.getElementById(circleId);
    if (!el) return;
    el.classList.remove('completed', 'active');
    el.style.background = '';
    el.style.color = '';
    el.style.borderColor = '';
    if (isCompleted) {
      el.classList.add('completed');
    } else if (isActive) {
      el.classList.add('active');
    }
  }

  setCircleState('step-resume-circle', resume, activeStep === 'resume');
  setCircleState('step-r1-circle', r1, activeStep === 'r1');
  setCircleState('step-r2-circle', r2, activeStep === 'r2');
  setCircleState('step-r3-circle', r3, activeStep === 'r3');

  // Sub-captions helper with animated Next Up badge
  function updateStepCaption(subEl, isCompleted, isActive, completedText, defaultText) {
    if (!subEl) return;
    subEl.classList.remove('highlight', 'placement-step-nextup');
    if (isCompleted) {
      subEl.textContent = completedText;
      subEl.classList.add('highlight');
    } else if (isActive) {
      subEl.innerHTML = 'Next Up <span class="nextup-arrow">→</span>';
      subEl.classList.add('placement-step-nextup');
    } else {
      subEl.textContent = defaultText;
    }
  }

  updateStepCaption(
    document.getElementById('step-resume-sub'),
    resume,
    activeStep === 'resume',
    'Uploaded ✅',
    'Always Open'
  );

  updateStepCaption(
    document.getElementById('step-r1-sub'),
    r1,
    activeStep === 'r1',
    (r1Score > 0 ? `${r1Score}% Score` : 'Passed') + ' ✅',
    'Aptitude & MCQs'
  );

  updateStepCaption(
    document.getElementById('step-r2-sub'),
    r2,
    activeStep === 'r2',
    (r2Score > 0 ? `${r2Score}% Score` : 'Passed') + ' ✅',
    'Coding Challenge'
  );

  updateStepCaption(
    document.getElementById('step-r3-sub'),
    r3,
    activeStep === 'r3',
    (r3Score > 0 ? `${r3Score}% Score` : 'Passed') + ' ✅',
    'AI Mock Interview'
  );

  // Dynamic Stepper Tooltips for Locked & Active Steps
  const resumeTooltip = document.getElementById('step-resume-tooltip');
  if (resumeTooltip) {
    resumeTooltip.textContent = resume ? 'Resume uploaded & analyzed ✅' : 'Upload and analyze resume to begin';
  }

  const r1Tooltip = document.getElementById('step-r1-tooltip');
  if (r1Tooltip) {
    if (r1) {
      r1Tooltip.textContent = 'Round 1 Completed ✅';
    } else if (resume) {
      r1Tooltip.textContent = 'Ready: Aptitude & Technical MCQs';
    } else {
      r1Tooltip.textContent = 'Complete Resume review to unlock Round 1';
    }
  }

  const r2Tooltip = document.getElementById('step-r2-tooltip');
  if (r2Tooltip) {
    if (r2) {
      r2Tooltip.textContent = 'Round 2 Completed ✅';
    } else if (r1) {
      r2Tooltip.textContent = 'Ready: Coding Challenge & DSA';
    } else {
      r2Tooltip.textContent = 'Pass Round 1 to unlock Round 2';
    }
  }

  const r3Tooltip = document.getElementById('step-r3-tooltip');
  if (r3Tooltip) {
    if (r3) {
      r3Tooltip.textContent = 'All Placement Milestones Cleared! 🎉';
    } else if (r2) {
      r3Tooltip.textContent = 'Ready: AI Mock Interview';
    } else {
      r3Tooltip.textContent = 'Pass Round 2 to unlock Round 3';
    }
  }

  const journeyStatus = document.getElementById('placement-journey-status');
  if (journeyStatus) {
    if (r3) {
      journeyStatus.textContent = 'All Milestones Cleared 🎉';
      journeyStatus.style.background = 'rgba(62,171,124,0.18)';
      journeyStatus.style.color = 'var(--pill-green)';
    } else {
      journeyStatus.textContent = 'Active Milestone';
      journeyStatus.style.background = 'rgba(62,171,124,0.12)';
      journeyStatus.style.color = 'var(--pill-green)';
    }
  }

  // Unlock sections
  const sec2 = document.getElementById('section-round2');
  const r2Lock = document.getElementById('r2-lock-text');
  if (r1) {
    if (sec2) {
      sec2.style.opacity = '1';
      sec2.style.pointerEvents = 'auto';
    }
    if (r2Lock) r2Lock.textContent = '✅ Round 1 Passed';
  } else {
    if (sec2) {
      sec2.style.opacity = '0.5';
      sec2.style.pointerEvents = 'none';
    }
    if (r2Lock) r2Lock.textContent = '🔒 Pass Round 1 to unlock';
  }

  const sec3 = document.getElementById('section-round3');
  const r3Lock = document.getElementById('r3-lock-text');
  if (r2) {
    if (sec3) {
      sec3.style.opacity = '1';
      sec3.style.pointerEvents = 'auto';
    }
    if (r3Lock) r3Lock.textContent = '✅ Round 2 Passed';
  } else {
    if (sec3) {
      sec3.style.opacity = '0.5';
      sec3.style.pointerEvents = 'none';
    }
    if (r3Lock) r3Lock.textContent = '🔒 Pass Round 2 to unlock';
  }
}

function scrollToRound(id) {
  const targetId = id === 'step-resume' ? 'section-resume' :
    id === 'step-r1' ? 'section-round1' :
      id === 'step-r2' ? 'section-round2' : 'section-round3';

  // Lock logic
  if (id === 'step-r1' && !placementProgress.resume) return showToast('Please upload your resume first!', 'warning');
  if (id === 'step-r2' && !placementProgress.r1) return showToast('Complete Round 1 first!', 'warning');
  if (id === 'step-r3' && !placementProgress.r2) return showToast('Complete Round 2 first!', 'warning');

  // Hide all sections
  document.querySelectorAll('.placement-card').forEach(c => {
    c.style.display = 'none';
  });

  // Show target section
  const targetEl = document.getElementById(targetId);
  if (targetEl) {
    targetEl.style.display = 'block';
    targetEl.style.animation = 'fadeUp 0.4s ease forwards';
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function savePlacementAttemptLegacy(round, score, passed) {
  await supabase.from('placement_attempts').insert({
    user_id: currentUserId,
    round,
    score,
    passed,
    details: { companyType: selectedCompanyType }
  });
}

async function generateFinalReport() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Basic styling
  doc.setFontSize(22);
  doc.setTextColor(0, 150, 105);
  doc.text("SkillBridge Placement Readiness Report", 20, 30);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 20, 38);

  doc.setDrawColor(0, 150, 105);
  doc.line(20, 42, 190, 42);

  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text(`Candidate Name: ${currentUserName || 'Student'}`, 20, 52);
  doc.text(`Target Track: ${r3PersonalizedContext?.targetRole || selectedCompanyType}`, 20, 60);

  doc.line(20, 66, 190, 66);

  doc.setFontSize(15);
  doc.text("Job Readiness Index Performance", 20, 78);

  doc.setFontSize(12);
  doc.text(`- Round 1 (Aptitude & Technical MCQ): ${placementProgress.r1Score ? placementProgress.r1Score + '%' : 'Not Assessed'}`, 25, 88);
  doc.text(`- Round 2 (Coding & DSA Challenge): ${placementProgress.r2Score ? placementProgress.r2Score + '%' : 'Not Assessed'}`, 25, 98);
  doc.text(`- Round 3 (AI Video Mock Interview): ${placementProgress.r3Score ? placementProgress.r3Score + '%' : 'Not Assessed'}`, 25, 108);

  const scores = [placementProgress.r1Score, placementProgress.r2Score, placementProgress.r3Score].filter(s => s > 0);
  const netScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 'N/A';
  doc.text(`Combined Job Readiness Score: ${netScore}%`, 25, 118);

  doc.line(20, 126, 190, 126);

  doc.setFontSize(15);
  doc.text("AI Interview Evaluation Summary", 20, 138);

  let reportFeedback = "The candidate demonstrated technical accuracy and project familiarity. Focus areas include technical communication, architectural reasoning, and backend design scaling.";
  if (r3Evaluations && r3Evaluations.length > 0) {
    const avgTech = Math.round(r3Evaluations.reduce((acc, curr) => acc + curr.technical_score, 0) / r3Evaluations.length);
    const avgComm = Math.round(r3Evaluations.reduce((acc, curr) => acc + curr.communication_score, 0) / r3Evaluations.length);
    doc.setFontSize(12);
    doc.text(`- Technical Content Score: ${avgTech}/100`, 25, 148);
    doc.text(`- Communication Skill Score: ${avgComm}/100`, 25, 156);
  }

  doc.setFontSize(12);
  doc.text("Actionable Recommendations:", 20, 168);
  const splitFeedback = doc.splitTextToSize(reportFeedback, 160);
  doc.text(splitFeedback, 20, 176);

  doc.save('SkillBridge_Placement_Report.pdf');
}

// ── Event Listeners ──────────────────────
document.querySelector('[data-tab="placement"]')
  ?.addEventListener('click', initPlacementTab);


// ── LEARNING RESOURCES ───────────────────────────────────────
let currentVideoData = null;

async function loadResourcesTab() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('roadmap_data, goal')
    .eq('id', session.user.id)
    .single();

  // Build quick topic chips from roadmap
  const chips = document.getElementById('quick-topic-chips');
  if (chips && profile?.roadmap_data?.phases) {
    const allSkills = [];
    profile.roadmap_data.phases.forEach(p => {
      (p.skills || []).forEach(s => {
        if (!allSkills.includes(s)) allSkills.push(s);
      });
    });

    chips.innerHTML = allSkills
      .slice(0, 10)
      .map(skill => `
        <button onclick="searchResources('${skill}')"
          style="padding:5px 12px;
          background:#F0FDF4;
          border:1px solid #A7F3D0;
          color:#059669;border-radius:20px;
          font-size:12px;cursor:pointer;
          transition:all 150ms;"
          onmouseover="this.style.background='#D1FAE5'"
          onmouseout="this.style.background='#F0FDF4'">
          ${skill}
        </button>
      `).join('');
  }

  // Auto-load videos for user's goal
  const goal = getGoalText(profile?.goal) || 'software development';
  await searchResources(goal + ' tutorial');

  // Load saved videos
  await loadSavedVideos(session.user.id);

  // Load saved notes
  const savedNotes = localStorage.getItem('user_notes_' + session.user.id);
  if (savedNotes) {
    const notesEl = document.getElementById('my-notes');
    if (notesEl) notesEl.value = savedNotes;
  }
}

async function searchResources(query) {
  if (!query?.trim()) return;

  const heading = document.getElementById('results-heading');
  const grid = document.getElementById('video-results-grid');
  const count = document.getElementById('results-count');

  if (heading) heading.textContent = `Searching: "${query}"...`;
  if (grid) grid.innerHTML = `
    ${Array(6).fill(0).map(() => `
      <div style="background:#F8FAFC;
        border-radius:12px;
        aspect-ratio:16/9;
        animation:pulse 1.5s infinite;">
      </div>
    `).join('')}
  `;

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search` +
      `?part=snippet` +
      `&q=${encodeURIComponent(query + ' tutorial')}` +
      `&type=video` +
      `&maxResults=9` +
      `&relevanceLanguage=en` +
      `&videoDuration=medium` +
      `&key=${YOUTUBE_API_KEY}`
    );

    if (!res.ok) throw new Error('YouTube API error');
    const data = await res.json();

    if (!data.items?.length) {
      if (grid) grid.innerHTML = `
        <div style="grid-column:1/-1;
          text-align:center;padding:40px;
          color:#94A3B8;font-size:14px;">
          No videos found for "${query}". 
          Try different keywords.
        </div>
      `;
      return;
    }

    if (heading) heading.textContent = `Results for: "${query}"`;
    if (count) count.textContent = `${data.items.length} videos`;

    if (grid) {
      grid.innerHTML = data.items.map(item => `
        <div style="background:white;
          border-radius:12px;
          border:1px solid #E2E8F0;
          overflow:hidden;cursor:pointer;
          transition:all 200ms;"
          onclick="playVideo(
            '${item.id.videoId}',
            '${item.snippet.title.replace(/'/g, "\\'").substring(0, 60)}',
            '${item.snippet.channelTitle.replace(/'/g, "\\'")}',
            '${item.snippet.thumbnails.medium.url}'
          )"
          onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 20px rgba(0,0,0,0.1)'"
          onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">

          <!-- Thumbnail -->
          <div style="position:relative;
            aspect-ratio:16/9;overflow:hidden;">
            <img src="${item.snippet.thumbnails.medium.url}"
              style="width:100%;height:100%;
              object-fit:cover;"
              loading="lazy">
            <div style="position:absolute;
              inset:0;background:rgba(0,0,0,0);
              display:flex;align-items:center;
              justify-content:center;
              transition:background 200ms;"
              onmouseover="this.style.background='rgba(0,0,0,0.3)'"
              onmouseout="this.style.background='rgba(0,0,0,0)'">
              <div style="width:44px;height:44px;
                background:rgba(255,255,255,0.9);
                border-radius:50%;
                display:flex;align-items:center;
                justify-content:center;
                font-size:18px;opacity:0;
                transition:opacity 200ms;"
                onmouseover="this.style.opacity='1'"
                onmouseout="this.style.opacity='0'">
                ▶
              </div>
            </div>
          </div>

          <!-- Video info -->
          <div style="padding:10px;">
            <div style="font-size:13px;
              font-weight:500;color:#0F172A;
              line-height:1.4;margin-bottom:4px;
              display:-webkit-box;
              -webkit-line-clamp:2;
              -webkit-box-orient:vertical;
              overflow:hidden;">
              ${item.snippet.title}
            </div>
            <div style="font-size:11px;
              color:#94A3B8;">
              ${item.snippet.channelTitle}
            </div>
          </div>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error('YouTube search error:', err);
    if (grid) grid.innerHTML = `
      <div style="grid-column:1/-1;
        text-align:center;padding:40px;">
        <div style="font-size:32px;
          margin-bottom:12px;">📺</div>
        <div style="font-size:14px;
          font-weight:500;margin-bottom:6px;">
          YouTube API error
        </div>
        <div style="font-size:13px;
          color:#64748B;">
          Could not load videos. Please check your connection or API key.
        </div>
      </div>
    `;
  }
}

function playVideo(videoId, title, channel, thumb) {
  currentVideoData = { videoId, title, channel, thumb };
  const overlay = document.getElementById('video-player-overlay');
  const iframe = document.getElementById('yt-player');
  const titleEl = document.getElementById('player-title');
  const infoEl = document.getElementById('player-info');

  if (iframe) {
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
  }
  if (titleEl) titleEl.textContent = title;
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="display:flex;gap:10px;
        align-items:center;">
        <span style="font-size:13px;
          color:rgba(255,255,255,0.7);">
          📺 ${channel}
        </span>
      </div>
    `;
  }
  if (overlay) overlay.style.display = 'flex';

  const notes = document.getElementById('my-notes');
  if (notes && !notes.value) {
    notes.placeholder = `Notes for: ${title}\n\nKey points:\n- \n- \n- \n\nSummary:\n`;
  }
}

function closeVideoPlayer() {
  const overlay = document.getElementById('video-player-overlay');
  const iframe = document.getElementById('yt-player');
  if (iframe) iframe.src = '';
  if (overlay) overlay.style.display = 'none';
  currentVideoData = null;
}

async function saveCurrentVideo() {
  if (!currentVideoData) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase
    .from('saved_resources')
    .upsert({
      user_id: session.user.id,
      video_id: currentVideoData.videoId,
      title: currentVideoData.title,
      channel: currentVideoData.channel,
      thumbnail: currentVideoData.thumb
    });

  if (!error) {
    const btn = document.getElementById('save-video-btn');
    if (btn) {
      btn.textContent = '✅ Saved!';
      btn.style.background = 'rgba(5,150,105,0.3)';
    }
    await loadSavedVideos(session.user.id);
  }
}

async function loadSavedVideos(userId) {
  const { data } = await supabase
    .from('saved_resources')
    .select('*')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })
    .limit(10);

  const list = document.getElementById('saved-videos-list');
  if (!list) return;

  if (!data || data.length === 0) {
    list.innerHTML = `<div style="padding:16px;text-align:center;font-size:13px;color:#94A3B8;">No saved videos yet</div>`;
    return;
  }

  list.innerHTML = data.map(v => `
    <div style="display:flex;gap:10px;
      padding:10px 12px;cursor:pointer;
      border-bottom:1px solid var(--border);
      border-radius:8px;
      transition:background 150ms;"
      onclick="playVideo('${v.video_id}',
        '${v.title?.replace(/'/g, "\\'")}',
        '${v.channel?.replace(/'/g, "\\'")}',
        '${v.thumbnail}')"
      onmouseover="this.style.background='var(--bg-card-hover)'"
      onmouseout="this.style.background='transparent'">
      <img src="${v.thumbnail}"
        style="width:60px;height:34px;
        border-radius:6px;object-fit:cover;
        border:1px solid var(--border);
        flex-shrink:0;">
      <div style="flex:1;overflow:hidden;">
        <div style="font-size:12px;
          font-weight:600;color:var(--text-primary);
          white-space:nowrap;overflow:hidden;
          text-overflow:ellipsis;">
          ${v.title}
        </div>
        <div style="font-size:11px;color:var(--text-muted);">
          ${v.channel}
        </div>
      </div>
    </div>
  `).join('');
}

async function saveNotes() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const notes = document.getElementById('my-notes')?.value;
  localStorage.setItem('user_notes_' + session.user.id, notes || '');
  showToast('📝 Notes saved!');
}

// Global click listener for closing overlay
document.addEventListener('click', (e) => {
  if (e.target.id === 'video-player-overlay') {
    closeVideoPlayer();
  }
});
// ── PROJECTS SYSTEM ──────────────────────────────────────────
const suggestedProjects = {
  frontend: [
    {
      title: 'Personal Portfolio Website',
      description: 'Build a responsive portfolio showcasing your skills and projects with animations.',
      tech_stack: ['HTML', 'CSS', 'JavaScript'],
      difficulty: 'Beginner',
      estimated_hours: 8,
      xp_reward: 50,
      checkpoints: [
        'Setup project structure',
        'Build navbar & hero section',
        'Add projects section',
        'Add contact form',
        'Deploy to GitHub Pages'
      ]
    },
    {
      title: 'Weather Dashboard App',
      description: 'Real-time weather app with 5-day forecast using OpenWeather API.',
      tech_stack: ['JavaScript', 'APIs', 'CSS'],
      difficulty: 'Intermediate',
      estimated_hours: 12,
      xp_reward: 100,
      checkpoints: [
        'Setup OpenWeather API',
        'Build search functionality',
        'Display current weather',
        'Add 5-day forecast',
        'Add geolocation support'
      ]
    },
    {
      title: 'Full Stack Todo App',
      description: 'CRUD application with React frontend and Supabase backend.',
      tech_stack: ['React', 'Supabase', 'CSS'],
      difficulty: 'Intermediate',
      estimated_hours: 16,
      xp_reward: 150,
      checkpoints: [
        'Setup React project',
        'Connect Supabase database',
        'Build Create/Read operations',
        'Add Update/Delete',
        'Add user authentication'
      ]
    },
    {
      title: 'E-commerce Product Page',
      description: 'Pixel-perfect product page with cart functionality.',
      tech_stack: ['React', 'Context API', 'CSS'],
      difficulty: 'Advanced',
      estimated_hours: 20,
      xp_reward: 200,
      checkpoints: [
        'Design product layout',
        'Add image gallery',
        'Build cart context',
        'Add to cart functionality',
        'Checkout flow UI'
      ]
    }
  ],
  backend: [
    {
      title: 'REST API with Authentication',
      description: 'Build a secure REST API with JWT auth and PostgreSQL.',
      tech_stack: ['Node.js', 'Express', 'PostgreSQL'],
      difficulty: 'Intermediate',
      estimated_hours: 14,
      xp_reward: 120,
      checkpoints: [
        'Setup Express server',
        'Connect PostgreSQL',
        'Add user registration',
        'Add JWT authentication',
        'Build CRUD endpoints'
      ]
    },
    {
      title: 'Real-time Chat Application',
      description: 'WebSocket-based chat app with rooms and online status.',
      tech_stack: ['Node.js', 'Socket.io', 'React'],
      difficulty: 'Advanced',
      estimated_hours: 20,
      xp_reward: 200,
      checkpoints: [
        'Setup Socket.io server',
        'Build chat rooms',
        'Add online status',
        'Message history',
        'Deploy application'
      ]
    }
  ]
};

async function loadProjects() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('goal, roadmap_data')
    .eq('id', session.user.id)
    .single();

  const { data: dbProjects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', session.user.id)
    .order('status');

  const goal = (getGoalText(profile?.goal) || '').toLowerCase();
  let suggested = suggestedProjects.frontend;
  if (goal.includes('backend') || goal.includes('node') || goal.includes('python')) {
    suggested = suggestedProjects.backend;
  }

  const roadmapProjects = [];
  if (profile?.roadmap_data?.phases) {
    profile.roadmap_data.phases.forEach(p => {
      if (p.project) {
        roadmapProjects.push({
          title: p.project,
          description: `Phase project: ${p.phase}`,
          tech_stack: p.skills || [],
          difficulty: 'Intermediate',
          estimated_hours: 10,
          xp_reward: 100,
          from_roadmap: true,
          phase: p.phase
        });
      }
    });
  }

  const allProjects = [
    ...(dbProjects || []),
    ...roadmapProjects.filter(rp => !(dbProjects || []).find(dp => dp.title === rp.title)),
    ...suggested.filter(sp => !(dbProjects || []).find(dp => dp.title === sp.title))
  ];

  window.allProjectsData = allProjects;
  renderProjectsGrid(allProjects);
}

function renderProjectsGrid(projects) {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  if (!projects?.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">
        No projects yet. Generate your roadmap to get project suggestions!
      </div>
    `;
    return;
  }

  grid.innerHTML = projects.map((proj, i) => {
    const isDone = proj.status === 'completed';
    const pct = proj.progress_pct || 0;
    const diffColor = {
      'Beginner': '#18C98B',
      'Intermediate': '#FFB72B',
      'Advanced': '#FF4D5E'
    }[proj.difficulty] || '#8B96A8';

    return `
      <div class="cc-card" style="padding:0;overflow:hidden;cursor:pointer;"
        onclick="openProjectDetail(${i})">
        <div style="padding:16px;border-bottom:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <span class="cc-badge" style="background:${diffColor}20;color:${diffColor};border:1px solid ${diffColor}40;">
                ${proj.difficulty || 'Intermediate'}
              </span>
              ${proj.from_roadmap ? `<span class="cc-badge badge-purple">Roadmap</span>` : ''}
              ${proj.is_custom ? `<span class="cc-badge badge-cyan">Custom</span>` : ''}
              ${isDone ? `<span class="cc-badge badge-green">✓ Done</span>` : ''}
            </div>
            <span style="font-size:13px;font-weight:700;color:var(--brand-light);">+${proj.xp_reward || 100} XP</span>
          </div>
          <h4 style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:6px;line-height:1.3;">${proj.title}</h4>
          <p style="font-size:12px;color:var(--text-secondary);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${proj.description || ''}</p>
        </div>
        <div style="padding:10px 16px;display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--border);">
          ${(proj.tech_stack || []).map(t => `<span class="role-pill" style="padding:3px 10px;font-size:11px;">${t}</span>`).join('')}
        </div>
        <div style="padding:12px 16px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:6px;">
            <span>Progress</span><span>${pct}%</span>
          </div>
          <div class="cc-progress-container" style="height:6px;">
            <div class="cc-progress-bar" style="width:${pct}%;"></div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">~${proj.estimated_hours || 10} hours</div>
        </div>
      </div>
    `;
  }).join('');
}

function filterProjects(filter, btn) {
  ['all', 'active', 'completed', 'custom'].forEach(f => {
    const b = document.getElementById('proj-filter-' + f);
    if (b) {
      b.style.background = f === filter ? 'var(--primary)' : '#FFFFFF';
      b.style.color = f === filter ? '#FFFFFF' : 'var(--text-secondary)';
      b.style.border = f === filter ? '1px solid var(--primary)' : '1px solid var(--border)';
    }
  });
  const all = window.allProjectsData || [];
  const filtered = filter === 'all' ? all
    : filter === 'active' ? all.filter(p => p.status === 'in_progress' || !p.status)
      : filter === 'completed' ? all.filter(p => p.status === 'completed')
        : all.filter(p => p.is_custom);
  renderProjectsGrid(filtered);
}

async function openProjectDetail(index) {
  const proj = window.allProjectsData?.[index];
  if (!proj) return;
  const modal = document.getElementById('project-detail-modal');
  const content = document.getElementById('project-detail-content');
  if (!modal || !content) return;

  const checkpoints = proj.checkpoints || [];
  content.innerHTML = `
    <div style="padding:24px;background:#FFFFFF;color:var(--text-primary);border-radius:18px;border:1px solid var(--border);box-shadow:0 20px 60px rgba(23,40,58,0.12);">
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
        <div style="flex:1;">
          <h3 style="font-size:18px;font-weight:700;color:var(--navy);margin-bottom:6px;">${proj.title}</h3>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.5;">${proj.description}</p>
        </div>
        <button onclick="closeProjectDetail()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted);flex-shrink:0;margin-left:10px;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
        <div style="background:var(--surface-blue);border:1px solid var(--border-blue);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:16px;font-weight:700;color:var(--primary-dark);">+${proj.xp_reward || 100}</div>
          <div style="font-size:11px;color:var(--text-muted);">XP Reward</div>
        </div>
        <div style="background:var(--surface-blue);border:1px solid var(--border-blue);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:16px;font-weight:700;color:var(--navy);">~${proj.estimated_hours || 10}h</div>
          <div style="font-size:11px;color:var(--text-muted);">Estimated</div>
        </div>
        <div style="background:var(--surface-blue);border:1px solid var(--border-blue);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:16px;font-weight:700;color:var(--navy);">${checkpoints.length}</div>
          <div style="font-size:11px;color:var(--text-muted);">Checkpoints</div>
        </div>
      </div>
      ${checkpoints.length > 0 ? `
        <div style="margin-bottom:20px;">
          <h4 style="font-size:13px;font-weight:700;color:var(--navy);text-transform:uppercase;margin-bottom:12px;">📋 Checkpoints</h4>
          ${checkpoints.map((cp, ci) => `
            <div style="display:flex;gap:10px;align-items:center;padding:10px 14px;background:var(--surface-blue);border:1px solid var(--border-blue);border-radius:8px;margin-bottom:6px;">
              <div style="width:18px;height:18px;border-radius:50%;border:2px solid var(--primary);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;"></div>
              <span style="font-size:13px;color:var(--navy);">${cp}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div style="margin-bottom:20px;">
        <label style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;display:block;">GitHub Repository URL</label>
        <div style="display:flex;gap:8px;">
          <input id="proj-github-input" value="${proj.github_url || ''}" placeholder="https://github.com/..." style="flex:1;padding:10px 14px;background:#FFFFFF;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--text-primary);outline:none;">
          <button onclick="saveGithubUrl(${index})" class="btn-primary" style="padding:8px 16px;font-size:13px;">Save</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${proj.status !== 'completed' ? `
          <button onclick="markProjectComplete(${index})" class="btn-action" style="padding:12px;font-size:14px;">✅ Mark Complete</button>
        ` : `<div style="padding:12px;background:rgba(24,201,139,0.1);border:1px solid rgba(24,201,139,0.3);border-radius:10px;font-size:14px;font-weight:600;color:var(--success);text-align:center;">✓ Completed!</div>`}
        <button onclick="closeProjectDetail()" class="btn-outline" style="padding:12px;font-size:14px;">Close</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

async function markProjectComplete(index) {
  const proj = window.allProjectsData?.[index];
  if (!proj) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  if (proj.id) {
    await supabase.from('projects').update({ status: 'completed', progress_pct: 100, completed_at: new Date().toISOString() }).eq('id', proj.id);
  } else {
    await supabase.from('projects').insert({
      user_id: session.user.id, title: proj.title, description: proj.description,
      tech_stack: proj.tech_stack, difficulty: proj.difficulty, status: 'completed',
      progress_pct: 100, xp_reward: proj.xp_reward || 100, completed_at: new Date().toISOString()
    });
  }
  const { data: profile } = await supabase.from('profiles').select('xp').eq('id', session.user.id).single();
  await supabase.from('profiles').update({ xp: (profile?.xp || 0) + (proj.xp_reward || 100) }).eq('id', session.user.id);
  closeProjectDetail();
  await addNotification('🚀 Project Completed!', `You completed "${proj.title}" and earned ${proj.xp_reward || 100} XP!`);
  loadProjects();
}

async function createCustomProject() {
  const title = document.getElementById('cp-title')?.value?.trim();
  if (!title) { showToast('Please enter a project title'); return; }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const tech = document.getElementById('cp-tech')?.value?.split(',').map(t => t.trim()).filter(Boolean) || [];
  await supabase.from('projects').insert({
    user_id: session.user.id, title, description: document.getElementById('cp-desc')?.value || '',
    tech_stack: tech, difficulty: document.getElementById('cp-diff')?.value || 'Intermediate',
    github_url: document.getElementById('cp-github')?.value || '',
    status: 'in_progress', is_custom: true, xp_reward: 100
  });
  closeCreateProjectModal();
  showToast('✅ Project created!');
  loadProjects();
}

function openCreateProjectModal() { document.getElementById('create-project-modal').style.display = 'flex'; }
function closeCreateProjectModal() { document.getElementById('create-project-modal').style.display = 'none'; }
function closeProjectDetail() { document.getElementById('project-detail-modal').style.display = 'none'; }

window.loadProjects = loadProjects;
window.filterProjects = filterProjects;
window.openProjectDetail = openProjectDetail;
window.markProjectComplete = markProjectComplete;
window.createCustomProject = createCustomProject;
window.openCreateProjectModal = openCreateProjectModal;
window.closeCreateProjectModal = closeCreateProjectModal;
window.closeProjectDetail = closeProjectDetail;

async function saveGithubUrl(index) {
  const proj = window.allProjectsData?.[index];
  if (!proj) return;
  const url = document.getElementById('proj-github-input')?.value;

  if (proj.id) {
    await supabase.from('projects').update({ github_url: url }).eq('id', proj.id);
    showToast('🚀 GitHub URL updated!');
    loadProjects();
  } else {
    showToast('Start the project first by marking a checkpoint or completing it!');
  }
}

async function toggleCheckpoint(projIndex, cpIndex, id) {
  const circle = document.getElementById(`cp-circle-${projIndex}-${cpIndex}`);
  if (circle) {
    const isDone = circle.style.background === 'rgb(16, 185, 129)'; // #10B981
    circle.style.background = isDone ? 'transparent' : '#10B981';
    circle.style.borderColor = isDone ? '#E2E8F0' : '#10B981';
    circle.innerHTML = isDone ? '' : '✓';
    circle.style.color = 'white';
  }
}

window.saveGithubUrl = saveGithubUrl;
window.toggleCheckpoint = toggleCheckpoint;

// ══ AI MENTOR SYSTEM ══
let mentorHistory = [];
let mentorMsgCount = 0;
let topicsCovered = new Set();

async function initMentorChat() {
  if (window.mentorChatInitialized) return;
  window.mentorChatInitialized = true;

  const badge = document.getElementById('mentor-power-badge');
  if (badge) {
    badge.textContent = GROQ_API_KEY ? 'Powered by Llama 3.3 (Groq)' : 'Powered by Llama 3.1 · Free';
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name,goal,current_level,roadmap_data,xp,level')
    .eq('id', session.user.id)
    .single();

  const goalText = getGoalText(profile?.goal) || 'Software Developer';

  // Build system context
  window.mentorSystemPrompt = `
You are Atlas, a friendly and knowledgeable AI career mentor for Indian tech students.

Student profile:
- Name: ${profile?.full_name || 'Student'}
- Goal: ${goalText}
- Current Level: ${profile?.current_level || 'Beginner'}
- XP: ${profile?.xp || 0} | Level: ${profile?.level || 1}
- Current roadmap: ${profile?.roadmap_data?.phases?.[0]?.phase || 'Not set yet'}

Your personality:
- Encouraging and motivating
- Uses simple language + occasional Hindi phrases like "bilkul", "ekdum sahi"
- Gives specific, actionable advice
- Mentions real resources (LeetCode, YouTube etc.)
- Knows Indian job market well (TCS, Infosys, startups, FAANG India)
- Keeps responses concise (max 150 words)
- Uses emojis occasionally

Rules:
- ONLY answer career, tech, learning, interview, resume related questions
- If asked unrelated questions say: "Main sirf career aur tech questions answer kar sakta hoon! 😊"
- Never make up fake company details
- Always end with an actionable tip
  `;

  // Welcome message
  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  addMentorMessage('ai',
    `Hey ${firstName}! 👋 I'm **Atlas**, your AI career mentor.\n\nI know your goal is to become a **${goalText}** and you're currently at ${profile?.current_level || 'beginner'} level.\n\nI'm here to guide you with roadmap advice, interview prep, resume tips, and more. What would you like to work on today? 🚀`
  );
}

function addMentorMessage(role, text) {
  const container = document.getElementById('mentor-messages');
  if (!container) return;

  const isAI = role === 'ai';
  const div = document.createElement('div');
  div.style.cssText = `
    display:flex;gap:8px;
    justify-content:${isAI ? 'flex-start' : 'flex-end'};
    animation:fadeUp 300ms ease-out;
    margin-bottom: 12px;
  `;

  // Format text with markdown-like styling
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  div.innerHTML = `
    ${isAI ? `
      <div style="width:32px;height:32px;
        border-radius:50%;flex-shrink:0;
        background:var(--accent-soft);
        border:1.5px solid var(--accent-primary);
        display:flex;align-items:center;
        justify-content:center;font-size:16px;
        margin-top:4px;">🤖</div>
    ` : ''}
    <div style="
      max-width:75%;padding:12px 18px;
      border-radius:16px;
      border-${isAI ? 'bottom-left' : 'bottom-right'}-radius:4px;
      background:${isAI ? 'var(--bg-secondary)' : 'var(--accent-primary)'};
      color:${isAI ? 'var(--text-primary)' : '#FFFFFF'};
      font-size:14px;line-height:1.6;
      border:${isAI ? '1.5px solid var(--border-strong)' : 'none'};
      box-shadow:${isAI ? 'var(--shadow-card)' : 'none'};
    ">${formatted}</div>
    ${!isAI ? `
      <div style="width:32px;height:32px;
        border-radius:50%;flex-shrink:0;
        background:var(--pill-purple);
        display:flex;align-items:center;
        justify-content:center;font-size:14px;
        color:white;font-weight:700;margin-top:4px;">
        ${currentUserName?.charAt(0) || 'U'}
      </div>
    ` : ''}
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  // Update stats
  mentorMsgCount++;
  const countEl = document.getElementById('chat-msg-count');
  if (countEl) countEl.textContent = mentorMsgCount;
}

async function sendMentorMessage() {
  const input = document.getElementById('mentor-input');
  const msg = input?.value?.trim();
  if (!msg) return;

  addMentorMessage('user', msg);
  input.value = '';
  mentorHistory.push({ role: 'user', content: msg });

  // Show typing
  const typing = document.getElementById('mentor-typing');
  if (typing) typing.style.display = 'block';

  // Track topics
  const topics = ['resume', 'interview', 'dsa', 'roadmap', 'career', 'project', 'skill'];
  topics.forEach(t => {
    if (msg.toLowerCase().includes(t)) {
      topicsCovered.add(t);
    }
  });
  const topicsEl = document.getElementById('chat-topics-count');
  if (topicsEl) topicsEl.textContent = topicsCovered.size;

  let success = false;
  let reply = '';

  // Try Groq first with multi-model fallback
  if (GROQ_API_KEY) {
    const groqModels = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama3-8b-8192', 'llama3-70b-8192'];
    for (const model of groqModels) {
      try {
        const messages = [
          { role: 'system', content: window.mentorSystemPrompt },
          ...mentorHistory.slice(-6)
        ];

        console.log(`[sendMentorMessage] Attempting prompt with Groq (${model})...`);
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: model,
            messages,
            max_tokens: 400,
            temperature: 0.7
          })
        });

        if (res.ok) {
          const data = await res.json();
          reply = data.choices?.[0]?.message?.content || '';
          if (reply) {
            success = true;
            console.log(`[sendMentorMessage] Success with Groq (${model})`);
            break;
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn(`[sendMentorMessage] Groq (${model}) returned status:`, res.status, errData);
          if (res.status === 401) break;
        }
      } catch (err) {
        console.error(`[sendMentorMessage] Groq (${model}) chat error:`, err);
      }
    }
  }

  // Try OpenRouter if Groq failed
  if (!success && OPENROUTER_KEY) {
    const openrouterModels = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'mistralai/mistral-7b-instruct:free'
    ];
    for (const model of openrouterModels) {
      try {
        const messages = [
          { role: 'system', content: window.mentorSystemPrompt },
          ...mentorHistory.slice(-6)
        ];

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_KEY}`,
            'HTTP-Referer': window.location.origin
          },
          body: JSON.stringify({
            model: model,
            messages,
            max_tokens: 400,
            temperature: 0.7
          })
        });

        if (res.ok) {
          const data = await res.json();
          reply = data.choices?.[0]?.message?.content || '';
          if (reply) {
            success = true;
            console.log(`[sendMentorMessage] Success with OpenRouter (${model})`);
            break;
          }
        } else {
          if (res.status === 401) break;
        }
      } catch (err) {
        console.error('OpenRouter chat error:', err);
      }
    }
  }

  // Fallback to Gemini if other providers failed
  if (!success && GEMINI_KEY) {
    const geminiModels = ['gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    for (const model of geminiModels) {
      try {
        console.log(`[sendMentorMessage] Falling back to Gemini (${model})...`);
        const contents = mentorHistory.slice(-6).map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        }));

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: window.mentorSystemPrompt || 'You are Atlas, a professional career mentor.' }]
            },
            generationConfig: {
              maxOutputTokens: 400,
              temperature: 0.7
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (reply) {
            success = true;
            console.log(`[sendMentorMessage] Success with Gemini (${model})`);
            break;
          }
        }
      } catch (err) {
        console.error('Gemini fallback chat error:', err);
      }
    }
  }

  // Intelligent Contextual Fallback if all external APIs are unreachable/exhausted
  if (!success || !reply) {
    const lower = msg.toLowerCase();
    if (lower.includes('resume')) {
      reply = `**Resume Optimization Tips from Atlas:**\n\n1. **Use Action Verbs & Metrics**: Instead of *"worked on APIs"*, write *"Built scalable REST APIs in Node.js reducing latency by 35%"*.\n2. **Keep it 1-Page**: Focus strictly on relevant technical projects and skills.\n3. **Include Live Links**: Add your GitHub repository and live deployment URLs for each major project.\n\n*Actionable Tip*: Run your resume through our **Placement Simulator** in the sidebar to get instant ATS feedback! 🚀`;
      success = true;
    } else if (lower.includes('interview')) {
      reply = `**Interview Preparation Strategy:**\n\n1. **DSA & Core CS**: Master Arrays, Strings, Hashing, and Trees (75-100 standard LeetCode problems).\n2. **STAR Method**: Practice Behavioral questions using *Situation, Task, Action, Result*.\n3. **Mock Interviews**: Practice articulating your thought process out loud.\n\n*Actionable Tip*: Head over to the **Placement** tab to attempt the AI Video Mock Interview! 🎯`;
      success = true;
    } else if (lower.includes('placed') || lower.includes('how long')) {
      reply = `**Placement Timeline Guide:**\n\nWith consistent 2-3 hours daily practice, students typically become job-ready in **3 to 6 months**:\n- **Month 1-2**: Foundation & Core Skills (Languages, Data Structures)\n- **Month 3-4**: 2 Full-stack or Domain Projects & Portfolio\n- **Month 5-6**: Active Application & Mock Interviews\n\n*Actionable Tip*: Complete your daily roadmap checkpoints to maintain your streak! ⚡`;
      success = true;
    } else if (lower.includes('dsa') || lower.includes('algorithm')) {
      reply = `**Top DSA Resources Recommended by Atlas:**\n\n1. **NeetCode 150 / Striver's SDE Sheet**: Best curated problem sets.\n2. **LeetCode**: Practice Easy and Medium problems consistently.\n3. **SkillBridge Quick Test**: Assess your algorithmic strengths right here!\n\n*Actionable Tip*: Solve at least 2 problems daily before moving to new tech stacks. 💡`;
      success = true;
    } else if (lower.includes('skill') || lower.includes('learn next') || lower.includes('roadmap')) {
      reply = `**Next Recommended Skills:**\n\nBased on your profile, focus on:\n1. **Core Problem Solving**: Data structures & algorithm fundamentals.\n2. **Industry Frameworks**: Modern tooling & API integration.\n3. **System Design Basics**: Caching, databases, and microservice basics.\n\n*Actionable Tip*: Check the **AI Roadmap** tab for your personalized step-by-step path! 🗺️`;
      success = true;
    } else {
      reply = `Bilkul! Based on your target goals, the key is consistent daily learning and building hands-on projects. Focus on completing your active roadmap checkpoints and practicing interview scenarios.\n\nWhat specific topic would you like to explore next? 🚀`;
      success = true;
    }
  }

  if (typing) typing.style.display = 'none';

  if (success && reply) {
    addMentorMessage('ai', reply);
    mentorHistory.push({ role: 'assistant', content: reply });
  } else {
    addMentorMessage('ai', 'Network issue or API error! Please check your connection and try again. 🔌 (All fallback providers failed)');
  }
}

function sendQuickPrompt(q) {
  const input = document.getElementById('mentor-input');
  if (input) input.value = q;
  sendMentorMessage();
}

function sendQuickQuestion(q) {
  sendQuickPrompt(q);
}

function clearMentorChat() {
  mentorHistory = [];
  mentorMsgCount = 0;
  topicsCovered = new Set();
  const container = document.getElementById('mentor-messages');
  if (container) container.innerHTML = '';
  const countEl = document.getElementById('chat-msg-count');
  if (countEl) countEl.textContent = '0';
  const topicsEl = document.getElementById('chat-topics-count');
  if (topicsEl) topicsEl.textContent = '0';
  initMentorChat();
}

window.sendMentorMessage = sendMentorMessage;
window.sendQuickPrompt = sendQuickPrompt;
window.sendQuickQuestion = sendQuickPrompt;
window.clearMentorChat = clearMentorChat;
window.initMentorChat = initMentorChat;




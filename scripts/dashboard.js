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

const SUPABASE_URL = ENV_CONFIG.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = ENV_CONFIG.SUPABASE_ANON_KEY || '';
const OPENROUTER_KEY = ENV_CONFIG.OPENROUTER_KEY || '';
const GEMINI_KEY = ENV_CONFIG.GEMINI_KEY || '';
const YOUTUBE_API_KEY = ENV_CONFIG.YOUTUBE_API_KEY || '';

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

document.addEventListener('DOMContentLoaded',
  async () => {
    // 1. Supabase FIRST
    initSupabase();
    if (!supabase) return;

    // 2. Theme
    initTheme();
    
    // 3. Check auth
    try {
      const { data: { session } } = 
        await supabase.auth.getSession();
      
      if (!session) {
        window.location.href = 'auth.html';
        return;
      }
      
      currentUserId = session.user.id;
      
      // 4. Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      console.log('Profile loaded:', profile);
      
      // 5. Init everything
      initInteractions();
      initTabs();
      
      if (profile?.onboarding_completed) {
        // Hide onboarding, show dashboard
        const overlay = document.getElementById(
          'onboarding-overlay'
        );
        if (overlay) overlay.style.display = 'none';
        await initDashboard(profile);
      } else {
        // Show onboarding
        showOnboarding(profile);
      }
    } catch(err) {
      console.error('Init error:', err);
      window.location.href = 'auth.html';
    }
  }
);

function initSupabase() {
  try {
    const lib = window.supabase 
      || window.supabasejs
      || window.Supabase;
    if (!lib || !lib.createClient) {
      console.error('Supabase lib not found');
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;
          justify-content:center;min-height:100vh;
          font-family:sans-serif;background:#0F172A;">
          <div style="text-align:center;color:white;">
            <h2>⚠️ Connection Error</h2>
            <p style="color:#94A3B8;margin:12px 0;">
              Failed to load. Please refresh.
            </p>
            <button onclick="location.reload()"
              style="background:#059669;color:white;
              border:none;padding:10px 24px;
              border-radius:8px;cursor:pointer;
              font-size:14px;">
              🔄 Refresh
            </button>
          </div>
        </div>`;
      return;
    }
    supabase = lib.createClient(
      SUPABASE_URL, 
      SUPABASE_ANON_KEY
    );
    console.log('✅ Supabase ready');
  } catch(err) {
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
    addMessage('⚠️ I had some trouble with the AI, but I\'ve created a standard roadmap for you to get started! You can customize it later.');
    const fallback = getSmartFallback(onboardingData.goal || 'Software Developer');
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
      <div id="qt-overall-score" style="font-size: 48px; font-weight: 800; color: var(--emerald); margin-bottom: 4px;">${latest.score}%</div>
      <div id="qt-score-level" style="font-size: 14px; font-weight: 600; color: #ffffff; margin-bottom: 12px;">
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
      const color = score >= 80 ? 'var(--emerald)' : score >= 60 ? 'var(--emerald)' : score >= 40 ? 'var(--warning)' : 'var(--text-error)';
      return `
        <div>
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
            <span style="color:#ffffff; font-weight:600;">${skillName}</span>
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
        if (diff > 0) diffText = `<span style="color:var(--emerald); font-size:11px; font-weight:600; margin-top:2px; display:block;">↑ +${diff}% from previous test</span>`;
        else if (diff < 0) diffText = `<span style="color:var(--text-error); font-size:11px; font-weight:600; margin-top:2px; display:block;">↓ ${diff}% from previous test</span>`;
      }
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:10px; font-size:13px;">
          <div>
            <strong style="color:#ffffff;">${a.date}</strong>
            <div style="color:var(--text-muted); font-size:11px; margin-top:2px;">${a.trackName}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; color:var(--emerald);">${a.score}%</div>
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

async function startRecommendedLearning() {
  const { data: dbTasks } = await supabase.from('tasks').select('*').eq('user_id', currentUserId);
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
async function openTaskDetail(taskId) {
  let task = window.allTasks?.find(t => t.id === taskId);
  if (!task) {
    const { data } = await supabase.from('tasks').select('*').eq('id', taskId).single();
    if (!data) return;
    task = data;
    if (!window.allTasks) window.allTasks = [];
    window.allTasks.push(task);
  }

  const modal = document.createElement('div');
  modal.id = 'task-detail-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;`;

  const diffColor = { 'Easy': '#10B981', 'Medium': '#F59E0B', 'Hard': '#EF4444' }[task.difficulty] || '#94A3B8';

  modal.innerHTML = `
    <div style="
      background:white;
      border-radius:24px;
      padding:32px;
      max-width:560px;width:100%;
      box-shadow:0 24px 60px rgba(0,0,0,0.2);
      max-height:90vh;
      overflow-y:auto;
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

      <div style="margin-bottom:24px;">
        <div style="font-size:12px;font-weight:700;color:#94A3B8;text-transform:uppercase;margin-bottom:12px;">Learning Resources</div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <!-- Link 1: Documentation -->
          <a href="${task.resource_link || 'https://developer.mozilla.org'}" target="_blank" 
            style="display:flex;flex-direction:column;gap:8px;padding:16px;background:#F8FAFC;border-radius:16px;text-decoration:none;border:1px solid #E2E8F0;transition:all 200ms;"
            onmouseover="this.style.borderColor='#059669';this.style.background='#F0FDF4'"
            onmouseout="this.style.borderColor='#E2E8F0';this.style.background='#F8FAFC'"
          >
            <span style="font-size:20px;">🌐</span>
            <div>
              <div style="font-weight:700;font-size:13px;color:#0F172A;">Official Docs</div>
              <div style="font-size:11px;color:#64748B;">External tutorial</div>
            </div>
          </a>

          <!-- Link 2: AI Study Hub -->
          <button onclick="document.getElementById('task-detail-modal').remove(); generateCourseNotes('${task.id}', '${task.title.replace(/'/g, "\\'")}')"
            style="display:flex;flex-direction:column;gap:8px;padding:16px;background:#F0FDF4;border-radius:16px;border:1px solid #059669;cursor:pointer;text-align:left;transition:all 200ms;"
            onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(5,150,105,0.1)'"
            onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'"
          >
            <span style="font-size:20px;">📖</span>
            <div>
              <div style="font-weight:700;font-size:13px;color:#065F46;">Study Hub</div>
              <div style="font-size:11px;color:#059669;">Docs & Video Guide</div>
            </div>
          </button>
        </div>
      </div>

      <!-- Notes Preview Area -->
      <div id="course-notes-container" style="display:none;margin-bottom:24px;padding:16px;background:#F8FAFC;border-radius:16px;border:1px solid #E2E8F0;font-size:14px;color:#334155;line-height:1.6;">
        <div id="notes-content"></div>
      </div>

      <div style="background:linear-gradient(135deg,#ECFDF5,#D1FAE5);border-radius:16px;padding:20px;margin-bottom:28px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:14px;font-weight:700;color:#065F46;">Skill Assessment</div>
            <div style="font-size:12px;color:#047857;margin-top:2px;">Must score 80% to unlock next step</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:800;color:#059669;">+${task.difficulty === 'Hard' ? 50 : task.difficulty === 'Medium' ? 30 : 15} XP</div>
          </div>
        </div>
      </div>

      <button onclick="document.getElementById('task-detail-modal').remove();startQuiz('${task.id}','${task.title.replace(/'/g, "\\'")}','${task.roadmap_phase || ''}')" 
        style="width:100%;background:#059669;color:white;border:none;padding:16px;border-radius:16px;font-size:15px;font-weight:700;cursor:pointer;transition:all 200ms;box-shadow: 0 4px 12px rgba(5,150,105,0.25);"
        onmouseover="this.style.background='#047857';this.style.transform='translateY(-2px)'"
        onmouseout="this.style.background='#059669';this.style.transform='translateY(0)'"
      >🎯 Begin Assessment</button>
    </div>
  `;
  document.body.appendChild(modal);
}

async function generateCourseNotes(taskId, title) {
  // Create a dedicated high-fidelity popup for course notes
  const viewer = document.createElement('div');
  viewer.id = 'course-viewer-modal';
  viewer.style.cssText = `position:fixed;inset:0;background:rgba(5,1,13,0.95);backdrop-filter:blur(20px);z-index:10000;display:flex;flex-direction:column;padding:0;overflow-y:auto;font-family:'Inter',sans-serif;color:#FFFFFF;animation:viewerFadeIn 0.4s ease-out both;`;

  viewer.innerHTML = `
    <style>
      @keyframes viewerFadeIn {
        from { opacity: 0; transform: scale(0.98) translateY(10px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes shimmerDark {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .shimmer-dark {
        background: linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%);
        background-size: 200% 100%;
        animation: shimmerDark 1.5s infinite;
      }
      .viewer-card {
        background: rgba(12, 5, 31, 0.65);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 24px;
        padding: 36px;
        backdrop-filter: blur(12px);
        box-shadow: 0 20px 40px rgba(0,0,0,0.4);
      }
      .viewer-markdown h1, .viewer-markdown h2, .viewer-markdown h3 {
        color: #FFFFFF;
        margin-top: 1.8rem;
        margin-bottom: 1rem;
        font-weight: 700;
      }
      .viewer-markdown h1 { font-size: 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; }
      .viewer-markdown h2 { font-size: 1.5rem; color: #D946EF; }
      .viewer-markdown h3 { font-size: 1.2rem; }
      .viewer-markdown p {
        color: #CBD5E1;
        line-height: 1.75;
        margin-bottom: 1.2rem;
      }
      .viewer-markdown code {
        background: rgba(255,255,255,0.06);
        padding: 3px 6px;
        border-radius: 6px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 0.9em;
        color: #F472B6;
      }
      .viewer-markdown pre {
        background: #0B0424;
        border: 1px solid rgba(255,255,255,0.08);
        padding: 20px;
        border-radius: 12px;
        overflow-x: auto;
        margin-bottom: 1.5rem;
      }
      .viewer-markdown pre code {
        background: none;
        padding: 0;
        color: #E2E8F0;
        font-size: 0.88rem;
      }
      .viewer-markdown ul, .viewer-markdown ol {
        margin-bottom: 1.2rem;
        padding-left: 24px;
        color: #CBD5E1;
      }
      .viewer-markdown li {
        margin-bottom: 0.5rem;
      }
      .viewer-markdown blockquote {
        border-left: 4px solid #D946EF;
        background: rgba(217, 70, 239, 0.05);
        padding: 12px 20px;
        margin: 1.5rem 0;
        border-radius: 0 8px 8px 0;
        color: #E2E8F0;
      }
    </style>

    <nav style="padding:20px 40px;background:rgba(12, 5, 31, 0.85);border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10;backdrop-filter:blur(8px);">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="background:var(--fuchsia);color:white;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;box-shadow:0 0 12px rgba(217,70,239,0.4);">SB</div>
        <div>
          <div style="font-size:12px;color:#94A3B8;font-weight:600;">COURSE CONTENT</div>
          <div style="font-size:16px;color:#FFFFFF;font-weight:700;">${title}</div>
        </div>
      </div>
      <button onclick="document.getElementById('course-viewer-modal').remove()" 
        style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);padding:8px 20px;border-radius:12px;font-weight:700;color:#FFFFFF;cursor:pointer;transition:all 200ms;"
        onmouseover="this.style.background='var(--fuchsia)';this.style.borderColor='var(--fuchsia)';"
        onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.borderColor='rgba(255,255,255,0.1)';"
      >Close Viewer</button>
    </nav>

    <div style="max-width:1000px;margin:0 auto;width:100%;padding:60px 20px;display:grid;grid-template-columns:1.5fr 1fr;gap:40px;">
      <!-- Left: Notes Content -->
      <div id="viewer-content">
        <div class="viewer-card" style="text-align:center;padding:100px 0;">
          <div class="shimmer-dark" style="height:30px;width:60%;margin:0 auto 20px;border-radius:8px;"></div>
          <div class="shimmer-dark" style="height:20px;width:40%;margin:0 auto 40px;border-radius:8px;"></div>
          <p style="color:var(--fuchsia);font-weight:600;font-size:18px;">✨ Our AI is drafting your comprehensive study notes...</p>
        </div>
      </div>

      <!-- Right: Video & Resources -->
      <div style="display:flex;flex-direction:column;gap:32px;">
        <div class="viewer-card" style="padding:24px;">
          <h4 style="margin-bottom:16px;font-size:14px;color:#FFFFFF;display:flex;align-items:center;gap:8px;">🎥 Video Masterclass</h4>
          <div id="viewer-video" style="aspect-ratio:16/9;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#94A3B8;font-size:12px;">
            Searching for best tutorial...
          </div>
        </div>

        <div style="background:linear-gradient(135deg,rgba(217, 70, 239, 0.15),rgba(124, 58, 237, 0.15));border:1px solid rgba(217, 70, 239, 0.3);border-radius:24px;padding:24px;color:white;margin-bottom:20px;">
          <h4 style="margin-bottom:12px;font-size:14px;color:#FDA4AF;">🚀 Quick Challenge</h4>
          <p style="font-size:15px;margin-bottom:20px;color:#E2E8F0;">Master this topic to earn +30 XP and unlock the next phase of your roadmap.</p>
          <button onclick="document.getElementById('course-viewer-modal').remove()" 
            style="width:100%;background:var(--fuchsia);color:white;border:none;padding:14px;border-radius:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 15px rgba(217,70,239,0.3);transition:all 200ms;"
            onmouseover="this.style.transform='translateY(-2px)';"
            onmouseout="this.style.transform='translateY(0)';"
          >Return to Dashboard</button>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:24px;color:white;">
          <h4 style="margin-bottom:12px;font-size:14px;color:var(--emerald);display:flex;align-items:center;gap:8px;">✓ TASK COMPLETION</h4>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">
            Finished studying this topic and the video masterclass? Mark it as complete to advance your roadmap progress.
          </p>
          <button onclick="markTaskFromNotes('${taskId}')" 
            style="width:100%;background:var(--emerald);color:white;border:none;padding:14px;border-radius:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,0.25);transition:all 200ms;"
            onmouseover="this.style.transform='translateY(-2px)';"
            onmouseout="this.style.transform='translateY(0)';"
          >Mark as Complete ✓</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(viewer);

  // 1. Load Video (YouTube)
  searchYouTube(title).then(videos => {
    const videoArea = document.getElementById('viewer-video');
    if (videos && videos.length > 0) {
      videoArea.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videos[0].id.videoId}" frameborder="0" allowfullscreen style="border:none;"></iframe>`;
    } else {
      const fallbackUrl = getFallbackVideoUrl(title);
      videoArea.innerHTML = `<iframe width="100%" height="100%" src="${fallbackUrl}" frameborder="0" allowfullscreen style="border:none;"></iframe>`;
    }
  }).catch(() => {
    const videoArea = document.getElementById('viewer-video');
    const fallbackUrl = getFallbackVideoUrl(title);
    videoArea.innerHTML = `<iframe width="100%" height="100%" src="${fallbackUrl}" frameborder="0" allowfullscreen style="border:none;"></iframe>`;
  });

  // 2. Generate Notes
  const prompt = `Write a deep-dive technical article for: "${title}". 
  Include:
  - Theoretical Background
  - Step-by-step Implementation Guide
  - Common Pitfalls and Best Practices
  - 3 Complex Code Examples with explanations
  - A summary "Cheat Sheet" at the end.
  
  Format in semantic HTML. Use Inter font style. Return ONLY the content.`;

  const result = await callAI(prompt, 1200);
  const contentArea = document.getElementById('viewer-content');
  if (result) {
    const cleanHTML = result.replace(/```html|```/g, '').trim();
    contentArea.innerHTML = `
      <div class="viewer-card viewer-markdown">
        <h1 style="font-size:32px;font-weight:800;color:#FFFFFF;margin-bottom:32px;border:none;">${title}</h1>
        ${cleanHTML}
      </div>
    `;
  } else {
    // Fallback if AI fails: show local course notes!
    const localHTML = getLocalCourseNotes(title);
    contentArea.innerHTML = `
      <div class="viewer-card viewer-markdown">
        <h1 style="font-size:32px;font-weight:800;color:#FFFFFF;margin-bottom:32px;border:none;">${title}</h1>
        ${localHTML}
        <div style="margin-top: 24px; padding: 12px; background: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 8px; font-size: 12px; color: var(--emerald);">
          💡 Local study guide loaded. AI notes generator is currently busy.
        </div>
      </div>
    `;
  }
}

async function markTaskFromNotes(taskId) {
  try {
    const modal = document.getElementById('course-viewer-modal');
    if (modal) modal.remove();
    
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

  // Generic fallback topic
  return `
    <h2>Understanding ${title}</h2>
    <p>This module provides a comprehensive introduction to <strong>${title}</strong>, outlining key principles, methods, and practical use cases designed to build your career competency.</p>
    
    <h3>1. Core Concepts</h3>
    <p>To master this topic, you should focus on the underlying architecture, workflows, and standard industry tools. Review relevant guides and official documentation regularly to reinforce your foundation.</p>
    
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
      <div style="background:rgba(12, 5, 31, 0.85);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:32px;max-width:540px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.5);backdrop-filter:blur(10px);">
        <div style="margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#94A3B8;margin-bottom:8px;font-weight:600;">
            <span>QUESTION ${currentQ + 1} OF ${quiz.questions.length}</span>
            <span style="color:var(--fuchsia);">SCORE: ${score}/${currentQ}</span>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${progress}%;background:linear-gradient(90deg, #D946EF, #7C3AED);border-radius:3px;transition:width 300ms;"></div>
          </div>
        </div>
        <div style="font-size:16px;font-weight:600;line-height:1.6;margin-bottom:24px;color:#FFFFFF;">${q.q}</div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">
          ${q.options.map((opt, i) => `
            <button onclick="selectAnswer(${i}, ${q.answer}, '${q.explanation.replace(/'/g, "\\'")}', this)" 
              style="text-align:left;padding:14px 18px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);color:#E2E8F0;cursor:pointer;font-size:14px;transition:all 150ms;display:flex;align-items:center;gap:12px;" 
              onmouseover="if(!this.disabled){this.style.borderColor='var(--fuchsia)';this.style.background='rgba(217,70,239,0.05)';}" 
              onmouseout="if(!this.disabled){this.style.borderColor='rgba(255,255,255,0.08)';this.style.background='rgba(255,255,255,0.02)';}"
            >
              <span style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;color:#FFFFFF;">
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
    modal.querySelectorAll('button[onclick*="selectAnswer"]').forEach((b, i) => { if (i === correct) { b.style.background = 'rgba(16,185,129,0.15)'; b.style.borderColor = '#10B981'; b.style.color = '#34D399'; } else if (i === selected && !isCorrect) { b.style.background = 'rgba(239,68,68,0.15)'; b.style.borderColor = '#EF4444'; b.style.color = '#FCA5A5'; } });
    const exp = document.getElementById('explanation-area');
    if (exp) { exp.innerHTML = `<div style="padding:14px 18px;border-radius:12px;background:${isCorrect ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'};border:1px solid ${isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'};font-size:13px;color:${isCorrect ? '#34D399' : '#FCA5A5'};margin-bottom:20px;line-height:1.5;">${isCorrect ? '✓ Correct! ' : '✗ Incorrect. '}${explanation}</div><button onclick="nextQuestion()" style="width:100%;background:linear-gradient(135deg, #D946EF, #7C3AED);color:white;border:none;padding:14px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 15px rgba(217,70,239,0.3);transition:all 200ms;" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">${currentQ + 1 < quiz.questions.length ? 'Next Question →' : 'See Results 🏆'}</button>`; }
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
          </h3>
          <p style="color:#CBD5E1;font-size:14px;margin:0 0 24px;">
            ${pct >= 80 ? 'You passed the quiz! This task is marked as complete.' : 'You need 80% or higher to complete this task.'}
          </p>

          <div style="background:linear-gradient(135deg,rgba(217,70,239,0.12),rgba(124,58,237,0.12));border:1px solid rgba(217,70,239,0.2);border-radius:16px;padding:20px;margin-bottom:24px;">
            <div style="font-size:32px;font-weight:800;color:#D946EF;">+${xpEarned} XP</div>
            <div style="font-size:12px;color:#A78BFA;margin-top:6px;font-weight:600;">Total XP: ${newXP} | Level ${newLevel}</div>
            ${levelUp ? `<div style="margin-top:12px;font-size:12px;color:#34D399;font-weight:700;animation:bounce 1s infinite;">🎊 LEVEL UP! Reached Level ${newLevel}!</div>` : ''}
          </div>

          <button onclick="document.getElementById('quiz-modal').remove();loadTasks();" 
            style="width:100%;background:linear-gradient(135deg, #D946EF, #7C3AED);color:white;border:none;padding:14px;border-radius:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 15px rgba(217,70,239,0.3);transition:all 200ms;margin-bottom:12px;"
            onmouseover="this.style.transform='translateY(-2px)';"
            onmouseout="this.style.transform='translateY(0)';"
          >
            ${pct >= 80 ? 'Back to Tasks ✓' : 'Back to Dashboard'}
          </button>
          
          ${pct < 80 ? `
            <button onclick="document.getElementById('quiz-modal').remove();startQuiz('${taskId}', '${taskTitle}', '${phase}');" 
              style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:white;padding:14px;border-radius:12px;font-weight:700;cursor:pointer;transition:all 200ms;"
              onmouseover="this.style.background='rgba(255,255,255,0.1)';"
              onmouseout="this.style.background='rgba(255,255,255,0.06)';"
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
async function initDashboard(profile) {
  if (!profile) {
    console.error('No profile data');
    return;
  }
  
  currentUserName = profile.full_name 
    || 'Student';
  
  // Update greeting
  const greetEl = document.getElementById(
    'greeting-text'
  );
  if (greetEl) greetEl.textContent = 
    `Welcome back, ${
      currentUserName.split(' ')[0]
    } 👋`;
  
  const subEl = document.getElementById(
    'greeting-sub'
  );
  if (subEl) subEl.textContent = 
    profile.goal 
      ? `Path: ${getGoalText(profile.goal)}` 
      : 'Set your goal to start';

  // Load XP display
  const xpEl = document.getElementById(
    'xp-display-text'
  );
  if (xpEl) xpEl.textContent = 
    `Level ${profile.level||1} · ${
      profile.xp||0} XP`;

  // Load all data
  try {
    await Promise.all([
      loadDashboardStats(),
      updateStreakDisplay(currentUserId),
      buildActivityHeatmap(currentUserId),
      loadTodaysFocus(),
      loadShortRoadmap(profile.roadmap_data),
      loadNotifications(profile.notifications)
    ]);
    recordTodayLogin(currentUserId);
    console.log('✅ Dashboard fully loaded');
  } catch(err) {
    console.error('Dashboard load error:', err);
  }
}

// ── Notifications System ─────────────────────────────────────
function toggleNotifications() {
  const dropdown = document.getElementById('notif-dropdown');
  const isVisible = dropdown.style.display === 'block';
  dropdown.style.display = isVisible ? 'none' : 'block';
}

async function loadNotifications(notifs) {
  const list = document.getElementById('notif-list');
  const count = document.getElementById('notif-count');
  const enableBtn = document.getElementById('enable-notif-btn');

  // Handle permission button visibility
  if (enableBtn) {
    if (Notification.permission === 'default') {
      enableBtn.style.display = 'inline-flex';
    } else {
      enableBtn.style.display = 'none';
    }
  }

  const data = notifs || [];
  if (data.length > 0) {
    count.textContent = data.length;
    count.style.display = 'flex';
    list.innerHTML = data.map(n => `
      <div style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); cursor:pointer; transition:background-color 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
        <div style="font-size:13px; font-weight:600; color:white; margin-bottom:2px;">${n.title}</div>
        <div style="font-size:12px; color:#94A3B8;">${n.message}</div>
        <div style="font-size:10px; color:#64748B; margin-top:4px;">${n.time || 'Just now'}</div>
      </div>
    `).join('');
  } else {
    count.style.display = 'none';
    list.innerHTML = `<div style="padding:30px; text-align:center; color:#64748B; font-size:13px;">No new notifications</div>`;
  }
}

async function clearNotifications() {
  await supabase.from('profiles').update({ notifications: [] }).eq('id', currentUserId);
  loadNotifications([]);
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('This browser does not support desktop notifications', 'warning');
    return;
  }
  
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    showToast('🎉 Desktop notifications enabled!');
    // Push a welcome notification
    await addNotification('🔔 Notifications Enabled', 'You will now receive desktop alerts for task completions and level ups.');
  } else {
    showToast('Notifications disabled. Enable them in browser settings.', 'info');
  }
  
  // Update button visibility
  const enableBtn = document.getElementById('enable-notif-btn');
  if (enableBtn) {
    enableBtn.style.display = (permission === 'default') ? 'inline-flex' : 'none';
  }
}

async function addNotification(title, message) {
  if (!currentUserId) return;
  const { data: profile } = await supabase.from('profiles').select('notifications').eq('id', currentUserId).single();
  const currentNotifs = profile?.notifications || [];
  
  const newNotif = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    title,
    message,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    created_at: new Date().toISOString()
  };

  const updatedNotifs = [newNotif, ...currentNotifs].slice(0, 50); // limit to 50
  await supabase.from('profiles').update({ notifications: updatedNotifs }).eq('id', currentUserId);
  
  // Reload local UI
  loadNotifications(updatedNotifs);
  
  // Trigger toast notification (which handles desktop notifications as well)
  showToast(`${title}: ${message}`);
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
  alert("Feature coming soon: Detailed XP breakdown and rewards!");
}

// ── Session History ──────────────────────────────────────────
async function startNewSession() {
  const startTime = new Date().toISOString();
  const sessionName = prompt("What are you focusing on this session?", "Learning React");
  if (!sessionName) return;

  showToast("Session started! Timer is running.");

  // Update profiles session_history
  const { data: profile } = await supabase.from('profiles').select('session_history').eq('id', currentUserId).single();
  const history = profile.session_history || [];
  history.unshift({ name: sessionName, started: startTime, status: 'active' });

  await supabase.from('profiles').update({ session_history: history }).eq('id', currentUserId);
}

// ── Today's Focus ────────────────────────────────────────────
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

  // 1. Fetch all tasks for the user
  const { data: dbTasks } = await supabase.from('tasks')
    .select('*')
    .eq('user_id', currentUserId);

  if (!dbTasks || dbTasks.length === 0) {
    titleEl.textContent = "Welcome to SkillBridge! 👋";
    descEl.textContent = "Please generate your personalized career roadmap in the AI Roadmap tab to start receiving your focus tasks.";
    xpEl.style.display = 'none';
    catEl.style.display = 'none';
    diffEl.style.display = 'none';
    progressEl.textContent = "Progress: 0/0";
    btnEl.textContent = "Generate Roadmap ⚡";
    btnEl.onclick = () => switchTab('roadmap');
    return;
  }

  // 2. Fetch the profile's roadmap_data to get the proper order of tasks
  const { data: profile } = await supabase.from('profiles')
    .select('roadmap_data')
    .eq('id', currentUserId)
    .single();

  const roadmap = profile?.roadmap_data;
  let tasks = [...dbTasks];

  // Sort tasks according to sequence
  if (roadmap?.phases) {
    const taskOrder = [];
    roadmap.phases.forEach(p => (p.tasks || []).forEach(t => taskOrder.push(t.title)));
    tasks.sort((a, b) => taskOrder.indexOf(a.title) - taskOrder.indexOf(b.title));
  }

  // Find first uncompleted task
  const activeTask = tasks.find(t => t.status !== 'completed');

  if (!activeTask) {
    titleEl.textContent = "Roadmap Completed! 🎉";
    descEl.textContent = "Outstanding work! You have completed all the tasks in your career roadmap. Go to the Placement section to test your job readiness.";
    xpEl.style.display = 'none';
    catEl.style.display = 'none';
    diffEl.style.display = 'none';
    progressEl.textContent = "Progress: 100%";
    btnEl.textContent = "Start Placements 💼";
    btnEl.onclick = () => switchTab('placement');
    return;
  }

  // 3. Render active task details
  xpEl.style.display = 'inline-flex';
  catEl.style.display = 'inline-flex';
  diffEl.style.display = 'inline-flex';
  
  const xpReward = activeTask.difficulty === 'Hard' ? 50 : activeTask.difficulty === 'Medium' ? 30 : 15;
  xpEl.textContent = `+${xpReward} XP`;
  
  titleEl.textContent = activeTask.title;
  catEl.textContent = activeTask.roadmap_phase || "Core Topic";
  diffEl.textContent = `${activeTask.difficulty || 'Medium'} Difficulty`;
  
  // Set category badges styles based on difficulty
  diffEl.className = `cc-badge ${activeTask.difficulty === 'Hard' ? 'badge-rose' : activeTask.difficulty === 'Medium' ? 'badge-amber' : 'badge-cyan'}`;

  // Description builder helper
  descEl.textContent = getTaskDescription(activeTask.title);
  progressEl.textContent = "Progress: 0/1";
  
  btnEl.textContent = "Start Task →";
  btnEl.onclick = (e) => {
    e.stopPropagation();
    openTaskDetail(activeTask.id);
  };
}

// Simple helper to generate professional-sounding descriptions for common topics
function getTaskDescription(title) {
  const t = title.toLowerCase();
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
  await addNotification('✅ Focus Task Completed', `You completed "${task?.title || 'a task'}" and earned 10 XP!`);
  loadTodaysFocus();
  loadDashboardStats();
}

// ── Activity Heatmap ─────────────────────────────────────────
async function buildActivityHeatmap(userId) {
  const grid = document.getElementById('heatmap-grid');
  if (!grid) return;

  const { data } = await supabase.from('user_activity')
    .select('activity_date')
    .eq('user_id', userId)
    .order('activity_date', { ascending: true });

  const activeDates = new Set((data || []).map(d => d.activity_date));
  const today = new Date();
  grid.innerHTML = '';

  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

  for (let i = 0; i < 12; i++) {
    const col = document.createElement('div');
    col.style.display = 'flex';
    col.style.flexDirection = 'column';
    col.style.gap = '3px';

    for (let j = 0; j < 7; j++) {
      // row j corresponds to weekday j (0 = Sunday, 1 = Monday, etc.)
      const date = new Date(today);
      // Offset from today to the Sunday of week i, then add j days
      const daysOffset = (11 - i) * 7 + (currentDay - j);
      date.setDate(today.getDate() - daysOffset);

      // Local YYYY-MM-DD representation
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
        cell.style.background = isActive ? 'var(--fuchsia, #D946EF)' : 'rgba(255, 255, 255, 0.05)';
        cell.style.border = '1px solid rgba(255, 255, 255, 0.03)';
        cell.title = `${ds} (${isActive ? 'Active' : 'No activity'})`;
        
        // Add a micro hover effect
        cell.style.transition = 'transform 0.15s ease, background-color 0.15s ease';
        cell.onmouseover = () => {
          cell.style.transform = 'scale(1.3)';
          if (isActive) {
            cell.style.boxShadow = '0 0 8px var(--fuchsia, #D946EF)';
          }
        };
        cell.onmouseout = () => {
          cell.style.transform = 'scale(1)';
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

// ── Short Roadmap Card ───────────────────────────────────────
// ── Short Roadmap Card ───────────────────────────────────────
function loadShortRoadmap(roadmap) {
  // Redesigned: short roadmap refresh triggers full stats dashboard update
  loadDashboardStats();
}

// ── Career Track Helper ──
function getCareerTrackFromGoal(goal) {
  if (!goal) return { track: "Software Development", spec: "Frontend Development" };
  
  // Parse JSON if serialized string
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

  const g = trueGoalText.toLowerCase();
  
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

// ── Interactive Career Track Switches ──
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
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeSwitchTrackModal() {
  const modal = document.getElementById('switch-track-modal');
  if (modal) modal.style.display = 'none';
}

async function executeCareerTrackSwitch(roleName) {
  closeSwitchTrackModal();
  showToast(`Switching path to ${roleName}...`, 'info');
  
  // Set the input field in the Roadmap tab
  const goalInput = document.getElementById('roadmap-goal-input');
  if (goalInput) goalInput.value = roleName;
  
  // Switch to the roadmap tab first so user sees generation progress
  switchTab('roadmap');
  
  // Update goal in database
  await supabase.from('profiles').update({ goal: roleName }).eq('id', currentUserId);
  
  // Trigger generation
  generateNewRoadmap();
}

window.confirmCareerTrackSwitch = confirmCareerTrackSwitch;
window.closeSwitchTrackModal = closeSwitchTrackModal;
window.executeCareerTrackSwitch = executeCareerTrackSwitch;

// ── Full Roadmap Generation ──────────────────────────────────
async function generateNewRoadmap() {
  const goalInput = document.getElementById('roadmap-goal-input');
  const goal = goalInput?.value || currentUserName;

  if (!goal) {
    showToast("Please enter a career goal first", "error");
    return;
  }

  const status = document.getElementById('roadmap-gen-status');
  const display = document.getElementById('full-roadmap-display');
  const btn = document.getElementById('generate-roadmap-btn');

  status.style.display = 'block';
  display.style.display = 'none';
  if (btn) btn.disabled = true;

  try {
    const prompt = getRoadmapPrompt(goal);
    const response = await callAI(prompt, 2000);

    if (!response) {
      throw new Error("AI returned empty or invalid response");
    }
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from AI response");
    }
    const roadmap = JSON.parse(jsonMatch[0]);

    // Save to Supabase profile
    await supabase.from('profiles').update({ goal: goal, roadmap_data: roadmap }).eq('id', currentUserId);

    // Save tasks to standard tasks database table so everything is in sync
    await saveTasksFromRoadmap(roadmap, currentUserId);

    await renderFullRoadmap(roadmap);
    loadShortRoadmap(roadmap);
    showToast("✨ Roadmap generated successfully!", "success");
  } catch (err) {
    console.error("Roadmap Gen Error:", err);
    showToast("Failed to generate roadmap. Try again.", "error");
  } finally {
    status.style.display = 'none';
    display.style.display = 'block';
    if (btn) btn.disabled = false;
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

  // 1. Fetch latest task and project data
  const [tasksRes, projectsRes, profileRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', currentUserId),
    supabase.from('projects').select('status').eq('user_id', currentUserId),
    supabase.from('profiles').select('goal, level, xp, roadmap_data').eq('id', currentUserId).single()
  ]);

  const dbTasksList = tasksRes.data || [];
  const dbProjectsList = projectsRes.data || [];
  const profile = profileRes.data;
  const activeRoadmap = profile?.roadmap_data || roadmap;

  // Filter tasks to only include those in the current roadmap phases
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

  // Group tasks by phase name
  const phasesMap = {};
  roadmapTasks.forEach(task => {
    const phaseName = task.roadmap_phase || 'General Prep';
    if (!phasesMap[phaseName]) phasesMap[phaseName] = [];
    phasesMap[phaseName].push(task);
  });

  const roadmapPhases = activeRoadmap.phases || [];
  
  // Map AI phases to Stage 1, 2, 3
  const stageTasks = [[], [], []];
  const stagePhaseNames = ["Foundation", "Core Skills", "Advanced Skills"];
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
      // Combine Phase 3 and Phase 4 into Stage 3 (Advanced Skills)
      stageTasks[2] = stageTasks[2].concat(pTasks);
      stagePhaseDescriptions[2] = p.description || "Master advanced concepts and specialize.";
    }
  });

  // Calculate statuses for Phase 1, 2, 3
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

  // Determine active phase index
  let activePhaseIndex = 0;
  if (isPhase1Done) {
    activePhaseIndex = 1;
  }
  if (isPhase1Done && isPhase2Done) {
    activePhaseIndex = 2;
  }
  if (isPhase1Done && isPhase2Done && isPhase3Done) {
    activePhaseIndex = 3; // Projects phase
  }
  if (isPhase1Done && isPhase2Done && isPhase3Done && completedProjects >= 3) {
    activePhaseIndex = 4; // Job Ready phase
  }

  // Calculate statuses for Phase 4 (Projects)
  let isProjectsUnlocked = isPhase3Done;
  let projectsPct = isProjectsUnlocked ? Math.min(100, Math.round((completedProjects / 3) * 100)) : 0;
  let isProjectsDone = isProjectsUnlocked && completedProjects >= 3;

  // Calculate statuses for Phase 5 (Job Ready)
  let isJobReadyUnlocked = isProjectsDone;
  let placementProgressItems = [
    (typeof placementProgress !== 'undefined') ? placementProgress.resume : false,
    completedProjects >= 1,
    (typeof placementProgress !== 'undefined') ? placementProgress.r1 : false,
    (typeof placementProgress !== 'undefined') ? placementProgress.r2 : false,
    (typeof placementProgress !== 'undefined') ? placementProgress.r3 : false
  ];
  let placementCompletedCount = placementProgressItems.filter(Boolean).length;
  let jobReadyPct = isJobReadyUnlocked ? Math.round((placementCompletedCount / 5) * 100) : 0;

  // Stages display helper
  const getStageStatusDetails = (idx) => {
    if (idx === 0) {
      return { statusClass: isPhase1Done ? 'completed' : 'current', statusText: isPhase1Done ? '✓ Complete' : '● Current', pctText: `${phase1Pct}%` };
    }
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

  // Active path card variables
  const goalTitle = getGoalText(profile?.goal) || "Frontend Developer";
  const activePhaseNameText = activePhaseIndex === 0 ? "Foundation" : activePhaseIndex === 1 ? "Core Skills" : activePhaseIndex === 2 ? "Advanced Skills" : activePhaseIndex === 3 ? "Real-World Projects" : "Job Ready Prep";

  // Current active task for current focus box
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
      <div style="background: rgba(0, 229, 255, 0.04); border: 1.5px solid var(--emerald); border-radius: 12px; padding: 18px; margin-top: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--emerald); text-transform: uppercase;">Current Focus</span>
          <span class="cc-badge badge-cyan">${activeTask.difficulty} · +${focusXP} XP</span>
        </div>
        <h4 style="font-size: 16px; font-weight: 700; color: #ffffff; margin: 4px 0;">${activeTask.title}</h4>
        <p style="font-size: 12px; color: var(--text-secondary); margin: 6px 0 14px 0; line-height: 1.4;">
          ${getTaskDescription(activeTask.title)}
        </p>
        <button onclick="openTaskDetail('${activeTask.id}')" class="btn-primary" style="padding: 8px 16px; font-size: 12px; border-radius: 8px; box-shadow: 0 0 12px rgba(0, 229, 255, 0.25);">
          Continue Learning →
        </button>
      </div>
    `;
  } else {
    currentFocusHTML = `
      <div style="background: rgba(16, 185, 129, 0.04); border: 1.5px solid #10B981; border-radius: 12px; padding: 18px; margin-top: 20px; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 6px;">🎉</div>
        <h4 style="font-size: 16px; font-weight: 700; color: #34D399; margin: 4px 0;">Roadmap Fully Mastered!</h4>
        <p style="font-size: 12px; color: var(--text-secondary); margin: 6px 0 0 0; line-height: 1.4;">
          You have completed all skills and are ready to tackle projects or start mock placement interviews.
        </p>
      </div>
    `;
  }

  // Active Phase Name and Description
  const activePhaseObjName = activePhaseIndex === 0 ? "Phase 01 — Foundation" : activePhaseIndex === 1 ? "Phase 02 — Core Skills" : activePhaseIndex === 2 ? "Phase 03 — Advanced Skills" : activePhaseIndex === 3 ? "Phase 04 — Real-World Projects" : "Phase 05 — Job Ready";
  const activePhaseObjDesc = activePhaseIndex === 0 ? stagePhaseDescriptions[0] : activePhaseIndex === 1 ? stagePhaseDescriptions[1] : activePhaseIndex === 2 ? stagePhaseDescriptions[2] : activePhaseIndex === 3 ? "Apply your skills by building projects that demonstrate real-world ability." : "Turn your skills and projects into a complete placement-ready profile.";
  const activePhasePctVal = activePhaseIndex === 0 ? phase1Pct : activePhaseIndex === 1 ? phase2Pct : activePhaseIndex === 2 ? phase3Pct : activePhaseIndex === 3 ? projectsPct : jobReadyPct;

  // Mastered skills list in active phase card
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

  // Render Full HTML
  display.innerHTML = `
    <!-- 1. ACTIVE CAREER PATH CARD -->
    <div class="cc-card cc-hero" style="margin-bottom: 24px;">
      <div>
        <div class="cc-badge badge-cyan" style="margin-bottom: 8px;">🎯 ACTIVE PATHWAY</div>
        <h2 style="font-size: 26px; font-weight: 700; color: #ffffff; margin: 4px 0;">${goalTitle}</h2>
        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 16px; max-width: 500px;">
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
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">
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
          <button onclick="openAdjustRoadmapModal()" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #ffffff; padding: 12px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; flex: 1; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)';" onmouseout="this.style.background='rgba(255,255,255,0.04)';">
            Adjust Goals
          </button>
        </div>
      </div>
    </div>

    <!-- 2. CAREER JOURNEY OVERVIEW -->
    <div class="cc-card" style="margin-bottom: 24px;">
      <div class="cc-badge badge-cyan" style="margin-bottom: 12px;">🗺️ YOUR CAREER JOURNEY</div>
      <h3 style="font-size: 16px; font-weight: 700; color: #ffffff; margin: 0 0 16px 0;">Journey Milestones</h3>
      
      <div class="rm-timeline-grid">
        <!-- Stage 1 -->
        <div class="rm-stage-card ${s1.statusClass}">
          <span class="rm-stage-num">01</span>
          <h4 class="rm-stage-title" style="margin: 6px 0;">Foundation</h4>
          <span class="rm-stage-status">${s1.statusText} (${s1.pctText})</span>
        </div>
        
        <!-- Stage 2 -->
        <div class="rm-stage-card ${s2.statusClass}">
          <span class="rm-stage-num">02</span>
          <h4 class="rm-stage-title" style="margin: 6px 0;">Core Skills</h4>
          <span class="rm-stage-status">${s2.statusText} (${s2.pctText})</span>
        </div>
        
        <!-- Stage 3 -->
        <div class="rm-stage-card ${s3.statusClass}">
          <span class="rm-stage-num">03</span>
          <h4 class="rm-stage-title" style="margin: 6px 0;">Advanced</h4>
          <span class="rm-stage-status">${s3.statusText} (${s3.pctText})</span>
        </div>
        
        <!-- Stage 4 -->
        <div class="rm-stage-card ${s4.statusClass}">
          <span class="rm-stage-num">04</span>
          <h4 class="rm-stage-title" style="margin: 6px 0;">Projects</h4>
          <span class="rm-stage-status">${s4.statusText} (${s4.pctText})</span>
        </div>
        
        <!-- Stage 5 -->
        <div class="rm-stage-card ${s5.statusClass}">
          <span class="rm-stage-num">05</span>
          <h4 class="rm-stage-title" style="margin: 6px 0;">Job Ready</h4>
          <span class="rm-stage-status">${s5.statusText} (${s5.pctText})</span>
        </div>
      </div>
    </div>

    <!-- 3. CURRENT PHASE - MAIN FOCUS -->
    <div class="cc-card cc-card-highlight" style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
        <div>
          <div class="cc-badge badge-rose" style="margin-bottom: 8px;">🎯 ACTIVE OBJECTIVE</div>
          <h3 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 6px 0;">${activePhaseObjName}</h3>
          <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0; max-width: 600px;">
            ${activePhaseObjDesc}
          </p>
        </div>
        
        <div style="text-align: right; min-width: 120px;">
          <div style="font-size: 24px; font-weight: 800; color: var(--emerald);">${activePhasePctVal}%</div>
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">${activePhaseSkillsMasteredCount} / ${activePhaseSkillsTotalCount} Mastered</div>
        </div>
      </div>
      
      <div class="cc-progress-container" style="margin-bottom: 20px;">
        <div class="cc-progress-bar" style="width: ${activePhasePctVal}%;"></div>
      </div>
      
      <div style="margin-bottom: 12px;">
        <h4 style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em; margin-top: 0;">
          Skills you will master:
        </h4>
        <div class="rm-skill-grid">
          ${skillsChipsHTML}
        </div>
      </div>
      
      ${currentFocusHTML}
    </div>

    <!-- 4. FULL ROADMAP PHASES -->
    <div>
      <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 28px 0 16px 0; display: flex; align-items: center; gap: 8px;">
        ⚙️ Complete Roadmap Timeline
      </h3>
      
      <!-- Phase 1 Accordion -->
      <div id="rm-accordion-0" class="rm-accordion-item ${activePhaseIndex === 0 ? 'open active' : ''}">
        <div class="rm-accordion-header" onclick="togglePhaseAccordion(0)">
          <div>
            <span class="cc-badge ${isPhase1Done ? 'badge-cyan' : 'badge-purple'}" style="margin-right: 12px;">
              ${isPhase1Done ? '✓ Phase 01' : '🎯 Phase 01'}
            </span>
            <strong style="color: #ffffff; font-size: 14px;">Foundation</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 12px; font-weight: 600; color: ${isPhase1Done ? '#34D399' : 'var(--text-muted)'};">${phase1Pct}% Complete</span>
            <span style="font-size: 14px; color: var(--text-muted);">▼</span>
          </div>
        </div>
        <div class="rm-accordion-content">
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0;">
            ${stagePhaseDescriptions[0]}
          </p>
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; margin-top: 0;">Checkpoints:</div>
          <div class="rm-skill-grid">
            ${stageTasks[0].map(t => `
              <span class="rm-skill-tag ${t.status === 'completed' ? 'mastered' : ''}">
                ${t.status === 'completed' ? '✓' : '•'} ${t.title}
              </span>
            `).join('')}
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
            <button onclick="window.switchTab('tasks')" class="btn-primary" style="padding: 8px 16px; font-size: 12px; border-radius: 8px; background: rgba(255,255,255,0.04) !important; color: #ffffff !important; border: 1px solid rgba(255,255,255,0.1) !important; box-shadow: none !important;" onmouseover="this.style.background='rgba(255,255,255,0.08)';" onmouseout="this.style.background='rgba(255,255,255,0.04)';">
              Open Workspace ➔
            </button>
          </div>
        </div>
      </div>

      <!-- Phase 2 Accordion -->
      <div id="rm-accordion-1" class="rm-accordion-item ${activePhaseIndex === 1 ? 'open active' : ''}">
        <div class="rm-accordion-header" onclick="togglePhaseAccordion(1)">
          <div>
            <span class="cc-badge ${!isPhase1Done ? 'badge-rose' : isPhase2Done ? 'badge-cyan' : 'badge-purple'}" style="margin-right: 12px;">
              ${!isPhase1Done ? '🔒 Phase 02' : isPhase2Done ? '✓ Phase 02' : '🎯 Phase 02'}
            </span>
            <strong style="color: #ffffff; font-size: 14px;">Core Skills</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 12px; font-weight: 600; color: ${isPhase2Done ? '#34D399' : 'var(--text-muted)'};">${isPhase1Done ? phase2Pct + '%' : 'Locked'}</span>
            <span style="font-size: 14px; color: var(--text-muted);">▼</span>
          </div>
        </div>
        <div class="rm-accordion-content">
          ${!isPhase1Done ? `
            <div style="text-align: center; padding: 12px; color: var(--text-muted); font-size: 13px;">
              Complete Phase 01: Foundation to unlock core roadmap skills.
            </div>
          ` : `
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0;">
              ${stagePhaseDescriptions[1]}
            </p>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; margin-top: 0;">Checkpoints:</div>
            <div class="rm-skill-grid">
              ${stageTasks[1].map(t => `
                <span class="rm-skill-tag ${t.status === 'completed' ? 'mastered' : ''}">
                  ${t.status === 'completed' ? '✓' : '•'} ${t.title}
                </span>
              `).join('')}
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
              <button onclick="window.switchTab('tasks')" class="btn-primary" style="padding: 8px 16px; font-size: 12px; border-radius: 8px;" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">
                Open Workspace ➔
              </button>
            </div>
          `}
        </div>
      </div>

      <!-- Phase 3 Accordion -->
      <div id="rm-accordion-2" class="rm-accordion-item ${activePhaseIndex === 2 ? 'open active' : ''}">
        <div class="rm-accordion-header" onclick="togglePhaseAccordion(2)">
          <div>
            <span class="cc-badge ${!isPhase2Done ? 'badge-rose' : isPhase3Done ? 'badge-cyan' : 'badge-purple'}" style="margin-right: 12px;">
              ${!isPhase2Done ? '🔒 Phase 03' : isPhase3Done ? '✓ Phase 03' : '🎯 Phase 03'}
            </span>
            <strong style="color: #ffffff; font-size: 14px;">Advanced Skills</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 12px; font-weight: 600; color: ${isPhase3Done ? '#34D399' : 'var(--text-muted)'};">${isPhase2Done ? phase3Pct + '%' : 'Locked'}</span>
            <span style="font-size: 14px; color: var(--text-muted);">▼</span>
          </div>
        </div>
        <div class="rm-accordion-content">
          ${!isPhase2Done ? `
            <div style="text-align: center; padding: 12px; color: var(--text-muted); font-size: 13px;">
              Complete Phase 02: Core Skills to unlock advanced specialization topics.
            </div>
          ` : `
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0;">
              ${stagePhaseDescriptions[2]}
            </p>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; margin-top: 0;">Checkpoints:</div>
            <div class="rm-skill-grid">
              ${stageTasks[2].map(t => `
                <span class="rm-skill-tag ${t.status === 'completed' ? 'mastered' : ''}">
                  ${t.status === 'completed' ? '✓' : '•'} ${t.title}
                </span>
              `).join('')}
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
              <button onclick="window.switchTab('tasks')" class="btn-primary" style="padding: 8px 16px; font-size: 12px; border-radius: 8px;" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">
                Open Workspace ➔
              </button>
            </div>
          `}
        </div>
      </div>

      <!-- Phase 4 Accordion -->
      <div id="rm-accordion-3" class="rm-accordion-item ${activePhaseIndex === 3 ? 'open active' : ''}">
        <div class="rm-accordion-header" onclick="togglePhaseAccordion(3)">
          <div>
            <span class="cc-badge ${!isProjectsUnlocked ? 'badge-rose' : isProjectsDone ? 'badge-cyan' : 'badge-purple'}" style="margin-right: 12px;">
              ${!isProjectsUnlocked ? '🔒 Phase 04' : isProjectsDone ? '✓ Phase 04' : '🎯 Phase 04'}
            </span>
            <strong style="color: #ffffff; font-size: 14px;">Real-World Projects</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 12px; font-weight: 600; color: ${isProjectsDone ? '#34D399' : 'var(--text-muted)'};">${isProjectsUnlocked ? projectsPct + '%' : 'Locked'}</span>
            <span style="font-size: 14px; color: var(--text-muted);">▼</span>
          </div>
        </div>
        <div class="rm-accordion-content">
          ${!isProjectsUnlocked ? `
            <div style="text-align: center; padding: 12px; color: var(--text-muted); font-size: 13px;">
              Complete Phase 03: Advanced Skills to unlock real-world project portfolios.
            </div>
          ` : `
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0;">
              Apply your skills by building projects that demonstrate real-world capability.
            </p>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; margin-top: 0;">Core Capstone Portfolios:</div>
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
            <div style="display: flex; justify-content: flex-end; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
              <button onclick="window.switchTab('projects')" class="btn-primary" style="padding: 8px 16px; font-size: 12px; border-radius: 8px;" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">
                Manage Project Sandbox ➔
              </button>
            </div>
          `}
        </div>
      </div>

      <!-- Phase 5 Accordion -->
      <div id="rm-accordion-4" class="rm-accordion-item ${activePhaseIndex === 4 ? 'open active' : ''}">
        <div class="rm-accordion-header" onclick="togglePhaseAccordion(4)">
          <div>
            <span class="cc-badge ${!isJobReadyUnlocked ? 'badge-rose' : placementCompletedCount === 5 ? 'badge-cyan' : 'badge-purple'}" style="margin-right: 12px;">
              ${!isJobReadyUnlocked ? '🔒 Phase 05' : placementCompletedCount === 5 ? '✓ Phase 05' : '🎯 Phase 05'}
            </span>
            <strong style="color: #ffffff; font-size: 14px;">Job Ready</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 12px; font-weight: 600; color: ${placementCompletedCount === 5 ? '#34D399' : 'var(--text-muted)'};">${isJobReadyUnlocked ? jobReadyPct + '%' : 'Locked'}</span>
            <span style="font-size: 14px; color: var(--text-muted);">▼</span>
          </div>
        </div>
        <div class="rm-accordion-content">
          ${!isJobReadyUnlocked ? `
            <div style="text-align: center; padding: 12px; color: var(--text-muted); font-size: 13px;">
              Complete Phase 04: Real-World Projects to unlock mock placement and profile screening.
            </div>
          ` : `
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0;">
              Turn your skills and projects into a complete placement-ready profile.
            </p>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; margin-top: 0;">Checklist:</div>
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
            <div style="display: flex; justify-content: flex-end; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
              <button onclick="window.switchTab('placement')" class="btn-primary" style="padding: 8px 16px; font-size: 12px; border-radius: 8px;" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">
                Enter Placement Board ➔
              </button>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

// ── Accordion Toggle function ──
function togglePhaseAccordion(idx) {
  const item = document.getElementById(`rm-accordion-${idx}`);
  if (!item) return;
  const isOpen = item.classList.contains('open');
  if (isOpen) {
    item.classList.remove('open');
  } else {
    // Optional: close other accordions first
    document.querySelectorAll('.rm-accordion-item').forEach(el => el.classList.remove('open'));
    item.classList.add('open');
  }
}

// ── AI Personalization Modal Handlers ──
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
  
  // Show loading
  const status = document.getElementById('roadmap-gen-status');
  const display = document.getElementById('full-roadmap-display');
  if (status) status.style.display = 'block';
  if (display) display.style.display = 'none';

  // Get selected options
  const checkboxes = document.querySelectorAll('input[name="adjust-opt"]:checked');
  const options = Array.from(checkboxes).map(cb => cb.parentNode.textContent.trim().replace(/\s+/g, ' '));
  
  if (options.length === 0) {
    showToast("Please select at least one option to adapt your roadmap", "warning");
    if (status) status.style.display = 'none';
    if (display) display.style.display = 'block';
    return;
  }

  try {
    // 1. Get profile goal & previous roadmap
    const { data: profile } = await supabase.from('profiles').select('goal, roadmap_data').eq('id', currentUserId).single();
    const goal = profile?.goal || "Frontend Developer";
    const oldRoadmap = profile?.roadmap_data;

    // 2. Build prompt for AI
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

    // 3. Call AI
    const result = await callAI(prompt, 2000);
    const jsonMatch = result?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response from AI");
    }
    const newRoadmap = JSON.parse(jsonMatch[0]);

    // 4. Save to profiles
    await supabase.from('profiles').update({ roadmap_data: newRoadmap }).eq('id', currentUserId);

    // 5. Update tasks in sync
    await saveTasksFromRoadmap(newRoadmap, currentUserId);

    showToast("✨ Roadmap adapted successfully!", "success");
    await loadRoadmapTab();
  } catch (err) {
    console.error("Adjustment Error:", err);
    showToast("Failed to adapt roadmap. Please try again.", "error");
    if (status) status.style.display = 'none';
    if (display) display.style.display = 'block';
  }
}

// Bind to window context
window.togglePhaseAccordion = togglePhaseAccordion;
window.openAdjustRoadmapModal = openAdjustRoadmapModal;
window.closeAdjustRoadmapModal = closeAdjustRoadmapModal;
window.submitRoadmapAdjustment = submitRoadmapAdjustment;

function getRoadmapPrompt(goal) {
  return `Act as a career coach and create a high-fidelity learning roadmap for the role: "${goal}".
  Format the response as a valid JSON object.
  The JSON should have:
  - "title": A catchy title for the roadmap.
  - "phases": An array of 4 objects.
    - Each phase has: "phase" (name), "description", and "tasks" (array of 4 specific learning tasks).
    - Each task has: "title", "difficulty" (Easy/Medium/Hard), "status" (default to "pending").
  
  RETURN ONLY THE JSON OBJECT.`;
}

async function completeRoadmapTask(pIdx, tIdx) {
  const { data: profile } = await supabase.from('profiles').select('roadmap_data').eq('id', currentUserId).single();
  const roadmap = profile.roadmap_data;

  const task = roadmap.phases[pIdx].tasks[tIdx];
  task.status = task.status === 'completed' ? 'pending' : 'completed';

  await supabase.from('profiles').update({ roadmap_data: roadmap }).eq('id', currentUserId);
  renderFullRoadmap(roadmap);
  loadShortRoadmap(roadmap);

  if (task.status === 'completed') {
    showToast("Checkpoint reached! +25 XP");
    // Could update XP here
  }
}

function downloadRoadmapPDF() {
  window.print(); // Simple fallback
}


async function callAI(prompt, maxTokens = 800) {
  const models = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'openai/gpt-oss-120b:free',
    'deepseek/deepseek-v4-flash:free',
    'openrouter/free'
  ];

  if (OPENROUTER_KEY) {
    for (const model of models) {
      try {
        console.log(`[callAI] Attempting prompt with model: ${model}`);
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
            console.log(`[callAI] Success with model: ${model}`);
            return content;
          }
        } else {
          const errBody = await res.json().catch(() => ({}));
          console.warn(`[callAI] Model ${model} returned status ${res.status}:`, errBody);
          if (res.status === 401) {
            // Unauthorized - stop trying other OpenRouter models
            break;
          }
        }
      } catch (e) {
        console.error(`[callAI] Model ${model} failed with error:`, e);
      }
      // Wait 500ms before trying the next fallback model
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Fallback to Gemini if OpenRouter key is missing or failed
  if (GEMINI_KEY) {
    try {
      console.log('[callAI] Falling back to Gemini API...');
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
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
          console.log('[callAI] Success with Gemini API');
          return content;
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        console.error('[callAI] Gemini API returned status:', res.status, errBody);
      }
    } catch (e) {
      console.error('[callAI] Gemini API fallback failed:', e);
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

function switchResumeSection(sectionId) {
  document.querySelectorAll('.resume-section-form').forEach(f => f.style.display = 'none');
  document.getElementById(`resume-editor-${sectionId}`).style.display = 'block';
  document.querySelectorAll('.resume-nav-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}

function addResumeItem(type) {
  const container = document.getElementById(`${type}-list`);
  const id = Date.now();
  const item = document.createElement('div');
  item.className = 'resume-item-card';
  item.dataset.id = id;

  if (type === 'experience') {
    item.innerHTML = `
      <input type="text" placeholder="Company" class="form-input" oninput="updateResumePreview()">
      <input type="text" placeholder="Role" class="form-input" oninput="updateResumePreview()">
      <input type="text" placeholder="Years" class="form-input" oninput="updateResumePreview()">
      <textarea placeholder="Achievements..." class="form-input" oninput="updateResumePreview()"></textarea>
      <button onclick="this.parentElement.remove();updateResumePreview()" class="remove-btn">Remove</button>
    `;
  } else if (type === 'education') {
    item.innerHTML = `
      <input type="text" placeholder="University" class="form-input" oninput="updateResumePreview()">
      <input type="text" placeholder="Degree" class="form-input" oninput="updateResumePreview()">
      <input type="text" placeholder="Year" class="form-input" oninput="updateResumePreview()">
      <button onclick="this.parentElement.remove();updateResumePreview()" class="remove-btn">Remove</button>
    `;
  } else if (type === 'projects') {
    item.innerHTML = `
      <input type="text" placeholder="Project Name" class="form-input" oninput="updateResumePreview()">
      <textarea placeholder="Description..." class="form-input" oninput="updateResumePreview()"></textarea>
      <button onclick="this.parentElement.remove();updateResumePreview()" class="remove-btn">Remove</button>
    `;
  }
  container.appendChild(item);
  updateResumePreview();
}

function updateResumePreview() {
  const page = document.getElementById('resume-page');
  if (!page) return;

  const name = document.getElementById('res-name').value;
  const email = document.getElementById('res-email').value;
  const phone = document.getElementById('res-phone').value;
  const location = document.getElementById('res-location').value;
  const summary = document.getElementById('res-summary').value;
  const skills = document.getElementById('res-skills-input').value.split(',').map(s => s.trim()).filter(s => s);

  let html = `
    <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:15px;margin-bottom:20px;">
      <h1 style="margin:0;font-size:28px;text-transform:uppercase;letter-spacing:2px;">${name || 'YOUR NAME'}</h1>
      <div style="font-size:12px;margin-top:5px;color:#666;">
        ${location} | ${phone} | ${email}
      </div>
    </div>
    
    ${summary ? `
      <div style="margin-bottom:20px;">
        <h3 style="font-size:14px;border-bottom:1px solid #EEE;padding-bottom:5px;margin-bottom:10px;text-transform:uppercase;">Professional Summary</h3>
        <p style="font-size:12px;text-align:justify;">${summary}</p>
      </div>
    ` : ''}

    <div style="margin-bottom:20px;">
      <h3 style="font-size:14px;border-bottom:1px solid #EEE;padding-bottom:5px;margin-bottom:10px;text-transform:uppercase;">Technical Skills</h3>
      <p style="font-size:12px;">${skills.join(' • ')}</p>
    </div>

    <div style="margin-bottom:20px;">
      <h3 style="font-size:14px;border-bottom:1px solid #EEE;padding-bottom:5px;margin-bottom:10px;text-transform:uppercase;">Experience</h3>
      ${Array.from(document.querySelectorAll('#experience-list .resume-item-card')).map(card => {
    const inputs = card.querySelectorAll('input, textarea');
    return `
          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:12px;">
              <span>${inputs[0].value}</span>
              <span>${inputs[2].value}</span>
            </div>
            <div style="font-style:italic;font-size:12px;margin-bottom:4px;">${inputs[1].value}</div>
            <p style="font-size:11px;margin:0;">${inputs[3].value}</p>
          </div>
        `;
  }).join('')}
    </div>

    <div style="margin-bottom:20px;">
      <h3 style="font-size:14px;border-bottom:1px solid #EEE;padding-bottom:5px;margin-bottom:10px;text-transform:uppercase;">Education</h3>
      ${Array.from(document.querySelectorAll('#education-list .resume-item-card')).map(card => {
    const inputs = card.querySelectorAll('input');
    return `
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
            <span><strong>${inputs[0].value}</strong> - ${inputs[1].value}</span>
            <span>${inputs[2].value}</span>
          </div>
        `;
  }).join('')}
    </div>
  `;
  page.innerHTML = html;
}

function downloadResumePDF() {
  console.log('PDF Download triggered');
  const page = document.getElementById('resume-page');
  if (!page) {
    console.error('Resume page element not found');
    return;
  }

  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      console.warn('jsPDF not found, falling back to print');
      window.print();
      return;
    }

    const doc = new jsPDF('p', 'pt', 'a4');
    doc.setFont('times', 'normal');
    doc.setFontSize(11);

    // Header
    const name = document.getElementById('res-name')?.value || 'RESUME';
    const text = page.innerText;
    const lines = doc.splitTextToSize(text, 500);

    doc.text(lines, 40, 50);
    doc.save(`${name.replace(/\s+/g, '_')}_Resume.pdf`);
    showToast('Resume PDF downloaded!');
  } catch (err) {
    console.error('PDF Generation Error:', err);
    showToast('PDF failed. Opening print dialog instead...', 'info');
    window.print();
  }
}

async function generateAIResume() {
  const btn = event.currentTarget;
  const originalText = btn.innerHTML;
  btn.innerHTML = '✨ Analyzing...';
  btn.disabled = true;

  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
    const { data: tasks } = await supabase.from('tasks').select('title').eq('user_id', currentUserId).eq('status', 'completed');

    const skillsList = (tasks || []).map(t => t.title).join(', ') || 'Web Development, Problem Solving';
    const goalText = getGoalText(profile.goal);
    const { college, branch } = getProfileCollege(profile);

    const prompt = `Generate a JSON object for a professional resume.
    USER: ${profile.full_name}
    GOAL: ${goalText}
    SKILLS: ${skillsList}
    
    RETURN ONLY VALID JSON. Format:
    {
      "name": "${profile.full_name}",
      "email": "user@example.com",
      "phone": "7400159509",
      "location": "Mumbai, Maharashtra",
      "summary": "Professional summary based on goal...",
      "skills": ["Skill1", "Skill2"],
      "experience": [{"company": "Project A", "role": "Developer", "years": "2024", "desc": "Built a web app..."}],
      "education": [{"school": "${college || 'University'}", "degree": "${branch || 'B.Tech'}", "year": "2025"}]
    }`;

    const result = await callAI(prompt, 1200);
    if (result) {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const data = JSON.parse(jsonMatch[0]);

      // Populate basics
      document.getElementById('res-name').value = data.name || '';
      document.getElementById('res-email').value = data.email || '';
      document.getElementById('res-phone').value = data.phone || '';
      document.getElementById('res-location').value = data.location || '';
      document.getElementById('res-summary').value = data.summary || '';
      document.getElementById('res-skills-input').value = (data.skills || []).join(', ');

      // Experience
      const expList = document.getElementById('experience-list');
      expList.innerHTML = '';
      (data.experience || []).forEach(exp => {
        const item = document.createElement('div');
        item.className = 'resume-item-card';
        item.innerHTML = `
          <input type="text" value="${exp.company}" class="form-input" oninput="updateResumePreview()">
          <input type="text" value="${exp.role}" class="form-input" oninput="updateResumePreview()">
          <input type="text" value="${exp.years}" class="form-input" oninput="updateResumePreview()">
          <textarea class="form-input" oninput="updateResumePreview()">${exp.desc}</textarea>
          <button onclick="this.parentElement.remove();updateResumePreview()" class="remove-btn">Remove</button>
        `;
        expList.appendChild(item);
      });

      // Education
      const eduList = document.getElementById('education-list');
      eduList.innerHTML = '';
      (data.education || []).forEach(edu => {
        const item = document.createElement('div');
        item.className = 'resume-item-card';
        item.innerHTML = `
          <input type="text" value="${edu.school}" class="form-input" oninput="updateResumePreview()">
          <input type="text" value="${edu.degree}" class="form-input" oninput="updateResumePreview()">
          <input type="text" value="${edu.year}" class="form-input" oninput="updateResumePreview()">
          <button onclick="this.parentElement.remove();updateResumePreview()" class="remove-btn">Remove</button>
        `;
        eduList.appendChild(item);
      });

      updateResumePreview();
      showToast('Resume auto-filled successfully!');
    }
  } catch (err) {
    console.error('AI Resume Error:', err);
    showToast('Failed to auto-fill resume', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function exportJSONResume() {
  const json = {
    basics: {
      name: document.getElementById('res-name').value,
      email: document.getElementById('res-email').value,
      phone: document.getElementById('res-phone').value,
      location: { address: document.getElementById('res-location').value },
      summary: document.getElementById('res-summary').value
    },
    skills: [{ keywords: document.getElementById('res-skills-input').value.split(',') }],
    // ... add more mapping to JSON Resume standard
  };
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'resume.json';
  a.click();
}

// Inject Resume Styles
const resumeStyles = document.createElement('style');
resumeStyles.textContent = `
  .resume-nav-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border: none;
    background: transparent;
    border-radius: 12px;
    color: #64748B;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 200ms;
    text-align: left;
  }
  .resume-nav-btn:hover { background: #F1F5F9; color: #0F172A; }
  .resume-nav-btn.active { background: #059669; color: white; box-shadow: 0 4px 12px rgba(5,150,105,0.2); }
  .form-label { display: block; font-size: 12px; font-weight: 700; color: #94A3B8; text-transform: uppercase; margin-bottom: 6px; }
  .form-input { width: 100%; padding: 12px; border: 1px solid #E2E8F0; border-radius: 10px; font-size: 14px; transition: all 200ms; }
  .form-input:focus { outline: none; border-color: #059669; box-shadow: 0 0 0 3px rgba(5,150,105,0.1); }
  .resume-item-card { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 12px; margin-bottom: 16px; position: relative; }
  .remove-btn { position: absolute; top: 12px; right: 12px; background: #FEE2E2; color: #EF4444; border: none; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; }
`;
document.head.appendChild(resumeStyles);

function analyzeResume(input) {
  const msg = document.getElementById('resume-suggestions');
  if (msg) msg.textContent = '🔍 Analyzing resume for keywords and ATS compatibility...';
  setTimeout(() => {
    if (msg) msg.textContent = '✅ Analysis complete: Strong focus on technical skills. Suggestion: Add more project impact metrics.';
  }, 2000);
}

function downloadResumePDF() {
  const preview = document.getElementById('resume-preview');
  if (!preview || preview.textContent.includes('Generate a resume')) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(10);
  const text = preview.innerText;
  const lines = doc.splitTextToSize(text, 180);
  doc.text(lines, 15, 20);
  doc.save('SkillBridge_Resume.pdf');
}



function getGoalText(goalField) {
  if (!goalField) return '';
  try {
    const parsed = JSON.parse(goalField);
    if (parsed && typeof parsed === 'object' && 'goal' in parsed) {
      return parsed.goal || '';
    }
  } catch (e) {}
  return goalField;
}

function getProfileCollege(p) {
  let college = '';
  let branch = '';
  if (!p || !p.goal) return { college, branch };
  try {
    const parsed = JSON.parse(p.goal);
    if (parsed && typeof parsed === 'object') {
      college = parsed.college_name || '';
      branch = parsed.branch || '';
    }
  } catch (e) {}
  return { college, branch };
}

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

function updateProfileUI(p, email) {
  const name = p.full_name || email.split('@')[0];
  currentUserName = name;
  setText('user-display-name', name);
  setText('greeting-name', name.split(' ')[0]);
  setText('greeting-text', `Welcome back, ${name.split(' ')[0]} 👋`);
  
  const goalText = getGoalText(p.goal);
  const { college, branch } = getProfileCollege(p);

  setText('greeting-sub', goalText ? `Path: ${goalText}` : 'Select a goal to start');
  setText('profile-initials', name.substring(0, 1).toUpperCase());
  setText('profile-name', name);
  setText('profile-goal', goalText || 'Set your goal');
  setText('profile-college', (college || '') + (branch ? ' · ' + branch : ''));
  const avatar = document.getElementById('profile-avatar'); if (avatar) avatar.textContent = name.substring(0, 1).toUpperCase();
  
  // Set edit form input values so they are visible and editable
  const editNameEl = document.getElementById('edit-name');
  if (editNameEl) editNameEl.value = p.full_name || '';
  const editCollegeEl = document.getElementById('edit-college-name');
  if (editCollegeEl) editCollegeEl.value = college || '';
  const editBranchEl = document.getElementById('edit-branch');
  if (editBranchEl) editBranchEl.value = branch || 'Computer Science';
  const editDreamjobEl = document.getElementById('edit-dreamjob');
  if (editDreamjobEl) editDreamjobEl.value = goalText || '';
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


function getSmartFallback(goal) { return { title: goal + " Roadmap", phases: [{ phase: "Phase 1", skills: ["Skill 1"], tasks: [{ title: "Task 1", difficulty: "Easy" }] }] }; }

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

// ── Init placement tab ───────────────────
async function initPlacementTab() {
  const { data: attempts } = await supabase
    .from('placement_attempts')
    .select('*')
    .eq('user_id', currentUserId);

  if (attempts) {
    attempts.forEach(att => {
      if (att.round === 1 && att.passed) placementProgress.r1 = true, placementProgress.r1Score = att.score;
      if (att.round === 2 && att.passed) placementProgress.r2 = true, placementProgress.r2Score = att.score;
      if (att.round === 3 && att.passed) placementProgress.r3 = true, placementProgress.r3Score = att.score;
    });
  }
  updatePlacementProgress();
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

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
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
        placementResumeText = text;
        onResumeReady(file);
      } catch (err) {
        console.error("PDF Parsing error:", err);
        showToast("Error reading PDF. Please ensure it is a valid text-based PDF.", "warning");
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = (e) => {
      placementResumeText = e.target.result;
      onResumeReady(file);
    };
    reader.readAsText(file);
  }
}

function onResumeReady(file) {
  document.getElementById('dropzone-content').innerHTML = `
    <div style="font-size:32px;margin-bottom:8px;">✅</div>
    <div style="font-size:14px;font-weight:600;color:var(--emerald);">
      ${file.name} uploaded!
    </div>
    <div style="font-size:12px;color:var(--text-muted);">Ready for analysis</div>
  `;
  document.getElementById('resume-action-buttons').style.display = 'block';
  placementProgress.resume = true;
  updatePlacementProgress();
}

async function processAndAnalyzeResume() {
  const resArea = document.getElementById('resume-analysis-result');
  resArea.innerHTML = `
    <div style="padding:24px; text-align:center; background:var(--bg-surface); border-radius:16px; border:1px solid var(--border);">
      <div style="font-size:24px; margin-bottom:12px; animation: pulse 1.5s infinite;">🤖</div>
      <div style="font-weight:600; color:var(--emerald);">AI is analyzing your resume...</div>
      <div style="font-size:12px; color:var(--text-muted); margin-top:8px;">Extracting skills, ATS parsing, and matching against job profiles.</div>
    </div>
  `;

  // Simulate AI Analysis
  const prompt = `Analyze this resume. Return a JSON with { "score": Number(0-100), "strengths": ["...", "...", "..."], "improvements": ["...", "..."] }. Resume: ${placementResumeText.substring(0, 1000)}`;
  const result = await callAI(prompt);
  
  let score = Math.floor(Math.random() * 20) + 75;
  let strengths = ["Good education background", "Relevant technical skills", "Clear formatting"];
  let improvements = ["Add more quantifiable metrics", "Include links to portfolio/GitHub"];
  
  try {
    if(result) {
      const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)[0]);
      if(parsed.score) score = parsed.score;
      if(parsed.strengths) strengths = parsed.strengths;
      if(parsed.improvements) improvements = parsed.improvements;
    }
  } catch(e) { console.log('Parsing fallback'); }

  resArea.innerHTML = `
    <div style="background:var(--bg-surface); border-radius:16px; border:1px solid var(--border); box-shadow:var(--shadow-card); overflow:hidden;">
      <div style="padding:20px; background:var(--bg-card); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <div style="font-weight:700; font-size:16px; color:var(--text-primary);">📊 Resume Analysis Complete</div>
        <div style="font-size:24px; font-weight:800; color:var(--fuchsia); text-shadow:0 0 15px var(--fuchsia-glow);">${score}/100</div>
      </div>
      <div style="padding:20px; display:grid; grid-template-columns:1fr 1fr; gap:20px;">
        <div>
          <div style="font-size:12px; font-weight:700; color:var(--emerald); text-transform:uppercase; margin-bottom:12px; letter-spacing:0.05em;">Top Strengths</div>
          <ul style="padding-left:16px; font-size:13px; color:var(--text-secondary); line-height:1.6;">
            ${strengths.map(s => `<li style="margin-bottom:6px;">${s}</li>`).join('')}
          </ul>
        </div>
        <div>
          <div style="font-size:12px; font-weight:700; color:var(--amber); text-transform:uppercase; margin-bottom:12px; letter-spacing:0.05em;">Suggested Improvements</div>
          <ul style="padding-left:16px; font-size:13px; color:var(--text-secondary); line-height:1.6;">
            ${improvements.map(i => `<li style="margin-bottom:6px;">${i}</li>`).join('')}
          </ul>
        </div>
      </div>
      <div style="padding:16px 20px; border-top:1px solid var(--border); background:rgba(0,0,0,0.2);">
        <button onclick="scrollToRound('step-r1')" style="width:100%; padding:12px; background:var(--grad-brand); color:white; border:none; border-radius:10px; font-weight:600; cursor:pointer; font-size:14px; box-shadow:0 0 15px var(--fuchsia-glow); transition:all 200ms;">Proceed to Round 1 Test →</button>
      </div>
    </div>
  `;
  
  placementProgress.resume = true;
  placementProgress.r1 = true; // Unlock round 1 automatically
  updatePlacementProgress();
}

// ── Round 1: Aptitude + Coding ──────────
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

async function startRound1Test() {
  const area = document.getElementById('r1-test-area');
  area.innerHTML = '<div style="padding:40px;text-align:center;"><div style="font-size:24px; margin-bottom:12px; animation: pulse 1.5s infinite;">🧠</div><div style="color:var(--emerald); font-weight:600;">Generating realistic technical test for ' + selectedCompanyType + '...</div><div style="font-size:12px; color:var(--text-muted); margin-top:8px;">This might take a moment.</div></div>';
  area.style.display = 'block';
  document.getElementById('start-r1-btn').style.display = 'none';

  const prompt = `Generate a technical test for a ${selectedCompanyType} software engineering role. 
  Include exactly 10 Technical MCQs (mix of data structures, web tech, logic) and 1 Coding Question.
  Return ONLY valid JSON format: {"mcqs": [{"q": "...", "a": ["opt1", "opt2", "opt3", "opt4"], "correct": 0}], "coding": {"q": "..."}}
  Ensure "correct" is the integer index (0-3) of the correct answer.`;

  const result = await callAI(prompt);
  try {
    const test = JSON.parse(result.match(/\{[\s\S]*\}/)[0]);
    currentR1Test = test;
    renderRound1(test);
  } catch (e) {
    area.innerHTML = '<div style="color:var(--rose); padding:20px;">Failed to generate test. Please try again.</div>';
    document.getElementById('start-r1-btn').style.display = 'block';
  }
}

let r1TimerInterval;
let r1TimeLeft = 30 * 60; // 30 minutes

function renderRound1(test) {
  const area = document.getElementById('r1-test-area');
  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:var(--bg-surface); padding:12px 18px; border-radius:12px; border:1px solid var(--border); box-shadow:var(--shadow-card);">
      <div style="font-weight:600; font-size:14px; color:var(--emerald);">🕒 Time Remaining: <span id="r1-timer" style="font-weight:700; font-size:16px;">30:00</span></div>
      <div style="font-size:12px; color:var(--text-muted);">Do not refresh this page.</div>
    </div>
    <div style="padding:10px;">
  `;

  test.mcqs.forEach((m, i) => {
    html += `
      <div style="margin-bottom:24px; background:var(--bg-card); padding:16px; border-radius:12px; border:1px solid var(--border);">
        <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text-primary);">Q${i + 1}: ${m.q}</div>
        ${m.a.map((opt, oi) => `
          <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:13px; cursor:pointer; padding:8px 12px; background:var(--bg-surface); border-radius:8px; border:1px solid var(--border); transition:all 200ms;"
            onmouseover="this.style.borderColor='var(--fuchsia)'" onmouseout="this.style.borderColor='var(--border)'">
            <input type="radio" name="mcq-${i}" value="${oi}"> <span>${opt}</span>
          </label>
        `).join('')}
      </div>
    `;
  });

  html += `
    <div style="margin-bottom:24px; background:var(--bg-card); padding:16px; border-radius:12px; border:1px solid var(--border);">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text-primary);">💻 Coding Challenge</div>
      <div style="background:var(--bg-base); color:var(--text-secondary); padding:16px; border-radius:8px; font-family:monospace; font-size:13px; margin-bottom:16px; border:1px solid var(--border); line-height:1.5;">
        ${test.coding.q}
      </div>
      <textarea id="coding-ans" style="width:100%;height:160px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:14px;font-size:13px;color:var(--text-primary);font-family:monospace;resize:vertical;" placeholder="Write your logic or code here..."></textarea>
    </div>
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
      if (r1TimeLeft < 300) tEl.style.color = 'var(--rose)'; // Red when < 5 mins
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

  showToast('AI is evaluating your answers...', 'info');

  // Grade MCQs deterministically
  let mcqScore = 0;
  if (currentR1Test && currentR1Test.mcqs) {
    currentR1Test.mcqs.forEach((m, i) => {
      const selected = document.querySelector(`input[name="mcq-${i}"]:checked`);
      if (selected && parseInt(selected.value) === m.correct) {
        mcqScore++;
      }
    });
  }

  // Grade coding challenge with AI
  const codeAns = document.getElementById('coding-ans')?.value || '';
  let codeScore = 0;
  let strengths = 'Syntax structure';
  let weakAreas = 'Algorithmic Optimization';

  if (codeAns.trim().length > 10 && currentR1Test) {
    const prompt = `Evaluate this code answer for the question: "${currentR1Test.coding.q}". 
    Candidate's Code: "${codeAns}". 
    Score it out of 50. Return ONLY valid JSON: {"score": <number 0-50>, "strength": "<1-3 words>", "weakness": "<1-3 words>"}`;
    try {
      const res = await callAI(prompt);
      const parsed = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
      codeScore = parsed.score || 0;
      strengths = parsed.strength || strengths;
      weakAreas = parsed.weakness || weakAreas;
    } catch(e) {
      console.log('AI coding eval fallback');
      codeScore = 25; 
    }
  }

  // Max 50 for MCQs (10 * 5) + Max 50 for Code
  const finalScore = (mcqScore * 5) + codeScore;
  const passed = finalScore >= 70;

  await savePlacementAttempt(1, finalScore, passed);

  document.getElementById('r1-test-area').style.display = 'none';
  const res = document.getElementById('r1-result');
  res.style.display = 'block';
  
  res.innerHTML = `
    <div style="padding:24px;background:var(--bg-card);border-radius:16px;border:1px solid ${passed ? 'var(--emerald)' : 'var(--rose)'};box-shadow:var(--shadow-card);">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:42px;margin-bottom:12px;text-shadow:0 0 20px ${passed ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'};">${passed ? '🎉' : '❌'}</div>
        <div style="font-size:22px;font-weight:800;color:${passed ? 'var(--emerald)' : 'var(--rose)'};">Score: ${finalScore}/100</div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">(MCQs: ${mcqScore*5}/50 | Coding: ${codeScore}/50)</div>
        <p style="font-size:14px;color:var(--text-secondary);margin-top:8px;">
          ${passed ? 'Outstanding! You have strong fundamentals and unlocked Round 2.' : 'Almost there. Keep practicing your logic and try again!'}
        </p>
      </div>
      
      <div style="background:var(--bg-surface);padding:16px;border-radius:12px;border:1px solid var(--border);">
        <h4 style="font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">AI Analysis</h4>
        <div style="font-size:13px;color:var(--text-primary);line-height:1.6;">
          <strong>Strengths:</strong> ${strengths}.<br>
          <strong style="color:var(--amber);">Areas to Improve:</strong> ${weakAreas}.<br>
          <strong>Recommendation:</strong> ${passed ? 'Ready for technical interview.' : 'Review core concepts and practice more timed challenges.'}
        </div>
      </div>
      
      ${passed ? `<button onclick="scrollToRound('step-r2')" style="width:100%;margin-top:20px;padding:12px;background:var(--emerald);color:white;border:none;border-radius:10px;font-weight:600;cursor:pointer;">Proceed to Round 2 →</button>` : ''}
    </div>
  `;

  if (passed) {
    placementProgress.r1 = true;
    placementProgress.r1Score = finalScore;
    updatePlacementProgress();
  }
}

// ── Round 2: Technical Interview ─────────
let r2TimerInterval;
let r2TimeLeft = 20 * 60; // 20 mins
let r2ChatHistory = [];

// Speech Synthesis (AI Speaks)
function speakText(text) {
  if (!('speechSynthesis' in window)) {
    console.warn("Speech Synthesis not supported in this browser.");
    return;
  }

  // Cancel any active speech first
  window.speechSynthesis.cancel();

  const startVisuals = () => {
    const waveEl = document.getElementById('r2-audio-waves');
    const statusText = document.getElementById('r2-status-text');
    const statusDot = document.getElementById('r2-status-dot');
    if (waveEl) waveEl.style.display = 'flex';
    if (statusText) statusText.textContent = 'AI is speaking...';
    if (statusDot) statusDot.style.color = '#EC4899'; // Pink fuchsia dot
  };

  const stopVisuals = () => {
    const waveEl = document.getElementById('r2-audio-waves');
    const statusText = document.getElementById('r2-status-text');
    const statusDot = document.getElementById('r2-status-dot');
    if (waveEl) waveEl.style.display = 'none';
    if (statusText) statusText.textContent = 'Live Interview';
    if (statusDot) statusDot.style.color = 'var(--amber)';
  };

  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // Find a premium/clear English voice
    const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                         voices.find(v => v.lang.startsWith('en') && v.name.includes('Natural')) ||
                         voices.find(v => v.lang.startsWith('en')) ||
                         voices[0];
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    utterance.rate = 0.95; // Slightly slower for readability
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      startVisuals();
    };

    utterance.onend = () => {
      stopVisuals();
    };

    utterance.onerror = () => {
      stopVisuals();
    };

    window.speechSynthesis.speak(utterance);
  };

  // If voices are not loaded yet, wait for them
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      speak();
      window.speechSynthesis.onvoiceschanged = null; // Clear listener
    };
  } else {
    speak();
  }
}

// Speech Recognition (User Speaks)
let r2Recognition = null;
let r2IsListening = false;

function toggleR2SpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("Speech Recognition is not supported in this browser. Please use Chrome or Edge.", "error");
    return;
  }

  const micBtn = document.getElementById('r2-mic-btn');
  const micIcon = document.getElementById('r2-mic-icon');
  const inputEl = document.getElementById('r2-input');

  if (r2IsListening) {
    if (r2Recognition) r2Recognition.stop();
    return;
  }

  if (!r2Recognition) {
    r2Recognition = new SpeechRecognition();
    r2Recognition.continuous = false;
    r2Recognition.interimResults = false;
    r2Recognition.lang = 'en-US';

    r2Recognition.onstart = () => {
      r2IsListening = true;
      if (micBtn) {
        micBtn.style.background = 'rgba(239, 68, 68, 0.15)';
        micBtn.style.borderColor = '#EF4444';
        micBtn.style.color = '#EF4444';
        micBtn.style.animation = 'pulseGlowRed 1.5s infinite';
      }
      if (micIcon) micIcon.style.transform = 'scale(1.15)';
      if (inputEl) inputEl.placeholder = 'Listening... Speak clearly now...';
      showToast("Microphone is active. Start speaking!", "info");
    };

    r2Recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (inputEl) {
        inputEl.value = transcript;
        inputEl.placeholder = 'Type or use mic to answer...';
      }
    };

    r2Recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        showToast(`Speech recognition error: ${event.error}`, "error");
      }
      stopListeningUI();
    };

    r2Recognition.onend = () => {
      stopListeningUI();
    };
  }

  try {
    // If AI is currently speaking, cancel it before user starts speaking
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    r2Recognition.start();
  } catch (e) {
    console.error('Recognition start error:', e);
  }

  function stopListeningUI() {
    r2IsListening = false;
    if (micBtn) {
      micBtn.style.background = 'rgba(255, 255, 255, 0.05)';
      micBtn.style.borderColor = 'var(--border)';
      micBtn.style.color = 'var(--text-muted)';
      micBtn.style.animation = 'none';
    }
    if (micIcon) micIcon.style.transform = 'scale(1)';
    if (inputEl && inputEl.placeholder === 'Listening... Speak clearly now...') {
      inputEl.placeholder = 'Type or use mic to answer...';
    }
  }
}

// Inject custom styles for mic button and pulse animation if not exists
if (!document.getElementById('r2-voice-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'r2-voice-styles';
  styleEl.innerHTML = `
    @keyframes pulseGlowRed {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    @keyframes r2Wave {
      0% { height: 4px; }
      100% { height: 14px; }
    }
    .r2-audio-bar {
      display: inline-block;
      width: 2px;
      background: #EC4899;
      border-radius: 1px;
    }
  `;
  document.head.appendChild(styleEl);
}

// Expose functions globally for HTML event handlers
window.toggleR2SpeechRecognition = toggleR2SpeechRecognition;

async function startRound2Interview() {
  const area = document.getElementById('r2-chat-area');
  area.style.display = 'block';
  document.getElementById('start-r2-btn').style.display = 'none';

  r2ChatHistory = [
    { role: 'ai', text: `Hello! I am your Technical AI Interviewer for the ${selectedCompanyType} role. I've reviewed your resume. Are you ready to begin?` }
  ];

  area.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; background:var(--bg-surface); padding:10px 16px; border-radius:10px; border:1px solid var(--border);">
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="color:var(--amber); transition: color 0.3s;" id="r2-status-dot">●</span>
        <span id="r2-status-text" style="font-size:12px; color:var(--text-secondary); font-weight: 500;">Live Interview</span>
        <div id="r2-audio-waves" style="display:none; align-items:center; gap:2px; margin-left:6px;">
          <span class="r2-audio-bar" style="height:6px; animation: r2Wave 0.6s ease-in-out infinite alternate;"></span>
          <span class="r2-audio-bar" style="height:10px; animation: r2Wave 0.6s ease-in-out infinite alternate 0.15s;"></span>
          <span class="r2-audio-bar" style="height:4px; animation: r2Wave 0.6s ease-in-out infinite alternate 0.3s;"></span>
        </div>
      </div>
      <div style="font-weight:700; font-size:14px; color:var(--emerald);" id="r2-timer">20:00</div>
    </div>
    <div id="r2-messages" style="height:340px; overflow-y:auto; border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:16px; display:flex; flex-direction:column; gap:12px; background:var(--bg-base); box-shadow:inset 0 4px 20px rgba(0,0,0,0.2);">
      <div style="background:var(--bg-card); border:1px solid var(--border); padding:12px 16px; border-radius:12px; border-top-left-radius:2px; font-size:13px; align-self:flex-start; max-width:85%; color:var(--text-primary); line-height:1.5;">
        <strong style="color:var(--fuchsia); display:block; margin-bottom:4px; font-size:11px; text-transform:uppercase;">Interviewer</strong>
        Hello! I am your Technical AI Interviewer for the ${selectedCompanyType} role. I've reviewed your resume. Are you ready to begin?
      </div>
    </div>
    <div style="display:flex; gap:10px; align-items:center; width:100%;">
      <input type="text" id="r2-input" style="flex:1; padding:14px; border:1px solid var(--border); border-radius:10px; background:var(--bg-surface); color:var(--text-primary); outline:none; transition:all 200ms;" placeholder="Type or use mic to answer..." onfocus="this.style.borderColor='var(--fuchsia)'" onblur="this.style.borderColor='var(--border)'" onkeypress="if(event.key==='Enter') sendR2Message()">
      <button id="r2-mic-btn" onclick="toggleR2SpeechRecognition()" style="flex-shrink:0; background:rgba(255, 255, 255, 0.05); border:1px solid var(--border); color:var(--text-muted); cursor:pointer; border-radius:10px; width:48px; height:48px; display:flex; align-items:center; justify-content:center; transition:all 200ms;" title="Speak your response">
        <svg id="r2-mic-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
      </button>
      <button onclick="sendR2Message()" style="flex-shrink:0; padding:0 24px; background:var(--grad-brand); color:white; border:none; border-radius:10px; cursor:pointer; font-weight:600; font-size:14px; box-shadow:var(--shadow-fuchsia); height:48px;">Send</button>
    </div>
  `;
  
  clearInterval(r2TimerInterval);
  r2TimeLeft = 20 * 60;
  r2TimerInterval = setInterval(() => {
    r2TimeLeft--;
    const m = Math.floor(r2TimeLeft / 60).toString().padStart(2, '0');
    const s = (r2TimeLeft % 60).toString().padStart(2, '0');
    const tEl = document.getElementById('r2-timer');
    if (tEl) tEl.textContent = `${m}:${s}`;
    if (r2TimeLeft <= 0) {
      clearInterval(r2TimerInterval);
      showToast('Time is up! Concluding interview...', 'warning');
      finishRound2();
    }
  }, 1000);

  // Warm up voices and speak intro question
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
  }
  setTimeout(() => {
    speakText(`Hello! I am your Technical AI Interviewer for the ${selectedCompanyType} role. I've reviewed your resume. Are you ready to begin?`);
  }, 100);
}

async function sendR2Message() {
  const input = document.getElementById('r2-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  // Cancel any active SpeechSynthesis speaking
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  // Stop mic listening if active
  if (r2IsListening && r2Recognition) {
    r2Recognition.stop();
  }

  r2ChatHistory.push({ role: 'user', text: msg });
  addChatMessage('user', msg);

  // If user has provided 4 answers (total 8 messages including the intro), conclude and evaluate.
  if (r2ChatHistory.length >= 8) {
    clearInterval(r2TimerInterval);
    showTyping('r2-messages');
    await finishRound2();
    return;
  }

  showTyping('r2-messages');
  const response = await getAIInterviewResponse(msg);
  hideTyping('r2-messages');
  
  r2ChatHistory.push({ role: 'ai', text: response });
  addChatMessage('ai', response);

  // Speak the interviewer's new response
  speakText(response);
}

function addChatMessage(role, text) {
  const container = document.getElementById('r2-messages');
  const div = document.createElement('div');
  
  if (role === 'user') {
    div.style.cssText = `padding:12px 16px; border-radius:12px; border-bottom-right-radius:2px; font-size:13px; max-width:85%; background:var(--emerald); color:white; align-self:flex-end; line-height:1.5; box-shadow:0 4px 12px rgba(16,185,129,0.2);`;
    div.textContent = text;
  } else {
    div.style.cssText = `padding:12px 16px; border-radius:12px; border-top-left-radius:2px; font-size:13px; max-width:85%; background:var(--bg-card); border:1px solid var(--border); color:var(--text-primary); align-self:flex-start; line-height:1.5;`;
    div.innerHTML = `<strong style="color:var(--fuchsia); display:block; margin-bottom:4px; font-size:11px; text-transform:uppercase;">Interviewer</strong>${text}`;
  }
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping(containerId) { 
  const container = document.getElementById(containerId); 
  if(!container) return;
  const typing = document.createElement('div'); 
  typing.id = 'typing-indicator-' + containerId; 
  typing.style.cssText = 'padding:12px 16px; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; border-top-left-radius:2px; width:fit-content; display:flex; gap:4px; align-self:flex-start;'; 
  typing.innerHTML = '<span class="dot" style="background:var(--fuchsia);"></span><span class="dot" style="background:var(--fuchsia);"></span><span class="dot" style="background:var(--fuchsia);"></span>'; 
  container.appendChild(typing); 
  container.scrollTop = container.scrollHeight; 
}
function hideTyping(containerId) { 
  document.getElementById('typing-indicator-' + containerId)?.remove(); 
}

async function getAIInterviewResponse(userMsg) {
  const prompt = `You are a technical interviewer for ${selectedCompanyType}. The candidate said: "${userMsg}". 
  Reply as an interviewer. Ask the next technical question based on their resume: ${placementResumeText.substring(0, 500)}`;
  return await callAI(prompt);
}

async function finishRound2() {
  // Cancel active speech synthesis & recognition when finishing
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (typeof r2IsListening !== 'undefined' && r2IsListening && r2Recognition) {
    r2Recognition.stop();
  }

  // Update UI to show evaluation state
  const inputRow = document.getElementById('r2-input')?.parentElement;
  if(inputRow) inputRow.innerHTML = '<div style="color:var(--emerald); padding:14px; font-weight:600; text-align:center; width:100%; border:1px solid var(--border); border-radius:10px; background:var(--bg-surface); animation:pulse 1.5s infinite;">Concluding interview & evaluating responses...</div>';

  // Evaluate transcript
  const transcript = r2ChatHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
  const prompt = `Evaluate this technical interview transcript for a ${selectedCompanyType} software engineering role. 
  Transcript:
  ${transcript}
  Score the candidate out of 100 based strictly on the accuracy, depth, and logic of their answers.
  If the candidate gave short, generic, non-technical, or nonsensical answers (or just said "hi/yes"), score them very low (0-30).
  Return ONLY valid JSON: {"score": <number 0-100>, "feedback": "<2-3 sentences of highly constructive feedback detailing exact weaknesses or strengths>"}
  Do not return markdown or backticks, just the JSON string.`;

  let finalScore = 0;
  let aiFeedback = "Interview completed, but the evaluator encountered an issue parsing the feedback.";
  try {
    const res = await callAI(prompt);
    const parsed = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
    finalScore = parsed.score || 0;
    aiFeedback = parsed.feedback || aiFeedback;
  } catch(e) {
    console.log('R2 Evaluation error fallback');
    finalScore = 40; // Fallback to failing score
  }

  const passed = finalScore >= 70;

  document.getElementById('r2-chat-area').style.display = 'none';
  const resArea = document.getElementById('r2-result');
  resArea.style.display = 'block';
  
  resArea.innerHTML = `
    <div style="padding:24px;background:var(--bg-card);border-radius:16px;border:1px solid ${passed ? 'var(--emerald)' : 'var(--rose)'};box-shadow:var(--shadow-card);">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:42px;margin-bottom:12px;text-shadow:0 0 20px ${passed ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'};">${passed ? '🚀' : '❌'}</div>
        <div style="font-size:22px;font-weight:800;color:${passed ? 'var(--emerald)' : 'var(--rose)'};">Score: ${finalScore}/100</div>
        <p style="font-size:14px;color:var(--text-secondary);margin-top:8px;">
          ${passed ? 'Your technical foundation and communication are strong. Final Video Round Unlocked.' : 'You must provide detailed technical answers to clear this round.'}
        </p>
      </div>
      <div style="background:var(--bg-surface);padding:16px;border-radius:12px;border:1px solid var(--border);">
        <h4 style="font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">Interviewer Feedback</h4>
        <div style="font-size:13px;color:var(--text-primary);line-height:1.6;">
          ${aiFeedback}
        </div>
      </div>
      ${passed ? `<button onclick="scrollToRound('step-r3')" style="width:100%;margin-top:20px;padding:14px;background:var(--grad-brand);color:white;border:none;border-radius:10px;font-weight:600;font-size:15px;cursor:pointer;box-shadow:var(--shadow-fuchsia);transition:all 200ms;">Proceed to Final Video Round →</button>` : ''}
    </div>
  `;

  await savePlacementAttempt(2, finalScore, passed);
  if(passed) {
    placementProgress.r2 = true;
    updatePlacementProgress();
  }
}

// ── Round 3: Conversational AI Video Interview ───────────
let r3ChatHistory = [];
let r3QuestionCount = 0;
const R3_MAX_QUESTIONS = 5;
let r3Recognition = null;
let r3IsListening = false;
let r3InterviewActive = false;

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
      utt.onstart  = () => r3SetStatus('speaking');
      utt.onend    = () => { r3SetStatus('idle'); resolve(); };
      utt.onerror  = () => { r3SetStatus('idle'); resolve(); };
      window.speechSynthesis.speak(utt);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); };
    } else { doSpeak(); }
  });
}

function r3SetStatus(state) {
  const el = document.getElementById('r3-status-bar');
  if (!el) return;
  const map = {
    idle:     ['var(--amber)', '●',  'Interview Live'],
    speaking: ['#EC4899',     '🔊', 'AI is speaking...'],
    listening:['#10B981',     '🎤', 'Your turn — speak now'],
    thinking: ['#818CF8',     '⏳', 'AI is thinking...'],
  };
  const [color, icon, label] = map[state] || map.idle;
  el.innerHTML = `<span style="color:${color};margin-right:6px;">${icon}</span><span style="font-size:13px;color:var(--text-secondary);font-weight:500;">${label}</span>`;
}

function r3AddMsg(role, text) {
  const c = document.getElementById('r3-transcript');
  if (!c) return;
  if (c.firstElementChild?.classList.contains('r3-ph')) c.innerHTML = '';
  const isAI = role === 'ai';
  const d = document.createElement('div');
  d.style.cssText = `display:flex;flex-direction:column;align-items:${isAI?'flex-start':'flex-end'};margin-bottom:12px;`;
  d.innerHTML = `<div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em;">${isAI?'🤖 Interviewer':'👤 You'}</div>
    <div style="background:${isAI?'var(--bg-card)':'rgba(0,229,255,0.12)'};color:var(--text-primary);padding:10px 14px;border-radius:12px;${isAI?'border-top-left-radius:2px;border:1px solid var(--border);':'border-top-right-radius:2px;border:1px solid var(--emerald);'}font-size:13px;max-width:88%;line-height:1.6;">${text}</div>`;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

async function startVideoInterview() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const video = document.getElementById('interview-video');
    video.srcObject = stream;
    video.style.display = 'block';
    document.getElementById('camera-off-msg').style.display = 'none';
    document.getElementById('live-indicator').style.display = 'block';
    document.getElementById('start-r3-btn').style.display = 'none';
    document.getElementById('r3-controls').style.display = 'none'; // replaced by new UI
    document.getElementById('ai-q-display').style.display = 'block';

    // Inject conversational UI
    if (!document.getElementById('r3-conv-ui')) {
      const ui = document.createElement('div');
      ui.id = 'r3-conv-ui';
      ui.innerHTML = `
        <div id="r3-status-bar" style="display:flex;align-items:center;gap:8px;background:var(--bg-surface);padding:10px 16px;border-radius:10px;border:1px solid var(--border);margin:12px 0;">
          <span style="color:var(--amber);">●</span><span style="font-size:13px;color:var(--text-secondary);">Initializing...</span>
        </div>
        <div id="r3-transcript" style="height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;padding:16px;background:var(--bg-base);display:flex;flex-direction:column;gap:4px;margin-bottom:12px;box-shadow:inset 0 4px 20px rgba(0,0,0,.2);">
          <div class="r3-ph" style="text-align:center;color:var(--text-muted);font-size:13px;padding:20px;">Interview conversation will appear here...</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <div id="r3-listen-indicator" style="display:none;flex:1;padding:12px 16px;background:rgba(16,185,129,.08);border:1px solid var(--emerald);border-radius:10px;font-size:13px;color:var(--emerald);">🎤 Listening — speak your answer clearly...</div>
          <button onclick="endVideoInterview()" style="padding:10px 20px;background:#FEE2E2;color:#DC2626;border:1px solid #FECACA;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap;flex-shrink:0;">⏹ End Interview</button>
        </div>`;
      document.getElementById('r3-result').before(ui);
    }

    r3ChatHistory = []; r3QuestionCount = 0; r3InterviewActive = true;
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();

    await r3Speak('Welcome to your final video interview. I will ask you a few questions based on your background. Please speak your answers clearly. Let us begin.');
    if (r3InterviewActive) await r3NextQuestion();
  } catch (err) {
    showToast('Camera or Microphone permission denied. Allow access and try again.', 'error');
  }
}

async function r3NextQuestion() {
  if (!r3InterviewActive) return;
  r3QuestionCount++;
  if (r3QuestionCount > R3_MAX_QUESTIONS) { await r3Finish(); return; }

  r3SetStatus('thinking');
  const resumeCtx = (placementResumeText || '').substring(0, 500);
  const histStr = r3ChatHistory.map(m => `${m.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${m.text}`).join('\n');

  const prompt = r3QuestionCount === 1
    ? `You are a professional technical interviewer. Candidate resume: "${resumeCtx}". Ask your first interview question — behavioral or technical, based on their resume. ONE question only, 2 sentences max, no numbering, no preamble.`
    : `You are a professional technical interviewer. Resume: "${resumeCtx}"\n\nConversation:\n${histStr}\n\nAsk the next question (${r3QuestionCount}/${R3_MAX_QUESTIONS}). Follow up naturally on their answer OR move to a new relevant topic. ONE question only, 1-2 sentences, no preamble or numbering.`;

  const question = await callAI(prompt) || 'Can you describe a challenging project you have worked on and what you learned from it?';

  r3ChatHistory.push({ role: 'ai', text: question });
  r3AddMsg('ai', question);
  const qd = document.getElementById('ai-q-display');
  if (qd) qd.textContent = question;

  await r3Speak(question);
  if (!r3InterviewActive) return;

  r3SetStatus('listening');
  document.getElementById('r3-listen-indicator').style.display = 'flex';
  r3Listen();
}

function r3Listen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast('Speech recognition needs Chrome or Edge.', 'error');
    r3ChatHistory.push({ role: 'user', text: '[No speech recognition available]' });
    setTimeout(() => r3NextQuestion(), 2000);
    return;
  }
  if (r3Recognition) { try { r3Recognition.abort(); } catch(e) {} }
  r3Recognition = new SR();
  r3Recognition.continuous = false;
  r3Recognition.interimResults = true;
  r3Recognition.lang = 'en-US';

  let finalText = '';
  let silTimer = null;
  const li = document.getElementById('r3-listen-indicator');

  r3Recognition.onresult = (e) => {
    finalText = '';
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    if (li) li.textContent = `🎤 ${finalText || interim || 'Listening...'}`;
    if (silTimer) clearTimeout(silTimer);
    if (finalText) silTimer = setTimeout(() => r3Recognition.stop(), 1500);
  };

  r3Recognition.onend = async () => {
    r3IsListening = false;
    if (li) li.style.display = 'none';
    if (!r3InterviewActive) return;
    const ans = finalText.trim() || '[No response detected]';
    r3ChatHistory.push({ role: 'user', text: ans });
    r3AddMsg('user', ans);
    await r3NextQuestion();
  };

  r3Recognition.onerror = async (e) => {
    r3IsListening = false;
    if (li) li.style.display = 'none';
    if (!r3InterviewActive) return;
    r3ChatHistory.push({ role: 'user', text: '[Response unclear]' });
    await r3NextQuestion();
  };

  r3IsListening = true;
  try { r3Recognition.start(); } catch(e) {}
}

async function r3Finish() {
  r3InterviewActive = false;
  if (r3Recognition) { try { r3Recognition.abort(); } catch(e) {} }
  r3SetStatus('thinking');
  const qd = document.getElementById('ai-q-display');
  if (qd) qd.textContent = '✅ Generating your results...';

  await r3Speak('The interview is now complete. Please give me a moment to evaluate your performance.');

  const histStr = r3ChatHistory.map(m => `${m.role==='ai'?'Interviewer':'Candidate'}: ${m.text}`).join('\n\n');
  const evalPrompt = `Expert interviewer evaluating this transcript:\n${histStr}\n\nReturn JSON only: {"score":number,"hire":"Strong Hire|Hire|No Hire","communication":"Excellent|Good|Average|Poor","technical":"Excellent|Good|Average|Poor","strengths":["...","..."],"improvements":["...","..."],"summary":"2-3 sentence assessment"}`;
  const raw = await callAI(evalPrompt, 500);

  let sc=78, hire='Hire', comm='Good', tech='Good', summary='The candidate demonstrated solid communication skills and relevant experience.';
  let strengths=['Clear communication','Relevant experience'], improvements=['Add specific metrics','Show deeper technical depth'];
  try {
    if (raw) { const p = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]); sc=p.score||sc; hire=p.hire||hire; comm=p.communication||comm; tech=p.technical||tech; strengths=p.strengths||strengths; improvements=p.improvements||improvements; summary=p.summary||summary; }
  } catch(e) {}

  const video = document.getElementById('interview-video');
  if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
  ['live-indicator','ai-q-display'].forEach(id => { const e=document.getElementById(id); if(e) e.style.display='none'; });
  const ui = document.getElementById('r3-conv-ui');
  if (ui) ui.style.display = 'none';

  const hireColor = hire === 'Strong Hire' ? 'var(--emerald)' : hire === 'Hire' ? 'var(--amber)' : 'var(--rose)';
  const res = document.getElementById('r3-result');
  res.style.display = 'block';
  res.innerHTML = `
    <div style="padding:28px;background:var(--bg-card);border-radius:16px;border:2px solid var(--emerald);box-shadow:0 0 30px rgba(16,185,129,.15);">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:48px;margin-bottom:12px;">🏆</div>
        <div style="font-size:24px;font-weight:800;color:var(--emerald);">Interview Complete!</div>
        <p style="font-size:14px;color:var(--text-secondary);margin-top:6px;">${summary}</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:20px;">
        <div style="background:var(--bg-surface);padding:18px;border-radius:12px;border:1px solid var(--border);text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Score</div>
          <div style="font-size:30px;font-weight:800;color:var(--fuchsia);">${sc}/100</div>
        </div>
        <div style="background:var(--bg-surface);padding:18px;border-radius:12px;border:1px solid var(--border);text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Decision</div>
          <div style="font-size:20px;font-weight:700;color:${hireColor};">${hire}</div>
        </div>
        <div style="background:var(--bg-surface);padding:16px;border-radius:12px;border:1px solid var(--border);text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Communication</div>
          <div style="font-size:16px;font-weight:600;color:var(--amber);">${comm}</div>
        </div>
        <div style="background:var(--bg-surface);padding:16px;border-radius:12px;border:1px solid var(--border);text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Technical</div>
          <div style="font-size:16px;font-weight:600;color:var(--amber);">${tech}</div>
        </div>
      </div>
      <div style="background:var(--bg-surface);padding:16px;border-radius:12px;border:1px solid var(--border);margin-bottom:20px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div><div style="font-size:11px;color:var(--emerald);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">✅ Strengths</div><ul style="padding-left:16px;font-size:13px;color:var(--text-secondary);line-height:1.7;">${strengths.map(s=>`<li>${s}</li>`).join('')}</ul></div>
          <div><div style="font-size:11px;color:var(--amber);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">📈 Improve</div><ul style="padding-left:16px;font-size:13px;color:var(--text-secondary);line-height:1.7;">${improvements.map(i=>`<li>${i}</li>`).join('')}</ul></div>
        </div>
      </div>
      <button onclick="generateFinalReport()" style="width:100%;padding:14px;background:var(--grad-brand);color:white;border:none;border-radius:10px;font-weight:600;font-size:15px;cursor:pointer;box-shadow:var(--shadow-fuchsia);">⬇️ Download Full Placement Report</button>
    </div>`;

  placementProgress.r3 = true;
  await savePlacementAttempt(3, sc, sc >= 60);
  updatePlacementProgress();
  await r3Speak(`Your interview score is ${sc} out of 100. Decision: ${hire}. Well done for completing the interview!`);
}

async function endVideoInterview() {
  r3InterviewActive = false;
  if (r3Recognition) { try { r3Recognition.abort(); } catch(e) {} }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (!document.getElementById('r3-result').innerHTML.trim()) await r3Finish();
}

function toggleMic() {
  const video = document.getElementById('interview-video');
  if (!video.srcObject) return;
  const audioTrack = video.srcObject.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;
  document.getElementById('mic-toggle-btn').textContent = `🎤 Mic: ${audioTrack.enabled ? 'ON' : 'OFF'}`;
}



// ── Helpers ──────────────────────────────
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
  const { resume, r1, r2, r3 } = placementProgress;

  // Update line
  let width = 0;
  if (resume) width = 25;
  if (r1) width = 50;
  if (r2) width = 75;
  if (r3) width = 100;
  document.getElementById('progress-line').style.width = width + '%';

  // Update circles
  if (resume) document.getElementById('step-resume-circle').style.background = '#059669', document.getElementById('step-resume-circle').style.color = 'white';
  if (r1) document.getElementById('step-r1-circle').style.background = '#059669', document.getElementById('step-r1-circle').style.color = 'white';
  if (r2) document.getElementById('step-r2-circle').style.background = '#059669', document.getElementById('step-r2-circle').style.color = 'white';
  if (r3) document.getElementById('step-r3-circle').style.background = '#059669', document.getElementById('step-r3-circle').style.color = 'white';

  // Unlock sections
  if (r1) {
    document.getElementById('section-round2').style.opacity = '1';
    document.getElementById('section-round2').style.pointerEvents = 'auto';
    document.getElementById('r2-lock-text').textContent = '✅ Round 1 Passed';
  }
  if (r2) {
    document.getElementById('section-round3').style.opacity = '1';
    document.getElementById('section-round3').style.pointerEvents = 'auto';
    document.getElementById('r3-lock-text').textContent = '✅ Round 2 Passed';
  }
}

function scrollToRound(id) {
  const targetId = id === 'step-resume' ? 'section-resume' :
    id === 'step-r1' ? 'section-round1' :
      id === 'step-r2' ? 'section-round2' : 'section-round3';
      
  // Lock logic
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

async function savePlacementAttempt(round, score, passed) {
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

  doc.setFontSize(22);
  doc.text("Placement Readiness Report", 20, 30);
  doc.setFontSize(14);
  doc.text(`Candidate: ${currentUserName || 'Student'}`, 20, 45);
  doc.text(`Target Role: ${selectedCompanyType}`, 20, 55);

  doc.setDrawColor(0, 150, 105);
  doc.line(20, 60, 190, 60);

  doc.text("Performance Metrics:", 20, 75);
  doc.text(`- Round 1 (Aptitude): ${placementProgress.r1Score}/100`, 30, 85);
  doc.text(`- Round 2 (Technical): Cleared`, 30, 95);
  doc.text(`- Round 3 (Video): Completed`, 30, 105);

  doc.text("Expert Feedback:", 20, 125);
  const feedback = await callAI(`Give a summary placement feedback for a student who scored well in aptitude and cleared technical rounds for a ${selectedCompanyType} role.`);
  const splitFeedback = doc.splitTextToSize(feedback || "Outstanding performance across all rounds.", 160);
  doc.text(splitFeedback, 20, 135);

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
    <div style="display:flex;gap:8px;
      padding:10px 12px;cursor:pointer;
      border-bottom:1px solid #F8FAFC;
      transition:background 150ms;"
      onclick="playVideo('${v.video_id}',
        '${v.title?.replace(/'/g, "\\'")}',
        '${v.channel?.replace(/'/g, "\\'")}',
        '${v.thumbnail}')"
      onmouseover="this.style.background='#F8FAFC'"
      onmouseout="this.style.background='white'">
      <img src="${v.thumbnail}"
        style="width:60px;height:34px;
        border-radius:4px;object-fit:cover;
        flex-shrink:0;">
      <div style="flex:1;overflow:hidden;">
        <div style="font-size:12px;
          font-weight:500;color:#0F172A;
          white-space:nowrap;overflow:hidden;
          text-overflow:ellipsis;">
          ${v.title}
        </div>
        <div style="font-size:11px;color:#94A3B8;">
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
      <div style="grid-column:1/-1;text-align:center;padding:40px;color:#94A3B8;">
        No projects yet. Generate your roadmap to get project suggestions!
      </div>
    `;
    return;
  }

  grid.innerHTML = projects.map((proj, i) => {
    const isDone = proj.status === 'completed';
    const pct = proj.progress_pct || 0;
    const diffColor = {
      'Beginner': '#10B981',
      'Intermediate': '#F59E0B',
      'Advanced': '#EF4444'
    }[proj.difficulty] || '#94A3B8';

    return `
      <div style="background:white;border-radius:14px;border:1px solid ${isDone ? '#A7F3D0' : '#E2E8F0'};overflow:hidden;transition:all 200ms;cursor:pointer;"
        onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.08)'"
        onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'"
        onclick="openProjectDetail(${i})">
        <div style="padding:16px;border-bottom:1px solid #F8FAFC;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${diffColor}20;color:${diffColor};font-weight:500;">
                ${proj.difficulty || 'Intermediate'}
              </span>
              ${proj.from_roadmap ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#EDE9FE;color:#7C3AED;font-weight:500;">Roadmap</span>` : ''}
              ${proj.is_custom ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#F0FDF4;color:#059669;font-weight:500;">Custom</span>` : ''}
              ${isDone ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#D1FAE5;color:#059669;font-weight:500;">✓ Done</span>` : ''}
            </div>
            <span style="font-size:13px;font-weight:700;color:#059669;">+${proj.xp_reward || 100} XP</span>
          </div>
          <h4 style="font-size:15px;font-weight:600;color:#0F172A;margin-bottom:6px;line-height:1.3;">${proj.title}</h4>
          <p style="font-size:12px;color:#64748B;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${proj.description || ''}</p>
        </div>
        <div style="padding:10px 16px;display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid #F8FAFC;">
          ${(proj.tech_stack || []).map(t => `<span style="background:#F1F5F9;color:#475569;padding:2px 8px;border-radius:6px;font-size:11px;">${t}</span>`).join('')}
        </div>
        <div style="padding:12px 16px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748B;margin-bottom:6px;">
            <span>Progress</span><span>${pct}%</span>
          </div>
          <div style="height:4px;background:#F1F5F9;border-radius:2px;">
            <div style="height:100%;width:${pct}%;background:#059669;border-radius:2px;transition:width 600ms ease;"></div>
          </div>
          <div style="font-size:11px;color:#94A3B8;margin-top:6px;">~${proj.estimated_hours || 10} hours</div>
        </div>
      </div>
    `;
  }).join('');
}

function filterProjects(filter, btn) {
  ['all', 'active', 'completed', 'custom'].forEach(f => {
    const b = document.getElementById('proj-filter-' + f);
    if (b) {
      b.style.background = f === filter ? '#059669' : '#F1F5F9';
      b.style.color = f === filter ? 'white' : '#64748B';
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
    <div style="padding:24px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
        <div style="flex:1;">
          <h3 style="font-size:18px;font-weight:600;margin-bottom:6px;">${proj.title}</h3>
          <p style="font-size:13px;color:#64748B;line-height:1.5;">${proj.description}</p>
        </div>
        <button onclick="closeProjectDetail()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94A3B8;flex-shrink:0;margin-left:10px;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
        <div style="background:#F8FAFC;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:16px;font-weight:600;color:#059669;">+${proj.xp_reward || 100}</div>
          <div style="font-size:11px;color:#64748B;">XP Reward</div>
        </div>
        <div style="background:#F8FAFC;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:16px;font-weight:600;color:#0F172A;">~${proj.estimated_hours || 10}h</div>
          <div style="font-size:11px;color:#64748B;">Estimated</div>
        </div>
        <div style="background:#F8FAFC;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:16px;font-weight:600;color:#0F172A;">${checkpoints.length}</div>
          <div style="font-size:11px;color:#64748B;">Checkpoints</div>
        </div>
      </div>
      ${checkpoints.length > 0 ? `
        <div style="margin-bottom:20px;">
          <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;">📋 Checkpoints</h4>
          ${checkpoints.map((cp, ci) => `
            <div style="display:flex;gap:10px;align-items:center;padding:10px;background:#F8FAFC;border-radius:8px;margin-bottom:6px;">
              <div style="width:20px;height:20px;border-radius:50%;border:2px solid #E2E8F0;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;"></div>
              <span style="font-size:13px;color:#0F172A;">${cp}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div style="margin-bottom:20px;">
        <label style="font-size:12px;font-weight:500;color:#475569;margin-bottom:4px;display:block;">GitHub Repository URL</label>
        <div style="display:flex;gap:8px;">
          <input id="proj-github-input" value="${proj.github_url || ''}" placeholder="https://github.com/..." style="flex:1;padding:8px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none;">
          <button onclick="saveGithubUrl(${index})" style="padding:8px 14px;background:#0F172A;color:white;border:none;border-radius:8px;font-size:13px;cursor:pointer;">Save</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${proj.status !== 'completed' ? `
          <button onclick="markProjectComplete(${index})" style="padding:12px;background:#059669;color:white;border:none;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;">✅ Mark Complete</button>
        ` : `<div style="padding:12px;background:#D1FAE5;border-radius:10px;font-size:14px;font-weight:500;color:#059669;text-align:center;">✓ Completed!</div>`}
        <button onclick="closeProjectDetail()" style="padding:12px;background:transparent;border:1px solid #E2E8F0;border-radius:10px;font-size:14px;cursor:pointer;">Close</button>
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
  if (mentorHistory.length > 0) return; // Already initialized

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
        background:linear-gradient(
          135deg,#059669,#34D399);
        display:flex;align-items:center;
        justify-content:center;font-size:14px;
        margin-top:4px;">🤖</div>
    ` : ''}
    <div style="
      max-width:70%;padding:12px 16px;
      border-radius:16px;
      border-${isAI ? 'bottom-left' : 'bottom-right'}-radius:4px;
      background:${isAI ? 'white' : '#059669'};
      color:${isAI ? '#0F172A' : 'white'};
      font-size:14px;line-height:1.6;
      border:${isAI ? '1px solid #E2E8F0' : 'none'};
      box-shadow:${isAI ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'};
    ">${formatted}</div>
    ${!isAI ? `
      <div style="width:32px;height:32px;
        border-radius:50%;flex-shrink:0;
        background:#059669;
        display:flex;align-items:center;
        justify-content:center;font-size:14px;
        color:white;font-weight:600;margin-top:4px;">
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

  // Try OpenRouter first if key is present
  if (OPENROUTER_KEY) {
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
          model: 'openrouter/free',
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
          console.log('[sendMentorMessage] Success with OpenRouter');
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("OpenRouter API Error:", res.status, errData);
      }
    } catch (err) {
      console.error("OpenRouter chat error:", err);
    }
  }

  // Fallback to Gemini if OpenRouter failed or key is missing
  if (!success && GEMINI_KEY) {
    try {
      console.log('[sendMentorMessage] Falling back to Gemini API...');
      
      // Convert OpenAI style history to Gemini history
      const contents = mentorHistory.slice(-6).map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }));

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
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
          console.log('[sendMentorMessage] Success with Gemini API');
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        console.error('[sendMentorMessage] Gemini API returned status:', res.status, errBody);
      }
    } catch (err) {
      console.error("Gemini fallback chat error:", err);
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

function sendQuickQuestion(q) {
  const input = document.getElementById('mentor-input');
  if (input) input.value = q;
  sendMentorMessage();
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
window.sendQuickQuestion = sendQuickQuestion;
window.clearMentorChat = clearMentorChat;
window.initMentorChat = initMentorChat;




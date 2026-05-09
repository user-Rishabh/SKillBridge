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
checkOnboarding(); // Fast loading check

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

// ── FIX 2: FAST LOADING (no delay) ───────────────────────────
async function checkOnboarding() {
  const { data: { session } } = 
    await supabase.auth.getSession();
  
  if (!session) {
    window.location.href = 'auth.html';
    return;
  }

  currentUserId = session.user.id;

  const { data: profile, error } = 
    await supabase
      .from('profiles')
      .select('onboarding_completed, full_name, goal, roadmap_data')
      .eq('id', session.user.id)
      .single();

  console.log('Profile check:', profile);
  console.log('Onboarding completed:', 
    profile?.onboarding_completed);

  // STRICT CHECK — only show if explicitly false
  if (profile?.onboarding_completed === true) {
    // Returning user — hide onboarding
    document.getElementById(
      'onboarding-overlay'
    ).style.display = 'none';
    loadDashboard(profile);
  } else {
    // New user — show onboarding
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
  
    // Start conversation immediately
    onboardingData.name = profile?.full_name?.split(' ')[0] || 'there';
    currentUserName = onboardingData.name;
  
    // First message — instant
    addMessage(
        'Hey ' + onboardingData.name + '! 👋 Welcome to SkillBridge AI.' +
        '<br><br>I\'ll build your personalized career roadmap in just 2 minutes.' +
        '<br><br>Ready? Let\'s go! 🚀'
    );
  
    // Second message — minimal delay
    setTimeout(() => {
        addMessage(conversation[0].question(onboardingData));
        showQuickReplies(conversation[0].quickReplies);
    }, 800);
}

function hideOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.style.display = 'none';
}

// ── FIX 3: ENHANCED ONBOARDING UI LOGIC ──────────────────────
function addMessage(text, isUser = false) {
    const chat = document.getElementById('chat-messages');
    if (!chat) return;
    
    const d = document.createElement('div');
    d.style.cssText = `
        padding: 12px 16px;
        border-radius: 16px;
        max-width: 85%;
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 8px;
        align-self: ${isUser ? 'flex-end' : 'flex-start'};
        background: ${isUser ? '#059669' : 'rgba(255,255,255,0.06)'};
        color: ${isUser ? 'white' : '#E2E8F0'};
        ${isUser ? '' : 'border: 1px solid rgba(255,255,255,0.1);'}
        animation: fadeUp 300ms ease-out both;
    `;
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
        btn.style.cssText = `
            background: rgba(5,150,105,0.08);
            border: 1px solid rgba(5,150,105,0.25);
            color: #34D399;
            padding: 7px 14px;
            border-radius: 20px;
            font-size: 12px;
            cursor: pointer;
            transition: all 200ms;
            animation: fadeUp 300ms ease-out;
            animation-delay: ${i * 60}ms;
            animation-fill-mode: both;
            white-space: nowrap;
        `;
        btn.onmouseover = () => {
            btn.style.background = 'rgba(5,150,105,0.2)';
            btn.style.borderColor = 'rgba(5,150,105,0.5)';
            btn.style.transform = 'scale(1.03)';
        };
        btn.onmouseout = () => {
            btn.style.background = 'rgba(5,150,105,0.08)';
            btn.style.borderColor = 'rgba(5,150,105,0.25)';
            btn.style.transform = 'scale(1)';
        };
        btn.onclick = () => {
            document.getElementById('chat-input').value = reply;
            sendChatAnswer();
        };
        area.appendChild(btn);
    });
}

function updateOnboardingProgress() {
    const pct = Math.round((currentStep / conversation.length) * 100);
    const bar = document.getElementById('onboarding-progress');
    if (bar) bar.style.width = pct + '%';
    
    const indicator = document.getElementById('step-indicator');
    if (indicator) {
        indicator.textContent = `Step ${Math.min(currentStep + 1, conversation.length)} of ${conversation.length}`;
    }
}

async function sendChatAnswer() {
    const input = document.getElementById('chat-input');
    const val = input.value.trim();
    if (!val) return;
    
    input.value = '';
    addMessage(val, true);
    
    // Save data
    const currentQ = conversation[currentStep];
    onboardingData[currentQ.key] = val;
    
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
        // Finish
        await finishOnboarding();
    }
}

function showTyping() {
    const chat = document.getElementById('chat-messages');
    const typing = document.createElement('div');
    typing.id = 'typing-indicator';
    typing.style.cssText = 'padding:12px 16px; background:rgba(255,255,255,0.06); border-radius:16px; width:fit-content; margin-bottom:8px; display:flex; gap:4px;';
    typing.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    chat.appendChild(typing);
    chat.scrollTop = chat.scrollHeight;
}

function hideTyping() {
    document.getElementById('typing-indicator')?.remove();
}

async function finishOnboarding() {
    // Save to Supabase
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

// ── FIX 1: OPENROUTER API & ROADMAP GEN ─────────────────────
async function callAI(prompt, maxTokens = 800) {
    try {
        const res = await fetch(
            'https://openrouter.ai/api/v1/chat/completions',
            {
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
                    max_tokens: maxTokens,
                    temperature: 0.7
                })
            }
        );

        if (!res.ok) {
            const err = await res.json();
            console.error('OpenRouter error:', err);
            return null;
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || null;

    } catch (e) {
        console.error('AI call failed:', e);
        return null;
    }
}

async function generateRoadmapWithAI() {
    const prompt = `
You are a career roadmap expert for Indian students.
Generate a detailed learning roadmap for:
- Goal: ${onboardingData.goal}
- Current Level: ${onboardingData.currentLevel}
- Known Skills: ${onboardingData.skills}
- Daily Time: ${onboardingData.timeline}

Return ONLY valid JSON, no extra text:
{
  "title": "string",
  "totalWeeks": number,
  "jobReadinessTarget": "X months",
  "phases": [
    {
      "phase": "Phase Name",
      "weeks": "Week 1-4",
      "skills": ["skill1","skill2","skill3"],
      "project": "project idea",
      "tasks": [
        {
          "title": "task title",
          "difficulty": "Easy/Medium/Hard",
          "resource": "https://..."
        }
      ],
      "status": "current"
    }
  ]
}
Use exactly 4 phases. Status of first = "current",
rest = "locked". Be specific for Indian job market.
  `;

    addMessage(
        '🧠 Analyzing your profile...<br>' +
        'Building your personalized roadmap...<br>' +
        'This takes 10-15 seconds ⏳'
    );
    showTyping();

    const result = await callAI(prompt, 1000);

    hideTyping();

    if (!result) {
        console.log('Using fallback roadmap');
        const fallback = getSmartFallback(onboardingData.goal);
        await saveAndShowRoadmap(fallback);
        return;
    }

    try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON');
        const roadmap = JSON.parse(jsonMatch[0]);
        await saveAndShowRoadmap(roadmap);
    } catch (e) {
        console.log('JSON parse failed, using fallback');
        await saveAndShowRoadmap(getSmartFallback(onboardingData.goal));
    }
}

async function saveAndShowRoadmap(roadmap) {
  const { data: { session } } = 
    await supabase.auth.getSession();
  
  if (!session) return;

  // THIS IS THE CRITICAL FIX
  // Must update onboarding_completed = true
  const { error } = await supabase
    .from('profiles')
    .update({
      goal: onboardingData.goal,
      current_level: onboardingData.currentLevel,
      timeline: onboardingData.timeline,
      roadmap_data: roadmap,
      onboarding_completed: true  // ← THIS MUST BE TRUE
    })
    .eq('id', session.user.id);

  if (error) {
    console.error('Save error:', error);
  } else {
    console.log('Onboarding saved successfully');
  }

  // Standardize the roadmap structure for the UI if needed
  // (Assuming renderDashboard uses roadmap_data now or we adapt it)
  
  // Save Tasks (Preserved logic adapted to roadmap structure)
  const allTasks = [];
  if (roadmap.phases) {
    roadmap.phases.forEach(phase => {
        if (phase.tasks) {
            phase.tasks.forEach(t => {
                allTasks.push({
                    user_id: currentUserId,
                    title: t.title,
                    difficulty: t.difficulty,
                    roadmap_phase: phase.phase,
                    status: 'pending',
                    deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                    resource_link: t.resource || 'https://www.google.com/search?q=' + encodeURIComponent(t.title)
                });
            });
        }
    });
  }
  
  await supabase.from('tasks').delete().eq('user_id', currentUserId);
  if (allTasks.length > 0) await supabase.from('tasks').insert(allTasks);

  // Save Projects
  if (roadmap.phases) {
    const projects = roadmap.phases.map(p => ({
        user_id: currentUserId,
        name: p.project || 'Phase Project',
        description: `Final project for ${p.phase}`,
        status: 'Upcoming',
        progress: 0,
        roadmap_phase: p.phase,
        tags: p.skills
    }));
    await supabase.from('projects').delete().eq('user_id', currentUserId);
    await supabase.from('projects').insert(projects);
  }

  // Close overlay
  const overlay = document.getElementById(
    'onboarding-overlay'
  );
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 500ms';
    setTimeout(() => {
      overlay.style.display = 'none';
      window.location.reload(); // Refresh to show new dashboard state
    }, 500);
  }
}

function getSmartFallback(goal) {
    const g = (goal || '').toLowerCase();
    
    const roadmaps = {
      frontend: {
        title: "Frontend Developer Roadmap",
        totalWeeks: 16,
        jobReadinessTarget: "4 months",
        phases: [
          {
            phase: "Web Foundations",
            weeks: "Week 1-4",
            skills: ["HTML5","CSS3","Git","VS Code"],
            project: "Personal Portfolio Website",
            status: "current",
            tasks: [
              {title:"Learn HTML structure & semantic tags",difficulty:"Easy",resource:"https://www.w3schools.com/html/"},
              {title:"Master CSS Flexbox & Grid",difficulty:"Easy",resource:"https://flexboxfroggy.com/"},
              {title:"Build responsive navbar",difficulty:"Medium",resource:"https://css-tricks.com/"},
              {title:"Setup Git & GitHub account",difficulty:"Easy",resource:"https://docs.github.com/"},
              {title:"Build & deploy portfolio page",difficulty:"Medium",resource:"https://pages.github.com/"}
            ]
          },
          {
            phase: "JavaScript Core",
            weeks: "Week 5-9",
            skills: ["JavaScript ES6+","DOM","APIs","LocalStorage"],
            project: "Weather App with OpenWeather API",
            status: "locked",
            tasks: [
              {title:"JS variables, functions, arrays",difficulty:"Easy",resource:"https://javascript.info/"},
              {title:"DOM manipulation",difficulty:"Medium",resource:"https://developer.mozilla.org/"},
              {title:"Fetch API & Promises",difficulty:"Medium",resource:"https://javascript.info/fetch"},
              {title:"Build weather app",difficulty:"Hard",resource:"https://openweathermap.org/api"},
              {title:"ES6 features deep dive",difficulty:"Medium",resource:"https://es6.io/"}
            ]
          },
          {
            phase: "React Framework",
            weeks: "Week 10-13",
            skills: ["React","Hooks","React Router","State Mgmt"],
            project: "Full CRUD Todo App",
            status: "locked",
            tasks: [
              {title:"React components & JSX",difficulty:"Medium",resource:"https://react.dev/"},
              {title:"useState & useEffect hooks",difficulty:"Medium",resource:"https://react.dev/learn/hooks-overview"},
              {title:"React Router navigation",difficulty:"Medium",resource:"https://reactrouter.com/"},
              {title:"Build Todo CRUD app",difficulty:"Hard",resource:"https://react.dev/learn/tutorial-tic-tac-toe"},
              {title:"Deploy on Vercel",difficulty:"Easy",resource:"https://vercel.com/"}
            ]
          },
          {
            phase: "Job Ready",
            weeks: "Week 14-16",
            skills: ["TypeScript","Testing","System Design","DSA"],
            project: "SaaS Landing Page Clone",
            status: "locked",
            tasks: [
              {title:"TypeScript basics",difficulty:"Medium",resource:"https://www.typescriptlang.org/docs/"},
              {title:"DSA: Arrays & Strings",difficulty:"Hard",resource:"https://leetcode.com/"},
              {title:"Mock interviews practice",difficulty:"Hard",resource:"https://www.pramp.com/"},
              {title:"Build SaaS clone project",difficulty:"Hard",resource:"https://github.com/"},
              {title:"Update resume & LinkedIn",difficulty:"Easy",resource:"https://linkedin.com/"}
            ]
          }
        ]
      },
      
      backend: {
        title: "Backend Developer Roadmap",
        totalWeeks: 18,
        jobReadinessTarget: "4.5 months",
        phases: [
          {
            phase: "Programming Fundamentals",
            weeks: "Week 1-4",
            skills: ["Python/Node.js","OOPs","Git","CLI"],
            project: "CLI Task Manager",
            status: "current",
            tasks: [
              {title:"Python/Node basics",difficulty:"Easy",resource:"https://docs.python.org/"},
              {title:"OOP concepts",difficulty:"Medium",resource:"https://realpython.com/"},
              {title:"Git version control",difficulty:"Easy",resource:"https://git-scm.com/"},
              {title:"Build CLI app",difficulty:"Medium",resource:"https://docs.python.org/3/library/argparse.html"},
              {title:"Linux basic commands",difficulty:"Easy",resource:"https://linuxcommand.org/"}
            ]
          },
          {
            phase: "APIs & Databases",
            weeks: "Week 5-10",
            skills: ["REST APIs","SQL","PostgreSQL","Authentication"],
            project: "REST API with Auth",
            status: "locked",
            tasks: [
              {title:"HTTP methods & REST concepts",difficulty:"Easy",resource:"https://restfulapi.net/"},
              {title:"SQL queries & joins",difficulty:"Medium",resource:"https://sqlzoo.net/"},
              {title:"Build Express/FastAPI server",difficulty:"Medium",resource:"https://expressjs.com/"},
              {title:"JWT authentication",difficulty:"Hard",resource:"https://jwt.io/"},
              {title:"Database design & ORMs",difficulty:"Hard",resource:"https://www.prisma.io/"}
            ]
          },
          {
            phase: "Advanced Backend",
            weeks: "Week 11-15",
            skills: ["Redis","Docker","Microservices","Testing"],
            project: "E-commerce Backend API",
            status: "locked",
            tasks: [
              {title:"Docker containerization",difficulty:"Medium",resource:"https://docs.docker.com/"},
              {title:"Redis caching",difficulty:"Medium",resource:"https://redis.io/docs/"},
              {title:"API testing with Jest",difficulty:"Medium",resource:"https://jestjs.io/"},
              {title:"Build e-commerce API",difficulty:"Hard",resource:"https://github.com/"},
              {title:"Performance optimization",difficulty:"Hard",resource:"https://nodejs.org/en/docs/"}
            ]
          },
          {
            phase: "Job Ready",
            weeks: "Week 16-18",
            skills: ["System Design","DSA","Cloud","Interview Prep"],
            project: "Scalable Chat Application",
            status: "locked",
            tasks: [
              {title:"System design basics",difficulty:"Hard",resource:"https://github.com/donnemartin/system-design-primer"},
              {title:"DSA practice on LeetCode",difficulty:"Hard",resource:"https://leetcode.com/"},
              {title:"AWS/GCP basics",difficulty:"Medium",resource:"https://aws.amazon.com/free/"},
              {title:"Build chat application",difficulty:"Hard",resource:"https://socket.io/"},
              {title:"Mock interview practice",difficulty:"Hard",resource:"https://www.interviewbit.com/"}
            ]
          }
        ]
      }
    };
  
    if (g.includes('front') || g.includes('react') || g.includes('ui') || g.includes('web design')) return roadmaps.frontend;
    if (g.includes('back') || g.includes('node') || g.includes('python') || g.includes('server')) return roadmaps.backend;
    
    return { ...roadmaps.frontend, title: goal + " Developer Roadmap" };
}

// ── Dashboard Loading ────────────────────────────────────────
async function loadDashboard(profile) {
    currentUserName = profile.full_name || 'Student';
    updateProfileUI(profile, '');
    loadDashboardStats();
    renderDashboard();
    
    // Preserved: Record today login, build heatmap
    recordTodayLogin(currentUserId);
    updateStreakDisplay(currentUserId);
    buildActivityHeatmap(currentUserId);
}

function updateProfileUI(p, email) {
    const name = p.full_name || email.split('@')[0];
    setText('user-display-name', name);
    setText('greeting-name', name.split(' ')[0]);
    setText('profile-initials', name.substring(0, 1).toUpperCase());
    setText('profile-name', name);
    setText('profile-goal', p.goal || 'Set your goal');
    setText('profile-college', (p.college_name || '') + (p.branch ? ' · ' + p.branch : ''));
    const avatar = document.getElementById('profile-avatar');
    if (avatar) avatar.textContent = name.substring(0, 1).toUpperCase();
    setVal('edit-name', p.full_name || '');
    setVal('edit-college-name', p.college_name || '');
    setVal('edit-branch', p.branch || 'Computer Science');
    setVal('edit-dreamjob', p.dream_job || '');
}

// ── Other Functions (Preserved from previous implementation) ──
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
    const statsMap = {
        '[data-stat="progress"]': progress + '%',
        '[data-stat="projects"]': completedProjects,
        '[data-stat="skills"]': completedTasks,
        '[data-stat="readiness"]': readiness + '%'
    };
    Object.entries(statsMap).forEach(([selector, value]) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = value;
    });
    setText('stat-progress', progress + '%');
    setText('stat-projects', completedProjects);
    setText('stat-skills', completedTasks);
    setText('stat-placement', readiness + '%');
    const pb = document.getElementById('roadmap-progress-bar');
    if (pb) pb.style.width = progress + '%';
}

async function renderDashboard() {
    if (!supabase || !currentUserId) return;
    const { data: profile } = await supabase.from('profiles').select('roadmap_json, roadmap_data').eq('id', currentUserId).single();
    
    const r = profile?.roadmap_data || profile?.roadmap_json;
    if (!r) return;

    setText('roadmap-focus-text', r.focus || (r.jobReadinessTarget ? `Target: Job Ready in ${r.jobReadinessTarget}` : 'Your roadmap is ready.'));
    
    ['roadmap-nodes-dashboard', 'roadmap-nodes-tab'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = (r.phases || []).map(p => {
                const name = p.phase || p.name || 'Phase';
                const status = p.status || 'locked';
                return `<div class="node ${status}"><span class="node-label">${name}</span></div>`;
            }).join('');
        }
    });
    const activeCont = document.getElementById('active-projects-container');
    if (activeCont) {
        const { data: projs } = await supabase.from('projects').select('*').eq('user_id', currentUserId);
        if (projs?.length > 0) {
            activeCont.innerHTML = projs.map(p => `
                <div class="project-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h4 style="font-size:14px; font-weight:700;">${p.name}</h4>
                        <span class="status-badge ${p.status === 'Completed' ? '' : 'in-progress'}">${p.status}</span>
                    </div>
                    <div class="tag-list" style="margin-bottom:12px;">
                        ${(p.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748B; margin-bottom:4px;">
                        <span>Progress</span><span>${p.progress}%</span>
                    </div>
                    <div class="progress-bg" style="height:6px; background:#F1F5F9; border-radius:10px; overflow:hidden;">
                        <div style="width:${p.progress}%; height:100%; background:#059669;"></div>
                    </div>
                </div>
            `).join('');
        }
    }
    if (window.lucide) window.lucide.createIcons();
}

// Preserve existing Activity Tracking and Theme logic...
async function recordTodayLogin(userId) {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('user_activity').upsert({ user_id: userId, activity_date: today }, { onConflict: 'user_id,activity_date' });
}
async function updateStreakDisplay(userId) {
    const streak = await calculateStreak(userId);
    const navStreak = document.getElementById('streak-badge');
    if (navStreak) navStreak.innerHTML = '🔥 ' + streak + ' Day Streak';
}
async function calculateStreak(userId) {
    const { data } = await supabase.from('user_activity').select('activity_date').eq('user_id', userId).order('activity_date', { ascending: false });
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
    const heatmapEl = document.getElementById('activity-heatmap');
    if (!heatmapEl) return;
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
    const fromDate = twelveWeeksAgo.toISOString().split('T')[0];
    const { data } = await supabase.from('user_activity').select('activity_date').eq('user_id', userId).gte('activity_date', fromDate);
    const activeDates = new Set((data || []).map(d => d.activity_date));
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
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    themeToggle.onclick = () => {
        const cur = document.documentElement.getAttribute('data-theme');
        const target = cur === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', target);
        localStorage.setItem('theme', target);
    };
}
function initInteractions() {
    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });
}
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
            t.className = `nav-item ${isActive ? 'active' : ''}`;
        });
        localStorage.setItem('activeTab', tabName);
        // Hook specific tab loads
        if (tabName === 'resources') searchYouTube('');
        if (tabName === 'tasks') loadTasks();
        if (tabName === 'portfolio') loadPortfolio();
        if (tabName === 'profile') loadProfile();
    }
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => { e.preventDefault(); switchTab(tab.dataset.tab); });
    });
    const savedTab = localStorage.getItem('activeTab') || 'dashboard';
    switchTab(savedTab);
}

// Resource search logic
async function searchYouTube(query) {
    if (!query) {
        const { data } = await supabase.from('profiles').select('goal').eq('id', currentUserId).single();
        query = (data?.goal || 'Programming') + ' tutorial for beginners';
    }
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=6&relevanceLanguage=en&key=${YOUTUBE_API_KEY}`);
    const data = await res.json();
    const container = document.getElementById('youtube-results');
    if (container && data.items) {
        container.innerHTML = data.items.map(item => `<div style="border:0.5px solid var(--color-border); border-radius:12px; overflow:hidden; cursor:pointer; background:white;" onclick="window.open('https://youtube.com/watch?v=${item.id.videoId}', '_blank')"><img src="${item.snippet.thumbnails.medium.url}" style="width:100%; aspect-ratio:16/9; object-fit:cover;"><div style="padding:12px;"><div style="font-weight:600; font-size:13px; margin-bottom:6px; color:#0F172A;">${item.snippet.title.substring(0, 60)}...</div><div style="font-size:11px; color:#64748B;">${item.snippet.channelTitle}</div></div></div>`).join('');
    }
}

// Tasks logic
async function loadTasks() {
    const { data } = await supabase.from('tasks').select('*').eq('user_id', currentUserId).order('deadline', { ascending: true });
    const container = document.getElementById('tasks-container');
    if (container) {
        container.innerHTML = (data || []).filter(t => t.status !== 'completed').map(t => {
            const color = t.difficulty === 'Easy' ? '#10B981' : t.difficulty === 'Medium' ? '#F59E0B' : '#EF4444';
            return `<div id="task-${t.id}" style="border-left:4px solid ${color}; padding:16px; border-radius:10px; background:white; border:1px solid #E2E8F0; border-left-width:4px;"><div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;"><strong style="font-size:14px; color:#0F172A;">${t.title}</strong><span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:12px; background:${color}20; color:${color}; border:1px solid ${color}40;">${t.difficulty}</span></div><div style="font-size:12px; color:#64748B; margin-bottom:12px;">📍 Phase: ${t.roadmap_phase}</div><div style="display:flex; gap:10px;"><a href="${t.resource_link}" target="_blank" style="font-size:12px; color:#059669; text-decoration:none; font-weight:600; display:flex; align-items:center; gap:4px;">📚 Resource</a><button onclick="completeTask('${t.id}')" style="background:#059669; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">✓ Complete</button></div></div>`;
        }).join('') || '<p>No tasks pending.</p>';
    }
}

async function completeTask(taskId) {
    await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId);
    loadDashboardStats();
    document.getElementById('task-' + taskId)?.remove();
}

// Profile & Portfolio logic (Preserved)
async function loadProfile() {
    const [profile, tasks, projects, certs] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', currentUserId).single(),
        supabase.from('tasks').select('status').eq('user_id', currentUserId),
        supabase.from('projects').select('status').eq('user_id', currentUserId),
        supabase.from('certificates').select('*').eq('user_id', currentUserId)
    ]);
    if (profile.data) updateProfileUI(profile.data, '');
    setText('p-tasks', tasks.data?.filter(t => t.status === 'completed').length || 0);
    setText('p-projects', projects.data?.filter(p => p.status === 'completed').length || 0);
    setText('p-certs', certs.data?.length || 0);
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

// Animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(52, 211, 153, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
    }
    .dot {
        width: 6px; height: 6px; background: #94A3B8; border-radius: 50%;
        animation: typing 1s infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
    }
`;
document.head.appendChild(style);

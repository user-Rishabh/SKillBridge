// Roadmap Data Templates
const roadmapTemplates = {
    frontend: [
        { id: 1, title: 'HTML/CSS Mastery', x: 50, y: 50, status: 'completed' },
        { id: 2, title: 'JavaScript Fundamentals', x: 200, y: 50, status: 'completed' },
        { id: 3, title: 'React Basics', x: 350, y: 50, status: 'active' },
        { id: 4, title: 'State Management', x: 350, y: 200, status: 'locked' },
        { id: 5, title: 'Next.js & SSR', x: 500, y: 200, status: 'locked' },
        { id: 6, title: 'Professional Portfolio', x: 500, y: 350, status: 'locked' }
    ],
    backend: [
        { id: 1, title: 'Node.js Overview', x: 50, y: 50, status: 'completed' },
        { id: 2, title: 'Express & Middleware', x: 200, y: 50, status: 'active' },
        { id: 3, title: 'MongoDB & SQL', x: 200, y: 200, status: 'locked' },
        { id: 4, title: 'Authentication', x: 350, y: 200, status: 'locked' },
        { id: 5, title: 'Microservices', x: 500, y: 200, status: 'locked' }
    ],
    fullstack: [
        { id: 1, title: 'Web App Basics', x: 50, y: 50, status: 'completed' },
        { id: 2, title: 'Frontend Stack', x: 200, y: 50, status: 'active' },
        { id: 3, title: 'Backend Fundamentals', x: 350, y: 50, status: 'locked' },
        { id: 4, title: 'Deployment & CI/CD', x: 350, y: 200, status: 'locked' }
    ],
    ai: [
        { id: 1, title: 'Python Basics', x: 50, y: 50, status: 'completed' },
        { id: 2, title: 'Mathematics for ML', x: 200, y: 50, status: 'active' },
        { id: 3, title: 'Supervised Learning', x: 350, y: 50, status: 'locked' },
        { id: 4, title: 'Neural Networks', x: 350, y: 200, status: 'locked' },
        { id: 5, title: 'Generative AI', x: 500, y: 200, status: 'locked' }
    ]
};

// Project Market Data
const projectsData = [
    { title: 'AI Resume Parser', desc: 'Build an LLM-powered resume analyzer using Python.', tags: ['Python', 'AI'], categoryId: 'ai', img: 'https://www.svgrepo.com/show/475656/google-color.svg' },
    { title: 'Crypto Wallet Tracker', desc: 'Real-time dashboard for Ethereum wallets.', tags: ['React', 'Web3'], categoryId: 'frontend', img: 'https://www.svgrepo.com/show/475656/google-color.svg' },
    { title: 'E-commerce API', desc: 'Secure backend with JWT and Stripe integration.', tags: ['Node', 'Stripe'], categoryId: 'backend', img: 'https://www.svgrepo.com/show/443315/brand-zomato.svg' },
    { title: 'Multiplayer Kanban', desc: 'Real-time project management tool.', tags: ['Firebase', 'React'], categoryId: 'fullstack', img: 'https://www.svgrepo.com/show/443315/brand-zomato.svg' },
    { title: 'Weather Agent', desc: 'Voice controlled weather assistant.', tags: ['Python', 'NLP'], categoryId: 'ai', img: 'https://www.svgrepo.com/show/475656/google-color.svg' }
];

// Elements
const roadmapNodesContainer = document.getElementById('roadmap-nodes');
const roadmapSvg = document.getElementById('roadmap-svg');
const roadmapModal = document.getElementById('roadmap-modal');
const openRoadmapModalBtn = document.getElementById('open-roadmap-modal');
const closeRoadmapModalBtn = document.getElementById('close-roadmap-modal');
const generateConfirmBtn = document.getElementById('generate-confirm');
const loaderOverlay = document.getElementById('ai-loader');
const loaderText = document.getElementById('loader-text');
const projectsGrid = document.getElementById('projects-grid');
const projectSearch = document.getElementById('project-search');

// Modal Logic
if (openRoadmapModalBtn) {
    openRoadmapModalBtn.onclick = () => roadmapModal.classList.remove('hidden');
}
if (closeRoadmapModalBtn) {
    closeRoadmapModalBtn.onclick = () => roadmapModal.classList.add('hidden');
}

// Generate Roadmap
if (generateConfirmBtn) {
    generateConfirmBtn.onclick = () => {
        const role = document.getElementById('target-role').value;
        roadmapModal.classList.add('hidden');
        loaderOverlay.classList.remove('hidden');

        const steps = [
            'Analyzing industry demand...',
            'Evaluating skill gaps...',
            'Tailoring project milestones...',
            'Optimizing learning curve...',
            'Path finalized!'
        ];

        let step = 0;
        const interval = setInterval(() => {
            if (step < steps.length) {
                loaderText.textContent = steps[step];
                step++;
            } else {
                clearInterval(interval);
                setTimeout(() => {
                    loaderOverlay.classList.add('hidden');
                    renderRoadmap(role);
                }, 800);
            }
        }, 1200);
    };
}

function renderRoadmap(role) {
    const data = roadmapTemplates[role] || roadmapTemplates.frontend;
    roadmapNodesContainer.innerHTML = '';
    roadmapSvg.innerHTML = '';

    data.forEach((node, index) => {
        // Create Node
        const el = document.createElement('div');
        el.className = `node ${node.status} cursor-pointer hover:scale-110 transition-transform`;
        el.style.top = `${node.y}px`;
        el.style.left = `${node.x}px`;
        el.textContent = node.title;
        el.onclick = () => {
            if (node.status === 'active') {
                node.status = 'completed';
                if (data[index + 1]) data[index + 1].status = 'active';
                renderRoadmap(role);
            }
        };
        roadmapNodesContainer.appendChild(el);

        // Create Line to next node
        if (index < data.length - 1) {
            const next = data[index + 1];
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', node.x + 60);
            line.setAttribute('y1', node.y + 20);
            line.setAttribute('x2', next.x + 60);
            line.setAttribute('y2', next.y + 20);
            line.setAttribute('stroke', 'white');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('stroke-dasharray', '5,5');
            line.setAttribute('opacity', node.status === 'completed' ? '0.8' : '0.2');
            roadmapSvg.appendChild(line);
        }
    });

    // Refresh icons if any
    if (window.lucide) lucide.createIcons();
}

// Projects Logic
function renderProjects(filter = '') {
    if (!projectsGrid) return;
    const filtered = projectsData.filter(p => 
        p.title.toLowerCase().includes(filter.toLowerCase()) || 
        p.desc.toLowerCase().includes(filter.toLowerCase()) ||
        p.tags.some(t => t.toLowerCase().includes(filter.toLowerCase()))
    );

    projectsGrid.innerHTML = filtered.map(p => `
        <div class="glass p-6 rounded-2xl hover-lift shadow-lg">
            <div class="flex justify-between mb-4">
                <img src="${p.img}" class="w-8 h-8" alt="P">
                <span class="px-2 py-1 bg-primary/20 text-primary text-[10px] font-bold rounded">PROJECT</span>
            </div>
            <h4 class="font-bold mb-2">${p.title}</h4>
            <p class="text-xs text-text-muted mb-4 line-clamp-2">${p.desc}</p>
            <div class="flex flex-wrap gap-2 mb-6">
                ${p.tags.map(t => `<span class="px-2 py-0.5 bg-surface-2 rounded text-[10px]">${t}</span>`).join('')}
            </div>
            <button class="btn btn-primary w-full text-xs py-2">Get Started</button>
        </div>
    `).join('');
}

if (projectSearch) {
    projectSearch.oninput = (e) => renderProjects(e.target.value);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderProjects();
    
    // Time range display
    const timeRange = document.getElementById('time-range');
    const timeVal = document.getElementById('time-val');
    if (timeRange && timeVal) {
        timeRange.oninput = (e) => {
            timeVal.textContent = `${e.target.value} Hours`;
        };
    }

    // Skill level buttons
    const skillBtns = document.querySelectorAll('.skill-level-btn');
    skillBtns.forEach(btn => {
        btn.onclick = () => {
            skillBtns.forEach(b => b.classList.remove('active', 'bg-primary', 'text-white'));
            btn.classList.add('active', 'bg-primary', 'text-white');
        };
    });
    
    // Download logic
    const downloadBtn = document.getElementById('download-roadmap');
    if (downloadBtn) {
        downloadBtn.onclick = () => window.print();
    }
});

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

// Supabase Initialization & Auth
initSupabase();
initAuth();

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

/**
 * Check if user is logged in and load profile data
 */
async function initAuth() {
    if (!supabase) return;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.log("No session found, redirecting to auth...");
            window.location.href = '/auth.html';
            return;
        }
        
        const user = session.user;
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profile) {
            const name = profile.full_name || user.email.split('@')[0];
            const displayNameElem = document.getElementById('user-display-name');
            const greetingNameElem = document.getElementById('greeting-name');
            const profileInitialsElem = document.getElementById('profile-initials');

            if (displayNameElem) displayNameElem.textContent = name;
            if (greetingNameElem) greetingNameElem.textContent = name.split(' ')[0];
            if (profileInitialsElem) profileInitialsElem.textContent = name.substring(0, 1).toUpperCase();
        }
    } catch (err) {
        console.error("Auth initialization error:", err);
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

    // Heatmap Generation
    const heatmap = document.getElementById('heatmap-grid');
    if (heatmap) {
        for (let i = 0; i < 70; i++) {
            const cell = document.createElement('div');
            cell.className = 'heat-cell';
            const level = Math.floor(Math.random() * 5);
            if (level > 0) cell.classList.add(`level-${level}`);
            heatmap.appendChild(cell);
        }
    }
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

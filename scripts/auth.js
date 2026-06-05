/**
 * SKILLBRIDGE — AUTHENTICATION LOGIC
 * Handles Sign In, Sign Up, and OAuth with Supabase
 */

console.log("🚀 Auth script loading...");

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

// Initialize Supabase Client
let supabaseAuth;
try {
    // Standard CDN version often puts it in 'supabase' or 'supabasejs'
    const lib = window.supabase || window.supabasejs;
    if (typeof lib !== 'undefined') {
        supabaseAuth = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabaseClient = supabaseAuth;
        console.log("✅ Supabase client initialized");
    } else {
        console.error("❌ Supabase library not found! Check your CDN script in auth.html.");
        alert("Authentication system failed to load. Please contact support.");
    }
} catch (err) {
    console.error("❌ Error initializing Supabase:", err);
}

// ── UTILITIES ──────────────────────────────────────────────
function showMsg(form, type, text) {
    console.log(`[AuthMsg] ${type}: ${text}`);
    const msgContainer = document.getElementById('auth-message');
    if (!msgContainer) {
        console.warn("Message container #auth-message not found");
        return;
    }

    msgContainer.innerHTML = `<div class="msg ${type}">${text}</div>`;

    if (type === 'error') {
        setTimeout(() => {
            if (msgContainer.innerHTML.includes(text)) {
                msgContainer.innerHTML = '';
            }
        }, 5000);
    }
}

// ── AUTH GUARD ──────────────────────────────────────────────
async function checkSession() {
    if (!supabaseAuth) return;
    try {
        const { data: { session }, error } = await supabaseAuth.auth.getSession();
        if (error) throw error;
        if (session) {
            console.log("👤 User already logged in, redirecting...");
            window.location.href = 'dashboard.html';
        }
    } catch (err) {
        console.error("Session check error:", err);
    }
}
checkSession();

// ── FORM HANDLERS ───────────────────────────────────────────

// Sign In
const signinForm = document.getElementById('form-signin');
if (signinForm) {
    console.log("🔗 Sign-in form listener attached");
    signinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("📥 Sign-in form submitted - Beginning validation");

        const email = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;

        if (!email || !password) {
            showMsg('signin', 'error', '❌ Please fill all fields');
            console.warn("⚠️ Sign-in validation failed: Missing fields");
            return;
        }

        showMsg('signin', 'loading', '⏳ Signing you in...');

        try {
            console.log("🚀 Calling supabaseAuth.auth.signInWithPassword...");
            const { data, error } = await supabaseAuth.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error("❌ Sign-in error:", error);
                showMsg('signin', 'error', '❌ ' + error.message);
            } else {
                console.log("✅ Sign-in success:", data);
                showMsg('signin', 'success', '✅ Welcome back! Redirecting...');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            }
        } catch (err) {
            showMsg('signin', 'error', '❌ Connection error. Try again.');
            console.error("❌ Unexpected sign-in error:", err);
        }
    });
}


// Sign Up
const signupForm = document.getElementById('form-signup');
const signupBtn = document.getElementById('signup-submit');

if (signupBtn) {
    signupBtn.addEventListener('click', () => {
        console.log("🖱️ Create Account button clicked");
    });
}

if (signupForm) {
    console.log("🔗 Sign-up form listener attached");
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("📥 Sign-up form submitted - Beginning validation");

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const college = document.getElementById('college').value.trim();
        const branch = document.getElementById('branch').value;
        const dreamJob = document.getElementById('dreamjob').value.trim();

        console.log("📝 Form data:", { name, email, college, branch, dreamJob });

        if (!name || !email || !password || !college || !branch || branch === "") {
            showMsg('signup', 'error', '❌ Please fill all required fields (including Branch)');
            console.warn("⚠️ Validation failed: Missing fields");
            return;
        }

        if (password.length < 6) {
            showMsg('signup', 'error', '❌ Password must be at least 6 characters');
            return;
        }

        showMsg('signup', 'loading', '⏳ Creating your account...');

        try {
            console.log("🚀 Calling supabaseAuth.auth.signUp...");
            const { data, error } = await supabaseAuth.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                        college_name: college,
                        branch: branch,
                        dream_job: dreamJob
                    },
                    emailRedirectTo: window.location.origin + '/dashboard.html'
                }
            });

            if (error) {
                console.error("❌ Supabase Auth Error:", error);
                showMsg('signup', 'error', '❌ ' + error.message);
            } else {
                console.log("✅ Supabase Auth Success:", data);
                showMsg('signup', 'success', '✅ Account created! Redirecting...');

                // Save profile
                if (data.user) {
                    console.log("📂 Saving profile data...");
                    const serializedGoal = JSON.stringify({
                        goal: dreamJob,
                        college_name: college,
                        branch: branch
                    });
                    supabaseAuth.from('profiles').upsert({
                        id: data.user.id,
                        full_name: name,
                        dream_job: dreamJob,
                        college_name: college,
                        branch: branch
                    }).then(({ error: pError }) => {
                        if (pError) console.warn("⚠️ Profile save warning:", pError);
                        else console.log("✅ Profile saved");
                    });
                }

                setTimeout(() => {
                    console.log("➡️ Redirecting to dashboard...");
                    window.location.href = 'dashboard.html';
                }, 1500);
            }
        } catch (err) {
            showMsg('signup', 'error', '❌ Unexpected error. Check console.');
            console.error("❌ Unexpected Error:", err);
        }
    });
}


// ── OAUTH HANDLERS ──────────────────────────────────────────

async function signInWithGoogle() {
    console.log("🔵 Google Sign-In initiated");
    if (!supabaseAuth) {
        alert("Supabase not loaded");
        return;
    }
    showMsg('signin', 'loading', '⏳ Opening Google...');
    const { error } = await supabaseAuth.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: 'https://s-kill-bridge.vercel.app/dashboard.html'
        }
    });
    if (error) showMsg('signin', 'error', '❌ ' + error.message);
}

async function signInWithGitHub() {
    console.log("⚫ GitHub Sign-In initiated");
    if (!supabaseAuth) {
        alert("Supabase not loaded");
        return;
    }
    showMsg('signin', 'loading', '⏳ Opening GitHub...');
    const { error } = await supabaseAuth.auth.signInWithOAuth({
        provider: 'github',
        options: {
            redirectTo: 'https://s-kill-bridge.vercel.app/dashboard.html'
        }
    });
    if (error) showMsg('signin', 'error', '❌ ' + error.message);
}

// Global exposure
window.signInWithGoogle = signInWithGoogle;
window.signInWithGitHub = signInWithGitHub;

console.log("✅ Auth script ready");
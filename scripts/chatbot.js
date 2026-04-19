const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

const responses = {
    'roadmap': "The AI Roadmap analyzes your branch, college, and target role to generate a personalized learning path. I've optimized it for the current industry trends! Try clicking nodes to mark them complete.",
    'download': "You can download your roadmap as a high-quality PDF by clicking the '📥 PDF' button in the toolbar. It includes all your milestones and progress.",
    'projects': "Our marketplace has real-world projects from companies like Google and Netflix. Successfully completing them boosts your Skill Score by up to 15%!",
    'mentors': "I can help you schedule a session with a mentor. Most students prefer Siddharth V. from Google for React reviews. Would you like to see his availability?",
    'pricing': "SkillBridge Pro (₹299/mo) unlocks priority mentor access, advanced AI pathing, and direct candidate pipelines to 500+ hiring partners.",
    'skills': "Your current Skill Score is 67%. To reach 80% (top tier), I recommend finishing the 'Advanced React' module and the Zomato project.",
    'default': "I'm monitoring your progress. Ask me about your roadmap, projects, or how to boost your placement score!"
};

function addMessage(text, isUser = false) {
    const div = document.createElement('div');
    div.className = isUser 
        ? 'ml-auto bg-primary text-white p-3 rounded-2xl max-w-[85%] shadow-md animate-slide-in-right' 
        : 'bg-white/5 p-3 rounded-2xl border border-white/5 max-w-[85%] shadow-sm animate-slide-in-left';
    div.innerHTML = text; // Use innerHTML for formatting if needed
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addTypingIndicator() {
    const div = document.createElement('div');
    div.id = 'typing-indicator';
    div.className = 'bg-white/5 p-3 rounded-xl border border-white/5 w-16 flex gap-1 items-center justify-center';
    div.innerHTML = `
        <span class="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce"></span>
        <span class="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:0.2s]"></span>
        <span class="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:0.4s]"></span>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}

function handleSend() {
    const text = chatInput.value.trim().toLowerCase();
    if (!text) return;

    addMessage(chatInput.value, true);
    chatInput.value = '';

    const typing = addTypingIndicator();

    setTimeout(() => {
        typing.remove();
        let response = responses.default;
        
        if (text.includes('roadmap') || text.includes('path')) response = responses.roadmap;
        else if (text.includes('download') || text.includes('pdf')) response = responses.download;
        else if (text.includes('project')) response = responses.projects;
        else if (text.includes('mentor')) response = responses.mentors;
        else if (text.includes('price') || text.includes('cost') || text.includes('₹')) response = responses.pricing;
        else if (text.includes('skill') || text.includes('score')) response = responses.skills;

        addMessage(response);
    }, 1200);
}

if (sendBtn) sendBtn.onclick = handleSend;
if (chatInput) {
    chatInput.onkeypress = (e) => {
        if (e.key === 'Enter') handleSend();
    };
}

const messages = [
    { text: '$ skillbridge diagnose --user="student_01"', type: 'cmd' },
    { text: '>> INITIALIZING AI CORE...', type: 'info' },
    { text: '>> ANALYZING 12,402 CAREER PATHS...', type: 'info' },
    { text: '>> DETECTING SKILL CLUSTERS...', type: 'info' },
    { text: '>> GENERATING OPTIMAL ROADMAP...', type: 'success' },
    { text: '>> PATH READY: FULL STACK ARCHITECT ✓', type: 'success' }
];

const container = document.getElementById('terminal-content');
let currentMsgIndex = 0;
let currentCharIndex = 0;

function typeWriter() {
    if (!container) return;
    
    if (currentMsgIndex < messages.length) {
        const msg = messages[currentMsgIndex];
        const line = document.createElement('div');
        line.className = 'mb-2 min-h-[20px]';
        
        if (msg.type === 'cmd') line.className += ' text-brand font-bold';
        if (msg.type === 'success') line.className += ' text-green-400';
        if (msg.type === 'info') line.className += ' text-white/40';
        
        container.appendChild(line);

        let currentText = '';
        const interval = setInterval(() => {
            if (currentCharIndex < msg.text.length) {
                currentText += msg.text[currentCharIndex];
                line.innerHTML = currentText + '<span class="w-2 h-4 bg-brand inline-block ml-1 animate-pulse align-middle"></span>';
                currentCharIndex++;
            } else {
                clearInterval(interval);
                line.innerHTML = msg.text; 
                currentMsgIndex++;
                currentCharIndex = 0;
                setTimeout(typeWriter, 400);
            }
        }, 20);
    } else {
        setTimeout(() => {
            container.innerHTML = '';
            currentMsgIndex = 0;
            currentCharIndex = 0;
            typeWriter();
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', typeWriter);

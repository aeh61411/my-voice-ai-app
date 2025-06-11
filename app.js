// File: app.js (fully corrected version)

document.addEventListener('DOMContentLoaded', () => {

    const SUPABASE_URL = 'https://dmwnttcisinyuprdizvh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtd250dGNpc2lueXVwcmRpenZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MDQxOTMsImV4cCI6MjA2NTE4MDE5M30.4X4cuJhCR8A6ep6-SHT3dUZxRtKu6C_sGJku1ooN2aM';
    // CRITICAL FIX: The GEMINI_API_KEY has been REMOVED from here.

    const { createClient } = supabase;
    const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const synthesis = window.speechSynthesis;
    let currentUser = null;

    const el = {
        loginSection: document.getElementById('login-section'), mainAppSection: document.getElementById('main-app-section'),
        googleLoginBtn: document.getElementById('google-login-btn'), logoutBtn: document.getElementById('logout-btn'),
        userInfo: document.getElementById('user-info'), headerAvatar: document.getElementById('header-avatar'),
        notificationArea: document.getElementById('notification-area'),
        tabButtons: document.querySelectorAll('.tab-btn'), tabPanels: document.querySelectorAll('.tab-panel'),
        startBtn: document.getElementById('start-btn'), noteTextarea: document.getElementById('note-textarea'),
        brainstormBtn: document.getElementById('brainstorm-btn'), brainstormInput: document.getElementById('brainstorm-input'), aiResponseDiv: document.getElementById('ai-response'),
        startChatBtn: document.getElementById('start-chat-btn'), chatHistoryDiv: document.getElementById('chat-history'), chatStatus: document.getElementById('chat-status'), voiceSelect: document.getElementById('voice-select'),
        usernameInput: document.getElementById('username-input'), avatarUploadInput: document.getElementById('avatar-upload-input'),
        uploadAvatarBtn: document.getElementById('upload-avatar-btn'), saveProfileBtn: document.getElementById('save-profile-btn'),
        profileAvatarPreview: document.getElementById('profile-avatar-preview')
    };

    function showNotification(message, type = 'success') {
        el.notificationArea.textContent = message;
        el.notificationArea.className = `notification ${type} show`;
        setTimeout(() => el.notificationArea.classList.remove('show'), 4000);
    }
    function showTab(targetPanelId) {
        el.tabPanels.forEach(panel => panel.classList.remove('active-panel'));
        el.tabButtons.forEach(btn => btn.classList.remove('active'));
        const panelToShow = document.getElementById(targetPanelId);
        const btnToActivate = document.querySelector(`.tab-btn[data-target="${targetPanelId}"]`);
        if (panelToShow) panelToShow.classList.add('active-panel');
        if (btnToActivate) btnToActivate.classList.add('active');
    }

    el.tabButtons.forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.target)));
    el.googleLoginBtn.addEventListener('click', () => _supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } }));
    el.logoutBtn.addEventListener('click', () => _supabase.auth.signOut());

    _supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
            el.loginSection.style.display = 'none'; el.mainAppSection.style.display = 'block';
            currentUser = session.user; await loadUserProfile();
        } else {
            currentUser = null;
            el.loginSection.style.display = 'block'; el.mainAppSection.style.display = 'none';
        }
    });

    async function loadUserProfile() {
        if (!currentUser) return;
        const { data, error } = await _supabase.from('profiles').select('username, avatar_url').eq('id', currentUser.id).single();
        if (error && error.code !== 'PGRST116') console.error('Error loading profile:', error);
        const username = data?.username || currentUser.email.split('@')[0];
        const avatarUrl = data?.avatar_url || 'https://i.imgur.com/8mUOF1k.png';
        el.userInfo.textContent = username; el.headerAvatar.src = avatarUrl;
        el.profileAvatarPreview.src = avatarUrl; el.usernameInput.value = username;
    }
    
    el.uploadAvatarBtn.addEventListener('click', () => el.avatarUploadInput.click());
    el.avatarUploadInput.addEventListener('change', async () => {
        if (!currentUser || !el.avatarUploadInput.files || el.avatarUploadInput.files.length === 0) return;
        const file = el.avatarUploadInput.files[0]; const filePath = `${currentUser.id}/${Date.now()}_${file.name}`;
        el.uploadAvatarBtn.textContent = 'UPLOADING...';
        try {
            const { error: uploadError } = await _supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = _supabase.storage.from('avatars').getPublicUrl(filePath);
            await _supabase.from('profiles').upsert({ id: currentUser.id, avatar_url: publicUrl });
            showNotification('Picture updated!', 'success'); await loadUserProfile();
        } catch (error) { showNotification('Error uploading picture!', 'error'); console.error(error); } 
        finally { el.uploadAvatarBtn.textContent = 'Upload New Picture'; }
    });
    el.saveProfileBtn.addEventListener('click', async () => {
        if (!currentUser) return; const newUsername = el.usernameInput.value;
        el.saveProfileBtn.textContent = 'SAVING...';
        try {
            const { error } = await _supabase.from('profiles').upsert({ id: currentUser.id, username: newUsername });
            if (error) throw error;
            showNotification('Username saved!', 'success'); await loadUserProfile();
        } catch (error) { showNotification('Error saving username!', 'error'); console.error(error); }
        finally { el.saveProfileBtn.textContent = 'Save Profile'; }
    });

    if (SpeechRecognition) {
        const writerRecognition = new SpeechRecognition(); writerRecognition.continuous = true; writerRecognition.interimResults = true;
        let isWriterListening = false; let scribeFinalTranscript = '';
        writerRecognition.onstart = () => { isWriterListening = true; el.startBtn.textContent = 'Stop Scribing'; scribeFinalTranscript = el.noteTextarea.value; };
        writerRecognition.onend = () => { isWriterListening = false; el.startBtn.textContent = 'Start Scribing'; };
        writerRecognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) { scribeFinalTranscript += event.results[i][0].transcript + ' '; } 
                else { interim += event.results[i][0].transcript; }
            }
            el.noteTextarea.value = scribeFinalTranscript + interim;
        };
        el.startBtn.addEventListener('click', () => { isWriterListening ? writerRecognition.stop() : writerRecognition.start(); });
    }

    el.brainstormBtn.addEventListener('click', async () => {
        const topic = el.brainstormInput.value; if (!topic) { showNotification('Please enter a topic!', 'error'); return; }
        el.aiResponseDiv.innerHTML = '🧠 Generating innovative ideas...';
        const prompt = `You are an expert business and product strategist. A user wants innovative ideas for the topic: "${topic}". Provide 3 distinct and actionable ideas. For each idea, provide a catchy name, a one-sentence summary, and 2-3 key features. Format the output clearly and professionally using markdown for bolding and bullet points.`;
        try {
            const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ "contents": [{ "parts": [{ "text": prompt }] }] }) });
            if (!response.ok) throw new Error(`Server error! status: ${response.status}`);
            const data = await response.json();
            const aiText = data.candidates[0].content.parts[0].text;
            el.aiResponseDiv.innerHTML = marked.parse(aiText); // FIX: Use marked.parse to render markdown
        } catch (error) { console.error("Error:", error); el.aiResponseDiv.textContent = 'AI Error. Please try again later.'; }
    });

    let chatState = { history: [], isChatting: false, voices: [] };
    const systemPrompt = { role: 'user', parts: [{ text: `You are Gemi, a friendly, human-like AI brainstorming partner. Your primary goal is to be helpful and provide creative insights. YOUR RULES: 1. **Be Helpful First:** Directly provide a useful idea, suggestion, or answer to the user's last statement. 2. **Be Conversational Second:** After being helpful, ask a natural, open-ended question to encourage more thought and keep the chat flowing. 3. **Keep it Concise:** Your responses should be short and easy to digest (1-4 sentences). 4. **No Lists:** Do not use bullet points or numbered lists unless the user explicitly asks for them. 5. **Sound Human:** Avoid robotic phrases. Use a warm, enthusiastic, and curious tone.` }] };
    function populateVoiceList() {
        chatState.voices = synthesis.getVoices(); el.voiceSelect.innerHTML = '';
        chatState.voices.filter(v => v.lang.startsWith('en')).forEach(voice => {
            const option = document.createElement('option'); option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-name', voice.name); el.voiceSelect.appendChild(option);
        });
    }
    populateVoiceList(); if (synthesis.onvoiceschanged !== undefined) { synthesis.onvoiceschanged = populateVoiceList; }
    function addToChatHistory(speaker, text) {
        const messageDiv = document.createElement('div'); messageDiv.classList.add('chat-message', `${speaker}-message`);
        messageDiv.innerHTML = `<strong>${speaker.charAt(0).toUpperCase() + speaker.slice(1)}:</strong> ${text}`;
        el.chatHistoryDiv.appendChild(messageDiv); el.chatHistoryDiv.scrollTop = el.chatHistoryDiv.scrollHeight;
    }
    function speakText(text, onEndCallback) {
        synthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text);
        const selectedVoiceName = el.voiceSelect.selectedOptions[0]?.getAttribute('data-name');
        const selectedVoice = chatState.voices.find(v => v.name === selectedVoiceName);
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.onend = onEndCallback; synthesis.speak(utterance);
    }
    async function sendToGeminiForChat() {
        el.chatStatus.textContent = "AI is thinking...";
        try {
            const apiHistory = [systemPrompt, ...chatState.history]; // FIX: Send system prompt with history
            const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ "contents": apiHistory }) });
            const data = await response.json(); const aiText = data.candidates[0].content.parts[0].text;
            addToChatHistory('ai', aiText); chatState.history.push({ role: 'model', parts: [{ text: aiText }] });
            speakText(aiText, () => { if (chatState.isChatting) { el.chatStatus.textContent = "Your turn. I'm listening..."; if (chatRecognition) chatRecognition.start(); } });
        } catch (error) { el.chatStatus.textContent = "Error. Ending chat."; console.error(error); chatState.isChatting = false; el.startChatBtn.textContent = "Start Conversation"; }
    }
    if (SpeechRecognition) {
        const chatRecognition = new SpeechRecognition(); chatRecognition.continuous = false;
        chatRecognition.onresult = (event) => {
            const userText = event.results[0][0].transcript;
            addToChatHistory('user', userText); chatState.history.push({ role: 'user', parts: [{ text: userText }] });
            sendToGeminiForChat();
        };
        el.startChatBtn.addEventListener('click', () => {
            if (chatState.isChatting) {
                chatState.isChatting = false; chatRecognition.stop(); synthesis.cancel();
                el.chatStatus.textContent = "Conversation ended."; el.startChatBtn.textContent = "Start Conversation";
            } else {
                chatState.isChatting = true; el.startChatBtn.textContent = "End Conversation";
                el.chatStatus.textContent = "Starting..."; el.chatHistoryDiv.innerHTML = ''; chatState.history = [];
                const firstAIResponse = "Hello! I'm Gemi, your creative partner. What can I help you brainstorm today?";
                addToChatHistory('ai', firstAIResponse);
                chatState.history.push({ role: 'model', parts: [{ text: firstAIResponse }] }); // Initialize chat history
                speakText(firstAIResponse, () => { el.chatStatus.textContent = "Your turn. I'm listening..."; chatRecognition.start(); });
            }
        });
    }
});
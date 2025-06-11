// File: app.js (Final Polished Version - Fixes AI Bugs)

document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://dmwnttcisinyuprdizvh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtd250dGNpc2lueXVwcmRpenZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MDQxOTMsImV4cCI6MjA2NTE4MDE5M30.4X4cuJhCR8A6ep6-SHT3dUZxRtKu6C_sGJku1ooN2aM';

    const { createClient } = supabase; const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; const synthesis = window.speechSynthesis;
    let currentUser = null;

    const el = {
        loginSection: document.getElementById('login-section'), mainAppSection: document.getElementById('main-app-section'), googleLoginBtn: document.getElementById('google-login-btn'), logoutBtn: document.getElementById('logout-btn'), userInfo: document.getElementById('user-info'), headerAvatar: document.getElementById('header-avatar'), notificationArea: document.getElementById('notification-area'), tabButtons: document.querySelectorAll('.tab-btn'), tabPanels: document.querySelectorAll('.tab-panel'), startBtn: document.getElementById('start-btn'), noteTextarea: document.getElementById('note-textarea'), brainstormBtn: document.getElementById('brainstorm-btn'), brainstormInput: document.getElementById('brainstorm-input'), aiResponseDiv: document.getElementById('ai-response'), startChatBtn: document.getElementById('start-chat-btn'), chatHistoryDiv: document.getElementById('chat-history'), chatStatus: document.getElementById('chat-status'), voiceSelect: document.getElementById('voice-select'), usernameInput: document.getElementById('username-input'), avatarUploadInput: document.getElementById('avatar-upload-input'), uploadAvatarBtn: document.getElementById('upload-avatar-btn'), saveProfileBtn: document.getElementById('save-profile-btn'), profileAvatarPreview: document.getElementById('profile-avatar-preview')
    };

    function showNotification(message, type = 'success') { el.notificationArea.textContent = message; el.notificationArea.className = `notification ${type} show`; setTimeout(() => el.notificationArea.classList.remove('show'), 4000); }
    function showTab(targetPanelId) { el.tabPanels.forEach(p => p.classList.remove('active-panel')); el.tabButtons.forEach(b => b.classList.remove('active')); const p = document.getElementById(targetPanelId); const b = document.querySelector(`.tab-btn[data-target="${targetPanelId}"]`); if (p) p.classList.add('active-panel'); if (b) b.classList.add('active'); }
    function updateLoginUI(isLoggedIn) {
        el.loginSection.style.display = isLoggedIn ? 'none' : 'block';
        el.mainAppSection.style.display = isLoggedIn ? 'block' : 'none';
        if (!isLoggedIn) currentUser = null;
    }
    
    el.tabButtons.forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.target)));
    el.googleLoginBtn.addEventListener('click', () => _supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } }));
    el.logoutBtn.addEventListener('click', async () => { await _supabase.auth.signOut(); updateLoginUI(false); });
    _supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) { currentUser = session.user; await loadUserProfile(); updateLoginUI(true); } 
        else { updateLoginUI(false); }
    });

    async function loadUserProfile() { 
        if (!currentUser) return; const { data, error } = await _supabase.from('profiles').select('username, avatar_url').eq('id', currentUser.id).single(); if (error && error.code !== 'PGRST116') console.error('Error loading profile:', error); const username = data?.username || currentUser.email.split('@')[0]; const avatarUrl = data?.avatar_url || 'https://i.imgur.com/8mUOF1k.png'; el.userInfo.textContent = username; el.headerAvatar.src = avatarUrl; el.profileAvatarPreview.src = avatarUrl; el.usernameInput.value = username;
    }
    el.uploadAvatarBtn.addEventListener('click', () => el.avatarUploadInput.click());
    el.avatarUploadInput.addEventListener('change', async () => {
        if (!currentUser || !el.avatarUploadInput.files || el.avatarUploadInput.files.length === 0) return; const file = el.avatarUploadInput.files[0]; const filePath = `${currentUser.id}/${Date.now()}_${file.name}`; el.uploadAvatarBtn.textContent = 'UPLOADING...'; try { const { error: uploadError } = await _supabase.storage.from('avatars').upload(filePath, file, { upsert: true }); if (uploadError) throw uploadError; const { data: { publicUrl } } = _supabase.storage.from('avatars').getPublicUrl(filePath); await _supabase.from('profiles').upsert({ id: currentUser.id, avatar_url: publicUrl }); showNotification('Picture updated!', 'success'); await loadUserProfile(); } catch (error) { showNotification('Error uploading picture!', 'error'); console.error(error); } finally { el.uploadAvatarBtn.textContent = 'Upload New Picture'; }
    });
    el.saveProfileBtn.addEventListener('click', async () => {
        if (!currentUser) return; const newUsername = el.usernameInput.value; el.saveProfileBtn.textContent = 'SAVING...'; try { const { error } = await _supabase.from('profiles').upsert({ id: currentUser.id, username: newUsername }); if (error) throw error; showNotification('Username saved!', 'success'); await loadUserProfile(); } catch (error) { showNotification('Error saving username!', 'error'); console.error(error); } finally { el.saveProfileBtn.textContent = 'Save Profile'; }
    });

    if (SpeechRecognition) { const writerRecognition = new SpeechRecognition(); writerRecognition.continuous = true; writerRecognition.interimResults = true; let isWriterListening = false; let scribeFinalTranscript = ''; writerRecognition.onstart = () => { isWriterListening = true; el.startBtn.textContent = 'Stop Scribing'; scribeFinalTranscript = el.noteTextarea.value; }; writerRecognition.onend = () => { isWriterListening = false; el.startBtn.textContent = 'Start Scribing'; }; writerRecognition.onresult = (event) => { let interim = ''; for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) { scribeFinalTranscript += event.results[i][0].transcript + ' '; } else { interim += event.results[i][0].transcript; } } el.noteTextarea.value = scribeFinalTranscript + interim; }; el.startBtn.addEventListener('click', () => { isWriterListening ? writerRecognition.stop() : writerRecognition.start(); }); }

    el.brainstormBtn.addEventListener('click', async () => {
        const topic = el.brainstormInput.value; if (!topic) { showNotification('Please enter a topic!', 'error'); return; }
        el.aiResponseDiv.innerHTML = '🧠 Generating innovative ideas...';
        const prompt = `You are an expert business and product strategist. A user wants innovative ideas for the topic: "${topic}". Provide 3 distinct and actionable ideas. For each idea, provide a catchy name, a one-sentence summary, and 2-3 key features. Format the output clearly and professionally using markdown for bolding and bullet points.`;
        try {
            // FIX: This body format is now correct and will work with our server function.
            const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ "contents": [{ "parts": [{ "text": prompt }] }] }) });
            if (!response.ok) throw new Error('The AI server could not be reached.');
            const data = await response.json();
            if (!data.candidates) throw new Error('Invalid response from AI.');
            const aiText = data.candidates[0].content.parts[0].text;
            el.aiResponseDiv.innerHTML = marked.parse(aiText);
        } catch (error) { console.error("Error:", error); el.aiResponseDiv.textContent = 'AI Error: ' + error.message; }
    });
    
    let chatState = { history: [], isChatting: false, voices: [] };
    // BUG FIX: The system instruction MUST NOT contain a "role". It should just be the parts.
    const systemInstruction = {
        parts: [{ text: `You are Gemi, a friendly, human-like AI brainstorming partner. Your primary goal is to be helpful and provide creative insights. YOUR RULES: 1. **Be Helpful First:** Directly provide a useful idea, suggestion, or answer to the user's last statement. 2. **Be Conversational Second:** After being helpful, ask a natural, open-ended question to encourage more thought and keep the chat flowing. 3. **Keep it Concise:** Your responses should be short and easy to digest (1-4 sentences). 4. **No Lists:** Do not use bullet points or numbered lists unless the user explicitly asks for them. 5. **Sound Human:** Avoid robotic phrases. Use a warm, enthusiastic, and curious tone.` }]
    };
    
    function populateVoiceList() { chatState.voices = synthesis.getVoices(); el.voiceSelect.innerHTML = ''; chatState.voices.filter(v => v.lang.startsWith('en')).forEach(v => { const o = document.createElement('option'); o.textContent = `${v.name} (${v.lang})`; o.setAttribute('data-name', v.name); el.voiceSelect.appendChild(o); }); }
    populateVoiceList(); if (synthesis.onvoiceschanged !== undefined) { synthesis.onvoiceschanged = populateVoiceList; }
    
    function addToChatHistory(speaker, text) { const m = document.createElement('div'); m.classList.add('chat-message', `${speaker}-message`); m.innerHTML = `<strong>${speaker.charAt(0).toUpperCase() + speaker.slice(1)}:</strong> ${text}`; el.chatHistoryDiv.appendChild(m); el.chatHistoryDiv.scrollTop = el.chatHistoryDiv.scrollHeight; }
    
    function speakText(text, onEndCallback) {
        synthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text);
        const selectedVoiceName = el.voiceSelect.selectedOptions[0]?.getAttribute('data-name');
        const selectedVoice = chatState.voices.find(v => v.name === selectedVoiceName);
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.onend = onEndCallback; // This ensures the next action waits until speech is done.
        synthesis.speak(utterance);
    }
    
    async function getAIChatResponse() {
        el.chatStatus.textContent = "AI is thinking...";
        try {
            // FIX: This body format is now correct, sending history and the corrected system instruction.
            const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: chatState.history, systemInstruction }) });
            if (!response.ok) throw new Error('AI server did not respond correctly.');
            const data = await response.json(); const aiText = data.candidates[0].content.parts[0].text;
            addToChatHistory('ai', aiText); chatState.history.push({ role: 'model', parts: [{ text: aiText }] });
            // This callback prevents the mic from trying to listen while the AI is talking.
            speakText(aiText, () => {
                if (chatState.isChatting) {
                    el.chatStatus.textContent = "Your turn. I'm listening...";
                    chatRecognition.start();
                }
            });
        } catch (error) { el.chatStatus.textContent = "Error. Ending chat."; console.error(error); chatState.isChatting = false; el.startChatBtn.textContent = "Start Conversation"; }
    }
    
    if (SpeechRecognition) {
        const chatRecognition = new SpeechRecognition(); chatRecognition.continuous = false;
        chatRecognition.onresult = (event) => {
            const userText = event.results[0][0].transcript;
            addToChatHistory('user', userText);
            chatState.history.push({ role: 'user', parts: [{ text: userText }] });
            getAIChatResponse();
        };
        chatRecognition.onstart = () => { el.chatStatus.textContent = "Listening..."; };
        chatRecognition.onerror = (event) => { if (event.error !== 'no-speech' && event.error !== 'aborted') { console.error('Speech recognition error:', event.error); el.chatStatus.textContent = "Mic error. Try again."; } };
        
        el.startChatBtn.addEventListener('click', () => {
            if (chatState.isChatting) {
                chatState.isChatting = false; chatRecognition.stop(); synthesis.cancel();
                el.chatStatus.textContent = "Conversation ended."; el.startChatBtn.textContent = "Start Conversation";
            } else {
                chatState.isChatting = true; el.startChatBtn.textContent = "End Conversation";
                el.chatHistoryDiv.innerHTML = ''; chatState.history = [];
                // Start the conversation by having the AI speak first
                speakText("Hello! I'm Gemi, your creative partner. What can I help you brainstorm today?", () => {
                    if (chatState.isChatting) chatRecognition.start(); // Start listening only after the intro is done
                });
            }
        });
    }
});
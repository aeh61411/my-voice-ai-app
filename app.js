// app.js

// --- PASTE YOUR KEYS HERE! ---
const SUPABASE_URL = 'https://dmwnttcisinyuprdizvh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtd250dGNpc2lueXVwcmRpenZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MDQxOTMsImV4cCI6MjA2NTE4MDE5M30.4X4cuJhCR8A6ep6-SHT3dUZxRtKu6C_sGJku1ooN2aM';
const GEMINI_API_KEY = 'AIzaSyDA_bqi2X7kLKjV5oGsGVLA-R4E7p287s0';

// --- GLOBAL SETUP ---
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synthesis = window.speechSynthesis;
let currentUser = null;

const el = {
    loginSection: document.getElementById('login-section'), mainAppSection: document.getElementById('main-app-section'),
    googleLoginBtn: document.getElementById('google-login-btn'), logoutBtn: document.getElementById('logout-btn'),
    userInfo: document.getElementById('user-info'), headerAvatar: document.getElementById('header-avatar'),
    tabs: [
        { btn: document.getElementById('voice-tab-btn'), panel: document.getElementById('voice-writer-panel') },
        { btn: document.getElementById('brainstorm-tab-btn'), panel: document.getElementById('brainstormer-panel') },
        { btn: document.getElementById('chatbot-tab-btn'), panel: document.getElementById('chatbot-panel') },
        { btn: document.getElementById('profile-tab-btn'), panel: document.getElementById('profile-panel') }
    ],
    // Voice Writer
    startBtn: document.getElementById('start-btn'), noteTextarea: document.getElementById('note-textarea'),
    // Brainstormer
    brainstormBtn: document.getElementById('brainstorm-btn'), brainstormInput: document.getElementById('brainstorm-input'), aiResponseDiv: document.getElementById('ai-response'),
    // Chatbot
    startChatBtn: document.getElementById('start-chat-btn'), chatHistoryDiv: document.getElementById('chat-history'), chatStatus: document.getElementById('chat-status'), voiceSelect: document.getElementById('voice-select'),
    // Profile
    usernameInput: document.getElementById('username-input'), avatarUploadInput: document.getElementById('avatar-upload-input'),
    uploadAvatarBtn: document.getElementById('upload-avatar-btn'), saveProfileBtn: document.getElementById('save-profile-btn'),
    profileAvatarPreview: document.getElementById('profile-avatar-preview')
};

// --- CORE APP LOGIC ---
function showTab(panelToShow) {
    el.tabs.forEach(tab => {
        tab.panel.classList.remove('active-panel');
        tab.btn.classList.remove('active');
    });
    const activeTab = el.tabs.find(tab => tab.panel === panelToShow);
    if (activeTab) {
        activeTab.panel.classList.add('active-panel');
        activeTab.btn.classList.add('active');
    }
}
el.tabs.forEach(tab => { if (tab.btn !== el.logoutBtn && tab.btn !== el.profileTabBtn) { tab.btn.onclick = () => showTab(tab.panel); }});
el.profileTabBtn.onclick = () => showTab(el.profilePanel); // Special case for profile button in header
el.googleLoginBtn.onclick = async () => await _supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
el.logoutBtn.onclick = async () => { await _supabase.auth.signOut(); currentUser = null; };

_supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
        el.loginSection.style.display = 'none'; el.mainAppSection.style.display = 'block';
        currentUser = session.user;
        await loadUserProfile();
    } else {
        el.loginSection.style.display = 'block'; el.mainAppSection.style.display = 'none';
    }
});

// --- PROFILE LOGIC ---
async function loadUserProfile() {
    if (!currentUser) return;
    const { data, error } = await _supabase.from('profiles').select('username, avatar_url').eq('id', currentUser.id).single();
    if (error && error.code !== 'PGRST116') console.error('Error loading profile:', error);
    const username = data?.username || currentUser.email.split('@')[0];
    const avatarUrl = data?.avatar_url || 'https://via.placeholder.com/100'; // Default placeholder
    el.userInfo.textContent = username;
    el.headerAvatar.src = avatarUrl;
    el.profileAvatarPreview.src = avatarUrl;
    el.usernameInput.value = username;
}

el.uploadAvatarBtn.onclick = () => el.avatarUploadInput.click();
el.saveProfileBtn.onclick = async () => {
    if (!currentUser) return;
    const newUsername = el.usernameInput.value;
    const file = el.avatarUploadInput.files[0];
    let newAvatarUrl = null;

    if (file) {
        const filePath = `${currentUser.id}/${file.name}`;
        const { error: uploadError } = await _supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
        if (uploadError) { alert('Error uploading picture!'); console.error(uploadError); return; }
        const { data: { publicUrl } } = _supabase.storage.from('avatars').getPublicUrl(filePath);
        newAvatarUrl = publicUrl;
    }

    const { error: updateError } = await _supabase.from('profiles').upsert({ id: currentUser.id, username: newUsername, avatar_url: newAvatarUrl });
    if (updateError) { alert('Error saving profile!'); console.error(updateError); } 
    else { alert('Profile saved successfully!'); await loadUserProfile(); }
};

// --- TAB 1: VOICE WRITER ---
if (SpeechRecognition) { const writerRecognition = new SpeechRecognition(); writerRecognition.continuous = true; writerRecognition.interimResults = true; let isWriterListening = false; let finalTranscript = ''; writerRecognition.onstart = () => { isWriterListening = true; el.startBtn.textContent = 'Stop Listening'; finalTranscript = el.noteTextarea.value; }; writerRecognition.onend = () => { isWriterListening = false; el.startBtn.textContent = 'Start Scribing'; }; writerRecognition.onresult = (event) => { let interim = ''; for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) { finalTranscript += event.results[i][0].transcript + ' '; } else { interim += event.results[i][0].transcript; } } el.noteTextarea.value = finalTranscript + interim; }; el.startBtn.onclick = () => { if (isWriterListening) { writerRecognition.stop(); } else { writerRecognition.start(); } }; }

// --- TAB 2: IDEA SPARK ---
el.brainstormBtn.onclick = async () => { const topic = el.brainstormInput.value; if (!topic) { alert('Please enter a topic!'); return; } el.aiResponseDiv.textContent = '🧠 Generating innovative ideas...'; const prompt = `You are an expert business and product strategist. A user wants innovative ideas for the topic: "${topic}". Provide 3 distinct and actionable ideas. For each idea, provide a catchy name, a one-sentence summary, and 2-3 key features. Format the output clearly using markdown for bolding and bullet points. Your tone should be creative and professional.`; try { const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ "contents": [{ "parts": [{ "text": prompt }] }] }) }); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); const data = await response.json(); el.aiResponseDiv.textContent = data.candidates[0].content.parts[0].text; } catch (error) { console.error("Error:", error); el.aiResponseDiv.textContent = 'AI Error. Check API key and billing.'; } };

// --- TAB 3: AI CO-PILOT ---
let chatHistory = []; let isChatting = false; let voices = [];
const systemPrompt = { role: 'user', parts: [{ text: `You are Gemi, a friendly and extremely creative AI brainstorming partner. YOUR MOST IMPORTANT RULE: Be helpful first, then conversational. Directly provide a creative idea or answer before asking a follow-up question. OTHER RULES: 1. Keep responses concise (1-4 sentences). 2. Your tone is enthusiastic. 3. After providing a helpful answer, ask an open-ended question.` }] };
function populateVoiceList() { voices = synthesis.getVoices(); el.voiceSelect.innerHTML = ''; voices.filter(v => v.lang.startsWith('en')).forEach(voice => { const option = document.createElement('option'); option.textContent = `${voice.name} (${voice.lang})`; option.setAttribute('data-name', voice.name); el.voiceSelect.appendChild(option); }); }
if (synthesis.onvoiceschanged !== undefined) { synthesis.onvoiceschanged = populateVoiceList; } else { populateVoiceList(); }
function addToChatHistory(speaker, text) { const messageDiv = document.createElement('div'); messageDiv.classList.add('chat-message', `${speaker}-message`); messageDiv.innerHTML = `<strong>${speaker.charAt(0).toUpperCase() + speaker.slice(1)}:</strong> ${text}`; el.chatHistoryDiv.appendChild(messageDiv); el.chatHistoryDiv.scrollTop = el.chatHistoryDiv.scrollHeight; }
function speakText(text, onEndCallback) { synthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); const selectedVoiceName = el.voiceSelect.selectedOptions[0]?.getAttribute('data-name'); const selectedVoice = voices.find(v => v.name === selectedVoiceName); if (selectedVoice) { utterance.voice = selectedVoice; } utterance.onend = onEndCallback; synthesis.speak(utterance); }
async function sendToGeminiForChat() { el.chatStatus.textContent = "AI is thinking..."; try { const apiHistory = [systemPrompt, ...chatHistory]; const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ "contents": apiHistory }) }); if (!response.ok) throw new Error(); const data = await response.json(); const aiText = data.candidates[0].content.parts[0].text; addToChatHistory('ai', aiText); chatHistory.push({ role: 'model', parts: [{ text: aiText }] }); speakText(aiText, () => { if (isChatting) { el.chatStatus.textContent = "Your turn. I'm listening..."; chatRecognition.start(); } }); } catch (error) { el.chatStatus.textContent = "Error. Ending chat."; console.error(error); isChatting = false; el.startChatBtn.textContent = "Start Conversation"; } }
if (SpeechRecognition) { const chatRecognition = new SpeechRecognition(); chatRecognition.continuous = false; chatRecognition.onresult = (event) => { const userText = event.results[0][0].transcript; addToChatHistory('user', userText); chatHistory.push({ role: 'user', parts: [{ text: userText }] }); sendToGeminiForChat(); }; el.startChatBtn.onclick = () => { if (isChatting) { isChatting = false; chatRecognition.stop(); synthesis.cancel(); el.chatStatus.textContent = "Conversation ended."; el.startChatBtn.textContent = "Start Conversation"; } else { isChatting = true; el.startChatBtn.textContent = "End Conversation"; el.chatStatus.textContent = "Starting..."; el.chatHistoryDiv.innerHTML = ''; chatHistory = []; const firstAIResponse = "Hello! I'm Gemi, your creative partner. What can I help you brainstorm today?"; addToChatHistory('ai', firstAIResponse); speakText(firstAIResponse, () => { el.chatStatus.textContent = "Your turn. I'm listening..."; chatRecognition.start(); }); } }; }
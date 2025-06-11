// File: app.js (Final Polished Version)
document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIG & INITIALIZATION ---
    const SUPABASE_URL = 'https://dmwnttcisinyuprdizvh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtd250dGNpc2lueXVwcmRpenZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MDQxOTMsImV4cCI6MjA2NTE4MDE5M30.4X4cuJhCR8A6ep6-SHT3dUZxRtKu6C_sGJku1ooN2aM';

    const { createClient } = supabase;
    const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let currentUser = null;
    let currentNoteId = null;
    let notesCache = [];
    let deepgramSocket;
    let microphone;

    const el = {
        loginSection: document.getElementById('login-section'),
        appContainer: document.getElementById('app-container'),
        googleLoginBtn: document.getElementById('google-login-btn'),
        logoutBtn: document.getElementById('logout-btn'),
        userAvatar: document.getElementById('user-avatar'),
        userEmail: document.getElementById('user-email'),
        noteList: document.getElementById('note-list'),
        newNoteBtn: document.getElementById('new-note-btn'),
        editorPanel: document.getElementById('editor-panel'),
        welcomePanel: document.getElementById('welcome-panel'),
        editorTitle: document.getElementById('editor-title'),
        noteTextarea: document.getElementById('note-textarea'),
        startScribingBtn: document.getElementById('start-scribing-btn'),
        statusText: document.getElementById('status-text'),
        recordingDot: document.getElementById('recording-dot'),
        saveNoteBtn: document.getElementById('save-note-btn'),
        deleteBtn: document.getElementById('delete-btn'),
        refineBtn: document.getElementById('refine-btn'),
        copyBtn: document.getElementById('copy-btn'),
        downloadBtn: document.getElementById('download-btn'),
        notificationArea: document.getElementById('notification-area'),
        loaderOverlay: document.getElementById('loader-overlay'),
    };

    // --- UI & NOTIFICATIONS ---
    function showNotification(message, duration = 3000) {
        el.notificationArea.textContent = message;
        el.notificationArea.classList.add('show');
        setTimeout(() => el.notificationArea.classList.remove('show'), duration);
    }
    const toggleLoader = (show) => { el.loaderOverlay.style.display = show ? 'flex' : 'none'; };

    // --- AUTHENTICATION ---
    _supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUser = session.user;
            el.userAvatar.src = currentUser.user_metadata.avatar_url || 'https://i.imgur.com/8mUOF1k.png';
            el.userEmail.textContent = currentUser.email;
            el.loginSection.style.display = 'none';
            el.appContainer.style.display = 'flex';
            await loadNotes();
        } else {
            currentUser = null;
            el.loginSection.style.display = 'flex';
            el.appContainer.style.display = 'none';
        }
    });
    el.googleLoginBtn.addEventListener('click', () => _supabase.auth.signInWithOAuth({ provider: 'google' }));
    el.logoutBtn.addEventListener('click', () => _supabase.auth.signOut());
    
    // --- NOTE MANAGEMENT (CRUD) ---
    async function loadNotes() {
        if (!currentUser) return;
        const { data, error } = await _supabase.from('notes').select('*').eq('user_id', currentUser.id).order('updated_at', { ascending: false });
        if (error) { console.error('Error loading notes:', error); return; }
        notesCache = data;
        renderNoteList();
        showWelcomePanel(notesCache.length === 0);
    }

    function renderNoteList() {
        el.noteList.innerHTML = '';
        if (notesCache.length === 0) {
            el.noteList.innerHTML = '<p class="no-notes">No notes yet. Create one!</p>';
            return;
        }
        notesCache.forEach(note => {
            const noteEl = document.createElement('div');
            noteEl.classList.add('note-item');
            noteEl.dataset.id = note.id;
            if (note.id === currentNoteId) noteEl.classList.add('active');
            
            const title = note.content ? note.content.substring(0, 30).split('\n')[0] : 'Untitled Note';
            noteEl.innerHTML = `
                <div class="note-title">${title}...</div>
                <div class="note-date">${new Date(note.updated_at).toLocaleString()}</div>
            `;
            noteEl.addEventListener('click', () => setActiveNote(note.id));
            el.noteList.prepend(noteEl);
        });
    }

    function setActiveNote(noteId) {
        currentNoteId = noteId;
        const note = notesCache.find(n => n.id === noteId);
        if (note) {
            el.noteTextarea.value = note.content || '';
            const title = note.content ? note.content.substring(0, 40).split('\n')[0] + '...' : 'Untitled Note';
            el.editorTitle.textContent = title;
            showWelcomePanel(false);
        }
        renderNoteList();
    }

    function showWelcomePanel(show) {
        el.welcomePanel.style.display = show ? 'flex' : 'none';
        el.editorPanel.style.display = show ? 'none' : 'flex';
    }

    el.newNoteBtn.addEventListener('click', () => {
        currentNoteId = null;
        el.noteTextarea.value = '';
        el.editorTitle.textContent = 'New Note';
        showWelcomePanel(false);
        renderNoteList();
        el.noteTextarea.focus();
    });

    el.saveNoteBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        const content = el.noteTextarea.value;
        const noteData = { user_id: currentUser.id, content, updated_at: new Date() };

        let result;
        if (currentNoteId) { // Update existing note
            result = await _supabase.from('notes').update(noteData).eq('id', currentNoteId).select();
        } else { // Create new note
            result = await _supabase.from('notes').insert(noteData).select();
        }

        if (result.error) {
            console.error('Error saving note:', result.error);
            showNotification('Error saving note.');
        } else {
            showNotification('Note saved!');
            if (result.data && result.data.length > 0) {
                currentNoteId = result.data[0].id;
            }
            await loadNotes();
        }
    });

    el.deleteBtn.addEventListener('click', async () => {
        if (!currentNoteId || !confirm('Are you sure you want to delete this note?')) return;
        
        const { error } = await _supabase.from('notes').delete().eq('id', currentNoteId);
        if (error) {
            console.error('Error deleting note:', error);
            showNotification('Error deleting note.');
        } else {
            showNotification('Note deleted.');
            currentNoteId = null;
            el.noteTextarea.value = '';
            await loadNotes();
        }
    });

    // --- DEEPGRAM TRANSCRIPTION ---
    const getDeepgramKey = async () => {
        try {
            const response = await fetch('/api/deepgram');
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            return data.key;
        } catch (error) {
            console.error("Could not get Deepgram key:", error);
            showNotification("Error connecting to transcription service.");
            return null;
        }
    };

    const connectToDeepgram = async () => {
        const tempKey = await getDeepgramKey();
        if (!tempKey) return;
        
        deepgramSocket = new WebSocket(`wss://api.deepgram.com/v1/listen?puncuate=true&interim_results=true&model=nova-2`, ['token', tempKey]);
        
        deepgramSocket.onopen = async () => {
            try {
                microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(microphone, { mimeType: 'audio/webm' });
                mediaRecorder.addEventListener('dataavailable', event => {
                    if (event.data.size > 0 && deepgramSocket.readyState === WebSocket.OPEN) {
                        deepgramSocket.send(event.data);
                    }
                });
                mediaRecorder.start(250); // Send data every 250ms
                updateScribingUI(true);
            } catch (error) {
                console.error("Microphone access error:", error);
                showNotification("Microphone access denied.");
                disconnectFromDeepgram();
            }
        };

        deepgramSocket.onmessage = (message) => {
            const data = JSON.parse(message.data);
            const transcript = data.channel.alternatives[0].transcript;
            if (transcript && data.is_final) {
                // Apply voice commands for punctuation
                const formattedTranscript = applyPunctuation(transcript);
                el.noteTextarea.value += formattedTranscript + ' ';
            }
        };

        deepgramSocket.onclose = () => {
            updateScribingUI(false);
            if (microphone) microphone.getTracks().forEach(track => track.stop());
            microphone = null;
            deepgramSocket = null;
        };
    };

    const disconnectFromDeepgram = () => {
        if (deepgramSocket) deepgramSocket.close();
    };

    function updateScribingUI(isScribing) {
        if (isScribing) {
            el.startScribingBtn.textContent = 'Stop Scribing';
            el.recordingDot.classList.add('recording');
            el.statusText.textContent = 'Scribing...';
        } else {
            el.startScribingBtn.textContent = 'Start Scribing';
            el.recordingDot.classList.remove('recording');
            el.statusText.textContent = 'Ready';
        }
    }
    
    el.startScribingBtn.addEventListener('click', () => {
        if (deepgramSocket) disconnectFromDeepgram();
        else connectToDeepgram();
    });

    const punctuationMap = {
        'comma': ',', 'full stop': '.', 'period': '.', 'question mark': '?',
        'exclamation mark': '!', 'exclamation point': '!', 'new line': '\n', 'new paragraph': '\n\n'
    };
    function applyPunctuation(text) {
        let punctuatedText = text;
        for (const [word, symbol] of Object.entries(punctuationMap)) {
            const regex = new RegExp(`\\s${word}`, 'gi');
            punctuatedText = punctuatedText.replace(regex, symbol);
        }
        return punctuatedText;
    }

    // --- AI REFINEMENT & UTILITIES ---
    el.refineBtn.addEventListener('click', async () => {
        const text = el.noteTextarea.value;
        if (text.trim().length < 10) { showNotification("Not enough text to refine."); return; }
        
        toggleLoader(true);
        const prompt = `You are an expert editor. Please correct any spelling and grammar mistakes in the following text. Also, improve the formatting for clarity and readability by using paragraphs and structure. Do not add any new content or change the original meaning. Here is the text:\n\n---\n\n${text}`;
        
        try {
            const response = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ "prompt": prompt }) });
            if (!response.ok) throw new Error("AI refinement failed.");
            const data = await response.json();
            el.noteTextarea.value = data.text;
            showNotification("Note refined by AI!");
        } catch (error) {
            console.error("Refinement error:", error);
            showNotification("Error refining text.");
        } finally {
            toggleLoader(false);
        }
    });

    el.copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(el.noteTextarea.value);
        showNotification('Copied to clipboard!');
    });

    el.downloadBtn.addEventListener('click', () => {
        const text = el.noteTextarea.value;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const title = el.editorTitle.textContent.replace('...', '') || 'ScribeAI Note';
        a.download = `${title}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });
});
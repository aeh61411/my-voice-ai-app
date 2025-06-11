// File: app.js
document.addEventListener('DOMContentLoaded', async () => {
    // --- CONFIG & INITIALIZATION ---
    const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;
    
    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let currentUser = null, currentNoteId = null, notesCache = [], deepgramSocket, microphone, isScribing = false, saveTimeout;

    const el = {
        loginSection: document.getElementById('login-section'), appContainer: document.getElementById('app-container'),
        googleLoginBtn: document.getElementById('google-login-btn'), logoutBtn: document.getElementById('logout-btn'),
        userAvatar: document.getElementById('user-avatar'), userEmail: document.getElementById('user-email'),
        noteList: document.getElementById('note-list'), newNoteBtn: document.getElementById('new-note-btn'),
        editorPanel: document.getElementById('editor-panel'), welcomePanel: document.getElementById('welcome-panel'),
        editorTitle: document.getElementById('editor-title'), noteTextarea: document.getElementById('note-textarea'),
        startScribingBtn: document.getElementById('start-scribing-btn'), statusText: document.getElementById('status-text'),
        recordingDot: document.getElementById('recording-dot'), saveNoteBtn: document.getElementById('save-note-btn'),
        deleteBtn: document.getElementById('delete-btn'), refineBtn: document.getElementById('refine-btn'),
        notificationArea: document.getElementById('notification-area'), loaderOverlay: document.getElementById('loader-overlay'),
    };

    // --- UI & NOTIFICATIONS ---
    const showNotification = (message, duration = 3000) => { el.notificationArea.textContent = message; el.notificationArea.classList.add('show'); setTimeout(() => el.notificationArea.classList.remove('show'), duration); };
    const toggleLoader = (show) => { el.loaderOverlay.style.display = show ? 'flex' : 'none'; };
    const showWelcomePanel = (show) => { el.welcomePanel.style.display = show ? 'flex' : 'none'; el.editorPanel.style.display = show ? 'none' : 'flex'; };

    // --- AUTHENTICATION ---
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        currentUser = session.user; el.loginSection.style.display = 'none'; el.appContainer.style.display = 'flex';
        el.userAvatar.src = currentUser.user_metadata.avatar_url; el.userEmail.textContent = currentUser.email;
        await loadNotes();
    } else { el.loginSection.style.display = 'flex'; el.appContainer.style.display = 'none'; }
    
    _supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) { currentUser = session.user; await loadNotes(); } else { currentUser = null; location.reload(); }
    });
    el.googleLoginBtn.addEventListener('click', () => _supabase.auth.signInWithOAuth({ provider: 'google' }));
    el.logoutBtn.addEventListener('click', () => _supabase.auth.signOut());
    
    // --- NOTE MANAGEMENT (CRUD) ---
    async function loadNotes() {
        if (!currentUser) return;
        let { data, error } = await _supabase.from('notes').select('*').eq('user_id', currentUser.id).order('updated_at', { ascending: false });
        if (error) return console.error('Error loading notes:', error);
        notesCache = data;
        renderNoteList();
        showWelcomePanel(notesCache.length === 0);
    }
    function renderNoteList() {
        el.noteList.innerHTML = '';
        if (notesCache.length === 0) return el.noteList.innerHTML = '<p class="no-notes">No notes yet.</p>';
        notesCache.forEach(note => {
            const noteEl = document.createElement('div');
            noteEl.className = `note-item ${note.id === currentNoteId ? 'active' : ''}`;
            noteEl.dataset.id = note.id;
            noteEl.innerHTML = `<div class="note-title">${note.title || 'Untitled Note'}</div><div class="note-date">${new Date(note.updated_at).toLocaleDateString()}</div>`;
            noteEl.addEventListener('click', () => setActiveNote(note.id));
            el.noteList.appendChild(noteEl);
        });
    }
    function setActiveNote(noteId) {
        if (isScribing) { showNotification("Please stop scribing before changing notes."); return; }
        currentNoteId = noteId;
        const note = notesCache.find(n => n.id === noteId);
        if (note) { el.noteTextarea.value = note.content || ''; el.editorTitle.value = note.title || 'Untitled Note'; showWelcomePanel(false); }
        renderNoteList();
    }
    el.newNoteBtn.addEventListener('click', () => {
        if (isScribing) { showNotification("Please stop scribing first."); return; }
        currentNoteId = null; el.noteTextarea.value = ''; el.editorTitle.value = 'New Note';
        showWelcomePanel(false); renderNoteList(); el.noteTextarea.focus();
    });
    async function saveNote() {
        if (!currentUser) return;
        const content = el.noteTextarea.value; const title = el.editorTitle.value || 'Untitled Note';
        const noteData = { user_id: currentUser.id, title, content, updated_at: new Date() };
        let result = currentNoteId ? await _supabase.from('notes').update(noteData).eq('id', currentNoteId).select() : await _supabase.from('notes').insert(noteData).select();
        if (result.error) { console.error('Error saving:', result.error); showNotification('Error saving note.'); } 
        else { showNotification('Note saved!'); if (result.data?.[0]) { currentNoteId = result.data[0].id; } await loadNotes(); }
    }
    el.saveNoteBtn.addEventListener('click', saveNote);
    el.noteTextarea.addEventListener('input', () => { clearTimeout(saveTimeout); saveTimeout = setTimeout(saveNote, 2000); });
    el.editorTitle.addEventListener('input', () => { clearTimeout(saveTimeout); saveTimeout = setTimeout(saveNote, 2000); });
    el.deleteBtn.addEventListener('click', async () => {
        if (!currentNoteId || !confirm('Delete this note permanently?')) return;
        const { error } = await _supabase.from('notes').delete().eq('id', currentNoteId);
        if (error) showNotification('Error deleting note.');
        else { showNotification('Note deleted.'); currentNoteId = null; await loadNotes(); }
    });

    // --- DEEPGRAM TRANSCRIPTION ---
    const getDeepgramKey = async () => { try { const r = await fetch('/api/deepgram'); return (await r.json()).key; } catch (e) { console.error(e); } };
    const connectToDeepgram = async () => {
        const tempKey = await getDeepgramKey();
        if (!tempKey) return showNotification('Could not connect to transcription service.');
        deepgramSocket = new WebSocket(`wss://api.deepgram.com/v1/listen?punctuate=true&interim_results=false&model=nova-2&smart_format=true`, ['token', tempKey]);
        deepgramSocket.onopen = async () => {
            microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(microphone);
            mediaRecorder.addEventListener('dataavailable', e => { if (e.data.size > 0 && deepgramSocket.readyState === 1) deepgramSocket.send(e.data); });
            mediaRecorder.start(250); updateScribingUI(true);
        };
        deepgramSocket.onmessage = (msg) => {
            const transcript = JSON.parse(msg.data).channel.alternatives[0].transcript;
            if (transcript) el.noteTextarea.value += transcript + ' ';
        };
        deepgramSocket.onclose = () => { if (microphone) microphone.getTracks().forEach(t => t.stop()); updateScribingUI(false); };
    };
    const updateScribingUI = (isLive) => { isScribing = isLive; el.startScribingBtn.textContent = isLive ? 'Stop Scribing' : 'Start Scribing'; el.recordingDot.classList.toggle('recording', isLive); el.statusText.textContent = isLive ? 'Scribing...' : 'Ready'; };
    el.startScribingBtn.addEventListener('click', () => isScribing ? deepgramSocket.close() : connectToDeepgram());

    // --- AI REFINEMENT ---
    el.refineBtn.addEventListener('click', async () => {
        const text = el.noteTextarea.value; if (text.trim().length < 20) return showNotification("Not enough text to refine.");
        toggleLoader(true);
        const prompt = `You are an expert editor. Correct spelling and grammar, and improve formatting for clarity in the following text. Do not change the original meaning or add new content. Text:\n\n---\n\n${text}`;
        try {
            const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
            if (!response.ok) throw new Error("AI refinement failed.");
            const data = await response.json();
            el.noteTextarea.value = data.text;
            showNotification("Note refined by AI!");
            await saveNote();
        } catch (error) { console.error("Refinement error:", error); showNotification("Error refining text."); } 
        finally { toggleLoader(false); }
    });
});
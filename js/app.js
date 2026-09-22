const CHAT_PASSWORD = (window.CHAT_CONFIG && window.CHAT_CONFIG.CHAT_PASSWORD) || '';
const loginOverlay = document.getElementById('loginOverlay');
const loginName = document.getElementById('loginName');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const notifBtn = document.getElementById('notifBtn');
const chatNotifBtn = document.getElementById('chatNotifBtn');
const chatContainer = document.getElementById('chatContainer');
const chatBody = document.getElementById('chatBody');
const chatTextInput = document.getElementById('chatTextInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const attachBtn = document.getElementById('attachBtn');
const attachOptions = document.getElementById('attachOptions');
const fileBtn = document.getElementById('fileBtn');
const micBtn = document.getElementById('micBtn');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const filePreviewName = document.getElementById('filePreviewName');
const filePreviewRemove = document.getElementById('filePreviewRemove');
const recBar = document.getElementById('recBar');
const recTimer = document.getElementById('recTimer');
const recCancel = document.getElementById('recCancel');
const recSend = document.getElementById('recSend');
const themeBtnCard = document.getElementById('themeBtnCard');
const themeBtnChat = document.getElementById('themeBtnChat');

let CURRENT_SENDER = '';
let pendingFile = null;
let mediaRecorder = null;
let recordedChunks = [];
let recInterval = null;
let recStartTime = 0;
let pollTimer = null;

/* ===== THEME ===== */
const SUN_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/></svg>';
const MOON_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  const icon = dark ? SUN_SVG : MOON_SVG;
  if (themeBtnCard) themeBtnCard.innerHTML = icon;
  if (themeBtnChat) themeBtnChat.innerHTML = icon;
  try { localStorage.setItem('chat_theme', dark ? 'dark' : 'light'); } catch(e) {}
}
const savedTheme = (function() { try { return localStorage.getItem('chat_theme'); } catch(e) { return null; } })();
applyTheme(savedTheme === 'dark');
function toggleTheme() {
  applyTheme(!document.documentElement.classList.contains('dark'));
}
if (themeBtnCard) themeBtnCard.addEventListener('click', toggleTheme);
if (themeBtnChat) themeBtnChat.addEventListener('click', toggleTheme);

/* ===== NOTIFICATIONS ===== */
function notifSupported() {
  return 'Notification' in window;
}

function notifGranted() {
  return notifSupported() && Notification.permission === 'granted';
}

function updateNotifButtons() {
  const granted = notifGranted();
  if (notifBtn) notifBtn.style.display = granted ? 'none' : 'inline-flex';
  if (chatNotifBtn) chatNotifBtn.style.display = granted ? 'none' : 'inline-flex';
}

async function getReg() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    return null;
  }
}

async function fireNotification(title, body) {
  const options = {
    body: body,
    tag: 'chat-message',
    renotify: true
  };

  const reg = await getReg();
  if (reg && reg.showNotification) {
    try {
      await reg.showNotification(title, options);
      return;
    } catch (e) {}
  }
  try {
    new Notification(title, options);
  } catch (e) {}
}

async function requestNotif() {
  if (!notifSupported()) {
    alert('المتصفح ده مش بيدعم التنبيهات.');
    return;
  }
  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm === 'granted') {
    updateNotifButtons();
    fireNotification('✓ التنبيهات مفعّلة', 'هيصلك إشعار مع كل رسالة جديدة');
  } else {
    alert('التنبيهات مرفوضة. افتح إعدادات الموقع (الأيقونة جنب الشريط) واسمح بالتنبيهات.');
    updateNotifButtons();
  }
}

if (notifBtn) notifBtn.addEventListener('click', requestNotif);
if (chatNotifBtn) chatNotifBtn.addEventListener('click', requestNotif);
getReg();
updateNotifButtons();

/* ===== LOGIN ===== */
loginBtn.addEventListener('click', doLogin);
loginPassword.addEventListener('keypress', (e) => { if (e.key === 'Enter') doLogin(); });
loginName.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginPassword.focus(); });

function doLogin() {
  const name = loginName.value.trim();
  const pass = loginPassword.value.trim();

  if (!name) { loginError.textContent = 'ادخل اسمك الأول'; return; }
  if (!pass) { loginError.textContent = 'ادخل كلمة السر'; return; }

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span>جاري التحقق...</span><i class="fas fa-spinner fa-spin"></i>';

  if (pass === CHAT_PASSWORD) {
    CURRENT_SENDER = name;
    showChat();
  } else {
    loginError.textContent = 'كلمة السر غلط، جرب تاني';
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<span>ادخل</span><i class="fas fa-arrow-right-to-bracket"></i>';
  }
}

function showChat() {
  loginOverlay.classList.add('hidden');
  chatContainer.style.display = 'flex';
  updateNotifButtons();
  applyJohnTheme();
  showSkeleton();
  lastNotifCount = -1;
  fetchMessages();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(fetchMessages, 2500);
}

function logoutChat() {
  CURRENT_SENDER = '';
  try { localStorage.removeItem('chat_sender'); } catch(e) {}
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  lastNotifCount = -1;
  lastMessagesJson = '';
  chatContainer.classList.remove('john-theme');
  chatBody.innerHTML = '';
  if (recBar) recBar.classList.remove('active');
  if (filePreview) filePreview.classList.remove('active');
  chatTextInput.value = '';
  chatContainer.style.display = 'none';
  loginPassword.value = '';
  loginName.value = '';
  loginError.textContent = '';
  loginBtn.disabled = false;
  loginBtn.innerHTML = '<span>ادخل</span><i class="fas fa-arrow-right-to-bracket"></i>';
  loginOverlay.classList.remove('hidden');
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', logoutChat);

function showSkeleton() {
  chatBody.innerHTML =
    '<div class="skeleton-msg other"><div class="sk-line w70"></div><div class="sk-line w40"></div></div>' +
    '<div class="skeleton-msg me"><div class="sk-line w90"></div><div class="sk-line w50"></div></div>' +
    '<div class="skeleton-msg other"><div class="sk-line w70"></div><div class="sk-line w50"></div><div class="sk-line w40"></div></div>' +
    '<div class="skeleton-msg me"><div class="sk-line w70"></div><div class="sk-line w40"></div></div>';
}

/* ===== TIME ===== */
function formatTime(ts) {
  const now = ts ? new Date(ts) : new Date();
  let h = now.getHours();
  const m = now.getMinutes();
  const ap = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return h + ':' + (m < 10 ? '0' + m : m) + ' ' + ap;
}

/* ===== SEND TEXT ===== */
function sendMessage() {
  const text = chatTextInput.value.trim();

  if (pendingFile) {
    sendWithFile(chatTextInput.value.trim());
    return;
  }
  if (!text) return;

  const time = formatTime();
  chatSendBtn.disabled = true;
  chatSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: CURRENT_SENDER, text, time })
  })
  .then(r => r.json())
  .then(() => {
    chatSendBtn.disabled = false;
    chatSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    chatTextInput.value = '';
    chatTextInput.focus();
    fetchMessages();
  })
  .catch(() => {
    chatSendBtn.disabled = false;
    chatSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    alert('حدث خطأ أثناء الإرسال.');
  });
}

/* ===== FILE UPLOAD ===== */
attachBtn.addEventListener('click', () => {
  attachOptions.classList.toggle('active');
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.attach-menu')) attachOptions.classList.remove('active');
});

fileBtn.addEventListener('click', () => {
  attachOptions.classList.remove('active');
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024) {
    alert('الحد الأقصى للملف 1 ميجا. الملف ده أكبر من كده.');
    fileInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingFile = {
      name: file.name,
      data: reader.result.split(',')[1],
      size: file.size
    };
    filePreviewName.textContent = file.name + ' (' + formatSize(file.size) + ')';
    filePreview.classList.add('active');
  };
  reader.readAsDataURL(file);
  chatTextInput.focus();
});

filePreviewRemove.addEventListener('click', () => {
  pendingFile = null;
  fileInput.value = '';
  filePreview.classList.remove('active');
});

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' بايت';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' كيلوبايت';
  return (bytes / (1024 * 1024)).toFixed(1) + ' ميجابايت';
}

function fileIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = {
    pdf: 'fa-file-pdf', doc: 'fa-file-word', docx: 'fa-file-word',
    xls: 'fa-file-excel', xlsx: 'fa-file-excel',
    ppt: 'fa-file-powerpoint', pptx: 'fa-file-powerpoint',
    zip: 'fa-file-zipper', rar: 'fa-file-zipper', tar: 'fa-file-zipper', gz: 'fa-file-zipper',
    mp3: 'fa-file-audio', wav: 'fa-file-audio', ogg: 'fa-file-audio', m4a: 'fa-file-audio',
    mp4: 'fa-file-video', mov: 'fa-file-video', avi: 'fa-file-video',
    txt: 'fa-file-lines', md: 'fa-file-lines',
    jpg: 'fa-file-image', jpeg: 'fa-file-image', png: 'fa-file-image',
    gif: 'fa-file-image', webp: 'fa-file-image', svg: 'fa-file-image',
    exe: 'fa-file'
  };
  return map[ext] || 'fa-file';
}

function sendWithFile(caption) {
  const time = formatTime();
  const ext = (pendingFile.name.split('.').pop() || '').toLowerCase();
  const imgTypes = ['jpg','jpeg','png','gif','webp','svg'];
  const audioTypes = ['mp3','wav','ogg','m4a'];
  const videoTypes = ['mp4','mov','avi','webm'];
  let msgType = 'file';
  if (imgTypes.includes(ext)) msgType = 'image';
  if (audioTypes.includes(ext)) msgType = 'audio';
  if (videoTypes.includes(ext)) msgType = 'video';

  chatSendBtn.disabled = true;
  chatSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: CURRENT_SENDER,
      text: caption,
      time,
      msg_type: msgType,
      file_data: pendingFile.data,
      file_name: pendingFile.name
    })
  })
  .then(r => r.json())
  .then(() => {
    chatSendBtn.disabled = false;
    chatSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    pendingFile = null;
    fileInput.value = '';
    filePreview.classList.remove('active');
    chatTextInput.value = '';
    chatTextInput.focus();
    fetchMessages();
  })
  .catch(() => {
    chatSendBtn.disabled = false;
    chatSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    alert('حدث خطأ أثناء إرسال الملف.');
  });
}

/* ===== VOICE RECORDING ===== */
micBtn.addEventListener('click', () => {
  attachOptions.classList.remove('active');
  startRecording();
});

let recAutoSend = false;

async function startRecording() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    alert('متصفحك مش بيدعم تسجيل الصوت.');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    recAutoSend = false;
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      if (blob.size < 1000) {
        stopRecordingUI();
        return;
      }
      if (recAutoSend) {
        const reader = new FileReader();
        reader.onload = () => {
          stopRecordingUI();
          sendVoiceNow(reader.result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      } else {
        stopRecordingUI();
      }
    };
    mediaRecorder.start();
    recStartTime = Date.now();
    recTimer.textContent = '0:00';
    recBar.classList.add('active');
    recInterval = setInterval(() => {
      const s = Math.floor((Date.now() - recStartTime) / 1000);
      recTimer.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }, 500);
  } catch (err) {
    alert('مش قادر نوصل للمايك. خلي بالك من صلاحيات المايك في المتصفح.');
  }
}

function stopRecordingUI() {
  if (recInterval) { clearInterval(recInterval); recInterval = null; }
  recBar.classList.remove('active');
}

recCancel.addEventListener('click', () => {
  recAutoSend = false;
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  else stopRecordingUI();
});

recSend.addEventListener('click', () => {
  recAutoSend = true;
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
});

function sendVoiceNow(base64Data) {
  const time = formatTime();
  chatSendBtn.disabled = true;
  chatSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: CURRENT_SENDER,
      text: '',
      time,
      msg_type: 'voice',
      file_data: base64Data,
      file_name: 'voice.webm'
    })
  })
  .then(r => r.json())
  .then(() => {
    chatSendBtn.disabled = false;
    chatSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    fetchMessages();
  })
  .catch(() => {
    chatSendBtn.disabled = false;
    chatSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    alert('حدث خطأ أثناء إرسال التسجيل.');
  });
}

chatSendBtn.addEventListener('click', sendMessage);
chatTextInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

/* ===== CLEAR CHAT ===== */
const clearChatBtn = document.getElementById('clearChatBtn');
function applyJohnTheme() {
  const isJohn = CURRENT_SENDER === 'جون';
  if (clearChatBtn) clearChatBtn.style.display = 'inline-flex';
  chatContainer.classList.toggle('john-theme', isJohn);
}
clearChatBtn.addEventListener('click', () => {
  if (!confirm('متأكد إنك عايز تمسح كل الرسايل؟ دي مش هترجع خالص.')) return;
  clearChatBtn.disabled = true;
  clearChatBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  fetch('/api/messages', { method: 'DELETE' })
    .then(r => r.json())
    .then(() => {
      lastMessagesJson = '';
      lastNotifCount = -1;
      fetchMessages();
      clearChatBtn.disabled = false;
      clearChatBtn.innerHTML = '<i class="fas fa-trash-can"></i>';
    })
    .catch(() => {
      alert('حصلت مشكلة في مسح الرسايل.');
      clearChatBtn.disabled = false;
      clearChatBtn.innerHTML = '<i class="fas fa-trash-can"></i>';
    });
});

/* ===== FETCH MESSAGES ===== */
let lastMessagesJson = '';
let lastNotifCount = -1;

function shouldNotify() {
  return notifGranted() && (document.hidden || !document.hasFocus());
}

function messageBody(msg) {
  switch (msg.msg_type) {
    case 'voice': return '🎤 تسجيل صوتي';
    case 'file': return '📎 ملف: ' + (msg.file_name || '');
    case 'image': return '🖼️ صورة';
    case 'audio': return '🎵 ملف صوتي';
    case 'video': return '🎬 فيديو';
    default: return msg.text || 'رسالة جديدة';
  }
}

function fetchMessages() {
  fetch('/api/messages')
    .then(r => r.json())
    .then(messages => {
      if (!Array.isArray(messages)) messages = [];

      messages.forEach(msg => {
        if (CURRENT_SENDER && msg.sender !== CURRENT_SENDER && (!msg.seen_by || !msg.seen_by.includes(CURRENT_SENDER))) {
          markAsSeen(msg.id, CURRENT_SENDER);
        }
      });

      if (lastNotifCount !== -1 && messages.length > lastNotifCount && CURRENT_SENDER) {
        const unseen = messages.slice(lastNotifCount).filter(m => m.sender !== CURRENT_SENDER);
        if (unseen.length > 0 && shouldNotify()) {
          const latest = unseen[unseen.length - 1];
          const title = unseen.length > 1
            ? unseen.length + ' رسائل جديدة من ' + latest.sender
            : 'رسالة جديدة من ' + latest.sender;
          fireNotification(title, messageBody(latest));
        }
      }
      lastNotifCount = messages.length;

      const jsonStr = JSON.stringify(messages);
      if (jsonStr === lastMessagesJson) return;
      lastMessagesJson = jsonStr;

      chatBody.innerHTML = '';
      if (messages.length === 0) {
        chatBody.innerHTML = '<div class="chat-empty"><i class="fas fa-comment-dots"></i>مفيش رسائل لسه، ابدأ الكلام!</div>';
        return;
      }

      messages.forEach(msg => {
        const div = document.createElement('div');
        const isMe = msg.sender === CURRENT_SENDER;
        const senderName = (msg.sender || '').trim();
        let colorClass = '';
        if (isMe && senderName === 'جون') colorClass = ' john';
        else if (isMe && senderName === 'جودي') colorClass = ' joody';
        div.className = 'chat-message ' + (isMe ? 'me' : 'other') + colorClass;

        let bodyHtml = '';
        const type = msg.msg_type || 'text';

        if (type === 'voice') {
          bodyHtml = '<div class="msg-attachment" style="background:transparent;padding:0;"><div class="voice-player" data-src="data:audio/webm;base64,' + msg.file_data + '"><button class="voice-play-btn"><i class="fas fa-play"></i></button><div class="voice-waveform"></div><span class="voice-duration">0:00</span><audio preload="metadata" src="data:audio/webm;base64,' + msg.file_data + '"></audio></div></div>' + (msg.text ? '<div>' + esc(msg.text) + '</div>' : '');
        } else if (type === 'image') {
          bodyHtml = '<div class="msg-attachment"><img src="data:image/*;base64,' + msg.file_data + '" alt="صورة" onclick="window.open(this.src)"></div>' + (msg.text ? '<div>' + esc(msg.text) + '</div>' : '');
        } else if (type === 'audio') {
          const mime = msg.file_name && msg.file_name.toLowerCase().endsWith('.mp3') ? 'audio/mp3' : 'audio/mpeg';
          bodyHtml = '<div class="msg-attachment"><audio controls preload="metadata" src="data:' + mime + ';base64,' + msg.file_data + '"></audio></div>' + (msg.text ? '<div>' + esc(msg.text) + '</div>' : '');
        } else if (type === 'video') {
          bodyHtml = '<div class="msg-attachment"><video controls preload="metadata" src="data:video/mp4;base64,' + msg.file_data + '"></video></div>' + (msg.text ? '<div>' + esc(msg.text) + '</div>' : '');
        } else if (type === 'file') {
          const downloadUrl = 'data:application/octet-stream;base64,' + msg.file_data;
          bodyHtml = '<div class="msg-attachment"><a class="msg-file-link" href="' + downloadUrl + '" download="' + esc(msg.file_name || 'file') + '">' +
            '<i class="fas ' + fileIcon(msg.file_name || '') + ' file-icon"></i>' +
            '<div><span class="file-name">' + esc(msg.file_name || 'ملف') + '</span>' +
            '<span class="file-info">اضغط للتحميل</span></div>' +
            '<i class="fas fa-download"></i></a></div>' + (msg.text ? '<div>' + esc(msg.text) + '</div>' : '');
        } else {
          bodyHtml = '<div>' + esc(msg.text || '') + '</div>';
        }

        let seenHtml = '';
        if (isMe && msg.seen_by) {
          seenHtml = '<div class="chat-msg-footer"><span class="seen-badge" onclick="showSeenInfo(\'' + esc(msg.seen_by) + '\')"><i class="fas fa-eye"></i> ' + esc(msg.seen_by) + '</span></div>';
        }

        div.innerHTML =
          '<div class="chat-msg-info"><span><b>' + esc(msg.sender) + '</b></span><span>' + esc(msg.time || '') + '</span></div>' +
          bodyHtml +
          seenHtml;
        chatBody.appendChild(div);
      });
      chatBody.scrollTop = chatBody.scrollHeight;
      initVoicePlayers();
    })
    .catch(() => {});
}

/* ===== WHATSAPP-STYLE VOICE PLAYER ===== */
function initVoicePlayers() {
  document.querySelectorAll('.voice-player').forEach(player => {
    if (player.dataset.init) return;
    player.dataset.init = '1';
    const audio = player.querySelector('audio');
    const btn = player.querySelector('.voice-play-btn');
    const waveform = player.querySelector('.voice-waveform');
    const durationEl = player.querySelector('.voice-duration');

    // Generate fake waveform bars
    const barCount = 30;
    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = (20 + Math.random() * 80) + '%';
      waveform.appendChild(bar);
    }

    audio.addEventListener('loadedmetadata', () => {
      durationEl.textContent = fmtDur(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      const pct = audio.currentTime / (audio.duration || 1);
      const bars = waveform.querySelectorAll('.bar');
      bars.forEach((b, i) => b.classList.toggle('played', i / barCount <= pct));
      durationEl.textContent = fmtDur(audio.duration - audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      btn.innerHTML = '<i class="fas fa-play"></i>';
      btn.classList.remove('playing');
      waveform.querySelectorAll('.bar').forEach(b => b.classList.remove('played'));
    });

    btn.addEventListener('click', () => {
      if (audio.paused) {
        document.querySelectorAll('.voice-player audio').forEach(a => a.pause());
        audio.play();
        btn.innerHTML = '<i class="fas fa-pause"></i>';
        btn.classList.add('playing');
      } else {
        audio.pause();
        btn.innerHTML = '<i class="fas fa-play"></i>';
        btn.classList.remove('playing');
      }
    });
  });
}

function fmtDur(sec) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function markAsSeen(msgId, readerName) {
  fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'seen', id: msgId, seen_by: readerName })
  }).catch(() => {});
}

function showSeenInfo(seenBy) {
  alert('👁️ تمت رؤية هذه الرسالة بواسطة: ' + seenBy);
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

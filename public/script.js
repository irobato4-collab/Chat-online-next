/* =============================
   DOM
============================= */
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const notifyBtn = document.getElementById('notify');
const settingsBtn = document.getElementById('settings');

const modal = document.getElementById('userModal');
const nameInput = document.getElementById('userName');
const iconFileInput = document.getElementById('userIconFile');
const preview = document.getElementById('iconPreview');
const saveBtn = document.getElementById('saveUser');

/* =============================
   定数
============================= */
const USER_KEY = 'chatUser';
const NOTIFY_KEY = 'notifyEnabled';

/* =============================
   ユーザー初期化
============================= */
let me = null;
let iconData = null;

try {
  me = JSON.parse(localStorage.getItem(USER_KEY));
} catch {}

if (!me) {
  me = { userId: crypto.randomUUID(), name: '', icon: null };
  localStorage.setItem(USER_KEY, JSON.stringify(me));
  openModal(true);
}

/* =============================
   アクティブ状態をサーバーへ通知
============================= */
function sendActive(active) {
  if (!me?.userId) return;
  fetch('/active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: me.userId, active })
  }).catch(() => {});
}

window.addEventListener('focus', () => sendActive(true));
window.addEventListener('blur', () => sendActive(false));
document.addEventListener('visibilitychange', () => {
  sendActive(!document.hidden);
});

// 初期はアクティブ
sendActive(true);

/* =============================
   モーダル
============================= */
function openModal(force = false) {
  modal.classList.remove('hidden');
  nameInput.value = me.name || '';
  iconData = me.icon || null;
  preview.innerHTML = iconData
    ? `<img src="${iconData}" class="avatar">`
    : '';
}

saveBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) return alert('名前必須');
  if (!iconData) return alert('アイコン必須');

  me.name = name;
  me.icon = iconData;
  localStorage.setItem(USER_KEY, JSON.stringify(me));
  modal.classList.add('hidden');
  loadMessages();
};

settingsBtn.onclick = () => openModal(false);

iconFileInput.onchange = () => {
  const file = iconFileInput.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return alert('画像のみ');

  const reader = new FileReader();
  reader.onload = () => {
    iconData = reader.result;
    preview.innerHTML = `<img src="${iconData}" class="avatar">`;
  };
  reader.readAsDataURL(file);
};

/* =============================
   入力制御
============================= */
input.oninput = () => {
  sendBtn.disabled = !input.value.trim();
};

/* =============================
   メッセージ送信（表示最優先）
============================= */
sendBtn.onclick = async () => {
  if (!me.name || !me.icon) return openModal(true);

  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  sendBtn.disabled = true;

  try {
    // 保存 → サーバー即レスポンス
    await fetch('/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...me, text })
    });

    // 表示を最優先
    await loadMessages();
  } catch (e) {
    console.error(e);
    alert('送信失敗');
  }
};

/* =============================
   メッセージ描画
============================= */
async function loadMessages() {
  try {
    const res = await fetch('/messages', { cache: 'no-store' });
    const msgs = await res.json();
    chat.innerHTML = '';

    msgs.forEach(m => {
      const isMe = me && m.userId === me.userId;

      const wrap = document.createElement('div');
      wrap.className = 'bubble-wrap ' + (isMe ? 'me' : 'other');

      const nameDiv = document.createElement('div');
      nameDiv.className = 'name';
      nameDiv.textContent = m.name;

      const container = document.createElement('div');
      container.className = 'bubble-container';

      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = m.text;

      const icon = document.createElement('img');
      icon.className = 'avatar';
      icon.src = m.icon;

      if (isMe) {
        container.appendChild(bubble);
        container.appendChild(icon);
      } else {
        container.appendChild(icon);
        container.appendChild(bubble);
      }

      const timeDiv = document.createElement('div');
      timeDiv.className = 'time';
      timeDiv.textContent = new Date(m.time).toLocaleTimeString();

      wrap.appendChild(nameDiv);
      wrap.appendChild(container);
      wrap.appendChild(timeDiv);

      chat.appendChild(wrap);
    });

    chat.scrollTop = chat.scrollHeight;
  } catch (e) {
    console.error(e);
  }
}

/* =============================
   🔔 通知 ON / OFF
============================= */
async function enableNotify() {
  const key = await fetch('/vapid-public-key').then(r => r.text());
  const reg = await navigator.serviceWorker.register('/sw.js');

  await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key
  });

  localStorage.setItem(NOTIFY_KEY, '1');
  notifyBtn.classList.add('on');
}

async function disableNotify() {
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) {
    const sub = await r.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  }

  localStorage.removeItem(NOTIFY_KEY);
  notifyBtn.classList.remove('on');
}

notifyBtn.onclick = async () => {
  try {
    if (localStorage.getItem(NOTIFY_KEY)) {
      await disableNotify();
    } else {
      await enableNotify();
    }
  } catch (e) {
    console.error(e);
    alert('通知設定失敗');
  }
};

/* =============================
   初期化
============================= */
if (localStorage.getItem(NOTIFY_KEY)) {
  notifyBtn.classList.add('on');
}

loadMessages();
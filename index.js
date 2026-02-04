const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static('public'));

/* =====================
   ファイル
===================== */
const MSG_FILE = './messages.json';
const SUB_FILE = './subscriptions.json';
const VAPID_FILE = './vapid.json';
const ACTIVE_FILE = './active.json';

/* =====================
   VAPID
===================== */
let vapid;
if (fs.existsSync(VAPID_FILE)) {
  vapid = JSON.parse(fs.readFileSync(VAPID_FILE));
} else {
  vapid = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapid, null, 2));
}

webpush.setVapidDetails(
  'mailto:test@example.com',
  vapid.publicKey,
  vapid.privateKey
);

/* =====================
   JSON Utility
===================== */
const loadJSON = (file, def) => {
  if (!fs.existsSync(file)) return def;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('loadJSON error', e);
    return def;
  }
};

const saveJSON = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('saveJSON error', e);
  }
};

/* =====================
   ACTIVE 管理
===================== */
const loadActive = () => loadJSON(ACTIVE_FILE, {});
const saveActive = (data) => saveJSON(ACTIVE_FILE, data);

app.post('/active', (req, res) => {
  const { userId, active } = req.body;
  if (!userId) return res.json({ ok: false });

  const actives = loadActive();

  if (active) {
    actives[userId] = Date.now();
  } else {
    delete actives[userId];
  }

  saveActive(actives);
  res.json({ ok: true });
});

/* =====================
   API
===================== */
app.get('/vapid-public-key', (_, res) => {
  res.send(vapid.publicKey);
});

app.post('/subscribe', (req, res) => {
  const subs = loadJSON(SUB_FILE, []);
  subs.push(req.body);
  saveJSON(SUB_FILE, subs);
  res.json({ ok: true });
});

app.get('/messages', (_, res) => {
  res.json(loadJSON(MSG_FILE, []));
});

/* =====================
   メッセージ送信
===================== */
app.post('/message', async (req, res) => {
  const { text, userId, name, icon } = req.body;
  if (!text || !userId || !name || !icon) {
    return res.status(400).json({ error: 'invalid payload' });
  }

  /* 保存（最優先） */
  const msgs = loadJSON(MSG_FILE, []);
  const msg = {
    id: crypto.randomUUID(),
    userId,
    name,
    icon,
    text,
    time: Date.now()
  };
  msgs.push(msg);

  try {
    saveJSON(MSG_FILE, msgs);
  } catch {
    return res.status(500).json({ error: 'save failed' });
  }

  res.json(msg); // ← 表示を最優先で返す

  /* =====================
     Push（非アクティブ時のみ）
  ===================== */
  const actives = loadActive();
  if (Object.keys(actives).length > 0) return;

  const payload = JSON.stringify({
    title: name,
    body: text
  });

  const subs = loadJSON(SUB_FILE, []);
  const alive = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
      alive.push(sub);
    } catch (e) {
      if (e.statusCode !== 404 && e.statusCode !== 410) {
        alive.push(sub);
      }
    }
  }

  saveJSON(SUB_FILE, alive);
});

/* =====================
   起動
===================== */
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
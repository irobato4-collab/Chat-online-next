import fetch from 'node-fetch'
import CryptoJS from 'crypto-js'

const {
  GITHUB_TOKEN,
  GITHUB_REPO,
  GITHUB_BRANCH = 'main',
  GITHUB_DATA_PATH = 'data',
  ENCRYPT_SECRET
} = process.env

if (!GITHUB_TOKEN || !GITHUB_REPO || !ENCRYPT_SECRET) {
  throw new Error('Missing required environment variables')
}

const API_BASE = 'https://api.github.com'

function encrypt(data) {
  return CryptoJS.AES.encrypt(
    JSON.stringify(data),
    ENCRYPT_SECRET
  ).toString()
}

function decrypt(cipher) {
  const bytes = CryptoJS.AES.decrypt(cipher, ENCRYPT_SECRET)
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
}

async function getFile(path) {
  const res = await fetch(
    `${API_BASE}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'encrypted-chat'
      }
    }
  )

  if (res.status === 404) return null
  if (!res.ok) throw new Error(await res.text())

  return await res.json()
}

async function saveFile(path, content) {
  const existing = await getFile(path)

  const body = {
    message: 'encrypted chat save',
    content: Buffer.from(content).toString('base64'),
    branch: GITHUB_BRANCH
  }

  if (existing?.sha) body.sha = existing.sha

  const res = await fetch(
    `${API_BASE}/repos/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'encrypted-chat',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  )

  if (!res.ok) throw new Error(await res.text())
}

async function loadMessages(index = 0) {
  const file = `${GITHUB_DATA_PATH}/messages_${String(index).padStart(4, '0')}.json.enc`
  const data = await getFile(file)
  if (!data) return []
  return decrypt(Buffer.from(data.content, 'base64').toString())
}

async function saveMessages(index, messages) {
  const file = `${GITHUB_DATA_PATH}/messages_${String(index).padStart(4, '0')}.json.enc`
  const encrypted = encrypt(messages)
  await saveFile(file, encrypted)
}

export default {
  loadMessages,
  saveMessages
}

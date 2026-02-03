
const socket = io('https://YOUR-BACKEND.onrender.com')
const send = document.getElementById('send')
const text = document.getElementById('text')
const messages = document.getElementById('messages')

send.onclick = () => {
  if(!text.value) return
  socket.emit('message', { text: text.value, at: Date.now() })
  text.value = ''
}

socket.on('message', m => {
  const d = document.createElement('div')
  d.textContent = m.text
  messages.appendChild(d)
})


import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import storage from './storage/github.js'

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

app.use(cors())
app.use(express.json())

io.on('connection', socket => {
  io.emit('online', io.engine.clientsCount)

  socket.on('message', async msg => {
    io.emit('message', msg)
    const data = await storage.load()
    data.push(msg)
    await storage.save(data)
  })

  socket.on('disconnect', () => {
    io.emit('online', io.engine.clientsCount)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => console.log('Backend running on', PORT))

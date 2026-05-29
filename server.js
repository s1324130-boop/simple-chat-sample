const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const MAX_MESSAGE_LENGTH = 200;
const MAX_USERNAME_LENGTH = 20;

app.use(express.static('public'));

function getDefaultUsername(clientId) {
  return `ユーザ${String(clientId).substring(0, 6)}`;
}

function normalizeUsername(username, fallback) {
  if (typeof username !== 'string') {
    return fallback;
  }

  const trimmedUsername = username.trim();
  if (!trimmedUsername) {
    return fallback;
  }

  return trimmedUsername.substring(0, MAX_USERNAME_LENGTH);
}

io.on('connection', (socket) => {
  // Chat functionality (for index.html)
  socket.on('user connected', (user) => {
    const clientId = typeof user === 'string' ? user : user?.id;
    socket.clientId = typeof clientId === 'string' && clientId ? clientId : socket.id;
    socket.username = normalizeUsername(user?.username, getDefaultUsername(socket.clientId));

    console.log(`${socket.username} (${socket.clientId}) connected`);
    socket.emit('welcome', { id: socket.clientId, username: socket.username });
    socket.broadcast.emit('user joined', { id: socket.clientId, username: socket.username });
  });

  socket.on('username changed', (username) => {
    if (!socket.clientId) {
      return;
    }

    const oldUsername = socket.username || getDefaultUsername(socket.clientId);
    const newUsername = normalizeUsername(username, oldUsername);
    if (newUsername === oldUsername) {
      return;
    }

    socket.username = newUsername;
    io.emit('username changed', {
      id: socket.clientId,
      oldUsername,
      username: newUsername,
    });
  });

  socket.on('chat message', (msg) => {
    if (!msg || typeof msg.msg !== 'string') {
      return;
    }

    const messageText = msg.msg.trim();
    if (!messageText || messageText.length > MAX_MESSAGE_LENGTH) {
      return;
    }

    io.emit('chat message', {
      ...msg,
      id: socket.clientId || msg.id,
      username: socket.username || getDefaultUsername(socket.clientId || msg.id),
      msg: messageText,
      sentAt: new Date().toISOString(),
    });
  });
  
  // Room functionality (for sensor apps)
  socket.on('join', (room) => {
    socket.join(room);
    console.log(`Client joined room: ${room}`);
  });
  
  // Sensor data handling
  socket.on('sensor', (data) => {
    // センサーデータを'game'ルームにいる他のクライアントに送信する
    socket.to('game').emit('sensor', data);
  });

  socket.on('disconnect', () => {
    if (socket.clientId) {
      console.log(`${socket.username} (${socket.clientId}) disconnected`);
      io.emit('user left', { id: socket.clientId, username: socket.username });
    } else {
      console.log('Client disconnected');
    }
  });
});

server.listen(8080, () => {
  console.log('listening on *:8080');
});

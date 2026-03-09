const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const cases = require('./data/cases.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 8080;
const rooms = new Map();

const ROLES = {
  investigador: 'Investigador de Campo',
  analista: 'Analista Forense'
};

app.use(express.static(path.join(__dirname, 'public')));

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

function createRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function sanitize(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function getPhase(room) {
  return cases[room.caseIndex].fases[room.phaseIndex];
}

function isCorrectAnswer(input, expected) {
  const normalizedInput = sanitize(input);
  const options = Array.isArray(expected) ? expected : [expected];
  return options.some((option) => sanitize(option) === normalizedInput);
}

function getBaseState(room) {
  const caseData = cases[room.caseIndex];
  const phase = caseData.fases[room.phaseIndex];

  return {
    code: room.code,
    players: room.players.map((p) => ({ name: p.name, roleLabel: ROLES[p.role] })),
    gameStarted: room.gameStarted,
    caseTitle: caseData.titulo,
    caseDescription: caseData.descricao,
    caseIndex: room.caseIndex,
    caseCount: cases.length,
    phaseIndex: room.phaseIndex,
    phaseCount: caseData.fases.length,
    phaseTitle: phase.titulo,
    riddle: phase.enigma,
    score: room.score,
    finished: room.finished,
    winnerMessage: room.finished ? `Parabéns! Pontuação final: ${room.score}` : ''
  };
}

function emitState(room) {
  const phase = getPhase(room);
  for (const player of room.players) {
    io.to(player.id).emit('state:update', {
      ...getBaseState(room),
      myRole: ROLES[player.role],
      myClue: phase.pistasPorPapel[player.role] || 'Sem pista para seu papel nesta fase.',
      partnerRole: ROLES[player.role === 'investigador' ? 'analista' : 'investigador']
    });
  }
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ playerName }, cb) => {
    let code = createRoomCode();
    while (rooms.has(code)) code = createRoomCode();

    const room = {
      code,
      players: [{ id: socket.id, name: playerName || 'Jogador 1', role: 'investigador' }],
      gameStarted: false,
      caseIndex: 0,
      phaseIndex: 0,
      score: 100,
      finished: false
    };

    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    emitState(room);
    cb({ ok: true });
  });

  socket.on('room:join', ({ code, playerName }, cb) => {
    const room = rooms.get((code || '').toUpperCase());
    if (!room) return cb({ ok: false, message: 'Sala não encontrada.' });
    if (room.players.length >= 2) return cb({ ok: false, message: 'Sala já está cheia.' });

    room.players.push({ id: socket.id, name: playerName || 'Jogador 2', role: 'analista' });
    socket.join(room.code);
    socket.data.roomCode = room.code;

    emitState(room);
    io.to(room.code).emit('game:message', 'Dupla formada! Cada um tem um papel e uma pista exclusiva.');
    return cb({ ok: true });
  });

  socket.on('game:start', (_data, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ ok: false, message: 'Sala inválida.' });
    if (room.players.length < 2) return cb?.({ ok: false, message: 'Aguardando o segundo jogador.' });

    room.gameStarted = true;
    emitState(room);
    io.to(room.code).emit('game:message', 'Jogo iniciado! Compartilhem suas pistas para resolver as charadas.');
    cb?.({ ok: true });
  });

  socket.on('game:hint', (_data, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ ok: false, message: 'Sala inválida.' });

    const phase = getPhase(room);
    room.hintsUsed = room.hintsUsed || 0;
    const nextHint = phase.dicas[room.hintsUsed] || 'Sem mais dicas nesta fase.';
    room.hintsUsed += 1;
    room.score = Math.max(0, room.score - 5);

    io.to(room.code).emit('game:message', `Dica compartilhada: ${nextHint}`);
    emitState(room);
    cb?.({ ok: true, hint: nextHint });
  });

  socket.on('game:answer', ({ answer }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ ok: false, message: 'Sala inválida.' });

    const phase = getPhase(room);
    if (isCorrectAnswer(answer, phase.resposta)) {
      room.score = Math.min(100, room.score + 10);

      if (room.phaseIndex + 1 < cases[room.caseIndex].fases.length) {
        room.phaseIndex += 1;
        room.hintsUsed = 0;
        io.to(room.code).emit('game:message', 'Resposta correta! Próxima fase liberada.');
      } else if (room.caseIndex + 1 < cases.length) {
        room.caseIndex += 1;
        room.phaseIndex = 0;
        room.hintsUsed = 0;
        io.to(room.code).emit('game:message', 'Caso concluído! Novo crime desbloqueado.');
      } else {
        room.finished = true;
        io.to(room.code).emit('game:message', 'Parabéns! Vocês resolveram os 2 crimes em dupla.');
      }

      emitState(room);
      cb?.({ ok: true, correct: true });
    } else {
      room.score = Math.max(0, room.score - 10);
      io.to(room.code).emit('game:message', 'Resposta incorreta. Conversem e comparem as pistas dos dois papéis.');
      emitState(room);
      cb?.({ ok: true, correct: false });
    }
  });

  socket.on('disconnect', () => {
    const { roomCode } = socket.data;
    if (!roomCode || !rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);
    room.players = room.players.filter((p) => p.id !== socket.id);

    if (room.players.length === 0) {
      rooms.delete(roomCode);
      return;
    }

    io.to(roomCode).emit('game:message', 'Seu parceiro desconectou. Aguardando retorno ou nova dupla.');
    emitState(room);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor iniciado em http://${getLocalIp()}:${PORT}`);
});

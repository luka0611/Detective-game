const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const cases = require('./data/cases.json');

const ROLE_ORDER = ['reconstituista', 'analista'];
const ROLE_DETAILS = {
  reconstituista: {
    id: 'reconstituista',
    nome: 'Reconstituidor de Cena',
    descricao: 'Especialista em cronologia. Você conecta horários, movimentos e oportunidades.'
  },
  analista: {
    id: 'analista',
    nome: 'Analista Forense',
    descricao: 'Especialista em vestígios. Você interpreta provas físicas e padrões ocultos.'
  }
};

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 8080;
const rooms = new Map();

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
  return String(text || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getRoleDetails(roleId) {
  return ROLE_DETAILS[roleId] || ROLE_DETAILS.reconstituista;
}

function getPublicState(room, playerId) {
  const caseData = cases[room.caseIndex];
  const phase = caseData.fases[room.phaseIndex];
  const player = room.players.find((p) => p.id === playerId) || room.players[0];
  const teammate = room.players.find((p) => p.id !== player?.id);

  const myRole = player ? getRoleDetails(player.roleId) : null;
  const teammateRole = teammate ? getRoleDetails(teammate.roleId) : null;

  return {
    code: room.code,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      role: getRoleDetails(p.roleId)
    })),
    gameStarted: room.gameStarted,
    caseTitle: caseData.titulo,
    caseDescription: caseData.descricao,
    caseIndex: room.caseIndex,
    caseCount: cases.length,
    phaseIndex: room.phaseIndex,
    phaseCount: caseData.fases.length,
    phaseTitle: phase.titulo,
    riddle: phase.enigma,
    roleObjective: phase.objetivo,
    roleClue: myRole ? phase.pistasPorPapel?.[myRole.id] || 'Compartilhe suas ideias com seu parceiro.' : '',
    teammateRoleName: teammateRole?.nome || 'Aguardando parceiro',
    myRole,
    hintsUsed: room.hintsUsed,
    score: room.score,
    finished: room.finished,
    winnerMessage: room.finished ? `Caso resolvido! Pontuação final: ${room.score}` : ''
  };
}

function emitRoomState(room) {
  for (const player of room.players) {
    io.to(player.id).emit('state:update', getPublicState(room, player.id));
  }
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ playerName }, cb) => {
    let code = createRoomCode();
    while (rooms.has(code)) code = createRoomCode();

    const room = {
      code,
      players: [{ id: socket.id, name: playerName || 'Jogador 1', roleId: ROLE_ORDER[0] }],
      gameStarted: false,
      caseIndex: 0,
      phaseIndex: 0,
      hintsUsed: 0,
      score: 100,
      finished: false
    };

    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    cb({ ok: true, state: getPublicState(room, socket.id) });
  });

  socket.on('room:join', ({ code, playerName }, cb) => {
    const room = rooms.get((code || '').toUpperCase());
    if (!room) return cb({ ok: false, message: 'Sala não encontrada.' });
    if (room.players.length >= 2) return cb({ ok: false, message: 'Sala já está cheia.' });

    room.players.push({ id: socket.id, name: playerName || 'Jogador 2', roleId: ROLE_ORDER[1] });
    socket.join(room.code);
    socket.data.roomCode = room.code;

    emitRoomState(room);
    return cb({ ok: true, state: getPublicState(room, socket.id) });
  });

  socket.on('game:start', (_data, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ ok: false, message: 'Sala inválida.' });
    room.gameStarted = true;
    emitRoomState(room);
    cb?.({ ok: true });
  });

  socket.on('game:hint', (_data, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ ok: false, message: 'Sala inválida.' });
    const phase = cases[room.caseIndex].fases[room.phaseIndex];
    const nextHint = phase.dicas[room.hintsUsed] || 'Sem mais dicas nesta fase.';
    room.hintsUsed += 1;
    room.score = Math.max(0, room.score - 5);
    const requester = room.players.find((p) => p.id === socket.id)?.name || 'Um jogador';
    io.to(room.code).emit('game:message', `${requester} pediu dica: ${nextHint}`);
    emitRoomState(room);
    cb?.({ ok: true, hint: nextHint });
  });

  socket.on('game:answer', ({ answer }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ ok: false, message: 'Sala inválida.' });

    const phase = cases[room.caseIndex].fases[room.phaseIndex];
    if (sanitize(answer) === sanitize(phase.resposta)) {
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
        io.to(room.code).emit('game:message', 'Parabéns! Vocês resolveram os 2 crimes.');
      }
      emitRoomState(room);
      cb?.({ ok: true, correct: true });
    } else {
      room.score = Math.max(0, room.score - 10);
      io.to(room.code).emit('game:message', 'Resposta incorreta. Tentem novamente.');
      emitRoomState(room);
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
    } else {
      emitRoomState(room);
      io.to(roomCode).emit('game:message', 'Um jogador desconectou.');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor iniciado em http://${getLocalIp()}:${PORT}`);
});

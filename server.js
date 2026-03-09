const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const cases = require('./data/cases/index.js');

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
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;

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

function createPlayer({ socketId, playerName, roleId, sessionId }) {
  return {
    socketId,
    sessionId: sessionId || crypto.randomUUID(),
    name: playerName || 'Jogador',
    roleId,
    connected: true,
    lastSeenAt: Date.now()
  };
}

function getPlayerBySession(room, playerSessionId) {
  return room.players.find((p) => p.sessionId === playerSessionId) || null;
}

function sanitize(text) {
  return String(text || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getRoleDetails(roleId) {
  return ROLE_DETAILS[roleId] || ROLE_DETAILS.reconstituista;
}

function getSelectedCaseId(room, playerId) {
  return room.selectedCases[playerId] || null;
}

function getCaseById(caseId) {
  return cases.find((entry) => entry.id === caseId) || null;
}

function getConsensusSelectedCaseId(room) {
  if (room.players.length !== 2) return null;

  const firstSelection = room.selectedCases[room.players[0].sessionId];
  const secondSelection = room.selectedCases[room.players[1].sessionId];
  if (!firstSelection || !secondSelection || firstSelection !== secondSelection) return null;
  return firstSelection;
}

function getPublicState(room, playerSessionId) {
  const player = room.players.find((p) => p.sessionId === playerSessionId) || room.players[0];
  const teammate = room.players.find((p) => p.sessionId !== player?.sessionId);

  const myRole = player ? getRoleDetails(player.roleId) : null;
  const teammateRole = teammate ? getRoleDetails(teammate.roleId) : null;

  const mySelectedCaseId = getSelectedCaseId(room, player?.sessionId);
  const teammateSelectedCaseId = getSelectedCaseId(room, teammate?.sessionId);
  const resolvedCase = getCaseById(room.activeCaseId || mySelectedCaseId || teammateSelectedCaseId);
  const phase = resolvedCase ? resolvedCase.fases[room.phaseIndex] : null;

  const bothPlayersConnected = room.players.length === 2;
  const bothSelected = Boolean(mySelectedCaseId && teammateSelectedCaseId);
  const sameCaseSelected = mySelectedCaseId && teammateSelectedCaseId && mySelectedCaseId === teammateSelectedCaseId;

  return {
    code: room.code,
    players: room.players.map((p) => ({
      id: p.sessionId,
      name: p.name,
      role: getRoleDetails(p.roleId),
      connected: p.connected
    })),
    gameStarted: room.gameStarted,
    availableCases: cases.map((entry) => ({
      id: entry.id,
      titulo: entry.titulo,
      dificuldade: entry.dificuldade
    })),
    mySelectedCaseId,
    teammateSelectedCaseId,
    caseSelectionReady: bothPlayersConnected && bothSelected && sameCaseSelected,
    selectionMessage: bothPlayersConnected
      ? (sameCaseSelected
          ? 'Seleção sincronizada! Vocês podem iniciar.'
          : 'Os dois jogadores devem selecionar o mesmo caso.')
      : 'Aguardando segundo jogador para validar a seleção.',
    caseTitle: resolvedCase?.titulo || '',
    caseDifficulty: resolvedCase?.dificuldade || '',
    caseDescription: resolvedCase?.descricao || '',
    phaseIndex: room.phaseIndex,
    phaseCount: resolvedCase?.fases.length || 0,
    phaseTitle: phase?.titulo || '',
    riddle: phase?.enigma || '',
    roleObjective: phase?.objetivo || '',
    roleClue: myRole ? phase?.pistasPorPapel?.[myRole.id] || 'Compartilhe suas ideias com seu parceiro.' : '',
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
    if (!player.connected || !player.socketId) continue;
    io.to(player.socketId).emit('state:update', getPublicState(room, player.sessionId));
  }
}

function bindSocketToRoom(socket, room, player) {
  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.playerSessionId = player.sessionId;
  player.socketId = socket.id;
  player.connected = true;
  player.lastSeenAt = Date.now();
  room.updatedAt = Date.now();
}

setInterval(() => {
  const now = Date.now();
  for (const [roomCode, room] of rooms.entries()) {
    const hasConnectedPlayers = room.players.some((player) => player.connected);
    if (hasConnectedPlayers) continue;
    if (now - room.updatedAt >= ROOM_TTL_MS) rooms.delete(roomCode);
  }
}, 60 * 1000);

io.on('connection', (socket) => {
  socket.on('room:create', ({ playerName, sessionId }, cb) => {
    let code = createRoomCode();
    while (rooms.has(code)) code = createRoomCode();

    const room = {
      code,
      players: [createPlayer({ socketId: socket.id, playerName: playerName || 'Jogador 1', roleId: ROLE_ORDER[0], sessionId })],
      gameStarted: false,
      activeCaseId: null,
      selectedCases: {},
      phaseIndex: 0,
      hintsUsed: 0,
      score: 100,
      finished: false,
      updatedAt: Date.now()
    };

    rooms.set(code, room);
    const player = room.players[0];
    bindSocketToRoom(socket, room, player);
    cb({ ok: true, playerSessionId: player.sessionId, state: getPublicState(room, player.sessionId) });
  });

  socket.on('room:join', ({ code, playerName, sessionId }, cb) => {
    const room = rooms.get((code || '').toUpperCase());
    if (!room) return cb({ ok: false, message: 'Sala não encontrada.' });

    const existingPlayer = getPlayerBySession(room, sessionId);
    if (existingPlayer) {
      existingPlayer.name = playerName || existingPlayer.name;
      bindSocketToRoom(socket, room, existingPlayer);
      emitRoomState(room);
      return cb({ ok: true, playerSessionId: existingPlayer.sessionId, state: getPublicState(room, existingPlayer.sessionId) });
    }

    if (room.players.length >= 2) return cb({ ok: false, message: 'Sala já está cheia.' });

    const usedRoles = new Set(room.players.map((player) => player.roleId));
    const roleId = ROLE_ORDER.find((entry) => !usedRoles.has(entry)) || ROLE_ORDER[0];

    const player = createPlayer({ socketId: socket.id, playerName: playerName || 'Jogador 2', roleId, sessionId });
    room.players.push(player);
    bindSocketToRoom(socket, room, player);

    emitRoomState(room);
    return cb({ ok: true, playerSessionId: player.sessionId, state: getPublicState(room, player.sessionId) });
  });

  socket.on('room:resume', ({ code, sessionId }, cb) => {
    const room = rooms.get((code || '').toUpperCase());
    if (!room) return cb?.({ ok: false, message: 'Sala não encontrada.' });
    const player = getPlayerBySession(room, sessionId);
    if (!player) return cb?.({ ok: false, message: 'Sessão expirada para esta sala.' });

    bindSocketToRoom(socket, room, player);
    emitRoomState(room);
    return cb?.({ ok: true, playerSessionId: player.sessionId, state: getPublicState(room, player.sessionId) });
  });

  socket.on('case:select', ({ caseId }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ ok: false, message: 'Sala inválida.' });
    if (room.gameStarted) return cb?.({ ok: false, message: 'Não é possível trocar o caso após iniciar.' });

    const selectedCase = getCaseById(caseId);
    if (!selectedCase) return cb?.({ ok: false, message: 'Caso inválido.' });

    room.selectedCases[socket.data.playerSessionId] = selectedCase.id;
    room.updatedAt = Date.now();
    emitRoomState(room);
    return cb?.({ ok: true });
  });

  socket.on('game:start', (_data, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ ok: false, message: 'Sala inválida.' });
    if (room.players.length !== 2) return cb?.({ ok: false, message: 'A sala precisa de dois jogadores.' });

    const sharedCaseId = getConsensusSelectedCaseId(room);
    if (!sharedCaseId) {
      return cb?.({ ok: false, message: 'Os dois jogadores precisam escolher o mesmo caso.' });
    }

    room.gameStarted = true;
    room.activeCaseId = sharedCaseId;
    room.phaseIndex = 0;
    room.hintsUsed = 0;
    room.score = 100;
    room.finished = false;
    room.updatedAt = Date.now();
    emitRoomState(room);
    cb?.({ ok: true });
  });

  socket.on('game:hint', (_data, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ ok: false, message: 'Sala inválida.' });
    if (!room.gameStarted) return cb?.({ ok: false, message: 'Iniciem o jogo antes de pedir dicas.' });

    room.activeCaseId = room.activeCaseId || getConsensusSelectedCaseId(room);
    const activeCase = getCaseById(room.activeCaseId);
    if (!activeCase) return cb?.({ ok: false, message: 'Os dois jogadores precisam escolher o mesmo caso.' });

    const phase = activeCase.fases[room.phaseIndex];
    const nextHint = phase.dicas[room.hintsUsed] || 'Sem mais dicas nesta fase.';
    room.hintsUsed += 1;
    room.score = Math.max(0, room.score - 5);
    const requester = room.players.find((p) => p.sessionId === socket.data.playerSessionId)?.name || 'Um jogador';
    room.updatedAt = Date.now();
    io.to(room.code).emit('game:message', `${requester} pediu dica: ${nextHint}`);
    emitRoomState(room);
    cb?.({ ok: true, hint: nextHint });
  });

  socket.on('game:answer', ({ answer }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ ok: false, message: 'Sala inválida.' });

    if (!room.gameStarted) return cb?.({ ok: false, message: 'Iniciem o jogo antes de responder.' });

    room.activeCaseId = room.activeCaseId || getConsensusSelectedCaseId(room);
    const activeCase = getCaseById(room.activeCaseId);
    if (!activeCase) return cb?.({ ok: false, message: 'Os dois jogadores precisam escolher o mesmo caso.' });

    const phase = activeCase.fases[room.phaseIndex];
    if (sanitize(answer) === sanitize(phase.resposta)) {
      room.score = Math.min(100, room.score + 10);
      if (room.phaseIndex + 1 < activeCase.fases.length) {
        room.phaseIndex += 1;
        room.hintsUsed = 0;
        io.to(room.code).emit('game:message', 'Resposta correta! Próxima fase liberada.');
      } else {
        room.finished = true;
        io.to(room.code).emit('game:message', 'Parabéns! Vocês resolveram o caso selecionado.');
      }
      emitRoomState(room);
      cb?.({ ok: true, correct: true });
    } else {
      room.score = Math.max(0, room.score - 10);
      io.to(room.code).emit('game:message', 'Resposta incorreta. Tentem novamente.');
      emitRoomState(room);
      cb?.({ ok: true, correct: false });
    }
    room.updatedAt = Date.now();
  });

  socket.on('disconnect', () => {
    const { roomCode } = socket.data;
    if (!roomCode || !rooms.has(roomCode)) return;
    const room = rooms.get(roomCode);
    const player = room.players.find((entry) => entry.socketId === socket.id);
    if (!player) return;

    player.connected = false;
    player.socketId = null;
    player.lastSeenAt = Date.now();
    room.updatedAt = Date.now();

    emitRoomState(room);
    io.to(roomCode).emit('game:message', 'Um jogador desconectou. A sessão ficará disponível para reconexão.');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor iniciado em http://${getLocalIp()}:${PORT}`);
});

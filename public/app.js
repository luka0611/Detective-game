const socket = io();

const byId = (id) => document.getElementById(id);
const statusEl = byId('status');
const lobbyEl = byId('lobby');
const gameEl = byId('game');
const logEl = byId('log');

function addLog(msg) {
  const p = document.createElement('p');
  p.textContent = `• ${msg}`;
  logEl.prepend(p);
}

function render(s) {
  lobbyEl.classList.add('hidden');
  gameEl.classList.remove('hidden');

  byId('code').textContent = s.code;
  byId('players').textContent = s.players.map((p) => `${p.name} (${p.roleLabel})`).join('  |  ');
  byId('myRole').textContent = s.myRole;
  byId('partnerRole').textContent = s.partnerRole;
  byId('caseTitle').textContent = `${s.caseTitle} (${s.caseIndex + 1}/${s.caseCount})`;
  byId('caseDescription').textContent = s.caseDescription;
  byId('phase').textContent = `${s.phaseIndex + 1}/${s.phaseCount}`;
  byId('score').textContent = s.score;
  byId('phaseTitle').textContent = s.phaseTitle;
  byId('riddle').textContent = s.riddle;
  byId('myClue').textContent = s.myClue;
  byId('message').textContent = s.finished ? s.winnerMessage : '';
}

byId('create').addEventListener('click', () => {
  socket.emit('room:create', { playerName: byId('name').value }, (res) => {
    statusEl.textContent = res.ok ? 'Sala criada! Compartilhe o código com seu parceiro.' : res.message;
  });
});

byId('join').addEventListener('click', () => {
  socket.emit('room:join', { code: byId('roomCode').value.toUpperCase(), playerName: byId('name').value }, (res) => {
    statusEl.textContent = res.ok ? 'Você entrou na sala.' : res.message;
  });
});

byId('start').addEventListener('click', () => {
  socket.emit('game:start', {}, (res) => {
    if (!res?.ok) addLog(res?.message || 'Não foi possível iniciar agora.');
  });
});

byId('hint').addEventListener('click', () => {
  socket.emit('game:hint', {}, (res) => {
    if (res?.ok) addLog(`Dica: ${res.hint}`);
  });
});

byId('sendAnswer').addEventListener('click', () => {
  socket.emit('game:answer', { answer: byId('answer').value }, (res) => {
    if (res?.ok) addLog(res.correct ? 'Acertou!' : 'Errou, comparem as pistas.');
    byId('answer').value = '';
  });
});

socket.on('state:update', render);
socket.on('game:message', addLog);

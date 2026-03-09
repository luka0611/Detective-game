const socket = io();
const state = { roomCode: null };

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
  state.roomCode = s.code;
  lobbyEl.classList.add('hidden');
  gameEl.classList.remove('hidden');

  byId('code').textContent = s.code;
  byId('players').textContent = s.players.map((p) => `${p.name} (${p.role.nome})`).join(' e ');
  byId('caseTitle').textContent = `${s.caseTitle} (${s.caseIndex + 1}/${s.caseCount})`;
  byId('caseDescription').textContent = s.caseDescription;
  byId('phase').textContent = `${s.phaseIndex + 1}/${s.phaseCount}`;
  byId('score').textContent = s.score;
  byId('phaseTitle').textContent = s.phaseTitle;
  byId('riddle').textContent = s.riddle;
  byId('roleObjective').textContent = s.roleObjective;
  byId('myRole').textContent = s.myRole?.nome || 'Sem papel';
  byId('myRoleDescription').textContent = s.myRole?.descricao || '';
  byId('teammateRole').textContent = s.teammateRoleName;
  byId('roleClue').textContent = s.roleClue;
  byId('message').textContent = s.finished ? s.winnerMessage : '';
}

byId('create').addEventListener('click', () => {
  socket.emit('room:create', { playerName: byId('name').value }, (res) => {
    statusEl.textContent = res.ok ? 'Sala criada!' : res.message;
    if (res.ok) render(res.state);
  });
});

byId('join').addEventListener('click', () => {
  socket.emit('room:join', { code: byId('roomCode').value.toUpperCase(), playerName: byId('name').value }, (res) => {
    statusEl.textContent = res.ok ? 'Você entrou na sala.' : res.message;
    if (res.ok) render(res.state);
  });
});

byId('start').addEventListener('click', () => socket.emit('game:start', {}, () => addLog('Jogo iniciado.')));

byId('hint').addEventListener('click', () => {
  socket.emit('game:hint', {}, (res) => {
    if (res?.ok) addLog(`Dica: ${res.hint}`);
  });
});

byId('sendAnswer').addEventListener('click', () => {
  socket.emit('game:answer', { answer: byId('answer').value }, (res) => {
    addLog(res.correct ? 'Acertou!' : 'Errou, tentem de novo.');
    byId('answer').value = '';
  });
});

socket.on('state:update', render);
socket.on('game:message', addLog);

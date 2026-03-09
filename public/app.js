const socket = io();
const state = { roomCode: null, selectedCaseId: '' };

const byId = (id) => document.getElementById(id);
const statusEl = byId('status');
const lobbyEl = byId('lobby');
const gameEl = byId('game');
const logEl = byId('log');
const caseSelectorEl = byId('caseSelector');

function addLog(msg) {
  const p = document.createElement('p');
  p.textContent = `• ${msg}`;
  logEl.prepend(p);
}

function renderCaseSelector(s) {
  caseSelectorEl.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecione um caso';
  caseSelectorEl.append(placeholder);

  for (const caseInfo of s.availableCases) {
    const option = document.createElement('option');
    option.value = caseInfo.id;
    option.textContent = `${caseInfo.titulo} — dificuldade: ${caseInfo.dificuldade}`;
    caseSelectorEl.append(option);
  }

  caseSelectorEl.value = s.mySelectedCaseId || '';
  caseSelectorEl.disabled = s.gameStarted;
}

function render(s) {
  state.roomCode = s.code;
  state.selectedCaseId = s.mySelectedCaseId || '';
  lobbyEl.classList.add('hidden');
  gameEl.classList.remove('hidden');

  byId('code').textContent = s.code;
  byId('players').textContent = s.players.map((p) => `${p.name} (${p.role.nome})`).join(' e ');
  byId('caseTitle').textContent = s.caseTitle ? `${s.caseTitle} (${s.caseDifficulty})` : 'Escolha um caso para começar';
  byId('caseDescription').textContent = s.caseDescription;
  byId('phase').textContent = s.phaseCount ? `${s.phaseIndex + 1}/${s.phaseCount}` : '-';
  byId('score').textContent = s.score;
  byId('phaseTitle').textContent = s.phaseTitle;
  byId('riddle').textContent = s.riddle;
  byId('roleObjective').textContent = s.roleObjective;
  byId('myRole').textContent = s.myRole?.nome || 'Sem papel';
  byId('myRoleDescription').textContent = s.myRole?.descricao || '';
  byId('teammateRole').textContent = s.teammateRoleName;
  byId('roleClue').textContent = s.roleClue;
  byId('message').textContent = s.finished ? s.winnerMessage : '';
  byId('selectionStatus').textContent = s.selectionMessage;

  renderCaseSelector(s);
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

caseSelectorEl.addEventListener('change', () => {
  socket.emit('case:select', { caseId: caseSelectorEl.value }, (res) => {
    if (!res?.ok) addLog(res?.message || 'Falha ao selecionar o caso.');
  });
});

byId('start').addEventListener('click', () => {
  socket.emit('game:start', {}, (res) => {
    if (res?.ok) addLog('Jogo iniciado.');
    else addLog(res?.message || 'Não foi possível iniciar agora.');
  });
});

byId('hint').addEventListener('click', () => {
  socket.emit('game:hint', {}, (res) => {
    if (res?.ok) addLog(`Dica: ${res.hint}`);
    else addLog(res?.message || 'Não foi possível obter dica.');
  });
});

byId('sendAnswer').addEventListener('click', () => {
  socket.emit('game:answer', { answer: byId('answer').value }, (res) => {
    if (!res?.ok) addLog(res?.message || 'Não foi possível validar a resposta.');
    else addLog(res.correct ? 'Acertou!' : 'Errou, tentem de novo.');
    byId('answer').value = '';
  });
});

socket.on('state:update', render);
socket.on('game:message', addLog);

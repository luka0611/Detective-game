const socket = io();
const state = { roomCode: null, selectedCaseId: '' };
const STORAGE_KEY = 'detectiveGameSession';

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

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (_error) {
    return {};
  }
}

function saveSession({ roomCode, playerSessionId, playerName }) {
  const previous = loadSession();
  const next = {
    roomCode: roomCode || previous.roomCode || '',
    playerSessionId: playerSessionId || previous.playerSessionId || '',
    playerName: playerName || previous.playerName || ''
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function getNameInput() {
  return byId('name').value.trim();
}

function persistPlayerName() {
  const typedName = getNameInput();
  if (typedName) saveSession({ playerName: typedName });
}

function handleRoomResponse(res, successMessage) {
  statusEl.textContent = res.ok ? successMessage : res.message;
  if (!res.ok) return;

  saveSession({
    roomCode: res.state?.code,
    playerSessionId: res.playerSessionId,
    playerName: getNameInput()
  });
  render(res.state);
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
  persistPlayerName();
  const session = loadSession();
  socket.emit('room:create', { playerName: getNameInput(), sessionId: session.playerSessionId }, (res) => {
    handleRoomResponse(res, 'Sala criada!');
  });
});

byId('join').addEventListener('click', () => {
  persistPlayerName();
  const session = loadSession();
  socket.emit('room:join', { code: byId('roomCode').value.toUpperCase(), playerName: getNameInput(), sessionId: session.playerSessionId }, (res) => {
    handleRoomResponse(res, 'Você entrou na sala.');
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

socket.on('connect', () => {
  const session = loadSession();
  if (!session.roomCode || !session.playerSessionId) return;

  if (!getNameInput() && session.playerName) byId('name').value = session.playerName;
  byId('roomCode').value = session.roomCode;

  socket.emit('room:resume', { code: session.roomCode, sessionId: session.playerSessionId }, (res) => {
    if (res?.ok) {
      handleRoomResponse(res, 'Sessão restaurada com sucesso.');
    } else {
      clearSession();
      statusEl.textContent = res?.message || 'Não foi possível restaurar sessão anterior.';
    }
  });
});

const test = require('node:test');
const assert = require('node:assert');
const cases = require('../data/cases/index.js');

const roles = ['reconstituista', 'analista'];

test('deve ter pelo menos quatro crimes', () => {
  assert.ok(cases.length >= 4);
});

test('deve ter ao menos dois crimes difíceis', () => {
  const hardCases = cases.filter((c) => c.dificuldade === 'difícil');
  assert.ok(hardCases.length >= 2);
});

test('cada crime deve ter ao menos 3 fases com resposta e objetivo', () => {
  for (const c of cases) {
    assert.ok(c.id);
    assert.ok(c.titulo);
    assert.ok(c.dificuldade);
    assert.ok(Array.isArray(c.fases));
    assert.ok(c.fases.length >= 3);
    for (const f of c.fases) {
      assert.ok(f.resposta);
      assert.ok(f.enigma);
      assert.ok(f.objetivo);
    }
  }
});

test('cada fase deve ter pistas complementares para os dois papéis', () => {
  for (const c of cases) {
    for (const f of c.fases) {
      assert.ok(f.pistasPorPapel);
      for (const role of roles) {
        assert.ok(f.pistasPorPapel[role]);
      }
    }
  }
});

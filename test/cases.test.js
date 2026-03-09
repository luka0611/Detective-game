const test = require('node:test');
const assert = require('node:assert');
const cases = require('../data/cases.json');

const roles = ['reconstituista', 'analista'];

test('deve ter exatamente dois crimes', () => {
  assert.equal(cases.length, 2);
});

test('cada crime deve ter ao menos 3 fases com resposta e objetivo', () => {
  for (const c of cases) {
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

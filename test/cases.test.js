const test = require('node:test');
const assert = require('node:assert');
const cases = require('../data/cases.json');

test('deve ter exatamente dois crimes', () => {
  assert.equal(cases.length, 2);
});

test('cada crime deve ter ao menos 3 fases com resposta', () => {
  for (const c of cases) {
    assert.ok(Array.isArray(c.fases));
    assert.ok(c.fases.length >= 3);
    for (const f of c.fases) {
      assert.ok(f.resposta);
      assert.ok(f.enigma);
    }
  }
});

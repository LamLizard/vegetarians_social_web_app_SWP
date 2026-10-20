// Khoi's code: Bộ đơn vị server phải khớp client. Chạy: node --test src/utils/ingredientUnits.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { UNITS, NO_AMOUNT_UNITS, canonicalUnit } = require('./ingredientUnits');

const clientFile = path.join(__dirname, '../../../client/src/constants/domain.js');

test('INGREDIENT_UNIT ở client khớp UNITS ở server (cùng đơn vị, cùng thứ tự, cùng noAmount)', () => {
  const src = fs.readFileSync(clientFile, 'utf8');
  const block = src.slice(src.indexOf('export const INGREDIENT_UNIT = ['));
  const body = block.slice(0, block.indexOf('\n];'));
  const rows = [...body.matchAll(/\{\s*value:\s*'([^']+)'[^}]*\}/g)].map((m) => ({ value: m[1], noAmount: /noAmount:\s*true/.test(m[0]) }));
  assert.deepEqual(rows.map((r) => r.value), UNITS);
  assert.deepEqual(rows.filter((r) => r.noAmount).map((r) => r.value), NO_AMOUNT_UNITS);
});

test('canonicalUnit: không phân biệt hoa/thường, đơn vị lạ → null', () => {
  assert.equal(canonicalUnit('Muỗng Canh'), 'muỗng canh');
  assert.equal(canonicalUnit('  KG '), 'kg');
  assert.equal(canonicalUnit('cây'), null);
  assert.equal(canonicalUnit('thìa'), null);
});

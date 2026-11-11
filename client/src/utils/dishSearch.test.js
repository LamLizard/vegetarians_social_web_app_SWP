import assert from 'node:assert/strict';
import test from 'node:test';
import { filterAdminDishes, normalizeText } from './dishSearch.js';

const com = 'c\u01a1m';
const dauHu = '\u0110\u1eadu h\u0169';
const dishes = [
  { id: 'cha', name: 'Ch\u1ea3 n\u1ea5m chay', description: `\u0102n k\u00e8m ${com} tr\u1eafng`, categories: [{ name: 'M\u00f3n ch\u00ednh' }], recipes: [{ title: 'Ch\u1ea3 n\u1ea5m', instructions: `\u0102n k\u00e8m ${com} tr\u1eafng, d\u00f9ng gi\u1ea5y th\u1ea5m d\u1ea7u`, ingredients: [{ name: dauHu }] }] },
  { id: 'dau-hu', name: dauHu, categories: [{ name: 'M\u00f3n ch\u00ednh' }], recipes: [{ instructions: `\u0102n k\u00e8m ${com} tr\u1eafng` }] },
  { id: 'com-rang', name: `${com} rang`, categories: [{ name: 'M\u00f3n ch\u00ednh' }] },
  { id: 'com', name: com, categories: [{ name: 'M\u00f3n ph\u1ee5' }] },
  { id: 'dau', name: 'D\u1ea7u m\u00e8', categories: [{ name: 'M\u00f3n ph\u1ee5' }] },
];

test('normalizeText preserves Vietnamese marks and normalizes NFC/case/whitespace', () => {
  assert.equal(normalizeText(com), normalizeText('C\u01a0M'));
  assert.equal(normalizeText(com), normalizeText(`  ${com}  `));
  assert.equal(normalizeText('\u0110\u1eacU   h\u0169'), 'đ\u1eadu h\u0169');
  assert.equal(normalizeText('co\u031bm'), normalizeText(com));
  assert.notEqual(normalizeText(com), normalizeText('com'));
});

test('search matches dish names and ranks exact, prefix, contains, then category', () => {
  assert.deepEqual(filterAdminDishes(dishes, com).map((dish) => dish.id), ['com', 'com-rang']);
  for (const query of ['C\u01a0M', 'C\u01a1m', ` ${com} `, 'co\u031bm']) {
    assert.deepEqual(filterAdminDishes(dishes, query).map((dish) => dish.id), ['com', 'com-rang']);
  }
  assert.deepEqual(filterAdminDishes(dishes, 'com'), []);
  assert.deepEqual(filterAdminDishes([{ name: com }], 'c\u1ed1m'), []);
  assert.deepEqual(filterAdminDishes([{ name: com }], 'c\u1eddm'), []);
  assert.deepEqual(filterAdminDishes(dishes, dauHu).map((dish) => dish.id), ['dau-hu']);
  assert.deepEqual(filterAdminDishes(dishes, 'dau hu'), []);

  const ranked = [
    { id: 'category', name: 'M\u00e8 rang', categories: [{ name: com }] },
    { id: 'contains', name: `Th\u1ecbt chay ${com} cu\u1ed9n`, categories: [] },
    { id: 'prefix', name: `${com} rang`, categories: [] },
    { id: 'exact', name: com, categories: [] },
  ];
  assert.deepEqual(filterAdminDishes(ranked, com).map((dish) => dish.id), ['exact', 'prefix', 'contains', 'category']);
});

test('recipe, description, ingredient, and instruction text do not match', () => {
  assert.deepEqual(filterAdminDishes(dishes, 'gi\u1ea5y th\u1ea5m d\u1ea7u'), []);
  assert.deepEqual(filterAdminDishes(dishes, `${com} tr\u1eafng`), []);
  assert.deepEqual(filterAdminDishes(dishes, 'zzzz'), []);
});

test('empty search returns the full original list', () => {
  assert.equal(filterAdminDishes(dishes, '  '), dishes);
});

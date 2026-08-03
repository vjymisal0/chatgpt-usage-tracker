import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getAllKnownModels, matchModelId, computeUsage } from '../src/logic.js';

const quota = JSON.parse(await readFile(new URL('../src/quota.json', import.meta.url)));
const allModels = getAllKnownModels(quota);

test('quota.json is well-formed for every plan', () => {
  for (const [planName, models] of Object.entries(quota.plans)) {
    assert.ok(Array.isArray(models) && models.length > 0, `${planName} should have models`);
    for (const model of models) {
      assert.equal(typeof model.id, 'string');
      assert.equal(typeof model.label, 'string');
      assert.ok(Array.isArray(model.aliases) && model.aliases.length > 0, `${model.id} needs aliases`);
      assert.equal(typeof model.quota, 'number');
      assert.equal(typeof model.hours, 'number');
    }
  }
});

test('getAllKnownModels deduplicates by id across plans', () => {
  const ids = allModels.map((m) => m.id);
  assert.equal(ids.length, new Set(ids).size, 'no duplicate ids');
  // gpt-5 appears in plus/pro/team - confirm dedup actually collapsed something.
  assert.ok(ids.includes('gpt-5'));
});

test('matchModelId finds an exact alias match', () => {
  assert.equal(matchModelId('gpt-5-thinking', allModels), 'gpt-5-thinking');
  assert.equal(matchModelId('o4-mini', allModels), 'o4-mini');
});

test('matchModelId is case-insensitive', () => {
  assert.equal(matchModelId('GPT-5', allModels), 'gpt-5');
});

test('matchModelId prefers the longest alias so "4-1-mini" is not shadowed by "4-1"', () => {
  assert.equal(matchModelId('gpt-4-1-mini', allModels), 'gpt-4-1-mini');
  assert.equal(matchModelId('gpt-4-1', allModels), 'gpt-4-1');
});

test('matchModelId returns null for unrecognized slugs', () => {
  assert.equal(matchModelId('some-future-model-xyz', allModels), null);
  assert.equal(matchModelId(undefined, allModels), null);
  assert.equal(matchModelId('', allModels), null);
});

test('computeUsage counts only timestamps inside the rolling window', () => {
  const now = 1_000_000_000_000; // arbitrary fixed epoch ms
  const hours = 3;
  const windowMs = hours * 60 * 60 * 1000;
  const models = [{ id: 'gpt-5', label: 'GPT-5', quota: 160, hours }];

  const timestamps = [
    now - windowMs - 1, // just outside the window
    now - windowMs + 1000, // just inside
    now - 1000, // inside
  ];

  const [result] = computeUsage(models, { 'gpt-5': timestamps }, {}, now);
  assert.equal(result.used, 2);
  assert.equal(result.quota, 160);
  assert.equal(result.unlimited, false);
});

test('computeUsage reports resetsAt as when the oldest in-window message ages out', () => {
  const now = 1_000_000_000_000;
  const hours = 3;
  const windowMs = hours * 60 * 60 * 1000;
  const models = [{ id: 'gpt-5', label: 'GPT-5', quota: 160, hours }];
  const oldestTimestamp = now - windowMs + 5000;

  const [result] = computeUsage(models, { 'gpt-5': [oldestTimestamp] }, {}, now);
  assert.equal(result.resetsAt, oldestTimestamp + windowMs);
});

test('computeUsage returns null resetsAt when there is no usage yet', () => {
  const models = [{ id: 'gpt-5', label: 'GPT-5', quota: 160, hours: 3 }];
  const [result] = computeUsage(models, {}, {}, Date.now());
  assert.equal(result.used, 0);
  assert.equal(result.resetsAt, null);
});

test('computeUsage marks negative quota as unlimited', () => {
  const models = [{ id: 'gpt-5-pro', label: 'GPT-5 Pro', quota: -1, hours: 168 }];
  const [result] = computeUsage(models, {}, {}, Date.now());
  assert.equal(result.unlimited, true);
});

test('computeUsage applies a custom override for quota and hours', () => {
  const now = 1_000_000_000_000;
  const models = [{ id: 'gpt-5', label: 'GPT-5', quota: 160, hours: 3 }];
  const customLimits = { 'gpt-5': { quota: 50, hours: 24 } };

  const [result] = computeUsage(models, { 'gpt-5': [now - 1000] }, customLimits, now);
  assert.equal(result.quota, 50);
  assert.equal(result.hours, 24);
});

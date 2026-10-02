import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dosesForDay, doseId, parseTimes, timeOfDay } from './doses.ts';
import type { Med } from './types.ts';

const med = (over: Partial<Med> = {}): Med => ({
  id: 'm1', name: 'Metformin', dosage: '500mg', instructions: '', color: '#fff',
  times: ['20:00', '08:00'], days: [0, 1, 2, 3, 4, 5, 6], ...over,
});

test('doses are generated for each time and sorted', () => {
  const day = new Date(2026, 9, 3); // Saturday
  const slots = dosesForDay([med()], day);
  assert.deepEqual(slots.map((s) => s.time), ['08:00', '20:00']);
  assert.equal(slots[0].id, 'm1_20261003_0800');
  assert.equal(slots[0].scheduledAt.getHours(), 8);
});

test('days of week are respected (0 = Sunday)', () => {
  const saturday = new Date(2026, 9, 3);
  assert.equal(dosesForDay([med({ days: [1, 2, 3] })], saturday).length, 0);
  assert.equal(dosesForDay([med({ days: [6] })], saturday).length, 2);
});

test('ids are stable', () => {
  assert.equal(doseId('a', new Date(2026, 0, 5), '09:05'), 'a_20260105_0905');
});

test('parseTimes normalizes and drops invalid entries', () => {
  assert.deepEqual(parseTimes('8:00, 20:30 25:00 nope'), ['08:00', '20:30']);
});

test('time of day', () => {
  assert.equal(timeOfDay(new Date(2026, 0, 1, 7)), 'morning');
  assert.equal(timeOfDay(new Date(2026, 0, 1, 13)), 'afternoon');
  assert.equal(timeOfDay(new Date(2026, 0, 1, 21)), 'evening');
});

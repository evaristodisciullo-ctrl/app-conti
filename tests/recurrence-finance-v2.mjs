import assert from 'node:assert/strict';
import { financeEntriesForMonth, financeTotals, monthlyProjection } from '../v2/finance.js';
import { migrateLegacyRecurrences } from '../v2/recurrence.js';

const forever = { end: 'never', interval: 1, until: '' };
const monthly = {
  balance: 250,
  entries: [
    { id: 'income-forever', kind: 'income', description: 'Entrata mensile', amount: 417, date: '2026-01-01', datePrecision: 'day', seriesId: 'income-forever', occurrenceIndex: 0, recurrenceRule: { unit: 'month', ...forever } },
    { id: 'payment-forever', kind: 'expense', description: 'Pagamento mensile', amount: 100, date: '2026-01-15', datePrecision: 'day', seriesId: 'payment-forever', occurrenceIndex: 0, recurrenceRule: { unit: 'month', ...forever } }
  ], history: []
};
for (const ym of ['2028-05', '2029-05', '2030-05', '2099-05']) {
  const income = financeEntriesForMonth(monthly, 'income', ym);
  const payment = financeEntriesForMonth(monthly, 'expense', ym);
  assert.equal(income.length, 1, `monthly forever income exists in ${ym}`);
  assert.equal(income[0].date, `${ym}-01`);
  assert.equal(payment.length, 1, `monthly forever payment exists in ${ym}`);
  assert.equal(payment[0].date, `${ym}-15`);
  assert.equal(income[0].virtualRecurrence, true, 'future rows are virtual rather than written as permanent duplicates');
}
assert.equal(financeTotals(monthly, 'income', '2028-05').pending, 417);
assert.equal(financeTotals(monthly, 'expense', '2028-05').pending, 100);
const projection = monthlyProjection(monthly, '2028-05', new Date(2026, 0, 1));
assert.equal(projection.receive, 417);
assert.equal(projection.pay, 100);

const annual = { balance: 0, entries: [
  { id: 'inps', kind: 'income', description: 'Tredicesima INPS', amount: 417, date: '2026-12-01', datePrecision: 'day', seriesId: 'inps', occurrenceIndex: 0, recurrenceRule: { unit: 'year', ...forever } },
  { id: 'salary', kind: 'income', description: 'Tredicesima stipendio', amount: 1166, date: '2026-12-21', datePrecision: 'day', seriesId: 'salary', occurrenceIndex: 0, recurrenceRule: { unit: 'year', ...forever } },
  { id: 'annual-payment', kind: 'expense', description: 'Pagamento annuale', amount: 300, date: '2026-12-05', datePrecision: 'day', seriesId: 'annual-payment', occurrenceIndex: 0, recurrenceRule: { unit: 'year', ...forever } }
], history: [] };
for (const year of [2027, 2028, 2029, 2050]) {
  assert.equal(financeEntriesForMonth(annual, 'income', `${year}-12`).filter(x => x.description === 'Tredicesima INPS')[0]?.date, `${year}-12-01`);
  assert.equal(financeEntriesForMonth(annual, 'income', `${year}-12`).filter(x => x.description === 'Tredicesima stipendio')[0]?.date, `${year}-12-21`);
  assert.equal(financeEntriesForMonth(annual, 'expense', `${year}-12`)[0]?.date, `${year}-12-05`);
}

const finite = { entries: [
  { id: 'finite-monthly', kind: 'income', amount: 12, date: '2026-01-31', datePrecision: 'day', seriesId: 'finite-monthly', occurrenceIndex: 0, recurrenceRule: { unit: 'month', interval: 1, end: 'count', count: 12 } },
  { id: 'finite-monthly-11', kind: 'income', amount: 12, date: '2026-12-31', datePrecision: 'day', seriesId: 'finite-monthly', occurrenceIndex: 11, recurrenceRule: { unit: 'month', interval: 1, end: 'count', count: 12 } },
  { id: 'finite-yearly', kind: 'expense', amount: 40, date: '2026-12-21', datePrecision: 'day', seriesId: 'finite-yearly', occurrenceIndex: 0, recurrenceRule: { unit: 'year', interval: 1, end: 'count', count: 2 } },
  { id: 'finite-yearly-1', kind: 'expense', amount: 40, date: '2027-12-21', datePrecision: 'day', seriesId: 'finite-yearly', occurrenceIndex: 1, recurrenceRule: { unit: 'year', interval: 1, end: 'count', count: 2 } }
], history: [] };
assert.equal(financeEntriesForMonth(finite, 'income', '2026-12').length, 1, 'month-count recurrence keeps its saved last month');
assert.equal(financeEntriesForMonth(finite, 'income', '2027-01').length, 0, 'month-count recurrence does not extend past its selected count');
assert.equal(financeEntriesForMonth(finite, 'expense', '2027-12')[0]?.date, '2027-12-21', 'finite annual recurrence preserves its saved count');
assert.equal(financeEntriesForMonth(finite, 'expense', '2028-12').length, 0);

const legacy = { entries: [{ id: 'legacy-year', kind: 'income', amount: 55, date: '2026-12-21', datePrecision: 'day', recurrence: 'yearly' }], history: [], todo: { tasks: [], done: [] } };
migrateLegacyRecurrences(legacy);
assert.equal(financeEntriesForMonth(legacy, 'income', '2029-12')[0]?.date, '2029-12-21', 'legacy saved annual rules continue without reinsertion');

const completed = { balance: 417, entries: [], history: [
  { id: 'paid-year-0', kind: 'expense', amount: 100, date: '2026-12-05', datePrecision: 'day', seriesId: 'paid-year', occurrenceIndex: 0, recurrenceRule: { unit: 'year', ...forever }, completedAt: '2026-12-05T12:00:00Z' },
  { id: 'paid-year-1', kind: 'expense', amount: 100, date: '2027-12-05', datePrecision: 'day', seriesId: 'paid-year', occurrenceIndex: 1, recurrenceRule: { unit: 'year', ...forever }, completedAt: '2027-12-05T12:00:00Z' }
] };
const before = JSON.stringify(completed);
assert.equal(financeEntriesForMonth(completed, 'expense', '2027-12').length, 0, 'an already paid occurrence is not recreated as pending');
const future = financeEntriesForMonth(completed, 'expense', '2028-12');
assert.equal(future.length, 1, 'the next annual occurrence remains available after prior paid rows');
assert.equal(future[0].completedAt, undefined, 'a completed root does not mark a future occurrence completed');
assert.equal(completed.history.length, 2, 'paid history remains intact');
assert.equal(JSON.stringify(completed), before, 'viewing future recurrences does not mutate or duplicate stored data');

console.log('PASS recurrence display: monthly forever through 2099, annual dates through 2050, legacy saved rules, finite-count boundaries, projection totals, and completed-status preservation');

import assert from 'node:assert/strict';
import { createBackup, readBackupText } from '../v2/backup.js';

class MemoryStorage {
  values = new Map();
  failKey = null;
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) {
    if (this.failKey === key) { this.failKey = null; throw new Error('simulated interrupted write'); }
    this.values.set(key, String(value));
  }
  removeItem(key) { this.values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
const { createEmptyState, restoreStateSafely, loadState, stateStorageKey } = await import('../v2/state.js');
const fixture = createEmptyState();
Object.assign(fixture, { welcomeCompleted: true, balance: 1580.25, appColor: 'Verde' });
fixture.profile.fullName = 'Utente di prova';
fixture.entries = [
  { id: 'income-1', kind: 'income', description: 'Entrata finta', amount: 1200, date: '2026-10-25' },
  { id: 'expense-1', kind: 'expense', description: 'Pagamento finto', amount: 80, date: '2026-10-25' }
];
fixture.history = [{ id: 'paid-1', kind: 'expense', description: 'Pagamento completato finto', amount: 25, date: '2026-10-10', completedAt: '2026-10-10T09:00:00Z' }];
fixture.adjustments = [{ id: 'adjustment-1', amount: 15 }];
fixture.budgets = { '2026-10': 100 };
fixture.budgetPlans = [{ month: '2026-10', total: 100, limits: { Casa: 100 } }];
fixture.todo.tasks = [{ id: 'todo-1', description: 'Scadenza finta', date: '2026-10-30' }];
fixture.todo.done = [{ id: 'done-1', description: 'Cosa completata finta', completedAt: '2026-10-20T09:00:00Z' }];
fixture.todo.color = 'Viola';
fixture.todo.notifications = { enabled: true, rule: { advanceDays: 2, time: '08:30' } };
fixture.financeNotifications = { enabled: true, defaultTime: '08:30', rule: { advanceDays: 1, time: '08:30' } };
fixture.notificationSettings = { enabled: true, rule: { advanceDays: 1, time: '08:30' } };
fixture.preferences = { ...fixture.preferences, textSize: 'large', reduceAnimations: true, dateFormat: 'yyyy-mm-dd', categories: ['Casa', 'Prova'] };

const backup = await createBackup(fixture, '2026-10-25T12:00:00Z');
const text = JSON.stringify(backup);
const parsed = await readBackupText(text);
assert.deepEqual(parsed, fixture, 'backup validation preserves entries, payments, due items, done items and preferences');
assert.equal(backup.schemaVersion, 1, 'portable schema version is present');

const prior = createEmptyState();
prior.welcomeCompleted = true;
prior.profile.fullName = 'Dati locali di prova';
await restoreStateSafely(prior);
const restored = await restoreStateSafely(parsed);
assert.deepEqual(restored, fixture, 'restore returns the full imported state');
assert.deepEqual(await loadState(), fixture, 'persisted state matches the backup after restore');

const beforeCorruptionCheck = localStorage.getItem(stateStorageKey);
await assert.rejects(readBackupText(JSON.stringify({ ...backup, state: { ...backup.state, balance: 1 } })), /FILE_DAMAGED/);
assert.equal(localStorage.getItem(stateStorageKey), beforeCorruptionCheck, 'a damaged backup cannot change stored data');

const previousRaw = localStorage.getItem(stateStorageKey);
localStorage.setItem('inOrdineV2RestoreGuard', JSON.stringify({ previousRaw, createdAt: 'test' }));
localStorage.setItem(stateStorageKey, JSON.stringify(createEmptyState()));
assert.deepEqual(await loadState(), fixture, 'startup rolls back a restore interrupted after replacing the state key');
assert.equal(localStorage.getItem('inOrdineV2RestoreGuard'), null, 'recovered transaction guard is cleared');

const corruptedRaw = '{not valid json';
localStorage.setItem(stateStorageKey, corruptedRaw);
const unreadable = await loadState();
assert.equal(unreadable._storageError, true, 'unreadable storage is reported instead of being replaced with an empty state');
assert.equal(localStorage.getItem(stateStorageKey), corruptedRaw, 'startup preserves the exact unreadable bytes so backup recovery remains possible');
await assert.rejects((await import('../v2/state.js')).saveState(unreadable), /STORAGE_READ_FAILED/);
localStorage.setItem(stateStorageKey, JSON.stringify(fixture));

localStorage.failKey = stateStorageKey;
await assert.rejects(restoreStateSafely(prior), /simulated interrupted write/);
assert.equal(localStorage.getItem(stateStorageKey), JSON.stringify(fixture), 'failed replacement restores the previous complete state');
console.log('PASS backup schema, complete fixture round-trip, damaged-file rejection, interrupted-restore recovery, and write-failure rollback');

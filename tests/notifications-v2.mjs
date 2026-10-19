import assert from 'node:assert/strict';
import { collectNotificationPlan, syncNotifications } from '../v2/notifications.js';

const now = new Date(2026, 9, 19, 23, 0, 0, 0);
const state = {
  financeNotifications: { enabled: true, defaultTime: '09:00' },
  entries: [{ id: 'schedina', kind: 'expense', description: 'Schedina', date: '2026-10-19', datePrecision: 'day', reminder: { enabled: true, mode: 'due', time: '23:57', advanceMinutes: 0 } }],
  todo: { notifications: { enabled: false }, tasks: [] },
};
const plan = collectNotificationPlan(state, now);
assert.equal(plan.length, 1, 'enabled dated finance reminders are planned');
assert.equal(plan[0].body, 'Schedina');
assert.equal(plan[0].schedule.at.getFullYear(), 2026, 'date is interpreted in local device time');
assert.equal(plan[0].schedule.at.getMonth(), 9);
assert.equal(plan[0].schedule.at.getDate(), 19);
assert.equal(plan[0].schedule.at.getHours(), 23);
assert.equal(plan[0].schedule.at.getMinutes(), 57);
assert.equal(plan[0].schedule.allowWhileIdle, true, 'alarm is configured to wake during Doze');
const perItemOnly = collectNotificationPlan({ ...state, financeNotifications: { enabled: false }, entries: state.entries, todo: { notifications: { enabled: false }, tasks: [] } }, now);
assert.equal(perItemOnly.length, 1, 'an individually enabled finance reminder is not suppressed by the general switch');
const allFinance = collectNotificationPlan({ ...state, financeNotifications: { enabled: true, defaultTime: '23:30' }, entries: [{ ...state.entries[0], reminder: { enabled: false } }], todo: { notifications: { enabled: false }, tasks: [] } }, now);
assert.equal(allFinance.length, 1, 'the general finance switch schedules dated entries without individual opt-in');
assert.equal(allFinance[0].schedule.at.getHours(), 23, 'the general finance reminder uses the configured default time');
assert.equal(allFinance[0].schedule.at.getMinutes(), 30);

const calls = [];
const makePlugin = ({ display = 'granted', exact = 'granted' } = {}) => ({
  async checkPermissions() { calls.push('check-display'); return { display }; },
  async requestPermissions() { calls.push('request-display'); return { display }; },
  async checkExactNotificationSetting() { calls.push('check-exact'); return { exact_alarm: exact }; },
  async getPending() { calls.push('get-pending'); return { notifications: [{ id: plan[0].id }, { id: 30001 }, { id: 70001 }] }; },
  async cancel({ notifications }) { calls.push(['cancel', notifications.map(x => x.id)]); },
  async schedule({ notifications }) { calls.push(['schedule', notifications]); return { notifications: notifications.map(x => ({ id: x.id })) }; },
});

calls.length = 0;
const exactDenied = await syncNotifications(state, makePlugin({ exact: 'denied' }), now);
assert.equal(exactDenied.status, 'scheduled-inexact', 'without exact-alarm access Android still receives an inexact wake-up alarm');
assert.equal(exactDenied.scheduled, 1);
assert.deepEqual(calls.find(x => Array.isArray(x) && x[0] === 'cancel')[1], [30001], 'current pending reminder IDs are preserved while stale reminders are cancelled');
assert.ok(calls.some(x => Array.isArray(x) && x[0] === 'schedule'), 'the reminder is still handed to Android when exact access is denied');

calls.length = 0;
const scheduled = await syncNotifications(state, makePlugin(), now);
assert.equal(scheduled.status, 'scheduled');
assert.equal(scheduled.scheduled, 1);
assert.deepEqual(calls.slice(0, 2), ['check-display', 'check-exact'], 'permissions are checked before touching pending alarms');
assert.deepEqual(calls.find(x => Array.isArray(x) && x[0] === 'cancel')[1], [30001], 'only stale app-owned IDs are reconciled');
const scheduleCall = calls.find(x => Array.isArray(x) && x[0] === 'schedule');
assert.equal(scheduleCall[1][0].schedule.allowWhileIdle, true);

calls.length = 0;
const displayDenied = await syncNotifications(state, makePlugin({ display: 'denied' }), now);
assert.equal(displayDenied.status, 'notification-permission-denied');
assert.ok(!calls.includes('get-pending'), 'notification denial does not clear already scheduled alarms');

console.log('Notification scheduling tests passed');

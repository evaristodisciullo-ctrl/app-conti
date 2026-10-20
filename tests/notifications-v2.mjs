import assert from 'node:assert/strict';
import { applyReminderToSeries, clearReminderOverrideFromSeries, collectNotificationPlan, effectiveReminder, notificationDefaults, reminderDate, stripDailySummarySettings, syncNotifications, uniqueReminderSeries } from '../v2/notifications.js';

const now = new Date(2026, 9, 1, 0, 0, 0, 0);
const item = { id: 'schedina', kind: 'expense', description: 'Schedina', date: '2026-10-19', datePrecision: 'day', reminder: { enabled: true, mode: 'due', time: '23:57', advanceDays: 0, advanceMinutes: 45 } };
const state = { financeNotifications: { enabled: false }, entries: [item], todo: { notifications: { enabled: false }, tasks: [] } };
const plan = collectNotificationPlan(state, now);
assert.equal(plan.length, 1, 'an individually enabled finance reminder is planned without enabling the global switch');
assert.equal(plan[0].body, 'Schedina');
assert.equal(plan[0].schedule.at.getFullYear(), 2026, 'date uses local device time');
assert.equal(plan[0].schedule.at.getMonth(), 9);
assert.equal(plan[0].schedule.at.getDate(), 19);
assert.equal(plan[0].schedule.at.getHours(), 23, 'chosen hour is used exactly');
assert.equal(plan[0].schedule.at.getMinutes(), 57, 'legacy minute offsets are ignored');
assert.equal(plan[0].schedule.allowWhileIdle, true, 'alarm requests delivery while idle/Doze');

const oneDayEarly = { ...item, reminder: { enabled: true, time: '18:00', advanceDays: 1 } };
const oneDay = reminderDate(oneDayEarly, 'finance', state);
assert.equal(oneDay.getDate(), 18, 'advance is in calendar days');
assert.equal(oneDay.getHours(), 18);
assert.equal(oneDay.getMinutes(), 0, 'no minutes are subtracted from the selected time');
const crossYear = reminderDate({ ...oneDayEarly, date: '2027-01-01' }, 'finance', state);
assert.equal(crossYear.getFullYear(), 2026, 'day advance crosses year boundaries');
assert.equal(crossYear.getMonth(), 11);
assert.equal(crossYear.getDate(), 31);

const monthly = [0, 1, 2].map(index => ({ id: `rent-${index}`, seriesId: 'rent-series', occurrenceIndex: index, date: `2026-${String(10 + index).padStart(2, '0')}-10`, reminder: { enabled: true, advanceDays: 1, time: '18:00' } }));
assert.equal(uniqueReminderSeries(monthly).length, 1, 'recurring series is presented once in the notification settings list');
const monthlyPlan = collectNotificationPlan({ financeNotifications: {}, entries: monthly, todo: {} }, now);
assert.equal(monthlyPlan.length, 3, 'a recurring monthly reminder is queued for every generated occurrence');
assert.deepEqual(monthlyPlan.map(x => x.schedule.at.getMonth()), [9, 10, 11], 'monthly reminders repeat in subsequent calendar months');
const changed = { ...monthly[0], date: '2026-10-20' };
const beforeChange = collectNotificationPlan({ financeNotifications: {}, entries: [monthly[0]], todo: {} }, now)[0];
const afterChange = collectNotificationPlan({ financeNotifications: {}, entries: [changed], todo: {} }, now)[0];
assert.equal(afterChange.id, beforeChange.id, 'date edits retain the occurrence notification ID');
assert.equal(afterChange.schedule.at.getDate(), 19, 'moving due date to the 20th moves reminder to the 19th');
assert.equal(afterChange.schedule.at.getHours(), 18, 'date edits retain selected notification hour');

const seriesItems = structuredClone(monthly);
const applied = applyReminderToSeries(seriesItems, 'rent-0', { enabled: true, advanceDays: 3, time: '07:45', mode: 'due' });
assert.equal(applied.length, 3, 'setting a recurring reminder updates all pending occurrences');
assert.ok(seriesItems.every(x => x.reminder.advanceDays === 3 && x.reminder.time === '07:45' && x.reminder.customized));
const middleSeries = structuredClone(monthly);applyReminderToSeries(middleSeries, 'rent-1', { enabled: true, advanceDays: 2, time: '08:00' });assert.ok(middleSeries.every(x => x.reminder.advanceDays === 2), 'a custom notification selected on a later occurrence applies to the whole pending recurring series');

const shared = { notificationSettings: { enabled: true, rule: { advanceDays: 1, time: '09:00' } }, financeNotifications: {}, entries: [
  { id: 'salary', kind: 'income', description: 'Stipendio', date: '2026-10-10', datePrecision: 'day' },
  { id: 'dentist', kind: 'income', description: 'Dentista', date: '2026-10-10', datePrecision: 'day', reminder: { enabled: true, customized: true, advanceDays: 0, time: '16:00' } },
  { id: 'bill', kind: 'expense', description: 'Bolletta', date: '2026-10-10', datePrecision: 'day' }
], todo: { tasks: [] } };
let sharedPlan = collectNotificationPlan(shared, now);
assert.deepEqual(sharedPlan.map(x => [x.body, x.schedule.at.getDate(), x.schedule.at.getHours()]), [['Stipendio', 9, 9], ['Dentista', 10, 16], ['Bolletta', 9, 9]], 'single-item custom notification takes precedence over shared defaults');
shared.notificationSettings = { enabled: true, rule: { advanceDays: 2, time: '10:00' } };
sharedPlan = collectNotificationPlan(shared, now);
assert.deepEqual(sharedPlan.map(x => [x.schedule.at.getDate(), x.schedule.at.getHours()]), [[8, 10], [10, 16], [8, 10]], 'changing shared settings never overwrites the personal reminder');
const resetSeries = [{ id: 'repeat-0', seriesId: 'repeat', occurrenceIndex: 0 }, { id: 'repeat-1', seriesId: 'repeat', occurrenceIndex: 1 }];
applyReminderToSeries(resetSeries, 'repeat-0', { enabled: true, advanceDays: 4, time: '07:30' });
clearReminderOverrideFromSeries(resetSeries, 'repeat-0');
assert.ok(resetSeries.every(x => !x.reminder), 'removing one recurring override returns all pending instances to shared defaults');
assert.equal(effectiveReminder({ id: 'global' }, 'finance', shared).advanceDays, 2);
assert.deepEqual(notificationDefaults(shared, 'finance').rule, { advanceDays: 2, time: '10:00' });
const obsolete = { todo: { notifications: { enabled: true, dailySummary: true, dailySummaryTime: '18:00', sent: {}, rule: { advanceMinutes: 10, timing: 'before' } } } };
assert.equal(stripDailySummarySettings(obsolete), true);
assert.deepEqual(collectNotificationPlan({ todo: { notifications: { enabled: true, dailySummary: true }, tasks: [] } }, now), [], 'daily summary settings never create notifications');

const calls = [];
const makePlugin = ({ display = 'granted', requested = 'granted', exact = 'granted', pending = [] } = {}) => ({
  async checkPermissions() { calls.push('check-display'); return { display }; },
  async requestPermissions() { calls.push('request-display'); return { display: requested }; },
  async checkExactNotificationSetting() { calls.push('check-exact'); return { exact_alarm: exact }; },
  async getPending() { calls.push('get-pending'); return { notifications: pending }; },
  async cancel({ notifications }) { calls.push(['cancel', notifications.map(x => x.id)]); },
  async schedule({ notifications }) { calls.push(['schedule', notifications]); return { notifications: notifications.map(x => ({ id: x.id })) }; },
});

calls.length = 0;
const exactDenied = await syncNotifications(state, makePlugin({ exact: 'denied', pending: [{ id: plan[0].id }] }), now);
assert.equal(exactDenied.status, 'exact-alarm-permission-required');
assert.ok(!calls.includes('get-pending'), 'missing exact-alarm permission does not cancel or replace alarms');
assert.ok(!calls.some(x => Array.isArray(x) && x[0] === 'schedule'), 'a reminder is not reported as scheduled without exact access');

calls.length = 0;
const displayDenied = await syncNotifications(state, makePlugin({ display: 'denied', requested: 'denied', pending: [{ id: plan[0].id }] }), now);
assert.equal(displayDenied.status, 'notification-permission-denied');
assert.ok(calls.includes('request-display'), 'Android notification permission is requested on first reminder use');
assert.ok(!calls.includes('get-pending'), 'notification denial preserves existing pending alarms');

calls.length = 0;
const grantedDisplay = await syncNotifications(state, makePlugin({ display: 'denied', requested: 'granted' }), now);
assert.equal(grantedDisplay.status, 'scheduled', 'granted display and exact permissions schedule reminders');
assert.deepEqual(calls.slice(0, 3), ['check-display', 'request-display', 'check-exact']);

const pendingRows = monthly.map((x, index) => ({ id: collectNotificationPlan({ financeNotifications: {}, entries: [x], todo: {} }, now)[0].id, occurrence: index }));
const completedState = { financeNotifications: {}, entries: [monthly[1], monthly[2]], todo: {} };
const activePlan = collectNotificationPlan(completedState, now);
calls.length = 0;
const completedSync = await syncNotifications(completedState, makePlugin({ pending: pendingRows.map(x => ({ id: x.id })) }), now);
assert.equal(completedSync.status, 'scheduled');
const cancelled = calls.find(x => Array.isArray(x) && x[0] === 'cancel')?.[1] || [];
assert.deepEqual(cancelled, [pendingRows[0].id], 'completing one occurrence cancels only its reminder; future occurrence alarms remain');
assert.deepEqual(calls.find(x => Array.isArray(x) && x[0] === 'schedule')[1].map(x => x.id), activePlan.map(x => x.id));

console.log('Notification tests passed: exact time/day arithmetic, recurrence deduplication and propagation, rescheduling on due-date change, specific-occurrence cancellation, Doze flag, and permission gates');

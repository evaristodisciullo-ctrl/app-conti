import assert from 'node:assert/strict';
import { applyReminderToSeries, clearReminderOverrideFromSeries, collectNotificationPlan, effectiveReminder, notificationDefaults, reminderDate, setFinanceReminderGroupEnabled, stripDailySummarySettings, syncNotifications, uniqueReminderSeries } from '../v2/notifications.js';
import { resolveNotificationRoute } from '../v2/notification-navigation.js';

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

const individualEnabledState = {
  financeNotifications: { enabled: false, rule: { advanceDays: 0, time: '09:00' } },
  entries: [{ id: 'one-off', date: '2026-10-10', datePrecision: 'day', reminder: { enabled: true, customized: false, enabledCustomized: true } }],
  history: [], todo: { tasks: [] }
};
assert.equal(effectiveReminder(individualEnabledState.entries[0], 'finance', individualEnabledState).enabled, true, 'an explicit individual enable overrides the global off state');
individualEnabledState.financeNotifications.rule.time = '11:00';
assert.equal(effectiveReminder(individualEnabledState.entries[0], 'finance', individualEnabledState).time, '11:00', 'an enabled-only override still follows the global time');
setFinanceReminderGroupEnabled(individualEnabledState, true);
setFinanceReminderGroupEnabled(individualEnabledState, false);
assert.equal(effectiveReminder(individualEnabledState.entries[0], 'finance', individualEnabledState).enabled, true, 'global changes preserve an explicit enabled-only override');

const mixedFinance = { financeNotifications: { enabled: true, defaultTime: '09:00', rule: { advanceDays: 0, time: '09:00' } }, entries: [
  { id: 'general-time', kind: 'income', description: 'Orario generale', date: '2026-10-10', datePrecision: 'day' },
  { id: 'personal-time', kind: 'income', description: 'Orario scelto', date: '2026-10-10', datePrecision: 'day', reminder: { enabled: true, customized: true, time: '07:30', advanceDays: 1 } },
  { id: 'legacy-time', kind: 'expense', description: 'Orario precedente ambiguo', date: '2026-10-10', datePrecision: 'day', reminder: { enabled: true, time: '08:45', advanceDays: 0 } }
], history: [], todo: {} };
mixedFinance.financeNotifications.defaultTime = '11:00';
mixedFinance.financeNotifications.rule.time = '11:00';
let mixedPlan = collectNotificationPlan(mixedFinance, now);
assert.deepEqual(mixedPlan.map(x => [x.body, x.schedule.at.getDate(), x.schedule.at.getHours()]), [['Orario generale', 10, 11], ['Orario scelto', 9, 7], ['Orario precedente ambiguo', 10, 8]], 'general reminder follows the changed default while explicit and ambiguous legacy times remain unchanged');
setFinanceReminderGroupEnabled(mixedFinance, false);
assert.equal(mixedFinance.entries[0].reminder, undefined, 'bulk disable never creates a personal override for a general-time entry');
assert.equal(mixedFinance.entries[1].reminder.time, '07:30', 'bulk disable preserves an explicitly selected time');
assert.equal(mixedFinance.entries[2].reminder.time, '08:45', 'bulk disable conservatively preserves an ambiguous legacy time');
assert.ok(mixedFinance.entries.slice(1).every(x => x.reminder.enabled === false), 'bulk disable turns off personalized finance reminders');
setFinanceReminderGroupEnabled(mixedFinance, true);
mixedPlan = collectNotificationPlan(mixedFinance, now);
assert.deepEqual(mixedPlan.map(x => [x.body, x.schedule.at.getDate(), x.schedule.at.getHours()]), [['Orario generale', 10, 11], ['Orario scelto', 9, 7], ['Orario precedente ambiguo', 10, 8]], 're-enabling does not pin general entries to an old time or change saved overrides');
const obsolete = { todo: { notifications: { enabled: true, dailySummary: true, dailySummaryTime: '18:00', sent: {}, rule: { advanceMinutes: 10, timing: 'before' } } } };
assert.equal(stripDailySummarySettings(obsolete), true);
const customTodo = { id: 'todo-custom', date: '2026-10-10', datePrecision: 'day', reminder: { enabled: true, customized: true, mode: 'custom', customAt: '2026-10-08T13:45', time: '09:00', advanceDays: 2 } };
const customTodoAt = reminderDate(customTodo, 'todo', { todo: { notifications: { enabled: true, rule: { advanceDays: 0, time: '11:00' } } } });
assert.equal(customTodoAt.getDate(), 8, 'custom To-do reminder uses its selected calendar date');
assert.equal(customTodoAt.getHours(), 13, 'custom To-do reminder uses its selected hour only');
assert.equal(customTodoAt.getMinutes(), 45, 'custom To-do reminder uses its selected minute only');
const switchedToDue = { ...customTodo, date: '2026-10-10', reminder: { ...customTodo.reminder, mode: 'due', time: '08:25', advanceDays: 1 } };
const switchedToDueAt = reminderDate(switchedToDue, 'todo', { todo: { notifications: { enabled: true, rule: { advanceDays: 0, time: '11:00' } } } });
assert.equal(switchedToDueAt.getDate(), 9, 'explicit due mode ignores a previously stored custom date');
assert.equal(switchedToDueAt.getHours(), 8);
assert.equal(switchedToDueAt.getMinutes(), 25, 'explicit due mode uses only its selected time');
assert.deepEqual(collectNotificationPlan({ todo: { notifications: { enabled: true, dailySummary: true }, tasks: [] } }, now), [], 'daily summary settings never create notifications');

const calls = [];
const makePlugin = ({ display = 'granted', requested = 'granted', exact = 'granted', pending = [], delivered = [] } = {}) => ({
  async checkPermissions() { calls.push('check-display'); return { display }; },
  async requestPermissions() { calls.push('request-display'); return { display: requested }; },
  async checkExactNotificationSetting() { calls.push('check-exact'); return { exact_alarm: exact }; },
  async getPending() { calls.push('get-pending'); return { notifications: pending }; },
  async cancel({ notifications }) { calls.push(['cancel', notifications.map(x => x.id)]); },
  async getDeliveredNotifications() { calls.push('get-delivered'); return { notifications: delivered }; },
  async removeDeliveredNotifications({ notifications }) { calls.push(['remove-delivered', notifications.map(x => x.id)]); },
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

const unconfirmedPlugin = makePlugin();
unconfirmedPlugin.schedule = async () => ({ notifications: [] });
const unconfirmed = await syncNotifications(state, unconfirmedPlugin, now);
assert.equal(unconfirmed.status, 'failed', 'the app never reports reminders scheduled when Android does not confirm their IDs');
assert.equal(unconfirmed.scheduled, 0);

const pendingRows = monthly.map((x, index) => ({ id: collectNotificationPlan({ financeNotifications: {}, entries: [x], todo: {} }, now)[0].id, occurrence: index }));
const completedState = { financeNotifications: {}, entries: [monthly[1], monthly[2]], todo: {} };
const activePlan = collectNotificationPlan(completedState, now);
calls.length = 0;
const completedSync = await syncNotifications(completedState, makePlugin({ pending: pendingRows.map(x => ({ id: x.id })), delivered: [{ id: pendingRows[0].id }, { id: pendingRows[1].id }, { id: 9 }] }), now);
assert.equal(completedSync.status, 'scheduled');
const cancelled = calls.find(x => Array.isArray(x) && x[0] === 'cancel')?.[1] || [];
assert.deepEqual(cancelled, [pendingRows[0].id], 'completing one occurrence cancels only its reminder; future occurrence alarms remain');
assert.deepEqual(calls.find(x => Array.isArray(x) && x[0] === 'remove-delivered')?.[1], [pendingRows[0].id], 'completing an occurrence removes its delivered notice but preserves notices for future occurrences');
assert.deepEqual(calls.find(x => Array.isArray(x) && x[0] === 'schedule')[1].map(x => x.id), activePlan.map(x => x.id));

calls.length=0;const clearedPlugin=makePlugin({pending:[{id:plan[0].id},{id:77}],delivered:[{id:plan[0].id},{id:88}]});
const emptySync=await syncNotifications({notificationSettings:{enabled:false},entries:[],todo:{tasks:[]}},clearedPlugin,now);
assert.equal(emptySync.status,'cleared');
assert.deepEqual(calls.find(x=>Array.isArray(x)&&x[0]==='cancel')?.[1],[plan[0].id],'disabling all reminders cancels only app-owned pending alarms and preserves unrelated plugin alarms');
assert.deepEqual(calls.find(x=>Array.isArray(x)&&x[0]==='remove-delivered')?.[1],[plan[0].id],'disabling all reminders clears only app-owned delivered notices');

const navState={entries:[{id:'income-1',kind:'income',date:'2027-02-12'}],history:[{id:'paid-1',kind:'expense',date:'2026-11-02'}],todo:{tasks:[{id:'task-1',date:'2027-03'}],done:[{id:'done-1',date:'2026-09'}]}};
assert.deepEqual(resolveNotificationRoute(navState,{extra:{kind:'finance',itemId:'income-1'}},'2026-10'),{screen:'income',itemId:'income-1',month:'2027-02',found:true,completed:false},'income tap resolves the entry screen and stored month');
assert.deepEqual(resolveNotificationRoute(navState,{extra:{kind:'finance',itemId:'paid-1'}},'2026-10'),{screen:'expense',itemId:'paid-1',month:'2026-11',found:true,completed:true},'completed finance tap stays in the correct income/payment list');
assert.deepEqual(resolveNotificationRoute(navState,{extra:{kind:'finance',itemId:'deleted-income',entryKind:'income',month:'2026-12'}},'2026-10'),{screen:'income',itemId:null,month:'2026-12',found:false,completed:false},'deleted finance item falls back to its correct list and saved month');
assert.deepEqual(resolveNotificationRoute(navState,{extra:{kind:'todo',itemId:'task-1'}},'2026-10'),{screen:'todo-active',itemId:'task-1',found:true,completed:false},'future Todo occurrence resolves to In scadenza');
assert.deepEqual(resolveNotificationRoute(navState,{extra:{kind:'todo',itemId:'done-1'}},'2026-10'),{screen:'todo-done',itemId:'done-1',found:true,completed:true},'completed Todo occurrence resolves to Già fatte');
assert.deepEqual(resolveNotificationRoute(navState,{extra:{kind:'todo',itemId:'deleted-task'}},'2026-10'),{screen:'todo-active',itemId:null,found:false,completed:false},'deleted activity falls back to In scadenza');

console.log('Notification tests passed: exact time/day arithmetic, recurrence deduplication and propagation, rescheduling on due-date change, specific-occurrence cancellation, Doze flag, and permission gates');

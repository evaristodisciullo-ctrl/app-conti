function stableId(prefix, value, used) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const start = prefix + (hash % 15000);
  let id = start;
  while (used.has(id)) id = prefix + ((id - prefix + 1) % 15000);
  used.add(id);
  return id;
}

function parseLocalDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function reminderSeriesKey(item) {
  return item.seriesId || item.recurrenceSource || item.id;
}

export function uniqueReminderSeries(items = []) {
  const bySeries = new Map();
  for (const item of items) {
    const key = reminderSeriesKey(item);
    const previous = bySeries.get(key);
    if (!previous || (item.occurrenceIndex || 0) < (previous.occurrenceIndex || 0)) bySeries.set(key, item);
  }
  return [...bySeries.values()];
}

export function applyReminderToSeries(items, itemId, reminder) {
  const source = items.find(item => item.id === itemId);
  if (!source) return [];
  const series = reminderSeriesKey(source);
  const firstIndex = source.occurrenceIndex || 0;
  const updated = [];
  for (const item of items) {
    if (item.id !== source.id && (reminderSeriesKey(item) !== series || (item.occurrenceIndex || 0) < firstIndex)) continue;
    item.reminder = { ...reminder };
    item.notify = Boolean(reminder.enabled);
    updated.push(item);
  }
  return updated;
}

export function reminderDate(item, kind, state) {
  const reminder = item.reminder || {};
  const legacyEnabled = kind === 'todo' ? item.notify : false;
  const enabled = reminder.enabled ?? legacyEnabled;
  if (!enabled) return null;
  // Retain compatibility with reminders created by older builds. New reminders
  // are always due-date based and never subtract minutes from the chosen time.
  if (reminder.mode === 'custom' || reminder.customAt) return parseLocalDateTime(reminder.customAt || reminder.at);
  if (!item.date) return null;
  const precision = item.datePrecision || (item.date.length === 7 ? 'month' : 'day');
  if (precision !== 'day' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return null;
  const [year, month, day] = item.date.split('-').map(Number);
  const at = new Date(year, month - 1, day, 9, 0, 0, 0);
  const prefs = kind === 'todo' ? state.todo?.notifications : state.financeNotifications;
  const time = reminder.time || prefs?.defaultTime || prefs?.rule?.time || '09:00';
  const [hour, minute] = String(time).split(':').map(Number);
  at.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
  const advanceDays = Math.max(0, Math.floor(Number(reminder.advanceDays ?? prefs?.rule?.advanceDays ?? 0) || 0));
  at.setDate(at.getDate() - advanceDays);
  return at;
}

export function collectNotificationPlan(state, now = new Date()) {
  const used = new Set();
  const out = [];
  const push = (prefix, key, title, body, at, extra = {}) => {
    if (!at || at <= now) return;
    // Android's exact allow-while-idle alarm can wake the device during Doze.
    out.push({ id: stableId(prefix, key, used), title, body, schedule: { at, allowWhileIdle: true }, extra });
  };

  const financeAll = Boolean(state.financeNotifications?.enabled);
  for (const item of state.entries || []) {
    const itemEnabled = item.reminder?.enabled ?? item.notify ?? false;
    if (!financeAll && !itemEnabled) continue;
    const scheduledItem = financeAll ? { ...item, reminder: { ...(item.reminder || {}), enabled: true } } : item;
    const at = reminderDate(scheduledItem, 'finance', state);
    if (at) push(30000, `finance:${item.id}`, 'In Ordine · Conti', item.description || 'Promemoria economico', at, { kind: 'finance', itemId: item.id });
  }

  const todoPrefs = state.todo?.notifications || {};
  for (const item of state.todo?.tasks || []) {
    const itemEnabled = item.reminder?.enabled ?? item.notify ?? false;
    if (!todoPrefs.enabled && !itemEnabled) continue;
    const scheduledItem = todoPrefs.enabled ? { ...item, reminder: { ...(item.reminder || {}), enabled: true } } : item;
    const at = reminderDate(scheduledItem, 'todo', state);
    if (at) push(10000, `todo:${item.id}`, 'In Ordine · Attività', item.description || 'Promemoria attività', at, { kind: 'todo', itemId: item.id });
  }

  if (todoPrefs.enabled && todoPrefs.dailySummary) {
    const [hour, minute] = String(todoPrefs.dailySummaryTime || '18:00').split(':').map(Number);
    for (let i = 0; i < 14; i += 1) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour || 0, minute || 0, 0, 0);
      const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
      const due = (state.todo.tasks || []).filter(item => item.date && (item.datePrecision === 'day' || (!item.datePrecision && item.date.length === 10)) && item.date === key).length;
      push(50000, `todo-daily:${key}`, 'In Ordine · Riepilogo', due ? `Hai ${due} attività in scadenza.` : 'Il tuo riepilogo giornaliero è pronto.', at, { kind: 'todo-daily', date: key });
    }
  }
  return out;
}

export async function syncNotifications(state, nativePlugin, now = new Date()) {
  if (!nativePlugin) return { status: 'unavailable', scheduled: 0 };
  try {
    const notifications = collectNotificationPlan(state, now);
    if (!notifications.length) {
      const pending = await nativePlugin.getPending();
      const owned = (pending.notifications || []).filter(item => item.id >= 10000 && item.id < 70000).map(item => ({ id: item.id }));
      if (owned.length) await nativePlugin.cancel({ notifications: owned });
      return { status: 'cleared', scheduled: 0 };
    }

    const permission = await nativePlugin.checkPermissions();
    if (permission.display !== 'granted') {
      const requested = await nativePlugin.requestPermissions();
      if (requested.display !== 'granted') return { status: 'notification-permission-denied', scheduled: 0 };
    }

    if (typeof nativePlugin.checkExactNotificationSetting !== 'function') {
      return { status: 'exact-alarm-setting-unavailable', scheduled: 0 };
    }
    const exact = await nativePlugin.checkExactNotificationSetting();
    if (exact.exact_alarm !== 'granted') return { status: 'exact-alarm-permission-required', scheduled: 0 };

    // Permission checks complete before mutating pending alarms. A revoked
    // permission therefore never destroys alarms already stored by Android.
    const pending = await nativePlugin.getPending();
    const plannedIds = new Set(notifications.map(item => item.id));
    const stale = (pending.notifications || []).filter(item => item.id >= 10000 && item.id < 70000 && !plannedIds.has(item.id)).map(item => ({ id: item.id }));
    if (stale.length) await nativePlugin.cancel({ notifications: stale });
    const result = await nativePlugin.schedule({ notifications });
    return { status: 'scheduled', exactAlarm: true, scheduled: result.notifications?.length ?? notifications.length };
  } catch (error) {
    console.warn('Notification sync failed', error);
    return { status: 'failed', scheduled: 0, error };
  }
}

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
  const updated = [];
  for (const item of items) {
    if (reminderSeriesKey(item) !== series) continue;
    item.reminder = { ...reminder, customized: true };
    item.notify = Boolean(reminder.enabled);
    updated.push(item);
  }
  return updated;
}

export function clearReminderOverrideFromSeries(items, itemId) {
  const source = items.find(item => item.id === itemId);
  if (!source) return [];
  const series = reminderSeriesKey(source);
  const updated = [];
  for (const item of items) {
    if (reminderSeriesKey(item) !== series) continue;
    delete item.reminder;
    delete item.notify;
    updated.push(item);
  }
  return updated;
}

export function notificationDefaults(state, kind) {
  const domain = kind === 'todo' ? state.todo?.notifications : state.financeNotifications;
  // V2 keeps independent defaults for finance and To-do. The shared object is
  // only a compatibility fallback for older backups that have no domain prefs.
  const hasDomainSettings = domain && (Object.hasOwn(domain, 'enabled') || Object.hasOwn(domain, 'rule'));
  const prefs = hasDomainSettings ? domain : state.notificationSettings;
  return {
    enabled: Boolean(prefs?.enabled),
    rule: {
      advanceDays: Math.max(0, Math.floor(Number(prefs?.rule?.advanceDays) || 0)),
      time: prefs?.rule?.time || prefs?.defaultTime || '09:00'
    }
  };
}

export function effectiveReminder(item, kind, state) {
  const stored = item.reminder || {};
  const legacyCustom = stored.customized === undefined && (
    (stored.enabled === true && (Object.hasOwn(stored, 'advanceDays') || Object.hasOwn(stored, 'time') || stored.mode === 'custom' || stored.customAt)) ||
    (!item.reminder && item.notify === true)
  );
  const customized = stored.customized === true || legacyCustom;
  const defaults = notificationDefaults(state, kind);
  if (customized) return {
    enabled: Boolean(stored.enabled ?? item.notify), customized: true,
    advanceDays: Math.max(0, Math.floor(Number(stored.advanceDays) || 0)),
    time: stored.time || '09:00', mode: stored.mode || 'due', customAt: stored.customAt || stored.at || ''
  };
  return {
    enabled: Boolean(defaults.enabled), customized: false,
    advanceDays: Math.max(0, Math.floor(Number(defaults.rule?.advanceDays) || 0)),
    time: defaults.rule?.time || '09:00', mode: 'due', customAt: ''
  };
}

export function stripDailySummarySettings(state) {
  let changed = false;
  for (const prefs of [state.todo?.notifications, state.financeNotifications]) {
    if (!prefs || typeof prefs !== 'object') continue;
    for (const key of ['dailySummary', 'dailySummaryTime', 'sent']) {
      if (Object.hasOwn(prefs, key)) { delete prefs[key]; changed = true; }
    }
    if (prefs.rule && typeof prefs.rule === 'object') {
      for (const key of ['timing', 'overdue', 'advanceMinutes']) {
        if (Object.hasOwn(prefs.rule, key)) { delete prefs.rule[key]; changed = true; }
      }
    }
  }
  return changed;
}

export function reminderDate(item, kind, state) {
  const reminder = effectiveReminder(item, kind, state);
  if (!reminder.enabled) return null;
  // Retain compatibility with reminders created by older builds. New reminders
  // are always due-date based and never subtract minutes from the chosen time.
  if (reminder.mode === 'custom' || reminder.customAt) return parseLocalDateTime(reminder.customAt || reminder.at);
  if (!item.date) return null;
  const precision = item.datePrecision || (item.date.length === 7 ? 'month' : 'day');
  if (precision !== 'day' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return null;
  const [year, month, day] = item.date.split('-').map(Number);
  const at = new Date(year, month - 1, day, 9, 0, 0, 0);
  const time = reminder.time || '09:00';
  const [hour, minute] = String(time).split(':').map(Number);
  at.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
  const advanceDays = Math.max(0, Math.floor(Number(reminder.advanceDays) || 0));
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

  for (const item of state.entries || []) {
    const at = reminderDate(item, 'finance', state);
    if (at) push(30000, `finance:${item.id}`, 'In Ordine · Conti', item.description || 'Promemoria economico', at, { kind: 'finance', itemId: item.id, entryKind: item.kind, month: item.date?.slice(0, 7) || '' });
  }

  const todoPrefs = state.todo?.notifications || {};
  for (const item of state.todo?.tasks || []) {
    const at = reminderDate(item, 'todo', state);
    if (at) push(10000, `todo:${item.id}`, 'In Ordine · Attività', item.description || 'Promemoria attività', at, { kind: 'todo', itemId: item.id });
  }

  return out;
}

export async function syncNotifications(state, nativePlugin, now = new Date()) {
  if (!nativePlugin) return { status: 'unavailable', scheduled: 0 };
  try {
    const notifications = collectNotificationPlan(state, now);
    const clearDelivered = async (keepIds) => {
      if (typeof nativePlugin.getDeliveredNotifications !== 'function' || typeof nativePlugin.removeDeliveredNotifications !== 'function') return;
      const delivered = await nativePlugin.getDeliveredNotifications();
      const stale = (delivered.notifications || []).filter(item => item.id >= 10000 && item.id < 70000 && !keepIds.has(item.id)).map(item => ({ id: item.id }));
      if (stale.length) await nativePlugin.removeDeliveredNotifications({ notifications: stale });
    };
    if (!notifications.length) {
      const pending = await nativePlugin.getPending();
      const owned = (pending.notifications || []).filter(item => item.id >= 10000 && item.id < 70000).map(item => ({ id: item.id }));
      if (owned.length) await nativePlugin.cancel({ notifications: owned });
      await clearDelivered(new Set());
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
    await clearDelivered(plannedIds);
    const result = await nativePlugin.schedule({ notifications });
    const scheduledIds = new Set((result.notifications || []).map(item => Number(item.id)));
    const scheduled = notifications.filter(item => scheduledIds.has(Number(item.id))).length;
    if (scheduled !== notifications.length) {
      return { status: 'failed', exactAlarm: true, scheduled, error: new Error(`Android confirmed ${scheduled} of ${notifications.length} reminders`) };
    }
    return { status: 'scheduled', exactAlarm: true, scheduled };
  } catch (error) {
    console.warn('Notification sync failed', error);
    return { status: 'failed', scheduled: 0, error };
  }
}

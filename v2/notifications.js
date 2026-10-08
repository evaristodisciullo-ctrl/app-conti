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

function reminderDate(item, kind, state) {
  const reminder = item.reminder || {};
  const legacyEnabled = kind === 'todo' ? item.notify : false;
  const enabled = reminder.enabled ?? legacyEnabled;
  if (!enabled) return null;
  if (reminder.mode === 'custom' || reminder.customAt) return parseLocalDateTime(reminder.customAt || reminder.at);
  if (!item.date) return null;
  const precision = item.datePrecision || (item.date.length === 7 ? 'month' : 'day');
  if (precision !== 'day' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return null;
  const due = item.date;
  const [year, month, day] = due.split('-').map(Number);
  const at = new Date(year, month - 1, day, 9, 0, 0, 0);
  const prefs = kind === 'todo' ? state.todo.notifications : state.financeNotifications;
  const time = reminder.time || prefs?.defaultTime || prefs?.rule?.time || '09:00';
  const [hour, minute] = String(time).split(':').map(Number);
  at.setHours(hour || 0, minute || 0, 0, 0);
  const advance = Math.max(0, Number(reminder.advanceMinutes ?? (kind === 'todo' ? prefs?.rule?.advanceMinutes : 0)) || 0);
  at.setMinutes(at.getMinutes() - advance);
  return at;
}

export function collectNotificationPlan(state, now = new Date()) {
  const used = new Set();
  const out = [];
  const push = (prefix, key, title, body, at, extra = {}) => {
    if (!at || at <= now) return;
    out.push({ id: stableId(prefix, key, used), title, body, schedule: { at }, extra });
  };

  if (state.financeNotifications?.enabled) {
    for (const item of state.entries || []) {
      const at = reminderDate(item, 'finance', state);
      if (at) push(30000, `finance:${item.id}`, 'In Ordine · Conti', item.description || 'Promemoria economico', at, { kind: 'finance', itemId: item.id });
    }
  }

  const todoPrefs = state.todo?.notifications || {};
  if (todoPrefs.enabled) {
    for (const item of state.todo?.tasks || []) {
      const at = reminderDate(item, 'todo', state);
      if (at) push(10000, `todo:${item.id}`, 'In Ordine · Attività', item.description || 'Promemoria attività', at, { kind: 'todo', itemId: item.id });
    }
    if (todoPrefs.dailySummary) {
      const [hour, minute] = String(todoPrefs.dailySummaryTime || '18:00').split(':').map(Number);
      for (let i = 0; i < 14; i += 1) {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour || 0, minute || 0, 0, 0);
        const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
        const due = (state.todo.tasks || []).filter(item => item.date && (item.datePrecision === 'day' || (!item.datePrecision && item.date.length === 10)) && item.date === key).length;
        push(50000, `todo-daily:${key}`, 'In Ordine · Riepilogo', due ? `Hai ${due} attività in scadenza.` : 'Il tuo riepilogo giornaliero è pronto.', at, { kind: 'todo-daily', date: key });
      }
    }
  }
  return out;
}

export async function syncNotifications(state, nativePlugin, now = new Date()) {
  if (!nativePlugin) return;
  try {
    const notifications = collectNotificationPlan(state, now);
    const pending = await nativePlugin.getPending();
    const owned = (pending.notifications || []).filter(item => item.id >= 10000 && item.id < 70000).map(item => ({ id: item.id }));
    if (owned.length) await nativePlugin.cancel({ notifications: owned });
    if (!notifications.length) return;
    const permission = await nativePlugin.checkPermissions();
    if (permission.display !== 'granted') {
      const requested = await nativePlugin.requestPermissions();
      if (requested.display !== 'granted') return;
    }
    await nativePlugin.schedule({ notifications });
  } catch (error) {
    console.warn('Notification sync failed', error);
  }
}

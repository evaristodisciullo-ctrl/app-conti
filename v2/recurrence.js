const unitFromLegacy = value => ({ daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[value] || null);

export function normalizeRecurrenceRule(value, fallbackCount = 12) {
  if (!value || value === 'none') return null;
  if (typeof value === 'string') {
    const unit = unitFromLegacy(value) || value;
    return ['day', 'week', 'month', 'year'].includes(unit)
      ? { unit, interval: 1, end: 'count', count: fallbackCount, until: '' }
      : null;
  }
  const unit = unitFromLegacy(value.unit) || value.unit;
  if (!['day', 'week', 'month', 'year'].includes(unit)) return null;
  const end = ['never', 'count', 'date'].includes(value.end) ? value.end : 'count';
  return {
    unit,
    interval: Math.max(1, Math.min(365, Number(value.interval) || 1)),
    end,
    count: Math.max(1, Math.min(5000, Number(value.count) || fallbackCount)),
    until: typeof value.until === 'string' ? value.until : ''
  };
}

function dateOrdinal(value, precision) {
  if (!value) return null;
  if (precision === 'month' || value.length === 7) return `${value}-01`;
  return value;
}

function advance(value, precision, unit, interval) {
  if (!value) return '';
  if (precision === 'month' || value.length === 7) {
    if (unit === 'day' || unit === 'week') return value;
    const [year, month] = value.split('-').map(Number);
    const offset = unit === 'year' ? interval * 12 : interval;
    const at = new Date(Date.UTC(year, month - 1 + offset, 1, 12));
    return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const [year, month, day] = value.split('-').map(Number);
  if (unit === 'day' || unit === 'week') {
    const at = new Date(Date.UTC(year, month - 1, day + interval * (unit === 'week' ? 7 : 1), 12));
    return at.toISOString().slice(0, 10);
  }
  const targetMonth = month - 1 + (unit === 'year' ? interval * 12 : interval);
  const first = new Date(Date.UTC(year, targetMonth, 1, 12));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).getUTCDate();
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function horizonOrdinal(now, precision, months) {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() + months);
  return precision === 'month' ? date.toISOString().slice(0, 7) : date.toISOString().slice(0, 10);
}

export function generateOccurrenceDates(date, precision = 'day', ruleValue = null, options = {}) {
  const rule = normalizeRecurrenceRule(ruleValue);
  if (!date) return [];
  if (!rule) return [{ date, index: 0 }];
  if (precision !== 'month' && date.length === 7) precision = 'month';
  if (precision === 'month' && (rule.unit === 'day' || rule.unit === 'week')) return [{ date, index: 0 }];
  const now = options.now ? new Date(options.now) : new Date();
  const cutoff = rule.end === 'date' && rule.until
    ? rule.until
    : rule.end === 'never'
      ? horizonOrdinal(now, precision, options.horizonMonths ?? 18)
      : null;
  const cap = rule.end === 'count' ? rule.count : (options.maxOccurrences ?? 2000);
  const out = [{ date, index: 0 }];
  let current = date;
  for (let index = 1; index < cap; index += 1) {
    current = advance(date, precision, rule.unit, rule.interval * index);
    if (!current || current === out.at(-1).date) break;
    if (rule.end === 'date' && (!rule.until || dateOrdinal(current, precision) > dateOrdinal(rule.until, precision))) break;
    if (rule.end === 'never' && current > cutoff) break;
    out.push({ date: current, index });
  }
  return out;
}

function legacyRule(entry, count) {
  const unit = unitFromLegacy(entry.recurrence);
  return unit ? { unit, interval: 1, end: 'count', count: Math.max(count, unit === 'year' ? 3 : 12), until: '' } : null;
}

function migrateCollection(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.seriesId || item.recurrenceSource || (item.recurrence && item.recurrence !== 'none' ? item.id : null);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  for (const [seriesId, group] of groups) {
    group.sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    const root = group.find(item => item.id === seriesId) || group[0];
    const rule = normalizeRecurrenceRule(root.recurrenceRule) || legacyRule(root, group.length);
    group.forEach((item, index) => {
      item.seriesId = seriesId;
      if (!Number.isInteger(item.occurrenceIndex)) item.occurrenceIndex = index;
      if (rule && !item.recurrenceRule) item.recurrenceRule = rule;
      if (!item.datePrecision) item.datePrecision = item.date?.length === 7 ? 'month' : item.date ? 'day' : 'none';
    });
  }
}

export function migrateLegacyRecurrences(state) {
  migrateCollection([...(state.entries || []), ...(state.history || [])]);
  migrateCollection([...(state.todo?.tasks || []), ...(state.todo?.done || [])]);
  return state;
}

export function recurrenceRuleFromForm(prefix, documentRef = document) {
  const unitValue = documentRef.querySelector(`#${prefix}Recurrence`)?.value || 'none';
  if (unitValue === 'none') return null;
  const unit = unitValue === 'custom'
    ? documentRef.querySelector(`#${prefix}RecurrenceUnit`)?.value
    : unitFromLegacy(unitValue) || unitValue;
  return normalizeRecurrenceRule({
    unit,
    interval: documentRef.querySelector(`#${prefix}RecurrenceInterval`)?.value,
    end: documentRef.querySelector(`#${prefix}RecurrenceEnd`)?.value || 'count',
    count: documentRef.querySelector(`#${prefix}RecurrenceCount`)?.value || (unit === 'year' ? 3 : 12),
    until: documentRef.querySelector(`#${prefix}RecurrenceUntil`)?.value || ''
  });
}

export function dateValueFromForm(prefix, documentRef = document) {
  const mode = documentRef.querySelector(`#${prefix}DateMode`)?.value || 'day';
  if (mode === 'none') return { date: '', datePrecision: 'none' };
  if (mode === 'month') return { date: documentRef.querySelector(`#${prefix}Month`)?.value || '', datePrecision: 'month' };
  return { date: documentRef.querySelector(`#${prefix}Date`)?.value || '', datePrecision: 'day' };
}

export function restoreDateForm(prefix, item, documentRef = document) {
  const precision = item.datePrecision || (item.date?.length === 7 ? 'month' : item.date ? 'day' : 'none');
  const mode = documentRef.querySelector(`#${prefix}DateMode`);
  if (mode) mode.value = precision;
  const day = documentRef.querySelector(`#${prefix}Date`);
  const month = documentRef.querySelector(`#${prefix}Month`);
  if (day) day.value = precision === 'day' ? item.date || '' : '';
  if (month) month.value = precision === 'month' ? item.date || '' : '';
}

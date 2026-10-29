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
  if (precision === 'year' || value.length === 4) return `${value}-01-01`;
  if (precision === 'month' || value.length === 7) return `${value}-01`;
  return value;
}

function advance(value, precision, unit, interval) {
  if (!value) return '';
  if (precision === 'year' || value.length === 4) return unit === 'year' ? String(Number(value) + interval) : value;
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
  return precision === 'year' ? date.toISOString().slice(0, 4) : precision === 'month' ? date.toISOString().slice(0, 7) : date.toISOString().slice(0, 10);
}

export function generateOccurrenceDates(date, precision = 'day', ruleValue = null, options = {}) {
  const rule = normalizeRecurrenceRule(ruleValue);
  if (!date) return [];
  if (!rule) return [{ date, index: 0 }];
  if (!precision || precision === 'none') return [{date,index:0}];
  if (precision !== 'month' && date.length === 7) precision = 'month';
  if (precision !== 'year' && precision !== 'month' && precision !== 'day') return [{date,index:0}];
  if (precision === 'year' && rule.unit !== 'year') return [{date,index:0}];
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

/** Resolve every occurrence in a calendar month directly, without a look-ahead cap. */
export function occurrencesInMonth(date, precision = 'day', ruleValue = null, targetMonth = '') {
  const rule = normalizeRecurrenceRule(ruleValue);
  if (!rule || !/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) return [];
  if (precision !== 'month' && date?.length === 7) precision = 'month';
  if (!['day', 'month'].includes(precision) || !['day', 'week', 'month', 'year'].includes(rule.unit)) return [];
  if (precision === 'day' && !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return [];
  if (precision === 'month' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(date || '')) return [];
  const [baseYear, baseMonth] = date.slice(0, 7).split('-').map(Number);
  const [year, month] = targetMonth.split('-').map(Number);
  if (rule.unit === 'day' || rule.unit === 'week') {
    if (precision !== 'day') return [];
    const baseOrdinal = Date.UTC(baseYear, baseMonth - 1, Number(date.slice(8, 10)), 12);
    const step = rule.interval * (rule.unit === 'week' ? 7 : 1);
    const lastDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate(), out = [];
    for (let day = 1; day <= lastDay; day += 1) {
      const current = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const delta = Math.round((Date.UTC(year, month - 1, day, 12) - baseOrdinal) / 86400000);
      if (delta < 0 || delta % step) continue;
      const index = delta / step;
      if (rule.end === 'count' && index >= rule.count) continue;
      if (rule.end === 'date' && (!rule.until || current > rule.until)) continue;
      out.push({ date: current, index });
    }
    return out;
  }
  const monthDelta = (year - baseYear) * 12 + month - baseMonth;
  if (monthDelta < 0) return [];
  let index;
  if (rule.unit === 'month') {
    if (monthDelta % rule.interval !== 0) return [];
    index = monthDelta / rule.interval;
  } else {
    const yearDelta = year - baseYear;
    if (month !== baseMonth || yearDelta < 0 || yearDelta % rule.interval !== 0) return [];
    index = yearDelta / rule.interval;
  }
  if (rule.end === 'count' && index >= rule.count) return [];
  const occurrenceDate = advance(date, precision, rule.unit, rule.interval * index);
  if (!occurrenceDate || occurrenceDate.slice(0, 7) !== targetMonth) return [];
  if (rule.end === 'date' && (!rule.until || dateOrdinal(occurrenceDate, precision) > dateOrdinal(rule.until, precision))) return [];
  return [{ date: occurrenceDate, index }];
}

export function occurrenceInMonth(date, precision = 'day', ruleValue = null, targetMonth = '') {
  return occurrencesInMonth(date, precision, ruleValue, targetMonth)[0] || null;
}

export function recurrenceRuleForItem(item, count = 1) {
  return normalizeRecurrenceRule(item?.recurrenceRule) || legacyRule(item || {}, count);
}

function legacyRule(entry, count) {
  const unit = unitFromLegacy(entry.recurrence);
  return unit ? { unit, interval: 1, end: 'count', count: Math.max(count, unit === 'year' ? 3 : 12), until: '' } : null;
}

function migrateCollection(items, legacyEnd = 'count') {
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
    const rule = normalizeRecurrenceRule(root.recurrenceRule) || (() => { const unit = unitFromLegacy(root.recurrence); return unit ? { unit, interval: 1, end: legacyEnd, count: Math.max(group.length, unit === 'year' ? 3 : 12), until: '' } : null; })();
    group.forEach((item, index) => {
      item.seriesId = seriesId;
      if (!Number.isInteger(item.occurrenceIndex)) item.occurrenceIndex = index;
      if (rule && !item.recurrenceRule) item.recurrenceRule = rule;
      if (!item.datePrecision) item.datePrecision = item.date?.length === 7 ? 'month' : item.date ? 'day' : 'none';
    });
  }
}

export function migrateLegacyRecurrences(state) {
  migrateCollection([...(state.entries || []), ...(state.history || [])], 'never');
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
 const mode=documentRef.querySelector(`#${prefix}DateMode`)?.value||'day';
 let value='';
 if(mode==='none')return {date:'',datePrecision:'none'};
 if(mode==='day')value=documentRef.querySelector(`#${prefix}Date`)?.value||'';
 if(mode==='month')value=documentRef.querySelector(`#${prefix}Month`)?.value||'';
 if(mode==='dayOnly'){const n=Number(documentRef.querySelector(`#${prefix}DayPart`)?.value);value=n?String(n).padStart(2,'0'):''}
 if(mode==='monthOnly')value=documentRef.querySelector(`#${prefix}MonthPart`)?.value||'';
 if(mode==='year'){const n=Number(documentRef.querySelector(`#${prefix}YearPart`)?.value);value=n?String(n):''}
 if(mode==='dayMonth'){const d=Number(documentRef.querySelector(`#${prefix}DayMonthPart`)?.value),m=documentRef.querySelector(`#${prefix}DayMonthMonth`)?.value||'';value=d&&m?`${m}-${String(d).padStart(2,'0')}`:''}
 return value&&validPartial(value,mode)?{date:value,datePrecision:mode}:{date:'',datePrecision:'none'};
}
function validPartial(value,mode){
 if(mode==='day')return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'));
 if(mode==='month')return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
 if(mode==='year')return /^\d{4}$/.test(value);
 if(mode==='monthOnly')return /^(0[1-9]|1[0-2])$/.test(value);
 if(mode==='dayOnly')return /^(0[1-9]|[12]\d|3[01])$/.test(value);
 if(mode==='dayMonth'){const [m,d]=value.split('-').map(Number);return /^\d{2}-\d{2}$/.test(value)&&m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(2000,m,0)).getUTCDate()}
 return false;
}
export function restoreDateForm(prefix,item,documentRef=document){
 const precision=item.datePrecision||inferPrecision(item.date||'');
 const mode=documentRef.querySelector(`#${prefix}DateMode`);if(mode)mode.value=precision;
 const set=(id,value)=>{const input=documentRef.querySelector(`#${prefix}${id}`);if(input)input.value=value||''};
 if(precision==='day')set('Date',item.date);
 else if(precision==='month')set('Month',item.date);
 else if(precision==='year')set('YearPart',item.date);
 else if(precision==='dayOnly')set('DayPart',Number(item.date));
 else if(precision==='monthOnly')set('MonthPart',item.date);
 else if(precision==='dayMonth'){const [m,d]=item.date.split('-');set('DayMonthMonth',m);set('DayMonthPart',Number(d))}
}
function inferPrecision(value){if(!value)return'none';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return'day';if(/^\d{4}-\d{2}$/.test(value))return'month';if(/^\d{4}$/.test(value))return'year';if(/^\d{2}$/.test(value))return'dayOnly';if(/^\d{2}-\d{2}$/.test(value))return'dayMonth';return'none';}

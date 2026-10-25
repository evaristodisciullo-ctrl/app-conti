import { Capacitor, Preferences } from './platform.js';

const STORAGE_KEY = 'inOrdineV2State';
const LEGACY_KEY = 'inOrdineContiV1';
const RESTORE_GUARD_KEY = 'inOrdineV2RestoreGuard';

function nativePreferences() {
  return Capacitor.isNativePlatform() ? Preferences : null;
}

async function readRaw(key) {
  const prefs = nativePreferences();
  if (prefs) return (await prefs.get({ key })).value;
  return globalThis.localStorage.getItem(key);
}

async function writeRaw(key, value) {
  const prefs = nativePreferences();
  if (prefs) {
    await prefs.set({ key, value });
    return;
  }
  globalThis.localStorage.setItem(key, value);
}

async function removeRaw(key) {
  const prefs = nativePreferences();
  if (prefs) return prefs.remove({ key });
  globalThis.localStorage.removeItem(key);
}

export function createEmptyState() {
  return {
    version: 2,
    welcomeCompleted: false,
    balance: null,
    profile: { fullName: '' },
    appColor: 'Blu',
    entries: [],
    history: [],
    adjustments: [],
    budgets: {},
    budgetPlans: [],
    financeNotifications: { enabled: false, defaultTime: '09:00' },
    notificationSettings: { enabled: false, rule: { advanceDays: 0, time: '09:00' } },
    todo: {
      setupDone: false,
      tasks: [],
      done: [],
      color: 'Verde E.D.S.',
      theme: 'light',
      notifications: {
        enabled: false,
        rule: { advanceDays: 0, time: '09:00' }
      }
    },
    preferences: {
      textSize: 'medium',
      reduceAnimations: false,
      lightTheme: true,
      showSuggestions: true,
      dateFormat: 'dd/mm/yyyy'
    }
  };
}

function normalize(candidate) {
  const base = createEmptyState();
  if (!candidate || typeof candidate !== 'object') return base;
  const out = { ...base, ...candidate, version: 2, welcomeCompleted: candidate.welcomeCompleted ?? true };
  out.profile = { ...base.profile, ...(candidate.profile || {}) };
  out.todo = { ...base.todo, ...(candidate.todo || {}) };
  out.todo.tasks = Array.isArray(candidate.todo?.tasks) ? candidate.todo.tasks : [];
  out.todo.done = Array.isArray(candidate.todo?.done) ? candidate.todo.done : [];
  out.todo.notifications = { ...base.todo.notifications, ...(candidate.todo?.notifications || {}) };
  out.todo.notifications.rule = { ...base.todo.notifications.rule, ...(candidate.todo?.notifications?.rule || {}) };
  out.financeNotifications = { ...base.financeNotifications, ...(candidate.financeNotifications || {}) };
  const oldTodoNotifications = candidate.todo?.notifications || {};
  const oldFinanceNotifications = candidate.financeNotifications || {};
  out.notificationSettings = candidate.notificationSettings ? {
    enabled: Boolean(candidate.notificationSettings.enabled),
    rule: { advanceDays: 0, time: '09:00', ...(candidate.notificationSettings.rule || {}) }
  } : {
    enabled: Boolean(oldFinanceNotifications.enabled || oldTodoNotifications.enabled),
    rule: {
      advanceDays: Math.max(0, Number(oldTodoNotifications.rule?.advanceDays ?? oldFinanceNotifications.rule?.advanceDays) || 0),
      time: oldTodoNotifications.rule?.time || oldFinanceNotifications.rule?.time || oldFinanceNotifications.defaultTime || '09:00'
    }
  };
  // Migrate the former shared defaults once. Current finance and To-do
  // preferences remain independent after the migration instead of being
  // overwritten with the shared value every time the app starts.
  if (!candidate.financeNotifications) {
    out.financeNotifications = {
      ...base.financeNotifications,
      enabled: Boolean(candidate.notificationSettings?.enabled ?? oldFinanceNotifications.enabled ?? out.notificationSettings.enabled),
      defaultTime: candidate.notificationSettings?.rule?.time || oldFinanceNotifications.defaultTime || oldFinanceNotifications.rule?.time || out.notificationSettings.rule.time,
      rule: { ...out.notificationSettings.rule, ...(oldFinanceNotifications.rule || {}) }
    };
  }
  if (!candidate.todo?.notifications) {
    out.todo.notifications = {
      ...base.todo.notifications,
      enabled: Boolean(oldTodoNotifications.enabled ?? candidate.notificationSettings?.enabled ?? out.notificationSettings.enabled),
      rule: { ...out.notificationSettings.rule, ...(oldTodoNotifications.rule || {}) }
    };
  }
  out.preferences = { ...base.preferences, ...(candidate.preferences || {}) };
  out.entries = Array.isArray(candidate.entries) ? candidate.entries : [];
  out.history = Array.isArray(candidate.history) ? candidate.history : [];
  out.adjustments = Array.isArray(candidate.adjustments) ? candidate.adjustments : [];
  out.budgetPlans = Array.isArray(candidate.budgetPlans) ? candidate.budgetPlans : [];
  out.budgets = candidate.budgets && typeof candidate.budgets === 'object' ? candidate.budgets : {};
  return out;
}

export async function loadState() {
  const guardRaw = await readRaw(RESTORE_GUARD_KEY);
  if (guardRaw) {
    const guard = JSON.parse(guardRaw);
    if (!Object.prototype.hasOwnProperty.call(guard, 'previousRaw')) throw new Error('RESTORE_GUARD_INVALID');
    if (guard.previousRaw === null) await removeRaw(STORAGE_KEY);
    else await writeRaw(STORAGE_KEY, guard.previousRaw);
    await removeRaw(RESTORE_GUARD_KEY);
  }
  let raw = await readRaw(STORAGE_KEY);
  if (!raw) {
    const legacy = globalThis.localStorage?.getItem(LEGACY_KEY);
    if (legacy) raw = legacy;
  }
  if (!raw) return createEmptyState();
  try {
    const state = normalize(JSON.parse(raw));
    await saveState(state);
    return state;
  } catch (error) {
    // Keep unreadable data intact. Returning an empty state here used to let
    // startup code overwrite the only copy of a user's information.
    const protectedState = createEmptyState();
    Object.defineProperty(protectedState, '_storageError', { value: true, enumerable: false });
    console.error('In Ordine data could not be read; original storage was preserved.', error);
    return protectedState;
  }
}

export async function saveState(state) {
  if (state?._storageError) throw new Error('STORAGE_READ_FAILED');
  const normalized = normalize(state);
  await writeRaw(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function restoreStateSafely(candidate) {
  const normalized = normalize(candidate);
  const previousRaw = await readRaw(STORAGE_KEY);
  await writeRaw(RESTORE_GUARD_KEY, JSON.stringify({ previousRaw, createdAt: new Date().toISOString() }));
  try {
    await writeRaw(STORAGE_KEY, JSON.stringify(normalized));
    const savedRaw = await readRaw(STORAGE_KEY);
    if (!savedRaw || JSON.stringify(normalize(JSON.parse(savedRaw))) !== JSON.stringify(normalized)) {
      throw new Error('RESTORE_VERIFY_FAILED');
    }
    await removeRaw(RESTORE_GUARD_KEY);
    return normalized;
  } catch (error) {
    // Restore the exact previous bytes, including a legacy or unreadable value.
    if (previousRaw === null) await removeRaw(STORAGE_KEY);
    else await writeRaw(STORAGE_KEY, previousRaw);
    await removeRaw(RESTORE_GUARD_KEY);
    throw error;
  }
}

export async function updateState(mutator) {
  const current = await loadState();
  const next = await mutator(structuredClone(current)) || current;
  return saveState(next);
}

export const stateStorageKey = STORAGE_KEY;

const STORAGE_KEY = 'inOrdineV2State';
const LEGACY_KEY = 'inOrdineContiV1';

function nativePreferences() {
  return globalThis.Capacitor?.Plugins?.Preferences || null;
}

async function readRaw(key) {
  const prefs = nativePreferences();
  if (prefs) return (await prefs.get({ key })).value;
  return localStorage.getItem(key);
}

async function writeRaw(key, value) {
  const prefs = nativePreferences();
  if (prefs) {
    await prefs.set({ key, value });
    return;
  }
  localStorage.setItem(key, value);
}

export function createEmptyState() {
  return {
    version: 2,
    balance: null,
    profile: { fullName: '' },
    appColor: 'Blu',
    entries: [],
    history: [],
    adjustments: [],
    budgets: {},
    budgetPlans: [],
    todo: {
      setupDone: false,
      tasks: [],
      done: [],
      color: 'Verde E.D.S.',
      theme: 'light',
      notifications: { enabled: false, rule: { timing: 'same', time: '09:00', overdue: 'none' }, sent: {} }
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
  const out = { ...base, ...candidate, version: 2 };
  out.profile = { ...base.profile, ...(candidate.profile || {}) };
  out.todo = { ...base.todo, ...(candidate.todo || {}) };
  out.todo.tasks = Array.isArray(candidate.todo?.tasks) ? candidate.todo.tasks : [];
  out.todo.done = Array.isArray(candidate.todo?.done) ? candidate.todo.done : [];
  out.todo.notifications = { ...base.todo.notifications, ...(candidate.todo?.notifications || {}) };
  out.preferences = { ...base.preferences, ...(candidate.preferences || {}) };
  out.entries = Array.isArray(candidate.entries) ? candidate.entries : [];
  out.history = Array.isArray(candidate.history) ? candidate.history : [];
  out.adjustments = Array.isArray(candidate.adjustments) ? candidate.adjustments : [];
  out.budgetPlans = Array.isArray(candidate.budgetPlans) ? candidate.budgetPlans : [];
  out.budgets = candidate.budgets && typeof candidate.budgets === 'object' ? candidate.budgets : {};
  return out;
}

export async function loadState() {
  let raw = await readRaw(STORAGE_KEY);
  if (!raw) {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) raw = legacy;
  }
  if (!raw) return createEmptyState();
  try {
    const state = normalize(JSON.parse(raw));
    await saveState(state);
    return state;
  } catch {
    return createEmptyState();
  }
}

export async function saveState(state) {
  const normalized = normalize(state);
  await writeRaw(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function updateState(mutator) {
  const current = await loadState();
  const next = await mutator(structuredClone(current)) || current;
  return saveState(next);
}

export const stateStorageKey = STORAGE_KEY;

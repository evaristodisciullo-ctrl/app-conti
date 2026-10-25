const FORMAT = 'in-ordine-backup';
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export async function checksumState(state) {
  if (!globalThis.crypto?.subtle) throw new Error('CHECKSUM_UNAVAILABLE');
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(state)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export async function createBackup(state, exportedAt = new Date().toISOString()) {
  return {
    format: FORMAT,
    schemaVersion: 1,
    exportedAt,
    app: 'In Ordine',
    state,
    integrity: { algorithm: 'SHA-256', digest: await checksumState(state) }
  };
}

export async function validateBackup(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('FILE_INVALID');
  const isCurrent = parsed.format === FORMAT;
  const isLegacy = parsed.format === 'in-ordine-v2';
  const candidate = isCurrent || isLegacy ? parsed.state : parsed;
  if (isCurrent && (parsed.schemaVersion !== 1 || parsed.integrity?.algorithm !== 'SHA-256' || typeof parsed.integrity.digest !== 'string')) throw new Error('FORMAT_UNSUPPORTED');
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('DATA_MISSING');
  if (Number(candidate.version) !== 2) throw new Error('FORMAT_UNSUPPORTED');
  for (const key of ['entries', 'history', 'adjustments', 'budgetPlans']) {
    if (!Array.isArray(candidate[key])) throw new Error('DATA_INCOMPLETE');
  }
  if (!candidate.todo || typeof candidate.todo !== 'object' || Array.isArray(candidate.todo) || !Array.isArray(candidate.todo.tasks) || !Array.isArray(candidate.todo.done)) throw new Error('DATA_INCOMPLETE');
  if (!candidate.profile || typeof candidate.profile !== 'object' || !candidate.preferences || typeof candidate.preferences !== 'object') throw new Error('DATA_INCOMPLETE');
  if (candidate.budgets === null || typeof candidate.budgets !== 'object' || Array.isArray(candidate.budgets)) throw new Error('DATA_INCOMPLETE');
  if (isCurrent && await checksumState(candidate) !== parsed.integrity.digest) throw new Error('FILE_DAMAGED');
  return structuredClone(candidate);
}

export function backupFileName(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `InOrdine_Backup_${day}-${month}-${date.getFullYear()}.json`;
}

export async function readBackupText(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('FILE_TOO_LARGE');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('FILE_INVALID'); }
  return validateBackup(parsed);
}

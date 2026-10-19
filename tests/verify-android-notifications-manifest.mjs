import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'android/app/build/intermediates/merged_manifest/debug');
async function findManifests(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await findManifests(path));
    else if (entry.name === 'AndroidManifest.xml') found.push(path);
  }
  return found;
}

const candidates = await findManifests(root);
assert.ok(candidates.length, `No merged Android manifest found under ${root}`);
let manifest = '';
for (const file of candidates) {
  const content = await readFile(file, 'utf8');
  if (content.includes('LocalNotificationRestoreReceiver')) { manifest = content; break; }
}
assert.ok(manifest, 'Merged APK manifest includes the Capacitor local notification restore receiver');
for (const name of ['android.permission.POST_NOTIFICATIONS','android.permission.SCHEDULE_EXACT_ALARM','android.permission.RECEIVE_BOOT_COMPLETED','android.intent.action.BOOT_COMPLETED','android.intent.action.LOCKED_BOOT_COMPLETED']) {
  assert.ok(manifest.includes(name), `Merged APK manifest must contain ${name}`);
}
console.log('Merged APK notification permissions and reboot receiver verified.');

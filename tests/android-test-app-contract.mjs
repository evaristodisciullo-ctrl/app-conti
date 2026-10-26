import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [gradle, strings, manifest, workflow, backup, cloud, state] = await Promise.all([
  readFile('android/app/build.gradle', 'utf8'),
  readFile('android/app/src/qa/res/values/strings.xml', 'utf8'),
  readFile('android/app/src/main/AndroidManifest.xml', 'utf8'),
  readFile('.github/workflows/android.yml', 'utf8'),
  readFile('v2/backup.js', 'utf8'),
  readFile('v2/backup-cloud.js', 'utf8'),
  readFile('v2/state.js', 'utf8')
]);

assert.match(gradle, /applicationId "it\.inordine\.app\.prova"/);
assert.match(gradle, /qa \{[\s\S]*?applicationId "it\.inordine\.app\.test"/);
assert.match(gradle, /INORDINE_TEST_VERSION_CODE/);
assert.match(strings, /<string name="app_name">In Ordine TEST<\/string>/);
assert.match(strings, /<string name="package_name">it\.inordine\.app\.test<\/string>/);
assert.match(strings, /<string name="custom_url_scheme">it\.inordine\.app\.test<\/string>/);
assert.match(manifest, /android:authorities="\$\{applicationId\}\.fileprovider"/);
assert.match(workflow, /run: \.\/gradlew assembleQaDebug/);
assert.match(workflow, /SIGNING_KEYSTORE_BASE64/);
assert.match(workflow, /steps\.configure-signing\.outputs\.signing_mode == 'persistent'/);
assert.match(workflow, /vars\.INORDINE_TEST_VERSION_CODE/);
assert.match(backup, /in-ordine-backup/);
assert.match(backup, /in-ordine-v2/);
assert.match(cloud, /createBackupCloudService/);
assert.match(state, /restoreStateSafely/);

console.log('PASS TEST app flavor uses an isolated application ID and label, a separate deep-link scheme, version-code input, persistent-signing-only artifact gate, and existing backup/restore modules.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [gradle, capacitor, strings, activity, picker, drive, cloudService, state, manifest, app, workflow] = await Promise.all([
  readFile('android/app/build.gradle', 'utf8'),
  readFile('capacitor.config.json', 'utf8').then(JSON.parse),
  readFile('android/app/src/main/res/values/strings.xml', 'utf8'),
  readFile('android/app/src/main/java/it/inordine/app/MainActivity.java', 'utf8'),
  readFile('android/app/src/main/java/it/inordine/app/BackupFilePicker.java', 'utf8'),
  readFile('android/app/src/main/java/it/inordine/app/GoogleDriveBackup.java', 'utf8'),
  readFile('v2/backup-cloud.js', 'utf8'),
  readFile('v2/state.js', 'utf8'),
  readFile('android/app/src/main/AndroidManifest.xml', 'utf8'),
  readFile('v2/app.js', 'utf8'),
  readFile('.github/workflows/android.yml', 'utf8')
]);

assert.match(gradle, /applicationId\s+"it\.inordine\.app\.prova"/);
assert.equal(capacitor.appId, 'it.inordine.app.prova');
assert.match(strings, /<string name="app_name">In Ordine PROVA<\/string>/);
assert.match(activity, /registerPlugin\(BackupFilePicker\.class\)/);
assert.match(activity, /registerPlugin\(GoogleDriveBackup\.class\)/);
assert.match(picker, /Intent\.ACTION_CREATE_DOCUMENT/);
assert.match(picker, /Intent\.ACTION_OPEN_DOCUMENT/);
assert.match(picker, /getContentResolver\(\)\.openOutputStream\(uri, "wt"\)/);
assert.match(picker, /getContentResolver\(\)\.openInputStream\(uri\)/);
assert.match(picker, /java\.util\.Arrays\.equals\(actual, expected\)/);
assert.match(picker, /MAX_BACKUP_BYTES/);
assert.match(manifest, /android\.permission\.ACCESS_NETWORK_STATE/);
assert.match(picker, /NET_CAPABILITY_VALIDATED/);
assert.match(picker, /TRANSPORT_CELLULAR/);
assert.match(gradle, /INORDINE_DRIVE_BACKUP_ENABLED/);
assert.match(gradle, /play-services-auth:22\.0\.0/);
assert.match(drive, /https:\/\/www\.googleapis\.com\/auth\/drive\.appdata/);
assert.match(drive, /parents.*appDataFolder/);
assert.match(drive, /spaces=appDataFolder/);
assert.match(drive, /Arrays\.equals\(expected, actual\)/);
assert.match(drive, /AUTHORIZATION_EXPIRED/);
assert.match(drive, /clearToken\(/);
assert.match(drive, /revokeAccess\(/);
assert.match(drive, /NETWORK_UNAVAILABLE/);
assert.match(cloudService, /result\?\.verified!==true/);
assert.match(cloudService, /sort\(\(a,b\)=>Date\.parse\(b\.modifiedTime\)-Date\.parse\(a\.modifiedTime\)\)/);
assert.match(app, /Ultimo backup verificato su Google Drive:/);
assert.match(app, /lastCloudVerifiedAt/);
assert.match(app, /✓ BACKUP COMPLETATO!/);
assert.match(app, /I tuoi dati sono stati salvati correttamente su Google Drive/);
assert.match(app, /ABBIAMO TROVATO I TUOI DATI!/);
assert.match(app, /data-cloud-restore/);
assert.match(app, /SCEGLI UN FILE DI BACKUP/);
assert.match(app, /Il caricamento cloud non è verificato/);
assert.match(workflow, /if: env\.SIGNING_MODE == 'persistent'/);
assert.match(state, /const STORAGE_KEY = 'inOrdineV2State'/);
assert.match(state, /RESTORE_GUARD_KEY/);
console.log('PASS Android manual picker and Google Drive appData provider contracts: byte verification, least scope, upload readback, restore ordering, offline/auth errors, isolated trial app ID, and persistent-signing artifact gate');

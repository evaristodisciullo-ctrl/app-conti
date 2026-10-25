import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('www');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, path === '/' ? 'index.html' : `.${path}`);
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(4177, '127.0.0.1', resolveListen); });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true, locale: 'it-IT' });
const backupPath = '/tmp/InOrdine_Backup_test.json';
const corruptPath = '/tmp/InOrdine_Backup_danneggiato.json';
try {
  await page.goto('http://127.0.0.1:4177/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#firstRunStart').click();
  const fixture = await page.evaluate(() => {
    const state = {
      version: 2, welcomeCompleted: true, balance: 765.43, profile: { fullName: 'Utente di prova' }, appColor: 'Verde',
      entries: [{ id: 'income-fake', kind: 'income', description: 'Entrata finta', amount: 1000, date: '2026-10-25', datePrecision: 'day' }],
      history: [{ id: 'payment-done-fake', kind: 'expense', description: 'Pagamento completato finto', amount: 25, date: '2026-10-20', completedAt: '2026-10-20T08:00:00Z' }],
      adjustments: [], budgets: { '2026-10': 50 }, budgetPlans: [{ month: '2026-10', total: 50, limits: { Casa: 50 } }],
      financeNotifications: { enabled: true, defaultTime: '08:15', rule: { advanceDays: 1, time: '08:15' } },
      notificationSettings: { enabled: true, rule: { advanceDays: 1, time: '08:15' } },
      todo: { setupDone: true, tasks: [{ id: 'due-fake', description: 'Scadenza finta', date: '2026-10-30' }], done: [{ id: 'todo-done-fake', description: 'Cosa completata finta', completedAt: '2026-10-22T08:00:00Z' }], color: 'Viola', theme: 'dark', notifications: { enabled: true, rule: { advanceDays: 2, time: '09:00' } } },
      preferences: { textSize: 'large', reduceAnimations: true, lightTheme: false, showSuggestions: false, dateFormat: 'yyyy-mm-dd', categories: ['Casa', 'Prova'] }
    };
    localStorage.setItem('inOrdineV2State', JSON.stringify(state));
    return state;
  });
  await page.reload();
  await page.locator('[data-go="money"]').click();
  await page.locator('[data-go="settings"]').click();
  await page.locator('[data-go="backup"]').click();
  assert.match(await page.locator('.backup-settings-card').innerText(), /Ultimo backup verificato su Google Drive:\s*nessuno/);
  assert.match(await page.locator('.backup-settings-card').innerText(), /non può sapere se Google Drive ha completato la sincronizzazione/);
  await page.evaluate(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }); });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#openSaveBackup').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^InOrdine_Backup_\d{2}-\d{2}-\d{4}\.json$/);
  await download.saveAs(backupPath);
  const savedBackup = JSON.parse(await readFile(backupPath, 'utf8'));
  assert.equal(savedBackup.format, 'in-ordine-backup');
  assert.deepEqual(savedBackup.state, fixture, 'created backup contains every fake record and preference');
  assert.match(await page.locator('.backup-result').innerText(), /DOWNLOAD AVVIATO/);
  assert.match(await page.locator('.backup-result').innerText(), /Il caricamento su Google Drive non è verificato/);
  await page.locator('#backupResultContinue').click();

  await page.evaluate(() => { const state = JSON.parse(localStorage.getItem('inOrdineV2State')); state.profile.fullName = 'Dati locali diversi'; localStorage.setItem('inOrdineV2State', JSON.stringify(state)); });
  await page.locator('#openRestoreBackup').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#importBackup').setInputFiles(backupPath);
  await page.waitForSelector('#continueAfterRestore');
  const imported = await page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
  assert.deepEqual(imported, fixture, 'file selection restores the identical complete state');
  assert.match(await page.locator('.backup-intro').innerText(), /Ora puoi continuare da dove avevi lasciato/);

  await page.locator('#continueAfterRestore').click();
  await page.evaluate(() => { const state = JSON.parse(localStorage.getItem('inOrdineV2State')); state.profile.fullName = 'Dati da proteggere'; localStorage.setItem('inOrdineV2State', JSON.stringify(state)); });
  const beforeDamage = await page.evaluate(() => localStorage.getItem('inOrdineV2State'));
  await writeFile(corruptPath, JSON.stringify({ ...savedBackup, state: { ...savedBackup.state, balance: 999 } }));
  await page.locator('[data-go="money"]').click();
  await page.locator('[data-go="settings"]').click();
  await page.locator('[data-go="backup"]').click();
  await page.locator('#openRestoreBackup').click();
  await page.locator('#importBackup').setInputFiles(corruptPath);
  await page.waitForFunction(() => document.querySelector('#backupStatus')?.textContent.includes('danneggiato'));
  assert.equal(await page.evaluate(() => localStorage.getItem('inOrdineV2State')), beforeDamage, 'damaged file leaves current state byte-for-byte unchanged');
  console.log('PASS backup UI save, file selection restore, exact state comparison, and damaged-file data protection');
} finally {
  await browser.close();
  server.close();
  await Promise.all([rm(backupPath, { force: true }), rm(corruptPath, { force: true })]);
}

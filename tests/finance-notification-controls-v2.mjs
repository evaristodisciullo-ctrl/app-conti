import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('www');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);
    if (file !== root && !file.startsWith(root + sep)) return res.writeHead(403).end();
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(4177, '127.0.0.1', resolveListen); });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 850 }, locale: 'it-IT' });
const acceptedConfirmations = [];
page.on('dialog', async dialog => { acceptedConfirmations.push(dialog.message()); await dialog.accept(); });
const reminder = (enabled, time, advanceDays) => ({ enabled, customized: true, mode: 'due', time, advanceDays });
const fixture = {
  version: 2, balance: 0,
  entries: [
    { id: 'salary', kind: 'income', description: 'Stipendio', amount: 1000, date: '2026-10-30', datePrecision: 'day', reminder: reminder(true, '08:15', 1), notify: true },
    { id: 'rent', kind: 'expense', description: 'Affitto', amount: 400, date: '2026-11-02', datePrecision: 'day', reminder: reminder(true, '09:45', 2), notify: true }
  ],
  history: [{ id: 'paid-history', kind: 'expense', description: 'Voce pagata', amount: 1, date: '2026-10-20', datePrecision: 'day', reminder: reminder(true, '11:30', 0), notify: true }],
  adjustments: [], budgetPlans: [],
  notificationSettings: { enabled: true, rule: { advanceDays: 0, time: '09:00' } },
  financeNotifications: { enabled: true, defaultTime: '09:00', rule: { advanceDays: 0, time: '09:00' } },
  todo: { tasks: [], done: [], notifications: { enabled: true, rule: { advanceDays: 3, time: '07:00' } } },
  preferences: { categories: [], moneyFilters: {} }
};

try {
  await page.addInitScript(value => { if (!localStorage.getItem('inOrdineV2State')) localStorage.setItem('inOrdineV2State', JSON.stringify(value)); }, fixture);
  await page.goto('http://127.0.0.1:4177/');
  const openFinanceSettings = async () => {
    if (await page.locator('#financeNotificationsForm').count()) return;
    if (await page.locator('[data-go="money"]').count()) await page.locator('[data-go="money"]').click();
    if (await page.locator('[data-go="settings"]').count()) await page.locator('[data-go="settings"]').click();
    await page.locator('[data-go="finance-notifications"]').click();
  };
  await openFinanceSettings();
  assert.equal(await page.locator('#displayPermissionStatus').count(), 1, 'general finance settings expose Android display permission status');
  assert.equal(await page.locator('[data-request-exact-alarm]').count(), 1, 'general settings expose the shared permission control');
  assert.match(await page.locator('.notification-entry').first().innerText(), /non programmato/i, 'the list does not claim a reminder is scheduled when the browser/native scheduler did not confirm it');

  const salaryRow = page.locator('.notification-entry').filter({ hasText: 'Stipendio' });
  await salaryRow.locator('[data-edit-money-notice]').click();
  assert.equal(await page.locator('[data-request-exact-alarm]').count(), 1, 'single-operation settings expose the same Android permission control');
  assert.equal(await page.locator('#displayPermissionStatus').count(), 1, 'single-operation screen shows notification permission status');
  await page.locator('[data-disable-single-reminder]').click();
  assert.equal(await page.locator('[data-disable-single-reminder]').isDisabled(), true, 'disabled notification is clearly shown as disabled');
  assert.equal(await page.locator('[data-disable-single-reminder]').innerText(), 'Disattiva notifica', 'the disable action keeps its requested label even when disabled');
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
  assert.equal(saved.entries.find(item => item.id === 'salary').reminder.enabled, false, 'single action disables the selected finance reminder');
  assert.deepEqual([saved.entries.find(item => item.id === 'salary').reminder.time, saved.entries.find(item => item.id === 'salary').reminder.advanceDays], ['08:15', 1], 'single disable preserves the saved time and day offset');
  assert.equal(saved.entries.find(item => item.id === 'rent').reminder.enabled, true, 'single disable leaves other reminders unchanged');
  await page.reload();
  await openFinanceSettings();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
  assert.equal(saved.entries.find(item => item.id === 'salary').reminder.enabled, false, 'single disable persists across app reload');
  assert.equal(saved.entries.find(item => item.id === 'rent').reminder.enabled, true, 'other reminder remains active after reload');

  await page.locator('#disableAllFinanceNotifications').click();
  assert.match(acceptedConfirmations.at(-1), /tutte le notifiche/i, 'bulk disable requests confirmation');
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
  assert.ok(saved.entries.every(item => item.reminder.enabled === false), 'bulk disable turns off every income and payment reminder');
  assert.ok(saved.history.every(item => item.reminder.enabled === false), 'bulk disable includes saved completed finance operations');
  assert.equal(saved.financeNotifications.enabled, false, 'bulk disable updates general finance activation state');
  assert.equal(saved.todo.notifications.enabled, true, 'bulk finance disable does not change To-do notification settings');
  assert.deepEqual(saved.entries.map(item => [item.reminder.time, item.reminder.advanceDays]), [['08:15', 1], ['09:45', 2]], 'bulk disable preserves every entry time and offset');

  await page.reload();
  await openFinanceSettings();
  assert.equal(await page.locator('#financeNotificationsEnabled').isChecked(), false, 'general disabled state persists after reload');
  await page.locator('.notification-entry').filter({ hasText: 'Affitto' }).locator('[data-edit-money-notice]').click();
  await page.locator('#reminderSetupForm button[type="submit"]').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
  assert.equal(saved.entries.find(item => item.id === 'rent').reminder.enabled, true, 'a single reminder can be re-enabled after global disable');
  assert.equal(saved.entries.find(item => item.id === 'salary').reminder.enabled, false, 're-enabling one reminder leaves the rest disabled');
  assert.equal(saved.financeNotifications.enabled, false, 'single reminder activation does not silently switch on all notifications');
  assert.equal(saved.entries.find(item => item.id === 'rent').reminder.time, '09:45', 'single reactivation retains its stored time');
  assert.equal(saved.entries.find(item => item.id === 'rent').reminder.advanceDays, 2, 'single reactivation retains its stored offset');

  await page.reload();
  await openFinanceSettings();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
  assert.equal(saved.entries.find(item => item.id === 'rent').reminder.enabled, true, 'single reactivation survives app reload');
  assert.equal(saved.entries.find(item => item.id === 'salary').reminder.enabled, false, 'unselected reminders stay disabled after reload');

  await page.locator('#financeNotificationsEnabled').check();
  await page.locator('#financeNotificationsForm button[type="submit"]').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
  assert.ok(saved.entries.every(item => item.reminder.enabled === true), 'turning on all finance notifications activates all current operations');
  assert.equal(saved.todo.notifications.enabled, true, 'finance-wide enable preserves To-do settings');
  console.log('PASS finance notification controls: single disable, global confirmation/disable, reactivation, permission access, saved times, and reload persistence');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}

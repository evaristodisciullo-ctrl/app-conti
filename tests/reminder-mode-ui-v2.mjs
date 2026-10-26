import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { reminderDate } from '../v2/notifications.js';

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
await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(4181, '127.0.0.1', resolveListen); });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 850 }, locale: 'it-IT' });
const fixture = {
  version: 2, balance: 0, entries: [], history: [], adjustments: [], budgetPlans: [],
  financeNotifications: { enabled: false, rule: { advanceDays: 0, time: '09:00' } },
  notificationSettings: { enabled: false, rule: { advanceDays: 0, time: '09:00' } },
  todo: { tasks: [], done: [], notifications: { enabled: true, rule: { advanceDays: 0, time: '09:00' } } },
  profile: { namePromptCompleted: true }, preferences: { categories: [] }
};
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
const entry = async description => (await stored()).todo.tasks.find(item => item.description === description);
const visible = async selector => page.locator(selector).evaluate(el => !el.hidden && getComputedStyle(el).display !== 'none');

try {
  await page.addInitScript(value => localStorage.setItem('inOrdineV2State', JSON.stringify(value)), fixture);
  await page.goto('http://127.0.0.1:4181/');
  await page.locator('[data-go="todo"]').click();
  await page.locator('[data-go="todo-add"]').click();
  await page.locator('#todoDescription').fill('Attività con orario generale');
  await page.locator('#todoDate').fill('2026-12-02');
  await page.locator('#todoNotify').check();
  assert.equal(await visible('[data-reminder-time="todo"]'), true, 'due-date mode shows the time field');
  assert.equal(await visible('[data-reminder-advance="todo"]'), true, 'due-date mode shows days before due date');
  assert.equal(await visible('[data-reminder-custom="todo"]'), false, 'due-date mode hides the custom date and time');
  await page.locator('#todoForm button[type="submit"]').click();
  let general = await entry('Attività con orario generale');
  assert.equal(general.reminder.customized, false, 'checking a reminder without choosing a different time keeps it on general settings');
  assert.equal(reminderDate(general, 'todo', (await stored())).getHours(), 9, 'the initial general time is scheduled');

  await page.locator('[data-go="todo"]').click();
  await page.locator('[data-go="todo-notifications"]').click();
  await page.locator('#todoDefaultTime').fill('11:00');
  await page.locator('#todoSettingsForm button[type="submit"]').click();
  let state = await stored();
  general = state.todo.tasks.find(item => item.description === 'Attività con orario generale');
  assert.equal(reminderDate(general, 'todo', state).getHours(), 11, 'changing general time updates the existing uncustomized reminder');

  await page.locator('[data-go="todo"]').click();
  await page.locator('[data-go="todo-add"]').click();
  await page.locator('#todoDescription').fill('Attività con data personalizzata');
  await page.locator('#todoDate').fill('2026-12-02');
  await page.locator('#todoNotify').check();
  await page.locator('#todoReminderMode').selectOption('custom');
  assert.equal(await visible('[data-reminder-time="todo"]'), false, 'custom mode hides the separate time field during creation');
  assert.equal(await visible('[data-reminder-advance="todo"]'), false, 'custom mode hides the due-date offset during creation');
  assert.equal(await visible('[data-reminder-custom="todo"]'), true, 'custom mode shows only the custom date and time');
  await page.locator('#todoCustomAt').fill('2026-12-01T13:45');
  await page.locator('#todoForm button[type="submit"]').click();
  let custom = await entry('Attività con data personalizzata');
  state = await stored();
  assert.equal(custom.reminder.mode, 'custom');
  assert.equal(custom.reminder.customized, true);
  assert.equal(reminderDate(custom, 'todo', state).getTime(), new Date(2026, 11, 1, 13, 45).getTime(), 'created custom reminder schedules exactly its selected local date and time');

  await page.locator('[data-go="todo"]').click();
  const customId = custom.id;
  await page.locator(`[data-edit-task="${customId}"]`).click();
  assert.equal(await visible('[data-reminder-time="todoEdit"]'), false, 'editing an existing custom reminder also hides the separate time field');
  assert.equal(await visible('[data-reminder-custom="todoEdit"]'), true, 'editing keeps the selected custom date and time visible');
  await page.locator('#todoEditCustomAt').fill('2026-12-01T16:20');
  await page.locator('#todoEditForm button[type="submit"]').click();
  custom = await entry('Attività con data personalizzata');
  state = await stored();
  assert.equal(reminderDate(custom, 'todo', state).getTime(), new Date(2026, 11, 1, 16, 20).getTime(), 'editing custom reminder reschedules to the chosen date and time');

  await page.locator('[data-go="todo"]').click();
  await page.locator(`[data-edit-task="${customId}"]`).click();
  await page.locator('#todoEditReminderMode').selectOption('due');
  assert.equal(await visible('[data-reminder-time="todoEdit"]'), true, 'switching the existing task back to due mode restores its time control');
  assert.equal(await visible('[data-reminder-advance="todoEdit"]'), true, 'switching back to due mode restores days-before control');
  assert.equal(await visible('[data-reminder-custom="todoEdit"]'), false, 'switching back to due mode hides the custom date and time');
  await page.locator('#todoEditReminderTime').fill('08:25');
  await page.locator('#todoEditAdvanceDays').fill('1');
  await page.locator('#todoEditForm button[type="submit"]').click();
  custom = await entry('Attività con data personalizzata');
  state = await stored();
  const dueAt = reminderDate(custom, 'todo', state);
  assert.equal(dueAt.getDate(), 1, 'due mode uses the due-date offset after editing');
  assert.equal(dueAt.getHours(), 8);
  assert.equal(dueAt.getMinutes(), 25, 'due mode uses its selected time without the old custom date');

  console.log('PASS To-do reminder create/edit UI: due mode shows time and days, custom mode shows only date-time, created/edited schedules follow the selected mode, and global time updates general reminders.');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}

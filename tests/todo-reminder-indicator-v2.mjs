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
const page = await browser.newPage({ viewport: { width: 390, height: 850 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'it-IT' });
const savedReminder = enabled => ({ enabled, customized: true, mode: 'due', advanceDays: 0, time: '09:00' });
const fixture = {
  version: 2, balance: 0, profile: { fullName: 'Test', namePromptCompleted: true }, entries: [], history: [], adjustments: [], budgetPlans: [],
  financeNotifications: { enabled: false, defaultTime: '09:00' },
  todo: { tasks: [
    { id: 'todo-on', description: 'Avviso attivo', date: '2026-10-30', datePrecision: 'day', reminder: savedReminder(true), notify: true },
    { id: 'todo-off', description: 'Avviso disattivato', date: '2026-10-30', datePrecision: 'day', reminder: savedReminder(false), notify: false },
    { id: 'todo-default', description: 'Avviso generale', date: '2026-10-30', datePrecision: 'day' }
  ], done: [{ id: 'todo-done', description: 'Attività completata', date: '2026-10-20', datePrecision: 'day', completedAt: '2026-10-20T12:00:00.000Z' }], notifications: { enabled: false, rule: { advanceDays: 0, time: '09:00' } } },
  preferences: { categories: [], moneyFilters: {} }
};
try {
  await page.addInitScript(value => { if (!localStorage.getItem('inOrdineV2State')) localStorage.setItem('inOrdineV2State', JSON.stringify(value)); }, fixture);
  await page.goto('http://127.0.0.1:4177/');
  const openActive = async () => { await page.locator('[data-go="todo"]').click(); await page.locator('[data-go="todo-active"]').click(); };
  const row = id => page.locator(`[data-edit-task="${id}"]`);
  const assertBadge = async (id, active) => {
    const bell = row(id).locator('.todo-list-bell');
    assert.equal(await bell.count(), 1, `${id} keeps its bell`);
    assert.equal(await bell.evaluate(el => el.classList.contains('is-notification-active')), active, `${id} badge follows effective saved notification state`);
    const badge = await bell.evaluate(el => { const s = getComputedStyle(el, '::after'); return { content: s.content, background: s.backgroundColor, color: s.color, width: s.width, height: s.height }; });
    if (active) assert.deepEqual(badge, { content: '"✓"', background: 'rgb(20, 150, 111)', color: 'rgb(255, 255, 255)', width: '14px', height: '14px' }, `${id} displays the green circle and white check`);
    else assert.equal(badge.content, 'none', `${id} has no check when its notification is disabled`);
  };
  await openActive();
  await assertBadge('todo-on', true);
  await assertBadge('todo-off', false);
  await assertBadge('todo-default', false);
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 850 });
    const rects = await Promise.all(['todo-on', 'todo-off'].map(id => row(id).evaluate(el => {
      const base = el.getBoundingClientRect();
      const rect = node => { const r = node.getBoundingClientRect(); return [r.x - base.x, r.y - base.y, r.width, r.height]; };
      return [rect(el), rect(el.querySelector('.todo-list-bell')), rect(el.querySelector('.todo-task-name')), rect(el.querySelector('.todo-complete'))];
    })));
    assert.deepEqual(rects[0], rects[1], `active indicator does not shift task/card geometry at ${width}px`);
  }

  await row('todo-default').locator('.todo-task-name').click();
  await page.locator('#todoEditNotify').check();
  await page.locator('#todoEditForm button[type="submit"]').click();
  await assertBadge('todo-default', true);
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
  assert.equal(saved.todo.tasks.find(item => item.id === 'todo-default').reminder.enabled, true, 'individual activation is saved');
  assert.equal(saved.todo.tasks.find(item => item.id === 'todo-default').reminder.enabledCustomized, true, 'individual activation is tracked separately from a custom time');
  assert.equal(saved.todo.tasks.find(item => item.id === 'todo-default').reminder.customized, false, 'using the default time does not label the reminder as time-personalized');
  await page.reload(); await openActive(); await assertBadge('todo-default', true);

  await row('todo-default').locator('.todo-task-name').click();
  await page.locator('#todoEditNotify').uncheck();
  await page.locator('#todoEditForm button[type="submit"]').click();
  await assertBadge('todo-default', false);
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
  assert.equal(saved.todo.tasks.find(item => item.id === 'todo-default').reminder.enabled, false, 'individual deactivation is saved');
  assert.equal(saved.todo.tasks.find(item => item.id === 'todo-default').reminder.enabledCustomized, true, 'individual deactivation remains separate from the time override');
  await page.reload(); await openActive(); await assertBadge('todo-default', false);

  await page.locator('.todo-list-screen [data-go="todo"]').click();
  await page.locator('[data-go="todo-settings"]').click();
  await page.locator('[data-go="todo-notifications"]').click();
  await page.locator('#todoNotifications').check();
  await page.locator('#todoSettingsForm button[type="submit"]').click();
  await page.locator('.todo-head [data-go="todo"]').click(); await page.locator('[data-go="todo-active"]').click();
  await assertBadge('todo-on', true);
  await assertBadge('todo-off', false);
  await assertBadge('todo-default', false);
  const globalState = await page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
  assert.equal(globalState.todo.notifications.enabled, true, 'global activation persists');
  await page.reload(); await openActive();
  await assertBadge('todo-on', true); await assertBadge('todo-off', false); await assertBadge('todo-default', false);

  await page.locator('.todo-list-screen [data-go="todo"]').click(); await page.locator('[data-go="todo-done"]').click();
  assert.equal(await page.locator('.todo-item-card .todo-list-bell').count(), 0, 'completed activities have no notification bells to mark');
  console.log('PASS Todo reminder checks preserve individual overrides when global settings change, update immediately, persist after reload, and do not alter card geometry at 320/360/390/430px');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}

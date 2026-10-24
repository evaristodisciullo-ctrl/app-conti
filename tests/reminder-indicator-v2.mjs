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
await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(4176, '127.0.0.1', resolveListen); });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 850 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'it-IT' });
const page = await context.newPage();
const reminder = enabled => ({ enabled, customized: true, mode: 'due', advanceDays: 0, time: '09:00' });
const fixture = {
  version: 2, balance: 0, entries: [
    { id: 'income-on', kind: 'income', description: 'Operazione uguale', amount: 12, date: '2026-10-30', datePrecision: 'day', reminder: reminder(true), notify: true },
    { id: 'income-off', kind: 'income', description: 'Operazione uguale', amount: 12, date: '2026-10-30', datePrecision: 'day', reminder: reminder(false), notify: false },
    { id: 'expense-on', kind: 'expense', description: 'Operazione uguale', amount: 12, date: '2026-10-30', datePrecision: 'day', reminder: reminder(true), notify: true },
    { id: 'expense-off', kind: 'expense', description: 'Operazione uguale', amount: 12, date: '2026-10-30', datePrecision: 'day', reminder: reminder(false), notify: false }
  ], history: [], adjustments: [], budgetPlans: [],
  notificationSettings: { enabled: false, rule: { advanceDays: 0, time: '09:00' } },
  financeNotifications: { enabled: false, defaultTime: '09:00' },
  todo: { tasks: [], done: [], notifications: { enabled: false, rule: { advanceDays: 0, time: '09:00' } } },
  preferences: { categories: [], moneyFilters: {} }
};

try {
  await page.addInitScript(value => { if (!localStorage.getItem('inOrdineV2State')) localStorage.setItem('inOrdineV2State', JSON.stringify(value)); }, fixture);
  await page.goto('http://127.0.0.1:4176/');
  await page.locator('[data-go="money"]').click();

  const row = id => page.locator(`[data-edit-money="${id}"]`);
  const bell = id => row(id).locator('.money-list-bell');
  const assertBadge = async (id, active) => {
    const control = bell(id);
    assert.equal(await control.count(), 1, `${id} keeps its reminder bell`);
    assert.equal(await control.evaluate(el => el.classList.contains('is-notification-active')), active, `${id} badge follows its saved enabled state`);
    const pseudo = await control.evaluate(el => {
      const s = getComputedStyle(el, '::after');
      return { content: s.content, background: s.backgroundColor, color: s.color, width: s.width, height: s.height };
    });
    if (active) assert.deepEqual(pseudo, { content: '"✓"', background: 'rgb(20, 150, 111)', color: 'rgb(255, 255, 255)', width: '14px', height: '14px' }, `${id} renders the small green circle and white tick`);
    else assert.equal(pseudo.content, 'none', `${id} has no tick when its reminder is disabled`);
  };
  const geometry = async id => row(id).evaluate(el => {
    const box = node => { const r = node.getBoundingClientRect(); return [r.width, r.height, r.x - el.getBoundingClientRect().x, r.y - el.getBoundingClientRect().y]; };
    return { card: box(el), bell: box(el.querySelector('.money-list-bell')), name: box(el.querySelector('.money-description')), amount: box(el.querySelector('.money-amount')), action: box(el.querySelector('.money-mark-action')) };
  });

  for (const [kind, onId, offId] of [['income', 'income-on', 'income-off'], ['expense', 'expense-on', 'expense-off']]) {
    await page.locator(`[data-go="${kind}"]`).click();
    await assertBadge(onId, true);
    await assertBadge(offId, false);
    if (kind === 'income') {
      await row(onId).screenshot({ path: '/tmp/in-ordine-v2-reminder-active.png' });
      await row(offId).screenshot({ path: '/tmp/in-ordine-v2-reminder-inactive.png' });
    }
    for (const width of [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: 850 });
      assert.deepEqual(await geometry(onId), await geometry(offId), `${kind} active badge does not change any card or row geometry at ${width}px`);
    }

    await row(offId).locator('.money-description').click();
    await page.locator('#moneyEditNotify').check();
    await page.locator('#moneyEditForm button[type="submit"]').click();
    await assertBadge(offId, true);
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
    assert.equal(saved.entries.find(item => item.id === offId).reminder.enabled, true, `${offId} enable state is saved`);

    await page.reload();
    await page.locator('[data-go="money"]').click();
    await page.locator(`[data-go="${kind}"]`).click();
    await assertBadge(offId, true);

    await row(offId).locator('.money-description').click();
    await page.locator('#moneyEditNotify').uncheck();
    await page.locator('#moneyEditForm button[type="submit"]').click();
    await assertBadge(offId, false);
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
    assert.equal(saved.entries.find(item => item.id === offId).reminder.enabled, false, `${offId} disable state is saved`);

    await page.reload();
    await page.locator('[data-go="money"]').click();
    await page.locator(`[data-go="${kind}"]`).click();
    await assertBadge(offId, false);
    await page.locator('.money-flow-screen [data-go="money"]').click();
  }

  console.log('PASS finance reminder check appears only for enabled saved reminders; toggling and reload persist correctly for income and payments without changing card geometry at 320/360/390/430px');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}

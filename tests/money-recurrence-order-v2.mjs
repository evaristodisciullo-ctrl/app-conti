import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { generateOccurrenceDates } from '../v2/recurrence.js';

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
await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(4183, '127.0.0.1', resolveListen); });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 850 }, locale: 'it-IT' });
const fixture = {
  version: 2, balance: 0, profile: { namePromptCompleted: true }, entries: [], history: [], adjustments: [], budgetPlans: [],
  financeNotifications: { enabled: false, defaultTime: '09:00', rule: { advanceDays: 0, time: '09:00' } },
  notificationSettings: { enabled: false, rule: { advanceDays: 0, time: '09:00' } },
  todo: { tasks: [], done: [], notifications: { enabled: false, rule: { advanceDays: 0, time: '09:00' } } },
  preferences: { categories: [] }
};
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('inOrdineV2State')));
const today = new Date();
const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

try {
  await page.addInitScript(value => localStorage.setItem('inOrdineV2State', JSON.stringify(value)), fixture);
  await page.goto('http://127.0.0.1:4183/');

  const openNew = async (kind, description) => {
    await page.locator('[data-go="money"]').click();
    await page.locator(`[data-go="${kind}"]`).click();
    await page.locator(`[data-add-money="${kind}"]`).click();
    await page.locator('#moneyDescription').fill(description);
    await page.locator('#moneyAmount').fill('10');
    await page.locator('#moneyDate').fill(date);
    await page.locator('#moneyRecurrenceMonthly').check();
  };
  const assertCreateOrder = async () => {
    const labels = await page.locator('#moneyRecurrenceMonthlyOptions label.money-recurrence-choice').allTextContents();
    assert.match(labels[0], /Per sempre/, 'Per sempre is the first monthly end choice');
    assert.match(labels[1], /Numero di mesi/, 'Numero di mesi follows Per sempre');
    assert.equal(await page.locator('#moneyRecurrenceCount').inputValue(), '12', 'the count default remains 12');
    assert.equal(await page.locator('#moneyRecurrenceCount').isVisible(), true, 'the numeric field is active for Numero di mesi');
  };
  const save = async () => { await page.locator('#moneyForm button[type="submit"]').click(); await page.locator('.money-flow-screen').waitFor(); };

  await openNew('income', 'Entrata a mesi');
  await assertCreateOrder();
  await save();
  let saved = await state();
  let entry = saved.entries.find(item => item.description === 'Entrata a mesi');
  assert.equal(entry.recurrenceRule.end, 'count', 'income defaults to a finite monthly recurrence');
  assert.equal(entry.recurrenceRule.count, 12, 'income retains the 12-month default');

  await openNew('income', 'Entrata per sempre');
  await page.locator('#moneyRecurrenceCount').fill('4');
  await page.locator('#moneyRecurrenceEndNever').check();
  assert.equal(await page.locator('#moneyRecurrenceCount').isVisible(), false, 'the count field is inactive for Per sempre');
  await save();
  saved = await state();
  entry = saved.entries.find(item => item.description === 'Entrata per sempre' && item.recurrenceRule?.end === 'never');
  assert.ok(entry, 'Per sempre is saved for income');
  assert.equal(entry.recurrenceRule.count, 4, 'the saved count remains inert when Per sempre is selected');
  assert.ok(generateOccurrenceDates(entry.date, 'day', entry.recurrenceRule, { now: new Date(`${date}T00:00:00`), horizonMonths: 18 }).length > entry.recurrenceRule.count, 'Per sempre recurrence generation ignores the hidden numeric count');

  await openNew('expense', 'Pagamento a mesi');
  await assertCreateOrder();
  await page.locator('#moneyRecurrenceCount').fill('6');
  await save();
  saved = await state();
  let payment = saved.entries.find(item => item.description === 'Pagamento a mesi');
  assert.equal(payment.kind, 'expense');
  assert.equal(payment.recurrenceRule.count, 6, 'the selected month count is saved for payments');

  await openNew('expense', 'Pagamento per sempre');
  await page.locator('#moneyRecurrenceCount').fill('7');
  await page.locator('#moneyRecurrenceEndNever').check();
  assert.equal(await page.locator('#moneyRecurrenceCount').isVisible(), false, 'the count field is inactive for Per sempre on payments');
  await save();
  saved = await state();
  payment = saved.entries.find(item => item.description === 'Pagamento per sempre' && item.recurrenceRule?.end === 'never');
  assert.ok(payment, 'Per sempre is saved for payments');
  assert.equal(payment.recurrenceRule.count, 7, 'the saved count remains inert when Per sempre is selected for a payment');
  assert.ok(generateOccurrenceDates(payment.date, 'day', payment.recurrenceRule, { now: new Date(`${date}T00:00:00`), horizonMonths: 18 }).length > payment.recurrenceRule.count, 'payment Per sempre generation ignores the hidden numeric count');

  for (const [kind, description] of [['income', 'Entrata per sempre'], ['expense', 'Pagamento per sempre']]) {
    await page.locator('[data-go="money"]').click();
    await page.locator(`[data-go="${kind}"]`).click();
    await page.locator('[data-edit-money]').filter({ hasText: description }).first().locator('.money-description').click();
    const endOptions = await page.locator('#moneyEditRecurrenceEnd option').allTextContents();
    assert.match(endOptions[0], /Per sempre/, `${kind} edit puts Per sempre first`);
    assert.match(endOptions[1], /Numero di mesi/, `${kind} edit places Numero di mesi next`);
    assert.equal(await page.locator('#moneyEditRecurrenceCount').isVisible(), false, `${kind} edit hides the count field when the saved mode is Per sempre`);
    await page.locator('#moneyEditRecurrenceEnd').selectOption('count');
    assert.equal(await page.locator('#moneyEditRecurrenceCount').isVisible(), true, `${kind} edit activates the count field only for Numero di mesi`);
    assert.equal(await page.locator('#moneyEditRecurrenceCount').inputValue(), kind === 'income' ? '4' : '7');
    await page.locator(`.page-header [data-go="${kind}"]`).click();
  }

  console.log('PASS monthly recurrence order and behavior: income, payment, finite/default 12, Per sempre ignores the hidden count, and existing finance edit forms preserve the same choice order.');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}

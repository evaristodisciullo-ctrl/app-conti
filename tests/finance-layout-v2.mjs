import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('www');
const output = resolve(process.env.V2_FINANCE_SCREENSHOT_DIR || '/tmp/in-ordine-v2-finance-layout');
await mkdir(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);
    if (file !== root && !file.startsWith(root + sep)) return res.writeHead(403).end();
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(4174, '127.0.0.1', resolveListen); });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 850 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'it-IT' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const today = new Date();
const localIso = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const plusDays = count => { const date = new Date(); date.setDate(date.getDate() + count); return localIso(date); };
const sizes = [320, 360, 390, 430];

try {
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const addMoney = async (kind, name, amount, date) => {
    await page.locator(`[data-add-money="${kind}"]`).click();
    await page.locator('#moneyDescription').fill(name);
    await page.locator('#moneyAmount').fill(String(amount));
    await page.locator('#moneyDate').fill(date);
    await page.locator('#moneyForm button[type="submit"]').click();
    const row = page.locator('.money-row-card').filter({ hasText: name });
    await row.waitFor();
    return row;
  };

  const inspectState = async (kind, done, overdue, name) => {
    const row = page.locator('.money-row-card').filter({ hasText: name });
    const data = await row.evaluate(el => {
      const rect = node => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      return {
        card: rect(el),
        heading: rect(el.querySelector('.money-row-heading')),
        description: rect(el.querySelector('.money-description')),
        bell: rect(el.querySelector('.money-list-bell')),
        amount: rect(el.querySelector('.money-amount')),
        action: rect(el.querySelector('.money-mark-action, .money-edit-icon')),
        state: rect(el.querySelector('.overdue-label, .money-state.is-done')),
        descriptionText: el.querySelector('.money-description').innerText,
        actionText: el.querySelector('.money-mark-label')?.innerText || el.querySelector('.money-edit-icon')?.getAttribute('aria-label'),
        descriptionOverflow: el.querySelector('.money-description').scrollWidth > el.querySelector('.money-description').clientWidth,
        actionOverflow: [...el.querySelectorAll('.money-mark-label')].some(label => label.scrollWidth > label.clientWidth),
        actionName: el.querySelector('.money-mark-action')?.getAttribute('aria-label'),
        done: el.dataset.done === 'true',
        bellSize: el.querySelector('.money-list-bell') ? getComputedStyle(el.querySelector('.money-list-bell')).width : null,
      };
    });
    assert.equal(data.done, done, `${kind} row state is correct`);
    assert.ok(data.card.height >= 70 && data.card.height <= 135, `${kind} card remains compact (${data.card.height}px)`);
    assert.equal(data.descriptionOverflow, false, `${kind} name is readable at ${page.viewportSize().width}px`);
    assert.equal(data.actionOverflow, false, `${kind} action text fits at ${page.viewportSize().width}px`);
    assert.ok(data.description.right <= data.bell?.x || !data.bell, `${kind} name does not collide with its bell`);
    assert.ok(data.action && data.action.right <= data.card.right - 8, `${kind} action fits at the card's right edge`);
    assert.ok(data.amount.right <= data.action.x, `${kind} amount does not overlap the action`);
    assert.ok(Math.abs((data.amount.y + data.amount.height / 2) - (data.action.y + data.action.height / 2)) < 2, `${kind} amount and action share a row`);
    if (done) {
      assert.match(data.actionText, /Modifica/i, `${kind} completed row retains edit action`);
      assert.ok(data.state && data.state.y >= data.action.bottom - 1, `${kind} completed status sits below edit action`);
    } else {
      assert.equal(data.bellSize, '36px', `${kind} reminder bell remains full size`);
      assert.ok(data.bell.y <= data.heading.y + 1 && data.bell.right >= data.card.right - 10, `${kind} bell stays in upper-right corner`);
      assert.match(data.actionName, kind === 'income' ? /Segna come ricevuto/ : /Segna come pagato/);
      if (overdue) assert.ok(data.state && data.state.y >= data.action.bottom - 1, `${kind} SCADUTO stays beneath the action`);
      else assert.equal(data.state, null, `${kind} future item has no overdue state`);
    }
    return data;
  };

  await page.locator('[data-go="money"]').click();
  await page.locator('[data-go="income"]').click();
  const incomeName = 'Stipendio straordinario mensile';
  await addMoney('income', incomeName, 1500, plusDays(1));
  for (const width of sizes) {
    await page.setViewportSize({ width, height: 850 });
    const geometry = await inspectState('income', false, false, incomeName);
    await page.locator('.money-row-card').filter({ hasText: incomeName }).screenshot({ path: `${output}/${width}-entrate-da-ricevere.png` });
    console.log(`VISUAL ${width}px entrate-da-ricevere ${geometry.card.width}x${geometry.card.height}`);
  }
  await page.locator('.money-row-card').filter({ hasText: incomeName }).locator('[data-money-done]').click();
  for (const width of sizes) {
    await page.setViewportSize({ width, height: 850 });
    const geometry = await inspectState('income', true, false, incomeName);
    await page.locator('.money-row-card').filter({ hasText: incomeName }).screenshot({ path: `${output}/${width}-entrate-ricevuta.png` });
    console.log(`VISUAL ${width}px entrate-ricevuta ${geometry.card.width}x${geometry.card.height}`);
  }

  await page.locator('[data-go="money"]').click();
  await page.locator('[data-go="expense"]').click();
  const expenseName = 'Pagamento bolletta annuale';
  await addMoney('expense', expenseName, 120, plusDays(-1));
  for (const width of sizes) {
    await page.setViewportSize({ width, height: 850 });
    const geometry = await inspectState('expense', false, true, expenseName);
    await page.locator('.money-row-card').filter({ hasText: expenseName }).screenshot({ path: `${output}/${width}-pagamenti-scaduto.png` });
    console.log(`VISUAL ${width}px pagamenti-scaduto ${geometry.card.width}x${geometry.card.height}`);
  }
  await page.locator('.money-row-card').filter({ hasText: expenseName }).locator('[data-money-done]').click();
  for (const width of sizes) {
    await page.setViewportSize({ width, height: 850 });
    const geometry = await inspectState('expense', true, false, expenseName);
    await page.locator('.money-row-card').filter({ hasText: expenseName }).screenshot({ path: `${output}/${width}-pagamenti-pagato.png` });
    console.log(`VISUAL ${width}px pagamenti-pagato ${geometry.card.width}x${geometry.card.height}`);
  }
  assert.deepEqual(errors, [], `no JavaScript errors: ${errors.join('; ')}`);
  console.log(`Finance visual QA passed: ${sizes.join(', ')} CSS px; 16 rendered card screenshots in ${output}`);
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}

import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('./app.css', import.meta.url), 'utf8');

const checks = [
  ['viewport uses dynamic height', css.includes('100dvh')],
  ['safe-area top', css.includes('safe-area-inset-top')],
  ['safe-area bottom', css.includes('safe-area-inset-bottom')],
  ['horizontal overflow guarded', css.includes('overflow-x:hidden')],
  ['no legacy fixed 520px app shell', !css.includes('.app{max-width:520px')],
  ['real balance completion rule present', app.includes('state.balance=realBalance()+signedAmount(x)')],
  ['future entry is saved before completion', app.includes('state.entries.push(base)')],
  ['completed movement history exists', app.includes('state.history.unshift(x)')],
  ['todo persistence exists', app.includes('state.todo.tasks.push(base)')],
  ['completed item can be edited and reversed', app.includes('data-undo-money') && app.includes('moneyEditForm') && app.includes('state.balance=realBalance()-signedAmount(item)')],
  ['series updates and deletion operate on future instances', app.includes('data-series-scope=\"future\"') && app.includes('Eliminare questa serie ricorrente completa')],
  ['unassigned-date reminders and separate notification channels exist', app.includes('financeNotificationsForm') && app.includes('data-reminder-custom') && app.includes('todoDailySummary')],
  ['per-domain data erasure exists', app.includes('id=\"resetFinance\"') && app.includes('id=\"resetTodo\"')],
  ['native notification sync exists', app.includes('syncTodoNotifications')],
  ['backup export exists', app.includes('exportBackup')],
  ['month-end recurrence helper exists', app.includes('shiftDateSafe')],
  ['income/payment filters are wired', app.includes("closest('[data-money-filter]')")],
  ['backup restore screen is reachable', app.includes("name==='backup'") && app.includes('id=\"importBackup\"')],
  ['theme and app colors are applied', app.includes('dataset.appTheme') && app.includes('dataset.appColor')],
  ['Capacitor Preferences plugin is imported', (await readFile(new URL('./platform.js', import.meta.url), 'utf8')).includes("@capacitor/preferences")]
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(ok ? 'PASS' : 'FAIL', name);
  if (!ok) failed++;
}

// Syntax check after stripping the single ES import line; top-level await is wrapped.
const syntaxSource = app.replace(/^import .*?;\s*/gm, '');
try {
  new vm.Script('(async()=>{'+syntaxSource+'\n})()');
  console.log('PASS JavaScript syntax');
} catch (e) {
  console.error('FAIL JavaScript syntax', e.message);
  failed++;
}
if (failed) process.exit(1);

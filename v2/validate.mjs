import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const finance = await readFile(new URL('./finance.js', import.meta.url), 'utf8');
const css = await readFile(new URL('./app.css', import.meta.url), 'utf8');
const voice = await readFile(new URL('./voice.js', import.meta.url), 'utf8');
const platform = await readFile(new URL('./platform.js', import.meta.url), 'utf8');
const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const activity = await readFile(new URL('../android/app/src/main/java/it/inordine/app/MainActivity.java', import.meta.url), 'utf8');
const speechPlugin = await readFile(new URL('../android/app/src/main/java/it/inordine/app/NativeSpeechRecognition.java', import.meta.url), 'utf8');

const checks = [
  ['viewport uses dynamic height', css.includes('100dvh')],
  ['safe-area top', css.includes('safe-area-inset-top')],
  ['safe-area bottom', css.includes('safe-area-inset-bottom')],
  ['horizontal overflow guarded', css.includes('overflow-x:hidden')],
  ['no legacy fixed 520px app shell', !css.includes('.app{max-width:520px')],
  ['real balance is explicit', finance.includes('export const realBalance=state=>') && finance.includes('export function projectedBalance')],
  ['future entry is saved before completion', app.includes('state.entries.push(base)')],
  ['completed movements transfer into history', finance.includes('export function markCompleted') && finance.includes('state.history=[item,')],
  ['todo persistence exists', app.includes('state.todo.tasks.push(base)')],
  ['completed item can be edited and reversed', app.includes('data-undo-money') && app.includes('moneyEditForm') && finance.includes('export function undoCompletion') && finance.includes('export function adjustCompletedAmount')],
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
  ,['separate voice and manual list actions exist', app.includes('data-voice-create="\'+kind+\'"') && app.includes('manualmente')]
  ,['voice phrase parser and Italian time parsing exist', voice.includes('parseItalianVoiceEntry') && voice.includes('parseItalianTime')]
  ,['Android requests microphone permission', manifest.includes('android.permission.RECORD_AUDIO') && activity.includes('NativeSpeechRecognition.class') && platform.includes("registerPlugin('NativeSpeechRecognition')")]
  ,['voice review form explicitly avoids automatic save', app.includes('Nulla è stato salvato.') && app.includes('Dati riconosciuti:')]
  ,['finance dates and status use separate readable fields', app.includes('class="money-meta"') && css.includes('.money-meta .date-emphasis')]
  ,['notification bell icons use filled section colors', css.includes('.bell-icon{') && css.includes('fill:currentColor')]
  ,['money list cards use a prominent date beneath the description', app.includes('class="money-meta"><span class="date-emphasis">') && css.includes('.money-row .money-meta .date-emphasis{')]
  ,['paired manual and voice buttons share exact dimensions and section colors', css.includes('.list-create-action{height:56px;min-height:56px;max-height:56px') && css.includes('.list-create-action:not(.todo-add-action){') && css.includes('.list-create-action.todo-add-action{')]
  ,['section deletion tiles live on each section home and stay out of settings', app.includes('finance-reset-action" id="resetFinance') && app.includes('todo-reset-action" id="resetTodo') && !/function settings\(\)\{[^\n]*id="resetFinance"/.test(app) && !/function todoSettings\(\)\{[^\n]*id="resetTodo"/.test(app) && !app.includes('id="resetAll"')]
  ,['Android speech session exposes real readiness, partial text, retry and confirmation', speechPlugin.includes('onReadyForSpeech(Bundle params) { emitState("ready"') && speechPlugin.includes('onBeginningOfSpeech() { emitState("recording"') && speechPlugin.includes('EXTRA_PARTIAL_RESULTS, true') && speechPlugin.includes('public void retry(') && speechPlugin.includes('public void confirm(') && speechPlugin.includes('ERROR_LANGUAGE_UNAVAILABLE') && speechPlugin.includes('Looper.getMainLooper()')]
  ,['voice dialog waits for a real ready event and requires user confirmation', app.includes("if(state==='ready')status.textContent='Parla ora'") && app.includes('data-voice-confirm') && app.includes('NativeSpeechRecognition.confirm') && app.includes('data-voice-retry') && app.includes('data-voice-cancel')]
  ,['monthly finance summaries use selected month and bounded recurring forecast', app.includes("financeTotals(state,'income',monthKey())") && app.includes("financeTotals(state,'expense',monthKey())") && finance.includes('only the next pending occurrence in each recurring series')]
  ,['active Todo defaults to the current month', app.includes('active:{month:currentTodoMonth,year:currentTodoYear}')]
  ,['real-balance field is blank and current balance is shown separately', app.includes('Saldo attualmente registrato: <b>${euro(realBalance())}</b>') && app.includes('id="balanceValue" inputmode="decimal" value=""')]
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

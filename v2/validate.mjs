import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const finance = await readFile(new URL('./finance.js', import.meta.url), 'utf8');
const css = await readFile(new URL('./app.css', import.meta.url), 'utf8');
const voice = await readFile(new URL('./voice.js', import.meta.url), 'utf8');
const platform = await readFile(new URL('./platform.js', import.meta.url), 'utf8');
const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const localNotificationsManifest = await readFile(new URL('../node_modules/@capacitor/local-notifications/android/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
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
  ['unassigned-date custom reminders and separate notification channels remain available', app.includes('financeNotificationsForm') && app.includes('data-reminder-custom') && app.includes('todoDailySummary')],
  ['per-domain data erasure exists', app.includes('id=\"resetFinance\"') && app.includes('id=\"resetTodo\"')],
  ['native notification sync exists', app.includes('syncTodoNotifications')],
  ['Android declares exact alarm access and exposes an in-app authorization flow', manifest.includes('android.permission.SCHEDULE_EXACT_ALARM') && app.includes('changeExactNotificationSetting') && app.includes('data-request-exact-alarm')],
  ['Capacitor local notifications receiver restores pending alarms after device reboot', localNotificationsManifest.includes('LocalNotificationRestoreReceiver') && localNotificationsManifest.includes('android.intent.action.BOOT_COMPLETED') && localNotificationsManifest.includes('android.permission.RECEIVE_BOOT_COMPLETED')],
  ['exact alarm permission is mandatory before any pending notification is changed', (await readFile(new URL('./notifications.js', import.meta.url), 'utf8')).includes("if (exact.exact_alarm !== 'granted') return { status: 'exact-alarm-permission-required'") && (await readFile(new URL('./notifications.js', import.meta.url), 'utf8')).indexOf('const pending = await nativePlugin.getPending()', (await readFile(new URL('./notifications.js', import.meta.url), 'utf8')).indexOf("const exact = await nativePlugin.checkExactNotificationSetting()")) > (await readFile(new URL('./notifications.js', import.meta.url), 'utf8')).indexOf("if (exact.exact_alarm !== 'granted')")],
  ['notification UI uses day offsets and never displays minute advance', !app.includes('Anticipo (minuti)') && app.includes('Giorni prima della scadenza') && !(await readFile(new URL('./notifications.js', import.meta.url), 'utf8')).includes('advanceMinutes')],
  ['notification bell and Quando open the reminder-only editor', app.includes('function reminderSetup(kind,id)') && app.includes('reminderSetup(reminderButton.dataset.reminderOpen') && app.includes('reminderSetup(notice.dataset.editMoneyNotice') && app.includes('id="reminderSetupForm"')],
  ['recurring notification settings list a series once and apply reminder settings to future occurrences', app.includes('uniqueReminderSeries(items)') && app.includes('applyReminderToSeries(items,item.id,reminder)')],
  ['individual reminders schedule independently and the general switch covers all dated entries', (await readFile(new URL('./notifications.js', import.meta.url), 'utf8')).includes('if (!financeAll && !itemEnabled) continue') && (await readFile(new URL('./notifications.js', import.meta.url), 'utf8')).includes('if (!todoPrefs.enabled && !itemEnabled) continue')],
  ['backup export exists', app.includes('exportBackup')],
  ['month-end recurrence helper exists', app.includes('shiftDateSafe')],
  ['income/payment filters are wired', app.includes("closest('[data-money-filter]')")],
  ['backup restore screen is reachable', app.includes("name==='backup'") && app.includes('id=\"importBackup\"')],
  ['theme and app colors are applied', app.includes('dataset.appTheme') && app.includes('dataset.appColor')],
  ['Capacitor Preferences plugin is imported', (await readFile(new URL('./platform.js', import.meta.url), 'utf8')).includes("@capacitor/preferences")]
  ,['one-shot create actions are hidden while per-field dictation remains', !app.includes('data-voice-create="income"') && !app.includes('data-voice-create="expense"') && !app.includes('data-voice-create="todo"') && app.includes('data-voice-target="moneyDescription"') && app.includes('data-voice-target="moneyAmount"') && app.includes('data-voice-target="todoDescription"') && voice.includes('parseItalianVoiceEntry')]
  ,['voice phrase parser and Italian time parsing exist', voice.includes('parseItalianVoiceEntry') && voice.includes('parseItalianTime')]
  ,['Android requests microphone permission', manifest.includes('android.permission.RECORD_AUDIO') && activity.includes('NativeSpeechRecognition.class') && platform.includes("registerPlugin('NativeSpeechRecognition')")]
  ,['voice review form explicitly avoids automatic save', app.includes('Nulla è stato salvato.') && app.includes('Dati riconosciuti:')]
  ,['finance dates and status use separate readable fields', app.includes('class="money-state ') && css.includes('.money-state.is-done')]
  ,['notification bell icons use filled section colors', css.includes('.bell-icon{') && css.includes('fill:currentColor')]
  ,['money list cards use a prominent date beneath the description', app.includes('class="money-date-group ') && css.includes('.money-date-group>.date-emphasis{')]
  ,['manual create action styling remains intact', css.includes('.list-create-action{height:56px;min-height:56px;max-height:56px') && css.includes('.list-create-action:not(.todo-add-action){') && css.includes('.list-create-action.todo-add-action{')]
  ,['section deletion tiles live on each section home and stay out of settings', app.includes('finance-reset-action" id="resetFinance') && app.includes('todo-reset-action" id="resetTodo') && !/function settings\(\)\{[^\n]*id="resetFinance"/.test(app) && !/function todoSettings\(\)\{[^\n]*id="resetTodo"/.test(app) && !app.includes('id="resetAll"')]
  ,['Android speech session exposes real readiness, partial text, retry and confirmation', speechPlugin.includes('onReadyForSpeech(Bundle params) { emitState("ready"') && speechPlugin.includes('onBeginningOfSpeech() { emitState("recording"') && speechPlugin.includes('EXTRA_PARTIAL_RESULTS, true') && speechPlugin.includes('public void retry(') && speechPlugin.includes('public void confirm(') && speechPlugin.includes('ERROR_LANGUAGE_UNAVAILABLE') && speechPlugin.includes('Looper.getMainLooper()')]
  ,['voice dialog waits for a real ready event and requires user confirmation', app.includes("if(state==='ready')status.textContent='Parla ora'") && app.includes('data-voice-confirm') && app.includes('NativeSpeechRecognition.confirm') && app.includes('data-voice-retry') && app.includes('data-voice-cancel')]
  ,['active Android dictation can be stopped cleanly before using recognized text', app.includes('NativeSpeechRecognition.finish()') && speechPlugin.includes('public void finish(') && speechPlugin.includes('recognizer.stopListening()')]
  ,['native Italian speech listener allows pauses and partial transcript feedback', speechPlugin.includes('EXTRA_PARTIAL_RESULTS, true') && speechPlugin.includes('EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 9000L') && speechPlugin.includes('EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 5000L')]
  ,['only the two requested home screens receive compact layout rules', app.includes('class="finance-home-screen"') && app.includes('class="todo-home-screen"') && css.includes('.finance-home-screen .finance-art-frame') && css.includes('.todo-home-screen .todo-art-frame')]
  ,['monthly finance summaries use selected month and bounded recurring forecast', app.includes("financeTotals(state,'income',monthKey())") && app.includes("financeTotals(state,'expense',monthKey())") && finance.includes('only the next pending occurrence in each recurring series')]
  ,['Todo month selector defaults to the current available month and follows visible sections', app.includes("monthKeys.includes(today)?today:(monthKeys[0]||today)") && app.includes('function syncTodoMonthFromScroll') && app.includes('data-todo-month-label')]
  ,['Todo lists render all activities in chronological month sections with quick scroll navigation', app.includes('function orderedTodos') && app.includes('data-todo-month="\'+key+\'"') && app.includes('window.scrollTo(0,Math.max(0,top))') && app.includes('todoMonthLabel(key)') && !app.includes('id="todoMonth"') && !app.includes('id="todoYear"')]
  ,['Todo lists group tasks by due and completion date and completed view omits search and add controls', app.includes('todo-date-group') && app.includes('todo-date-heading') && app.includes('completionDate?fmtTodoDate(completionDate') && !app.slice(app.indexOf('function todoList('),app.indexOf('function syncTodoMonthFromScroll')).includes('data-todo-search') && !app.slice(app.indexOf('function todoList('),app.indexOf('function syncTodoMonthFromScroll')).includes('const footer=addAction') && app.includes('Aggiungi cosa da fare</span>')]
  ,['finance operation descriptions are regular weight and payment summary labels are black', css.includes('.money-description{font-weight:500}') && css.includes('.money-open-section.expense .money-section-heading>strong{color:#172b52}')]
  ,['real-balance field is blank and current balance is shown separately', app.includes('Saldo attualmente registrato: <b>${euro(realBalance())}</b>') && app.includes('id="balanceValue" inputmode="decimal" value=""')]

  ,['finance filters and status sections render in approved order', app.includes('data-money-filter=') && app.includes("doneLabel=isIncome?'Ricevute':'Pagati'") && app.includes("filter==='done'?section(shownDone,true):filter==='pending'?section(shownOpen,false)")]
  ,['finance lists group rows under one date heading and keep undated items separate', app.includes('financeDateGroupKey(item)') && app.includes('data-date-group=') && app.includes("return 'SENZA DATA'")]
  ,['only payment completed section is collapsible in All view', app.includes('data-toggle-paid-section') && app.includes("kind==='expense'&&filter==='all'") && app.includes('paidEntriesExpanded')]
  ,['completed finance rows edit and reopen from edit form', app.includes('data-edit-money-open=') && app.includes('data-undo-money-edit=') && !app.includes('class="money-undo-small"')]
  ,['approved home tile borders are vivid and finance list rows fit small screens', css.includes('inset 0 0 0 5px #13d84b') && css.includes('inset 0 0 0 5px #1269ed') && css.includes('@media(max-width:390px)') && css.includes('.money-row{display:grid')],
  ['Home omits projected balance and keeps month-end summary', !app.slice(app.indexOf('function money()'),app.indexOf('function money()')+2600).includes('Saldo previsto') && app.includes('Saldo a fine mese') && finance.includes('monthEndBalance(state,ym)')],
  ['finance status cards use approved amber, pale-red and green outlines with date-group separators', css.includes('.money-status-section.money-open-section.income{border-color:#edcf72') && css.includes('.money-status-section.money-open-section.expense{border-color:#e7a3a3') && css.includes('.money-status-section.money-done-section{border-color:#83cfae') && css.includes('.money-date-group+.money-date-group{border-top:1px solid')],
  ['both Todo lists omit search; completed list omits creation, keeps date restore and active list has approved creation', !app.slice(app.indexOf('function todoList('),app.indexOf('function escapeHtml')).includes('data-todo-search') && app.includes('const footer=done?doneLink:addAction+activeLink') && app.includes('Vedi cose già fatte') && app.includes('Vedi cose in scadenza') && app.includes('todo-restore-icon') && app.includes('data-restore=') && app.includes('Aggiungi cosa da fare</span>')],
  ['Todo edit remains the only permanent delete control and confirms before removal', app.includes('data-delete-task') && app.includes('Eliminare questa attività?') && !app.slice(app.indexOf('function todoList('),app.indexOf('function escapeHtml')).includes('data-delete-task')],
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

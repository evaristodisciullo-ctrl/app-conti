import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const sizes = [[360,800],[390,844],[412,915],[430,932]];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
const root=resolve('www');
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,path==='/'?'index.html':'.'+path);if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return}const data=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(data)}catch{res.writeHead(404).end('Not found')}});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(4173,'127.0.0.1',ok)});
const previewDir = '/tmp/in-ordine-v2-preview';
await mkdir(previewDir,{recursive:true});
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,acceptDownloads:true});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
await page.evaluate(()=>localStorage.clear());
await page.reload();
await page.waitForSelector('.brand-logo');
assert.equal(await page.locator('.brand-logo').evaluate(i=>i.naturalWidth>0),true,'E.D.S. home logo loads');
await page.waitForFunction(()=>{const i=document.querySelector('.home-art');return i?.complete&&i.naturalWidth>0});
assert.equal(await page.locator('.home-pair').count(),2,'Home separates finance and Todo areas');
assert.equal(await page.locator('.home-pair .home-area + .home-pair-notice').count(),2,'each notification button sits below its own Home card');
await page.screenshot({path:`${previewDir}/01-home.png`});

// Establish a real starting balance and a future income, then receive it.
await page.locator('[data-go="money"]').click();
await page.waitForFunction(()=>{const i=document.querySelector('.finance-art');return i?.complete&&i.naturalWidth>0});
assert.equal(await page.locator('.balance #setBalance').count(),1,'real-balance button stays inside the real-balance card');
assert.equal(await page.locator('.balance + .finance-metrics-separated').count(),1,'monthly finance metrics stay in a separate card');
assert.equal(await page.locator('.balance .finance-summary-metrics').count(),0,'monthly metrics do not merge into the real-balance card');
const financeLogo=await page.locator('.page-header .eds-logo').evaluate(el=>parseFloat(getComputedStyle(el).width));assert.ok(financeLogo>=44,'finance header E.D.S. logo is enlarged for compact phone layouts');
await page.screenshot({path:previewDir+'/02-conti-overview.png'});
await page.locator('#setBalance').click();await page.locator('#balanceValue').fill('1000');await page.locator('#balanceForm button[type=submit]').click();
await page.locator('[data-go="landing"]').click();await page.locator('[data-go="finance-notifications"]').click();await page.locator('#financeNotificationsEnabled').check();await page.locator('#financeNotificationsForm button[type=submit]').click();await page.locator('[data-go="money"]').click();await page.locator('[data-go="income"]').click();
assert.match(await page.locator('[data-add-money="income"]').innerText(),/Aggiungi entrata manualmente/,'income list exposes the explicit manual action');
assert.match(await page.locator('[data-voice-create="income"]').innerText(),/Aggiungi entrata con la voce/,'income list exposes voice capture separately');
await page.evaluate(()=>{window.SpeechRecognition=class{start(){setTimeout(()=>{this.onresult?.({results:[[{transcript:'Stipendio 1.100 euro il 10 ottobre, tutti i mesi'}]]});this.onend?.()},0)}abort(){}}});
const entriesBeforeVoice=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).entries.length);
await page.locator('[data-voice-create="income"]').click();await page.waitForSelector('#moneyForm');
assert.equal(await page.locator('#moneyDescription').inputValue(),'Stipendio');assert.equal(await page.locator('#moneyAmount').inputValue(),'1100');assert.equal(await page.locator('#moneyDate').inputValue(),'2026-10-10');assert.equal(await page.locator('#moneyRecurrence').inputValue(),'monthly');assert.match(await page.locator('[data-voice-message]').innerText(),/Nulla è stato salvato/);
await page.screenshot({path:`${previewDir}/16-voice-review.png`});
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).entries.length),entriesBeforeVoice,'voice recognition only prefills a review form and never saves automatically');
await page.locator('[data-go="income"]').click();
await page.locator('[data-add-money="income"]').click();
await page.locator('#moneyDescription').fill('Stipendio test');
await page.locator('#moneyAmount').fill('245,50');
await page.locator('#moneyDate').fill(new Date().toISOString().slice(0,10));
await page.locator('#moneyCategory').selectOption({label:'Stipendio'});
await page.locator('#moneyForm button[type="submit"]').click();
await page.locator('[data-add-money="income"]').click();await page.locator('#moneyDescription').fill('Promemoria indipendente');await page.locator('#moneyAmount').fill('12');await page.locator('#moneyDateMode').selectOption('none');await page.locator('#moneyNotify').check();await page.locator('#moneyReminderMode').selectOption('custom');const financeReminderAt=await page.evaluate(()=>{const d=new Date(Date.now()+7*86400000);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'T10:00'});await page.locator('#moneyCustomAt').fill(financeReminderAt);await page.locator('#moneyForm button[type="submit"]').click();const reminderEntry=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).entries.find(x=>x.description==='Promemoria indipendente'));assert.equal(reminderEntry.date,'');assert.equal(reminderEntry.datePrecision,'none');assert.equal(reminderEntry.reminder.mode,'custom');assert.ok(reminderEntry.reminder.customAt);
await page.locator('[data-go="money"]').click();
assert.match(await page.locator('.balance').innerText(),/1\.000,00/,'pending income must not change real balance');
await page.locator('[data-go="income"]').click();
await page.screenshot({path:`${previewDir}/02-entrate.png`});
const createButtons=await page.locator('.list-create-action').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,bg:getComputedStyle(n).backgroundImage})));
assert.equal(createButtons.length,2,'finance list has exactly manual and voice creation buttons');assert.equal(createButtons[0].width,createButtons[1].width,'manual and voice buttons have matching widths');assert.equal(createButtons[0].height,createButtons[1].height,'manual and voice buttons have matching heights');assert.match(createButtons[0].bg,/gradient/);assert.match(createButtons[1].bg,/gradient/);
assert.equal(await page.locator('.money-row .money-category,.money-row .entry-status').count(),0,'finance cards omit category and redundant pending status below the date');
assert.ok(parseFloat(await page.locator('.money-row .date-emphasis').first().evaluate(n=>getComputedStyle(n).fontSize))>=15,'finance dates are prominent');
await page.locator('[data-money-filter="income:pending"]').click();
assert.equal(await page.locator('[data-edit-money]').count(),2,'pending income filter includes a no-date custom reminder');
await page.locator('[data-money-done]').first().click();
await page.locator('[data-go="money"]').click();
assert.match(await page.locator('.balance').innerText(),/1\.245,50/,'received income updates real balance');

// Add a payment; only marking it paid changes the real balance and creates a movement.
await page.locator('[data-go="expense"]').click();
await page.locator('[data-add-money="expense"]').click();
await page.locator('#moneyDescription').fill('Spesa test');
await page.locator('#moneyAmount').fill('100');
await page.locator('#moneyDate').fill(new Date().toISOString().slice(0,10));
await page.locator('#moneyCategory').selectOption({label:'Spesa'});
await page.locator('#moneyForm button[type="submit"]').click();
await page.locator('[data-go="money"]').click();
assert.match(await page.locator('.balance').innerText(),/1\.245,50/,'pending payment does not change real balance');
await page.locator('[data-go="expense"]').click();
await page.screenshot({path:`${previewDir}/03-pagamenti.png`});
await page.locator('[data-money-filter="expense:pending"]').click();
await page.locator('[data-money-done]').first().click();
await page.locator('[data-go="money"]').click();
assert.match(await page.locator('.balance').innerText(),/1\.145,50/,'paid expense reduces real balance');
await page.locator('[data-go="expense"]').click();await page.locator('[data-add-money="expense"]').click();await page.locator('#moneyDescription').fill('Spesa solo mese');await page.locator('#moneyAmount').fill('10');await page.locator('#moneyDateMode').selectOption('month');await page.locator('#moneyMonth').fill('2026-11');await page.locator('#moneyForm button[type=submit]').click();const monthEntry=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).entries.find(x=>x.description==='Spesa solo mese'));assert.equal(monthEntry.date,'2026-11');assert.equal(monthEntry.datePrecision,'month');assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')))).balance,1145.5,'future month-only payment does not change real balance');
await page.locator('[data-go="money"]').click();await page.locator('[data-go="income"]').click();await page.locator('[data-add-money="income"]').click();
await page.locator('#moneyDescription').fill('Ricorrenza stipendio');await page.locator('#moneyAmount').fill('30');await page.locator('#moneyDate').fill('2026-01-31');await page.locator('#moneyCategory').selectOption({label:'Stipendio'});await page.locator('#moneyRecurrence').selectOption('monthly');await page.locator('#moneyForm button[type=submit]').click();
const recurrenceData=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(recurrenceData.entries.filter(x=>x.description==='Ricorrenza stipendio').length,12);assert.ok(recurrenceData.entries.some(x=>x.description==='Ricorrenza stipendio'&&x.date==='2026-02-28'),'monthly recurrence clamps month-end dates safely');
assert.equal(recurrenceData.balance,1145.5,'future recurring income does not change real balance');
await page.locator('[data-add-money=\"income\"]').click();await page.locator('#moneyDescription').fill('Rinnovo annuale');await page.locator('#moneyAmount').fill('20');await page.locator('#moneyDate').fill('2024-02-29');await page.locator('#moneyRecurrence').selectOption('yearly');await page.locator('#moneyForm button[type=submit]').click();
const yearly=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(yearly.entries.filter(x=>x.description==='Rinnovo annuale').length,3);assert.ok(yearly.entries.some(x=>x.description==='Rinnovo annuale'&&x.date==='2025-02-28'),'yearly leap-day recurrence clamps safely');assert.equal(yearly.balance,1145.5);
await page.locator('[data-go=\"money\"]').click();await page.locator('[data-go=\"movements\"]').click();
assert.equal(await page.locator('.money-row').count(),2,'movements contain only completed money operations');
await page.screenshot({path:`${previewDir}/04-movimenti.png`});
await page.locator('[data-go=\"money\"]').click();
await page.locator('[data-go=\"settings\"]').click();

// Budget totals and category caps are stored and visible.
await page.locator('[data-go="budget"]').click();
page.once('dialog',d=>d.accept('500'));
await page.locator('#editBudget').click();
assert.match(await page.locator('.balance').innerText(),/500,00/);await page.screenshot({path:`${previewDir}/05-budget.png`});
await page.locator('[data-go="budget-categories"]').click();
await page.locator('[data-budget-category="Spesa"]').fill('150');
await page.locator('#budgetCategoryForm button').click();
assert.match(await page.locator('body').innerText(),/Limiti per categoria/);
await page.screenshot({path:`${previewDir}/05-budget-categorie.png`});
await page.locator('[data-go="summary"]').click();
assert.match(await page.locator('body').innerText(),/Confronto con/,'summary shows a previous month comparison');
await page.screenshot({path:`${previewDir}/06-riepilogo.png`});
await page.locator('[data-go=\"money\"]').click();await page.locator('[data-go=\"settings\"]').click();await page.screenshot({path:`${previewDir}/12-impostazioni.png`});await page.locator('[data-go=\"categories\"]').click();
page.once('dialog',d=>d.accept());await page.locator('[data-delete-category]').first().click();assert.equal(await page.locator('[data-delete-category]').count(),7,'default categories can be deleted');
await page.locator('#categoryName').fill('Casa nuova');await page.locator('#categoryForm button').click();assert.equal(await page.locator('#categoryList article').filter({hasText:'Casa nuova'}).count(),1,'categories can be added');await page.screenshot({path:`${previewDir}/10-categorie.png`});
await page.locator('[data-go=\"settings\"]').click();await page.locator('[data-go=\"preferences\"]').click();await page.locator('#dateFormat').selectOption('yyyy-mm-dd');await page.locator('#textSize').selectOption('large');await page.locator('#reduceAnimations').check();await page.locator('#preferencesForm button').click();assert.equal(await page.locator('html').getAttribute('data-text-size'),'large');await page.screenshot({path:`${previewDir}/11-preferenze.png`});
await page.locator('[data-go=\"settings\"]').click();await page.locator('[data-go=\"money\"]').click();

// Todo create, recurring instances, completion and restore.
await page.locator('[data-go="landing"]').click();
await page.locator('[data-go="todo"]').click();
await page.locator('[data-go="todo-active"]').click();
assert.match(await page.locator('[data-go="todo-add"]').innerText(),/Aggiungi cosa da fare manualmente/,'Todo list exposes a separate manual action');
assert.match(await page.locator('[data-voice-create="todo"]').innerText(),/Aggiungi cosa da fare con la voce/,'Todo list exposes a separate voice action');
await page.evaluate(()=>{window.SpeechRecognition=class{start(){setTimeout(()=>{this.onresult?.({results:[[{transcript:'Chiamare il medico domani alle 10'}]]});this.onend?.()},0)}abort(){}}});
const todoCountBeforeVoice=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).todo.tasks.length);
await page.locator('[data-voice-create="todo"]').click();await page.waitForSelector('#todoForm');
assert.equal(await page.locator('#todoDescription').inputValue(),'Chiamare il medico');assert.ok(await page.locator('#todoDate').inputValue());assert.equal(await page.locator('#todoReminderTime').inputValue(),'10:00');assert.equal(await page.locator('#todoNotify').isChecked(),true);
assert.doesNotMatch(await page.locator('[data-voice-message]').innerText(),/importo mancante/,'Todo voice review does not request an irrelevant amount');
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).todo.tasks.length),todoCountBeforeVoice,'Todo voice capture requires an explicit save');await page.screenshot({path:`${previewDir}/17-todo-voice-review.png`});
await page.locator('[data-go="todo"]').click();
await page.waitForFunction(()=>{const i=document.querySelector('.todo-art');return i?.complete&&i.naturalWidth>0});
await page.screenshot({path:`${previewDir}/07-cose-da-fare.png`});
await page.locator('[data-go="todo-add"]').click();
await page.locator('#todoDescription').fill('Chiamare dentista');
await page.locator('#todoDate').fill('2026-11-30');
await page.locator('#todoRecurrence').selectOption('monthly');
await page.locator('#todoNotify').check();
await page.locator('#todoForm button[type="submit"]').click();
assert.equal(await page.locator('[data-edit-task]').count(),25,'monthly todo recurrence creates the configured future instances');
assert.equal(await page.locator('.search-field').evaluate(el=>getComputedStyle(el).display),'flex','Todo search field is styled as a compact control');
assert.ok(parseFloat(await page.locator('.search-field input').evaluate(el=>getComputedStyle(el).height))>=40,'Todo search input keeps a usable touch height');
await page.screenshot({path:`${previewDir}/08-attivita.png`});
await page.locator('[data-complete]').first().click();
await page.locator('[data-go="todo"]').click();
await page.locator('[data-go="todo-done"]').click();
assert.equal(await page.locator('[data-edit-task]').count(),1,'completed task appears in completed list');
await page.screenshot({path:`${previewDir}/09-completate.png`});
await page.locator('[data-restore]').click();
assert.equal(await page.locator('[data-edit-task]').count(),25,'restored task returns to active list');
await page.locator('#todoMonth').selectOption('11');
await page.locator('#todoYear').selectOption('2026');
assert.equal(await page.locator('[data-edit-task]').count(),1,'Todo month and year filters work after restore');
await page.locator('#todoMonth').selectOption('all');
await page.locator('#todoYear').selectOption('all');
const only=page.locator('[data-edit-task]').filter({hasText:'Chiamare dentista'}).first();await only.click();await page.locator('#todoEditDescription').fill('Solo questa');await page.locator('#todoEditForm button[type=submit]').click();await page.locator('[data-series-scope="one"]').click();assert.equal(await page.locator('[data-edit-task]').filter({hasText:'Solo questa'}).count(),1,'Solo questa detaches only the selected occurrence');assert.equal(await page.locator('[data-edit-task]').filter({hasText:'Chiamare dentista'}).count(),24);
const editable=page.locator('[data-edit-task]').filter({hasText:'Chiamare dentista'}).first();await editable.click();
await page.locator('#todoEditDescription').fill('Dentista aggiornato');
await page.locator('#todoEditForm button[type=submit]').click();await page.locator('[data-series-scope=\"future\"]').click();
assert.equal(await page.locator('[data-edit-task]').filter({hasText:'Dentista aggiornato'}).count(),24,'recurring Todo edit applies to this and following instances');
await page.reload();await page.locator('[data-go=\"todo\"]').click();await page.locator('[data-go=\"todo-active\"]').click();
assert.equal(await page.locator('[data-edit-task]').filter({hasText:'Dentista aggiornato'}).count(),24,'Todo edit survives app reinitialization');
await page.locator('[data-edit-task]').filter({hasText:'Dentista aggiornato'}).first().click();
page.once('dialog',d=>d.accept());await page.locator('[data-delete-task]').click();
assert.equal(await page.locator('[data-edit-task]').count(),1,'deleting a recurring Todo series preserves the detached single occurrence');assert.equal(await page.locator('[data-edit-task]').filter({hasText:'Solo questa'}).count(),1);
await page.locator('[data-go=\"todo\"]').click();await page.locator('[data-go=\"todo-settings\"]').click();await page.locator('#todoNotifications').check();await page.locator('#todoNotifyTime').fill('08:30');await page.locator('#todoDailySummary').check();await page.locator('#todoDailySummaryTime').fill('18:30');await page.locator('#todoSettingsForm button[type=submit]').click();
const notificationPrefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).todo.notifications);assert.equal(notificationPrefs.enabled,true);assert.equal(notificationPrefs.rule.time,'08:30');assert.equal(notificationPrefs.dailySummary,true);assert.equal(notificationPrefs.dailySummaryTime,'18:30');

// Appearance controls take effect immediately and survive a full reload.
await page.locator('[data-go="todo"]').click();
await page.locator('[data-go="landing"]').click();
await page.locator('[data-go="money"]').click();
await page.locator('[data-go="settings"]').click();
await page.locator('[data-go="appearance"]').click();
await page.locator('#appearanceAppColor').selectOption({label:'Viola'});
await page.locator('#appearanceTodoColor').selectOption({label:'Blu'});
await page.locator('#appearanceTheme').selectOption('dark');
await page.locator('#appearanceForm button').click();await page.screenshot({path:`${previewDir}/13-colori-tema.png`});
assert.equal(await page.locator('html').getAttribute('data-app-theme'),'dark');
assert.equal(await page.locator('html').getAttribute('data-todo-color'),'Blu');
await page.reload();
assert.equal(await page.locator('html').getAttribute('data-app-theme'),'dark','preferences persist after page reload');


// Completed finance edit/undo/delete and completed Todo edit retain state correctly.
await page.goto('http://127.0.0.1:4173/');await page.locator('[data-go="money"]').click();await page.locator('[data-go="income"]').click();await page.locator('[data-money-filter="income:done"]').click();
await page.locator('[data-edit-money]').first().click();await page.locator('#moneyEditAmount').fill('250');await page.locator('#moneyEditForm button[type=submit]').click();if(await page.locator('[data-series-scope=\"future\"]').count())await page.locator('[data-series-scope=\"future\"]').click();
let financeState=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(financeState.balance,1150,'editing received income changes actual balance by the amount delta');
await page.locator('[data-undo-money]').click();financeState=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(financeState.balance,900,'undoing received income returns it to pending and reverses its balance effect');
await page.locator('[data-money-filter="income:pending"]').click();await page.locator('[data-money-done]').first().click();
await page.locator('[data-go="money"]').click();await page.locator('[data-go="landing"]').click();await page.locator('[data-go="todo"]').click();await page.locator('[data-go="todo-add"]').click();await page.locator('#todoDescription').fill('Attività completata editabile');await page.locator('#todoNotify').check();await page.locator('#todoReminderMode').selectOption('custom');const todoReminderAt=await page.evaluate(()=>{const d=new Date(Date.now()+9*86400000);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'T09:30'});await page.locator('#todoCustomAt').fill(todoReminderAt);await page.locator('#todoForm button[type=submit]').click();const todoReminder=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).todo.tasks.find(x=>x.description==='Attività completata editabile'));assert.equal(todoReminder.date,'');assert.ok(todoReminder.reminder.customAt);await page.locator('[data-edit-task]').filter({hasText:'Attività completata editabile'}).locator('[data-complete]').click();await page.locator('[data-go="todo"]').click();await page.locator('[data-go="todo-done"]').click();const doneRow=page.locator('[data-edit-task]').filter({hasText:'Attività completata editabile'});await doneRow.click();await page.locator('#todoEditDescription').fill('Completata modificata');await page.locator('#todoEditForm button[type=submit]').click();assert.equal(await page.locator('[data-edit-task]').filter({hasText:'Completata modificata'}).count(),1,'editing a completed activity preserves its completed state');

// Verify responsive bounds on principal routes at each requested Android size.
const routeChecks=['home','money','income','expense','finance-notifications','movements','summary','budget','budget-categories','todo','todo-add','todo-active','todo-done','todo-settings','todo-notifications','todo-settings-color','settings','profile','categories','appearance','backup','preferences','security'];
async function openV2Route(name){
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});await page.waitForSelector('.brand-logo');
  if(name==='home')return;
  const finance=['money','income','expense','finance-notifications','movements','summary','budget','budget-categories'];
  const todoRoutes=['todo','todo-add','todo-active','todo-done','todo-settings','todo-notifications','todo-settings-color'];
  if(finance.includes(name)){
    if(name==='finance-notifications')await page.locator('[data-go=\"finance-notifications\"]').click();
    else if(name==='summary'||name==='budget'||name==='budget-categories'){
      await page.locator('[data-go=\"money\"]').click();await page.locator('[data-go=\"settings\"]').click();
      if(name==='budget-categories')await page.locator('[data-go=\"budget\"]').click();
      await page.locator('[data-go=\"'+name+'\"]').click();
    }
    else await page.locator('[data-go=\"money\"]').click();
    if(name!=='money'&&name!=='finance-notifications'&&name!=='summary'&&name!=='budget'&&name!=='budget-categories'){
      if(name==='budget-categories'){await page.locator('[data-go=\"budget\"]').click();await page.locator('[data-go=\"budget-categories\"]').click()}
      else await page.locator(`[data-go=\"${name}\"]`).click();
    }
  }else if(todoRoutes.includes(name)){
    await page.locator('[data-go=\"todo\"]').click();
    if(name==='todo-settings-color'){await page.locator('[data-go=\"todo-notifications\"]').click();await page.locator('[data-go=\"todo-settings-color\"]').click()}else if(name!=='todo')await page.locator(`[data-go=\"${name}\"]`).click();
  }else{
    await page.locator('[data-go=\"money\"]').click();await page.locator('[data-go=\"settings\"]').click();
    if(name!=='settings')await page.locator(`[data-go=\"${name}\"]`).click();
  }
}
for(const [width,height] of sizes){
  await page.setViewportSize({width,height});
  for(const name of routeChecks){
    await openV2Route(name);
    await page.waitForFunction(()=>{const i=document.querySelector('.eds-logo')||document.querySelector('.brand-logo');return i?.complete&&i.naturalWidth>0});
    const dims=await page.evaluate(()=>({iw:innerWidth,ih:innerHeight,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth,app:document.querySelector('.app-shell')?.getBoundingClientRect().toJSON(),screen:document.querySelector('.screen')?.getBoundingClientRect().toJSON(),topPadding:parseFloat(getComputedStyle(document.querySelector('.app-shell')).paddingTop),logo:document.querySelector('.eds-logo')?.naturalWidth||document.querySelector('.brand-logo')?.naturalWidth||0}));
    assert.ok(dims.sw<=dims.iw+1&&dims.bw<=dims.iw+1,`${name} horizontal overflow at ${width}x${height}: ${JSON.stringify(dims)}`);
    assert.ok(dims.app.width<=width+1&&dims.screen.width<=width+1,`${name} width out of bounds at ${width}x${height}`);
    assert.ok(dims.app.x>=-1&&dims.app.right<=width+1,`${name} shifted sideways at ${width}x${height}`);
    assert.ok(dims.topPadding>=12,`${name} has no safe-area top spacing at ${width}x${height}`);
    assert.ok(dims.logo>0,`${name} E.D.S. logo missing at ${width}x${height}`);
  }
  console.log(`PASS responsive ${width}x${height}: ${routeChecks.length} screens, no horizontal overflow or missing logo`);
}

// Real reinitialization readback of saved finances, Todo items and preferences.
const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));
assert.equal(saved.balance,1150);
assert.equal(saved.history.length,2);
assert.equal(saved.entries.filter(x=>x.description==='Ricorrenza stipendio').length,12);
assert.equal(saved.entries.filter(x=>x.description==='Rinnovo annuale').length,3);
assert.equal(saved.todo.tasks.length,1);
assert.equal(saved.todo.done.length,1);
assert.equal(saved.todo.tasks.some(x=>x.description==='Dentista aggiornato'),false,'deleted Todo item stays deleted after reload');
assert.equal(saved.preferences.lightTheme,false);
assert.equal(saved.appColor,'Viola');
assert.equal(saved.preferences.dateFormat,'yyyy-mm-dd');
assert.equal(saved.preferences.textSize,'large');
assert.equal(errors.length,0,`browser errors: ${errors.join('; ')}`);
// Export and restore a real application backup through the file input.
await page.goto('http://127.0.0.1:4173/');await page.locator('[data-go=\"money\"]').click();await page.locator('[data-go=\"settings\"]').click();await page.locator('[data-go=\"backup\"]').click();await page.screenshot({path:`${previewDir}/14-backup.png`});
const downloadPromise=page.waitForEvent('download');await page.locator('#exportBackup').click();const download=await downloadPromise;const backupPath=await download.path();const backup=JSON.parse(await readFile(backupPath,'utf8'));assert.equal(backup.format,'in-ordine-v2');assert.equal(backup.state.balance,1150);
await page.locator('#importBackup').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.waitForSelector('.settings-list');assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')))).todo.tasks.length,1);
await page.locator('[data-go=\"money\"]').click();await page.locator('[data-go=\"landing\"]').click();await page.locator('[data-go=\"todo\"]').click();await page.locator('[data-go=\"todo-settings\"]').click();assert.equal(await page.locator('#resetTodo').count(),1);assert.equal(await page.locator('#resetFinance').count(),0);page.once('dialog',d=>d.accept());await page.locator('#resetTodo').click();let cleared=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(cleared.todo.tasks.length,0);assert.equal(cleared.balance,1150);assert.equal(cleared.history.length,2,'clearing Todo retains finances');await page.locator('[data-go=\"todo\"]').click();await page.locator('[data-go=\"landing\"]').click();await page.locator('[data-go=\"money\"]').click();await page.locator('[data-go=\"settings\"]').click();assert.equal(await page.locator('#resetFinance').count(),1);assert.equal(await page.locator('#resetTodo').count(),0);await page.locator('[data-go=\"backup\"]').click();await page.locator('#importBackup').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.waitForSelector('.settings-list');page.once('dialog',d=>d.accept());await page.locator('#resetFinance').click();cleared=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(cleared.entries.length,0);assert.equal(cleared.balance,0);assert.equal(cleared.todo.tasks.length,1,'clearing finances retains Todo');assert.ok(cleared.profile.fullName!==undefined,'section deletion retains app settings');
console.log('PASS finance, Todo, filters, monthly/yearly recurrence, budgets, category CRUD, settings, backup/restore and persistence');
console.log(`PREVIEW_DIR ${previewDir}`);
await browser.close();
await new Promise(ok=>server.close(ok));

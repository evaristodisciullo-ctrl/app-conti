import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const ORIGIN='http://127.0.0.1:4173/';
const KEY='inOrdineContiV1';

const pinHash=pin=>crypto.createHash('sha256').update('in-ordine|'+pin).digest('base64url');
const iso=(d=new Date())=>d.toISOString().slice(0,10);
const addDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return iso(d)};
const ym=(d=new Date())=>d.toISOString().slice(0,7);
const slash=date=>{const [y,m,d]=date.split('-');return `${d}/${m}/${y}`};

async function freshPage(browser,{notifications=false}={}){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  if(notifications)await context.grantPermissions(['notifications'],{origin:ORIGIN});
  const page=await context.newPage();
  await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.waitForSelector('#landing:not(.hidden)');
  return {context,page};
}
async function setup(page,balance=1000){
  await page.click('#landingConti');
  await page.waitForSelector('#setup:not(.hidden)');
  await page.fill('#startBalance',String(balance));
  await page.click('#startBtn');
  await page.waitForSelector('#setupIncome:not(.hidden)');
  await page.click('#skipIncomeSetup');
  await page.waitForSelector('#setupExpense:not(.hidden)');
  await page.click('#skipExpenseSetup');
  await page.waitForSelector('#home:not(.hidden)');
}
async function state(page){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY)}
async function settings(page){await page.click('#homeSettingsCard');await page.waitForSelector('#settings:not(.hidden)')}
async function chooseDate(page,manual=slash(iso())){
  await page.fill('#editDateText',manual);
  await page.dispatchEvent('#editDateText','input');
  await page.locator('#editDateText').blur();
  await page.waitForSelector('#editRecurrenceBlock:not(.hidden)');
}
async function chooseRec(page,kind){await page.locator('#editRecChoices button[data-kind="'+kind+'"]').click()}
async function confirmStatus(page,{amount,date}={}){
  await page.waitForSelector('#modal:not(.hidden)');
  if(amount!=null)await page.fill('#completeActualAmount',String(amount));
  if(date)await page.fill('#completeActualDate',date);
  await page.click('#completeConfirm');
}
async function addItem(page,type,name,amount,{date=slash(iso()),rec='single',category='',complete=false,actualAmount=null}={}){
  await page.click(type==='income'?'#homeIncome':'#homeExpense');
  await page.waitForSelector('#flow:not(.hidden)');
  await page.click('#flowAdd');
  await page.fill('#editName',name);
  await page.fill('#editAmount',String(amount));
  await chooseDate(page,date);
  await chooseRec(page,rec);
  if(category)await page.selectOption('#editCategory',{label:category});
  await page.click('#editSave');
  const row=page.locator('.flowUnifiedRow').filter({hasText:name}).first();
  await row.waitFor();
  if(complete){await row.locator('.flowUnifiedStatus').click();await confirmStatus(page,{amount:actualAmount==null?amount:actualAmount})}
  return row;
}
async function backHome(page){if(await page.locator('#flow:not(.hidden)').count())await page.click('#flowBack');await page.waitForSelector('#home:not(.hidden)')}

async function testApprovedOnboarding(browser){
  const {context,page}=await freshPage(browser);
  assert.equal(await page.locator('#landingConti').isVisible(),true);
  assert.equal(await page.locator('#landingTodo').isVisible(),true);
  await page.fill('#landingNickname','Mario');
  await page.click('#landingConti');
  assert.match(await page.locator('#setup').innerText(),/Inserisci il tuo saldo attuale/);
  await page.fill('#startBalance','1.000,50');await page.click('#startBtn');
  await page.waitForSelector('#setupIncome:not(.hidden)');
  assert.match(await page.locator('#setupIncome').innerText(),/ENTRATE/);
  const inc=page.locator('#incomeRows .entryRow').first();
  assert.equal(await inc.locator('.rName').getAttribute('placeholder'),'Es. Stipendio');
  assert.equal(await inc.locator('.rAmount').getAttribute('placeholder'),'Es. 1.400 €');
  assert.equal(await inc.locator('.rDateText').getAttribute('placeholder'),'Es. 10 del mese');
  await inc.locator('.rName').fill('Stipendio');await inc.locator('.rAmount').fill('1400');await inc.locator('.rDateText').fill('10 del mese');await inc.locator('.rDateText').blur();
  await page.click('#saveIncomeSetup');
  await page.waitForSelector('#setupExpense:not(.hidden)');
  assert.match(await page.locator('#setupExpense').innerText(),/PAGAMENTI/);
  const exp=page.locator('#expenseRows .entryRow').first();
  assert.equal(await exp.locator('.rName').getAttribute('placeholder'),'Es. Mutuo');
  assert.equal(await exp.locator('.rAmount').getAttribute('placeholder'),'Es. 387,03 €');
  assert.equal(await exp.locator('.rDateText').getAttribute('placeholder'),'Es. 1 del mese');
  await page.click('#skipExpenseSetup');await page.waitForSelector('#home:not(.hidden)');
  const s=await state(page),salary=s.entries.find(e=>e.name==='Stipendio');
  assert.equal(s.profile.fullName,'Mario');assert.equal(s.balance,1000.5);assert.equal(salary.recurrence.kind,'monthly');assert.equal(salary.day,10);
  await context.close();
}

async function testSetupNaturalRecurrences(browser){
  const {context,page}=await freshPage(browser);
  await page.click('#landingConti');await page.fill('#startBalance','1000');await page.click('#startBtn');
  await page.waitForSelector('#setupIncome:not(.hidden)');await page.click('#skipIncomeSetup');
  await page.waitForSelector('#setupExpense:not(.hidden)');
  const rows=page.locator('#expenseRows .entryRow');
  const r1=rows.first();
  await r1.locator('.rName').fill('Fratello');await r1.locator('.rAmount').fill('50');await r1.locator('.rDateText').fill('1 ottobre una volta');await r1.locator('.rDateText').blur();
  await page.click('#addExpenseSetup');
  const r2=page.locator('#expenseRows .entryRow').nth(1);
  await r2.locator('.rName').fill('730');await r2.locator('.rAmount').fill('700');await r2.locator('.rDateText').fill('11 ottobre per 3 mesi');await r2.locator('.rDateText').blur();
  await page.click('#saveExpenseSetup');await page.waitForSelector('#home:not(.hidden)');
  const s=await state(page),one=s.entries.find(e=>e.name==='Fratello'),three=s.entries.find(e=>e.name==='730');
  assert.equal(one.recurrence.kind,'single');
  assert.equal(three.recurrence.kind,'count');assert.equal(three.recurrence.count,3);
  await context.close();
}

async function testFinanceManualDatesAndMovements(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);
  await page.click('#homeIncome');await page.waitForSelector('#flow:not(.hidden)');
  assert.match(await page.locator('#flowUnifiedList').innerText(),/Nessuna entrata inserita/);
  await page.click('#flowAdd');
  assert.equal(await page.locator('input[type="date"]').count(),0);
  assert.equal(await page.locator('#editAmount').getAttribute('placeholder'),'es. 1000 €');
  assert.notEqual(await page.evaluate(()=>document.activeElement&&document.activeElement.id),'editName');
  assert.equal(await page.locator('#editRecurrenceBlock:not(.hidden)').count(),0);
  await page.click('#editDateText');
  assert.equal(await page.locator('#editRecurrenceBlock:not(.hidden)').count(),1);
  assert.match(await page.locator('#editRecChoices').innerText(),/Una volta/);
  assert.match(await page.locator('#editRecChoices').innerText(),/Ogni mese/);
  assert.match(await page.locator('#editRecChoices').innerText(),/Altro/);
  await page.fill('#editName','Test entrata');await page.fill('#editAmount','50');
  await page.fill('#editDateText','35/10/2026');await page.locator('#editDateText').blur();
  assert.equal(await page.locator('#editDateError:not(.hidden)').count(),1);
  await page.fill('#editDateText',slash(iso()));await page.dispatchEvent('#editDateText','input');
  await page.locator('#editRecChoices button[data-kind="single"]').click();
  assert.notEqual(await page.evaluate(()=>document.activeElement&&document.activeElement.id),'editDateText');
  await page.click('#editSave');
  let row=page.locator('.flowUnifiedRow').filter({hasText:'Test entrata'}).first();
  await row.locator('.flowUnifiedStatus').click();await confirmStatus(page,{amount:55});
  assert.equal((await state(page)).balance,1055);
  await page.click('#undoSnackBtn');assert.equal((await state(page)).balance,1000);
  row=page.locator('.flowUnifiedRow').filter({hasText:'Test entrata'}).first();await row.locator('.flowUnifiedStatus').click();await confirmStatus(page,{amount:52});
  await backHome(page);

  await addItem(page,'expense','Test pagamento',20,{complete:true,actualAmount:18});await backHome(page);
  assert.equal((await state(page)).balance,1034);

  await settings(page);await page.click('#settingsEditBalance');await page.fill('#newBalance','1040');await page.click('#balSave');await page.click('#settingsBack');await page.waitForSelector('#home:not(.hidden)');
  let s=await state(page);assert.equal(s.balance,1040);assert.equal(s.history.some(h=>h.type==='adjustment'),false);

  await page.click('#homeAllMovements');await page.waitForSelector('#movements:not(.hidden)');
  assert.equal(await page.locator('.movementQuickTab').count(),4);assert.equal(await page.locator('.movementRow').count(),2);
  await page.locator('[data-movement-type="income"]').click();assert.equal(await page.locator('.movementRow').count(),1);
  await page.locator('[data-movement-type="all"]').click();
  await page.click('#movementsFilters');await page.locator('#mfTypeChoices button[data-v="expense"]').click();await page.click('#mfApply');
  assert.equal(await page.locator('.movementRow').count(),1);assert.match(await page.locator('.movementRow').innerText(),/Test pagamento/);

  await page.click('.movementRow');await page.click('#moveEdit');await page.fill('#moveAmount','20');await page.fill('#moveDateText','10 ottobre 2026');await page.click('#moveSave');
  assert.equal((await state(page)).balance,1038);
  const edited=page.locator('.movementRow').filter({hasText:'Test pagamento'}).first();await edited.click();await page.click('#moveDeleteDetail');await page.click('#moveDeleteYes');
  assert.equal((await state(page)).balance,1058);
  await context.close();
}

async function testRecurrencesAndHistory(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);
  await page.click('#homeExpense');await page.waitForSelector('#flow:not(.hidden)');

  await page.click('#flowAdd');await page.fill('#editName','Una volta test');await page.fill('#editAmount','5');await page.fill('#editDateText','1 ottobre 2026 una volta');await page.dispatchEvent('#editDateText','input');await page.locator('#editDateText').blur();
  assert.equal(await page.locator('#editDateError:not(.hidden)').count(),0);await page.click('#editSave');
  let s=await state(page),e=s.entries.find(x=>x.name==='Una volta test');assert.equal(e.recurrence.kind,'single');assert.equal(e.dateSpec.iso,'2026-10-01');

  await page.click('#flowAdd');await page.fill('#editName','Tre mesi test');await page.fill('#editAmount','7');await page.fill('#editDateText','11 ottobre 2026 per 3 mesi');await page.dispatchEvent('#editDateText','input');await page.locator('#editDateText').blur();
  assert.equal(await page.locator('#editDateError:not(.hidden)').count(),0);await page.click('#editSave');
  s=await state(page);e=s.entries.find(x=>x.name==='Tre mesi test');assert.equal(e.recurrence.kind,'count');assert.equal(e.recurrence.count,3);

  await page.click('#flowAdd');
  await page.fill('#editName','Mensile scritto test');await page.fill('#editAmount','23');await page.fill('#editDateText','23 ottobre');await page.dispatchEvent('#editDateText','input');await page.locator('#editDateText').blur();
  assert.equal(await page.locator('#editDateError:not(.hidden)').count(),0);
  await page.locator('#editRecChoices button[data-kind="monthly"]').click();
  await page.click('#editSave');
  s=await state(page);e=s.entries.find(x=>x.name==='Mensile scritto test');assert.equal(e.recurrence.kind,'monthly');assert.equal(e.day,23);

  await page.click('#flowAdd');
  await page.fill('#editName','Mensile test');await page.fill('#editAmount','10');await chooseDate(page,'10 ottobre 2026');await chooseRec(page,'monthly');await page.click('#editSave');
  s=await state(page);e=s.entries.find(x=>x.name==='Mensile test');
  assert.equal(e.recurrence.kind,'monthly');assert.equal(e.dateSpec.iso,'2026-10-10');

  await page.click('#flowAdd');await page.fill('#editName','Altro test');await page.fill('#editAmount','12');await chooseDate(page,'11/10/2026');await chooseRec(page,'custom');
  await page.fill('#editorEvery','2');await page.selectOption('#editorUnit','week');await page.selectOption('#editorEndMode','count');await page.fill('#editorRepeatCount','3');await page.click('#editorRecSave');await page.click('#editSave');
  s=await state(page);e=s.entries.find(x=>x.name==='Altro test');
  assert.equal(e.recurrence.kind,'custom');assert.equal(e.recurrence.every,2);assert.equal(e.recurrence.unit,'week');assert.equal(e.recurrence.count,3);
  assert.equal(await page.locator('input[type="date"]').count(),0);
  await context.close();
}

async function testCategoriesAndNotifications(browser){
  const {context,page}=await freshPage(browser,{notifications:true});await setup(page,1000);await settings(page);
  await page.click('#settingsCategories');await page.click('#catTabExpense');await page.click('#categoryAdd');await page.fill('#categoryNameEdit','Varie');await page.click('#categoryNameSave');
  assert.match(await page.locator('#modalBody').innerText(),/Varie/);
  await page.click('#modalClose');await page.click('#settingsBack');await page.waitForSelector('#home:not(.hidden)');
  await addItem(page,'expense','Varie spesa',20,{category:'Varie',complete:true});await backHome(page);
  await settings(page);await page.click('#settingsCategories');await page.click('#catTabExpense');
  const row=page.locator('.categoryEditRow').filter({hasText:'Varie'}).first();await row.click();await page.click('#catDeleteOpen');await page.click('#categoryDeleteYes');
  let s=await state(page);assert.equal(s.entries.find(x=>x.name==='Varie spesa').category,'');assert.equal(s.history.find(x=>x.name==='Varie spesa').category,'');
  await page.click('#modalClose');

  await page.click('#settingsNotifications');await page.waitForSelector('#notifications:not(.hidden)');
  await page.check('#notifyIncomeDue');await page.check('#notifyExpenseDue');await page.check('#notifyBefore');await page.fill('#notifyTime','08:30');await page.locator('#notifyTime').dispatchEvent('change');
  s=await state(page);assert.equal(s.notifications.rules.income.timing,'before');assert.equal(s.notifications.rules.income.time,'08:30');
  await page.click('#notificationsBack');await page.waitForSelector('#settings:not(.hidden)');
  await context.close();
}

async function testSettingsAppearanceSecurityBackup(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);await settings(page);

  for(const id of ['settingsEditBalance','settingsIncome','settingsExpense','settingsCategories','settingsColor','settingsGuide','settingsBackup','settingsSecurity','settingsOther','settingsInfo']){
    await page.click('#'+id);
    await page.waitForSelector('#modal:not(.hidden)');
    await page.click('#modalClose');
    await page.waitForSelector('#settings:not(.hidden)');
  }

  await page.click('#settingsColor');await page.locator('[data-color="Verde"]').click();await page.selectOption('#prefTextSize','large');await page.check('#prefReduceMotion');await page.click('#colorSave');
  let s=await state(page);assert.equal(s.appColor,'Verde');assert.equal(s.preferences.textSize,'large');assert.equal(s.preferences.reduceAnimations,true);

  await page.click('#settingsSecurity');await page.check('#securityHideAmounts');await page.selectOption('#securityLockMinutes','5');await page.click('#modalClose');await page.click('#settingsBack');await page.waitForSelector('#home:not(.hidden)');
  assert.match(await page.locator('#homeBalance').innerText(),/••••/);
  s=await state(page);assert.equal(s.security.hideHomeAmounts,true);assert.equal(s.security.lockMinutes,5);

  await settings(page);await page.click('#settingsBackup');
  const current=await state(page),restored=structuredClone(current);restored.balance=777;restored.security.hideHomeAmounts=false;restored.entries=[];restored.history=[];
  const payload={format:'in-ordine-conti',version:2,createdAt:new Date().toISOString(),data:restored};
  await page.locator('#backupFile').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
  await page.waitForSelector('#landing:not(.hidden)');await page.click('#landingConti');await page.waitForSelector('#home:not(.hidden)');
  assert.match(await page.locator('#homeBalance').innerText(),/777,00/);

  await page.click('#homeBackLanding');
  await page.evaluate(({key,hash})=>{const s=JSON.parse(localStorage.getItem(key));s.security.enabled=true;s.security.pinHash=hash;s.security.lastActivity=0;localStorage.setItem(key,JSON.stringify(s))},{key:KEY,hash:pinHash('1234')});
  await page.reload();await page.click('#landingConti');await page.waitForSelector('#unlockPin');
  await page.fill('#unlockPin','1234');await page.click('#unlockPinBtn');await page.waitForSelector('#home:not(.hidden)');
  await context.close();
}

async function testFlowMonthNavigation(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);

  await addItem(page,'expense','Pagamento passato',15,{date:'25 settembre 2026',complete:true});
  await backHome(page);

  await addItem(page,'expense','Mensile futuro',20,{date:'10 ottobre 2026',rec:'monthly'});
  assert.match(await page.locator('#flowMonthLabel').innerText(),/Ottobre 2026/);
  assert.match(await page.locator('#flowUnifiedList').innerText(),/Mensile futuro/);

  await page.click('#flowPrevMonth');
  assert.match(await page.locator('#flowMonthLabel').innerText(),/Settembre 2026/);
  assert.match(await page.locator('#flowUnifiedList').innerText(),/Pagamento passato/);

  await page.click('#flowNextMonth');
  await page.click('#flowNextMonth');
  assert.match(await page.locator('#flowMonthLabel').innerText(),/Novembre 2026/);
  assert.match(await page.locator('#flowUnifiedList').innerText(),/Mensile futuro/);

  await context.close();
}

async function testHomeTotalsMatchOpenLists(browser){
  const {context,page}=await freshPage(browser);await setup(page,-1999);

  await addItem(page,'income','INPS',720,{date:'1 ottobre 2026'});await backHome(page);
  await addItem(page,'income','Stipendio',1100,{date:'10 ottobre 2026'});await backHome(page);
  await addItem(page,'income','Affitto',250,{date:'20 ottobre 2026'});await backHome(page);

  const expenses=[
    ['Mutuo',400,'1 ottobre 2026'],
    ['Fratello',50,'1 ottobre 2026'],
    ['Iliad',10,'4 ottobre 2026'],
    ['Genitori',200,'10 ottobre 2026'],
    ['Esame',100,'10 ottobre 2026'],
    ['730',695,'11 ottobre 2026'],
    ['Liquido',35,'15 ottobre 2026'],
    ['Benzina',150,'15 ottobre 2026'],
    ['Timvision',30,'22 ottobre 2026'],
    ['Chat gpt',23,'23 ottobre 2026'],
    ['Fastweb',30,'25 ottobre 2026'],
    ['Sky',53,'25 ottobre 2026']
  ];
  for(const [name,amount,date] of expenses){await addItem(page,'expense',name,amount,{date});await backHome(page)}

  assert.match(await page.locator('#homeIncomeTotal').innerText(),/2\.070,00/);
  assert.match(await page.locator('#homeExpenseTotal').innerText(),/1\.776,00/);
  assert.match(await page.locator('#homeProjectionValue').innerText(),/-1\.705,00/);

  await page.click('#homeExpense');await page.waitForSelector('#flow:not(.hidden)');
  const pendingTexts=await page.locator('.flowUnifiedRow .flowUnifiedStatus').allInnerTexts();
  assert.equal(pendingTexts.filter(x=>/DA PAGARE|SCADUTO/.test(x)).length,12);
  await context.close();
}

async function testPwaOffline(browser){
  const {context,page}=await freshPage(browser);
  await page.evaluate(()=>navigator.serviceWorker?.ready);await page.reload();await page.waitForSelector('#landing:not(.hidden)');
  assert.equal(await page.evaluate(()=>!!navigator.serviceWorker?.controller),true);
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#landing:not(.hidden)');
  await context.setOffline(false);await context.close();
}

const browser=await chromium.launch({headless:true});
try{
  await testApprovedOnboarding(browser);
  await testSetupNaturalRecurrences(browser);
  await testFinanceManualDatesAndMovements(browser);
  await testRecurrencesAndHistory(browser);
  await testCategoriesAndNotifications(browser);
  await testSettingsAppearanceSecurityBackup(browser);
  await testFlowMonthNavigation(browser);
  await testHomeTotalsMatchOpenLists(browser);
  await testPwaOffline(browser);
  console.log('All In Ordine regression tests passed');
}finally{await browser.close()}

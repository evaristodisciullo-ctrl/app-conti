import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const ORIGIN='http://127.0.0.1:4173/';
const KEY='inOrdineContiV1';

const pinHash=pin=>crypto.createHash('sha256').update('in-ordine|'+pin).digest('base64url');
const iso=(d=new Date())=>d.toISOString().slice(0,10);
const addDays=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return iso(d)};
const ym=(d=new Date())=>d.toISOString().slice(0,7);
const addMonths=(n)=>{const d=new Date();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7)};
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
async function openHome(page){
  if(await page.locator('#landing:not(.hidden)').count())await page.click('#landingConti');
  await page.waitForSelector('#home:not(.hidden)');
}
async function chooseDate(page,manual=slash(iso())){
  await page.fill('#editDateText',manual);
  await page.dispatchEvent('#editDateText','input');
  await page.locator('#editDateText').blur();
  await page.waitForSelector('#editRecurrenceBlock:not(.hidden)');
}
async function chooseRec(page,kind){
  await page.locator('#editRecChoices button[data-kind="'+kind+'"]').click();
}
async function confirmStatus(page,{amount,date}={}){
  await page.waitForSelector('#modal:not(.hidden)');
  if(amount!=null)await page.fill('#completeActualAmount',String(amount));
  if(date)await page.fill('#completeActualDate',date);
  await page.click('#completeConfirm');
}
async function addItem(page,type,name,amount,{date=slash(iso()),rec='single',category='',complete=false,actualAmount=null}={}){
  if(!(await page.locator('#home:not(.hidden)').count()))await openHome(page);
  await page.click(type==='income'?'#homeIncome':'#homeExpense');
  await page.click('#flowAdd');
  await page.fill('#editName',name);
  await page.fill('#editAmount',String(amount));
  await chooseDate(page,date);
  await chooseRec(page,rec);
  if(category)await page.selectOption('#editCategory',{label:category});
  await page.click('#editSave');
  const row=page.locator('.flowUnifiedRow').filter({hasText:name}).first();
  await row.waitFor();
  if(complete){
    await row.locator('.flowUnifiedStatus').click();
    await confirmStatus(page,{amount:actualAmount==null?amount:actualAmount});
  }
  return row;
}
async function backHomeFromFlow(page){await page.click('#flowBack');await page.waitForSelector('#home:not(.hidden)')}
async function settings(page){await page.click('#homeSettingsCard');await page.waitForSelector('#settings:not(.hidden)')}

async function testApprovedOnboarding(browser){
  const {context,page}=await freshPage(browser);
  assert.equal(await page.locator('#landingConti').isVisible(),true);
  assert.equal(await page.locator('#landingTodo').isVisible(),true);
  await page.click('#landingConti');
  assert.match(await page.locator('#setup').innerText(),/Inserisci il tuo saldo attuale/);
  await page.fill('#startBalance','1000');await page.click('#startBtn');
  await page.waitForSelector('#setupIncome:not(.hidden)');
  assert.match(await page.locator('#setupIncome').innerText(),/ENTRATE/);
  const incomeInputs=page.locator('#incomeRows .entryRow').first();
  assert.equal(await incomeInputs.locator('.rName').getAttribute('placeholder'),'Es. Stipendio');
  assert.equal(await incomeInputs.locator('.rAmount').getAttribute('placeholder'),'Es. 1.400 €');
  assert.equal(await incomeInputs.locator('.rDateText').getAttribute('placeholder'),'Es. 10 del mese');

  await incomeInputs.locator('.rName').fill('Stipendio');
  await incomeInputs.locator('.rAmount').fill('1400');
  await incomeInputs.locator('.rDateText').fill('10 del mese');
  await incomeInputs.locator('.rDateText').blur();
  await page.click('#saveIncomeSetup');

  await page.waitForSelector('#setupExpense:not(.hidden)');
  assert.match(await page.locator('#setupExpense').innerText(),/PAGAMENTI/);
  const expenseInputs=page.locator('#expenseRows .entryRow').first();
  assert.equal(await expenseInputs.locator('.rName').getAttribute('placeholder'),'Es. Mutuo');
  assert.equal(await expenseInputs.locator('.rAmount').getAttribute('placeholder'),'Es. 387,03 €');
  assert.equal(await expenseInputs.locator('.rDateText').getAttribute('placeholder'),'Es. 1 del mese');
  await page.click('#skipExpenseSetup');
  await page.waitForSelector('#home:not(.hidden)');

  const s=await state(page);
  const salary=s.entries.find(e=>e.name==='Stipendio');
  assert.equal(salary.recurrence.kind,'monthly');
  assert.equal(salary.day,10);
  assert.equal(s.balance,1000);
  await context.close();
}

async function testFinanceAndManualDates(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);
  await page.click('#homeIncome');
  assert.match(await page.locator('#flowUnifiedList').innerText(),/Nessuna entrata inserita/);
  await page.click('#flowAdd');
  assert.equal(await page.locator('input[type="date"]').count(),0);
  assert.equal(await page.locator('#editAmount').getAttribute('placeholder'),'Es. 1000 €');
  await page.fill('#editName','Test entrata');
  await page.fill('#editAmount','50');
  await page.fill('#editDateText','35/10/2026');
  await page.locator('#editDateText').blur();
  assert.equal(await page.locator('#editDateError:not(.hidden)').count(),1);
  await page.fill('#editDateText',slash(iso()));
  await page.locator('#editDateText').blur();
  await page.locator('#editRecChoices button[data-kind="single"]').click();
  await page.click('#editSave');

  let row=page.locator('.flowUnifiedRow').filter({hasText:'Test entrata'}).first();
  await row.locator('.flowUnifiedStatus').click();
  await confirmStatus(page,{amount:55});
  assert.equal((await state(page)).balance,1055);
  assert.equal(await page.locator('#undoSnack:not(.hidden)').count(),1);
  await page.click('#undoSnackBtn');
  assert.equal((await state(page)).balance,1000);

  row=page.locator('.flowUnifiedRow').filter({hasText:'Test entrata'}).first();
  await row.locator('.flowUnifiedStatus').click();await confirmStatus(page,{amount:52});
  await backHomeFromFlow(page);

  await addItem(page,'expense','Test pagamento',20,{complete:true,actualAmount:18});
  await backHomeFromFlow(page);
  assert.equal((await state(page)).balance,1034);

  await page.click('#editBalance');await page.fill('#newBalance','1040');await page.click('#balSave');
  let s=await state(page);assert.equal(s.balance,1040);
  assert.equal(s.history.some(h=>h.type==='adjustment'),false);

  await page.click('#homeAllMovements');
  await page.waitForSelector('#movements:not(.hidden)');
  assert.equal(await page.locator('.movementQuickTab').count(),4);
  assert.match(await page.locator('#movementsFilters').innerText(),/Filtra/);
  assert.equal(await page.locator('.movementRow').count(),2);
  await page.locator('[data-movement-type="income"]').click();
  assert.equal(await page.locator('.movementRow').count(),1);
  assert.match(await page.locator('.movementRow').innerText(),/Test entrata/);
  await page.locator('[data-movement-type="all"]').click();

  await page.click('#movementsFilters');
  await page.selectOption('#mfType','expense');
  await page.click('#mfApply');
  assert.equal(await page.locator('.movementRow').count(),1);
  assert.match(await page.locator('.movementRow').innerText(),/Test pagamento/);

  await page.reload();await page.waitForSelector('#landing:not(.hidden)');await page.click('#landingConti');await page.waitForSelector('#home:not(.hidden)');
  assert.match(await page.locator('#homeBalance').innerText(),/1\.040,00/);
  await context.close();
}

async function testFutureAndRecurrences(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);
  const future=addDays(20);
  await addItem(page,'income','Entrata futura',75,{date:slash(future)});
  assert.equal(await page.locator('.flowUnifiedRow').filter({hasText:'Entrata futura'}).count(),1);
  await backHomeFromFlow(page);

  await page.click('#homeExpense');await page.click('#flowAdd');
  await page.fill('#editName','Mensile test');await page.fill('#editAmount','10');
  await chooseDate(page,'10 ottobre 2026');await chooseRec(page,'monthly');await page.click('#editSave');
  let s=await state(page),e=s.entries.find(x=>x.name==='Mensile test');
  assert.equal(e.recurrence.kind,'monthly');
  assert.equal(e.dateSpec.kind,'day');
  assert.equal(e.dateSpec.iso,'2026-10-10');

  await page.click('#flowAdd');await page.fill('#editName','Altro test');await page.fill('#editAmount','12');
  await chooseDate(page,'11/10/2026');await chooseRec(page,'custom');
  await page.fill('#editorEvery','2');await page.selectOption('#editorUnit','week');await page.selectOption('#editorEndMode','count');
  await page.fill('#editorRepeatCount','3');await page.click('#editorRecSave');await page.click('#editSave');
  s=await state(page);e=s.entries.find(x=>x.name==='Altro test');
  assert.equal(e.recurrence.kind,'custom');assert.equal(e.recurrence.every,2);assert.equal(e.recurrence.unit,'week');assert.equal(e.recurrence.count,3);
  assert.equal(await page.locator('input[type="date"]').count(),0);
  await context.close();
}

async function testMovementEditing(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);
  await addItem(page,'income','Movimento test',50,{complete:true,actualAmount:50});await backHomeFromFlow(page);
  await page.click('#homeAllMovements');
  let row=page.locator('.movementRow').filter({hasText:'Movimento test'}).first();await row.click();
  await page.fill('#moveAmount','60');
  await page.fill('#moveDateText','10 ottobre 2026');
  await page.click('#moveSave');
  assert.equal((await state(page)).balance,1060);
  row=page.locator('.movementRow').filter({hasText:'Movimento test'}).first();await row.click();await page.click('#moveDelete');await page.click('#moveDeleteYes');
  assert.equal((await state(page)).balance,1000);
  await page.click('#movementsBack');await page.click('#homeIncome');
  assert.equal(await page.locator('.flowUnifiedRow').filter({hasText:'Movimento test'}).count(),1);
  await context.close();
}

async function testCategoriesBudgetNotifications(browser){
  const {context,page}=await freshPage(browser,{notifications:true});await setup(page,1000);
  await settings(page);await page.click('#settingsCategories');await page.click('#categoryManageOpen');
  await page.locator('.catAdd[data-type="expense"]').click();await page.fill('#categoryNameEdit','Varie');await page.click('#categoryNameSave');
  assert.match(await page.locator('#modalBody').innerText(),/Varie/);await page.click('#modalClose');await page.click('#settingsBack');

  await addItem(page,'expense','Varie spesa',20,{category:'Varie',complete:true});await backHomeFromFlow(page);
  await addItem(page,'expense','Auto spesa',80,{category:'Auto',complete:true});await backHomeFromFlow(page);

  await settings(page);await page.click('#settingsCategories');await page.click('#categoryManageOpen');
  await page.locator('.catDelete[data-type="expense"][data-cat="Varie"]').click();await page.click('#categoryDeleteYes');
  let s=await state(page);assert.equal(s.entries.find(x=>x.name==='Varie spesa').category,'');assert.equal(s.history.find(x=>x.name==='Varie spesa').category,'');
  await page.click('#modalClose');

  await page.click('#settingsBudget');await page.click('#budgetAdd');await page.click('#budgetCategoryChoice');
  await page.selectOption('#budgetCategory',{label:'Auto'});await page.fill('#budgetAmount','100');await page.selectOption('#budgetNotifyMode','80');await page.click('#budgetSave');
  s=await state(page);assert.equal(s.budgetPlans.find(p=>p.effectiveMonth===ym()).limits.Auto,100);
  if(await page.locator('#modal:not(.hidden)').count())await page.click('#modalClose');
  await page.click('#budgetBack');await page.waitForSelector('#settings:not(.hidden)');await page.click('#settingsNotifications');

  await page.click('#notifyAll');await page.selectOption('#nIncomeTiming','before');await page.fill('#nIncomeTime','08:30');await page.selectOption('#nExpenseTiming','same');await page.fill('#nExpenseTime','10:15');await page.click('#nAllSave');
  s=await state(page);assert.equal(s.notifications.mode,'all');assert.equal(s.notifications.rules.income.timing,'before');
  await context.close();
}

async function testSettingsSecurityBackup(browser){
  const {context,page}=await freshPage(browser);await page.fill('#landingNickname','Mario');await setup(page,1000);
  await settings(page);
  await page.fill('#settingsSearch','tutorial');assert.equal(await page.locator('#settingsGuide').isVisible(),true);assert.equal(await page.locator('#settingsIncome').isVisible(),false);
  await page.fill('#settingsSearch','');assert.equal(await page.locator('#settingsOther').isVisible(),true);assert.equal(await page.locator('#settingsInfo').isVisible(),true);
  await page.click('#settingsIncome');await page.click('#entityHubManage');await page.waitForSelector('#flow:not(.hidden)');await page.click('#flowBack');await page.waitForSelector('#settings:not(.hidden)');
  await page.click('#settingsOther');assert.match(await page.locator('#modalBody').innerText(),/Non viene utilizzato il calendario/i);await page.click('#modalClose');
  await page.click('#settingsInfo');assert.match(await page.locator('#modalBody').innerText(),/In Ordine/);await page.click('#modalClose');
  await page.click('#settingsBack');await page.click('#homeBackLanding');

  await page.evaluate(({key,hash})=>{const s=JSON.parse(localStorage.getItem(key));s.security={enabled:true,pinHash:hash,credentialId:'',lastActivity:0};localStorage.setItem(key,JSON.stringify(s))},{key:KEY,hash:pinHash('1234')});
  await page.reload();await page.waitForSelector('#landing:not(.hidden)');
  await page.click('#landingConti');await page.waitForSelector('#modal:not(.hidden)');
  await page.fill('#unlockPin','1234');await page.click('#unlockPinBtn');await page.waitForSelector('#home:not(.hidden)');

  await settings(page);await page.click('#settingsBackup');
  const current=await state(page),restored=structuredClone(current);restored.balance=777;restored.entries=[];restored.history=[];
  const payload={format:'in-ordine-conti',version:2,createdAt:new Date().toISOString(),data:restored};
  await page.locator('#backupFile').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
  await page.waitForSelector('#landing:not(.hidden)');
  await page.click('#landingConti');
  if(await page.locator('#unlockPin').count()){await page.fill('#unlockPin','1234');await page.click('#unlockPinBtn')}
  await page.waitForSelector('#home:not(.hidden)');
  assert.match(await page.locator('#homeBalance').innerText(),/777,00/);
  await context.close();
}

async function testEverySettingsEntryOpens(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);await settings(page);

  for(const id of ['settingsEditBalance','settingsIncome','settingsExpense','settingsCategories','settingsProfile','settingsColor','settingsGuide','settingsBackup','settingsSecurity','settingsOther','settingsInfo']){
    await page.click('#'+id);
    await page.waitForSelector('#modal:not(.hidden)');
    await page.click('#modalClose');
    await page.waitForSelector('#settings:not(.hidden)');
  }

  await page.click('#settingsMovements');await page.waitForSelector('#movements:not(.hidden)');await page.click('#movementsBack');await page.waitForSelector('#settings:not(.hidden)');
  await page.click('#settingsBudget');await page.waitForSelector('#budget:not(.hidden)');await page.click('#budgetBack');await page.waitForSelector('#settings:not(.hidden)');
  await page.click('#settingsNotifications');await page.waitForSelector('#notifications:not(.hidden)');await page.click('#notificationsBack');await page.waitForSelector('#settings:not(.hidden)');

  await context.close();
}

async function testPwaOffline(browser){
  const {context,page}=await freshPage(browser);
  await page.evaluate(()=>navigator.serviceWorker?.ready);
  await page.reload();await page.waitForSelector('#landing:not(.hidden)');
  const controlled=await page.evaluate(()=>!!navigator.serviceWorker?.controller);assert.equal(controlled,true);
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#landing:not(.hidden)');
  await context.setOffline(false);await context.close();
}

const browser=await chromium.launch({headless:true});
try{
  await testApprovedOnboarding(browser);
  await testFinanceAndManualDates(browser);
  await testFutureAndRecurrences(browser);
  await testMovementEditing(browser);
  await testCategoriesBudgetNotifications(browser);
  await testSettingsSecurityBackup(browser);
  await testEverySettingsEntryOpens(browser);
  await testPwaOffline(browser);
  console.log('All Conti economici regression tests passed');
}finally{await browser.close()}

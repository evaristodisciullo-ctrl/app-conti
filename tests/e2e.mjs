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
async function chooseDate(page,manual=''){
  await page.click('#editDateDisplay');
  if(manual)await page.fill('#dateManualInput',manual);
  await page.click('#datePickerConfirm');
}
async function chooseRec(page,kind){
  await page.locator('#editRecChoices button[data-kind="'+kind+'"]').click();
}
async function addItem(page,type,name,amount,{date='',rec='single',category='',complete=false}={}){
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
  if(complete)await row.locator('.flowUnifiedStatus').click();
  return row;
}
async function backHomeFromFlow(page){await page.click('#flowBack');await page.waitForSelector('#home:not(.hidden)')}
async function settings(page){await page.click('#homeSettingsCard');await page.waitForSelector('#settings:not(.hidden)')}

async function testSetupAndFinance(browser){
  const {context,page}=await freshPage(browser);
  await page.click('#landingConti');
  await page.fill('#startBalance','1000');await page.click('#startBtn');
  await page.fill('.rName','Solo nome');await page.click('#saveIncomeSetup');
  await page.waitForSelector('#modal:not(.hidden)');
  assert.match(await page.locator('#modalBody').innerText(),/riga 1/i);
  await page.click('#modalClose');await page.click('#skipIncomeSetup');await page.click('#skipExpenseSetup');
  assert.equal((await state(page)).balance,1000);

  await addItem(page,'income','Test entrata',50);
  let row=page.locator('.flowUnifiedRow').filter({hasText:'Test entrata'}).first();
  await row.locator('.flowUnifiedStatus').click();
  assert.equal((await state(page)).balance,1050);
  assert.equal(await page.locator('#undoSnack:not(.hidden)').count(),1);
  await page.click('#undoSnackBtn');
  assert.equal((await state(page)).balance,1000);
  assert.equal((await state(page)).history.length,0);

  row=page.locator('.flowUnifiedRow').filter({hasText:'Test entrata'}).first();
  await row.locator('.flowUnifiedStatus').click();
  row=page.locator('.flowUnifiedRow').filter({hasText:'Test entrata'}).first();
  await row.locator('.flowUnifiedStatus').click();
  await page.waitForSelector('#modal:not(.hidden)');
  await page.click('#reopenYes');
  assert.equal((await state(page)).balance,1000);
  row=page.locator('.flowUnifiedRow').filter({hasText:'Test entrata'}).first();
  await row.locator('.flowUnifiedStatus').click();
  await backHomeFromFlow(page);

  await addItem(page,'expense','Test pagamento',20,{complete:true});
  await backHomeFromFlow(page);
  assert.equal((await state(page)).balance,1030);

  await addItem(page,'expense','Scaduto test',30,{date:addDays(-2),complete:false});
  row=page.locator('.flowUnifiedRow').filter({hasText:'Scaduto test'}).first();
  assert.match(await row.locator('.flowUnifiedStatus').innerText(),/SCADUTO/);
  await row.locator('.flowUnifiedStatus').click();
  await backHomeFromFlow(page);
  assert.equal((await state(page)).balance,1000);

  await page.click('#editBalance');await page.fill('#newBalance','1010');await page.fill('#balanceReason','Allineamento');
  await page.click('#balSave');
  const s=await state(page);assert.equal(s.balance,1010);assert.equal(s.history.some(h=>h.type==='adjustment'&&h.reason==='Allineamento'),true);

  await page.reload();await page.waitForSelector('#landing:not(.hidden)');await page.click('#landingConti');await page.waitForSelector('#home:not(.hidden)');
  assert.match(await page.locator('#homeBalance').innerText(),/1\.010,00/);
  await context.close();
}

async function testMovementEditing(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);
  await addItem(page,'income','Movimento test',50,{complete:true});await backHomeFromFlow(page);
  await page.click('#homeAllMovements');
  let row=page.locator('.movementRow').filter({hasText:'Movimento test'}).first();await row.click();
  await page.fill('#moveAmount','60');await page.click('#moveSave');
  assert.equal((await state(page)).balance,1060);
  row=page.locator('.movementRow').filter({hasText:'Movimento test'}).first();await row.click();await page.click('#moveDelete');await page.click('#moveDeleteYes');
  assert.equal((await state(page)).balance,1000);
  await page.click('#movementsBack');await page.click('#homeIncome');
  assert.equal(await page.locator('.flowUnifiedRow').filter({hasText:'Movimento test'}).count(),1);
  await page.click('#flowBack');

  await page.click('#editBalance');await page.fill('#newBalance','1100');await page.fill('#balanceReason','Correzione prova');await page.click('#balSave');
  await page.click('#homeAllMovements');row=page.locator('.movementRow').filter({hasText:'Correzione saldo'}).first();await row.click();
  await page.fill('#moveDelta','50');await page.click('#moveSave');assert.equal((await state(page)).balance,1050);
  row=page.locator('.movementRow').filter({hasText:'Correzione saldo'}).first();await row.click();await page.click('#moveDelete');await page.click('#moveDeleteYes');
  assert.equal((await state(page)).balance,1000);
  await context.close();
}

async function testRecurrencesAndDates(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);

  await addItem(page,'expense','Mensile test',10,{rec:'monthly'});
  let s=await state(page);let e=s.entries.find(x=>x.name==='Mensile test');assert.equal(e.recurrence.kind,'monthly');
  await backHomeFromFlow(page);

  // Previous completed occurrence must remain after ending future series.
  await page.evaluate(({key,current,previous})=>{
    const s=JSON.parse(localStorage.getItem(key)),e=s.entries.find(x=>x.name==='Mensile test');
    e.recurrence={kind:'monthly',startMonth:previous};
    s.history.push({id:'oldhist',entryId:e.id,type:'expense',name:e.name,amount:10,date:previous+'-15',month:previous,occurrenceMonth:previous,occurrenceKey:previous,category:'',note:''});
    localStorage.setItem(key,JSON.stringify(s));
  },{key:KEY,current:ym(),previous:addMonths(-1)});
  await page.reload();await page.click('#landingConti');await page.click('#homeExpense');
  let recurring=page.locator('.flowUnifiedRow').filter({hasText:'Mensile test'}).first();
  await recurring.locator('.flowUnifiedMain').click();await page.click('#occFuture');await page.click('#futDelete');await page.click('#deleteOccFuture');await page.click('#deleteOccYes');
  s=await state(page);assert.equal(s.history.some(h=>h.id==='oldhist'),true);
  e=s.entries.find(x=>x.name==='Mensile test');assert.equal(e.recurrence.stopBeforeMonth,ym());
  assert.equal(await page.locator('.flowUnifiedRow').filter({hasText:'Mensile test'}).count(),0);
  await page.click('#flowBack');

  // Custom weekly recurrence, 3 occurrences.
  await page.click('#homeIncome');await page.click('#flowAdd');await page.fill('#editName','Altro test');await page.fill('#editAmount','12');
  await chooseDate(page);await chooseRec(page,'custom');
  await page.fill('#editorEvery','1');await page.selectOption('#editorUnit','week');await page.selectOption('#editorEndMode','count');
  await page.fill('#editorRepeatCount','3');await page.click('#editorRecSave');await page.click('#editSave');
  s=await state(page);e=s.entries.find(x=>x.name==='Altro test');assert.equal(e.recurrence.kind,'custom');assert.equal(e.recurrence.count,3);assert.equal(e.recurrence.unit,'week');

  // Flexible dates.
  await page.click('#flowAdd');await page.fill('#editName','Anno test');await page.fill('#editAmount','5');await chooseDate(page,'2027');await chooseRec(page,'single');await page.click('#editSave');
  await page.click('#flowAdd');await page.fill('#editName','Mese anno test');await page.fill('#editAmount','6');await chooseDate(page,'ottobre 2027');await chooseRec(page,'single');await page.click('#editSave');
  await page.click('#flowAdd');await page.fill('#editName','Solo mese test');await page.fill('#editAmount','7');await chooseDate(page,'ottobre');await chooseRec(page,'single');await page.click('#editSave');
  s=await state(page);
  assert.deepEqual(s.entries.find(x=>x.name==='Anno test').dateSpec,{kind:'year',year:2027});
  assert.deepEqual(s.entries.find(x=>x.name==='Mese anno test').dateSpec,{kind:'monthYear',ym:'2027-10'});
  assert.equal(s.entries.find(x=>x.name==='Solo mese test').dateSpec.kind,'monthOnly');
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
  s=await state(page);assert.equal(s.budgetPlans.find(p=>p.effectiveMonth===ym()).limits.Auto,100);assert.equal(s.budgetNotifications.categories.Auto.enabled,true);
  await page.click('#budgetNext');assert.match(await page.locator('#budgetList').innerText(),/Non hai ancora impostato budget/);
  await page.click('#budgetBack');await page.click('#summaryBack');await settings(page);await page.click('#settingsNotifications');

  await page.click('#notifyAll');await page.selectOption('#nIncomeTiming','before');await page.fill('#nIncomeTime','08:30');await page.selectOption('#nExpenseTiming','same');await page.fill('#nExpenseTime','10:15');await page.click('#nAllSave');
  s=await state(page);assert.equal(s.notifications.mode,'all');assert.equal(s.notifications.rules.income.timing,'before');assert.equal(s.notifications.rules.expense.timing,'same');assert.equal(s.budgetNotifications.categories.Auto.enabled,true);
  await page.click('#notifySkip');s=await state(page);assert.equal(s.notifications.mode,'off');assert.equal(s.budgetNotifications.categories.Auto.enabled,true);
  await context.close();
}

async function testSecurityAndSettings(browser){
  const {context,page}=await freshPage(browser);await page.fill('#landingNickname','Mario');await setup(page,1000);
  await settings(page);await page.fill('#settingsSearch','backup');assert.equal(await page.locator('#settingsBackup').isVisible(),true);assert.equal(await page.locator('#settingsIncome').isVisible(),false);
  await page.fill('#settingsSearch','');await page.click('#settingsBack');await page.click('#homeBackLanding');

  await page.evaluate(({key,hash})=>{const s=JSON.parse(localStorage.getItem(key));s.security={enabled:true,pinHash:hash,credentialId:'',lastActivity:0};localStorage.setItem(key,JSON.stringify(s))},{key:KEY,hash:pinHash('1234')});
  await page.click('#landingConti');await page.waitForSelector('#modal:not(.hidden)');assert.match(await page.locator('#modalTitle').innerText(),/Sblocca/);
  await page.fill('#unlockPin','0000');await page.click('#unlockPinBtn');assert.match(await page.locator('#modalBody').innerText(),/PIN non corretto/);
  await page.fill('#unlockPin','1234');await page.click('#unlockPinBtn');await page.waitForSelector('#home:not(.hidden)');

  await page.click('#homeBackLanding');
  await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));s.security.lastActivity=Date.now();localStorage.setItem(key,JSON.stringify(s))},KEY);
  await page.click('#landingConti');await page.waitForSelector('#home:not(.hidden)');
  await context.close();
}

async function testBackupRestore(browser){
  const {context,page}=await freshPage(browser);await page.fill('#landingNickname','Mario');await setup(page,1000);await settings(page);await page.click('#settingsBackup');
  const current=await state(page);
  const restored=structuredClone(current);restored.balance=777;restored.entries=[];restored.history=[];
  const payload={format:'in-ordine-conti',version:2,createdAt:new Date().toISOString(),data:restored};
  await page.locator('#backupFile').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
  await page.waitForSelector('#landing:not(.hidden)');
  assert.equal(await page.inputValue('#landingNickname'),'Mario');
  await page.click('#landingConti');await page.waitForSelector('#home:not(.hidden)');
  assert.match(await page.locator('#homeBalance').innerText(),/777,00/);
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
  await testSetupAndFinance(browser);
  await testMovementEditing(browser);
  await testRecurrencesAndDates(browser);
  await testCategoriesBudgetNotifications(browser);
  await testSecurityAndSettings(browser);
  await testBackupRestore(browser);
  await testPwaOffline(browser);
  console.log('All Conti economici regression tests passed');
}finally{await browser.close()}

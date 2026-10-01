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
  await page.waitForSelector('#editRecurrenceBlock:not(.hidden)');
}
async function chooseRec(page,kind){await page.locator('#editRecChoices button[data-kind="'+kind+'"]').click()}
async function confirmStatus(page,{amount,date}={}){
  await page.waitForSelector('#modal:not(.hidden)');
  if(amount!=null)await page.fill('#completeActualAmount',String(amount));
  if(date)await page.fill('#completeActualDate',date);
  await page.click('#completeConfirm');
}
async function addItem(page,type,name,amount,{date=slash(iso()),rec='single',category='',complete=false,actualAmount=null,actualDate=null}={}){
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
  if(complete){await row.locator('.flowUnifiedStatus').click();await confirmStatus(page,{amount:actualAmount==null?amount:actualAmount,date:actualDate})}
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
  assert.match(await page.locator('#setupIncome').innerText(),/Scrivi le tue entrate/);
  const inc=page.locator('#incomeRows .entryRow').first();
  assert.equal(await inc.locator('.rName').getAttribute('placeholder'),'Es. Stipendio');
  assert.equal(await inc.locator('.rAmount').getAttribute('placeholder'),'Es. 1.400 €');
  assert.equal(await inc.locator('.rDateText').getAttribute('placeholder'),'Es. 10 del mese');
  await inc.locator('.rName').fill('Stipendio');await inc.locator('.rAmount').fill('1400');await inc.locator('.rDateText').fill('10 del mese');await inc.locator('.rDateText').blur();
  await page.click('#saveIncomeSetup');
  await page.waitForSelector('#setupExpense:not(.hidden)');
  assert.match(await page.locator('#setupExpense').innerText(),/Scrivi i tuoi pagamenti/);
  const exp=page.locator('#expenseRows .entryRow').first();
  assert.equal(await exp.locator('.rName').getAttribute('placeholder'),'Es. Mutuo');
  assert.equal(await exp.locator('.rAmount').getAttribute('placeholder'),'Es. 387,03 €');
  assert.equal(await exp.locator('.rDateText').getAttribute('placeholder'),'Es. 1 del mese');
  await page.click('#skipExpenseSetup');await page.waitForSelector('#home:not(.hidden)');
  const s=await state(page),salary=s.entries.find(e=>e.name==='Stipendio');
  assert.equal(s.profile.fullName,'Mario');assert.equal(s.balance,1000.5);assert.equal(salary.recurrence.kind,'monthly');assert.equal(salary.day,10);
  await page.click('#homeRestartSetup');await page.waitForSelector('#landing:not(.hidden)');
  assert.equal(await page.locator('#landingNickname').inputValue(),'Mario');
  await page.click('#landingConti');await page.waitForSelector('#setup:not(.hidden)');
  assert.equal(await page.locator('#startBalance').inputValue(),'1000.5');
  await context.close();
}

async function testSetupNaturalRecurrences(browser){
  const {context,page}=await freshPage(browser);
  await page.click('#landingConti');await page.fill('#startBalance','1000');await page.click('#startBtn');
  await page.waitForSelector('#setupIncome:not(.hidden)');await page.click('#skipIncomeSetup');
  await page.waitForSelector('#setupExpense:not(.hidden)');
  const rows=page.locator('#expenseRows .entryRow');
  const r1=rows.first();
  await r1.locator('.rName').fill('Fratello');await r1.locator('.rAmount').fill('50');await r1.locator('.rDateText').fill('1 ottobre');await r1.locator('.rDateText').dispatchEvent('input');
  assert.match(await r1.locator('.rowMeta').innerText(),/Una sola volta/);
  assert.match(await r1.locator('.rowMeta').innerText(),/Ogni mese/);
  assert.match(await r1.locator('.rowMeta').innerText(),/Altro/);
  await r1.locator('[data-setup-rec="single"]').click();
  await page.click('#addExpenseSetup');
  const r2=page.locator('#expenseRows .entryRow').nth(1);
  await r2.locator('.rName').fill('730');await r2.locator('.rAmount').fill('700');await r2.locator('.rDateText').fill('11 ottobre');await r2.locator('.rDateText').dispatchEvent('input');
  await r2.locator('[data-setup-rec="custom"]').click();
  await page.fill('#setupRecText','ogni mese per 3 volte');await page.click('#setupRecSave');
  await page.click('#saveExpenseSetup');await page.waitForSelector('#home:not(.hidden)');
  const s=await state(page),one=s.entries.find(e=>e.name==='Fratello'),three=s.entries.find(e=>e.name==='730');
  assert.equal(one.recurrence.kind,'single');
  assert.equal(three.recurrence.kind,'custom');assert.equal(three.recurrence.unit,'month');assert.equal(three.recurrence.every,1);assert.equal(three.recurrence.endMode,'count');assert.equal(three.recurrence.count,3);
  if(await page.locator('#modal:not(.hidden)').count()){console.log('DEBUG_MODAL_AFTER_SETUP',await page.locator('#modalTitle').innerText(),await page.locator('#modalBody').innerText());await page.click('#modalClose')}
  await page.click('#homeExpense');await page.waitForSelector('#flow:not(.hidden)');await page.click('#flowAdd');
  await page.fill('#editName','Test naturale');await page.fill('#editAmount','10');await page.fill('#editDateText','1');await page.dispatchEvent('#editDateText','input');
  await page.locator('#editRecChoices button[data-kind="custom"]').click();await page.fill('#editorRecText','settembre, ottobre, novembre');await page.click('#editorRecSave');
  assert.match(await page.locator('#editRecSummary').innerText(),/mesi selezionati/);
  await page.click('#modalClose');await context.close();
}

async function testFinanceManualDatesAndMovements(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);
  await page.click('#homeIncome');await page.waitForSelector('#flow:not(.hidden)');
  assert.match(await page.locator('#flowCurrentBalanceValue').innerText(),/1\.000,00/);
  assert.match(await page.locator('#flowUnifiedList').innerText(),/Nessuna entrata in/);
  await page.click('#flowAdd');
  assert.equal(await page.locator('input[type="date"]').count(),0);
  assert.equal(await page.locator('#editAmount').getAttribute('placeholder'),'es. 1000 €');
  assert.notEqual(await page.evaluate(()=>document.activeElement&&document.activeElement.id),'editName');
  assert.equal(await page.locator('#editRecurrenceBlock:not(.hidden)').count(),0);
  await page.click('#editDateText');
  assert.equal(await page.locator('#editRecurrenceBlock:not(.hidden)').count(),0);
  await page.fill('#editDateText','1');
  await page.dispatchEvent('#editDateText','input');
  assert.equal(await page.locator('#editRecurrenceBlock:not(.hidden)').count(),1);
  assert.match(await page.locator('#editDate').inputValue(),/^\d{4}-\d{2}-01$/);
  await page.fill('#editDateText','4/10');
  await page.dispatchEvent('#editDateText','input');
  assert.equal(await page.locator('#editRecurrenceBlock:not(.hidden)').count(),1);
  assert.match(await page.locator('#editRecChoices').innerText(),/Una sola volta/);
  assert.match(await page.locator('#editRecChoices').innerText(),/Ogni mese/);
  assert.match(await page.locator('#editRecChoices').innerText(),/Altro/);
  await page.fill('#editName','Test entrata');await page.fill('#editAmount','50');
  await page.fill('#editDateText','35/10/2026');await page.locator('#editDateText').blur();
  assert.equal(await page.locator('#editDateError:not(.hidden)').count(),0);
  await page.fill('#editDateText','15/10/26');await page.dispatchEvent('#editDateText','input');
  assert.equal(await page.locator('#editDateError:not(.hidden)').count(),0);
  assert.equal(await page.locator('#editDate').inputValue(),'2026-10-15');
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
  let s=await state(page);assert.equal(s.balance,1040);assert.equal(s.history.some(h=>h.type==='adjustment'),true);

  await page.click('#homeAllMovements');await page.waitForSelector('#movements:not(.hidden)');
  assert.equal(await page.locator('.movementQuickTab').count(),4);assert.equal(await page.locator('.movementRow').count(),3);
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
  await page.fill('#editName','Mensile scritto test');await page.fill('#editAmount','23');await page.fill('#editDateText','23 ottobre');await page.dispatchEvent('#editDateText','input');
  assert.equal(await page.locator('#editDateError:not(.hidden)').count(),0);
  await page.locator('#editRecChoices button[data-kind="monthly"]').click();
  await page.click('#editSave');
  s=await state(page);e=s.entries.find(x=>x.name==='Mensile scritto test');assert.equal(e.recurrence.kind,'monthly');assert.equal(e.day,23);

  await page.click('#flowAdd');
  await page.fill('#editName','Mensile test');await page.fill('#editAmount','10');await chooseDate(page,'10 ottobre 2026');await chooseRec(page,'monthly');await page.click('#editSave');
  s=await state(page);e=s.entries.find(x=>x.name==='Mensile test');
  assert.equal(e.recurrence.kind,'monthly');assert.equal(e.dateSpec.iso,'2026-10-10');

  await page.click('#flowAdd');await page.fill('#editName','Altro test');await page.fill('#editAmount','12');await chooseDate(page,'11/10/2026');await chooseRec(page,'custom');
  await page.fill('#editorRecText','ogni 2 settimane per 3 volte');await page.click('#editorRecSave');await page.click('#editSave');
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
  await page.locator('#notifyScopeChoices [data-scope="all"]').click();await page.click('#notificationsConfirm');
  await page.selectOption('#nIncomeTiming','custom');await page.fill('#nIncomeBeforeDays','5');await page.fill('#nIncomeTime','08:30');
  await page.selectOption('#nIncomeOverdue','custom');await page.fill('#nIncomeOverdueDays','4');
  await page.selectOption('#nExpenseTiming','both');await page.selectOption('#nExpenseOverdue','7');
  await page.click('#nAllSave');
  s=await state(page);assert.equal(s.notifications.mode,'all');assert.equal(s.notifications.rules.income.timing,'custom');assert.equal(s.notifications.rules.income.beforeDays,5);assert.equal(s.notifications.rules.income.overdueDays,4);assert.equal(s.notifications.rules.expense.timing,'both');
  if(await page.locator('#modal:not(.hidden)').count())await page.click('#modalClose');
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

  await page.click('#settingsSecurity');await page.check('#securityHideAmounts');await page.click('#modalClose');await page.click('#settingsBack');await page.waitForSelector('#home:not(.hidden)');
  assert.match(await page.locator('#homeBalance').innerText(),/••••/);
  s=await state(page);assert.equal(s.security.hideHomeAmounts,true);assert.equal(s.security.lockMinutes,10);

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

  await addItem(page,'expense','Pagamento passato',15,{date:'25 settembre 2026',complete:true,actualDate:'25 settembre 2026'});
  await backHome(page);

  await addItem(page,'expense','Mensile futuro',20,{date:'10 ottobre 2026',rec:'monthly'});
  assert.match(await page.locator('#flowMonthLabel').innerText(),/Ottobre 2026/);
  assert.match(await page.locator('#flowUnifiedList').innerText(),/Mensile futuro/);
  assert.match(await page.locator('#flowTotal').innerText(),/Totale pagamenti/);
  assert.match(await page.locator('#flowTotal').innerText(),/20,00/);

  await page.click('#flowPrevMonth');
  assert.match(await page.locator('#flowMonthLabel').innerText(),/Settembre 2026/);
  assert.match(await page.locator('#flowUnifiedList').innerText(),/Pagamento passato/);
  assert.match(await page.locator('#flowTotal').innerText(),/15,00/);
  await page.click('.flowTab[data-flow-filter="done"]');
  assert.match(await page.locator('#flowTotal').innerText(),/Totale pagati/);
  assert.match(await page.locator('#flowTotal').innerText(),/15,00/);

  await page.click('#flowNextMonth');
  await page.click('#flowNextMonth');
  assert.match(await page.locator('#flowMonthLabel').innerText(),/Novembre 2026/);
  assert.match(await page.locator('#flowUnifiedList').innerText(),/Mensile futuro/);
  assert.match(await page.locator('#flowTotal').innerText(),/Totale pagamenti/);
  assert.match(await page.locator('#flowTotal').innerText(),/20,00/);

  await context.close();
}

async function testHomeTotalsMatchOpenLists(browser){
  const {context,page}=await freshPage(browser);await setup(page,-1999);
  const target=new Date();target.setDate(1);target.setMonth(target.getMonth()+1);
  const targetYm=ym(target);
  const [targetYear,targetMonth]=targetYm.split('-');
  const futureDate=day=>`${String(day).padStart(2,'0')}/${targetMonth}/${targetYear}`;

  await addItem(page,'income','INPS',720,{date:futureDate(1)});await backHome(page);
  await addItem(page,'income','Stipendio',1100,{date:futureDate(10)});await backHome(page);
  await addItem(page,'income','Affitto',250,{date:futureDate(20)});await backHome(page);

  const expenses=[
    ['Mutuo',400,futureDate(1)],
    ['Fratello',50,futureDate(1)],
    ['Iliad',10,futureDate(4)],
    ['Genitori',200,futureDate(10)],
    ['Esame',100,futureDate(10)],
    ['730',695,futureDate(11)],
    ['Liquido',35,futureDate(15)],
    ['Benzina',150,futureDate(15)],
    ['Timvision',30,futureDate(22)],
    ['Chat gpt',23,futureDate(23)],
    ['Fastweb',30,futureDate(25)],
    ['Sky',53,futureDate(25)]
  ];
  for(const [name,amount,date] of expenses){await addItem(page,'expense',name,amount,{date});await backHome(page)}

  assert.match(await page.locator('#homeIncomeTotal').innerText(),/0,00/);
  assert.match(await page.locator('#homeExpenseTotal').innerText(),/0,00/);
  assert.match(await page.locator('#homeProjectionValue').innerText(),/-1\.999,00/);

  await page.click('#homeExpense');await page.waitForSelector('#flow:not(.hidden)');
  const pendingTexts=await page.locator('.flowUnifiedRow .flowUnifiedStatus').allInnerTexts();
  assert.equal(pendingTexts.filter(x=>/DA PAGARE|SCADUTO/.test(x)).length,12);
  await context.close();
}

async function testFlowLongMonthDoesNotOverlapAmount(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);
  await addItem(page,'expense','Abbonamento con nome molto lungo',400,{date:'1 novembre 2026'});
  const row=page.locator('.flowUnifiedRow').filter({hasText:'Abbonamento con nome molto lungo'}).first();
  await row.waitFor();
  const layout=await row.evaluate(el=>{
    const date=el.querySelector('.flowUnifiedDate');
    const amount=el.querySelector('.flowUnifiedAmount');
    const ds=getComputedStyle(date);
    const dr=date.getBoundingClientRect();
    const ar=amount.getBoundingClientRect();
    return {
      overflowX:ds.overflowX,
      textOverflow:ds.textOverflow,
      dateBoxRight:dr.right,
      amountLeft:ar.left
    };
  });
  assert.equal(layout.overflowX,'hidden');
  assert.equal(layout.textOverflow,'ellipsis');
  assert.ok(layout.dateBoxRight<=layout.amountLeft,'La data non deve occupare lo spazio dell’importo');
  await context.close();
}

async function testHomeFeatureCardsAreSingleFrame(browser){
  const {context,page}=await freshPage(browser);await setup(page,1000);
  const layout=await page.evaluate(()=>{
    const read=selector=>{
      const card=document.querySelector(selector);
      const scene=card.querySelector('.homeScene');
      const c=card.getBoundingClientRect();
      const s=scene.getBoundingClientRect();
      const cs=getComputedStyle(card);
      const ss=getComputedStyle(scene);
      const pseudo=getComputedStyle(card,'::after');
      return {
        cardLeft:c.left,cardRight:c.right,cardTop:c.top,
        sceneLeft:s.left,sceneRight:s.right,sceneTop:s.top,
        sceneWidth:s.width,sceneHeight:s.height,
        borderTopWidth:parseFloat(cs.borderTopWidth),
        overflow:cs.overflow,
        outlineStyle:cs.outlineStyle,
        pseudoDisplay:pseudo.display,
        backgroundImage:ss.backgroundImage
      };
    };
    return {income:read('#homeIncome'),expense:read('#homeExpense')};
  });
  assert.ok(layout.income.cardRight<layout.expense.cardLeft,'Le card Entrate e Pagamenti devono restare separate');
  for(const card of [layout.income,layout.expense]){
    assert.ok(card.borderTopWidth>=1,'Ogni card deve avere una sola cornice esterna');
    assert.equal(card.overflow,'hidden');
    assert.equal(card.outlineStyle,'none');
    assert.equal(card.pseudoDisplay,'none');
    assert.ok(card.sceneLeft<card.cardLeft,'La cornice incorporata nell’illustrazione va ritagliata a sinistra');
    assert.ok(card.sceneRight>card.cardRight,'La cornice incorporata nell’illustrazione va ritagliata a destra');
    assert.ok(card.sceneTop<card.cardTop,'La cornice incorporata nell’illustrazione va ritagliata in alto');
    assert.ok(card.sceneHeight<card.sceneWidth*174/260-1,'La cornice inferiore dell’illustrazione va ritagliata');
    assert.notEqual(card.backgroundImage,'none');
  }
  await context.close();
}

async function testTodoSection(browser){
  const {context,page}=await freshPage(browser);
  await page.fill('#landingNickname','Evaristo');
  await page.click('#landingTodo');
  await page.waitForSelector('#todoSetup:not(.hidden)');

  assert.match(await page.locator('#todoSetup').innerText(),/Ciao Evaristo/);
  assert.equal(await page.locator('#todoSetup').innerText().then(t=>t.includes('Stato')),false);
  assert.equal(await page.locator('#todoSetup').innerText().then(t=>/\bFatto\b/.test(t)),false);
  assert.equal(await page.locator('#todoSetupRows .todoSetupRow').count(),4);

  const first=page.locator('#todoSetupRows .todoSetupRow').first();
  const longText='Fare iscrizione Alifond e disdetta sindacato prima della scadenza';
  await first.locator('.todoDescInput').fill(longText);
  await first.locator('.todoDateInput').fill('domani');
  await first.locator('.todoDateInput').dispatchEvent('input');
  await first.locator('[data-tr="single"]').click();
  await page.click('#todoSetupSave');
  await page.waitForSelector('#todoHub:not(.hidden)');

  assert.equal(await page.locator('#todoHub .todoHubCard').count(),3);
  assert.match(await page.locator('#todoHub').innerText(),/Cose da fare/);
  assert.match(await page.locator('#todoHub').innerText(),/Cose fatte/);
  assert.match(await page.locator('#todoHub').innerText(),/Impostazioni/);
  assert.equal(await page.locator('#todoHubSetup').isVisible(),true);

  const firstSavedId=(await state(page)).todo.tasks[0].id;
  await page.click('#todoHubSetup');
  await page.waitForSelector('#todoSetup:not(.hidden)');
  assert.equal(await page.locator('#todoSetupRows .todoDescInput').first().inputValue(),longText);
  await page.locator('#todoSetupRows .todoDescInput').first().fill(longText+' aggiornato');
  await page.click('#todoSetupSave');
  await page.waitForSelector('#todoHub:not(.hidden)');
  const afterRevisit=await state(page);
  assert.equal(afterRevisit.todo.tasks[0].id,firstSavedId,'Tornare all’inserimento non deve duplicare la voce');
  assert.equal(afterRevisit.todo.tasks[0].description,longText+' aggiornato');

  await page.click('#todoHubPending');
  await page.waitForSelector('#todoActive:not(.hidden)');
  let row=page.locator('#todoActiveList .todoTaskRow').filter({hasText:longText+' aggiornato'}).first();
  await row.waitFor();
  assert.match(await row.locator('.todoCompleteBtn').innerText(),/Segna\s+come fatta/);
  assert.equal(await row.locator('.todoCompleteCircle').count(),1);
  assert.equal(await row.locator('.todoTaskEditCard').count(),1);
  assert.match(await row.locator('.todoTaskEditCard').innerText(),/Modifica/);
  assert.match(await row.locator('.todoTaskEditCard').innerText(),/domani/i);
  const wraps=await row.locator('.todoTaskEditCard strong').evaluate(el=>({whiteSpace:getComputedStyle(el).whiteSpace,height:el.getBoundingClientRect().height,scrollHeight:el.scrollHeight}));
  assert.equal(wraps.whiteSpace,'normal');
  assert.ok(wraps.height>=30,'La descrizione lunga deve poter andare su più righe');

  await row.locator('.todoCompleteBtn').click();
  assert.equal((await state(page)).todo.tasks.length,0);
  assert.equal((await state(page)).todo.done.length,1);
  assert.equal(await page.locator('#undoSnack:not(.hidden)').count(),1);
  await page.click('#undoSnackBtn');
  assert.equal((await state(page)).todo.tasks.length,1);
  assert.equal((await state(page)).todo.done.length,0);

  row=page.locator('#todoActiveList .todoTaskRow').filter({hasText:longText}).first();
  await row.locator('.todoCompleteBtn').click();
  await page.click('#todoGoDone');
  await page.waitForSelector('#todoDone:not(.hidden)');
  assert.match(await page.locator('#todoDoneList').innerText(),/Fatta/);
  assert.match(await page.locator('#todoDoneList').innerText(),new RegExp(longText+' aggiornato'));

  await page.click('#todoDoneToActive');
  await page.waitForSelector('#todoActive:not(.hidden)');
  await page.click('#todoAddTask');
  await page.waitForSelector('#modal:not(.hidden)');
  await page.fill('#todoEditDescription','Controllo mensile');
  await page.fill('#todoEditDate','domani');
  await page.dispatchEvent('#todoEditDate','input');
  await page.click('#teMonthly');
  await page.click('#todoEditSave');
  await page.waitForSelector('#todoActive:not(.hidden)');
  const recurring=page.locator('#todoActiveList .todoTaskRow').filter({hasText:'Controllo mensile'}).first();
  await recurring.waitFor();
  await recurring.locator('.todoCompleteBtn').click();
  const st=await state(page);
  assert.equal(st.todo.tasks.some(t=>t.description==='Controllo mensile'),true);
  assert.equal(st.todo.done.some(t=>t.description==='Controllo mensile'),true);

  await page.click('#todoGoSettings');
  await page.waitForSelector('#todoSettings:not(.hidden)');
  await page.click('#todoSettingColor');
  await page.waitForSelector('#modal:not(.hidden)');
  const beforeColor=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--todoAccent').trim());
  await page.click('[data-tcolor="Viola"]');
  const previewColor=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--todoAccent').trim());
  assert.notEqual(previewColor,beforeColor,'Il colore deve cambiare subito al tocco, prima di Salva');
  await page.click('#todoColorSave');
  assert.equal((await state(page)).todo.color,'Viola');

  await context.close();
}

async function testTodoInlineDateRecurrences(browser){
  const {context,page}=await freshPage(browser);
  await page.fill('#landingNickname','Evaristo');
  await page.click('#landingTodo');
  await page.waitForSelector('#todoSetup:not(.hidden)');

  const first=page.locator('#todoSetupRows .todoSetupRow').first();
  await first.locator('.todoDescInput').fill('Pagamenti trimestrali');
  await first.locator('.todoDateInput').fill('10 ottobre novembre dicembre');
  await first.locator('.todoDateInput').dispatchEvent('input');

  assert.equal(await first.locator('[data-tr]').count(),0,'La ricorrenza scritta nella data non deve obbligare ad aprire Altro');
  assert.match(await first.locator('.todoRecSummary').innerText(),/10 ottobre novembre dicembre/i);

  await page.click('#todoSetupSave');
  await page.waitForSelector('#todoHub:not(.hidden)');
  let st=await state(page);
  let task=st.todo.tasks.find(t=>t.description==='Pagamenti trimestrali');
  assert.ok(task);
  assert.equal(task.recurrence.kind,'selected');
  assert.equal(task.recurrence.months.length,3);
  assert.equal(task.scheduleText,'10 ottobre novembre dicembre');

  await page.click('#todoHubPending');
  await page.waitForSelector('#todoActive:not(.hidden)');
  let row=page.locator('#todoActiveList .todoTaskRow').filter({hasText:'Pagamenti trimestrali'}).first();
  assert.match(await row.locator('.todoTaskEditCard').innerText(),/10 ottobre novembre dicembre/i);

  await row.locator('.todoCompleteBtn').click();
  st=await state(page);
  task=st.todo.tasks.find(t=>t.description==='Pagamenti trimestrali');
  assert.ok(task,'Dopo il primo mese la voce ricorrente deve restare tra le cose da fare');
  assert.equal(task.scheduleText,'10 ottobre novembre dicembre');
  await page.locator('#undoSnack').waitFor({state:'visible'}).catch(()=>{});
  row=page.locator('#todoActiveList .todoTaskRow').filter({hasText:'Pagamenti trimestrali'}).first();
  assert.match(await row.locator('.todoTaskEditCard').innerText(),/10 ottobre novembre dicembre/i);

  await page.click('#todoAddTask');
  await page.waitForSelector('#modal:not(.hidden)');
  await page.fill('#todoEditDescription','Controllo quattro mesi');
  await page.fill('#todoEditDate','10 per 4 mesi');
  await page.dispatchEvent('#todoEditDate','input');
  assert.equal(await page.locator('#todoEditRecArea #teCustom').count(),0,'Anche "10 per 4 mesi" deve essere riconosciuto direttamente');
  assert.match(await page.locator('#todoEditRecArea').innerText(),/10 per 4 mesi/i);
  await page.click('#todoEditSave');
  await page.waitForSelector('#todoActive:not(.hidden)');

  st=await state(page);
  const four=st.todo.tasks.find(t=>t.description==='Controllo quattro mesi');
  assert.ok(four);
  assert.equal(four.recurrence.kind,'count');
  assert.equal(four.recurrence.count,4);
  assert.equal(four.scheduleText,'10 per 4 mesi');
  const fourRow=page.locator('#todoActiveList .todoTaskRow').filter({hasText:'Controllo quattro mesi'}).first();
  assert.match(await fourRow.locator('.todoTaskEditCard').innerText(),/10 per 4 mesi/i);

  await context.close();
}

async function testTodoSortsImpreciseDatesChronologically(browser){
  const {context,page}=await freshPage(browser);
  await page.fill('#landingNickname','Evaristo');
  await page.click('#landingTodo');
  await page.waitForSelector('#todoSetup:not(.hidden)');

  const first=page.locator('#todoSetupRows .todoSetupRow').first();
  await first.locator('.todoDescInput').fill('Controllare alifond');
  await first.locator('.todoDateInput').fill('ottobre');
  await first.locator('.todoDateInput').dispatchEvent('input');
  await first.locator('[data-tr="single"]').click();
  await page.click('#todoSetupSave');
  await page.waitForSelector('#todoHub:not(.hidden)');

  let st=await state(page);
  const october=st.todo.tasks.find(t=>t.description==='Controllare alifond');
  const currentYear=new Date().getFullYear();
  assert.equal(october.date.slice(0,4),String(currentYear),'Un mese senza anno deve usare l’anno corrente');

  await page.evaluate(k=>{
    const st=JSON.parse(localStorage.getItem(k));
    const y=new Date().getFullYear();
    st.todo.tasks=[
      {id:'oct',description:'Ottobre senza giorno',date:y+'-10-31',dateText:'Ottobre',precise:false,dateSpec:{kind:'monthOnly',month:10},recurrence:{kind:'single',month:y+'-10'},notify:false,createdAt:1},
      {id:'entro',description:'Entro ottobre',date:y+'-10-31',dateText:'Entro ottobre',precise:false,dateSpec:{kind:'monthOnly',month:10},recurrence:{kind:'single',month:y+'-10'},notify:false,createdAt:2},
      {id:'nov',description:'Novembre senza giorno',date:y+'-11-30',dateText:'Novembre',precise:false,dateSpec:{kind:'monthOnly',month:11},recurrence:{kind:'single',month:y+'-11'},notify:false,createdAt:3},
      {id:'mar',description:'Marzo anno dopo',date:(y+1)+'-03-28',dateText:'28 marzo '+(y+1),precise:true,dateSpec:{kind:'day',iso:(y+1)+'-03-28'},recurrence:{kind:'single',month:(y+1)+'-03'},notify:false,createdAt:4},
      {id:'aug',description:'Agosto anno dopo',date:(y+1)+'-08-01',dateText:'1 agosto '+(y+1),precise:true,dateSpec:{kind:'day',iso:(y+1)+'-08-01'},recurrence:{kind:'single',month:(y+1)+'-08'},notify:false,createdAt:5}
    ];
    localStorage.setItem(k,JSON.stringify(st));
  },KEY);

  await page.reload();
  await page.waitForSelector('#landing:not(.hidden)');
  await page.click('#landingTodo');
  await page.click('#todoHubPending');
  await page.waitForSelector('#todoActive:not(.hidden)');

  const labels=await page.locator('#todoActiveList .todoTaskEditCard strong').allInnerTexts();
  assert.deepEqual(labels,[
    'Ottobre senza giorno',
    'Entro ottobre',
    'Novembre senza giorno',
    'Marzo anno dopo',
    'Agosto anno dopo'
  ],'Le voci devono essere ordinate solo per la loro data reale, anche quando manca il giorno preciso');

  await context.close();
}

async function testTodoMonthYearFilters(browser){
  const {context,page}=await freshPage(browser);
  await page.fill('#landingNickname','Evaristo');
  await page.click('#landingTodo');
  await page.waitForSelector('#todoSetup:not(.hidden)');
  const first=page.locator('#todoSetupRows .todoSetupRow').first();
  await first.locator('.todoDescInput').fill('Voce iniziale');
  await first.locator('.todoDateInput').fill('15 settembre 2026');
  await first.locator('.todoDateInput').dispatchEvent('input');
  await first.locator('[data-tr="single"]').click();
  await page.click('#todoSetupSave');
  await page.waitForSelector('#todoHub:not(.hidden)');

  await page.evaluate(k=>{
    const st=JSON.parse(localStorage.getItem(k));
    st.todo.tasks=[
      {id:'sep',description:'Da fare settembre',date:'2026-09-15',dateText:'15 settembre 2026',precise:true,dateSpec:{kind:'day',iso:'2026-09-15'},recurrence:{kind:'single',month:'2026-09'},notify:false,createdAt:1},
      {id:'oct',description:'Da fare ottobre',date:'2026-10-20',dateText:'20 ottobre 2026',precise:true,dateSpec:{kind:'day',iso:'2026-10-20'},recurrence:{kind:'single',month:'2026-10'},notify:false,createdAt:2},
      {id:'nodate',description:'Da fare senza data',date:'',dateText:'',precise:false,dateSpec:null,recurrence:null,notify:false,createdAt:3}
    ];
    st.todo.done=[
      {id:'dsep',taskId:'x1',description:'Fatta settembre',date:'2026-09-05',dateText:'5 settembre 2026',completedAt:'2026-09-06',completedTs:1},
      {id:'doct',taskId:'x2',description:'Fatta ottobre',date:'2026-10-08',dateText:'8 ottobre 2026',completedAt:'2026-10-09',completedTs:2}
    ];
    localStorage.setItem(k,JSON.stringify(st));
  },KEY);
  await page.reload();
  await page.waitForSelector('#landing:not(.hidden)');
  await page.click('#landingTodo');
  await page.click('#todoHubPending');
  await page.waitForSelector('#todoActive:not(.hidden)');

  await page.selectOption('#todoActiveFilterMonth','09');
  await page.selectOption('#todoActiveFilterYear','2026');
  assert.equal(await page.locator('#todoActiveList').getByText('Da fare settembre',{exact:true}).count(),1);
  assert.equal(await page.locator('#todoActiveList').getByText('Da fare ottobre',{exact:true}).count(),0);
  assert.equal(await page.locator('#todoActiveList').getByText('Da fare senza data',{exact:true}).count(),0);
  assert.match(await page.locator('#todoActiveFilterSummary').innerText(),/Settembre.*2026/);

  await page.selectOption('#todoActiveFilterMonth','all');
  assert.equal(await page.locator('#todoActiveList .todoTaskRow').count(),2);
  await page.click('#todoActiveFilterAll');
  assert.equal(await page.locator('#todoActiveList .todoTaskRow').count(),3);

  await page.click('#todoGoDone');
  await page.waitForSelector('#todoDone:not(.hidden)');
  await page.selectOption('#todoDoneFilterMonth','10');
  await page.selectOption('#todoDoneFilterYear','2026');
  assert.equal(await page.locator('#todoDoneList').getByText('Fatta ottobre',{exact:true}).count(),1);
  assert.equal(await page.locator('#todoDoneList').getByText('Fatta settembre',{exact:true}).count(),0);
  assert.match(await page.locator('#todoDoneFilterSummary').innerText(),/Ottobre.*2026/);
  await page.click('#todoDoneFilterAll');
  assert.equal(await page.locator('#todoDoneList .todoDoneRow').count(),2);

  await context.close();
}

async function testFlowBannerIsSingleCard(browser){
  const {context,page}=await freshPage(browser);
  await setup(page,1000);

  for(const cfg of [
    {button:'#homeIncome',label:'Aggiungi entrata'},
    {button:'#homeExpense',label:'Aggiungi pagamento'}
  ]){
    await page.click(cfg.button);
    await page.waitForSelector('#flow:not(.hidden)');
    const layout=await page.evaluate(()=>{
      const banner=document.querySelector('#flow .flowBanner');
      const add=document.querySelector('#flowAdd');
      const art=document.querySelector('#flowBannerIcon');
      const b=getComputedStyle(banner),a=getComputedStyle(add),v=getComputedStyle(art);
      const br=banner.getBoundingClientRect(),ar=add.getBoundingClientRect();
      return {
        bannerBackgroundImage:b.backgroundImage,
        bannerBorderTop:parseFloat(b.borderTopWidth),
        bannerBorderStyle:b.borderTopStyle,
        addBackground:a.backgroundColor,
        addBackgroundImage:a.backgroundImage,
        addBoxShadow:a.boxShadow,
        addOpacity:a.opacity,
        addWidth:ar.width,
        bannerWidth:br.width,
        artDisplay:v.display,
        artBackgroundImage:v.backgroundImage
      };
    });
    assert.ok(!layout.bannerBackgroundImage.includes('url('),'Il banner non deve usare una seconda cornice incorporata come immagine completa');
    assert.ok(layout.bannerBorderTop>=1,'Deve esserci una sola cornice esterna');
    assert.notEqual(layout.bannerBorderStyle,'none');
    assert.ok(layout.addBackground==='rgba(0, 0, 0, 0)'||layout.addBackground==='transparent','Il pulsante deve essere integrato nel banner senza un secondo riquadro');
    assert.equal(layout.addBackgroundImage,'none');
    assert.equal(layout.addBoxShadow,'none');
    assert.equal(layout.addOpacity,'1');
    assert.ok(layout.addWidth<layout.bannerWidth*.7,'Il pulsante non deve essere un riquadro sovrapposto a tutta la card');
    assert.equal(layout.artDisplay,'block');
    assert.notEqual(layout.artBackgroundImage,'none','L’illustrazione deve restare integrata nella card');
    assert.equal(await page.locator('#flowAdd').innerText(),cfg.label);
    await page.click('#flowBack');
    await page.waitForSelector('#home:not(.hidden)');
  }
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
  await testFlowLongMonthDoesNotOverlapAmount(browser);
  await testHomeFeatureCardsAreSingleFrame(browser);
  await testFlowBannerIsSingleCard(browser);
  await testTodoSection(browser);
  await testTodoInlineDateRecurrences(browser);
  await testTodoSortsImpreciseDatesChronologically(browser);
  await testTodoMonthYearFilters(browser);
  await testPwaOffline(browser);
  console.log('All In Ordine regression tests passed');
}finally{await browser.close()}

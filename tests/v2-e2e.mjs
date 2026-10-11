import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const sizes = [[360,800],[390,844],[412,915],[430,932]];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
const root=resolve('www');
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,path==='/'?'index.html':'.'+path);if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return}const data=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(data)}catch{res.writeHead(404).end('Not found')}});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(4173,'127.0.0.1',ok)});
const previewDir = '/tmp/in-ordine-v2-preview';
const voiceDue=new Date();voiceDue.setDate(voiceDue.getDate()+1);const voiceDueIso=[voiceDue.getFullYear(),String(voiceDue.getMonth()+1).padStart(2,'0'),String(voiceDue.getDate()).padStart(2,'0')].join('-');const voicePhrase='Stipendio 1.100 euro il '+new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'long'}).format(voiceDue)+', tutti i mesi';
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
await page.evaluate(()=>{const key='inOrdineV2State',s=JSON.parse(localStorage.getItem(key));s.preferences.moneyFilters={income:'removed-filter',expense:'removed-filter'};localStorage.setItem(key,JSON.stringify(s))});await page.reload();await page.waitForSelector('.brand-logo');await page.locator('[data-go="money"]').click();await page.locator('[data-go="income"]').click();for(const kind of ['income','expense']){await page.locator('[data-go="money"]').click();await page.locator(`[data-go="${kind}"]`).click();assert.equal(await page.locator(`[data-money-filter="${kind}:all"]`).getAttribute('class'),'active',`${kind} opens on Tutte regardless of a stale saved filter`);const labels=await page.locator('.filter-row button[data-money-filter]').allInnerTexts();assert.deepEqual(labels.slice(0,3),['Tutte',kind==='income'?'Da ricevere':'Da pagare',kind==='income'?'Ricevute':'Pagati'],`${kind} filters follow the approved order`)}await page.goto('http://127.0.0.1:4173/');await page.waitForSelector('.brand-logo');
const homeLogo=await page.locator('.brand-logo').boundingBox(),homeTag=await page.locator('.brand-top .eyebrow').boundingBox(),homeBrand=await page.locator('.brand').boundingBox();
assert.ok(homeLogo.width>=84&&homeLogo.height>=84,'combined E.D.S. Home logo is slightly larger than the previous mark');
assert.ok(homeLogo.x+homeLogo.width*.5>homeBrand.x+homeBrand.width*.72,'combined E.D.S. logo is at the upper right of the Home card');
assert.ok(homeLogo.x+homeLogo.width<=homeBrand.x+homeBrand.width-8,'Home logo stays inside the main card');
assert.ok(homeLogo.y>=homeBrand.y+8&&homeLogo.y+homeLogo.height<=homeBrand.y+homeBrand.height-8,'full Home logo remains inside the card without vertical clipping');
assert.ok(homeLogo.x>homeTag.x+homeTag.width+8,'Home logo does not cover the tagline');
assert.equal(await page.locator('.brand-logo').evaluate(i=>getComputedStyle(i).objectFit),'contain','Home logo preserves the complete original composition');
assert.equal(await page.locator('.brand-logo').getAttribute('src'),'./assets/eds-blue-green-overlap.jpg');
const logoPixels=await page.locator('.brand-logo').evaluate(el=>{const canvas=document.createElement('canvas');canvas.width=el.naturalWidth;canvas.height=el.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(el,0,0);const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);return {size:[canvas.width,canvas.height],blue:pixel(80,270),green:pixel(475,470)}});
assert.deepEqual(logoPixels.size,[512,512],'Home E.D.S. composite keeps its full square image');
assert.ok(logoPixels.blue[2]>logoPixels.blue[0]*3&&logoPixels.blue[2]>logoPixels.blue[1]*2,'Home logo visibly contains its blue E.D.S. mark');
assert.ok(logoPixels.green[1]>logoPixels.green[0]*3&&logoPixels.green[1]>logoPixels.green[2]*1.6,'Home logo visibly contains its green E.D.S. mark');
assert.equal(await page.locator('.brand-logo').evaluate(i=>{const r=i.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===i}),true,'Home logo is not covered by another element');
await page.waitForFunction(()=>{const i=document.querySelector('.home-art');return i?.complete&&i.naturalWidth>0});
assert.equal(await page.locator('.home-pair').count(),2,'Home separates finance and Todo areas');
assert.equal(await page.locator('.home-pair .home-area + .home-pair-notice').count(),2,'each notification button sits below its own Home card');
for(const [width,height] of sizes){
 await page.setViewportSize({width,height});
 const layout=await page.locator('.brand-logo').evaluate(el=>{const r=el.getBoundingClientRect(),card=el.closest('.brand').getBoundingClientRect(),tag=el.closest('.brand').querySelector('.brand-top .eyebrow').getBoundingClientRect();return {complete:el.complete&&el.naturalWidth>0,logo:{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom},card:{x:card.x,y:card.y,right:card.right,bottom:card.bottom,w:card.width},tag:{right:tag.right},hits:[[r.left+4,r.top+4],[r.right-4,r.top+4],[r.left+4,r.bottom-4],[r.right-4,r.bottom-4],[r.left+r.width/2,r.top+r.height/2]].map(([x,y])=>document.elementFromPoint(x,y)===el)}});
 assert.equal(layout.complete,true,`E.D.S. logo loads at Android viewport ${width}x${height}`);
 assert.ok(layout.logo.w>=84&&layout.logo.h>=84,`E.D.S. logo remains enlarged at Android viewport ${width}x${height}`);
 assert.ok(layout.logo.x>=layout.card.x&&layout.logo.right<=layout.card.right&&layout.logo.y>=layout.card.y&&layout.logo.bottom<=layout.card.bottom,`E.D.S. logo stays within hero at Android viewport ${width}x${height}: ${JSON.stringify(layout)}`);
 assert.ok(layout.tag.right+4<layout.logo.x,`E.D.S. logo does not overlap the tagline at Android viewport ${width}x${height}`);
 assert.ok(layout.hits.every(Boolean),`logo is not covered at Android viewport ${width}x${height}`);
}
await page.setViewportSize({width:390,height:844});
const homeLogoPaint=await page.locator('.brand-logo').evaluate(el=>{const r=el.getBoundingClientRect(),brand=el.closest('.brand').getBoundingClientRect(),cs=getComputedStyle(el);const points=[[r.left+4,r.top+4],[r.right-4,r.top+4],[r.left+4,r.bottom-4],[r.right-4,r.bottom-4],[r.left+r.width/2,r.top+r.height/2]];return {complete:el.complete&&el.naturalWidth>0,width:r.width,height:r.height,inside:r.left>=brand.left&&r.right<=brand.right&&r.top>=brand.top&&r.bottom<=brand.bottom,objectFit:cs.objectFit,clipPath:cs.clipPath,topHits:points.map(([x,y])=>document.elementsFromPoint(x,y)[0]===el)}});assert.equal(homeLogoPaint.complete,true,'Home E.D.S. logo image loads');assert.ok(homeLogoPaint.width>=82&&homeLogoPaint.height>=82,'Home E.D.S. logo is slightly larger than the original');assert.equal(homeLogoPaint.inside,true,'Home E.D.S. logo remains fully within the main card');assert.equal(homeLogoPaint.objectFit,'contain','Home E.D.S. logo preserves the full image proportions');assert.equal(homeLogoPaint.clipPath,'none','Home E.D.S. logo has no CSS clip path');assert.ok(homeLogoPaint.topHits.every(Boolean),`all sampled points across the Home logo paint above neighboring elements: ${JSON.stringify(homeLogoPaint)}`);
await page.screenshot({path:`${previewDir}/01-home.png`});

// Establish a real starting balance and a future income, then receive it.
await page.locator('[data-go="money"]').click();
await page.waitForFunction(()=>{const i=document.querySelector('.finance-art');return i?.complete&&i.naturalWidth>0});
assert.equal(await page.locator('.balance #setBalance').count(),1,'real-balance button stays inside the real-balance card');
assert.equal(await page.locator('.balance + .finance-metrics-separated').count(),1,'monthly finance metrics stay in a separate card');
assert.equal(await page.locator('.balance .finance-summary-metrics').count(),0,'monthly metrics do not merge into the real-balance card');
const financeLogo=await page.locator('.page-header .eds-logo').evaluate(el=>parseFloat(getComputedStyle(el).width));assert.ok(financeLogo>=44,'finance header E.D.S. logo is enlarged for compact phone layouts');
await page.screenshot({path:previewDir+'/02-conti-overview.png'});
await page.locator('#setBalance').click();assert.equal(await page.locator('#balanceValue').inputValue(),'','real-balance entry starts empty');assert.match(await page.locator('.balance-current-info').innerText(),/0,00/,'registered balance is shown separately');await page.locator('#balanceValue').fill('1000');await page.locator('#balanceForm button[type=submit]').click();
await page.locator('[data-go="landing"]').click();await page.locator('[data-go="finance-notifications"]').click();await page.locator('#financeNotificationsEnabled').check();await page.locator('#financeNotificationsForm button[type=submit]').click();await page.locator('[data-go="money"]').click();await page.locator('[data-go="income"]').click();
assert.match(await page.locator('[data-add-money="income"]').innerText(),/Aggiungi entrata manualmente/,'income list exposes the explicit manual action');
assert.equal(await page.locator('[data-voice-create]').count(),0,'single-phrase voice creation is hidden from the UI');
await page.evaluate(()=>{window.SpeechRecognition=class{constructor(){window.fakeSpeechRecognition=this}start(){this.onstart?.()}abort(){}}});
await page.locator('[data-add-money="income"]').click();assert.ok(await page.locator('button[data-voice-target="moneyDescription"]').count(),'per-field description dictation remains available');for(const field of ['moneyDescription','moneyAmount','moneyCategory','moneySupplier'])assert.ok(await page.locator(`button[data-voice-target="${field}"]`).count(),`${field} keeps per-field dictation`);assert.ok(await page.locator('[data-voice-date]').count(),'date field dictation remains available');assert.ok(await page.locator('[data-voice-recurrence]').count(),'recurrence field dictation remains available');
await page.locator('button[data-voice-target="moneyDescription"]').click();await page.waitForSelector('.voice-capture');await page.waitForFunction(()=>Boolean(window.fakeSpeechRecognition));await page.evaluate((phrase)=>{const r=window.fakeSpeechRecognition;r.onresult?.({results:[Object.assign([{transcript:phrase}],{isFinal:true})]})},'Stipendio dettato');await page.locator('[data-voice-confirm]').click();assert.equal(await page.locator('#moneyDescription').inputValue(),'Stipendio dettato','per-field dictation fills only its selected field and requires review');await page.locator('[data-voice-cancel]').count().then(async n=>{if(n)await page.locator('[data-voice-cancel]').click()});await page.locator('[data-go="income"]').click();
await page.locator('[data-add-money="income"]').click();
await page.locator('#moneyDescription').fill('Stipendio test');
await page.locator('#moneyAmount').fill('245,50');
await page.locator('#moneyDate').fill(new Date().toISOString().slice(0,10));
await page.locator('#moneyCategory').selectOption({label:'Stipendio'});
await page.locator('#moneyForm button[type="submit"]').click();
await page.locator('[data-add-money="income"]').click();await page.locator('#moneyDescription').fill('Promemoria indipendente');await page.locator('#moneyAmount').fill('12');await page.locator('#moneyDateMode').selectOption('none');await page.locator('#moneyNotify').check();await page.locator('#moneyReminderMode').selectOption('custom');const financeReminderAt=await page.evaluate(()=>{const d=new Date(Date.now()+7*86400000);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'T10:00'});await page.locator('#moneyCustomAt').fill(financeReminderAt);await page.locator('#moneyForm button[type="submit"]').click();const reminderEntry=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).entries.find(x=>x.description==='Promemoria indipendente'));assert.equal(reminderEntry.date,'');assert.equal(reminderEntry.datePrecision,'none');assert.equal(reminderEntry.reminder.mode,'custom');assert.ok(reminderEntry.reminder.customAt);
await page.locator('[data-go="money"]').click();
assert.match(await page.locator('.balance').innerText(),/1\.000,00/,'pending income must not change real balance');const currentMonthKey=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};const isoLocal=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

await page.locator('[data-go="income"]').click();
await page.screenshot({path:`${previewDir}/02-entrate.png`});
const incomeRows=await page.locator('.money-row').evaluateAll(rows=>rows.map(r=>({done:r.dataset.done==='true',sort:r.dataset.dateSort})));const incomeSplit=incomeRows.findIndex(r=>r.done);if(incomeSplit>=0){assert.ok(incomeRows.slice(0,incomeSplit).every(r=>!r.done),'all open incomes are listed before received incomes');assert.ok(incomeRows.slice(incomeSplit).every(r=>r.done),'received incomes stay in their own group');for(const group of [incomeRows.slice(0,incomeSplit),incomeRows.slice(incomeSplit)])assert.deepEqual(group.map(r=>r.sort),group.map(r=>r.sort).slice().sort(),'each income group is chronological');}

assert.equal(await page.locator('.list-create-action').count(),1,'finance list exposes only the manual creation action');assert.equal(await page.locator('[data-voice-create]').count(),0,'single-phrase voice action is not displayed');
const rowGeometry=await page.locator('.money-row').evaluateAll(rows=>rows.map(row=>{const left=row.querySelector(':scope > div:first-child').getBoundingClientRect(),right=row.querySelector('.money-actions').getBoundingClientRect(),date=row.querySelector('.date-emphasis');return {gap:right.left-left.right,dateFits:date.scrollWidth<=date.clientWidth}}));assert.ok(rowGeometry.every(x=>x.gap>=0&&x.dateFits),'finance card dates fit one line without overlapping amounts or actions');
assert.equal(await page.locator('.money-row .money-category,.money-row .entry-status').count(),0,'finance cards omit category and redundant pending status below the date');
assert.ok(parseFloat(await page.locator('.money-row .date-emphasis').first().evaluate(n=>getComputedStyle(n).fontSize))>=15,'finance dates are prominent');
await page.locator('[data-money-filter="income:pending"]').click();
assert.equal(await page.locator('[data-edit-money]').count(),2,'pending income filter includes a no-date custom reminder');
await page.locator('[data-money-done]').first().click();
await page.locator('[data-go="money"]').click();
assert.match(await page.locator('.balance').innerText(),/1\.245,50/,'received income updates real balance');
await page.locator('[data-go="income"]').click();assert.equal(await page.locator('[data-money-filter="income:all"]').getAttribute('class'),'active');const receivedRow=page.locator('[data-edit-money][data-done="true"]').filter({hasText:'Stipendio test'});assert.equal(await receivedRow.locator('.money-completed-label').innerText(),'RICEVUTA');assert.equal(await receivedRow.locator('[data-undo-money]').innerText(),'Annulla');assert.equal(await receivedRow.locator('[data-delete-money]').count(),0,'completed items cannot be deleted from the list');const receivedActions=await receivedRow.locator('.money-completed-inline').boundingBox(),receivedLabel=await receivedRow.locator('.money-completed-label').boundingBox(),undoLabel=await receivedRow.locator('[data-undo-money]').boundingBox();assert.ok(receivedLabel.x<undoLabel.x&&receivedLabel.y<undoLabel.y+undoLabel.height&&undoLabel.y<receivedLabel.y+receivedLabel.height,'RICEVUTA and Annulla share one row');assert.ok(parseFloat(await receivedRow.locator('.money-completed-label').evaluate(n=>getComputedStyle(n).fontSize))>parseFloat(await receivedRow.locator('[data-undo-money]').evaluate(n=>getComputedStyle(n).fontSize)),'completion label is larger than Annulla');await receivedRow.click();assert.equal(await page.locator('#moneyEditForm').count(),1,'tapping a completed entry opens edit');assert.equal(await page.locator('#moneyEditForm [data-delete-money]').count(),1,'delete remains available in edit');await page.locator('.page-header [data-go="income"]').click();const overdueDate=new Date();overdueDate.setDate(overdueDate.getDate()-1);const overdueIso=isoLocal(overdueDate);if(overdueIso.slice(0,7)!==currentMonthKey())await page.locator('[data-month-prev="income"]').click();await page.locator('[data-add-money="income"]').click();await page.locator('#moneyDescription').fill('Entrata scaduta test');await page.locator('#moneyAmount').fill('2');await page.locator('#moneyDate').fill(overdueIso);await page.locator('#moneyForm button[type="submit"]').click();assert.equal(await page.locator('[data-edit-money]').filter({hasText:'Entrata scaduta test'}).locator('.overdue-label').innerText(),'SCADUTO','open expired income is explicitly labeled');const expiredTestRow=page.locator('[data-edit-money]').filter({hasText:'Entrata scaduta test'});await expiredTestRow.click();page.once('dialog',d=>d.accept());await page.locator('#moneyEditForm [data-delete-money]').click();if(overdueIso.slice(0,7)!==currentMonthKey())await page.locator('[data-month-next="income"]').click();await page.locator('[data-go="money"]').click();

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
await page.locator('[data-go="expense"]').click();assert.equal(await page.locator('[data-money-filter="expense:all"]').getAttribute('class'),'active');const paidRow=page.locator('[data-edit-money][data-done="true"]').filter({hasText:'Spesa test'});assert.equal(await paidRow.locator('.money-completed-label').innerText(),'PAGATO');assert.equal(await paidRow.locator('[data-undo-money]').innerText(),'Annulla');await paidRow.locator('[data-undo-money]').click();let paidState=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(paidState.balance,1245.5,'undoing payment restores the real balance once');assert.equal(await page.locator('[data-edit-money]').filter({hasText:'Spesa test'}).getAttribute('data-done'),'false','undo moves the payment back to open');await page.locator('[data-edit-money]').filter({hasText:'Spesa test'}).locator('[data-money-done]').click();paidState=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(paidState.balance,1145.5,'marking it paid again applies the balance change once');const futurePaymentDate=new Date();futurePaymentDate.setDate(futurePaymentDate.getDate()+1);const futurePaymentIso=isoLocal(futurePaymentDate);if(futurePaymentIso.slice(0,7)!==currentMonthKey())await page.locator('[data-month-next="expense"]').click();await page.locator('[data-add-money="expense"]').click();await page.locator('#moneyDescription').fill('Pagamento futuro test');await page.locator('#moneyAmount').fill('3');await page.locator('#moneyDate').fill(futurePaymentIso);await page.locator('#moneyForm button[type="submit"]').click();assert.equal(await page.locator('[data-edit-money]').filter({hasText:'Pagamento futuro test'}).locator('.overdue-label').count(),0,'future payment has no expired label');const futureTestRow=page.locator('[data-edit-money]').filter({hasText:'Pagamento futuro test'});await futureTestRow.click();page.once('dialog',d=>d.accept());await page.locator('#moneyEditForm [data-delete-money]').click();
await page.locator('[data-add-money="expense"]').click();await page.locator('#moneyDescription').fill('Spesa solo mese');await page.locator('#moneyAmount').fill('10');await page.locator('#moneyDateMode').selectOption('month');await page.locator('#moneyMonth').fill('2026-11');await page.locator('#moneyForm button[type=submit]').click();const monthEntry=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).entries.find(x=>x.description==='Spesa solo mese'));assert.equal(monthEntry.date,'2026-11');assert.equal(monthEntry.datePrecision,'month');assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')))).balance,1145.5,'future month-only payment does not change real balance');
await page.locator('[data-go="money"]').click();await page.locator('[data-go="income"]').click();await page.locator('[data-add-money="income"]').click();
await page.locator('#moneyDescription').fill('Ricorrenza stipendio');await page.locator('#moneyAmount').fill('30');await page.locator('#moneyDate').fill('2026-01-31');await page.locator('#moneyCategory').selectOption({label:'Stipendio'});await page.locator('#moneyRecurrence').selectOption('monthly');await page.locator('#moneyForm button[type=submit]').click();
const recurrenceData=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(recurrenceData.entries.filter(x=>x.description==='Ricorrenza stipendio').length,12);assert.ok(recurrenceData.entries.some(x=>x.description==='Ricorrenza stipendio'&&x.date==='2026-02-28'),'monthly recurrence clamps month-end dates safely');
assert.equal(recurrenceData.balance,1145.5,'future recurring income does not change real balance');
await page.locator('[data-add-money=\"income\"]').click();await page.locator('#moneyDescription').fill('Rinnovo annuale');await page.locator('#moneyAmount').fill('20');await page.locator('#moneyDate').fill('2024-02-29');await page.locator('#moneyRecurrence').selectOption('yearly');await page.locator('#moneyForm button[type=submit]').click();
const yearly=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(yearly.entries.filter(x=>x.description==='Rinnovo annuale').length,3);assert.ok(yearly.entries.some(x=>x.description==='Rinnovo annuale'&&x.date==='2025-02-28'),'yearly leap-day recurrence clamps safely');assert.equal(yearly.balance,1145.5);
await page.locator('[data-go="money"]').click();await page.locator('[data-go="expense"]').click();await page.locator('[data-add-money="expense"]').click();await page.locator('#moneyDescription').fill('Pagamento mensile giorno senza anno');await page.locator('#moneyAmount').fill('40');await page.locator('#moneyDateMode').selectOption('dayOnly');await page.locator('#moneyDayPart').fill('15');await page.locator('#moneyRecurrence').selectOption('monthly');await page.locator('#moneyForm button[type="submit"]').click();
let dayOnlyState=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));let dayOnlySeries=dayOnlyState.entries.filter(x=>x.description==='Pagamento mensile giorno senza anno');assert.equal(dayOnlySeries.length,12,'monthly recurrence accepts a day-of-month without a year');assert.equal(dayOnlySeries[0].datePrecision,'day');assert.equal(dayOnlySeries[0].dateInputPrecision,'dayOnly','original partial date precision is retained');assert.equal(new Set(dayOnlySeries.map(x=>x.date)).size,12,'monthly day-only recurrence has no duplicate dates');assert.ok(dayOnlySeries.every(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.date)),'generated occurrences have concrete calendar dates');await page.reload();await page.waitForSelector('.brand-logo');await page.locator('[data-go="money"]').click();await page.locator('[data-go="expense"]').click();dayOnlyState=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));dayOnlySeries=dayOnlyState.entries.filter(x=>x.description==='Pagamento mensile giorno senza anno');assert.equal(dayOnlySeries.length,12,'day-only monthly payment survives app reload');assert.equal(new Set(dayOnlySeries.map(x=>x.id)).size,12,'reloading does not duplicate occurrences');const expenseRows=await page.locator('.money-row').evaluateAll(rows=>rows.map(r=>({done:r.dataset.done==='true',sort:r.dataset.dateSort})));const expenseSplit=expenseRows.findIndex(r=>r.done);if(expenseSplit>=0){assert.ok(expenseRows.slice(0,expenseSplit).every(r=>!r.done),'all open payments precede paid payments');assert.ok(expenseRows.slice(expenseSplit).every(r=>r.done),'paid payments remain grouped');for(const group of [expenseRows.slice(0,expenseSplit),expenseRows.slice(expenseSplit)])assert.deepEqual(group.map(r=>r.sort),group.map(r=>r.sort).slice().sort(),'each payment group is chronological')}
await page.locator('[data-go="money"]').click();await page.locator('[data-go="income"]').click();await page.locator('[data-add-money="income"]').click();await page.locator('#moneyDescription').fill('Entrata mensile giorno senza anno');await page.locator('#moneyAmount').fill('55');await page.locator('#moneyDateMode').selectOption('dayOnly');await page.locator('#moneyDayPart').fill('20');await page.locator('#moneyRecurrence').selectOption('monthly');await page.locator('#moneyForm button[type="submit"]').click();let dayOnlyIncome=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).entries.filter(x=>x.description==='Entrata mensile giorno senza anno'));assert.equal(dayOnlyIncome.length,12,'monthly day-only income is generated');assert.equal(new Set(dayOnlyIncome.map(x=>x.date)).size,12,'monthly day-only income has no duplicates');await page.reload();await page.waitForSelector('.brand-logo');await page.locator('[data-go="money"]').click();await page.locator('[data-go="income"]').click();dayOnlyIncome=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).entries.filter(x=>x.description==='Entrata mensile giorno senza anno'));assert.equal(dayOnlyIncome.length,12,'monthly day-only income survives app reload');

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
assert.match(await page.locator('[data-go="todo-add"]').innerText(),/Aggiungi cosa da fare manualmente/,'Todo list exposes the manual action');
assert.equal(await page.locator('[data-voice-create]').count(),0,'single-phrase Todo creation is hidden');
await page.evaluate(()=>{window.SpeechRecognition=class{constructor(){window.fakeSpeechRecognition=this}start(){this.onstart?.()}abort(){}}});
const todoCountBeforeVoice=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).todo.tasks.length);
await page.locator('[data-go="todo-add"]').click();assert.ok(await page.locator('button[data-voice-target="todoDescription"]').count(),'Todo description field keeps dictation');
await page.locator('button[data-voice-target="todoDescription"]').click();await page.waitForSelector('.voice-capture');await page.evaluate(()=>{const r=window.fakeSpeechRecognition;r.onresult?.({results:[Object.assign([{transcript:'Chiamare il medico'}],{isFinal:true})]})});await page.locator('[data-voice-confirm]').click();assert.equal(await page.locator('#todoDescription').inputValue(),'Chiamare il medico','Todo field dictation fills only the selected field');
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).todo.tasks.length),todoCountBeforeVoice,'Todo field dictation does not save automatically');await page.screenshot({path:`${previewDir}/17-todo-field-dictation.png`});
await page.locator('[data-go="todo"]').click();
await page.waitForFunction(()=>{const i=document.querySelector('.todo-art');return i?.complete&&i.naturalWidth>0});
await page.screenshot({path:`${previewDir}/07-cose-da-fare.png`});
await page.locator('[data-go="todo-add"]').click();
await page.locator('#todoDescription').fill('Chiamare dentista');
await page.locator('#todoDate').fill('2026-11-30');
await page.locator('#todoRecurrence').selectOption('monthly');
await page.locator('#todoNotify').check();
await page.locator('#todoForm button[type="submit"]').click();
assert.equal(await page.locator('[data-edit-task]').count(),0,'active Todo defaults to the current month and hides future recurrence instances');await page.locator('#todoMonth').selectOption('11');await page.locator('#todoYear').selectOption('2026');assert.equal(await page.locator('[data-edit-task]').count(),1,'a later month remains selectable');assert.equal(await page.locator('[data-edit-task]').filter({hasText:'Chiamare dentista'}).first().locator('.todo-date').innerText(),'30/11/2026','complete Todo dates use Italian day/month/year format');await page.locator('#todoMonth').selectOption('all');await page.locator('#todoYear').selectOption('all');assert.equal(await page.locator('[data-edit-task]').count(),25,'monthly Todo recurrence remains available through all-month filters');
assert.equal(await page.locator('.search-field').evaluate(el=>getComputedStyle(el).display),'flex','Todo search field is styled as a compact control');
assert.ok(parseFloat(await page.locator('.search-field input').evaluate(el=>getComputedStyle(el).height))>=40,'Todo search input keeps a usable touch height');
await page.screenshot({path:`${previewDir}/08-attivita.png`});
await page.locator('[data-complete]').first().click();
await page.locator('[data-go="todo"]').click();
await page.locator('[data-go="todo-done"]').click();
assert.equal(await page.locator('[data-edit-task]').count(),1,'completed task appears in completed list');assert.match(await page.locator('.todo-date').innerText(),/Completata il \d{2}\/\d{2}\/\d{4}/,'completion date uses Italian day/month/year format');
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
await page.reload();await page.locator('[data-go=\"todo\"]').click();await page.locator('[data-go=\"todo-active\"]').click();await page.locator('#todoMonth').selectOption('all');await page.locator('#todoYear').selectOption('all');
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
await page.locator('[data-go="money"]').click();await page.locator('[data-go="landing"]').click();await page.locator('[data-go="todo"]').click();await page.locator('[data-go="todo-add"]').click();await page.locator('#todoDescription').fill('Attività completata editabile');await page.locator('#todoNotify').check();await page.locator('#todoReminderMode').selectOption('custom');const todoReminderAt=await page.evaluate(()=>{const d=new Date(Date.now()+9*86400000);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'T09:30'});await page.locator('#todoCustomAt').fill(todoReminderAt);await page.locator('#todoForm button[type=submit]').click();await page.locator('#todoMonth').selectOption('all');await page.locator('#todoYear').selectOption('all');const todoReminder=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).todo.tasks.find(x=>x.description==='Attività completata editabile'));assert.equal(todoReminder.date,'');assert.ok(todoReminder.reminder.customAt);await page.locator('[data-edit-task]').filter({hasText:'Attività completata editabile'}).locator('[data-complete]').click();await page.locator('[data-go="todo"]').click();await page.locator('[data-go="todo-done"]').click();const doneRow=page.locator('[data-edit-task]').filter({hasText:'Attività completata editabile'});await doneRow.click();await page.locator('#todoEditDescription').fill('Completata modificata');await page.locator('#todoEditForm button[type=submit]').click();assert.equal(await page.locator('[data-edit-task]').filter({hasText:'Completata modificata'}).count(),1,'editing a completed activity preserves its completed state');

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
    const dims=await page.evaluate(()=>({iw:innerWidth,ih:innerHeight,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth,offenders:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className:'',right:Math.round(e.getBoundingClientRect().right*10)/10,width:Math.round(e.getBoundingClientRect().width*10)/10,overflow:getComputedStyle(e).overflowX})).filter(e=>e.right>innerWidth+1&&e.overflow!=='auto').slice(0,10),app:document.querySelector('.app-shell')?.getBoundingClientRect().toJSON(),screen:document.querySelector('.screen')?.getBoundingClientRect().toJSON(),topPadding:parseFloat(getComputedStyle(document.querySelector('.app-shell')).paddingTop),logo:document.querySelector('.eds-logo')?.naturalWidth||document.querySelector('.brand-logo')?.naturalWidth||0}));
    assert.ok(dims.sw<=dims.iw+1&&dims.bw<=dims.iw+1,`${name} horizontal overflow at ${width}x${height}: ${JSON.stringify(dims)}`);
    assert.ok(dims.app.width<=width+1&&dims.screen.width<=width+1,`${name} width out of bounds at ${width}x${height}`);
    assert.ok(dims.app.x>=-1&&dims.app.right<=width+1,`${name} shifted sideways at ${width}x${height}`);
    assert.ok(dims.topPadding>=12,`${name} has no safe-area top spacing at ${width}x${height}`);
    assert.ok(dims.logo>0,`${name} E.D.S. logo missing at ${width}x${height}`);
  }
  console.log(`PASS responsive ${width}x${height}: ${routeChecks.length} screens, no horizontal overflow or missing logo`);
}

for(const [width,height] of [[390,844],[412,915]]){
  await page.setViewportSize({width,height});
  await openV2Route('money');await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`${previewDir}/15-conti-home-compact-${width}.png`});
  const moneyBounds=await page.evaluate(()=>{const x=document.querySelector('.finance-home-screen'),r=x.getBoundingClientRect(),shell=getComputedStyle(document.querySelector('.app-shell'));return {top:r.top,bottom:r.bottom,available:innerHeight-parseFloat(shell.paddingBottom),images:[...x.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),tiles:x.querySelectorAll('.finance-tile').length,links:x.querySelectorAll('.quick-links .wide').length}});
  assert.equal(moneyBounds.tiles,2,'compact finance home retains both illustrated entry tiles');assert.equal(moneyBounds.links,3,'compact finance home retains movements, settings and section reset');assert.ok(moneyBounds.images,'compact finance home loads every existing illustration and logo');assert.ok(moneyBounds.top>=0&&moneyBounds.bottom<=moneyBounds.available+1,`finance home fits without clipping at ${width}x${height}: ${JSON.stringify(moneyBounds)}`);
  const financeOrder=await page.locator('.finance-home-screen').evaluate(x=>[...x.children].map(el=>el.matches('.page-header')?'header':el.matches('.section-kicker')?'title':el.matches('.balance')?'balance':el.matches('.finance-metrics-separated')?'totals':el.matches('.finance-actions')?'tiles':el.matches('.quick-links')?'links':'unexpected'));
  assert.deepEqual(financeOrder,['header','title','balance','totals','tiles','links'],'finance home keeps the approved summary-first order');
  for(const [label,title] of [['income','Entrate'],['expense','Pagamenti']]){await page.locator(`.finance-tile.${label}`).click();assert.equal(await page.locator('.page-header h1').innerText(),title,`${label} tile still opens its screen`);await page.locator('[data-go="money"]').click()}
  await openV2Route('todo');await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`${previewDir}/18-cose-da-fare-home-compact-${width}.png`});
  const todoBounds=await page.evaluate(()=>{const x=document.querySelector('.todo-home-screen'),r=x.getBoundingClientRect(),shell=getComputedStyle(document.querySelector('.app-shell')),img=x.querySelector('.todo-art'),frame=x.querySelector('.todo-art-frame'),ir=img.getBoundingClientRect(),fr=frame.getBoundingClientRect();return {top:r.top,bottom:r.bottom,available:innerHeight-parseFloat(shell.paddingBottom),image:img?.complete&&img.naturalWidth>0,imageHeight:ir.height,frameHeight:fr.height,objectFit:getComputedStyle(img).objectFit,imageInsideFrame:ir.top>=fr.top-1&&ir.bottom<=fr.bottom+1,tiles:x.querySelectorAll('.todo-areas .area-card').length,actions:x.querySelectorAll('.primary-action,.settings-action').length}});
  assert.equal(todoBounds.tiles,2,'compact Todo home retains both activity tiles');assert.equal(todoBounds.actions,4,'compact Todo home retains add, notifications, settings and reset');assert.ok(todoBounds.image,'compact Todo home loads its existing illustration');assert.ok(todoBounds.imageHeight>=210&&todoBounds.objectFit==='contain'&&todoBounds.imageInsideFrame,`Todo illustration shows the full composition at a larger size: ${JSON.stringify(todoBounds)}`);assert.ok(todoBounds.top>=0&&todoBounds.bottom<=todoBounds.available+1,`Todo home fits without clipping at ${width}x${height}: ${JSON.stringify(todoBounds)}`);
}
console.log('PASS compact principal screens: finance and Todo fit at 390x844 and 412x915 with every tile, action, logo and image present');

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
await page.locator('[data-go=\"money\"]').click();await page.locator('[data-go=\"landing\"]').click();await page.locator('[data-go=\"todo\"]').click();assert.equal(await page.locator('#resetTodo').count(),1);await page.locator('[data-go=\"todo-settings\"]').click();assert.equal(await page.locator('#resetTodo').count(),0,'Todo reset tile is not duplicated in settings');await page.locator('[data-go=\"todo\"]').click();page.once('dialog',d=>d.accept());await page.locator('#resetTodo').click();let cleared=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(cleared.todo.tasks.length,0);assert.equal(cleared.balance,1150);assert.equal(cleared.history.length,2,'clearing Todo retains finances');await page.locator('[data-go=\"landing\"]').click();await page.locator('[data-go=\"money\"]').click();assert.equal(await page.locator('#resetFinance').count(),1);await page.locator('[data-go=\"settings\"]').click();assert.equal(await page.locator('#resetFinance').count(),0,'finance reset tile is not duplicated in settings');await page.locator('[data-go=\"money\"]').click();await page.locator('[data-go=\"settings\"]').click();await page.locator('[data-go=\"backup\"]').click();await page.locator('#importBackup').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.waitForSelector('.settings-list');await page.locator('[data-go=\"money\"]').click();page.once('dialog',d=>d.accept());await page.locator('#resetFinance').click();cleared=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(cleared.entries.length,0);assert.equal(cleared.balance,0);assert.equal(cleared.todo.tasks.length,1,'clearing finances retains Todo');assert.ok(cleared.profile.fullName!==undefined,'section deletion retains app settings');
console.log('PASS finance, Todo, filters, monthly/yearly recurrence, budgets, category CRUD, settings, backup/restore and persistence');
console.log(`PREVIEW_DIR ${previewDir}`);
await browser.close();
await new Promise(ok=>server.close(ok));

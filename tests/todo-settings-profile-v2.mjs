import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root=resolve('www'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,path==='/'?'index.html':'.'+path);if(file!==root&&!file.startsWith(root+sep))return res.writeHead(403).end();res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(await readFile(file))}catch{res.writeHead(404).end('Not found')}});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(4178,'127.0.0.1',ok)});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:850},acceptDownloads:true,locale:'it-IT'}),dialogs=[];
page.on('dialog',async d=>{dialogs.push(d.message());await d.accept().catch(()=>{})});
const reminder=(enabled)=>({enabled,customized:true,mode:'due',advanceDays:1,time:'08:30'});
const fixture={version:2,balance:700,entries:[
 {id:'income-on',kind:'income',description:'Stipendio',amount:1200,date:'2026-10-30',datePrecision:'day',reminder:reminder(true),notify:true},
 {id:'expense-on',kind:'expense',description:'Affitto',amount:500,date:'2026-10-31',datePrecision:'day',reminder:reminder(true),notify:true},
 {id:'income-off',kind:'income',description:'Premio',amount:100,date:'2026-10-29',datePrecision:'day',reminder:reminder(false),notify:false}],
 history:[],adjustments:[],budgetPlans:[],financeNotifications:{enabled:false,rule:{advanceDays:0,time:'09:00'}},
 profile:{fullName:'',namePromptCompleted:true},todo:{setupDone:true,color:'Verde E.D.S.',theme:'light',tasks:[
 {id:'todo-on',description:'Telefonare',date:'2026-10-30',datePrecision:'day',reminder:reminder(true),notify:true},
 {id:'todo-off',description:'Comprare pane',date:'2026-10-30',datePrecision:'day',reminder:reminder(false),notify:false},
 {id:'todo-default',description:'Ritirare pacco',date:'2026-10-30',datePrecision:'day'}],done:[{id:'done-1',description:'Attività completata',date:'2026-10-10',datePrecision:'day',completedAt:'2026-10-10T12:00:00Z'}],notifications:{enabled:false,rule:{advanceDays:0,time:'09:00'}}},preferences:{categories:[],moneyFilters:{},biometricEnabled:false}};
try{
 await page.addInitScript(s=>{if(!localStorage.getItem('inOrdineV2State'))localStorage.setItem('inOrdineV2State',JSON.stringify(s))},fixture);await page.goto('http://127.0.0.1:4178/');
 assert.equal(await page.locator('.home-greeting').count(),0,'an empty profile does not show an invented name');
 const settings=page.locator('.todo-settings-list [data-todo-setting]');
 await page.locator('[data-go="todo"]').click();await page.locator('[data-go="todo-settings"]').click();
 assert.deepEqual(await settings.allTextContents(),['Notifiche Cose da fare','Backup e ripristino','Sicurezza','Cancella tutti i dati','Profilo / Nome'],'Todo settings has exactly the five approved entries in order');
 for(const width of [320,360,390,430]){await page.setViewportSize({width,height:850});const cards=await settings.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth}}));assert.equal(cards.length,5);assert.ok(cards.every(r=>r.left>=0&&r.right<=width&&r.scrollWidth<=r.clientWidth),`all five Todo settings entries remain readable at ${width}px`)}

 // Existing notification controls remain the single source of truth.
 await settings.nth(0).click();assert.equal(await page.locator('#todoSettingsForm').count(),1);await page.locator('.todo-head [data-go="todo"]').click();await page.locator('[data-go="todo-settings"]').click();
 await settings.nth(1).click();assert.equal(await page.locator('#exportTodoBackup').count(),1);assert.equal(await page.locator('#importTodoBackup').count(),1);
 const downloadPromise=page.waitForEvent('download');await page.locator('#exportTodoBackup').click();const backupFile=await downloadPromise,backup=JSON.parse(await readFile(await backupFile.path(),'utf8'));
 assert.equal(backup.format,'in-ordine-v2-todo');assert.equal(backup.scope,'todo');assert.equal(backup.todo.tasks.length,3);assert.equal(backup.todo.notifications.enabled,false);
 const replacement={...backup,todo:{...backup.todo,tasks:[{id:'restored-task',description:'Attività ripristinata',date:'2026-12-02',datePrecision:'day'}],done:[],notifications:{enabled:true,rule:{advanceDays:2,time:'07:15'}}}};
 await page.locator('#importTodoBackup').setInputFiles({name:'todo-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replacement))});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('inOrdineV2State')).todo.tasks[0]?.id==='restored-task');
 assert.ok(dialogs.some(message=>/sostituirà.*Cose da fare/i.test(message)),'Todo import warns before replacing existing Todo data');
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));
 assert.deepEqual(saved.todo.tasks.map(x=>x.id),['restored-task']);assert.equal(saved.todo.notifications.enabled,true);assert.equal(saved.balance,700);assert.equal(saved.entries.length,3);assert.equal(saved.profile.fullName,'');
 await page.reload();saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(saved.todo.tasks[0].id,'restored-task');assert.equal(saved.balance,700,'Todo backup restore persists without replacing finance data');

 // Existing biometric setting is reused, and saves back to the Todo menu.
 await page.locator('[data-go="todo"]').click();await page.locator('[data-go="todo-settings"]').click();await page.locator('[data-todo-setting="security"]').click();
 assert.equal(await page.locator('#biometricEnabled').isChecked(),false);await page.locator('#saveSecurity').click();
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(saved.preferences.biometricEnabled,false);assert.equal(await settings.count(),5,'security returns to the Todo settings menu');

 // The name is saved in app state and greeting is isolated to the general home.
 await page.locator('[data-todo-setting="profile"]').click();await page.locator('#todoProfileName').fill('Eva');await page.locator('#todoProfileForm button[type="submit"]').click();
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(saved.profile.fullName,'Eva');await page.reload();
 assert.equal(await page.locator('.home-greeting').innerText(),'Ciao, Eva!');assert.equal(await page.locator('.home-note').innerText(),'Un piccolo passo alla volta, tutto al suo posto.');
 for(const [width,height] of [[320,740],[360,800],[390,850],[430,932]]){await page.setViewportSize({width,height});const g=await page.locator('.home-greeting').evaluate(el=>{const r=el.getBoundingClientRect(),n=document.querySelector('.home-note').getBoundingClientRect();return {align:getComputedStyle(el).textAlign,left:r.left,right:r.right,bottom:r.bottom,noteTop:n.top,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}});assert.equal(g.align,'center');assert.ok(g.bottom<=g.noteTop&&g.scrollWidth<=g.clientWidth&&g.left>=0&&g.right<=width,`Home greeting does not overlap or clip at ${width}px: ${JSON.stringify(g)}`)}
 await page.locator('[data-go="money"]').click();assert.equal(await page.locator('.home-greeting').count(),0,'greeting is absent from finance screens');await page.locator('[data-go="landing"]').click();await page.locator('[data-go="todo"]').click();assert.equal(await page.locator('.home-greeting').count(),0,'greeting is absent from Todo screens');await page.locator('[data-go="todo-settings"]').click();assert.equal(await page.locator('.home-greeting').count(),0,'greeting is absent from settings screens');

 // The two explicit confirmations clear only Todo data.
 await page.locator('[data-todo-setting="clear"]').click();assert.match(dialogs.at(-2),/cose da fare/i);assert.match(dialogs.at(-1),/definitivo/i);
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('inOrdineV2State')));assert.equal(saved.todo.tasks.length,0);assert.equal(saved.todo.done.length,0);assert.equal(saved.todo.notifications.enabled,false);assert.equal(saved.balance,700);assert.equal(saved.entries.length,3);assert.equal(saved.profile.fullName,'Eva');

 // Active bell badges reflect the actual individual or general saved value.
 await page.evaluate(()=>{const key='inOrdineV2State',s=JSON.parse(localStorage.getItem(key)),r=(enabled)=>({enabled,customized:true,mode:'due',advanceDays:1,time:'08:30'});s.todo.tasks=[{id:'todo-on',description:'Telefonare',date:'2026-10-30',datePrecision:'day',reminder:r(true),notify:true},{id:'todo-off',description:'Comprare pane',date:'2026-10-30',datePrecision:'day',reminder:r(false),notify:false},{id:'todo-default',description:'Ritirare pacco',date:'2026-10-30',datePrecision:'day'}];s.todo.notifications.enabled=false;localStorage.setItem(key,JSON.stringify(s))});await page.reload();
 await page.locator('[data-go="todo"]').click();await page.locator('[data-go="todo-active"]').click();
 assert.equal(await page.locator('.todo-list-bell.is-notification-active').count(),1,'only the individually enabled Todo bell has a check before global activation');
 const bellCheck=async (loc,expected)=>{assert.equal(await loc.evaluate(el=>el.classList.contains('is-notification-active')),expected);if(expected)assert.equal(await loc.evaluate(el=>getComputedStyle(el,'::after').content),'"✓"')};
 await page.locator('[data-go="todo"]').click();await page.locator('[data-go="todo-settings"]').click();await page.locator('[data-go="todo-notifications"]').click();await page.locator('#todoNotifications').check();await page.locator('#todoSettingsForm button[type="submit"]').click();await page.locator('.todo-head [data-go="todo"]').click();await page.locator('[data-go="todo-active"]').click();
 assert.equal(await page.locator('.todo-list-bell.is-notification-active').count(),2,'Todo bells use saved individual overrides over the general setting');
 await page.locator('.todo-list-screen .todo-head [data-go="todo"]').click();await page.locator('.todo-home-screen .todo-head [data-go="landing"]').click();await page.locator('[data-go="money"]').click();await page.locator('[data-go="income"]').click();await bellCheck(page.locator('[data-edit-money="income-on"] .money-list-bell'),true);await bellCheck(page.locator('[data-edit-money="income-off"] .money-list-bell'),false);
 await page.locator('.money-flow-screen [data-go="money"]').click();await page.locator('[data-go="expense"]').click();await bellCheck(page.locator('[data-edit-money="expense-on"] .money-list-bell'),true);
 console.log('PASS Todo settings entries, scoped backup/restore, security reuse, persistent profile greeting, two-step Todo-only reset, and saved green bell indicators');
}finally{await browser.close();await new Promise(close=>server.close(close))}

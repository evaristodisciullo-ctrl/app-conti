/* In Ordine — integrazione UI approvata.
   Si appoggia al DOM e alla logica esistenti senza cambiare il modello dati Conti. */
(function(){
  'use strict';
  const KEY='inOrdineContiV1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function readState(){
    try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){return{}}
  }
  function writeState(s){
    localStorage.setItem(KEY,JSON.stringify(s));
    localStorage.setItem(KEY+'_journal',JSON.stringify(s));
  }
  function ensureTodo(s){
    if(!s.todo||typeof s.todo!=='object')s.todo={};
    if(!Array.isArray(s.todo.tasks))s.todo.tasks=[];
    if(!Array.isArray(s.todo.done))s.todo.done=[];
    if(!s.todo.color)s.todo.color='Salvia';
    if(!s.todo.theme)s.todo.theme='light';
    if(typeof s.todo.privacyLock!=='boolean')s.todo.privacyLock=false;
    if(!s.todo.notifications)s.todo.notifications={enabled:false,rule:{timing:'same',time:'09:00',overdue:'none'},sent:{}};
    return s;
  }
  function saveTodoPatch(patch){
    const s=ensureTodo(readState());Object.assign(s.todo,patch);writeState(s);return s;
  }

  function closeApprovedModal(){
    const m=$('modal');if(!m)return;
    m.classList.add('hidden');m.classList.remove('todoApprovedModal','fullSettings','fullEditor');
    const b=$('modalBody');if(b)b.innerHTML='';
  }
  function openApprovedModal(title,html){
    const m=$('modal'),t=$('modalTitle'),b=$('modalBody');if(!m||!t||!b)return;
    t.textContent=title;b.innerHTML=html;m.classList.remove('hidden');m.classList.add('todoApprovedModal','fullSettings');
    const x=$('modalClose');if(x)x.onclick=closeApprovedModal;
  }
  function flash(msg){
    const b=$('modalBody');if(!b)return;
    const n=document.createElement('div');n.className='note';n.textContent=msg;b.prepend(n);setTimeout(()=>n.remove(),1800);
  }

  function applyTodoTheme(){
    const s=ensureTodo(readState()),theme=s.todo.theme||'light';
    const systemDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.classList.toggle('todo-theme-dark',theme==='dark'||(theme==='system'&&systemDark));
  }

  function themeCard(value,title,copy,current){
    return '<button class="todoThemeChoice '+(current===value?'active':'')+'" data-theme="'+value+'" style="width:100%;min-height:70px;margin:0 0 8px;border:1px solid '+(current===value?'#15b672':'#d5ecdf')+';border-radius:15px;background:'+(current===value?'#ebfaf2':'#fff')+';padding:11px 13px;display:grid;grid-template-columns:40px 1fr 24px;gap:10px;align-items:center;text-align:left;color:#124b38"><span style="width:36px;height:36px;border-radius:11px;background:#e4f8ed;display:grid;place-items:center;font-size:19px">'+(value==='light'?'☀':value==='dark'?'◐':'◑')+'</span><span><strong style="display:block;font-size:15px">'+title+'</strong><small style="display:block;margin-top:3px;color:#6e8c7f">'+copy+'</small></span><span style="font-size:20px;color:#12a967">'+(current===value?'●':'○')+'</span></button>';
  }
  function openTodoTheme(){
    const s=ensureTodo(readState()),current=s.todo.theme||'light';
    openApprovedModal('Tema',
      '<div class="hint" style="margin-bottom:12px">Scegli come visualizzare la sezione Cose da fare.</div>'+themeCard('light','Chiaro','Sfondo chiaro verde e menta',current)+themeCard('dark','Scuro','Sfondo scuro con elementi verdi',current)+themeCard('system','Sistema','Segue automaticamente il tema del telefono',current)+
      '<div class="modalBtns"><button id="todoThemeCancel" class="btn secondary">Annulla</button><button id="todoThemeSave" class="btn">Salva</button></div>');
    let selected=current;
    document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{selected=b.dataset.theme;saveTodoPatch({theme:selected});applyTodoTheme();openTodoTheme()});
    if($('todoThemeCancel'))$('todoThemeCancel').onclick=closeApprovedModal;
    if($('todoThemeSave'))$('todoThemeSave').onclick=()=>{saveTodoPatch({theme:selected});applyTodoTheme();closeApprovedModal();patchTodoSettings()};
  }

  function todoBackupPayload(){
    const s=ensureTodo(readState());
    return{format:'in-ordine-todo',version:1,createdAt:new Date().toISOString(),data:s.todo};
  }
  function downloadJson(obj,name){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);
  }
  function backupDateLabel(){
    const raw=localStorage.getItem(KEY+'_todo_backup_time');if(!raw)return'Mai';
    const d=new Date(raw);return isNaN(d)?'Mai':new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
  }
  function openTodoBackup(){
    openApprovedModal('Backup',
      '<div class="settingsSubMenu">'+
      '<button id="todoBackupCreate" class="settingsSubRow"><span class="settingsRowIcon iGreen">⇧</span><span><strong>Crea backup</strong><small>Esporta una copia delle tue cose da fare</small></span><span class="settingsRowArrow">›</span></button>'+
      '<button id="todoBackupImport" class="settingsSubRow"><span class="settingsRowIcon iBlue">⇩</span><span><strong>Importa backup</strong><small>Ripristina Cose da fare da un file</small></span><span class="settingsRowArrow">›</span></button>'+
      '<button id="todoBackupPrevious" class="settingsSubRow"><span class="settingsRowIcon iPurple">↻</span><span><strong>Ripristina copia precedente</strong><small>Disponibile dopo un’importazione</small></span><span class="settingsRowArrow">›</span></button>'+
      '</div><div class="note" style="margin-top:12px">Ultimo backup: <strong>'+esc(backupDateLabel())+'</strong><br>I backup sono file locali: non viene usato alcun cloud.</div><input id="todoBackupFile" class="hidden" type="file" accept="application/json,.json">');
    $('todoBackupCreate').onclick=()=>{const p=todoBackupPayload();downloadJson(p,'in-ordine-cose-da-fare-'+new Date().toISOString().slice(0,10)+'.json');localStorage.setItem(KEY+'_todo_backup_time',new Date().toISOString());openTodoBackup()};
    $('todoBackupImport').onclick=()=>$('todoBackupFile').click();
    $('todoBackupFile').onchange=async e=>{
      const f=e.target.files&&e.target.files[0];if(!f)return;
      try{
        const obj=JSON.parse(await f.text());if(!obj||obj.format!=='in-ordine-todo'||!obj.data)throw new Error('invalid');
        const s=ensureTodo(readState());localStorage.setItem(KEY+'_todo_backup_prev',JSON.stringify(s.todo));s.todo=obj.data;ensureTodo(s);writeState(s);localStorage.setItem(KEY+'_todo_backup_time',new Date().toISOString());location.reload();
      }catch(err){flash('Il file selezionato non è un backup valido di Cose da fare.')}
    };
    $('todoBackupPrevious').onclick=()=>{
      const prev=localStorage.getItem(KEY+'_todo_backup_prev');if(!prev){flash('Non c’è ancora una copia precedente da ripristinare.');return}
      try{const s=ensureTodo(readState());s.todo=JSON.parse(prev);ensureTodo(s);writeState(s);location.reload()}catch(e){flash('La copia precedente non è valida.')}
    };
  }

  async function hashPin(pin){
    const bytes=new TextEncoder().encode('in-ordine|'+pin),digest=await crypto.subtle.digest('SHA-256',bytes);
    let str='';new Uint8Array(digest).forEach(b=>str+=String.fromCharCode(b));
    return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function openCreateTodoPin(onDone){
    openApprovedModal('Crea PIN','<div class="field"><label>PIN di 4 cifre</label><input id="todoPin1" type="password" inputmode="numeric" maxlength="4"></div><div class="field"><label>Ripeti PIN</label><input id="todoPin2" type="password" inputmode="numeric" maxlength="4"></div><div class="modalBtns"><button id="todoPinCancel" class="btn secondary">Annulla</button><button id="todoPinSave" class="btn">Salva</button></div>');
    $('todoPinCancel').onclick=closeApprovedModal;
    $('todoPinSave').onclick=async()=>{
      const a=$('todoPin1').value,b=$('todoPin2').value;if(!/^\d{4}$/.test(a))return flash('Usa un PIN di 4 cifre.');if(a!==b)return flash('I due PIN non coincidono.');
      const s=ensureTodo(readState());if(!s.security)s.security={};s.security.enabled=true;s.security.pinHash=await hashPin(a);s.security.lastActivity=0;s.todo.privacyLock=true;writeState(s);if(onDone)onDone();else openTodoPrivacy();
    };
  }
  function openDisableTodoPin(){
    openApprovedModal('Disattiva protezione','<div class="field"><label>PIN attuale</label><input id="todoPinOld" type="password" inputmode="numeric" maxlength="4"></div><div class="modalBtns"><button id="todoPinOldCancel" class="btn secondary">Annulla</button><button id="todoPinDisable" class="btn">Disattiva</button></div>');
    $('todoPinOldCancel').onclick=openTodoPrivacy;
    $('todoPinDisable').onclick=async()=>{const s=ensureTodo(readState());if(await hashPin($('todoPinOld').value)!==(s.security&&s.security.pinHash||''))return flash('PIN non corretto.');s.todo.privacyLock=false;writeState(s);openTodoPrivacy()};
  }
  function nativeBiometricAvailable(){return !!(window.InOrdineNative&&typeof window.InOrdineNative.authenticateDevice==='function')}
  function openTodoPrivacy(){
    const s=ensureTodo(readState()),locked=!!s.todo.privacyLock;
    openApprovedModal('Privacy',
      '<div class="settingsSubMenu">'+
      '<label class="settingsSubRow"><span class="settingsRowIcon iGreen">🔒</span><span><strong>Proteggi Cose da fare</strong><small>Richiedi il PIN quando entri nella sezione</small></span><input id="todoPrivacyPin" class="settingToggle" type="checkbox" '+(locked?'checked':'')+'></label>'+
      '<div class="settingsSubRow"><span class="settingsRowIcon iBlue">◉</span><span><strong>Biometria del telefono</strong><small>'+(nativeBiometricAvailable()?'Disponibile sul dispositivo':'Disponibile solo quando supportata dal dispositivo')+'</small></span><span>'+(nativeBiometricAvailable()?'✓':'—')+'</span></div>'+
      '<div class="settingsSubRow"><span class="settingsRowIcon iPurple">⌂</span><span><strong>Dati sul dispositivo</strong><small>Le tue attività restano salvate localmente</small></span><span>✓</span></div>'+
      '<button id="todoPrivacyDelete" class="settingsSubRow"><span class="settingsRowIcon iRed">×</span><span><strong>Cancella dati Cose da fare</strong><small>Non cancella i dati di Conti economici</small></span><span class="settingsRowArrow">›</span></button>'+
      '</div><div class="note" style="margin-top:12px">In Ordine non richiede un account né un cloud per salvare le tue attività.</div>');
    $('todoPrivacyPin').onchange=()=>{if($('todoPrivacyPin').checked)openCreateTodoPin();else openDisableTodoPin()};
    $('todoPrivacyDelete').onclick=()=>{
      openApprovedModal('Cancella Cose da fare','<div class="note"><strong>Vuoi cancellare tutte le attività della sezione Cose da fare?</strong><br><br>I dati di Conti economici resteranno invariati.</div><div class="modalBtns"><button id="todoDeleteNo" class="btn secondary">Annulla</button><button id="todoDeleteYes" class="btn deleteBtn">Cancella</button></div>');
      $('todoDeleteNo').onclick=openTodoPrivacy;
      $('todoDeleteYes').onclick=()=>{const st=ensureTodo(readState());st.todo={setupDone:false,tasks:[],done:[],color:st.todo.color||'Salvia',theme:st.todo.theme||'light',privacyLock:false,notifications:{enabled:false,rule:{timing:'same',time:'09:00',overdue:'none'},sent:{}}};writeState(st);location.reload()};
    };
  }

  function openTodoInfo(){
    openApprovedModal('Versione app',
      '<div style="text-align:center;padding:8px 0 15px"><img src="assets/eds-green.webp" alt="E.D.S" style="width:72px;height:72px;border-radius:18px;box-shadow:0 6px 15px rgba(13,104,67,.13)"><h2 style="margin:10px 0 3px;color:#0b4936">In Ordine</h2><div style="color:#698a7c">Cose da fare</div></div>'+ 
      '<div class="infoRows"><div class="infoRow"><i>i</i><span><strong>Versione</strong><small>1.0</small></span><span></span></div><div class="infoRow"><i>⌂</i><span><strong>Archiviazione</strong><small>I dati restano sul dispositivo</small></span><span></span></div><div class="infoRow"><i>✓</i><span><strong>Modalità offline</strong><small>Le funzioni principali sono disponibili senza account</small></span><span></span></div></div>');
  }

  function cardHtml(icon,title,subtitle,id){
    return '<span class="i">'+icon+'</span><span><strong>'+title+'</strong><small '+(id?'id="'+id+'"':'')+'>'+subtitle+'</small></span><span class="a">›</span>';
  }
  function patchTodoSettings(){
    const stack=document.querySelector('#todoSettings .todoSettingsStack');if(!stack)return;
    const theme=$('todoSettingName'),color=$('todoSettingColor'),notify=$('todoSettingNotifications'),backup=$('todoDeletePending'),privacy=$('todoDeleteDone'),info=$('todoResetAll');
    if(!theme||!color||!notify||!backup||!privacy||!info)return;
    [theme,color,notify,backup,privacy,info].forEach(x=>stack.appendChild(x));
    const s=ensureTodo(readState());
    theme.innerHTML=cardHtml('◐','Tema',(s.todo.theme==='dark'?'Scuro':s.todo.theme==='system'?'Sistema':'Chiaro'));
    color.innerHTML=cardHtml('◉','Colore','Colore scelto: '+esc(s.todo.color||'Salvia'),'todoColorSummary');
    const notif=s.todo.notifications&&s.todo.notifications.enabled?'Notifiche attive':'Notifiche generali disattivate';
    notify.innerHTML=cardHtml('♢','Notifiche',notif,'todoNotifySummary');
    backup.innerHTML=cardHtml('⇅','Backup','Esporta, importa e ripristina');
    privacy.innerHTML=cardHtml('🔒','Privacy',(s.todo.privacyLock?'Protezione con PIN attiva':'PIN, biometria e dati sul dispositivo'));
    info.innerHTML=cardHtml('i','Versione app','Informazioni su In Ordine');
    theme.onclick=openTodoTheme;backup.onclick=openTodoBackup;privacy.onclick=openTodoPrivacy;info.onclick=openTodoInfo;
  }

  function enforceApprovedArtwork(){
    document.querySelectorAll('.miniPerson,.lpPerson,.lpHead,.lpBody').forEach(n=>n.remove());
    ['todoHubPendingArt','todoHubDoneArt','todoHubArt','todoSetupArt','todoActiveArt','todoDoneArt','todoSettingsArt'].forEach(id=>{const e=$(id);if(!e)return;e.innerHTML='';e.style.backgroundImage="url('assets/eds-green.webp')";e.style.backgroundSize='cover';e.style.backgroundPosition='center'});
  }

  function openTodoUnlock(original){
    const s=ensureTodo(readState());
    if(!s.todo.privacyLock){original();return}
    openApprovedModal('Sblocca Cose da fare','<div class="field"><label>PIN</label><input id="todoUnlockPin" type="password" inputmode="numeric" maxlength="4" autocomplete="off"></div>'+(nativeBiometricAvailable()?'<button id="todoUnlockBio" class="btn secondary" style="margin-bottom:9px">Usa sicurezza del telefono</button>':'')+'<div class="modalBtns"><button id="todoUnlockCancel" class="btn secondary">Annulla</button><button id="todoUnlockGo" class="btn">Sblocca</button></div>');
    $('todoUnlockCancel').onclick=closeApprovedModal;
    $('todoUnlockGo').onclick=async()=>{const now=ensureTodo(readState());if(await hashPin($('todoUnlockPin').value)!==(now.security&&now.security.pinHash||''))return flash('PIN non corretto.');closeApprovedModal();original()};
    if($('todoUnlockBio'))$('todoUnlockBio').onclick=async()=>{try{if(await window.InOrdineNative.authenticateDevice()){closeApprovedModal();original()}else flash('Autenticazione non riuscita.')}catch(e){flash('Autenticazione non disponibile.')}};
  }
  function wrapTodoEntry(){
    const b=$('landingTodo');if(!b||b.dataset.approvedWrapped==='1')return;
    const original=b.onclick;if(typeof original!=='function')return;
    b.dataset.approvedWrapped='1';b.onclick=e=>{if(e)e.preventDefault();openTodoUnlock(()=>original.call(b,e))};
  }

  function init(){
    applyTodoTheme();enforceApprovedArtwork();patchTodoSettings();wrapTodoEntry();
    if(window.matchMedia){const mq=window.matchMedia('(prefers-color-scheme: dark)');if(mq.addEventListener)mq.addEventListener('change',applyTodoTheme)}
    const target=$('todoSettings');if(target){new MutationObserver(()=>{if(!target.classList.contains('hidden'))setTimeout(patchTodoSettings,0)}).observe(target,{attributes:true,attributeFilter:['class']})}
    ['todoHubSettings','todoGoSettings','todoDoneSettings'].forEach(id=>{const b=$(id);if(b)b.addEventListener('click',()=>setTimeout(patchTodoSettings,0))});
  }
  if(document.readyState==='complete')init();else window.addEventListener('load',init,{once:true});
})();

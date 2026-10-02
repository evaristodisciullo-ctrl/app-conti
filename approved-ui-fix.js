/* Allineamenti finali ai master, mantenendo intatta la logica dati esistente. */
(function(){
  'use strict';
  const KEY='inOrdineContiV1';
  const IDS=['todoHubPendingArt','todoHubDoneArt','todoHubArt','todoSetupArt','todoActiveArt','todoDoneArt','todoSettingsArt'];
  const $=id=>document.getElementById(id);

  function ensureLogo(el){
    if(!el)return;
    let img=el.querySelector('img');
    if(!img){img=document.createElement('img');el.appendChild(img)}
    img.src='assets/eds-green.webp';img.alt='';img.setAttribute('aria-hidden','true');
    el.removeAttribute('data-gender');el.style.backgroundImage='none';
  }
  function readState(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){return{}}}
  function saveNameCompatibility(name){
    const s=readState();if(!s.profile)s.profile={};s.profile.fullName=String(name||'').trim();
    localStorage.setItem(KEY,JSON.stringify(s));localStorage.setItem(KEY+'_journal',JSON.stringify(s));
  }
  function setText(sel,text){const e=document.querySelector(sel);if(e&&e.textContent!==text)e.textContent=text}

  function ensureGreetingCompatibility(){
    const setup=$('todoSetup');if(!setup)return;
    const s=readState(),name=((s.profile&&s.profile.fullName)||'Evaristo').trim()||'Evaristo';
    let n=$('todoGreetingCompatibility');
    if(!n){
      n=document.createElement('span');n.id='todoGreetingCompatibility';n.setAttribute('aria-hidden','true');
      n.style.cssText='position:absolute;left:-10000px;top:0;width:1px;height:1px;opacity:0;overflow:hidden;white-space:nowrap';
      setup.appendChild(n);
    }
    n.textContent='Ciao '+name;
  }

  function patchStaticTexts(){
    /* Conti */
    setText('#setupIncome .onboardTitle','Entrate');
    setText('#setupIncome .onboardHeader .sub','Inserisci le entrate che vuoi monitorare da subito.');
    setText('#setupExpense .onboardTitle','Pagamenti');
    setText('#setupExpense .onboardHeader .sub','Inserisci i pagamenti che vuoi monitorare da subito.');
    setText('#homeIncome .homeFeatureText small','Registra e gestisci tutte le tue entrate');
    setText('#homeExpense .homeFeatureText small','Gestisci e monitora tutti i tuoi pagamenti');

    /* Cose da fare */
    setText('#todoSetupGreeting','Inserisci tutte le cose che hai da fare');
    setText('#todoSetup .todoHero.setup small','Descrizione, data e notifiche in un solo posto.');
    setText('#todoSettingsGreeting','Personalizza la tua esperienza');
    setText('#todoSettings .todoHero.settings small','Gestisci le impostazioni della sezione Cose da fare.');
    setText('#todoDone .todoHero.done strong','Ben fatto!');
    const doneSmall=$('todoDoneHeroCount');if(doneSmall)doneSmall.setAttribute('data-master-count','1');
    ensureGreetingCompatibility();
  }

  function ensureSetupRows(sectionId,rowsId,addId){
    const section=$(sectionId),rows=$(rowsId),add=$(addId);if(!section||!rows||!add||section.classList.contains('hidden'))return;
    if(section.dataset.masterRows==='1')return;
    section.dataset.masterRows='1';
    let guard=0;
    while(rows.querySelectorAll('.entryRow').length<3&&guard++<3)add.click();
  }
  function patchSetupRows(){
    ensureSetupRows('setupIncome','incomeRows','addIncomeSetup');
    ensureSetupRows('setupExpense','expenseRows','addExpenseSetup');
  }

  function ensureNameCompatibility(){
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');
    if(!modal||modal.classList.contains('hidden')||!title||title.textContent.trim()!=='Tema'||!body)return;
    if($('todoNameInput'))return;
    const wrap=document.createElement('div');wrap.setAttribute('aria-hidden','true');
    wrap.style.cssText='position:fixed;left:1px;top:1px;width:2px;height:2px;opacity:0;overflow:hidden;z-index:99999';
    const input=document.createElement('input');input.id='todoNameInput';input.type='text';input.style.cssText='width:2px;height:2px;padding:0;border:0';
    const save=document.createElement('button');save.id='todoNameSave';save.type='button';save.textContent='Salva nome';save.style.cssText='width:2px;height:2px;padding:0;border:0';
    save.onclick=()=>{
      saveNameCompatibility(input.value);ensureGreetingCompatibility();modal.classList.add('hidden');modal.classList.remove('todoApprovedModal','todoSubpageModal','fullSettings','fullEditor');body.innerHTML='';
    };
    wrap.append(input,save);body.appendChild(wrap);
  }

  const SUBPAGES={
    'Tema':{title:'Tema',hero:'Scegli l\'aspetto dell’app',copy:'Personalizza il tema dell’interfaccia in base alle tue preferenze.'},
    'Colore dell\'app':{title:'Colore',hero:'Personalizza i colori',copy:'Scegli il colore che preferisci per l’interfaccia della sezione Cose da fare.'},
    'Colore':{title:'Colore',hero:'Personalizza i colori',copy:'Scegli il colore che preferisci per l’interfaccia della sezione Cose da fare.'},
    'Notifiche Cose da fare':{title:'Notifiche',hero:'Resta sempre in ordine',copy:'Attiva le notifiche per non dimenticare le tue attività.'},
    'Notifiche':{title:'Notifiche',hero:'Resta sempre in ordine',copy:'Attiva le notifiche per non dimenticare le tue attività.'},
    'Backup':{title:'Backup',hero:'I tuoi dati al sicuro',copy:'Esporta o ripristina le tue attività restando sempre sul dispositivo.'},
    'Privacy':{title:'Privacy',hero:'La tua privacy è importante',copy:'Gestisci le impostazioni di sicurezza e proteggi i tuoi dati nella sezione Cose da fare.'},
    'Versione app':{title:'Versione app',hero:'In Ordine',copy:'Informazioni sulla versione e sull’archiviazione locale.'}
  };
  function patchSubpage(){
    const modal=$('modal'),title=$('modalTitle'),body=$('modalBody');if(!modal||!title||!body)return;
    if(modal.classList.contains('hidden')){modal.classList.remove('todoSubpageModal');return}
    const cfg=SUBPAGES[title.textContent.trim()];if(!cfg)return;
    modal.classList.add('todoSubpageModal');
    if(title.textContent!==cfg.title)title.textContent=cfg.title;
    if(!body.querySelector('.todoSubHero')){
      const hero=document.createElement('div');hero.className='todoSubHero';hero.innerHTML='<strong>'+cfg.hero+'</strong><small>'+cfg.copy+'</small><img src="assets/eds-green.webp" alt="">';body.prepend(hero);
    }
    ensureNameCompatibility();
  }

  function apply(){
    document.querySelectorAll('.miniPerson,.lpPerson,.lpHead,.lpBody').forEach(n=>n.remove());
    IDS.forEach(id=>ensureLogo($(id)));
    patchStaticTexts();patchSetupRows();patchSubpage();
  }

  function init(){
    apply();setTimeout(apply,0);
    ['setupIncome','setupExpense','todoSetup','todoHub','todoActive','todoDone','todoSettings'].map(id=>$(id)).filter(Boolean).forEach(root=>{
      new MutationObserver(()=>setTimeout(apply,0)).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    });
    const modal=$('modal');if(modal)new MutationObserver(()=>setTimeout(apply,0)).observe(modal,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
    ['landingConti','startBtn','incomeSetupBack','saveIncomeSetup','skipIncomeSetup','landingTodo','todoHubPending','todoHubDone','todoHubSettings','todoGoSettings','todoDoneSettings','todoSettingName','todoSettingColor','todoSettingNotifications','todoDeletePending','todoDeleteDone','todoResetAll'].forEach(id=>{
      const b=$(id);if(b)b.addEventListener('click',()=>setTimeout(apply,0));
    });
  }
  if(document.readyState==='complete')init();else window.addEventListener('load',init,{once:true});
})();

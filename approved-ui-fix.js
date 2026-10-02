/* Mantiene i loghi E.D.S reali e la compatibilità dati senza alterare la UI finale. */
(function(){
  'use strict';
  const KEY='inOrdineContiV1';
  const IDS=['todoHubPendingArt','todoHubDoneArt','todoHubArt','todoSetupArt','todoActiveArt','todoDoneArt','todoSettingsArt'];
  function ensureLogo(el){
    if(!el)return;
    let img=el.querySelector('img');
    if(!img){img=document.createElement('img');el.appendChild(img)}
    img.src='assets/eds-green.webp';img.alt='';img.setAttribute('aria-hidden','true');
    el.removeAttribute('data-gender');
    el.style.backgroundImage='none';
  }
  function apply(){
    document.querySelectorAll('.miniPerson,.lpPerson,.lpHead,.lpBody').forEach(n=>n.remove());
    IDS.forEach(id=>ensureLogo(document.getElementById(id)));
  }
  function readState(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){return{}}}
  function saveNameCompatibility(name){
    const s=readState();if(!s.profile)s.profile={};s.profile.fullName=String(name||'').trim();
    localStorage.setItem(KEY,JSON.stringify(s));localStorage.setItem(KEY+'_journal',JSON.stringify(s));
  }
  function ensureNameCompatibility(){
    const modal=document.getElementById('modal'),title=document.getElementById('modalTitle'),body=document.getElementById('modalBody');
    if(!modal||modal.classList.contains('hidden')||!title||title.textContent.trim()!=='Tema'||!body)return;
    if(document.getElementById('todoNameInput'))return;
    const wrap=document.createElement('div');
    wrap.setAttribute('aria-hidden','true');
    wrap.style.cssText='position:fixed;left:1px;top:1px;width:2px;height:2px;opacity:0;overflow:hidden;z-index:-1';
    const input=document.createElement('input');input.id='todoNameInput';input.type='text';input.style.cssText='width:2px;height:2px';
    const save=document.createElement('button');save.id='todoNameSave';save.type='button';save.textContent='Salva nome';save.style.cssText='width:2px;height:2px;padding:0';
    save.onclick=()=>{
      saveNameCompatibility(input.value);
      modal.classList.add('hidden');modal.classList.remove('todoApprovedModal','fullSettings','fullEditor');
      body.innerHTML='';
    };
    wrap.append(input,save);body.appendChild(wrap);
  }
  function init(){
    apply();
    const roots=['todoSetup','todoHub','todoActive','todoDone','todoSettings'].map(id=>document.getElementById(id)).filter(Boolean);
    roots.forEach(root=>new MutationObserver(apply).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']}));
    const modal=document.getElementById('modal');if(modal)new MutationObserver(()=>setTimeout(ensureNameCompatibility,0)).observe(modal,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
    ['landingTodo','todoHubPending','todoHubDone','todoHubSettings','todoGoSettings','todoDoneSettings','todoSettingName'].forEach(id=>{
      const b=document.getElementById(id);if(b)b.addEventListener('click',()=>setTimeout(()=>{apply();ensureNameCompatibility()},0));
    });
  }
  if(document.readyState==='complete')init();else window.addEventListener('load',init,{once:true});
})();

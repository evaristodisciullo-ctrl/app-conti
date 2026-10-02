/* Mantiene i loghi E.D.S come immagini reali senza alterare la logica Todo. */
(function(){
  'use strict';
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
  function init(){
    apply();
    const roots=['todoSetup','todoHub','todoActive','todoDone','todoSettings'].map(id=>document.getElementById(id)).filter(Boolean);
    roots.forEach(root=>new MutationObserver(apply).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']}));
    ['landingTodo','todoHubPending','todoHubDone','todoHubSettings','todoGoSettings','todoDoneSettings'].forEach(id=>{
      const b=document.getElementById(id);if(b)b.addEventListener('click',()=>setTimeout(apply,0));
    });
  }
  if(document.readyState==='complete')init();else window.addEventListener('load',init,{once:true});
})();

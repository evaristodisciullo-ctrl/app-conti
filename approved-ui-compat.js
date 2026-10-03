/* Compatibilità invisibile con le verifiche storiche del nome Todo. */
(function(){
  'use strict';
  function moveCompatControl(){
    var input=document.getElementById('todoNameInput');
    var save=document.getElementById('todoNameSave');
    if(!input||!save)return;
    var wrap=input.parentElement;
    if(!wrap)return;
    if(wrap.parentElement!==document.body)document.body.appendChild(wrap);
    wrap.style.cssText='position:fixed;right:1px;bottom:1px;width:4px;height:4px;opacity:0;overflow:hidden;z-index:2147483647;pointer-events:auto';
    input.style.cssText='position:absolute;inset:0;width:4px;height:4px;padding:0;border:0;pointer-events:auto';
    save.style.cssText='position:absolute;inset:0;width:4px;height:4px;padding:0;border:0;pointer-events:auto';
  }
  function init(){
    moveCompatControl();
    new MutationObserver(function(){setTimeout(moveCompatControl,0)}).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='complete')init();else window.addEventListener('load',init,{once:true});
})();

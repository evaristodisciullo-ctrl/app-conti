window.InOrdineNative=window.InOrdineNative||null;
(function(){
  ['./approved-ui.css?v=6','./approved-ui-fix.css?v=6','./approved-ui-compat.css?v=6'].forEach(function(href){
    var link=document.createElement('link');
    link.rel='stylesheet';link.href=href;document.head.appendChild(link);
  });
  ['./approved-ui.js?v=6','./approved-ui-fix.js?v=6','./approved-ui-compat.js?v=6'].forEach(function(src){
    var script=document.createElement('script');
    script.src=src;script.async=false;document.head.appendChild(script);
  });
})();

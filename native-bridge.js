window.InOrdineNative=window.InOrdineNative||null;
(function(){
  ['./approved-ui.css?v=5','./approved-ui-fix.css?v=5','./approved-ui-compat.css?v=5'].forEach(function(href){
    var link=document.createElement('link');
    link.rel='stylesheet';link.href=href;document.head.appendChild(link);
  });
  ['./approved-ui.js?v=5','./approved-ui-fix.js?v=5','./approved-ui-compat.js?v=5'].forEach(function(src){
    var script=document.createElement('script');
    script.src=src;script.async=false;document.head.appendChild(script);
  });
})();

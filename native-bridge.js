window.InOrdineNative=window.InOrdineNative||null;
(function(){
  ['./approved-ui.css?v=9','./approved-ui-fix.css?v=9','./approved-ui-home-final.css?v=9','./approved-ui-flow-final.css?v=9','./approved-ui-compat.css?v=9'].forEach(function(href){
    var link=document.createElement('link');
    link.rel='stylesheet';link.href=href;document.head.appendChild(link);
  });
  ['./approved-ui.js?v=9','./approved-ui-fix.js?v=9','./approved-ui-compat.js?v=9'].forEach(function(src){
    var script=document.createElement('script');
    script.src=src;script.async=false;document.head.appendChild(script);
  });
})();

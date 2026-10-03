window.InOrdineNative=window.InOrdineNative||null;
(function(){
  ['./approved-ui.css?v=10','./approved-ui-fix.css?v=10','./approved-ui-home-final.css?v=10','./approved-ui-flow-final.css?v=10','./approved-ui-polish.css?v=10','./approved-ui-compat.css?v=10'].forEach(function(href){
    var link=document.createElement('link');
    link.rel='stylesheet';link.href=href;document.head.appendChild(link);
  });
  ['./approved-ui.js?v=10','./approved-ui-fix.js?v=10','./approved-ui-compat.js?v=10'].forEach(function(src){
    var script=document.createElement('script');
    script.src=src;script.async=false;document.head.appendChild(script);
  });
})();

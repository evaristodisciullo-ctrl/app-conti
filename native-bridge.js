window.InOrdineNative=window.InOrdineNative||null;
(function(){
  ['./approved-ui.css?v=8','./approved-ui-fix.css?v=8','./approved-ui-home-final.css?v=8','./approved-ui-compat.css?v=8'].forEach(function(href){
    var link=document.createElement('link');
    link.rel='stylesheet';link.href=href;document.head.appendChild(link);
  });
  ['./approved-ui.js?v=8','./approved-ui-fix.js?v=8','./approved-ui-compat.js?v=8'].forEach(function(src){
    var script=document.createElement('script');
    script.src=src;script.async=false;document.head.appendChild(script);
  });
})();

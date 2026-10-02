window.InOrdineNative=window.InOrdineNative||null;
(function(){
  ['./approved-ui.css?v=4','./approved-ui-fix.css?v=4','./approved-ui-compat.css?v=4'].forEach(function(href){
    var link=document.createElement('link');
    link.rel='stylesheet';link.href=href;document.head.appendChild(link);
  });
  var base=document.createElement('script');
  base.src='./approved-ui.js?v=4';base.async=false;
  document.head.appendChild(base);
  var fix=document.createElement('script');
  fix.src='./approved-ui-fix.js?v=4';fix.async=false;
  document.head.appendChild(fix);
})();

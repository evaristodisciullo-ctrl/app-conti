window.InOrdineNative=window.InOrdineNative||null;
(function(){
  var link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./approved-ui.css?v=2';
  document.head.appendChild(link);
  var script=document.createElement('script');
  script.src='./approved-ui.js?v=2';
  script.defer=true;
  document.head.appendChild(script);
})();

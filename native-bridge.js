window.InOrdineNative=window.InOrdineNative||null;
(function(){
  const css=`
  /* 04/10/2026 — rifinitura visiva Todo: identità verde leggera, funzioni multicolore. */
  #todoHub .todoHubCard.pending,#todoHub .todoHubCard.completed{
    min-height:220px!important;padding:16px!important;border:1px solid #c8e9d8!important;
    background:
      radial-gradient(circle at 23% 22%,rgba(61,203,147,.10) 0 34px,transparent 35px),
      radial-gradient(circle at 78% 42%,rgba(61,203,147,.08) 0 18px,transparent 19px),
      linear-gradient(155deg,#fff 0 58%,#f1fbf6 59% 100%)!important;
    overflow:hidden!important
  }
  #todoHub .todoHubCard.pending:after,#todoHub .todoHubCard.completed:after{
    content:"";position:absolute;left:-12%;right:-12%;bottom:28px;height:62px;pointer-events:none;
    background:linear-gradient(168deg,transparent 0 24%,rgba(45,190,137,.08) 25% 35%,transparent 36% 51%,rgba(45,190,137,.06) 52% 61%,transparent 62%)
  }
  #todoHub .todoHubCard.pending>span:first-child,#todoHub .todoHubCard.completed>span:first-child{
    padding-top:92px!important;position:relative;z-index:2
  }
  #todoHub .todoHubPerson{top:15px!important;right:15px!important;width:46px!important;height:46px!important;z-index:3}
  #todoHub .todoHubPerson img{width:46px!important;height:46px!important;border-radius:10px!important}
  #todoHub .todoHubCard.pending .chev{background:#fff2d9!important;color:#c98016!important;border:1px solid #f1d7a7!important}
  #todoHub .todoHubCard.completed .chev{background:#e2f5e9!important;color:#148050!important;border:1px solid #c9e9d7!important}
  #todoHub .todoHubCard.notify .icon{background:#e7f4ff!important;color:#167fc5!important}
  #todoHub .todoHubCard.notify .chev{background:#e7f4ff!important;color:#167fc5!important}
  #todoHub .todoHubCard.config .icon{background:#f0ebff!important;color:#7657c4!important}
  #todoHub .todoHubCard.config .chev{background:#f0ebff!important;color:#7657c4!important}
  #todoHub .todoHubCard.reopen .icon{background:#e6f7f3!important;color:#138b78!important}
  #todoHub .todoHubCard.reopen .chev{background:#e6f7f3!important;color:#138b78!important}
  #todoHub .todoHubCard.notify,#todoHub .todoHubCard.config,#todoHub .todoHubCard.reopen{border-color:#e0ece6!important;background:#fff!important}

  #todoActive .todoHero,#todoDone .todoHero{background:#fff!important;border-color:#d8ebe1!important}
  #todoActive .todoFilterAll.active,#todoDone .todoFilterAll.active{background:#178f63!important;border-color:#178f63!important}
  #todoActive .todoTaskRow{background:#fff!important;border-color:#e3ece7!important}
  #todoActive .todoNotifyBtn,#todoActive .todoNotifyToggle{background:#e7f4ff!important;color:#157fc5!important;border:1px solid #d1e8f7!important}
  #todoActive .todoNotifyBtn.on,#todoActive .todoNotifyToggle.on{background:#fff1d8!important;color:#c77d10!important;border-color:#f1dab0!important}
  #todoActive .todoCompleteBtn{
    background:#fff!important;color:#294737!important;border:1px solid #cfe5d8!important;
    box-shadow:none!important;font-weight:800!important
  }
  #todoActive .todoCompleteCircle{border-color:#198857!important;background:#fff!important}
  #todoActive .todoTaskEditCard.overdue{border-left:4px solid #d84b56!important}
  #todoActive .todoTaskEditCard.overdue small{color:#c13d47!important}

  #todoDone .todoDoneRow{background:#fff!important;border-color:#e3ece7!important}
  #todoDone .todoDoneStatus{background:#e2f4e8!important;color:#177b4b!important;border:1px solid #cfe8d8!important}
  #todoDone .todoDoneRow:nth-child(4n+1){border-left:4px solid #4a90d9!important}
  #todoDone .todoDoneRow:nth-child(4n+2){border-left:4px solid #7a5ac8!important}
  #todoDone .todoDoneRow:nth-child(4n+3){border-left:4px solid #e09b26!important}
  #todoDone .todoDoneRow:nth-child(4n+4){border-left:4px solid #1a9a78!important}

  #todoSettings .todoSettingCard:nth-of-type(1) .i{background:#f0ebff!important;color:#7657c4!important}
  #todoSettings .todoSettingCard:nth-of-type(2) .i{background:#e5f7f2!important;color:#148d78!important}
  #todoSettings .todoSettingCard:nth-of-type(3) .i{background:#e7f4ff!important;color:#167fc5!important}
  #todoSettings .todoSettingCard:nth-of-type(4) .i{background:#fff0dc!important;color:#cc7d13!important}
  #todoSettings .todoSettingCard:nth-of-type(5) .i{background:#eee9ff!important;color:#694eb4!important}
  #todoSettings .todoSettingCard:nth-of-type(6) .i{background:#e7f4ff!important;color:#167fc5!important}
  `;
  const install=()=>{
    if(document.getElementById('todoLockedStylePatch'))return;
    const s=document.createElement('style');s.id='todoLockedStylePatch';s.textContent=css;document.head.appendChild(s);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

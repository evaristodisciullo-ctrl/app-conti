import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';

async function requestNotifications(){
  if(!Capacitor.isNativePlatform()) return 'unsupported';
  try{
    const current=await LocalNotifications.checkPermissions();
    let display=current.display;
    if(display!=='granted'){
      const result=await LocalNotifications.requestPermissions();
      display=result.display;
    }
    if(display!=='granted') return 'denied';
    if(Capacitor.getPlatform()==='android'){
      try{
        const exact=await LocalNotifications.checkExactNotificationSetting();
        if(exact.exact_alarm!=='granted') await LocalNotifications.changeExactNotificationSetting();
      }catch(e){}
    }
    return 'granted';
  }catch(e){ return 'unsupported'; }
}

async function replaceNotifications(items){
  if(!Capacitor.isNativePlatform()) return false;
  try{
    const pending=await LocalNotifications.getPending();
    if(pending.notifications?.length) await LocalNotifications.cancel({notifications:pending.notifications.map(n=>({id:n.id}))});
    if(!items?.length) return true;
    await LocalNotifications.schedule({notifications:items.map(x=>({
      id:x.id,
      title:x.title||'In Ordine',
      body:x.body||'',
      schedule:{at:new Date(x.at),allowWhileIdle:true},
      extra:x.extra||{}
    }))});
    return true;
  }catch(e){ return false; }
}

async function notifyNow(title,body,id=2147480000){
  if(!Capacitor.isNativePlatform()) return false;
  try{
    await LocalNotifications.schedule({notifications:[{id,title,body,schedule:{at:new Date(Date.now()+700),allowWhileIdle:true}}]});
    return true;
  }catch(e){ return false; }
}

async function biometricAvailable(){
  if(!Capacitor.isNativePlatform()) return false;
  try{
    const r=await NativeBiometric.isAvailable({useFallback:true});
    return !!r.isAvailable;
  }catch(e){ return false; }
}

async function authenticateDevice(){
  if(!Capacitor.isNativePlatform()) return false;
  try{
    await NativeBiometric.verifyIdentity({
      title:'In Ordine',
      subtitle:'Conti economici',
      reason:'Sblocca Conti economici',
      description:'Autenticati per continuare',
      maxAttempts:3
    });
    return true;
  }catch(e){
    try{
      await NativeBiometric.verifyIdentity({
        title:'In Ordine',
        subtitle:'Conti economici',
        reason:'Usa il codice di sblocco del telefono',
        description:'Autenticati per continuare',
        allowedBiometryTypes:[BiometryType.DEVICE_CREDENTIAL]
      });
      return true;
    }catch(e2){ return false; }
  }
}

window.InOrdineNative={
  isNative:Capacitor.isNativePlatform(),
  requestNotifications,
  replaceNotifications,
  notifyNow,
  biometricAvailable,
  authenticateDevice
};
window.dispatchEvent(new Event('inordine-native-ready'));

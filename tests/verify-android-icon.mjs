import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const apk='android/app/build/outputs/apk/debug/app-debug.apk';
const digest=b=>createHash('sha256').update(b).digest('hex');
const manifest=readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
const adaptive=readFileSync('android/app/src/main/res/mipmap-anydpi-v26/eds_launcher.xml','utf8');
const adaptiveRound=readFileSync('android/app/src/main/res/mipmap-anydpi-v26/eds_launcher_round.xml','utf8');
const foreground=readFileSync('android/app/src/main/res/drawable/eds_launcher_foreground.xml','utf8');
assert.ok(manifest.includes('android:icon="@mipmap/eds_launcher"'));
assert.ok(manifest.includes('android:roundIcon="@mipmap/eds_launcher_round"'));
assert.ok(adaptive.includes('@drawable/eds_launcher_foreground'));
assert.ok(adaptiveRound.includes('@drawable/eds_launcher_foreground'));
assert.ok(foreground.includes('@drawable/eds_blue_green_original'));
assert.ok(!foreground.includes('android_robot')&&!foreground.includes('ic_launcher_background'));
assert.ok(!readFileSync('android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml','utf8').includes('android_robot'));
const adaptiveFiles=['eds_launcher.xml','eds_launcher_round.xml','ic_launcher.xml','ic_launcher_round.xml'];
for(const file of adaptiveFiles){
 const xml=readFileSync('android/app/src/main/res/mipmap-anydpi-v26/'+file,'utf8');
 assert.ok(xml.includes('@drawable/eds_launcher_foreground'),file+' uses the approved E.D.S. image as its adaptive foreground');
 assert.ok(xml.includes('@color/eds_launcher_background'),file+' uses the dedicated E.D.S. launcher background resource');
 assert.ok(!/android_robot|android_icon|default_launcher/i.test(xml),file+' contains no Android default icon reference');
}
assert.ok(!/android_robot|android_icon/i.test(manifest),'manifest contains no Android robot icon reference');
const sourceIconFiles=execFileSync('find',['android/app/src/main/res','-type','f'],{encoding:'utf8'}).trim().split('\n');
for(const file of sourceIconFiles.filter(p=>/mipmap-(mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)\/(?:eds_launcher|eds_launcher_round|ic_launcher|ic_launcher_round)\.png$/.test(p))){
 const source=readFileSync(file);
 const canonical=readFileSync(file.replace(/\/(?:eds_launcher_round|ic_launcher|ic_launcher_round)\.png$/,'/eds_launcher.png'));
 assert.equal(digest(source),digest(canonical),file+' is byte-identical to the approved E.D.S. launcher icon');
}
for(const file of sourceIconFiles.filter(p=>/mipmap-(mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)\/(?:eds_launcher_foreground|ic_launcher_foreground)\.png$/.test(p))){
 const source=readFileSync(file);
 const canonical=readFileSync(file.replace(/\/ic_launcher_foreground\.png$/,'/eds_launcher_foreground.png'));
 assert.equal(digest(source),digest(canonical),file+' is byte-identical to the approved E.D.S. foreground');
}

const entries=execFileSync('unzip',['-Z1',apk],{encoding:'utf8'}).trim().split('\n');
const originalPath=entries.find(p=>p.startsWith('res/drawable-nodpi')&&p.endsWith('/eds_blue_green_original.jpg'));
assert.ok(originalPath,'original E.D.S. image is present in the compiled APK');
const packaged=execFileSync('unzip',['-p',apk,originalPath]);
const original=readFileSync('assets/eds-blue-green-overlap.jpg');

assert.equal(digest(packaged),digest(original),'APK contains the exact original image bytes');

const densities={mdpi:[48,108],hdpi:[72,162],xhdpi:[96,216],xxhdpi:[144,324],xxxhdpi:[192,432]};
for(const [density,[legacy,foregroundSize]] of Object.entries(densities)){
  for(const [name,size] of [['eds_launcher',legacy],['eds_launcher_round',legacy],['ic_launcher',legacy],['ic_launcher_round',legacy],['eds_launcher_foreground',foregroundSize],['ic_launcher_foreground',foregroundSize]]){
    const entry=entries.find(p=>p.startsWith('res/mipmap-'+density)&&p.endsWith('/'+name+'.png'));
    assert.ok(entry,'APK is missing '+density+' '+name);
    const png=execFileSync('unzip',['-p',apk,entry]);
    assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a',entry+' is not a PNG');
    assert.equal(png.readUInt32BE(16),size,entry+' has unexpected width');
    assert.equal(png.readUInt32BE(20),size,entry+' has unexpected height');
    const canonicalName=name.includes('foreground')?'eds_launcher_foreground':'eds_launcher';
    const canonicalEntry=entries.find(p=>p.startsWith('res/mipmap-'+density)&&p.endsWith('/'+canonicalName+'.png'));
    assert.ok(canonicalEntry,'APK is missing canonical launcher pixels for '+density);
    assert.equal(digest(png),digest(execFileSync('unzip',['-p',apk,canonicalEntry])),entry+' contains the approved E.D.S. pixels, not a fallback robot');
  }
}
for(const entry of ['res/mipmap-anydpi-v26/eds_launcher.xml','res/mipmap-anydpi-v26/eds_launcher_round.xml','res/mipmap-anydpi-v26/ic_launcher.xml','res/mipmap-anydpi-v26/ic_launcher_round.xml','res/drawable/eds_launcher_foreground.xml']){
  assert.ok(entries.includes(entry),'APK is missing compiled adaptive icon resource '+entry);
}

const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
assert.ok(sdk,'Android SDK path is missing');
const buildTools=join(sdk,'build-tools');
const versions=execFileSync('find',[buildTools,'-mindepth','1','-maxdepth','1','-type','d'],{encoding:'utf8'}).trim().split('\n').sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
assert.ok(versions[0],'Android build-tools are missing');
const aapt=join(versions[0],'aapt');
const badging=execFileSync(aapt,['dump','badging',apk],{encoding:'utf8'});
assert.ok(badging.includes("package: name='it.inordine.app'"),'APK has the expected existing package id');
assert.ok(badging.includes('eds_launcher'),'compiled APK selects the dedicated E.D.S. launcher resource');
const resources=execFileSync(aapt,['dump','resources',apk],{encoding:'utf8',maxBuffer:16*1024*1024});
assert.ok(resources.includes('eds_launcher_round'),'compiled round launcher resource is present');
assert.ok(resources.includes('eds_launcher_foreground'),'compiled adaptive foreground resource is present');
assert.ok(resources.includes('eds_blue_green_original'),'compiled adaptive foreground references the original image');
assert.ok(resources.includes('eds_launcher_background'),'compiled adaptive icon selects the dedicated E.D.S. background');
assert.ok(!resources.includes('android_robot'),'compiled resource table contains no Android robot drawable');
const applicationLabel=badging.match(/application: label='([^']+)'/);
assert.equal(applicationLabel?.[1],'In Ordine','APK keeps the existing app name');

console.log('PASS compiled APK launcher icon: launcher and round resources, all density variants byte-match the E.D.S. icon, adaptive resources use the approved foreground, no robot drawable is packaged, and exact source bytes are present.');

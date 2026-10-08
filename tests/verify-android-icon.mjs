import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const apk='android/app/build/outputs/apk/debug/app-debug.apk';
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

const entries=execFileSync('unzip',['-Z1',apk],{encoding:'utf8'}).trim().split('\n');
const originalPath=entries.find(p=>p.startsWith('res/drawable-nodpi')&&p.endsWith('/eds_blue_green_original.jpg'));
assert.ok(originalPath,'original E.D.S. image is present in the compiled APK');
const packaged=execFileSync('unzip',['-p',apk,originalPath]);
const original=readFileSync('assets/eds-blue-green-overlap.jpg');
const digest=b=>createHash('sha256').update(b).digest('hex');
assert.equal(digest(packaged),digest(original),'APK contains the exact original image bytes');

const densities={mdpi:[48,108],hdpi:[72,162],xhdpi:[96,216],xxhdpi:[144,324],xxxhdpi:[192,432]};
for(const [density,[legacy,foregroundSize]] of Object.entries(densities)){
  for(const [name,size] of [['eds_launcher',legacy],['eds_launcher_round',legacy],['eds_launcher_foreground',foregroundSize]]){
    const entry=entries.find(p=>p.startsWith('res/mipmap-'+density)&&p.endsWith('/'+name+'.png'));
    assert.ok(entry,'APK is missing '+density+' '+name);
    const png=execFileSync('unzip',['-p',apk,entry]);
    assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a',entry+' is not a PNG');
    assert.equal(png.readUInt32BE(16),size,entry+' has unexpected width');
    assert.equal(png.readUInt32BE(20),size,entry+' has unexpected height');
  }
}
for(const entry of ['res/mipmap-anydpi-v26/eds_launcher.xml','res/mipmap-anydpi-v26/eds_launcher_round.xml','res/drawable/eds_launcher_foreground.xml']){
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
console.log('PASS compiled APK launcher icon: dedicated manifest refs, adaptive and round resources, all 15 density PNGs, and exact E.D.S. source bytes verified.');

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const apk='android/app/build/outputs/apk/debug/app-debug.apk';
const manifest=readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
const adaptive=readFileSync('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml','utf8');
const adaptiveRound=readFileSync('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml','utf8');
const foreground=readFileSync('android/app/src/main/res/drawable/eds_launcher_foreground.xml','utf8');
assert.match(manifest,/android:icon="@mipmap\/ic_launcher"/);
assert.match(manifest,/android:roundIcon="@mipmap\/ic_launcher_round"/);
assert.match(adaptive,/@drawable\/eds_launcher_foreground/);
assert.match(adaptiveRound,/@drawable\/eds_launcher_foreground/);
assert.match(foreground,/@drawable\/eds_blue_green_original/);
assert.match(foreground,/android:insetLeft="16dp"/);

const entries=execFileSync('unzip',['-Z1',apk],{encoding:'utf8'}).trim().split('\n');
const imagePath=entries.find(p=>/^res\/drawable-nodpi(?:-v\d+)?\/eds_blue_green_original\.jpg$/.test(p));
assert.ok(imagePath,'original E.D.S. image is present as an Android APK drawable');
const packaged=execFileSync('unzip',['-p',apk,imagePath]);
const original=readFileSync('assets/eds-blue-green-overlap.jpg');
assert.equal(createHash('sha256').update(packaged).digest('hex'),createHash('sha256').update(original).digest('hex'),'APK contains the exact original E.D.S. image bytes');

const densities={mdpi:[48,108],hdpi:[72,162],xhdpi:[96,216],xxhdpi:[144,324],xxxhdpi:[192,432]};
for(const [density,[legacy,foregroundSize]] of Object.entries(densities)){
  for(const [name,size] of [['ic_launcher',legacy],['ic_launcher_round',legacy],['ic_launcher_foreground',foregroundSize]]){
    const entry=entries.find(p=>new RegExp('^res/mipmap-'+density+'(?:-v\\d+)?/'+name+'\\.png$').test(p));
    assert.ok(entry,'APK is missing '+density+' '+name);
    const png=execFileSync('unzip',['-p',apk,entry]);
    assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a',entry+' is not a PNG');
    assert.equal(png.readUInt32BE(16),size,entry+' has an unexpected width');
    assert.equal(png.readUInt32BE(20),size,entry+' has an unexpected height');
  }
}

const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
assert.ok(sdk,'Android SDK path is not available for APK inspection');
const buildTools=join(sdk,'build-tools');
const versions=execFileSync('find',[buildTools,'-mindepth','1','-maxdepth','1','-type','d'],{encoding:'utf8'}).trim().split('\n').sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
assert.ok(versions[0],'Android build-tools are missing');
const badging=execFileSync(join(versions[0],'aapt'),['dump','badging',apk],{encoding:'utf8'});
assert.match(badging,/package: name='it\.inordine\.app'/);
assert.match(badging,/application:.*icon='[^']*ic_launcher/);
console.log('PASS APK icon: manifest, adaptive and round resources, all 15 mipmap PNGs, and exact original E.D.S. image bytes verified.');

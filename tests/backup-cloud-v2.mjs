import assert from 'node:assert/strict';
import {createBackupCloudService} from '../v2/backup-cloud.js';
import {createBackup,readBackupText} from '../v2/backup.js';
import {createEmptyState} from '../v2/state.js';

const state=createEmptyState();
const stamp=new Date('2026-10-25T12:00:00.000Z');
let saved;
const provider={
  async saveBackup(args){saved=args;return{id:'created-1',fileName:args.fileName,modifiedTime:stamp.toISOString(),verified:true}},
  async listBackups(){return[
    {id:'older',fileName:'InOrdine_Backup_old.json',modifiedTime:'2025-01-01T00:00:00.000Z'},
    {id:'newer',fileName:'InOrdine_Backup_new.json',modifiedTime:'2026-10-20T10:00:00.000Z'},
    {id:'invalid-date',modifiedTime:'not-a-date'}
  ]},
  async readBackup({id}){return{id,fileName:'InOrdine_Backup_cloud.json',modifiedTime:stamp.toISOString(),contents:JSON.stringify(await createBackup(state),null,2)}}
};
const service=createBackupCloudService({provider,createBackup,readBackupText,now:()=>stamp});
const result=await service.save(state);
assert.equal(result.verified,true);
assert.match(saved.fileName,/^InOrdine_Backup_2026-10-25T12-00-00-000Z\.json$/);
assert.equal((await service.findBackups())[0].id,'newer');
const downloaded=await service.readBackup('newer');
assert.equal(downloaded.state.version,2);
assert.equal(downloaded.contents.includes('"integrity"'),true);

const unverified=createBackupCloudService({provider:{...provider,saveBackup:async()=>({id:'x',verified:false})},createBackup,readBackupText});
await assert.rejects(()=>unverified.save(state),/CLOUD_UPLOAD_UNVERIFIED/);
const offline=createBackupCloudService({provider:{...provider,saveBackup:async()=>{throw Object.assign(new Error('NETWORK_UNAVAILABLE'),{code:'NETWORK_UNAVAILABLE'})}},createBackup,readBackupText});
await assert.rejects(()=>offline.save(state),/NETWORK_UNAVAILABLE/);
const corrupt=createBackupCloudService({provider:{...provider,readBackup:async()=>({contents:'{"broken":true}'})},createBackup,readBackupText});
await assert.rejects(()=>corrupt.readBackup('broken'));
console.log('PASS cloud backup orchestration: verified upload gate, backup listing/newest ordering, legacy-compatible validation, network errors, and corrupt cloud backup rejection (provider simulated; no live Google account used)');

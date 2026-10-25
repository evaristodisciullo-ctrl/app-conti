/**
 * Provider-neutral orchestration for cloud backup storage.
 * Providers (Android Drive today, a future iOS provider) must verify uploads
 * before reporting them as complete. Backup serialization remains owned by
 * backup.js, so the existing on-disk format is unchanged.
 */
export function createBackupCloudService({provider,createBackup,readBackupText,now=()=>new Date()}){
  if(!provider||typeof provider.saveBackup!=='function'||typeof provider.listBackups!=='function'||typeof provider.readBackup!=='function')throw new TypeError('A complete cloud backup provider is required');
  return {
    async save(state){
      const backup=await createBackup(state),contents=JSON.stringify(backup,null,2);
      const result=await provider.saveBackup({contents,fileName:`InOrdine_Backup_${now().toISOString().replace(/[:.]/g,'-')}.json`});
      if(result?.verified!==true||!result?.id)throw Object.assign(new Error('CLOUD_UPLOAD_UNVERIFIED'),{code:'CLOUD_UPLOAD_UNVERIFIED'});
      return {...result,verified:true};
    },
    async findBackups(){
      const items=await provider.listBackups();
      if(!Array.isArray(items))throw Object.assign(new Error('CLOUD_LIST_FAILED'),{code:'CLOUD_LIST_FAILED'});
      return items.filter(item=>item&&typeof item.id==='string'&&Number.isFinite(Date.parse(item.modifiedTime||'')))
        .sort((a,b)=>Date.parse(b.modifiedTime)-Date.parse(a.modifiedTime));
    },
    async readBackup(id){
      if(typeof id!=='string'||!id)throw Object.assign(new Error('CLOUD_FILE_INVALID'),{code:'CLOUD_FILE_INVALID'});
      const result=await provider.readBackup({id});
      if(typeof result?.contents!=='string')throw Object.assign(new Error('CLOUD_FILE_INVALID'),{code:'CLOUD_FILE_INVALID'});
      const state=await readBackupText(result.contents);
      return {state,contents:result.contents,modifiedTime:result.modifiedTime||null,fileName:result.fileName||''};
    }
  };
}

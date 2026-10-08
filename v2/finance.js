const toCents=value=>Math.round((Number(value)||0)*100);
const fromCents=cents=>cents/100;
const monthOf=item=>(item.date||'').slice(0,7);
const uniqueById=items=>{const seen=new Set();return items.filter(item=>{if(!item?.id||seen.has(item.id))return false;seen.add(item.id);return true})};
export const realBalance=state=>Number.isFinite(Number(state.balance))?Number(state.balance):0;
export const signedAmount=item=>item.kind==='income'?Number(item.amount||0):-Number(item.amount||0);
export function completedEntries(state){return uniqueById(state.history||[])}
export function pendingEntries(state){
 const completedIds=new Set(completedEntries(state).map(item=>item.id));
 return uniqueById(state.entries||[]).filter(item=>!completedIds.has(item.id));
}
export function financeTotals(state,kind,ym=null){
 const inMonth=item=>!ym||!item.date||monthOf(item)===ym;
 const pending=toCents(pendingEntries(state).filter(x=>x.kind===kind&&inMonth(x)).reduce((sum,x)=>sum+Number(x.amount||0),0));
 const done=toCents(completedEntries(state).filter(x=>x.kind===kind&&inMonth(x)).reduce((sum,x)=>sum+Number(x.amount||0),0));
 return {pending:fromCents(pending),done:fromCents(done),total:fromCents(pending+done)};
}
export function projectedBalance(state){
 return fromCents(toCents(realBalance(state))+pendingEntries(state).reduce((sum,item)=>sum+toCents(signedAmount(item)),0));
}
export function monthEndBalance(state,ym){
 const monthPending=pendingEntries(state).filter(item=>item.date&&monthOf(item)===ym);
 return fromCents(toCents(realBalance(state))+monthPending.reduce((sum,item)=>sum+toCents(signedAmount(item)),0));
}
export function markCompleted(state,id,completedAt=new Date().toISOString()){
 if(completedEntries(state).some(item=>item.id===id))return null;
 const item=(state.entries||[]).find(value=>value.id===id);
 if(!item)return null;
 state.entries=state.entries.filter(value=>value.id!==id);
 item.completedAt=completedAt;
 state.history=[item,...(state.history||[]).filter(value=>value.id!==id)];
 state.balance=fromCents(toCents(realBalance(state))+toCents(signedAmount(item)));
 return item;
}
export function undoCompletion(state,id){
 const item=completedEntries(state).find(value=>value.id===id);
 if(!item)return null;
 state.history=state.history.filter(value=>value.id!==id);
 state.entries=uniqueById([item,...(state.entries||[]).filter(value=>value.id!==id)]);
 delete item.completedAt;
 state.balance=fromCents(toCents(realBalance(state))-toCents(signedAmount(item)));
 return item;
}
export function deleteMoneyRecord(state,id){
 const pending=(state.entries||[]).some(value=>value.id===id);
 const completed=completedEntries(state).find(value=>value.id===id);
 if(completed)state.balance=fromCents(toCents(realBalance(state))-toCents(signedAmount(completed)));
 state.entries=(state.entries||[]).filter(value=>value.id!==id);
 state.history=(state.history||[]).filter(value=>value.id!==id);
 return Boolean(completed||pending);
}
export function adjustCompletedAmount(state,oldSigned,newSigned){
 state.balance=fromCents(toCents(realBalance(state))+toCents(newSigned)-toCents(oldSigned));
 return state.balance;
}

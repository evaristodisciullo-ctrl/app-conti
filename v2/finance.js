const toCents=value=>Math.round((Number(value)||0)*100);
const fromCents=cents=>cents/100;
import {matchesMonth,dateFields} from './date-values.js';
import {generateOccurrenceDates, occurrencesInMonth, recurrenceRuleForItem} from './recurrence.js';
const uniqueById=items=>{const seen=new Set();return items.filter(item=>{if(!item?.id||seen.has(item.id))return false;seen.add(item.id);return true})};
export const realBalance=state=>Number.isFinite(Number(state.balance))?Number(state.balance):0;
export const signedAmount=item=>item.kind==='income'?Number(item.amount||0):-Number(item.amount||0);
export function completedEntries(state){return uniqueById(state.history||[])}
function financeRecurrenceRule(item,count){
 const rule=recurrenceRuleForItem(item,count);
 if(!item?.recurrenceRule&&rule&&['monthly','yearly','daily','weekly'].includes(item?.recurrence))return {...rule,end:'never'};
 return rule;
}
function recurrenceSeries(state){
 const groups=new Map();
 for(const item of [...(state.entries||[]),...(state.history||[])]){
  const series=item.seriesId||item.recurrenceSource||((item.recurrenceRule||item.recurrence&&item.recurrence!=='none')?item.id:null);
  if(!series)continue;
  const rows=groups.get(series)||[];rows.push(item);groups.set(series,rows);
 }
 return groups;
}
export function recurringFinanceEntriesForMonth(state,kind,ym){
 const out=[];
 for(const [series,rows] of recurrenceSeries(state)){
  const root=rows.find(item=>item.id===series)||[...rows].sort((a,b)=>(a.occurrenceIndex??0)-(b.occurrenceIndex??0))[0];
  const rule=financeRecurrenceRule(root,rows.length);
  if(!rule||rule.end!=='never')continue;
  const precision=root.datePrecision||(root.date?.length===7?'month':root.date?.length===10?'day':'none');
  for(const occurrence of occurrencesInMonth(root.date,precision,rule,ym)){
   if(rows.some(item=>item.occurrenceIndex===occurrence.index))continue;
   const virtual={...root,id:`forecast:${series}:${occurrence.index}`,date:occurrence.date,datePrecision:precision,seriesId:series,recurrenceSource:series,recurrenceRule:rule,occurrenceIndex:occurrence.index,virtualRecurrence:true};delete virtual.completedAt;delete virtual._done;out.push(virtual);
  }
 }
 return out.filter(item=>item.kind===kind);
}
export function financeEntriesForMonth(state,kind,ym){
 const inMonth=item=>item.kind===kind&&matchesMonth(item,ym);
 return uniqueById([
  ...pendingEntries(state).filter(inMonth),
  ...recurringFinanceEntriesForMonth(state,kind,ym)
 ]);
}
export function pendingEntries(state){
 const completedIds=new Set(completedEntries(state).map(item=>item.id));
 return uniqueById(state.entries||[]).filter(item=>!completedIds.has(item.id));
}
export function financeTotals(state,kind,ym=null){
 const inMonth=item=>{if(!ym)return true;const fields=dateFields(item);return Boolean(fields.month)&&matchesMonth(item,ym)};
 const pendingItems=ym?financeEntriesForMonth(state,kind,ym):pendingEntries(state).filter(x=>x.kind===kind);
 const pending=toCents(pendingItems.filter(inMonth).reduce((sum,x)=>sum+Number(x.amount||0),0));
 const done=toCents(completedEntries(state).filter(x=>x.kind===kind&&inMonth(x)).reduce((sum,x)=>sum+Number(x.amount||0),0));
 return {pending:fromCents(pending),done:fromCents(done),total:fromCents(pending+done)};
}
export function projectedBalance(state){
 // Forecast is intentionally bounded: include every one-off pending item, and
 // only the next pending occurrence in each recurring series.
 const pending=pendingEntries(state).filter(item=>dateFields(item).precision!=='none'),oneOff=[],series=new Map();
 for(const item of pending){const key=item.seriesId||item.recurrenceSource;if(!key){oneOff.push(item);continue}const rows=series.get(key)||[];rows.push(item);series.set(key,rows)}
 const next=[...series.values()].map(rows=>rows.sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999')))[0]);
 return fromCents(toCents(realBalance(state))+[...oneOff,...next].reduce((sum,item)=>sum+toCents(signedAmount(item)),0));
}
function monthKeyForDate(value){
 const date=value instanceof Date?value:new Date(value);
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
function priorMonth(ym){
 const [year,month]=ym.split('-').map(Number),date=new Date(year,month-2,1);
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
function datedMonth(item){
 const fields=dateFields(item);
 // A year-only, month-only, or day-only value does not identify one
 // unambiguous month in the progressive ledger, so it cannot move a balance.
 if(!Number.isInteger(fields.year)||!Number.isInteger(fields.month))return null;
 if(fields.month<1||fields.month>12)return null;
 return `${fields.year}-${String(fields.month).padStart(2,'0')}`;
}
function forecastPendingEntries(state,throughMonth){
 const pending=pendingEntries(state),completed=completedEntries(state);
 const knownBySeries=new Map();
 for(const item of [...pending,...completed]){
  const series=item.seriesId||item.recurrenceSource;
  if(!series)continue;
  if(!knownBySeries.has(series))knownBySeries.set(series,new Map());
  if(Number.isInteger(item.occurrenceIndex))knownBySeries.get(series).set(item.occurrenceIndex,item);
 }
 const roots=new Map(),seriesGroups=recurrenceSeries({entries:[...pending,...completed],history:[]});
 for(const item of [...pending,...completed]){
  const series=item.seriesId||item.recurrenceSource;
  if(series&&(!roots.has(series)||item.id===series))roots.set(series,item);
 }
 const extras=[];
 for(const [series,root] of roots){
  const group=seriesGroups.get(series)||[root];
  const rule=financeRecurrenceRule(root,group.length);
  const precision=root.datePrecision||(root.date?.length===7?'month':root.date?.length===10?'day':'none');
  if(!rule||!['day','month'].includes(precision)||!/^\d{4}-\d{2}/.test(root.date||''))continue;
  const known=knownBySeries.get(series)||new Map();
  if(rule.end==='never'){
   let cursor=root.date.slice(0,7);
   while(cursor<=throughMonth){
    for(const occurrence of occurrencesInMonth(root.date,precision,rule,cursor))if(!known.has(occurrence.index)){const virtual={...root,id:`forecast:${series}:${occurrence.index}`,date:occurrence.date,datePrecision:precision,seriesId:series,recurrenceSource:series,recurrenceRule:rule,occurrenceIndex:occurrence.index};delete virtual.completedAt;delete virtual._done;extras.push(virtual)}
    const [year,month]=cursor.split('-').map(Number),next=new Date(Date.UTC(year,month,1,12));
    cursor=`${next.getUTCFullYear()}-${String(next.getUTCMonth()+1).padStart(2,'0')}`;
   }
  }
 }
 return [...pending,...extras].filter(item=>{
  const month=datedMonth(item);
  return month&&month<=throughMonth;
 });
}
/**
 * Forecast the balance from today's real-balance anchor. Completed records are
 * already reflected in state.balance by markCompleted; only still-open rows
 * move the forecast. Historical balances cannot be reconstructed because the
 * app has no dated balance snapshots, so past months deliberately return null.
 */
export function monthlyProjection(state,ym,asOf=new Date()){
 const anchorMonth=monthKeyForDate(asOf);
 const totals={
  receive:financeTotals(state,'income',ym).pending,
  pay:financeTotals(state,'expense',ym).pending
 };
 if(ym<anchorMonth)return {month:ym,anchorMonth,available:false,opening:null,ending:null,...totals};
 // Resolve missing recurrence rows on demand through the selected month. Existing
 // records take precedence, preserving per-occurrence edits and completion state.
 // Forecast rows are virtual and are never written to app storage.
 const allThrough=forecastPendingEntries(state,ym);
 const throughStart=ym===anchorMonth?[]:forecastPendingEntries(state,priorMonth(ym));
 const opening=toCents(realBalance(state))+throughStart.reduce((sum,item)=>sum+toCents(signedAmount(item)),0);
 const projectedEnd=toCents(realBalance(state))+allThrough.reduce((sum,item)=>sum+toCents(signedAmount(item)),0);
 return {month:ym,anchorMonth,available:true,opening:fromCents(opening),ending:fromCents(projectedEnd),...totals};
}
export function monthEndBalance(state,ym,asOf=new Date()){
 return monthlyProjection(state,ym,asOf).ending;
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

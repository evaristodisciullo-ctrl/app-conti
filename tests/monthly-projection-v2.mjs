import assert from 'node:assert/strict';
import {monthlyProjection} from '../v2/finance.js';
import {adjustCompletedAmount,deleteMoneyRecord,markCompleted,undoCompletion} from '../v2/finance.js';
import {loadState,saveState,stateStorageKey} from '../v2/state.js';

const asOf='2026-10-24T12:00:00Z';
const item=(id,kind,amount,date,extra={})=>({id,kind,amount,date,datePrecision:'day',...extra});
const blank=balance=>({balance,entries:[],history:[]});
const end=(state,month)=>monthlyProjection(state,month,asOf).ending;
const start=(state,month)=>monthlyProjection(state,month,asOf).opening;
const cases=[];
const test=(name,fn)=>cases.push([name,fn]);

test('single month uses exact cents and the real balance anchor',()=>{
 const state=blank(1000);
 state.entries=[item('oct-in','income',2000,'2026-10-10'),item('oct-out','expense',1500,'2026-10-20')];
 assert.equal(start(state,'2026-10'),1000);
 assert.equal(end(state,'2026-10'),1500);
});

test('progresses October to November to December to January 2027',()=>{
 const state=blank(1000);
 state.entries=[item('oct-in','income',2000,'2026-10-10'),item('oct-out','expense',1500,'2026-10-20'),item('nov-in','income',500,'2026-11-05'),item('nov-out','expense',200,'2026-11-10'),item('jan-in','income',1000,'2027-01-04'),item('jan-out','expense',300,'2027-01-08')];
 assert.deepEqual([end(state,'2026-10'),start(state,'2026-11'),end(state,'2026-11'),start(state,'2026-12'),end(state,'2026-12'),start(state,'2027-01'),end(state,'2027-01')],[1500,1500,1800,1800,1800,1800,2500]);
});

test('returning to October does not change data or calculated amounts',()=>{
 const state=blank(1000);state.entries=[item('a','income',200,'2026-10-01'),item('b','expense',25,'2026-12-01')];
 const before=JSON.stringify(state),oct=end(state,'2026-10');
 end(state,'2027-01');end(state,'2026-11');
 assert.equal(end(state,'2026-10'),oct);assert.equal(JSON.stringify(state),before);
});

test('completed income is already included in real balance, and pending income remains projected once',()=>{
 const state=blank(1500);state.history=[item('done-in','income',500,'2026-10-02',{completedAt:'2026-10-03T10:00:00Z'})];state.entries=[item('open-in','income',200,'2026-10-12')];
 const projection=monthlyProjection(state,'2026-10',asOf);
 assert.equal(projection.opening,1500);assert.equal(projection.ending,1700);assert.equal(projection.receive,200);
});

test('completed payment is already subtracted from real balance, pending payment is subtracted once',()=>{
 const state=blank(600);state.history=[item('done-out','expense',400,'2026-10-02',{completedAt:'2026-10-03T10:00:00Z'})];state.entries=[item('open-out','expense',100,'2026-10-12')];
 const projection=monthlyProjection(state,'2026-10',asOf);
 assert.equal(projection.ending,500);assert.equal(projection.pay,100);
});

test('pending and overdue operations carry forward while status totals stay specific to the selected month',()=>{
 const state=blank(100);state.entries=[item('late','income',25,'2026-09-28'),item('oct','expense',10,'2026-10-25'),item('nov','income',80,'2026-11-01')];
 const oct=monthlyProjection(state,'2026-10',asOf),nov=monthlyProjection(state,'2026-11',asOf);
 assert.equal(oct.ending,115);assert.equal(oct.receive,0);assert.equal(oct.pay,10);
 assert.equal(nov.opening,115);assert.equal(nov.ending,195);assert.equal(nov.receive,80);
});

test('recurrence projections preserve edited occurrences and do not recount completed ones',()=>{
 const state=blank(250);
 const rule={unit:'month',interval:1,end:'never',count:12,until:''};
 state.entries=[item('rent','income',100,'2026-10-10',{seriesId:'rent',occurrenceIndex:0,recurrenceRule:rule}),item('rent-nov','income',120,'2026-11-10',{seriesId:'rent',occurrenceIndex:1,recurrenceRule:rule})];
 state.history=[item('rent-dec','income',150,'2026-12-10',{seriesId:'rent',occurrenceIndex:2,recurrenceRule:rule,completedAt:'2026-12-10T10:00:00Z'})];
 const jan=monthlyProjection(state,'2027-01',asOf);
 assert.equal(jan.opening,470);assert.equal(jan.ending,570);assert.equal(jan.receive,0);
 assert.equal(JSON.stringify(state).includes('forecast:rent:3'),false);
});

test('weekly, annual, and custom recurring occurrences use their saved dates and amounts',()=>{
 const state=blank(10);
 state.entries=[
  item('weekly-0','expense',3,'2026-10-01',{seriesId:'weekly',occurrenceIndex:0,recurrenceRule:{unit:'week',interval:1,end:'count',count:3}}),
  item('weekly-1','expense',4,'2026-10-08',{seriesId:'weekly',occurrenceIndex:1,recurrenceRule:{unit:'week',interval:1,end:'count',count:3}}),
  item('annual-0','income',80,'2026-10-12',{seriesId:'annual',occurrenceIndex:0,recurrenceRule:{unit:'year',interval:1,end:'count',count:2}}),
  item('annual-1','income',90,'2027-10-12',{seriesId:'annual',occurrenceIndex:1,recurrenceRule:{unit:'year',interval:1,end:'count',count:2}}),
  item('custom-0','income',20,'2026-10-15',{seriesId:'custom',occurrenceIndex:0,recurrenceRule:{unit:'month',interval:2,end:'count',count:3}}),
  item('custom-1','income',30,'2026-12-15',{seriesId:'custom',occurrenceIndex:1,recurrenceRule:{unit:'month',interval:2,end:'count',count:3}})
 ];
 assert.equal(end(state,'2026-10'),103);
 assert.equal(start(state,'2026-11'),103);
 assert.equal(end(state,'2026-12'),133);
 assert.equal(end(state,'2027-10'),223);
});

test('editing and deleting a completed operation adjust the anchor; deleting pending removes forecast',()=>{
 const state=blank(950);const done=item('done','expense',50,'2026-10-05');state.history=[done];state.entries=[item('pending','income',75,'2026-10-10')];
 done.amount=70;adjustCompletedAmount(state,-50,-70);assert.equal(state.balance,930);assert.equal(end(state,'2026-10'),1005);
 assert.equal(deleteMoneyRecord(state,'done'),true);assert.equal(state.balance,1000);assert.equal(end(state,'2026-10'),1075);
 assert.equal(deleteMoneyRecord(state,'pending'),true);assert.equal(end(state,'2026-10'),1000);
});

test('overdue, negative amounts, and negative opening balances retain signed arithmetic',()=>{
 const state=blank(-50);state.entries=[item('negative-income','income',-10,'2026-09-01'),item('negative-expense','expense',-5,'2026-10-02')];
 assert.equal(end(state,'2026-10'),-55);
});

test('months without movements retain the previous forecast and year boundaries are stable',()=>{
 const state=blank(12.34);state.entries=[item('dec','income',10,'2026-12-31'),item('jan','expense',2.34,'2027-01-01')];
 assert.equal(end(state,'2026-11'),12.34);assert.equal(start(state,'2026-12'),12.34);
 assert.equal(end(state,'2026-12'),22.34);assert.equal(start(state,'2027-01'),22.34);assert.equal(end(state,'2027-01'),20);
});

test('past months are reported as unavailable when no dated balance snapshot exists',()=>{
 const projection=monthlyProjection(blank(500),'2026-09',asOf);
 assert.equal(projection.available,false);assert.equal(projection.opening,null);assert.equal(projection.ending,null);
});

test('marking and undoing completion moves the same amount between forecast and real balance',()=>{
 const state=blank(100);state.entries=[item('mark','income',20,'2026-10-11')];
 assert.equal(end(state,'2026-10'),120);markCompleted(state,'mark','2026-10-12T12:00:00Z');
 assert.equal(state.balance,120);assert.equal(end(state,'2026-10'),120);
 undoCompletion(state,'mark');assert.equal(state.balance,100);assert.equal(end(state,'2026-10'),120);
});

test('saved state survives app restart without changing balance or projected results',async()=>{
 const data=new Map();globalThis.localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
 const state=blank(725.55);state.entries=[item('persist-in','income',40.45,'2026-11-02')];
 await saveState(state);const reopened=await loadState();
 assert.equal(data.has(stateStorageKey),true);assert.equal(reopened.balance,725.55);assert.equal(end(reopened,'2026-11'),766);
});

for(const [name,run] of cases){await run();console.log(`PASS ${name}`)}
console.log(`Monthly projection tests passed: ${cases.length}`);

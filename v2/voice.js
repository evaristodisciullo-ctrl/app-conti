const SMALL=new Map(Object.entries({zero:0,uno:1,una:1,un:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,trenta:30,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90}));
const MONTHS=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
function wordNumber(word){
 if(SMALL.has(word))return SMALL.get(word);
 for(const [prefix,value] of [['mille',1000],['novecento',900],['ottocento',800],['settecento',700],['seicento',600],['cinquecento',500],['quattrocento',400],['trecento',300],['duecento',200],['cento',100]]){
  if(word.startsWith(prefix)){const rest=word.slice(prefix.length);return value+(rest?wordNumber(rest)||0:0)}
 }
 for(const [prefix,value] of [['novanta',90],['ottanta',80],['settanta',70],['sessanta',60],['cinquanta',50],['quaranta',40],['trenta',30],['venti',20]]){
  if(word.startsWith(prefix)){let rest=word.slice(prefix.length);if(!rest)return value;if(rest.startsWith('otto'))rest='otto';if(rest.startsWith('uno'))rest='uno';if(rest.startsWith('una'))rest='una';const unit=SMALL.get(rest);return unit!==undefined&&unit<10?value+unit:null}
 }
 return null;
}
export function parseItalianAmount(text){
 let value=String(text||'').trim().toLowerCase().replace(/euro|eur|€|cent(esimi)?/g,'').trim();
 if(!value)return null;
 if(/\d/.test(value)){
  value=value.replace(/\s/g,'');
  if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value))value=value.replaceAll('.','').replace(',','.');
  else if(/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(value))value=value.replaceAll(',','');
  else if(value.includes(',')&&!value.includes('.'))value=value.replace(',','.');
  else if(value.includes('.')&&/^\d{1,3}\.\d{3}$/.test(value))value=value.replace('.','');
  const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;
 }
 const tokens=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/[\s-]+/).filter(x=>x&&x!=='e');
 if(!tokens.length)return null;
 let total=0,group=0;
 for(const token of tokens){
  if(token==='mille'||token==='mila'){total+=(group||1)*1000;group=0;continue}
  if(token==='cento'){group=(group||1)*100;continue}
  const n=wordNumber(token);if(n===null)return null;
  group+=n;
 }
 const result=total+group;
 return Number.isFinite(result)?result:null;
}
function spokenParts(text){
 const source=String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[,]/g,' ').replace(/\bdel\b|\bdi\b|\bil\b|\banno\b/g,' ').replace(/\s+/g,' ').trim();
 const month=MONTHS.findIndex(m=>source.includes(m))+1;
 const yearMatch=source.match(/\b(?:19|20)\d{2}\b/);
 const year=yearMatch?yearMatch[0]:'';
 const cleaned=source.replace(/\b(?:19|20)\d{2}\b/g,' ').replace(/gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre/g,' ').replace(/\s+/g,' ').trim();
 const dayMatch=cleaned.match(/\b([1-9]|[12]\d|3[01])\b/);
 let day=dayMatch?String(Number(dayMatch[1])).padStart(2,'0'):'';
 if(!day&&cleaned){const n=wordNumber(cleaned.replace(/\s+/g,''));if(n>=1&&n<=31)day=String(n).padStart(2,'0')}
 return {day,month:month?String(month).padStart(2,'0'):'',year};
}
export function parseItalianDate(text,mode){
 const source=String(text||'').trim();
 const iso=source.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
 const slash=source.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/);
 const p=spokenParts(source);
 if(iso){p.year=iso[1];p.month=iso[2];p.day=iso[3]}
 if(slash){p.day=String(Number(slash[1])).padStart(2,'0');p.month=String(Number(slash[2])).padStart(2,'0');p.year=slash[3]}
 if(mode==='day'&&p.day&&p.month&&p.year)return {suffix:'Date',value:`${p.year}-${p.month}-${p.day}`};
 if(mode==='dayOnly'&&p.day)return {suffix:'DayPart',value:String(Number(p.day))};
 if(mode==='monthOnly'&&p.month)return {suffix:'MonthPart',value:p.month};
 if(mode==='year'&&p.year)return {suffix:'YearPart',value:p.year};
 if(mode==='dayMonth'&&p.day&&p.month)return {suffixes:['DayMonthMonth','DayMonthPart'],values:[p.month,String(Number(p.day))]};
 if(mode==='month'&&p.year&&p.month)return {suffix:'Month',value:`${p.year}-${p.month}`};
 return null;
}

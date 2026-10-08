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
 let value=String(text||'').trim().toLowerCase().replace(/euro|eur|€|centesimi?/g,'').trim();
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
 if(mode==='day'&&p.day&&p.month&&p.year){const date=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),12));if(date.getUTCFullYear()!==Number(p.year)||date.getUTCMonth()!==Number(p.month)-1||date.getUTCDate()!==Number(p.day))return null;return {suffix:'Date',value:`${p.year}-${p.month}-${p.day}`}}
 if(mode==='dayOnly'&&p.day)return {suffix:'DayPart',value:String(Number(p.day))};
 if(mode==='monthOnly'&&p.month)return {suffix:'MonthPart',value:p.month};
 if(mode==='year'&&p.year)return {suffix:'YearPart',value:p.year};
 if(mode==='dayMonth'&&p.day&&p.month&&Number(p.day)<=new Date(Date.UTC(2000,Number(p.month),0)).getUTCDate())return {suffixes:['DayMonthMonth','DayMonthPart'],values:[p.month,String(Number(p.day))]};
 if(mode==='month'&&p.year&&p.month)return {suffix:'Month',value:`${p.year}-${p.month}`};
 return null;
}

export function parseItalianRecurrence(text){
 const source=String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const match=source.match(/\b(?:ogni|tutti\s+(?:i|le))\s+(?:(\d+)\s+)?(giorn[oi]|settiman[ae]|mes[ei]|ann[oi])\b/);
 if(!match)return null;
 const unit=/giorn/.test(match[2])?'day':/settiman/.test(match[2])?'week':/mes/.test(match[2])?'month':'year';
 return {unit,interval:Math.max(1,Number(match[1]||1)),end:'never'};
}
export function parseItalianTime(text){
 const match=String(text||'').toLowerCase().match(/\b(?:alle\s*(\d{1,2})|([01]?\d|2[0-3])[:.]([0-5]\d))\b/);
 if(!match){
  const words=String(text||'').toLowerCase().match(/\balle\s+([a-zà-ù]+)(?:\s+e\s+([a-zà-ù]+))?\b/i);
  if(!words)return null;
  const hour=parseItalianAmount(words[1]),minute=words[2]?parseItalianAmount(words[2]):0;
  if(!Number.isInteger(hour)||hour>23||!Number.isInteger(minute)||minute>59)return null;
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
 }
 const hour=Number(match[1]||match[2]),minute=Number(match[3]||0);
 if(hour>23||minute>59)return null;
 return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}
function parseVoiceDate(text,recurrence){
 const source=String(text||'').trim();
 const complete=parseItalianDate(source,'day');
 if(complete)return {date:complete.value,datePrecision:'day'};
 const partial=parseItalianDate(source,'dayMonth');
 if(partial){
  const month=partial.values[0],day=String(partial.values[1]).padStart(2,'0');
  if(recurrence)return {date:`${new Date().getFullYear()}-${month}-${day}`,datePrecision:'day'};
  return {date:`${month}-${day}`,datePrecision:'dayMonth'};
 }
 const month=parseItalianDate(source,'month');
 if(month)return {date:month.value,datePrecision:'month'};
 const year=parseItalianDate(source,'year');
 if(year)return {date:year.value,datePrecision:'year'};
 const lower=source.toLowerCase();
 if(/\boggi\b|\bdomani\b/.test(lower)){
  const date=new Date();if(/\bdomani\b/.test(lower))date.setDate(date.getDate()+1);
  return {date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,datePrecision:'day'};
 }
 return {date:'',datePrecision:'none'};
}
export function parseItalianVoiceEntry(text,{kind='income'}={}){
 const source=String(text||'').trim();
 if(!source)return {fields:{},missing:['description','amount'],transcript:''};
 const recurrenceRule=parseItalianRecurrence(source);
 const amountPattern=/(?:\b\d[\d.,]*(?:\s*euro)?\b|\b(?:mille|cento|duecento|trecento|quattrocento|cinquecento|seicento|settecento|ottocento|novecento|venti|trenta|quaranta|cinquanta|sessanta|settanta|ottanta|novanta|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|diciassette|diciotto|diciannove)(?:[ -]+[a-zà-ù]+)*\s*(?:euro)?\b)/gi;
 const monthRegex=new RegExp(`\\b(?:[1-9]|[12]\\d|3[01])\\s+(?:${MONTHS.join('|')})(?:\\s+(?:19|20)\\d{2})?\\b`,'i');
 const fullNumeric=source.match(/\b\d{1,2}[/.]\d{1,2}[/.]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/);
 const monthYear=new RegExp(`\\b(?:${MONTHS.join('|')})\\s+(?:19|20)\\d{2}\\b`,'i');
 const dateMatch=source.match(monthRegex)||source.match(fullNumeric)||source.match(monthYear)||source.match(/\b(?:oggi|domani)\b/i);
 const datePhrase=dateMatch?.[0]||'';
 const dateStart=dateMatch?.index??-1,dateEnd=dateStart+(datePhrase.length||0);
 const amountMatch=kind==='todo'?null:[...source.matchAll(amountPattern)].find(match=>{
  const start=match.index,end=start+match[0].length;
  return !(dateStart>=0&&start<dateEnd&&end>dateStart)&&!(/\balle\s*$/i.test(source.slice(Math.max(0,start-8),start)));
 })||null;
 const amount=amountMatch?parseItalianAmount(amountMatch[0]):null;
 const dateFields=datePhrase?parseVoiceDate(datePhrase,recurrenceRule):{date:'',datePrecision:'none'};
 const time=parseItalianTime(source);
 let description=source;
 if(amountMatch)description=description.replace(amountMatch[0],' ');
 if(datePhrase)description=description.replace(datePhrase,' ');
 if(recurrenceRule)description=description.replace(/\b(?:ogni|tutti\s+(?:i|le))\s+(?:\d+\s+)?(?:giorn[oi]|settiman[ae]|mes[ei]|ann[oi])\b/i,' ');
 if(time)description=description.replace(/\balle\s+(?:\d{1,2}(?:[:.]\d{2})?|[a-zà-ù]+(?:\s+e\s+[a-zà-ù]+)?)\b/i,' ').replace(/\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b/i,' ');
 const categoryMatch=description.match(/\b(?:categoria|per categoria)\s+(.+?)(?=\s+(?:da|presso|alle)\b|$)/i);
 const supplierMatch=description.match(/\b(?:da|presso)\s+(.+?)(?=\s+(?:categoria|per categoria)\b|$)/i);
 const category=categoryMatch?.[1]?.trim()||'',supplier=supplierMatch?.[1]?.trim()||'';
 if(categoryMatch)description=description.replace(categoryMatch[0],' ');
 if(supplierMatch)description=description.replace(supplierMatch[0],' ');
 description=description.replace(/\b(?:euro|€)\b/gi,' ').replace(/[,:;]+/g,' ').replace(/\s+\b(?:il|lo|la|alle|per|di|da)\s*$/i,' ').replace(/\s+/g,' ').trim();
 const fields={description,amount,date:dateFields.date,datePrecision:dateFields.datePrecision,category,supplier,time,recurrenceRule,recurrence:recurrenceRule?({day:'daily',week:'weekly',month:'monthly',year:'yearly'}[recurrenceRule.unit]||'none'):'none',kind};
 const missing=[];if(!description)missing.push('description');if(!(Number.isFinite(amount)&&amount>0)&&kind!=='todo')missing.push('amount');
 return {fields,missing,transcript:source};
}

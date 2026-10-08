const SMALL=new Map(Object.entries({zero:0,uno:1,una:1,un:1,primo:1,prima:1,secondo:2,seconda:2,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,trenta:30,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90}));
const MONTHS=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const WEEKDAYS=['domenica','lunedi','martedi','mercoledi','giovedi','venerdi','sabato'];
const fold=value=>String(value||'').toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,"'");

function wordNumber(word){
 const w=fold(word).replace(/[-\s]/g,'');
 if(SMALL.has(w))return SMALL.get(w);
 for(const [prefix,value] of [['duemila',2000],['tremila',3000],['quattromila',4000],['cinquemila',5000],['seimila',6000],['settemila',7000],['ottomila',8000],['novemila',9000],['mille',1000]])if(w.startsWith(prefix)){const rest=w.slice(prefix.length);return value+(rest?wordNumber(rest)||0:0)}
 if(w==='mila')return 1000;
 for(const [prefix,value] of [['novecento',900],['ottocento',800],['settecento',700],['seicento',600],['cinquecento',500],['quattrocento',400],['trecento',300],['duecento',200],['cento',100]])if(w.startsWith(prefix)){const rest=w.slice(prefix.length);return value+(rest?wordNumber(rest)||0:0)}
 for(const [prefix,value] of [['novanta',90],['ottanta',80],['settanta',70],['sessanta',60],['cinquanta',50],['quaranta',40],['trenta',30],['venti',20]])if(w.startsWith(prefix)){const rest=w.slice(prefix.length);if(!rest)return value;const unit=SMALL.get(rest);return unit!==undefined&&unit<10?value+unit:null}
 return null;
}
function integerWords(value){
 const tokens=fold(value).split(/[\s-]+/).filter(x=>x&&x!=='e');if(!tokens.length)return null;
 let total=0,group=0;
 for(const token of tokens){
  if(token==='mille'||token==='mila'){total+=(group||1)*1000;group=0;continue}
  const n=wordNumber(token);if(n===null)return null;
  group+=n;
 }
 return total+group;
}
function decimalNumber(value){
 const raw=String(value||'').trim();if(!raw)return null;if(!/\d/.test(raw))return integerWords(raw);
 const s=raw.replace(/\s+/g,'');
 let n=s;
 if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(n))n=n.replaceAll('.','').replace(',','.');
 else if(/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(n))n=n.replaceAll(',','');
 else if(n.includes(',')&&!n.includes('.'))n=n.replace(',','.');
 else if(/^\d{1,3}\.\d{3}$/.test(n))n=n.replace('.','');
 const result=Number(n);return Number.isFinite(result)?result:null;
}
export function parseItalianAmount(text){
 const source=fold(text).replace(/\b(?:euro|eur)\b|€/g,' ').trim();if(!source)return null;
 const cents=/\bcentesimi?\b/.test(source);const withoutCents=source.replace(/\bcentesimi?\b/g,' ').trim();
 const decimalMatch=withoutCents.match(/^(.*?)\s+virgola\s+([\wà-ù]+)$/u);
 if(decimalMatch){const whole=decimalNumber(decimalMatch[1]),fraction=decimalNumber(decimalMatch[2]);if(whole!==null&&fraction!==null)return whole+fraction/(fraction<10?10:100)}
 const centsMatch=withoutCents.match(/^(.*?)\s+e\s+([\wà-ù]+)$/u);
 if(centsMatch&&(cents||/\beuro\b|€/.test(fold(text)))){const whole=decimalNumber(centsMatch[1]),fraction=decimalNumber(centsMatch[2]);if(whole!==null&&fraction!==null&&fraction<100)return whole+fraction/100}
 const parsed=decimalNumber(withoutCents);
 if(parsed!==null)return cents?parsed/100:parsed;
 return null;
}

function validYmd(year,month,day){const d=new Date(year,month-1,day,12);return d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()===day}
function isoLocal(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function dateForWeekday(dayIndex,now=new Date(),forceNext=false){const date=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);const delta=(dayIndex-date.getDay()+7)%7;date.setDate(date.getDate()+(forceNext?(delta||7):delta));return date}
function nextMonthlyDate(day,now=new Date(),monthHint=null){
 for(let offset=0;offset<15;offset++){const first=new Date(now.getFullYear(),now.getMonth()+offset,1,12);if(monthHint&&first.getMonth()+1!==monthHint)continue;const year=first.getFullYear(),month=first.getMonth()+1;if(validYmd(year,month,day)){const candidate=new Date(year,month-1,day,12);const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);if(candidate>=today)return candidate}}
 return null;
}
function parseSpokenDay(text){const value=String(text||'').trim().replace(/^(?:il|giorno)\s+/i,'');const direct=Number(value);if(Number.isInteger(direct)&&direct>=1&&direct<=31)return direct;const n=parseItalianAmount(value);return Number.isInteger(n)&&n>=1&&n<=31?n:null}
function monthIndex(value){const i=MONTHS.indexOf(fold(value));return i<0?null:i+1}
function findDatePhrase(text){
 const source=String(text||'');let normalized='',map=[];for(let i=0;i<source.length;i++){const part=fold(source[i]);for(let j=0;j<part.length;j++)map.push(i);normalized+=part}const patterns=[
  /\b\d{4}-\d{2}-\d{2}\b/i,
  /\b\d{1,2}[/.]\d{1,2}[/.]\d{4}\b/i,
  /\b(?:dopodomani|domani|oggi)\b/i,
  new RegExp(`\\b(?:il\\s+)?(?:giorno\\s+)?(\\d{1,2}|primo|prima|uno|una|un|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti(?:uno|due|tre|quattro|cinque|sei|sette|otto|nove)?|trenta(?:uno)?|[a-zà-ù]+)\\s+(?:di\\s+)?(${MONTHS.join('|')})(?:\\s+(?:19|20)\\d{2})?\\b`,'i'),
  new RegExp(`\\b(?:${MONTHS.join('|')})\\s+(?:19|20)\\d{2}\\b`,'i'),
  /\b(?:19|20)\d{2}\b/i,
  /\b(?:luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)(?:\s+(?:prossim[oa]|successiv[oa]))?\b/i,
  /\b(?:il\s+)?(?:giorno\s+)?(?:primo|prima|[1-9]|[12]\d|3[01]|uno|una|un|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti(?:uno|due|tre|quattro|cinque|sei|sette|otto|nove)?|trenta(?:uno)?)(?:\s+(?:del\s+mese|di\s+ogni\s+mese))?\b/i,
  new RegExp(`\\b(?:${MONTHS.join('|')})\\b`,'i')
 ];
 for(const regex of patterns){const match=regex.exec(normalized);if(match){const index=map[match.index],end=map[match.index+match[0].length-1]+1;return {text:source.slice(index,end),index}}}
 return null;
}
function datePartsFromPhrase(phrase,{recurrenceRule=null,now=new Date()}={}){
 const source=String(phrase||'').trim(),lower=fold(source);let m;
 if(/^\d{4}$/.test(source))return {date:source,datePrecision:'year'};
 if((m=source.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))){const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);return validYmd(y,mo,d)?{date:m[0],datePrecision:'day'}:null}
 if((m=source.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/))){const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]);return validYmd(y,mo,d)?{date:`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`,datePrecision:'day'}:null}
 if(/\bdopodomani\b/.test(lower)){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+2,12);return {date:isoLocal(d),datePrecision:'day'}}
 if(/\bdomani\b/.test(lower)){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,12);return {date:isoLocal(d),datePrecision:'day'}}
 if(/\boggi\b/.test(lower)){return {date:isoLocal(now),datePrecision:'day'}}
 const weekdayMatch=lower.match(/(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)(?:\s+(prossim[oa]|successiv[oa]))?/);
 if(weekdayMatch){const idx=WEEKDAYS.indexOf(weekdayMatch[1]);const d=dateForWeekday(idx,now,Boolean(weekdayMatch[2]));return {date:isoLocal(d),datePrecision:'day'}}
 const fullDayMonth=source.match(/(?:il\s+)?(?:giorno\s+)?(\d{1,2}|[a-zà-ù]+(?:[ -][a-zà-ù]+){0,2})\s+(?:di\s+)?(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+((?:19|20)\d{2}))?/i);
 if(fullDayMonth){const day=parseSpokenDay(fullDayMonth[1]),month=monthIndex(fullDayMonth[2]),year=Number(fullDayMonth[3]||0);if(!day||!month)return null;if(year)return validYmd(year,month,day)?{date:`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,datePrecision:'day'}:null;if(recurrenceRule){const candidate=nextMonthlyDate(day,now,recurrenceRule.unit==='year'?month:null);if(candidate)return {date:isoLocal(candidate),datePrecision:'day'}}return {date:`${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,datePrecision:'dayMonth'}}
 const monthYear=source.match(/(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+((?:19|20)\d{2})/i);
 if(monthYear)return {date:`${monthYear[2]}-${String(monthIndex(monthYear[1])).padStart(2,'0')}`,datePrecision:'month'};
 const monthOnly=MONTHS.find(name=>new RegExp(`\\b${name}\\b`,'i').test(source));if(monthOnly){const month=monthIndex(monthOnly);return recurrenceRule?.unit==='year'?{date:`${now.getFullYear()}-${String(month).padStart(2,'0')}`,datePrecision:'month'}:{date:String(month).padStart(2,'0'),datePrecision:'monthOnly'}}
 const dayMatch=source.match(/(?:il\s+)?(?:giorno\s+)?(primo|prima|\d{1,2}|[a-zà-ù]+(?:[ -][a-zà-ù]+){0,2})(?:\s+(?:del\s+mese|di\s+ogni\s+mese))?/i);
 if(dayMatch){const day=parseSpokenDay(dayMatch[1]);if(day){if(recurrenceRule?.unit==='month'){const date=nextMonthlyDate(day,now);return date?{date:isoLocal(date),datePrecision:'day'}:null}return {date:String(day).padStart(2,'0'),datePrecision:'dayOnly'}}}
 return null;
}
export function parseItalianDate(text,mode,now=new Date()){
 const found=findDatePhrase(String(text||''));if(!found)return null;
 const parsed=datePartsFromPhrase(found.text,{now});if(!parsed)return null;
 if(mode==='day'&&parsed.datePrecision==='day')return {suffix:'Date',value:parsed.date};
 if(mode==='dayOnly'&&parsed.datePrecision==='dayOnly')return {suffix:'DayPart',value:String(Number(parsed.date))};
 if(mode==='monthOnly'&&parsed.datePrecision==='monthOnly')return {suffix:'MonthPart',value:parsed.date};
 if(mode==='year'&&/^\d{4}$/.test(found.text))return {suffix:'YearPart',value:found.text};
 if(mode==='dayMonth'&&parsed.datePrecision==='dayMonth'){const [month,day]=parsed.date.split('-');return {suffixes:['DayMonthMonth','DayMonthPart'],values:[month,String(Number(day))]}}
 if(mode==='month'&&parsed.datePrecision==='month')return {suffix:'Month',value:parsed.date};
 return null;
}

function parseRecurrenceDetails(text){
 const source=String(text||'');const lower=fold(source);
 const weekdays='(?:lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)';
 const ordinal=lower.match(/\bogni\s+(?:primo|prima|1°|1)\s+(?:del\s+)?mese\b/i);
 const numberWord='(?:zero|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti(?:uno|due|tre|quattro|cinque|sei|sette|otto|nove)?|trenta(?:uno)?|quaranta|cinquanta|sessanta|settanta|ottanta|novanta|cento)';
 let match=lower.match(new RegExp(`\\b(?:ogni|tutti\\s+(?:i|le)|tutte\\s+le)\\s+((?:\\d+|${numberWord}(?:\\s+(?:e\\s+)?${numberWord}){0,2})\\s+)?(giorno|giorni|settimana|settimane|mese|mesi|anno|anni|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\\b`,'i'));
 let unit=null,interval=1,pattern='';
 if(ordinal){unit='month';pattern=ordinal[0]}
 else if(match){pattern=match[0];const count=match[1]?.trim();const term=match[2];if(count){const value=parseItalianAmount(count);if(Number.isInteger(value)&&value>0&&value<=365)interval=value;else interval=1}unit=/giorn/.test(term)?'day':/settim|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica/.test(term)?'week':/mes/.test(term)?'month':'year';}
 else {
  const adjective=lower.match(/\b(?:quotidianamente|giornalmente|settimanale|settimanalmente|mensile|mensilmente|bimestrale|trimestrale|semestrale|annuale|annualmente|una\s+volta\s+(?:al|ogni)\s+(?:giorno|settimana|mese|anno))\b/i);
  if(adjective){pattern=adjective[0];unit=/giorn|quotidian/.test(pattern)?'day':/settiman/.test(pattern)?'week':/mensil|bimestral|trimestral|semestral/.test(pattern)?'month':'year';if(/bimestral/.test(pattern))interval=2;else if(/trimestral/.test(pattern))interval=3;else if(/semestral/.test(pattern))interval=6}
 }
 if(!unit)return null;
 return {unit,interval,end:'never',source:pattern,weekday:/\b(?:lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/.test(pattern)?pattern.match(new RegExp(weekdays,'i'))?.[0]||'':''};
}
export function parseItalianRecurrence(text){const result=parseRecurrenceDetails(text);return result?{unit:result.unit,interval:result.interval,end:result.end}:null}

export function parseItalianTime(text){
 const source=fold(text);let match=source.match(/\balle\s+(\d{1,2})\s+e\s+(\d{1,2}|mezza|un quarto)\b/);if(match){const hour=Number(match[1]),minute=match[2]==='mezza'?30:match[2]==='un quarto'?15:Number(match[2]);if(hour<=23&&minute<=59)return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`}
 match=source.match(/\b(?:alle\s*(\d{1,2})(?:[:.]([0-5]\d))?|([01]?\d|2[0-3])[:.]([0-5]\d))\b/);
 if(match){const hour=Number(match[1]||match[3]),minute=Number(match[2]||match[4]||0);if(hour>23||minute>59)return null;return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`}
 match=source.match(/\balle\s+(un quarto|mezza|(?:[a-z]+)(?:\s+e\s+(?:un quarto|mezza|[a-z]+))?)\b/);
 if(!match)return null;const parts=match[1].split(/\s+e\s+/),hour=parseItalianAmount(parts[0]);let minute=parts[1]?parts[1]==='mezza'?30:parts[1]==='un quarto'?15:parseItalianAmount(parts[1]):0;
 if(parts.length===1&&parts[0]==='mezza')return '00:30';if(!Number.isInteger(hour)||hour>23||!Number.isInteger(minute)||minute>59)return null;return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}

function recurrenceInfo(text){
 const result=parseRecurrenceDetails(text);if(!result)return null;return {rule:{unit:result.unit,interval:result.interval,end:'never'},phrase:result.source,weekday:result.weekday};
}
function amountCandidates(text){
 const matches=[];const word='(?:mille|mila|cento|duecento|trecento|quattrocento|cinquecento|seicento|settecento|ottocento|novecento|venti|trenta|quaranta|cinquanta|sessanta|settanta|ottanta|novanta|uno|una|un|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|primo|prima)(?:[a-zà-ù-]+)*';
 const regex=new RegExp(`(?<![\\p{L}\\p{N}])(?:\\d{1,3}(?:[. ]\\d{3})+(?:,\\d{1,2})?|\\d+(?:[,.]\\d{1,2})?|${word}(?:\\s+(?:e\\s+)?${word}){0,5})(?:\\s*(?:euro|eur|€)(?:\\s+(?:e\\s+)?(?:\\d{1,2}|${word})\\s*(?:centesimi?)?)?)?(?![\\p{L}\\p{N}])`,'giu');
 for(const m of text.matchAll(regex)){const raw=m[0].trim();if(!raw||!/[\d]|\b(?:euro|eur|mille|cento|duecento|trecento|quattrocento|cinquecento|seicento|settecento|ottocento|novecento|venti|trenta|quaranta|cinquanta|sessanta|settanta|ottanta|novanta|uno|una|un|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove)\b/iu.test(raw))continue;const value=parseItalianAmount(raw);if(value!==null)matches.push({raw,index:m.index,end:m.index+m[0].length,value,hasCurrency:/euro|eur|€/i.test(raw)})}
 return matches;
}
function detectKind(text,fallback){const t=fold(text);if(/\b(?:ricevo|ricever[oò]|mi\s+(?:arriva|arriver[aà]|deve\s+dare|devono\s+dare|dara|dar[aà]|rimborsa|restituisce)|entrata|stipendio|rimborso)\b/.test(t))return {kind:'income',explicit:true};if(/\b(?:devo\s+pagare|pagamento|pagare|pago|pagher[oò]|spesa|bolletta|affitto|rata|acquisto)\b/.test(t))return {kind:'expense',explicit:true};return {kind:fallback,explicit:false}}
function cleanDescription(value){return value.replace(/[,:;]+/g,' ').replace(/\b(?:devo\s+ricordarmi\s+di|devo\s+ricordare\s+di|ricordami\s+di|ricordarsi\s+di|devo\s+pagare|devo\s+versare|devo\s+comprare|ricevo|ricever[oò]|mi\s+arriva|mi\s+arriver[aà]|mi\s+deve\s+dare|mi\s+devono\s+dare|mi\s+dara|mi\s+dar[aà]|mi\s+rimborsa|mi\s+restituisce|pagamento|pagare|pago|pagher[oò]|entrata|attivit[aà])\b/gi,' ').replace(/\s+/g,' ').trim().replace(/^(?:(?:di|del|della|dello|dei|degli|delle|il|lo|la|un|una|da|per)\s+)+/i,'').replace(/\s+(?:il|lo|la|alle|per|di|da|un|una|e)$/i,'').trim()}
function inferCatalogCategory(text,categories=[]){
 const source=fold(text);const candidates=categories.filter(x=>typeof x==='string'&&x.trim()).sort((a,b)=>b.length-a.length);
 return candidates.find(name=>new RegExp(`(?:^|[^\\p{L}\\p{N}])${fold(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$|[^\\p{L}\\p{N}])`,'iu').test(source))||'';
}
function foldedSpan(source,phrase){const target=fold(phrase);let normal='',map=[];for(let i=0;i<source.length;i++){const part=fold(source[i]);for(let j=0;j<part.length;j++)map.push(i);normal+=part}const at=normal.indexOf(target);return at<0?null:{index:map[at],end:map[at+target.length-1]+1}}
function parseVoiceDate(text,recurrence,now=new Date()){
 const stripped=String(text||'');const recurrenceSpan=recurrence?.phrase?foldedSpan(stripped,recurrence.phrase):null;const dateCopy=recurrenceSpan?stripped.slice(0,recurrenceSpan.index)+' '+stripped.slice(recurrenceSpan.end):stripped;const found=findDatePhrase(dateCopy);
 if(found){const parsed=datePartsFromPhrase(found.text,{recurrenceRule:recurrence?.rule,now});if(parsed)return {fields:parsed,phrase:found.text}}
 if(recurrence?.rule.unit==='week'&&recurrence.weekday){const weekday=fold(recurrence.weekday);const index=WEEKDAYS.indexOf(weekday);if(index>=0){const d=dateForWeekday(index,now);return {fields:{date:isoLocal(d),datePrecision:'day'},phrase:''}}}
 return {fields:{date:'',datePrecision:'none'},phrase:''};
}

export function parseItalianVoiceEntry(text,{kind='income',categories=[],now=new Date()}={}){
 const source=String(text||'').trim();if(!source)return {fields:{},missing:['description',...(kind==='todo'?[]:['amount'])],transcript:''};
 const recurrence=recurrenceInfo(source);const dateResult=parseVoiceDate(source,recurrence,now);const time=parseItalianTime(source);
 const excluded=[];if(dateResult.phrase){const span=foldedSpan(source,dateResult.phrase);if(span)excluded.push({...span,type:'date'})}
 if(recurrence?.phrase){const span=foldedSpan(source,recurrence.phrase);if(span)excluded.push({...span,type:'recurrence'})}
 if(time){const m=source.match(/\balle\s+(?:\d{1,2}(?:[:.]\d{2})?|[a-zà-ù]+(?:\s+e\s+(?:[a-zà-ù]+|mezza|un quarto))?)\b|\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b/i);if(m)excluded.push({index:m.index,end:m.index+m[0].length,type:'time'})}
 let candidates=kind==='todo'?[]:amountCandidates(source).filter(candidate=>!excluded.some(span=>candidate.index<span.end&&candidate.end>span.index));
 let amountMatch=candidates.find(x=>x.hasCurrency)||candidates.find(x=>/\b(?:importo|di)\s*$/i.test(source.slice(Math.max(0,x.index-12),x.index)))||null;
 if(!amountMatch&&candidates.length===1)amountMatch=candidates[0];
 const amount=amountMatch?.value??null;
 const detected=detectKind(source,kind);
 let description=source;
 const remove=(value)=>{if(!value)return;const span=foldedSpan(description,value);if(span)description=description.slice(0,span.index)+' '+description.slice(span.end)};
 if(amountMatch)remove(amountMatch.raw);
 if(dateResult.phrase)remove(dateResult.phrase);
 if(recurrence?.phrase)remove(recurrence.phrase);
 if(time){const m=description.match(/\balle\s+(?:\d{1,2}(?:[:.]\d{2})?|[a-zà-ù]+(?:\s+e\s+(?:[a-zà-ù]+|mezza|un quarto))?)\b|\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b/i);if(m)remove(m[0])}
 const supplierMatch=description.match(/\b(?:da\s+parte\s+di|da|presso)\s+([\p{L}\p{M}][\p{L}\p{M}'’.-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'’.-]*){0,3})/iu);
 let supplier=supplierMatch?.[1]?.trim()||'';if(supplierMatch)remove(supplierMatch[0]);
 const dueMatch=description.match(/^\s*([\p{Lu}][\p{L}\p{M}'’.-]*(?:\s+[\p{Lu}][\p{L}\p{M}'’.-]*){0,2})\s+mi\s+(?:deve|dovr[aà])\s+(?:dare|versare|restituire)\b/iu);
 if(dueMatch){supplier=dueMatch[1];remove(dueMatch[0])}
 const categoryExplicit=description.match(/\b(?:categoria|categoria e)\s+([\p{L}\p{M}][\p{L}\p{M}'’ -]*)$/iu);
 let category=categoryExplicit?.[1]?.trim()||'';if(categoryExplicit)remove(categoryExplicit[0]);
 if(!category)category=inferCatalogCategory(description,categories);
 description=cleanDescription(description);
 const fields={description,amount,date:dateResult.fields.date,datePrecision:dateResult.fields.datePrecision,category,supplier,time,reminder:{enabled:Boolean(time),time:time||''},recurrenceRule:recurrence?.rule||null,recurrence:recurrence?({day:'daily',week:'weekly',month:'monthly',year:'yearly'}[recurrence.rule.unit]||'none'):'none',kind:detected.kind,typeExplicit:detected.explicit};
 const missing=[];if(!description)missing.push('description');if(!(Number.isFinite(amount)&&amount>0)&&kind!=='todo')missing.push('amount');if(recurrence&&!dateResult.fields.date)missing.push('recurrence-anchor');
 return {fields,missing,transcript:source,confidence:{amount:candidates.length<=1?'clear':amountMatch?'anchored':'ambiguous',date:dateResult.phrase?'clear':'not-stated',kind:detected.explicit?'explicit':'from-selected-section'}};
}

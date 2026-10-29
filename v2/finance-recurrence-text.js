const units = {giorno: 'day', giorni: 'day', settimana: 'week', settimane: 'week', mese: 'month', mesi: 'month', anno: 'year', anni: 'year'};
const weekdays = {domenica: 0, lunedì: 1, lunedi: 1, martedì: 2, martedi: 2, mercoledì: 3, mercoledi: 3, giovedì: 4, giovedi: 4, venerdì: 5, venerdi: 5, sabato: 6};
const months = {gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12};
const pad = n => String(n).padStart(2, '0');
function parts(value) { if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d,12));return date.getUTCFullYear()===y&&date.getUTCMonth()+1===m&&date.getUTCDate()===d?[y,m,d]:null; }
function formatDate(year, month, day) { return `${year}-${pad(month)}-${pad(day)}`; }
function monthEnd(year, month) { return new Date(Date.UTC(year, month, 0, 12)).getUTCDate(); }
function addDays(value, days) { const [y,m,d] = parts(value); const date = new Date(Date.UTC(y,m-1,d+days,12)); return date.toISOString().slice(0,10); }
function addMonths(value, monthsToAdd) { const [y,m,d] = parts(value); const date = new Date(Date.UTC(y,m-1+monthsToAdd,1,12)); return formatDate(date.getUTCFullYear(),date.getUTCMonth()+1,Math.min(d,monthEnd(date.getUTCFullYear(),date.getUTCMonth()+1))); }
function nextFixedDate(start, month, day, intervalYears = 0) {
 const [y]=parts(start); let year=y, actualDay=Math.min(day,monthEnd(year,month));
 if(formatDate(year,month,actualDay)<start)year+=intervalYears||1;
 actualDay=Math.min(day,monthEnd(year,month));return formatDate(year,month,actualDay);
}
function nextMonthlyDate(start,day){
 let [year,month]=parts(start);let candidate=formatDate(year,month,Math.min(day,monthEnd(year,month)));
 if(candidate<start){const next=parts(addMonths(start,1));year=next[0];month=next[1];candidate=formatDate(year,month,Math.min(day,monthEnd(year,month)))}
 return candidate;
}
function success(unit, interval, anchorDate, end = 'never', count = 1, until = '') {
 return {ok:true,anchorDate,rule:{unit,interval,end,count,until}};
}
function invalid(message = 'Ricorrenza non riconosciuta. Riscrivila usando uno degli esempi supportati.') { return {ok:false,error:message}; }

/** Deterministic Italian recurrence parser. It only accepts explicit, validated patterns. */
export function parseFinanceRecurrenceText(value, startDate) {
 const text=String(value||'').trim().toLocaleLowerCase('it-IT').replace(/[’']/g,"'").replace(/\s+/g,' ');
 if(!text)return invalid('Scrivi la ricorrenza oppure scegli un’altra opzione.');
 const start=parts(startDate); if(!start)return invalid('Per personalizzare la ricorrenza scegli prima una data completa e valida.');
 const [sy,sm,sd]=start;
 let m;
 if((m=text.match(/^ogni (\d{1,2}) del mese per (\d{1,4}) mesi$/))){
  const day=Number(m[1]),count=Number(m[2]);if(day<1||day>31||count<1||count>5000)return invalid('Il giorno deve essere tra 1 e 31 e la durata tra 1 e 5000 mesi.');
  const anchor=nextMonthlyDate(startDate,day);
  return success('month',1,anchor,'count',count);
 }
 if((m=text.match(/^ogni (\d{1,4}) (giorno|giorni|settimana|settimane|mese|mesi|anno|anni) per (\d{1,4}) (mesi|anni)$/))){
  const interval=Number(m[1]),unit=units[m[2]],duration=Number(m[3]),durationUnit=m[4];if(interval<1||interval>365||duration<1||duration>1200)return invalid('Intervallo o durata fuori dai limiti supportati.');
  const durationMonths=durationUnit==='anni'?duration*12:duration,until=addDays(addMonths(startDate,durationMonths),-1);return success(unit,interval,startDate,'date',1,until);
 }
 if((m=text.match(/^ogni (\d{1,4}) (giorno|giorni|settimana|settimane|mese|mesi|anno|anni) per (\d{1,4}) (volta|volte)$/))){
  const interval=Number(m[1]),unit=units[m[2]],count=Number(m[3]);if(interval<1||interval>365||count<1||count>5000)return invalid('Intervallo o numero di ripetizioni fuori dai limiti supportati.');
  return success(unit,interval,startDate,'count',count);
 }
 if((m=text.match(/^ogni (\d{1,4}) giorni per (\d{1,4}) mesi$/))){
  const interval=Number(m[1]),duration=Number(m[2]);if(interval<1||interval>365||duration<1||duration>1200)return invalid('Intervallo o durata fuori dai limiti supportati.');
  const until=addDays(addMonths(startDate,duration),-1);return success('day',interval,startDate,'date',1,until);
 }
 if((m=text.match(/^ogni (luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica) per (\d{1,4}) settimane$/))){
  const weekday=weekdays[m[1]],count=Number(m[2]);if(count<1||count>5000)return invalid('La durata deve essere tra 1 e 5000 settimane.');
  const offset=(weekday-new Date(Date.UTC(sy,sm-1,sd,12)).getUTCDay()+7)%7;return success('week',1,addDays(startDate,offset),'count',count);
 }
 if((m=text.match(/^ogni (\d{1,4}) anni?, il (\d{1,2}) (gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)$/))){
  const interval=Number(m[1]),day=Number(m[2]),month=months[m[3]];if(interval<1||interval>365||day<1||day>31)return invalid('Intervallo o giorno del mese non valido.');
  const anchor=nextFixedDate(startDate,month,day,interval);
  return success('year',interval,anchor);
 }
 if((m=text.match(/^il giorno (\d{1,2}) di ogni mese fino a (gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre) (\d{4})$/))){
  const day=Number(m[1]),month=months[m[2]],year=Number(m[3]);if(day<1||day>31||year<sy||year>9999)return invalid('Giorno o data finale non valida.');
  const until=formatDate(year,month,monthEnd(year,month)),anchor=nextMonthlyDate(startDate,day);if(anchor>until)return invalid('La prima data della ricorrenza è successiva alla data finale.');
  return success('month',1,anchor,'date',1,until);
 }
 if((m=text.match(/^ogni (\d{1,4}) (giorno|giorni|settimana|settimane|mese|mesi|anno|anni) per sempre$/))){
  const interval=Number(m[1]),unit=units[m[2]];if(interval<1||interval>365)return invalid('L’intervallo deve essere tra 1 e 365.');return success(unit,interval,startDate);
 }
 if((m=text.match(/^ogni (giorno|settimana|mese|anno) per sempre$/))){return success(units[m[1]],1,startDate);}
 if((m=text.match(/^ogni (\d{1,4}) (giorno|giorni|settimana|settimane|mese|mesi|anno|anni) fino al (\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/))){
  const interval=Number(m[1]),unit=units[m[2]],raw=m[3],until=/^\d{4}-/.test(raw)?raw:(()=>{const [d,mo,y]=raw.split('/').map(Number);return formatDate(y,mo,d)})();if(interval<1||interval>365||!parts(until)||until<startDate)return invalid('Intervallo o data finale non valida.');return success(unit,interval,startDate,'date',1,until);
 }
 return invalid();
}

export function describeFinanceRecurrence(rule) {
 if(!rule)return '';
 const singular={day:'giorno',week:'settimana',month:'mese',year:'anno'}[rule.unit],plural={day:'giorni',week:'settimane',month:'mesi',year:'anni'}[rule.unit];if(!singular)return '';
 const prefix=`Ogni ${rule.interval>1?rule.interval+' '+plural:singular}`;
 if(rule.end==='never')return `${prefix} per sempre`;
 if(rule.end==='count')return rule.unit==='month'&&rule.interval===1?`${prefix} per ${rule.count} mesi`:`${prefix} per ${rule.count} volte`;
 return `${prefix} fino al ${rule.until}`;
}

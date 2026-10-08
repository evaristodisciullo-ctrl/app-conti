const MONTH_NAMES=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
export function inferDatePrecision(value){
 if(!value)return 'none';
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return 'day';
 if(/^\d{4}-\d{2}$/.test(value))return 'month';
 if(/^\d{4}$/.test(value))return 'year';
 if(/^\d{2}$/.test(value))return 'dayOnly';
 if(/^\d{2}-\d{2}$/.test(value))return 'dayMonth';
 return 'none';
}
export function dateFields(item={}){
 const precision=item.datePrecision||inferDatePrecision(item.date||'');
 const value=item.date||'';
 if(precision==='day'){const [year,month,day]=value.split('-').map(Number);return {precision,year,month,day}}
 if(precision==='month'){const [year,month]=value.split('-').map(Number);return {precision,year,month}}
 if(precision==='year')return {precision,year:Number(value)}
 if(precision==='monthOnly')return {precision,month:Number(value)}
 if(precision==='dayOnly')return {precision,day:Number(value)}
 if(precision==='dayMonth'){const [month,day]=value.split('-').map(Number);return {precision,month,day}}
 return {precision:'none'}
}
export function matchesMonth(item,ym){
 if(!item.date)return true;
 const f=dateFields(item),[year,month]=ym.split('-').map(Number);
 if(f.year&&f.year!==year)return false;
 if(f.month&&f.month!==month)return false;
 return true;
}
export function matchesDateFilter(item,month='all',year='all'){
 const f=dateFields(item);
 if(year!=='all'&&f.year&&String(f.year)!==String(year))return false;
 if(month!=='all'&&f.month&&String(f.month).padStart(2,'0')!==String(month).padStart(2,'0'))return false;
 return true;
}
export function dateSortKey(item){
 if(!item.date)return '9999-9999-9999|';
 const f=dateFields(item);
 return [f.year||0,f.month||0,f.day||0].map(x=>String(x).padStart(4,'0')).join('-')+'|'+String(item.createdAt||'');
}
export function formatDateValue(value,precision=inferDatePrecision(value)){
 if(!value||precision==='none')return 'Senza data';
 if(precision==='day'){
  const [year,month,day]=value.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'long',year:'numeric'}).format(new Date(year,month-1,day));
 }
 if(precision==='month'){const [year,month]=value.split('-').map(Number);return new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(new Date(year,month-1,1))}
 if(precision==='year')return value;
 if(precision==='monthOnly')return MONTH_NAMES[Number(value)-1]||value;
 if(precision==='dayOnly')return Number(value)+' (giorno)';
 if(precision==='dayMonth'){const [month,day]=value.split('-').map(Number);return day+' '+(MONTH_NAMES[month-1]||value)}
 return value;
}
export function validateDateValue(value,precision){
 if(!value)return false;
 if(precision==='day')return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'));
 if(precision==='month')return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
 if(precision==='year')return /^\d{4}$/.test(value);
 if(precision==='monthOnly')return /^(0[1-9]|1[0-2])$/.test(value);
 if(precision==='dayOnly')return /^(0[1-9]|[12]\d|3[01])$/.test(value);
 if(precision==='dayMonth'){
  const [month,day]=value.split('-').map(Number);
  return /^\d{2}-\d{2}$/.test(value)&&month>=1&&month<=12&&day>=1&&day<=new Date(Date.UTC(2000,month,0)).getUTCDate();
 }
 return precision==='none';
}

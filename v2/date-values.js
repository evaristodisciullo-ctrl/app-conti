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
 const f=dateFields(item),precision=f.precision;
 if(precision==='day'&&Number.isInteger(f.year)&&Number.isInteger(f.month)&&Number.isInteger(f.day))return '0|'+[f.year,f.month,f.day].map(x=>String(x).padStart(4,'0')).join('-')+'|'+String(item.createdAt||'');
 if(precision==='month'&&Number.isInteger(f.year)&&Number.isInteger(f.month))return '0|'+[f.year,f.month,1].map(x=>String(x).padStart(4,'0')).join('-')+'|'+String(item.createdAt||'');
 if(precision==='year'&&Number.isInteger(f.year))return '0|'+[f.year,1,1].map(x=>String(x).padStart(4,'0')).join('-')+'|'+String(item.createdAt||'');
 if(precision==='dayMonth'&&Number.isInteger(f.month)&&Number.isInteger(f.day))return '1|'+[f.month,f.day].map(x=>String(x).padStart(4,'0')).join('-')+'|'+String(item.createdAt||'');
 if(precision==='monthOnly'&&Number.isInteger(f.month))return '1|'+[f.month,1].map(x=>String(x).padStart(4,'0')).join('-')+'|'+String(item.createdAt||'');
 if(precision==='dayOnly'&&Number.isInteger(f.day))return '1|'+[0,f.day].map(x=>String(x).padStart(4,'0')).join('-')+'|'+String(item.createdAt||'');
 return '2|9999-9999-9999|'+String(item.createdAt||'');
}
export function isOverdue(item,now=new Date()){
 if(!item?.date)return false;
 const f=dateFields(item),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 if(f.precision==='day'){
  if(!validateDateValue(item.date,'day'))return false;
  return item.date<`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 }
 if(f.precision==='month'){
  if(!validateDateValue(item.date,'month'))return false;
  const [year,month]=item.date.split('-').map(Number);
  return new Date(year,month,1)<=today;
 }
 if(f.precision==='year'){
  if(!validateDateValue(item.date,'year'))return false;
  return new Date(f.year+1,0,1)<=today;
 }
 return false;
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
 if(precision==='day'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [year,month,day]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()+1===month&&date.getUTCDate()===day;
 }
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

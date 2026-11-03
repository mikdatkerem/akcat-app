import type {Analysis,AnalysisFilter} from '../services/analysis'
import {valueLabels} from '../services/analysis'
import {formatMoney} from '../utils/format'
export function turkishDay(day:string):string{return new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'))}
export function turkishReportText(value:string):string {
 if(/^\d{4}-\d{2}$/.test(value))return new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'-01T12:00:00Z'))
 return valueLabels[value]??value.replace(/\b\d{4}-\d{2}-\d{2}\b/g,day=>turkishDay(day))
}
const labels:Record<string,string>={trend_interval:'Grafik tarih aralığı',period:'Dönem',from:'Başlangıç tarihi',to:'Bitiş tarihi',view:'Rapor görünümü',method:'Ödeme yöntemi',sale_type:'Satış türü',status:'Durum',min:'En az tutar',max:'En çok tutar',kind:'Hareket türü',sort:'Sıralama',compare_from:'Karşılaştırma başlangıcı',compare_to:'Karşılaştırma bitişi',compare_mode:'Karşılaştırma yöntemi',q:'Arama'}
const options:Record<string,string>={today:'Bugün',yesterday:'Dün',last7:'Son 7 gün',week:'Bu hafta',lastweek:'Geçen hafta',month:'Bu ay',lastmonth:'Geçen ay',year:'Bu yıl',custom:'Özel tarih aralığı',detail:'Genel döküm',statement:'Alışveriş ve ödeme dökümü',daily:'Günlük',monthly:'Aylık',customers:'Müşteri bazlı',employees:'Çalışan bazlı',products:'Ürün bazlı',types:'İşlem türleri',status:'Durum bazlı',aging:'Borç yaşlandırma',balances:'Güncel bakiyeler',movements:'İşlem geçmişi',new:'Yeni kayıtlar',active:'Aktif kayıtlar',inactive:'Pasif kayıtlar',normal:'Normal satış',walk_in:'Hızlı satış',paid:'Ödendi',partial:'Kısmi ödeme',unpaid:'Ödenmedi',default:'Varsayılan',quantity_asc:'Miktar (artan)',quantity_desc:'Miktar (azalan)',total_asc:'Tutar (artan)',total_desc:'Tutar (azalan)',elapsed:'Aynı gün sayısı',full:'Önceki tam dönem'}
export function reportFilterLabels(r:Analysis,filter:AnalysisFilter):string[]{
 const names:Record<string,string>={customer_name:'Müşteri',employee_name:'Çalışan',product_name:'Ürün'}
 return [...Object.entries(r.filter_labels).filter(([k,v])=>names[k]&&v).map(([k,v])=>`${names[k]}: ${v}`),...Object.entries(filter).filter(([k,v])=>labels[k]&&v).map(([k,v])=>`${labels[k]}: ${k==='trend_interval'?({day:'Günlük',week:'Haftalık',month:'Aylık'} as Record<string,string>)[v]:k==='min'||k==='max'?formatMoney(Number(v)):options[v]??turkishReportText(v)}`)]
}

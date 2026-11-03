import {turkishDay,turkishReportText} from './reportPresentation'
import {jsPDF} from 'jspdf'
import {autoTable} from 'jspdf-autotable'
import type {Analysis,AnalysisColumn,AnalysisRow} from '../services/analysis'
import {metricLabels} from '../services/analysis'
import {formatMoney} from '../utils/format'
import logo from '../assets/akcat-logo.png'
export function reportCell(value:unknown,kind:AnalysisColumn['kind']) {
 if(value===null||value===undefined)return '—'
 if(kind==='money')return formatMoney(Number(value))
 if(kind==='number')return new Intl.NumberFormat('tr-TR').format(Number(value))
 if(kind==='date')return new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(String(value)))
 return turkishReportText(String(value))
}
export async function downloadReportPdf(r:Analysis,title:string,filters:string[],content:'full'|'transactions'='full') {
 const response=await fetch('/fonts/NotoSans-Regular.ttf');if(!response.ok)throw new Error('PDF yazı tipi yüklenemedi.')
 const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192))
 const doc=new jsPDF({orientation:r.columns.length>6?'landscape':'portrait',unit:'mm',format:'a4'})
 doc.addFileToVFS('NotoSans.ttf',btoa(binary));doc.addFont('NotoSans.ttf','NotoSans','normal');doc.setFont('NotoSans');doc.setFontSize(15)
 const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('PDF logosu yüklenemedi.'));image.src=logo})
 doc.addImage(img,'PNG',14,7,32,18);doc.text(title,50,18);doc.setFontSize(9)
 const date=new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'})
 const details=[`${turkishDay(r.range.start_date)} – ${turkishDay(r.range.end_date)} · Türkiye saati`,`Oluşturulma: ${date.format(new Date(r.range.generated_at))}`,...(r.category==='comparison'&&r.comparison[0]?.previous_period?[`Önceki dönem: ${turkishReportText(String(r.comparison[0].previous_period))}`]:[]),...filters]
 const lines=doc.splitTextToSize(details.join('\n'),doc.internal.pageSize.getWidth()-28);doc.text(lines,14,31)
 let y=34+lines.length*4
 if(content==='full'){autoTable(doc,{startY:y,head:[['Gösterge','Değer']],body:Object.entries(r.metrics).map(([key,value])=>[metricLabels[key]??'Diğer gösterge',reportCell(value,key.endsWith('_kurus')?'money':'number')]),styles:{font:'NotoSans',fontStyle:'normal',fontSize:8,cellPadding:2},headStyles:{fillColor:[35,42,51],fontStyle:'normal'},margin:{top:15,bottom:16}})
 y=(doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+7
 }
 if(content==='full'&&r.trend.length) {
   if(y+58>doc.internal.pageSize.getHeight()-20){doc.addPage();y=20}
   doc.setFontSize(10);doc.text('Satış / geçerli tahsilat eğilimi',14,y);y+=6;
   const w=doc.internal.pageSize.getWidth()-28,h=35,max=Math.max(1,...r.trend.flatMap(row=>[Number(row.sales_kurus),Number(row.receipts_kurus)]));
   for(const [key,color] of [['sales_kurus',[70,80,90]],['receipts_kurus',[251,108,0]]] as const){doc.setDrawColor(color[0],color[1],color[2]);doc.setLineWidth(0.5);for(let i=1;i<r.trend.length;i++){const x0=14+(i-1)*w/Math.max(1,r.trend.length-1),x1=14+i*w/Math.max(1,r.trend.length-1);doc.line(x0,y+h-Number(r.trend[i-1][key])/max*h,x1,y+h-Number(r.trend[i][key])/max*h)}}
   doc.setTextColor(30);doc.setFontSize(8);doc.text('Gri: satış · Turuncu: geçerli tahsilat',14,y+h+5);doc.text(turkishDay((r.chart_range??r.range).start_date)+' – '+turkishDay((r.chart_range??r.range).end_date),14,y+h+9);y+=h+16
 }
 let columns=r.columns,rows=r.data
 if(r.category==='comparison') {columns=[{key:'label',label:'Gösterge',kind:'text'},{key:'previous',label:'Önceki dönem',kind:'text'},{key:'current',label:'Seçili dönem',kind:'text'},{key:'change',label:'Değişim',kind:'text'}];rows=r.comparison.map(row=>{const key=String(row.key),kind=key.endsWith('_kurus')?'money':'number';return {label:metricLabels[key],previous:reportCell(row.previous,kind),current:reportCell(row.current,kind),change:Number(row.previous)===0?'Önceki dönem sıfır':new Intl.NumberFormat('tr-TR',{style:'percent',maximumFractionDigits:1}).format((Number(row.current)-Number(row.previous))/Number(row.previous))} satisfies AnalysisRow})}
 autoTable(doc,{startY:y,head:[columns.map(c=>c.label)],body:rows.map(row=>columns.map(c=>c.link==='sale'?row[c.key]?'Satış detayı':'—':c.link==='correction'?'Düzeltme talebi':c.key==='is_active'?row[c.key]?'Aktif':'Pasif':reportCell(row[c.key],c.kind))),foot:r.category==='customers'&&r.view==='statement'?[columns.map((c,i)=>i===0?'Dönem toplamı':c.key==='purchased_kurus'?formatMoney(r.metrics.sales_kurus):c.key==='collected_kurus'?formatMoney(r.metrics.receipts_kurus):'')]:undefined,showFoot:'lastPage',footStyles:{fillColor:[240,240,240],textColor:25,fontStyle:'normal'},styles:{font:'NotoSans',fontStyle:'normal',fontSize:7,cellPadding:2,overflow:'linebreak'},headStyles:{fillColor:[35,42,51],fontStyle:'normal'},columnStyles:Object.fromEntries(columns.map((c,i)=>[i,{halign:c.kind==='money'||c.kind==='number'?'right':'left'}])),margin:{top:15,bottom:16},showHead:'everyPage',rowPageBreak:'avoid'})
 const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.text(`AKÇAT · Toplam ${new Intl.NumberFormat('tr-TR').format(r.pagination.total)} kayıt · Sayfa ${i} / ${pages}`,14,doc.internal.pageSize.getHeight()-8)}
 doc.save(`AKCAT-${title}-${turkishDay(r.range.start_date)}-${turkishDay(r.range.end_date)}.pdf`)
}

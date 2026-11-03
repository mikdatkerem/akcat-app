import {Select} from '../components/ui'
import type { ReactNode } from 'react'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import type { Analysis, AnalysisRow } from '../services/analysis'
import {formatMoney} from '../utils/format'

const colors=['var(--color-primary)','var(--color-text-secondary)','var(--color-success)','var(--color-warning)']
const tooltipStyle={background:'var(--color-surface)',borderColor:'var(--color-border)',color:'var(--color-text)'}
const count=(value:unknown)=>new Intl.NumberFormat('tr-TR').format(Number(value))
const money=(value:unknown)=>formatMoney(Number(value))
function dateLabel(value:unknown,short=false):string{
 const label=String(value)
 if(label.length===13)return short?label.slice(11)+':00':dateLabel(label.slice(0,10))+' '+label.slice(11)+':00'
 const monthly=label.length===7
 const date=new Date(label+(monthly?'-01':'')+'T12:00:00Z')
 if(!Number.isFinite(date.getTime()))return label
 return new Intl.DateTimeFormat('tr-TR',{timeZone:'UTC',...(monthly?{month:'short',year:'numeric'}:{day:'numeric',month:'short',...(short?{}:{year:'numeric'})})}).format(date)
}
function Frame({title,empty,children}:{title:string;empty:boolean;children:ReactNode}){return <section className="analysis-chart"><h2>{title}</h2>{empty?<p className="analysis-empty">Seçili dönemde bu gösterge için işlem bulunmuyor.</p>:children}</section>}
type Series={key:string;label:string}
function Trend({title,rows,series,currency=false}:{title:string;rows:AnalysisRow[];series:Series[];currency?:boolean}){
 const empty=!rows.some(row=>series.some(s=>Number(row[s.key])!==0))
 return <Frame title={title} empty={empty}><ResponsiveContainer width="100%" height={270}><LineChart data={rows} accessibilityLayer margin={{top:8,right:16,bottom:8,left:0}}>
 <CartesianGrid stroke="var(--color-border)" vertical={false}/>
 <XAxis dataKey="label" tickFormatter={v=>dateLabel(v,true)} tick={{fill:'var(--color-text-secondary)',fontSize:11}} minTickGap={35}/>
 <YAxis allowDecimals={false} width={currency?85:45} tick={{fill:'var(--color-text-secondary)',fontSize:11}} tickFormatter={v=>currency?new Intl.NumberFormat('tr-TR',{notation:'compact',compactDisplay:'long',maximumFractionDigits:1}).format(Number(v)/100)+' ₺':count(v)}/>
 <Tooltip labelFormatter={v=>dateLabel(v)} formatter={currency?money:count} contentStyle={tooltipStyle}/><Legend/>
 {series.map((s,i)=><Line key={s.key} type="linear" name={s.label} dataKey={s.key} stroke={colors[i]} strokeWidth={2} dot={{r:2}} activeDot={{r:5}} strokeDasharray={i===1?'5 3':undefined} isAnimationActive={false}/>)}
 </LineChart></ResponsiveContainer></Frame>
}
export default function ReportCharts({report:r,onIntervalChange,busy=false}:{report:Analysis;onIntervalChange?:(value:string)=>void;busy?:boolean}){
 if(r.category==='comparison')return <ComparisonChart report={r}/>
 const interval={day:'Günlük',week:'Haftalık',month:'Aylık'}[r.trend_interval]
 return <>
 <div className="analysis-chart-toolbar"><p className="analysis-chart-period">{dateLabel(r.range.start_date)} — {dateLabel(r.range.end_date)} · {interval}</p>{onIntervalChange&&<Select label="Grafik tarih aralığı" disabled={busy} value={r.trend_interval} onChange={e=>onIntervalChange(e.target.value)}><option value="day">Günlük</option><option value="week">Haftalık</option><option value="month">Aylık</option></Select>}</div>
 <div className="analysis-charts">
 <Trend title="Satış Tutarı" rows={r.trend} currency series={[{key:'sales_kurus',label:'Geçerli satış tutarı'}]}/>
 <Trend title="Tahsilat" rows={r.trend} currency series={[{key:'receipts_kurus',label:'Toplam geçerli tahsilat'},{key:'cash_kurus',label:'Nakit'},{key:'card_kurus',label:'Kart'},{key:'bank_kurus',label:'Banka'}]}/>
 <Trend title="Satış ve müşteri hareketliliği" rows={r.trend} series={[{key:'sales_count',label:'Satış sayısı'},{key:'customers_count',label:'Alışveriş yapan müşteri'}]}/>

 </div>
 <p className="analysis-chart-period">Son dönem henüz tamamlanmamış olabilir. Haftalar pazartesi başlar; sınırdaki hafta ve aylar yalnızca seçili tarih aralığını kapsar.</p>
 </>
}
function ComparisonChart({report:r}:{report:Analysis}){
 const sale=r.comparison.find(row=>row.key==='sales_kurus'),payment=r.comparison.find(row=>row.key==='receipts_kurus')
 if(!sale||!payment)return <Frame title="Dönemlere göre satış ve tahsilat" empty>{null}</Frame>
 const rows=[{period:'Önceki dönem',dates:sale.previous_period,sales_kurus:sale.previous,receipts_kurus:payment.previous},{period:'Seçili dönem',dates:r.range.start_date+' / '+r.range.end_date,sales_kurus:sale.current,receipts_kurus:payment.current}]
 return <Frame title="Dönemlere göre satış ve tahsilat" empty={false}><ResponsiveContainer width="100%" height={280}><BarChart data={rows} accessibilityLayer>
 <CartesianGrid stroke="var(--color-border)" vertical={false}/><XAxis dataKey="period"/>
 <YAxis width={85} tickFormatter={v=>new Intl.NumberFormat('tr-TR',{notation:'compact',compactDisplay:'long'}).format(Number(v)/100)+' ₺'}/>
 <Tooltip formatter={money} labelFormatter={(_,payload)=>String(payload?.[0]?.payload?.dates??'')} contentStyle={tooltipStyle}/><Legend/>
 <Bar name="Geçerli satış tutarı" dataKey="sales_kurus" fill={colors[0]} isAnimationActive={false}/><Bar name="Geçerli tahsilat" dataKey="receipts_kurus" fill={colors[1]} isAnimationActive={false}/>
 </BarChart></ResponsiveContainer></Frame>
}

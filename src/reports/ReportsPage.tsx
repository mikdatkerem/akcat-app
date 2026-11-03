import {reportFilterLabels,turkishDay,turkishReportText} from './reportPresentation'
import type {IconName} from '../components/ui/Icon'
import {lazy,Suspense,useCallback,useRef,useState,type FormEvent} from 'react'
import {Button,Input,Select,ErrorState,LoadingState,EmptyState,Icon} from '../components/ui'
import {PageHeader} from '../pages/PageHeader'
import type {Role} from '../services/auth'
import {getAnalysis,metricLabels,valueLabels,type Analysis,type AnalysisFilter,type AnalysisRow} from '../services/analysis'
import {useResource} from '../hooks/useResource'
import {useReportLocation} from './routing'
import {RecordPicker} from '../sales/RecordPicker'
import {listCustomers} from '../services/customers'
import {listProducts} from '../services/products'
import {listUsers} from '../services/users'
import {formatMoney,parsePriceToKurus,priceInputFromKurus} from '../utils/format'
import './reports.css'
import './analysis.css'
const Charts=lazy(()=>import('./ReportCharts'))
const categories:Record<string,{title:string;description:string;icon:IconName;views:[string,string][]}>={
 sales:{title:'Satış Raporları',description:'Dönem, müşteri, ürün ve satış türleri.',icon:'sales',views:[['detail','Genel / detaylı satış dökümü'],['daily','Günlük satış'],['monthly','Aylık satış'],['customers','Müşteri bazlı'],['employees','Çalışan bazlı'],['products','Ürün bazlı'],['types','Satış türleri'],['status','Satış durumu']]},
 payments:{title:'Tahsilat Raporları',description:'Gerçek tahsilatlar ve toplu ödeme dağılımları.',icon:'payments',views:[['detail','Genel / toplu tahsilatlar'],['daily','Günlük tahsilat'],['monthly','Aylık tahsilat'],['types','Ödeme yöntemleri'],['customers','Müşteri bazlı'],['employees','Çalışan bazlı']]},
 receivables:{title:'Borç ve Veresiye',description:'Güncel alacak, açık satışlar ve yaşlandırma.',icon:'credit',views:[['customers','Borçlu müşteriler'],['detail','Açık / kısmi ödenmiş satışlar'],['aging','Borç yaşlandırma'],['movements','Dönem borç hareketleri']]},
 customers:{title:'Müşteri Raporları',description:'Alışveriş, tahsilat ve kayıt durumu.',icon:'customers',views:[['detail','Müşteri analizi'],['new','Yeni kayıtlar'],['active','Aktif kayıtlar'],['inactive','Pasif kayıtlar'],['products','Ürün dağılımı'],['daily','Alışveriş eğilimi'],['movements','İşlem geçmişi'],['statement','Alışveriş ve ödeme dökümü']]},
 employees:{title:'Çalışan Raporları',description:'Satışı yapan ve tahsilatı alan kullanıcı.',icon:'customers',views:[['detail','Çalışan performansı'],['daily','Günlük işlemler'],['products','Ürün satışları'],['movements','İşlem geçmişi']]},
 products:{title:'Ürün Raporları',description:'Satış miktarı ve gerçekleşen fiyatlar.',icon:'products',views:[['detail','Ürün satışları ve fiyat analizi'],['daily','Günlük ürün satışı'],['monthly','Aylık ürün satışı'],['customers','Müşteri bazlı ürün'],['employees','Çalışan bazlı ürün']]},
 vouchers:{title:'Su Fişi Raporları',description:'Kayıtlı fiş satışları, kullanımlar ve bakiyeler.',icon:'droplet',views:[['movements','Fiş hareketleri'],['balances','Müşteri bakiyeleri']]},
 corrections:{title:'İptal ve Düzeltmeler',description:'İptaller, ters kayıtlar ve harici iadeler.',icon:'corrections',views:[['detail','Finansal hareketler'],['daily','Günlük düzeltmeler'],['status','Düzeltme talepleri ve kararları']]},
 comparison:{title:'Dönem Karşılaştırmaları',description:'Eşit süre veya özel dönem karşılaştırması.',icon:'overview',views:[['detail','Dönem karşılaştırması']]},
}
const periods=[['today','Bugün'],['yesterday','Dün'],['last7','Son 7 gün'],['week','Bu hafta'],['lastweek','Geçen hafta'],['month','Bu ay'],['lastmonth','Geçen ay'],['year','Bu yıl'],['custom','Özel tarih aralığı']]
const aliases:Record<string,string>={satislar:'sales',tahsilatlar:'payments',borclar:'receivables',calisanlar:'employees'}
const href=(filter:AnalysisFilter)=>`#/raporlar${filter.category&&filter.category!=='overview'?'/'+filter.category:''}?${new URLSearchParams(filter)}`
const customerLoad=(q:string,page:number)=>listCustomers({q,page,pageSize:5,status:'all'})
const productLoad=(q:string,page:number)=>listProducts({q,page,pageSize:5,status:'all'})
const userLoad=async(q:string,page:number)=>{const r=await listUsers({q,page,pageSize:5,status:'all'});return {...r,data:r.data.map(u=>({...u,name:u.username}))}}
function display(v:unknown,kind:string){if(v===null||v===undefined)return '—';if(kind==='money')return formatMoney(Number(v));if(kind==='number')return new Intl.NumberFormat('tr-TR').format(Number(v));if(kind==='date')return new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(String(v)));return turkishReportText(String(v))}
function Filters({filter:f}:{filter:AnalysisFilter}){
 const [draft,setDraft]=useState<AnalysisFilter>({...f,...(f.min?{min:priceInputFromKurus(Number(f.min))}:{}),...(f.max?{max:priceInputFromKurus(Number(f.max))}:{})}),[error,setError]=useState(''),[names,setNames]=useState<Record<string,string>>({})
 const registration=f.category==='customers'&&['new','active','inactive'].includes(draft.view??'');const requests=f.category==='corrections'&&draft.view==='status';const balances=f.category==='vouchers'&&draft.view==='balances'
 const set=(key:string,value:string)=>setDraft(d=>({...d,[key]:value}))
 function submit(e:FormEvent){e.preventDefault();try{const next:AnalysisFilter={...draft,page:'1'};if(registration||balances)for(const key of ['created_by','product_id','method','sale_type','status','kind','min','max'])delete next[key];if(requests)for(const key of ['product_id','method','sale_type','kind','min','max'])delete next[key];if(!requests&&['pending','approved','rejected'].includes(next.status))delete next.status;for(const key of ['min','max'])if(next[key])next[key]=String(parsePriceToKurus(next[key]));if(next.period!=='custom'){delete next.from;delete next.to}for(const k of Object.keys(next))if(!next[k])delete next[k];window.location.hash=href(next)}catch(e){setError(e instanceof Error?e.message:'Filtre geçersiz.')}}
 return <form className="analysis-filters" onSubmit={submit}>
 <div className="analysis-toolbar"><Select label="Dönem" value={draft.period??'today'} onChange={e=>set('period',e.target.value)}>{periods.map(([v,t])=><option value={v} key={v}>{t}</option>)}</Select>
 {draft.period==='custom'&&<><Input label="Başlangıç" type="date" required value={draft.from??''} onChange={e=>set('from',e.target.value)}/><Input label="Bitiş" type="date" required min={draft.from} value={draft.to??''} onChange={e=>set('to',e.target.value)}/></>}
 {f.category!=='overview'&&<Select label="Rapor görünümü" value={draft.view??categories[f.category]?.views[0][0]??'detail'} onChange={e=>set('view',e.target.value)}>{categories[f.category]?.views.map(([v,t])=><option key={v} value={v}>{t}</option>)}</Select>}
 <Button type="submit">Uygula</Button><a className="ui-button ui-button--secondary" href={href({category:f.category,period:'today'})}>Temizle</a></div>
 {draft.view==='statement'&&<div className="analysis-statement-picker"><RecordPicker label="Müşteri seç" load={customerLoad} searchRequired onSelect={c=>{set('customer_id',c.id);setNames(n=>({...n,customer_id:c.name}))}} describe={c=>c.phone||c.address}/>{draft.customer_id&&<p>{names.customer_id??'Müşteri seçildi'} · Uygula ile dökümü görüntüleyin.</p>}</div>}
 <details className="analysis-advanced"><summary>Gelişmiş filtreler</summary><div className="analysis-filter-grid">
 {draft.view!=='statement'&&<div><RecordPicker label="Müşteri ara" load={customerLoad} searchRequired onSelect={c=>{set('customer_id',c.id);setNames(n=>({...n,customer_id:c.name}))}} describe={c=>c.phone||c.address}/>{draft.customer_id&&<Button variant="ghost" onClick={()=>set('customer_id','')}>{names.customer_id??'Seçili müşteri'} · Kaldır</Button>}</div>}
 {!registration&&!balances&&<div><RecordPicker label="Çalışan ara" load={userLoad} searchRequired onSelect={u=>{set('created_by',u.id);setNames(n=>({...n,created_by:u.name}))}} describe={u=>u.role==='admin'?'Yönetici':'Çalışan'}/>{draft.created_by&&<Button variant="ghost" onClick={()=>set('created_by','')}>{names.created_by??'Seçili çalışan'} · Kaldır</Button>}</div>}
 {!registration&&!balances&&!requests&&<><div><RecordPicker label="Ürün ara" load={productLoad} searchRequired onSelect={p=>{set('product_id',p.id);setNames(n=>({...n,product_id:p.name}))}} describe={p=>p.is_active?'Aktif':'Pasif'}/>{draft.product_id&&<Button variant="ghost" onClick={()=>set('product_id','')}>{names.product_id??'Seçili ürün'} · Kaldır</Button>}</div>
 <Select label="Ödeme yöntemi" value={draft.method??''} onChange={e=>set('method',e.target.value)}><option value="">Tümü</option><option value="cash">Nakit</option><option value="card">Kart</option><option value="bank">Banka</option></Select>
 <Select label="Satış türü" value={draft.sale_type??''} onChange={e=>set('sale_type',e.target.value)}><option value="">Tümü</option><option value="normal">Normal</option><option value="walk_in">Hızlı satış</option><option value="purchase">Fiş satışı</option><option value="redemption">Fişle teslimat</option></Select></>}
 {!registration&&!balances&&(f.category==='corrections'&&draft.view==='status'?<Select label="Talep durumu" value={draft.status??''} onChange={e=>set('status',e.target.value)}><option value="">Tümü</option><option value="pending">Bekliyor</option><option value="approved">Onaylandı</option><option value="rejected">Reddedildi</option></Select>:<Select label="Satış / ödeme durumu" value={draft.status??''} onChange={e=>set('status',e.target.value)}><option value="">Tümü</option><option value="completed">Tamamlandı</option><option value="cancelled">İptal</option><option value="paid">Ödendi</option><option value="partial">Kısmi ödeme</option><option value="unpaid">Ödenmedi</option></Select>)}
 {f.category==='products'&&<Select label="Sıralama" value={draft.sort??'default'} onChange={e=>set('sort',e.target.value)}><option value="default">Satış tutarı (azalan)</option><option value="quantity_desc">En çok satılan</option><option value="quantity_asc">En az satılan</option><option value="total_asc">En düşük tutar</option></Select>}
 {!registration&&!balances&&!requests&&['vouchers','corrections'].includes(f.category)&&<Select label="Hareket türü" value={draft.kind??''} onChange={e=>set('kind',e.target.value)}><option value="">Tümü</option>{(f.category==='vouchers'?['purchase','redemption','purchase_reversal','redemption_reversal']:['cancellation','record_reversal','external_refund']).map(k=><option key={k} value={k}>{valueLabels[k]}</option>)}</Select>}
 {!registration&&!balances&&!requests&&<><Input label="En az tutar (₺)" inputMode="decimal" value={draft.min??''} onChange={e=>set('min',e.target.value)}/><Input label="En çok tutar (₺)" inputMode="decimal" value={draft.max??''} onChange={e=>set('max',e.target.value)}/></>}
 {f.category==='comparison'&&<><Select label="Karşılaştırma" value={draft.compare_mode??'elapsed'} onChange={e=>set('compare_mode',e.target.value)}><option value="elapsed">Aynı gün sayısı</option><option value="full">Önceki tam dönem</option></Select><Input label="Önceki özel dönem başlangıcı" type="date" value={draft.compare_from??''} onChange={e=>set('compare_from',e.target.value)}/><Input label="Önceki özel dönem bitişi" type="date" value={draft.compare_to??''} onChange={e=>set('compare_to',e.target.value)}/></>}
 </div><Button type="submit">Filtreleri uygula</Button></details>{error&&<p role="alert">{error}</p>}
 </form>
}
function Table({r}:{r:Analysis}){if(!r.data.length)return <EmptyState title="Kayıt bulunamadı" description="Seçili filtrelere uygun kayıt yok."/>;return <div className="analysis-table-scroll" tabIndex={0} role="region" aria-label="Rapor sonuçları"><table className="analysis-table"><thead><tr>{r.columns.map(c=><th key={c.key} className={c.kind==='money'||c.kind==='number'?'money':''}>{c.label}</th>)}</tr></thead><tbody>{r.data.map((row,i)=><tr key={`${String(row.id??row.product_id??i)}:${i}`}>{r.columns.map(c=>{const id=c.link==='customer'?row.customer_id:c.link==='sale'?row.sale_id:c.link==='correction'?row.correction_id:null;return <td key={c.key} className={c.kind==='money'||c.kind==='number'?'money':''}>{c.key==='allocation_count'&&typeof row.allocations_json==='string'?<details><summary>{String(row.allocation_count)} satış</summary>{(JSON.parse(row.allocations_json) as {sale_id:string;amount_kurus:number}[]).map(a=><p key={a.sale_id}><a className="analysis-link" href={`#/satislar/${encodeURIComponent(a.sale_id)}`}>Satış detayı</a> · {formatMoney(a.amount_kurus)}</p>)}</details>:id?<a href={`#/${c.link==='customer'?'musteriler':c.link==='correction'?'duzeltmeler':'satislar'}/${encodeURIComponent(String(id))}`} className="analysis-link">{c.link==='sale'?'Satış detayı':c.link==='correction'?'Talep detayı':display(row[c.key],c.kind)}</a>:display(row[c.key],c.kind)}</td>})}</tr>)}</tbody>{r.category==='customers'&&r.view==='statement'&&<tfoot><tr>{r.columns.map((c,i)=><td key={c.key} className={c.kind==='money'?'money':''}>{i===0?'Dönem toplamı':c.key==='purchased_kurus'?formatMoney(r.metrics.sales_kurus):c.key==='collected_kurus'?formatMoney(r.metrics.receipts_kurus):''}</td>)}</tr></tfoot>}</table></div>}
function Comparison({rows}:{rows:AnalysisRow[]}){return <div className="analysis-table-scroll"><table className="analysis-table"><thead><tr><th>Gösterge</th><th>Önceki dönem</th><th>Seçili dönem</th><th>Değişim</th></tr></thead><tbody>{rows.map(row=>{const key=String(row.key),kind=key.endsWith('_kurus')?'money':'number';return <tr key={key}><td>{metricLabels[key]}</td><td className="money">{display(row.previous,kind)}</td><td className="money">{display(row.current,kind)}</td><td>{Number(row.previous)===0?'Önceki dönem sıfır':new Intl.NumberFormat('tr-TR',{style:'percent',maximumFractionDigits:1}).format((Number(row.current)-Number(row.previous))/Number(row.previous))}</td></tr>})}</tbody></table><p>Önceki dönem: {turkishReportText(String(rows[0]?.previous_period??'—'))}</p></div>}
function ReportWorkspace({filter}:{filter:AnalysisFilter}){
 const statement=filter.category==='customers'&&filter.view==='statement'
 const load=useCallback(()=>filter.category==='customers'&&filter.view==='statement'&&!filter.customer_id?Promise.resolve(undefined):getAnalysis({...filter,trend_interval:filter.period==='year'?'month':'day'}),[filter]),{result,retry}=useResource(JSON.stringify(filter),load)
 const [pdfContent,setPdfContent]=useState<'full'|'transactions'>(statement?'transactions':'full')
 const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('')
 const [chartReport,setChartReport]=useState<Analysis|null>(null),[chartBusy,setChartBusy]=useState(false),[chartError,setChartError]=useState('')
 const [chartPeriod,setChartPeriod]=useState(['week','lastweek'].includes(filter.period)?'week':['month','lastmonth'].includes(filter.period)?'month':filter.period==='year'?'year':'day')
 const chartRequest=useRef(0)

 const r=result?.data,title=statement?'Müşteri alışveriş ve ödeme dökümü':categories[filter.category]?.title??'Raporlar'
 async function changeChartInterval(interval:string){
  if(!r)return
  const request=++chartRequest.current
  setChartBusy(true);setChartError('')
  try {
   const start=new Date(r.range.end_date+'T12:00:00Z'),end=new Date(start)
   if(interval==='week'){
    start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7))
    end.setTime(start.getTime());end.setUTCDate(end.getUTCDate()+6)
   } else if(interval==='month'){
    start.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1,0)
   } else if(interval==='year'){
    start.setUTCMonth(0,1);end.setUTCMonth(11,31)
   }
   const next=await getAnalysis({...filter,period:'custom',from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10),trend_interval:interval==='year'?'month':'day',revision:r.revision})
   if(request===chartRequest.current){setChartReport(next);setChartPeriod(interval)}
  } catch(error){if(request===chartRequest.current)setChartError(error instanceof Error?error.message:'Grafikler güncellenemedi.')}
  finally{if(request===chartRequest.current)setChartBusy(false)}
 }
 const activeCharts=chartReport&&chartReport.revision===r?.revision?chartReport:r
 const chartFilter={...filter,trend_interval:activeCharts?.trend_interval??filter.trend_interval??'day'}
 async function pdf(){if(!r||exporting)return;setExporting(true);setExportError('');try{const full=await getAnalysis({...chartFilter,export:'true',revision:r.revision});const {downloadReportPdf}=await import('./reportPdf');await downloadReportPdf(activeCharts?{...full,trend:activeCharts.trend,trend_interval:activeCharts.trend_interval,chart_range:activeCharts.range}:full,title,reportFilterLabels(full,{...chartFilter,trend_interval:chartPeriod}),pdfContent)}catch(e){setExportError(e instanceof Error?e.message:'PDF indirilemedi.')}finally{setExporting(false)}}
 const main=filter.category==='payments'?['gross_kurus','corrections_kurus','period_net_receipts_kurus','receipts_kurus','cash_kurus','card_kurus','bank_kurus']:filter.category==='vouchers'?['sold_quantity','used_quantity','available_quantity','voucher_receipts_kurus']:['sales_kurus','receipts_kurus','debt_delta_kurus','debt_kurus']
 return <>
 <PageHeader title={title} description="İşletmenizin finansal ve operasyonel performansı." actions={<div className="analysis-export"><Select label="PDF içeriği" disabled={exporting} value={pdfContent} onChange={e=>setPdfContent(e.target.value as 'full'|'transactions')}><option value="full">Özet, grafik ve tablo</option><option value="transactions">Yalnızca tablo</option></Select><Button variant="primary" disabled={!r||chartBusy} loading={exporting} loadingText="Hazırlanıyor…" onClick={pdf}>PDF İndir</Button></div>}/>
 {filter.category!=='overview'&&<a className="analysis-link" href={href({period:filter.period??'today',category:'overview'})}>← Tüm raporlar</a>}
 <Filters key={JSON.stringify(filter)} filter={filter}/>
 {exportError&&<p role="alert" className="analysis-error">{exportError}</p>}
 {statement&&!filter.customer_id?<EmptyState title="Müşteri seçin" description="Alışveriş ve ödeme dökümü için müşteriyi ve tarih aralığını seçip Uygula butonuna basın."/>:!result?<LoadingState label="Rapor hesaplanıyor…"/>:result.error?<ErrorState title="Rapor yüklenemedi" description={result.error} onRetry={retry}/>:r&&<>
 <div className="analysis-period"><span>{turkishDay(r.range.start_date)} — {turkishDay(r.range.end_date)}</span><Button variant="ghost" onClick={retry}><Icon name="rotate"/>Yenile</Button></div>
 {statement&&<p><strong>{r.filter_labels.customer_name}</strong> · Geçerli alışveriş ve ödemeler</p>}
 {!statement&&<dl className="analysis-kpis">{main.map(key=><div key={key}><dt>{metricLabels[key]}</dt><dd>{display(r.metrics[key],key.endsWith('_kurus')?'money':'number')}</dd>{key==='debt_kurus'&&<small>Bugünkü bakiye · dönemden bağımsız</small>}</div>)}</dl>}
 {filter.category==='overview'&&<><dl className="analysis-operations">{['sales_count','average_sale_kurus','damacana_quantity','customers_count','debtors_count','used_quantity'].map(key=><div key={key}><dt>{metricLabels[key]}</dt><dd>{display(r.metrics[key],key.endsWith('_kurus')?'money':'number')}</dd></div>)}</dl><div className="analysis-chart-update-region" aria-busy={chartBusy}>{chartBusy&&<span className="analysis-chart-update-status" role="status">Grafikler güncelleniyor…</span>}{chartError&&<p role="alert" className="analysis-error">{chartError}</p>}<Suspense fallback={<LoadingState label="Grafikler yükleniyor…"/>}><Charts report={activeCharts??r} onIntervalChange={changeChartInterval} selectedPeriod={chartPeriod} busy={chartBusy}/></Suspense></div></>}
 {filter.category!=='overview'&&<>{filter.category==='comparison'&&<Suspense fallback={<LoadingState label="Grafik yükleniyor…"/>}><Charts report={activeCharts??r} onIntervalChange={changeChartInterval} selectedPeriod={chartPeriod} busy={chartBusy}/></Suspense>}{filter.category==='comparison'?<Comparison rows={r.comparison}/>:<Table r={r}/>}{r.pagination.totalPages>1&&filter.category!=='comparison'&&<div className="analysis-pagination"><Button variant="secondary" disabled={r.pagination.page<=1} onClick={()=>{window.location.hash=href({...filter,page:String(r.pagination.page-1)})}}>Önceki</Button><span>{r.pagination.total} kayıt · {r.pagination.page} / {r.pagination.totalPages}</span><Button variant="secondary" disabled={r.pagination.page>=r.pagination.totalPages} onClick={()=>{window.location.hash=href({...filter,page:String(r.pagination.page+1)})}}>Sonraki</Button></div>}</>}
 </>}
 {filter.category==='overview'&&<section><h2>Tüm raporlar</h2><nav className="analysis-categories" aria-label="Rapor kategorileri">{Object.entries(categories).map(([key,c])=><a key={key} href={href({category:key,period:filter.period??'today',...(filter.from?{from:filter.from,to:filter.to}:{})})}><Icon name={c.icon}/><div><strong>{c.title}</strong><p>{c.description}</p></div><Icon name="arrow"/></a>)}</nav></section>}
 </>
}
export function ReportsPage({role}:{role:Role}){
 const hash=useReportLocation(),[path,search]=hash.split('?'),segment=path.replace(/\/$/,'').split('/')[2]||'overview',category=aliases[segment]??segment
 const filter:AnalysisFilter=Object.fromEntries(new URLSearchParams(search));filter.category=category;filter.period??='today';filter.page??='1';filter.pageSize='20';if(filter.view==='sales'||filter.view==='items')filter.view='detail';if(filter.view==='cancelled'){filter.view='detail';filter.status='cancelled'};if(!filter.view)filter.view=categories[category]?.views[0][0]??'detail'
 if(role!=='admin')return <ErrorState title="Yönetici yetkisi gerekli" description="Raporlara yalnızca yöneticiler erişebilir."/>
 if(category!=='overview'&&!categories[category])return <ErrorState title="Rapor bulunamadı" description="Raporlar menüsünden bir kategori seçin."/>
 return <div className="reports-page analysis-page"><ReportWorkspace key={hash} filter={filter}/></div>
}

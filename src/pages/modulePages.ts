import type { IconName } from '../components/ui/Icon'

export const modulePages = {
  customers: {
    title: 'Müşteriler', description: 'Müşteri bilgileri ve hesap hareketleri için çalışma alanı.',
    section: 'Müşteri listesi', sectionDescription: 'Ortak müşteri kayıtları.', icon: 'customers',
    emptyTitle: 'Müşteri verileri henüz bağlı değil',
    emptyDescription: 'Müşteri listesi hizmete bağlandığında kayıtlar burada gösterilecek. Şu anda herhangi bir müşteri kaydı yüklenmedi.',
  },
  sales: {
    title: 'Yeni Satış', description: 'Müşteri, ürün ve ödeme bilgileriyle satış kaydı oluşturma alanı.',
    section: 'Satış kaydı', sectionDescription: 'Müşteri ve ürün seçimine ayrılan alan.', icon: 'sales',
    emptyTitle: 'Satış kaydı henüz hazır değil',
    emptyDescription: 'Müşteri ve ürün bağlantıları tamamlandığında satış kaydı burada oluşturulabilecek. Henüz işlem yapılamıyor.',
  },
  payments: {
    title: 'Tahsilatlar', description: 'Nakit, kart ve banka tahsilatlarını takip etme alanı.',
    section: 'Tahsilat kayıtları', sectionDescription: 'Alınan ödemeler ve ödeme yöntemleri.', icon: 'payments',
    emptyTitle: 'Tahsilat verileri henüz bağlı değil',
    emptyDescription: 'Tahsilat hizmeti bağlandığında ödeme kayıtları burada gösterilecek. Şu anda herhangi bir tahsilat yüklenmedi.',
  },
  credit: {
    title: 'Veresiye', description: 'Müşteri borçları ve hesap hareketlerini takip etme alanı.',
    section: 'Veresiye hesapları', sectionDescription: 'Borç, tahsilat ve kalan tutar bilgileri.', icon: 'credit',
    emptyTitle: 'Borç verileri henüz bağlı değil',
    emptyDescription: 'Hesap hareketleri bağlandığında müşterilerin kalan borçları burada gösterilecek. Verilerin bağlı olmaması borcun sıfır olduğu anlamına gelmez.',
  },
  products: {
    title: 'Ürünler', description: 'Ürün bilgileri, güncel fiyatlar ve aktiflik durumları için çalışma alanı.',
    section: 'Ürün listesi', sectionDescription: 'Satışta kullanılacak ürünler.', icon: 'products',
    emptyTitle: 'Ürün verileri henüz bağlı değil',
    emptyDescription: 'Ürün hizmeti bağlandığında ürünler ve güncel fiyatları burada gösterilecek. Şu anda herhangi bir ürün yüklenmedi.',
  },
} satisfies Record<string, {
  title: string; description: string; section: string; sectionDescription: string
  icon: IconName; emptyTitle: string; emptyDescription: string
}>

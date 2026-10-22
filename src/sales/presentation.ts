const date = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' })
export const saleDate = (value: string) => date.format(new Date(value))
export const methodLabels = { cash: 'Nakit', card: 'Kart', bank: 'Banka' }

import { parsePriceToKurus } from '../utils/format.ts'

// Preview only: the API validates optional prices and recalculates every total atomically.
export function unitPriceValue(text: string): number {
  let value: number
  try { value = parsePriceToKurus(text) }
  catch { throw new RangeError('Birim fiyat pozitif olmalı, en fazla iki ondalık basamak içermeli ve desteklenen tutar sınırını aşmamalı.') }
  if (value === 0) throw new RangeError('Birim fiyat sıfırdan büyük olmalı.')
  return value
}

export function quantityValue(text: string): number {
  if (!/^\d{1,16}$/.test(text)) throw new RangeError('Miktar pozitif tam sayı olmalı.')
  const value = BigInt(text)
  if (value < 1n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Miktar pozitif ve güvenli bir tam sayı olmalı.')
  return Number(value)
}
export function lineTotal(price: number, quantity: string): number {
  if (!Number.isSafeInteger(price) || price < 0) throw new RangeError('Geçersiz ürün fiyatı.')
  const total = BigInt(price) * BigInt(quantityValue(quantity))
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Satır toplamı desteklenen sınırı aşıyor.')
  return Number(total)
}
export function sumLines(lines: { price: number; quantity: string }[]): number {
  const total = lines.reduce((sum, line) => sum + BigInt(lineTotal(line.price, line.quantity)), 0n)
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Satış toplamı desteklenen sınırı aşıyor.')
  return Number(total)
}

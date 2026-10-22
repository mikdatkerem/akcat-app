const integerFormatter = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 })

// Accept ungrouped TL amounts with comma or dot decimals. Never round a decimal price.
export function parsePriceToKurus(value: string): number {
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(value.trim())
  if (!match || match[1].length > 14) throw new RangeError('Sıfır veya daha büyük bir fiyat girin; en fazla iki ondalık basamak kullanın.')
  const kurus = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))
  if (kurus > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Fiyat desteklenen üst sınırı aşıyor.')
  return Number(kurus)
}

export function priceInputFromKurus(kurus: number): string {
  if (!Number.isSafeInteger(kurus) || kurus < 0) throw new RangeError('Geçersiz kuruş tutarı.')
  const amount = BigInt(kurus)
  return `${amount / 100n},${String(amount % 100n).padStart(2, '0')}`
}

/** Tam sayı kuruşu, hesaplama/yuvarlama yapmadan Türkiye biçiminde gösterir. */
export function formatMoney(kurus: number): string {
  if (!Number.isSafeInteger(kurus)) throw new RangeError('Tutar güvenli bir tam sayı kuruş olmalıdır.')
  const absolute = BigInt(Math.abs(kurus))
  const whole = integerFormatter.format(absolute / 100n)
  const fraction = String(absolute % 100n).padStart(2, '0')
  return `${kurus < 0 ? '-' : ''}${whole},${fraction}\u00a0₺`
}

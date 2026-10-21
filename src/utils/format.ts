const integerFormatter = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 })

/** Tam sayı kuruşu, hesaplama/yuvarlama yapmadan Türkiye biçiminde gösterir. */
export function formatMoney(kurus: number): string {
  if (!Number.isSafeInteger(kurus)) throw new RangeError('Tutar güvenli bir tam sayı kuruş olmalıdır.')
  const absolute = BigInt(Math.abs(kurus))
  const whole = integerFormatter.format(absolute / 100n)
  const fraction = String(absolute % 100n).padStart(2, '0')
  return `${kurus < 0 ? '-' : ''}${whole},${fraction}\u00a0₺`
}

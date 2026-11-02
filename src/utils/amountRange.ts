import { parsePriceToKurus } from './format.ts'

export function parseAmountRange(minimum: string, maximum: string) {
  const min = minimum.trim() ? parsePriceToKurus(minimum) : undefined
  const max = maximum.trim() ? parsePriceToKurus(maximum) : undefined
  if (min !== undefined && max !== undefined && min > max) throw new RangeError('Minimum tutar maksimum tutardan büyük olamaz.')
  return { min, max }
}

export function readKurusBound(value: string | null): number | undefined {
  if (value === null || value === '') return undefined
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new RangeError('Filtre adresindeki tutar geçerli değil.')
  return Number(value)
}

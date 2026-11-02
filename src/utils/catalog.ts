import { formatMoney, priceInputFromKurus } from './format'
export const catalogMoney = (value: number | null) => value === null ? 'Fiyat belirlenmemiş' : formatMoney(value)
export const catalogInput = (value: number | null) => value === null ? '' : priceInputFromKurus(value)

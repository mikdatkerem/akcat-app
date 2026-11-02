export type DuplicateMatch = { id: string; name: string; phone_masked: string | null; address_short: string;
  is_active: boolean; strength: 'info' | 'strong'; reasons: string[] }
export type DuplicateResult = { matches: DuplicateMatch[]; same_name_count: number; truncated: boolean }
export type DuplicateChallenge = DuplicateResult & { confirmation: string }
export function readDuplicates(value: unknown): DuplicateResult {
  if (!value || typeof value !== 'object') throw new Error('Eşleşme yanıtı geçersiz.')
  const row = value as DuplicateResult
  if (!Array.isArray(row.matches) || row.matches.length > 10 || !Number.isSafeInteger(row.same_name_count) || row.same_name_count < 0
    || typeof row.truncated !== 'boolean' || !row.matches.every(m => m && typeof m.id === 'string' && /^[a-f0-9-]{36}$/i.test(m.id)
      && typeof m.name === 'string' && (m.phone_masked === null || typeof m.phone_masked === 'string') && typeof m.address_short === 'string'
      && typeof m.is_active === 'boolean' && ['info', 'strong'].includes(m.strength) && Array.isArray(m.reasons) && m.reasons.every(r => typeof r === 'string'))) throw new Error('Eşleşme yanıtı geçersiz.')
  return row
}
export function readChallenge(value: unknown): DuplicateChallenge | null {
  try {
    const result = readDuplicates(value), token = (value as DuplicateChallenge).confirmation
    return result.matches.length && typeof token === 'string' && token.length <= 2048 ? { ...result, confirmation: token } : null
  } catch { return null }
}

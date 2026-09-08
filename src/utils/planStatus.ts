/**
 * Tarif kodi → STATUS nomi. **Static** (bazaga bog'liq emas) va
 * **tarjima qilinmaydi** (uz/en bir xil): Oddiy / O'rta / Yuqori.
 */
const PLAN_STATUS: Record<string, string> = {
  free: 'Oddiy',
  plus: 'O‘rta',
  pro: 'Yuqori',
}

export function planStatusName(code: string | null | undefined, fallback = ''): string {
  if (code && PLAN_STATUS[code]) return PLAN_STATUS[code]
  return fallback
}

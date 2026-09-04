/**
 * Tarif kodi → creative STATUS nomi. **Static** (bazaga bog'liq emas) va
 * **tarjima qilinmaydi** (uz/en bir xil): Qaldirg'och / Jo'shqin / Bo'talog'im.
 */
const PLAN_STATUS: Record<string, string> = {
  free: 'Qaldirg‘och',
  plus: 'Jo‘shqin',
  pro: 'Bo‘talog‘im',
}

export function planStatusName(code: string | null | undefined, fallback = ''): string {
  if (code && PLAN_STATUS[code]) return PLAN_STATUS[code]
  return fallback
}

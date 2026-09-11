/**
 * Username'ning AVTOMATIK yasalganini aniqlaydi.
 *
 * Telegram orqali kirgan, ammo Telegram'da username'i yo'q foydalanuvchiga
 * backend `tg<chat_id>` ko'rinishidagi nom beradi
 * (`backend/apps/accounts/views.py`) — Django `username` maydonini bo'sh
 * qoldirib bo'lmagani uchun.
 *
 * Bu **texnik to'ldiruvchi**, foydalanuvchi tanlagan nom emas. Uni
 * `@tg931716835` deb ko'rsatish noto'g'ri: foydalanuvchi buni o'zining
 * "manzili" deb o'ylaydi va nega "tg" turganini tushunmaydi.
 *
 * Shu bois interfeys uni KO'RSATMAYDI — foydalanuvchi profilda o'zi
 * username qo'ysa, o'shanda paydo bo'ladi.
 */
export function isAutoUsername(username?: string | null): boolean {
  return /^tg\d+$/.test((username || '').trim())
}

/** Ko'rsatishga yaroqli username yoki `null` (avtomatik bo'lsa). */
export function displayHandle(username?: string | null): string | null {
  const value = (username || '').trim()
  return !value || isAutoUsername(value) ? null : value
}

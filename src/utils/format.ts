/**
 * Sekundlarni foydalanuvchi ko'rinishida beradi.
 *
 * Hozircha faqat sekund — test uchun (60+ ga borsa ham `m`/`h` ga o'girmaymiz).
 * Masalan: 45 → "45s", 6115 → "6115s".
 */
export function formatMinutes(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${s}s`
}

/**
 * Matndagi `{kalit}` o'rniga qiymat qo'yadi.
 *
 * i18n lug'ati (`src/i18n/strings.ts`) faqat **satrlardan** iborat bo'lishi
 * kerak — `Strings = typeof uz` tipi shunga tayanadi va funksiya qo'shilsa
 * TS xato beradi. Shu bois o'rin almashtiruvchi matnlar `{n}` / `{plan}`
 * ko'rinishida yoziladi va shu yordamchi bilan to'ldiriladi.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  )
}

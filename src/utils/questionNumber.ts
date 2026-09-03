/**
 * Savol raqami — serverdagi xronologik `number`, bo'lmasa pozitsiya.
 *
 * Server har savolga videoning xronologik tartibidagi raqamini yozadi
 * (`backend/apps/catalog/shorts_pipeline.py::_number_globally`), ya'ni
 * 1-savolning javobi DOIM eng oldin eshitiladi. Mijoz raqamni o'zi
 * hisoblamasligi kerak: pozitsiya bo'yicha hisoblash aynan "3, 1, 2, 4"
 * muammosini keltirib chiqargan edi (MCQ videoni boshdan-oxir bosib
 * o'tardi, keyin TFNG yana boshidan boshlanardi).
 *
 * `fallback` — eski yozuvlar uchun (server tuzatilishidan oldin
 * yaratilganlarida `number` yo'q). Ularni
 * `manage.py fix_question_order --apply` bilan to'ldirish mumkin.
 */
export function qNum(q: { number?: number } | undefined, fallback: number): number {
  const n = q?.number
  return typeof n === 'number' && n > 0 ? n : fallback
}

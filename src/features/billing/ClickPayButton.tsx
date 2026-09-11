import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clickCheckout, clickOrderStatus } from '@/api/endpoints'
import { Spinner } from '@/components/ui'
import { useLang, useT } from '@/i18n'

/** Click'dan qaytganda manzilda shu parametr bo'ladi (`links.py::_with_order`). */
const RETURN_PARAM = 'click_order'

/** Necha marta so'raymiz (3 soniyada bir) — ~30 soniya. */
const MAX_TRIES = 10

/**
 * Manzildan buyurtma raqamini o'qiydi va **darrov tozalaydi**.
 *
 * Tozalash muhim: foydalanuvchi sahifani yangilasa yoki havolani ulashsa,
 * eski buyurtma qayta-qayta so'ralib, "to'lov tekshirilmoqda" holati
 * yopishib qolardi.
 */
function takeReturnedOrder(): number | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const raw = params.get(RETURN_PARAM)
  if (!raw) return null
  params.delete(RETURN_PARAM)
  const rest = params.toString()
  window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

/**
 * "Click orqali to'lash" tugmasi + qaytgandan keyingi natija.
 *
 * **Nega natija serverdan so'raladi.** Click'da to'lovni brauzer emas,
 * Click serveri tasdiqlaydi (`POST /api/click/complete/`). `return_url` ni
 * foydalanuvchi qo'lda ham ochishi mumkin, shu bois unga ISHONMAYMIZ —
 * buyurtma holatini har doim o'z API'mizdan o'qiymiz.
 *
 * **Har holatda CHIQISH yo'li bor.** Foydalanuvchi Click sahifasiga o'tib,
 * to'lamasdan qaytishi mumkin (fikridan qaytdi, karta ishlamadi, ...). Unda
 * buyurtma hech qachon tasdiqlanmaydi va tekshiruv abadiy davom etardi —
 * "qayta to'lash" tugmasi shu bois HAR DOIM ko'rinadi.
 */
export function ClickPayButton({ plan, months = 1, amountUzs, disabled }: {
  plan: string
  months?: number
  /** Tugmada ko'rsatiladigan summa — foydalanuvchi Click sahifasida
   *  kutilmagan raqamni ko'rmasligi uchun OLDINDAN aytamiz. */
  amountUzs?: number
  disabled?: boolean
}) {
  const t = useT()
  const { lang } = useLang()
  const queryClient = useQueryClient()
  const [returnedOrder, setReturnedOrder] = useState<number | null>(null)
  const [tries, setTries] = useState(0)

  useEffect(() => { setReturnedOrder(takeReturnedOrder()) }, [])

  const status = useQuery({
    queryKey: ['click-order', returnedOrder],
    queryFn: () => clickOrderStatus(returnedOrder!),
    enabled: returnedOrder != null,
    // Click `Complete` ni to'lovdan keyin yuboradi — bir necha soniya
    // kechikishi normal.
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || data.paid || data.status === 'rejected') return false
      return tries < MAX_TRIES ? 3000 : false
    },
  })

  // Hisoblagich `data` ga EMAS, `dataUpdatedAt` ga bog'langan.
  //
  // React Query "structural sharing" qiladi: javob o'zgarmasa `data`
  // obyektining HAVOLASI ham o'zgarmaydi. `data` ga bog'lansak effekt bir
  // marta ishlab, `tries` 1 da qotib qolardi — natijada "Yangilash" tugmasi
  // (u `tries >= MAX_TRIES` da chiqadi) hech qachon paydo bo'lmasdi va
  // "Tekshirilmoqda..." abadiy turardi. `dataUpdatedAt` esa har
  // muvaffaqiyatli so'rovda o'zgaradi.
  useEffect(() => {
    if (!status.dataUpdatedAt) return
    setTries((n) => n + 1)
  }, [status.dataUpdatedAt])

  const paid = status.data?.paid
  useEffect(() => {
    if (!paid) return
    queryClient.invalidateQueries({ queryKey: ['wallet'] })
    queryClient.invalidateQueries({ queryKey: ['me'] })
    queryClient.invalidateQueries({ queryKey: ['my-limits'] })
  }, [paid, queryClient])

  const start = useMutation({
    mutationFn: () => clickCheckout(plan, months),
    onSuccess: (data) => {
      // Click'ning O'Z sahifasiga o'tamiz. `replace` EMAS: foydalanuvchi
      // "orqaga" bosib saytga qayta olishi kerak.
      window.location.href = data.pay_url
    },
  })

  /** Tekshiruvdan chiqib, yana to'lov tugmasiga qaytaradi. */
  const payAgain = () => {
    setReturnedOrder(null)
    setTries(0)
  }

  if (returnedOrder != null) {
    const failed = status.data?.status === 'rejected'
    const timedOut = !paid && !failed && tries >= MAX_TRIES
    const checking = !paid && !failed && !timedOut

    return (
      <div className="card" style={{
        padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        borderColor: paid ? '#10B981' : failed ? '#EF4444' : '#F59E0B',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {checking && <Spinner />}
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            {paid ? t.payClickPaid
              : failed ? t.payClickFailed
              : timedOut ? t.payClickNotPaid
              : t.payClickChecking}
          </span>
        </div>

        {/* To'lanmagan HAR QANDAY holatda chiqish yo'li bor. */}
        {!paid && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {timedOut && (
              <button className="btn" onClick={() => { setTries(0); status.refetch() }}>
                {t.payRefresh}
              </button>
            )}
            <button className="btn btn-ghost" onClick={payAgain}>
              {t.payTryAgain}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    // Izoh 1-bosqichdagi kartochkada turibdi (`PaymentFlow.tsx`), shu bois
    // tugmada takrorlanmaydi — faqat amal.
    <button
      onClick={() => start.mutate()}
      disabled={disabled || start.isPending}
      style={{
        width: '100%', border: 'none', borderRadius: 12, cursor: 'pointer',
        padding: '12px 16px', fontSize: 14.5, fontWeight: 800, color: '#FFF',
        background: start.isPending ? '#6AA9FF' : '#0D7FFC',
        boxShadow: '0 4px 14px rgba(13,127,252,.30)',
      }}
    >
      {start.isPending ? t.payClickOpening
        : amountUzs ? `${t.payWithClick} · ${money(amountUzs, lang)}`
        : t.payWithClick}
    </button>
  )
}

function money(uzs: number, lang: string) {
  const value = uzs.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU').replace(/ /g, ' ')
  return lang === 'en' ? `${value} UZS` : `${value} so'm`
}

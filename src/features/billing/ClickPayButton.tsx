import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clickCheckout, clickOrderStatus } from '@/api/endpoints'
import { Spinner } from '@/components/ui'
import { useT } from '@/i18n'

/** Click'dan qaytganda manzilda shu parametr bo'ladi (`links.py::_with_order`). */
const RETURN_PARAM = 'click_order'

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
 * Tasdiq bir necha soniya kechikishi mumkin (Click Complete'ni to'lovdan
 * keyin yuboradi), shuning uchun qisqa muddat qayta so'raymiz.
 */
export function ClickPayButton({ plan, months = 1, disabled }: {
  plan: string
  months?: number
  disabled?: boolean
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [returnedOrder, setReturnedOrder] = useState<number | null>(null)
  const [tries, setTries] = useState(0)

  useEffect(() => { setReturnedOrder(takeReturnedOrder()) }, [])

  const status = useQuery({
    queryKey: ['click-order', returnedOrder],
    queryFn: () => clickOrderStatus(returnedOrder!),
    enabled: returnedOrder != null,
    // Click `Complete` ni to'lovdan keyin yuboradi — bir necha soniya
    // kechikishi normal. 3 soniyada bir so'raymiz, 10 martadan keyin
    // to'xtaymiz (~30s) va foydalanuvchiga "Yangilash" tugmasini beramiz.
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || data.paid || data.status === 'rejected') return false
      return tries < 10 ? 3000 : false
    },
  })

  useEffect(() => {
    if (!status.data) return
    setTries((n) => n + 1)
    if (status.data.paid) {
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['my-limits'] })
    }
  }, [status.data, queryClient])

  const start = useMutation({
    mutationFn: () => clickCheckout(plan, months),
    onSuccess: (data) => {
      // Click'ning O'Z sahifasiga o'tamiz. `replace` EMAS: foydalanuvchi
      // "orqaga" bosib saytga qayta olishi kerak.
      window.location.href = data.pay_url
    },
  })

  if (returnedOrder != null) {
    const data = status.data
    const done = data?.paid
    const failed = data?.status === 'rejected'
    const waiting = !done && !failed

    return (
      <div className="card" style={{
        padding: 16, borderColor: done ? '#10B981' : failed ? '#EF4444' : '#F59E0B',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        {waiting && status.isFetching && <Spinner />}
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          {done ? t.payClickPaid : failed ? t.payClickFailed
            : tries < 10 ? t.payClickChecking : t.payClickNotPaid}
        </span>
        {waiting && tries >= 10 && (
          <button className="btn" onClick={() => { setTries(0); status.refetch() }}>
            {t.payRefresh}
          </button>
        )}
      </div>
    )
  }

  return (
    <button
      className="btn btn-primary"
      onClick={() => start.mutate()}
      disabled={disabled || start.isPending}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
    >
      <span style={{ fontWeight: 800 }}>
        {start.isPending ? t.payClickOpening : t.payWithClick}
      </span>
      <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>{t.payWithClickHint}</span>
    </button>
  )
}

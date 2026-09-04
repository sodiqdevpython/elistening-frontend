import { type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/Layout'
import { useLang } from '@/i18n'

/**
 * Akkauntni o'chirish sahifasi — ochiq URL (`/delete-account`). Google Play
 * "Delete account URL" talabi uchun: qadamlar + qaysi ma'lumot o'chadi + qancha
 * saqlanadi. Login shart emas.
 */
const BRAND = 'eListening.uz'
const CONTACT_BOT = '@elistening_bot'

export default function DeleteAccountPage() {
  const { lang } = useLang()
  const uz = lang !== 'en'
  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 780 }}>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
          {uz ? 'Akkauntni o‘chirish' : 'Delete your account'}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>{BRAND}</div>

        {uz ? (
          <>
            <P>
              {BRAND} akkauntingizni va u bilan bog‘liq ma‘lumotlarni o‘chirishni istalgan
              vaqtda so‘rashingiz mumkin.
            </P>
            <H>Qanday so‘raladi</H>
            <List items={[
              'Ilovaga (yoki saytga) kiring.',
              'Profil sahifasini oching.',
              '“Akkauntni o‘chirish” tugmasini bosing va tasdiqlang.',
              `Muqobil yo‘l: Telegram bot ${CONTACT_BOT} ga yozib ham so‘rashingiz mumkin.`,
            ]} />
            <H>Qaysi ma‘lumot o‘chiriladi</H>
            <List items={[
              'Profilingiz: ismingiz, foydalanuvchi nomingiz, profil rasmi (avatar).',
              'Telegram ID va bog‘liq kirish ma‘lumotlari.',
              'Faoliyatingiz: tinglash statistikasi, progress, reyting ballari.',
            ]} />
            <H>Muddat</H>
            <P>
              So‘rovdan so‘ng ma‘lumotlaringiz <b>60 kun</b> ichida tizimdan butunlay
              o‘chiriladi — hech qanday iz qolmaydi. Shu 60 kun ichida qayta kirsangiz,
              o‘chirish <b>bekor</b> bo‘ladi va akkauntingiz saqlanib qoladi.
            </P>
            <P style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Vaqtinchalik yuklangan audio (transkript uchun) baribir saqlanmaydi — u darrov
              o‘chiriladi.
            </P>
          </>
        ) : (
          <>
            <P>
              You can request deletion of your {BRAND} account and its associated data at any time.
            </P>
            <H>How to request</H>
            <List items={[
              'Sign in to the app (or the website).',
              'Open your Profile page.',
              'Tap “Delete account” and confirm.',
              `Alternatively, you can request it by messaging the Telegram bot ${CONTACT_BOT}.`,
            ]} />
            <H>What gets deleted</H>
            <List items={[
              'Your profile: display name, username, profile photo (avatar).',
              'Your Telegram ID and related sign-in data.',
              'Your activity: listening statistics, progress, leaderboard points.',
            ]} />
            <H>Timeline</H>
            <P>
              After your request, your data is completely removed from our systems within
              <b> 60 days</b>, leaving no trace. If you sign in again within those 60 days,
              the deletion is <b>cancelled</b> and your account is kept.
            </P>
            <P style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Temporarily downloaded audio (for transcription) is never stored — it is deleted immediately.
            </P>
          </>
        )}

        <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <Link to="/privacy" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {uz ? 'Maxfiylik siyosati' : 'Privacy Policy'}
          </Link>
        </div>
      </div>
    </>
  )
}

function H({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 18, fontWeight: 800, margin: '22px 0 8px' }}>{children}</h2>
}
function P({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ fontSize: 15, lineHeight: 1.6, margin: '0 0 10px', ...style }}>{children}</p>
}
function List({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: 20, margin: '0 0 10px', fontSize: 15, lineHeight: 1.7 }}>
      {items.map((it) => <li key={it}>{it}</li>)}
    </ul>
  )
}

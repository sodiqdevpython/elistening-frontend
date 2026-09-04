import { type ReactNode } from 'react'
import { PageHeader } from '@/components/Layout'
import { useLang } from '@/i18n'

/**
 * Maxfiylik siyosati — ochiq sahifa (`/privacy`). Google Play har bir ilovadan
 * internetda ochiq turgan maxfiylik sahifasini talab qiladi. Login shart emas.
 *
 * Til (uz/en) navbardagi tanlovga qarab ko'rsatiladi. Brend: **eListening.uz**.
 */
const BRAND = 'eListening.uz'
const CONTACT_BOT = '@elistening_bot'
const UPDATED = '2026-09-04'

export default function PrivacyPage() {
  const { lang } = useLang()
  const uz = lang !== 'en'
  return (
    <>
      <PageHeader />
      <div className="page" style={{ maxWidth: 820 }}>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
          {uz ? 'Maxfiylik siyosati' : 'Privacy Policy'}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
          {BRAND} · {uz ? 'Yangilangan' : 'Last updated'}: {UPDATED}
        </div>

        {uz ? <Uz /> : <En />}

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13 }}>
          {uz
            ? `Savollar yoki ma'lumotni o'chirish so'rovi uchun Telegram bot ${CONTACT_BOT} orqali bog'laning.`
            : `For questions or a data-deletion request, contact us via the Telegram bot ${CONTACT_BOT}.`}
        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text)' }}>{children}</div>
    </section>
  )
}

function Uz() {
  return (
    <>
      <Section title="Umumiy">
        {BRAND} — ingliz tilini tinglab tushunish platformasi. Ushbu siyosat qanday
        ma'lumotlarni yig'ishimiz, nima uchun ishlatishimiz va siz ularni qanday
        boshqarishingiz mumkinligini tushuntiradi.
      </Section>

      <Section title="Qanday ma'lumot yig'iladi">
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li><b>Telegram ma'lumotlari</b> — Telegram ID va (agar bergan bo'lsangiz)
            foydalanuvchi nomingiz. Kirish (login) Telegram bot orqali amalga oshadi.</li>
          <li><b>Profil</b> — ko'rsatiladigan ismingiz, ingliz tili darajangiz (CEFR),
            va ixtiyoriy profil rasmingiz (avatar).</li>
          <li><b>Faoliyat</b> — tinglash statistikasi (tugatilgan mashqlar, kunlik
            tinglash vaqti, reyting ballari) va progress.</li>
          <li><b>Texnik</b> — sessiyani xavfsiz saqlash uchun qurilma turi (brauzer/
            ilova) va IP manzil. So'rovlarni cheklash (xavfsizlik) uchun ishlatiladi.</li>
        </ul>
        Biz <b>parol, karta yoki bank ma'lumotlarini yig'MAYMIZ</b>. Kirish faqat
        Telegram orqali 1 daqiqalik bir martalik kod bilan.
      </Section>

      <Section title="Nima uchun ishlatiladi">
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>Akkauntingizni yaratish va tizimga kirgizish;</li>
          <li>Progressingiz, reyting va tinglash vaqtini ko'rsatish;</li>
          <li>Kontentni darajangizga moslashtirish;</li>
          <li>Xizmatni xavfsiz ushlab turish (spam/bot va suiiste'molga qarshi).</li>
        </ul>
        Ma'lumotlaringizni <b>reklama uchun sotmaymiz</b> va uchinchi tomonlarga
        savdo maqsadida bermaymiz.
      </Section>

      <Section title="YouTube kontenti">
        Video kontent YouTube'ning rasmiy plyeri orqali ko'rsatiladi va
        YouTube API Xizmatlaridan foydalanadi. YouTube'ning maxfiylik siyosati
        (<a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a>)
        ham qo'llaniladi.
      </Section>

      <Section title="Qancha saqlanadi">
        Ma'lumotlaringiz akkauntingiz faol bo'lgan davrda saqlanadi. Vaqtinchalik
        yuklangan audio (transkript uchun) darhol o'chiriladi — serverda saqlanmaydi.
        Akkauntni o'chirishni so'rasangiz, shaxsiy ma'lumotlaringiz o'chiriladi.
      </Section>

      <Section title="Ma'lumotni o'chirish (sizning huquqingiz)">
        Istalgan vaqtda akkauntingizni va u bilan bog'liq shaxsiy ma'lumotlarni
        o'chirishni so'rashingiz mumkin — <b>Profil</b> sahifasidagi "Akkauntni
        o'chirish" tugmasi orqali (yoki Telegram bot {CONTACT_BOT} ga yozib).
        So'rovdan so'ng ma'lumotlaringiz <b>60 kun</b> ichida butunlay o'chiriladi.
        Shu muddat ichida qayta kirsangiz, o'chirish bekor bo'ladi. Batafsil:{' '}
        <a href="/delete-account">Akkauntni o'chirish</a>.
      </Section>

      <Section title="Bolalar">
        Xizmat 13 yoshdan kichik bolalarga mo'ljallanmagan.
      </Section>

      <Section title="O'zgarishlar">
        Ushbu siyosat vaqti-vaqti bilan yangilanishi mumkin. O'zgarish bo'lsa,
        yuqoridagi "Yangilangan" sanasi o'zgaradi.
      </Section>
    </>
  )
}

function En() {
  return (
    <>
      <Section title="Overview">
        {BRAND} is an English listening-comprehension platform. This policy explains
        what data we collect, why we use it, and how you can control it.
      </Section>

      <Section title="What we collect">
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li><b>Telegram data</b> — your Telegram ID and (if provided) username.
            Sign-in happens through our Telegram bot.</li>
          <li><b>Profile</b> — your display name, English level (CEFR), and an
            optional profile photo (avatar).</li>
          <li><b>Activity</b> — listening statistics (completed exercises, daily
            listening time, leaderboard points) and progress.</li>
          <li><b>Technical</b> — device type (browser/app) and IP address, used to
            keep your session secure and to rate-limit abuse.</li>
        </ul>
        We do <b>NOT</b> collect passwords, card, or bank details. Sign-in is only
        via a 1-minute one-time code from Telegram.
      </Section>

      <Section title="Why we use it">
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>To create your account and sign you in;</li>
          <li>To show your progress, leaderboard, and listening time;</li>
          <li>To tailor content to your level;</li>
          <li>To keep the service secure (anti-spam/bot and abuse prevention).</li>
        </ul>
        We do <b>not sell</b> your data for advertising or share it with third
        parties for commercial purposes.
      </Section>

      <Section title="YouTube content">
        Video content is shown via YouTube's official player and uses YouTube API
        Services. Google's Privacy Policy
        (<a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">policies.google.com/privacy</a>)
        also applies.
      </Section>

      <Section title="Retention">
        Your data is kept while your account is active.
        If you request account deletion, your personal data is removed.
      </Section>

      <Section title="Deleting your data (your right)">
        You can request deletion of your account and associated personal data at any
        time from the <b>Profile</b> page via the "Delete account" button (or by
        messaging the Telegram bot {CONTACT_BOT}). After your request, your data is
        completely removed within <b>60 days</b>. If you sign in again within that
        period, the deletion is cancelled. Details:{' '}
        <a href="/delete-account">Delete account</a>.
      </Section>

      <Section title="Children">
        The service is not directed to children under 13.
      </Section>

      <Section title="Changes">
        This policy may be updated from time to time. If it changes, the "Last
        updated" date above will change.
      </Section>
    </>
  )
}

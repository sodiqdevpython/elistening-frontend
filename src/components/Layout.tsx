import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useLang, useT } from '@/i18n'
import { useTheme } from '@/theme/ThemeProvider'
import { useAuth } from '@/store/auth'
import { fetchSiteConfig } from '@/api/endpoints'
import { HeadphoneIcon, MoonIcon, SunIcon } from './ui'
import { formatMinutes } from '@/utils/format'
import LimitGate from './LimitGate'

/**
 * Navbar'da bugungi tinglash vaqti — istalgan sahifada ko'rinib turadi.
 * Auth store `today_seconds` ni yangilaydi (dars davomida audio play qilinganda).
 */
function TodayTimeIndicator() {
  const t = useT()
  const { user, isLoggedIn } = useAuth()
  if (!isLoggedIn || !user) return null
  return (
    <span title={t.todayListenTime}
      data-today-pill
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
        background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
        border: '1px solid var(--border)',
      }}>
      <HeadphoneIcon size={14} strokeWidth={1.8} />
      {formatMinutes(user.today_seconds)}
    </span>
  )
}

const NAV = [
  { to: '/', key: 'tabCatalog', end: true },
  { to: '/shorts', key: 'tabShorts' },
  { to: '/ielts-tests', key: 'tabIeltsTests' },
  // "Videolar" / "Filmlar" / "Multfilmlar" / "Yangiliklar" — kontent ko'p
  // bo'lgan diktant mavzularini ko'rsatamiz (Shorts feed'lari bo'sh bo'lishi
  // mumkin). Bir yerdan foydalanuvchi haqiqiy videolarni ko'radi.
  { to: '/topics/random-videos', key: 'tabVideos' },
  { to: '/movies', key: 'tabMovies' },
  { to: '/cartoons', key: 'tabCartoons' },
  { to: '/topics/news', key: 'tabNews' },
  { to: '/leaderboard', key: 'tabLeaderboard' },
] as const

export function Logo() {
  const t = useT()
  return (
    <Link to="/" style={{
      display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: 'linear-gradient(135deg,#10B981 0%,#059669 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <HeadphoneIcon size={18} color="#FFFFFF" strokeWidth={2} />
      </div>
      <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>{t.appName}</span>
    </Link>
  )
}

/** Sahifa ustidagi logo + profil/kirish qatori. */
export function PageHeader({ children }: { children?: React.ReactNode }) {
  const t = useT()
  const { user, isLoggedIn } = useAuth()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px clamp(16px,4vw,48px)', borderBottom: '1px solid var(--border)',
      flexWrap: 'wrap', gap: 12,
    }}>
      <Logo />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {children}
        {isLoggedIn ? (
          <Link to="/profile" aria-label={t.tabProfile} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg,#10B981 0%,#2563EB 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#FFF', textDecoration: 'none',
          }}>{user?.initial ?? '?'}</Link>
        ) : (
          <Link to="/auth" className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: 13, borderRadius: 20, textDecoration: 'none' }}>
            {t.loginCta}
          </Link>
        )}
      </div>
    </div>
  )
}

export default function Layout() {
  const t = useT()
  const { lang, toggleLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const { isLoggedIn } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // "Bog'lanish" — admin kiritgan Telegram username. Bo'sh bo'lsa menyuda
  // ko'rinmaydi. Bir marta yuklaymiz (uzoq keshlaymiz — kamdan-kam o'zgaradi).
  const { data: siteConfig } = useQuery({
    queryKey: ['site-config'],
    queryFn: fetchSiteConfig,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  })
  const contactTg = siteConfig?.contact_telegram?.trim() || ''

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    background: active ? 'var(--card-bg)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--navbar-text-muted)',
    boxShadow: active ? '0 2px 8px rgba(15,23,42,.15)' : 'none',
    cursor: 'pointer', border: 'none', whiteSpace: 'nowrap', textDecoration: 'none',
  })

  const toggleBtn: React.CSSProperties = {
    border: '1px solid var(--navbar-border)', background: 'transparent',
    color: 'var(--navbar-text)', fontSize: 12, fontWeight: 700,
    padding: '6px 12px', borderRadius: 16, cursor: 'pointer', letterSpacing: '.02em',
  }

  return (
    <div className="app-bg">
      {/* Fon halqalari */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '8%', right: '-6%', width: 340, height: 340, borderRadius: '50%', border: '26px solid var(--ring-color)', opacity: .6 }} />
        <div style={{ position: 'absolute', top: '32%', left: '2%', width: 120, height: 120, borderRadius: '50%', border: '16px solid var(--ring-color)', opacity: .5 }} />
        <div style={{ position: 'absolute', top: '42%', right: '2%', width: 150, height: 150, borderRadius: '50%', border: '18px solid var(--ring-color)', opacity: .5 }} />
      </div>

      <nav style={{
        position: 'sticky', top: 0, zIndex: 50, background: 'var(--navbar-bg)',
        borderBottom: '1px solid var(--navbar-border)', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '10px clamp(12px,3vw,20px)', flexWrap: 'wrap',
      }}>
        <button onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}
          aria-label={t.menu} className="menu-toggle" style={{ ...toggleBtn, display: 'none' }}>
          ☰ {t.menu}
        </button>

        <div className="nav-links" style={{
          display: 'flex', gap: 4, flexWrap: 'wrap',
          background: 'rgba(128,128,128,.08)', padding: 4, borderRadius: 24,
        }}>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false}
              style={({ isActive }) => pillStyle(isActive)}>
              {t[item.key]}
            </NavLink>
          ))}
          {contactTg && (
            <a href={`https://t.me/${contactTg}`} target="_blank" rel="noreferrer"
              style={pillStyle(false)}>
              {t.tabContact}
            </a>
          )}
          <NavLink to={isLoggedIn ? '/profile' : '/auth'} style={({ isActive }) => pillStyle(isActive)}>
            {isLoggedIn ? t.tabProfile : t.tabAuth}
          </NavLink>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TodayTimeIndicator />
          <button onClick={toggleTheme}
            style={{ ...toggleBtn, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', lineHeight: 0 }}
            aria-label={theme === 'light' ? t.themeDark : t.themeLight}>
            {theme === 'light' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
          </button>
          <button onClick={toggleLang} style={toggleBtn} aria-label={t.languageAria}>
            {lang === 'uz' ? 'UZ' : 'EN'}
          </button>
        </div>
      </nav>

      {/* Mobil menyu */}
      {menuOpen && (
        <div className="mobile-menu" style={{
          position: 'sticky', top: 56, zIndex: 49, background: 'var(--navbar-bg)',
          borderBottom: '1px solid var(--navbar-border)',
          padding: 12, display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false}
              style={({ isActive }) => ({ ...pillStyle(isActive), textAlign: 'left' })}>
              {t[item.key]}
            </NavLink>
          ))}
          {contactTg && (
            <a href={`https://t.me/${contactTg}`} target="_blank" rel="noreferrer"
              style={{ ...pillStyle(false), textAlign: 'left' }}>
              {t.tabContact}
            </a>
          )}
        </div>
      )}

      <main style={{ position: 'relative', zIndex: 1 }}>
        <Outlet />
      </main>

      {/* Footer — maxfiylik havolasi (Google Play ochiq URL talab qiladi).
          Shorts to'liq-ekran bo'lgani uchun u yerda ko'rsatilmaydi. */}
      {!location.pathname.startsWith('/shorts') && (
        <footer style={{
          textAlign: 'center', padding: '26px 16px', marginTop: 12,
          color: 'var(--text-secondary)', fontSize: 13,
          borderTop: '1px solid var(--border)',
        }}>
          <Link to="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            {t.privacyPolicy}
          </Link>
          {` · © ${new Date().getFullYear()} ${t.appName}`}
        </footer>
      )}

      {/* Kunlik limit oynasi — istalgan endpoint 403 `limit_reached` qaytarsa
          ochiladi (ilova darajasida bitta nusxa). */}
      <LimitGate />

      {/* Shorts uchun tez kirish tugmasi — labeled pill (ikonka + matn),
          shu bois foydalanuvchi nima ekanligini bir qarashda tushunadi. */}
      {!location.pathname.startsWith('/shorts') && (
        <Link to="/shorts" aria-label={t.tabShorts} style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 60,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 16px 10px 12px', borderRadius: 999,
          background: 'var(--text)', color: 'var(--bg)',
          boxShadow: '0 6px 20px rgba(0,0,0,.18)',
          fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="2" width="14" height="20" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M10 9L15 12L10 15V9Z" fill="currentColor" />
          </svg>
          {t.tabShorts}
        </Link>
      )}

      <style>{`
        @media (max-width: 860px) {
          .nav-links { display: none !important; }
          .menu-toggle { display: inline-flex !important; }
        }
      `}</style>
    </div>
  )
}

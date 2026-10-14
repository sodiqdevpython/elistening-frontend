/** Foydalanuvchi rasmi; rasm qo'ymagan bo'lsa — bosh harf gradient doirada. */
export default function UserAvatar({ url, initial, size = 28 }: {
  url?: string | null
  initial: string
  size?: number
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
      />
    )
  }
  return (
    <div aria-hidden style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#10B981 0%,#2563EB 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.43), fontWeight: 700, color: '#FFF',
    }}>{initial || '?'}</div>
  )
}

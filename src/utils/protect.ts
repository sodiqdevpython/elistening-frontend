/**
 * Serverdan "o'ralgan" holda kelgan kontentni ochish.
 *
 * ## Bu NIMA emas
 *
 * Bu shifrlash emas, **obfuskatsiya**. Parol shu bundle ichida — ya'ni qat'iy
 * qaror qilgan odam uni topib, hamma narsani ocha oladi. Maqsad boshqa:
 * `curl https://.../api/shorts/` deb JSON'ni olib, transkript va savollarni
 * tayyor holda ko'chirib ketishni ma'nosiz qilish.
 *
 * Server tomoni: `backend/apps/common/protect.py`.
 * Mobil tomoni: `mobile/src/utils/protect.ts` (AYNAN shu fayl).
 * **Uchalasini birga o'zgartiring**, aks holda kontent ochilmaydi.
 *
 * ## Format
 *
 *     "v1:" + base64( offset(2 bayt, big-endian) + xor(json_bytes) )
 *
 * JSON server tomonda `ensure_ascii` bilan yoziladi, ya'ni bayt oqimi sof
 * ASCII — shu bois bu yerda UTF-8 dekoderi KERAK EMAS (`String.fromCharCode`
 * yetadi), non-ASCII belgilar esa `\uXXXX` bo'lib `JSON.parse` da tiklanadi.
 */

const PREFIX = 'v1:'
const TABLE_LEN = 4096

/**
 * Server bilan bir xil bo'lishi SHART (`CONTENT_SECRET`).
 *
 * `import.meta.env` faqat Vite bundle'ida mavjud — algoritmni node ostida
 * tekshiruvchi skript uchun ehtiyot bo'lib o'qiymiz.
 */
const SECRET = (import.meta.env?.VITE_CONTENT_SECRET as string) || 'sodiq2005.py'

let cachedFor = ''
let cachedTable: Uint8Array | null = null

/** RC4 (drop-256) kalit oqimi — parol uchun bir marta hisoblanadi. */
function keystream(secret: string): Uint8Array {
  if (cachedTable && cachedFor === secret) return cachedTable
  const key: number[] = []
  for (let i = 0; i < secret.length; i++) key.push(secret.charCodeAt(i) & 0xff)
  if (!key.length) key.push(120)

  const s = new Uint8Array(256)
  for (let i = 0; i < 256; i++) s[i] = i
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xff
    const tmp = s[i]; s[i] = s[j]; s[j] = tmp
  }

  const out = new Uint8Array(TABLE_LEN)
  let a = 0
  let b = 0
  // Server ham birinchi 256 baytni tashlaydi (RC4 ning qiya boshlanishi).
  for (let n = 0; n < 256; n++) {
    a = (a + 1) & 0xff
    b = (b + s[a]) & 0xff
    const tmp = s[a]; s[a] = s[b]; s[b] = tmp
  }
  for (let n = 0; n < TABLE_LEN; n++) {
    a = (a + 1) & 0xff
    b = (b + s[a]) & 0xff
    const tmp = s[a]; s[a] = s[b]; s[b] = tmp
    out[n] = s[(s[a] + s[b]) & 0xff]
  }
  cachedFor = secret
  cachedTable = out
  return out
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
let b64map: Int16Array | null = null

/**
 * base64 → baytlar. `atob` ga tayanmaymi z: u brauzerda bor, lekin bu fayl
 * mobil ilovada ham AYNAN shu holda ishlatiladi va u yerda `atob` hamma
 * muhitda kafolatlanmagan. 15 qator kod — bog'liqlikdan xoli.
 */
function fromBase64(text: string): Uint8Array {
  if (!b64map) {
    b64map = new Int16Array(128).fill(-1)
    for (let i = 0; i < B64.length; i++) b64map[B64.charCodeAt(i)] = i
  }
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '')
  const out = new Uint8Array((clean.length * 3) >> 2)
  let acc = 0
  let bits = 0
  let p = 0
  for (let i = 0; i < clean.length; i++) {
    const v = b64map[clean.charCodeAt(i)]
    if (v < 0) continue
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[p++] = (acc >> bits) & 0xff
    }
  }
  return p === out.length ? out : out.subarray(0, p)
}

/** `v1:...` satrini ochib JSON qiymatini qaytaradi. Ochib bo'lmasa `null`. */
export function unprotect(blob: unknown): unknown {
  if (typeof blob !== 'string' || !blob.startsWith(PREFIX)) return null
  try {
    const bytes = fromBase64(blob.slice(PREFIX.length))
    if (bytes.length < 2) return null
    const offset = (bytes[0] << 8) | bytes[1]
    const table = keystream(SECRET)
    const len = bytes.length - 2
    // Bo'laklab yig'amiz: juda uzun matnda `fromCharCode(...massiv)` stack'ni
    // to'ldirib yuborishi mumkin.
    let text = ''
    const CHUNK = 8192
    const buf = new Array<number>(Math.min(CHUNK, len))
    for (let start = 0; start < len; start += CHUNK) {
      const end = Math.min(start + CHUNK, len)
      buf.length = end - start
      for (let i = start; i < end; i++) {
        buf[i - start] = bytes[i + 2] ^ table[(offset + i) % TABLE_LEN]
      }
      text += String.fromCharCode.apply(null, buf)
    }
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Javobdagi `enc` ni ochib, natijani obyektning o'ziga qo'shadi.
 *
 * API klientida bir marta chaqiriladi — shu bois komponentlar hech narsani
 * bilmaydi va o'zgarmaydi. Ro'yxatli javoblarda (`{results: [...]}`) har
 * element ham ochiladi.
 */
export function unwrapProtected<T>(payload: T): T {
  if (Array.isArray(payload)) {
    payload.forEach(unwrapProtected)
    return payload
  }
  if (!payload || typeof payload !== 'object') return payload

  const obj = payload as Record<string, unknown>
  if (typeof obj.enc === 'string') {
    const opened = unprotect(obj.enc)
    if (opened && typeof opened === 'object') {
      Object.assign(obj, opened)
      delete obj.enc
    }
  }
  if (Array.isArray(obj.results)) unwrapProtected(obj.results)
  return payload
}

# frontend/ — React + Vite + TypeScript

> Umumiy holat — `../CLAUDE.md`. Loyiha spetsifikatsiyasi — `../README.md`.

## Stek

- React 19 + Vite + TypeScript (strict)
- React Router v7 (client-side routing, lazy pages)
- TanStack Query v5 (server holati, cache, refetch)
- Zustand (mahalliy holat — auth store)
- axios (JWT interceptor, refresh)
- Native `<audio>` element

## Ishga tushirish

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Manzil: http://localhost:5173

`vite.config.ts` da `/api` va `/media` uchun proxy'lar → `http://localhost:8001`.

## Sahifalar

| Yo'l | Ekran |
|---|---|
| `/` | Bosh sahifa — 6 rejim kartochka + yangiliklar karuseli + mavzular gridi |
| `/topics` | Mavzular ro'yxati (Short Stories, IELTS, News, ...) |
| `/topics/:type` | Mavzu ichidagi diktantlar ro'yxati |
| **`/topics/:type/:slug`** | **Diktant mashqi** — asosiy o'yin ekrani (yangi format) |
| `/lessons/:id` | Legacy — eski link buzilmasin uchun (DictationPage bilan bir xil) |
| `/dictations/:slug` | Legacy alias |
| **`/shorts`, `/shorts/:id`** | **Shorts lentasi** — YouTube Shorts uslubidagi vertikal feed + savollar |
| `/news`, `/news/:id` | ShortsPage feed (`content_type=news`) — eng yangisi birinchi |
| **`/movies`, `/cartoons`** | **GRID ro'yxat** (`features/videos/VideoTopicPage`) — qidiruv+filtr+pagination, /topics/news bilan bir xil shablon. Kartochka bosilganda → `/:id` (vertikal feed) |
| `/movies/:id`, `/cartoons/:id` | ShortsPage feed, o'sha videoga pin qilingan |
| `/videos` | → `/topics/random-videos` ga redirect (soxta sahifa o'chirildi) |
| `/leaderboard` | Reyting TOP 30 |
| `/profile` | Profil, statistika, taklif havolasi |
| **`/profile/billing`** | **Tariflar** — bugungi sarf + tarif tanlash (bot shu manzilni yuboradi) |
| `/auth` | Telegram OTP kirish |

Har sahifa `React.lazy` bilan alohida chunk.

## Diktant sahifasi (`features/lessons/DictationPage.tsx`)

Bu **asosiy ekran**. `useQuery` bilan `fetchDictation(slug)` chaqiradi va
`data.body` (chunklar ro'yxati) ustida ish yuritadi.

### Chunk-larga bo'linish (2 bosqichli)

- `data.body` = `[{start_ms, end_ms, text}, ...]` (Whisper natijasi)
- `data.words_json` = so'z-darajasidagi timestamp (kelajakda so'z-so'z
  tekshiruv uchun va uzun chunk'larni aniq bo'lishda ishlatiladi)

**1. `mergeIntoSentences(body)`** — gap chegaralari:
- Whisper ba'zan bitta segmentga bir necha gap joylaydi, ba'zan gapni bir
  necha segmentga bo'ladi — shu bois qayta guruhlanadi
- Har chunk = bitta to'liq gap (`.` / `!` / `?` / `…` bilan tugaydi)
- Qisqartmalar (`Mr.`, `Dr.`, `etc.`, `e.g.`, `i.e.`, ...) chegara emas
- Bitta segmentda bir necha gap bo'lsa vaqt so'z uzunligi asosida
  proporsional taqsimlanadi

**2. `splitLongChunks(chunks, words_json)`** — uzun gaplarni bo'lish:
- Chunk ≥ **18 so'z** bo'lsa, keyingi **weak boundary** (`,` `;` `:` `—`)
  da bo'linadi (kamida 6 so'zdan keyin)
- `words_json` bor bo'lsa **aniq timestamp** ishlatiladi
  (`lastLeft.end` / `firstRight.start`)
- Yo'q bo'lsa proporsional taqsim
- Rekursiv — ikkinchi bo'lak yana katta bo'lsa yana bo'linadi
- Weak boundary umuman topilmasa — bo'linmaydi (uzun qoladi)

Masalan: `"Now, in the past few minutes, the Daily Telegraph newspaper has
reported that Prince Harry and Meghan, the Duke and Duchess of Sussex, plan
to move back to the UK."` (30 so'z) → 3 chunk:
1. `"Now, in the past few minutes,"` (6 so'z)
2. `"the Daily Telegraph newspaper has reported that Prince Harry and Meghan,"` (11 so'z)
3. `"the Duke and Duchess of Sussex, plan to move back to the UK."` (13 so'z)

Chunk sarlavhasi navigatsiya: `<` prev, `1 / 21`, `>` next

### Audio bilan sinxron

- Audio doim mount holida (`display:none` bilan yashirish)
- Chunk almashsa audio boshiga qo'yiladi va avtomatik yangraydi
- Chunk oxirida majburiy to'xtash: `setInterval(50 ms)` + `timeupdate`
- Chunk padding: `CHUNK_LEAD_MS = 0` (Whisper aniq boshlaydi),
  `CHUNK_TAIL_MS = 700 ms` — oxirgi so'zning tovushi to'liq eshitilishi uchun
  (masalan "Rita" ning oxirgi bo'g'ini kesilib "Ri..." bo'lib qolmasin)

### Grading — mijozda (`utils/grade.ts`)

Enter bosilishi bilanoq mijozda `gradeDictation(fullAnswer, given)` — API'ga
so'rov ketmaydi. Backend'da grader yo'q endi (kerak emas — diktant kontenti
`body.text` da ochiq).

### Klaviatura yorliqlari

- **Enter** — tekshirish. To'g'ri bo'lsa **500 ms** yashil ✓ ko'rsatib keyingi chunk (`AUTO_NEXT_MS = 500`)
- **Enter (ikkinchi marta)** — allaqachon to'g'ri bo'lsa darrov keyingiga o'tadi (kutmaydi)
- **Ctrl** — chunk qayta yangradi
- **Shift+Enter** — yangi qator (tekshirmaydi)

### Tugmalar

- **Check** — Enter bilan bir xil
- **Skip** — kanonik matnni yozadi, **800 ms** kutadi (foydalanuvchi javobni ko'rib olsin) va keyingi chunk'ga o'tadi (`SKIP_NEXT_MS = 800`)
- **Yakunlash** (oxirgi chunk'da) — celebration ekraniga
- **↻ Boshidan** — hammani tozalab chunk 1'dan qayta

> Sun'iy 400/600 ms kechiktirishlar olib tashlandi — Whisper timestamp'lari
> aniq bo'lgani sabab kutish shart emas. Kerak bo'lsa `DictationPage.tsx`
> `AUTO_NEXT_MS`/`SKIP_NEXT_MS` konstantalarini oshiring.

### Tinglash vaqti hisobi — faqat tugatilgan ish

**Qoida o'zgardi.** Ilgari har soniyada serverga oqib turardi; endi vaqt
FAQAT ish oxirigacha bajarilganda **bir marta** qo'shiladi:

- Diktant barcha gaplar yozilgach (`isFinished`) → `awardCompletion('dictation')`
- Listening test natijasi chiqqach (`TestView` → `onCompleted`) → `awardCompletion('test')`
- Qo'shiladigan qiymat — `data.duration_sec` (kontentning **to'liq
  davomiyligi**): ish tugadi, demak kontent to'liq tinglangan
- `awardedRef` ikki marta yozilishning oldini oladi (diktant va test alohida
  bayroqli — foydalanuvchi ikkalasini ham bajarsa ikki marta qo'shiladi)

Navbar indikatori endi "yig'ilgan sekund" emas, **kontent davomiyligini**
ko'rsatadi — "tugatsangiz shuncha qo'shiladi".

Streak tizimdan butunlay olib tashlandi.

### Media rejim (YouTube)

Agar diktantda `audio_url` yo'q lekin `youtube_link` bor bo'lsa,
**YouTube IFrame player** to'g'ridan-to'g'ri sahifada embed qilinadi
(`components/YouTubePlayer.tsx`). Foydalanuvchi YouTube'ga chiqmasdan
diktant qila oladi.

- URL'dan video ID `extractYouTubeId()` bilan chiqariladi
  (watch, youtu.be, shorts, embed formatlarini qo'llaydi)
- `playRange(start_ms, end_ms)` orqali chunk vaqti aniq
- Audio ustunlik: `audio_url` bo'lsa native `<audio>`, aks holda YouTube

### Progress avtomatik saqlanadi

Har 1.2 s da `POST /api/dictations/{slug}/progress/` — javoblar va oxirgi
chunk indeksi. **Kirishda tiklanmaydi** — foydalanuvchi doim chunk 1'dan.

### Listening test rejimi (`TestView` — shu fayl ichida)

Start ekranidagi **"Listening test"** tugmasi bosilsa diktant UI o'rniga
IELTS uslubidagi savollar paneli chiqadi. Layout `.test-layout`
(`global.css`): chapda **sticky** video, o'ngda **o'zi scroll qiladigan**
savollar paneli; 900 px dan tor ekranda bitta ustunga tushadi.

Bu rejim **YouTube video bo'lgan HAR QANDAY diktantga** taalluqli — news,
movies, cartoons, videos, IELTS... Alohida sahifa yo'q, hammasi shu bitta
ekran.

**Dizayn qoidalari** (buzmang — mahsulot talabi):

1. **Stiker yo'q.** Emoji ishlatilmaydi — faqat kichik SVG ikonalar
   (`IconPlay`, `IconCheck`, `IconCross`, `IconFlag`, `IconAlert`,
   `IconPencil`, `IconHeadphones`, `IconBack`) va ular ham kam.
2. **Cheklangan palitra.** Neytral tokenlar (`--bg`, `--bg-secondary`,
   `--border`, `--text`) + to'g'ri (yashil `#10B981`) + xato (qizil `#EF4444`).
   MCQ/TFNG/Fill turlari rang bilan emas, **bo'lim sarlavhasi** bilan ajraladi.
   (Ilgari har tur o'z gradienti bilan chizilardi — sahifa rang-barang edi.)
3. **Bitta shrift shkalasi.** Barcha o'lchamlar `fs(base)` orqali bitta
   `FONT_STEPS` koeffitsientidan kelib chiqadi. Toolbar'dagi **A− / A+**
   butun panelni kattalashtiradi/kichiklashtiradi; tanlov
   `localStorage.listening.test.settings` da. Default qadam — `1.15×`
   (panel kichik ko'rinmasin uchun).

**Ikki tekshirish rejimi** (toolbar'dagi segment tugma):

| Rejim | Xulq |
|---|---|
| `instant` (default) | Har javob darrov ranglanadi + isbot qatori chiqadi |
| `exam` | Javoblar oxirigacha yashirin, natija faqat "Natijani tekshirish" da |

Ikkala rejimda ham **hamma savol belgilangach natija kartochkasi** chiqadi
(ball, foiz, xato savollar raqamlari — bosilsa o'sha savolga scroll).
Natija chiqqach rejim qulflanadi (baho o'zgarmasin).

**Fill-gap nozikligi:** yozilayotgan qiymat (`answers`) va tasdiqlangan javob
(`committed`) alohida saqlanadi — aks holda har harfda "xato" deb qizarib
ketardi. Tasdiqlash: **Enter** yoki maydondan chiqish. MCQ/TFNG esa bosilishi
bilanoq tasdiqlanadi.

**Shart matni:** Har bo'lim IELTS ko'rsatmasi bilan boshlanadi
(`Questions 1–5 · Multiple choice` + `Choose the correct letter…`), fill-gap
savollarida esa Claude bergan `hint` **aynan o'zgarishsiz** ko'rsatiladi —
"Write NO MORE THAN ONE WORD AND/OR A NUMBER for your answer."

**Isbot:** `PROOF_REWIND_SEC = 2` — video isbot timestamp'idan **2 s
oldinroqdan** qo'yiladi (foydalanuvchi gap boshini o'tkazib yubormasin).

**Shikoyat / savol xato:** toolbar'dagi ikki ikona →
`components/FeedbackModals.tsx` (Shorts bilan **umumiy** komponent).
Endpointlar: `/dictations/{slug}/report/`, `/dictations/{slug}/question-feedback/`,
`/dictations/{slug}/my-feedback/`.

**Savollar ketma-ketligi:** raqamlash 1..N — avval barcha MCQ, keyin TFNG,
keyin fill-gap. Har bo'lim ichida savollar **isbot vaqti bo'yicha o'sish
tartibida** keladi — buni server kafolatlaydi
(`backend/apps/catalog/shorts_pipeline.py::_order_quiz`), frontend faqat
kelgan tartibni ko'rsatadi. `QuestionPositionBar` ham xuddi shu raqamlashni
ishlatadi (`positionMarks`).

## Shorts sahifasi (`features/shorts/ShortsPage.tsx`)

YouTube Shorts uslubidagi vertikal lenta. O'ngda comment emas — **video
bo'yicha AI savollari** (MCQ + TFNG), pastda natija.

### Layout — bitta o'lchov manbasi

JS scroll konteyner balandligini o'lchab `--slot-h` CSS o'zgaruvchisiga
yozadi. Qolgan hamma narsa shundan kelib chiqadi (`styles/global.css`,
`.shorts-*` bloki):

```
--stage-h  = --slot-h - 2*padding
--vid-max-w = stage kengligi - rail - gap - panel-min   (panel uchun joy)
--vid-h    = min(--stage-h, --vid-max-w * 16/9)
--vid-w    = --vid-h * 9/16
```

Shu sabab video / rail / savollar paneli piksel-aniq bir balandlikda turadi
va video mavjud balandlikni to'la egallaydi. `max-width: 900px` da mobil
tartib: video tepada, rail gorizontal, savollar pastda.

### Scroll — brauzerning o'zi

`scroll-snap-type: y mandatory` + **`scroll-snap-stop: always`**. Bitta
"flick" = bitta video, JS aralashmaydi. (Ilgari `wheel`/`touch` hodisalari
`preventDefault` bilan ushlanib, 500 ms lock + `scrollIntoView({smooth})`
qilinardi — bu snap bilan urishib ketardi va lenta "chalkash" edi.)

Faol slot ikki bosqichda aniqlanadi:

| Holat | Qachon | Nimaga |
|---|---|---|
| `activeIdx` | scroll paytida (rAF) | hisoblagich, DOM oynasi |
| `playIdx` | scroll to'xtagach (130 ms) | **player mount + ijro** |

Ajratish tez scroll paytida iframe'lar mount/unmount bo'lib ketishining
oldini oladi.

URL `history.replaceState` bilan yangilanadi — `navigate()` butun daraxtni
qayta render qilar va lenta sakrardi.

### Ovoz — n+1 muammosi

**Har bir player `autoplay: 0` va `mute: 1` bilan yaratiladi.** Ovoz faqat
slot FAOL bo'lganda yoqiladi (`unMute()` + `playVideo()`), faol bo'lmagan
slot esa har doim `mute()` + `pauseVideo()` holatida. `onStateChange` da
qo'shimcha to'siq bor: faol bo'lmagan player ijroga o'tsa darrov
to'xtatiladi.

Ilgari barcha mount qilingan playerlarga `autoplay: 1` berilardi va
`playing` prop player tayyor bo'lgunicha yo'qolib ketardi — shu bois
foydalanuvchi n-videoni ko'rib turib n+1 ning ovozini eshitardi.

Ovozli avtoplay bloklansa (brauzer siyosati) player muted rejimga tushadi
va yuqori panelda "Ovozni yoqing" chiqadi. `M` — ovoz toggle
(`localStorage`da saqlanadi).

### RAM

- **2 ta iframe**: faol slot + scroll yo'nalishidagi keyingisi (`dir`)
- **DOM oynasi**: `|i - activeIdx| <= 2` slotlargina to'liq chiziladi,
  qolganlari bo'sh `div` (balandligi bir xil, snap buzilmaydi)
- Slot tashqarida qolsa ham javoblar yo'qolmaydi — holat sahifa
  darajasida (`states`), default obyektlar keshlanadi (`memo` buzilmasin)
- Har slotda poster (`i.ytimg.com/.../oardefault.jpg`) iframe ostida turadi
  — qora ekran ko'rinmaydi

Amalda: ~250 DOM tuguni, ~20 MB JS heap, 2 iframe.

### Feed — takrorlanmaydigan sahifalash

Backend `?random=1` da `order_by("?")` qiladi, ya'ni **`?page=2` ishonchsiz**
(har so'rovda tartib boshqacha → takroriy va tushib qolgan elementlar).
Shu bois frontend har doim 1-sahifani so'raydi, lekin olingan id'larni
`exclude=` ga qo'shadi:

```
1) exclude = localStorage'dagi ko'rilganlar
2) exclude = ko'rilganlar + yuklangan id'lar
3) MAX_ITEMS ga yetsa → LOOP: exclude = faqat oxirgi ~20 id (server doim
   element qaytaradi, faqat yaqin takror bo'lmaydi)
4) loop'da server bo'sh qaytsa → exclude=[] bilan qayta (MEGA-loop)
5) exclude=[] bilan ham bo'sh → katalog CHINDAN bo'sh (0 video) → to'xtaydi
```

**LOOP hech qachon to'xtamaydi** (foydalanuvchi so'radi: "aylanib
kelaveradi"). Buning uchun `items` **GLOBAL dedup QILMAYDI** — bir video
qayta chiqishi mumkin. `items` endi `Short[]` emas, balki
`{ short: Short; key: string }[]` (key = `id#occurrence`, React uchun uniq).
Ilgari global dedup bor edi va loop'dagi takroriy videolar filtrlanib,
ro'yxat katalog hajmida "qotib" qolardi — foydalanuvchi oxirgi videoda
to'xtardi. Endi faqat KETMA-KET bir xil video va o'liklar tashlanadi.
`items[i]` — `{ short, key }`, shu bois har consumer `.short.id` ishlatadi.

`maxPages` ishlatilmaydi — u eski sahifalarni olib tashlar va scroll
pozitsiyasi sakrardi. Loop rejimida `items` cheksiz o'sadi, lekin
elementlar oddiy JS obyekt (iframe emas — u doim ≤2) va oyna tashqarisidagi
slotlar bo'sh `div` — RAM tekis qoladi.

### Har kirishda YANGI (ko'rilmagan) videolar — `entryEpoch`

**Muammo edi:** feed `staleTime: Infinity` + barqaror queryKey bilan
keshlanardi. Foydalanuvchi `/shorts` dan chiqib 5 daqiqa ichida qaytsa,
react-query AYNAN eski keshlangan videolarni qaytarardi — garchi ular
allaqachon ko'rilgan ("seen") bo'lsa ham. Ko'rilganlarni chetlashtirish faqat
YANGI query yaratilganda ishlardi, qaytishda esa yaratilmasdi. Natijada har
kirishda bir xil zerikarli, ko'rilgan videolar chiqaverardi.

**Yechim:** `const [entryEpoch] = useState(() => Date.now())` — har mount'da
(har kirishda) noyob qiymat. U feed `queryKey`iga qo'shiladi:
`['shorts-feed', contentType, levelsKey, seenEpoch, entryEpoch]`. Shu bois
har kirish = YANGI query = kesh o'tkazib yuboriladi va `seenAtStart`
(localStorage'dan yangilangan `seen` ro'yxati) ko'rilganlarni `exclude=` ga
qo'shadi. Server `?random=1` bilan qolgan KO'RILMAGAN videolardan tasodifiy
beradi. `gcTime` 30s ga tushirildi — eski (observer'siz) lentalar tez
tozalanadi, RAM yig'ilmaydi.

Bu mexanizm **yengil va tez**: bitta so'rov, hech qanday qo'shimcha DB yozuvi
yo'q. `seen` ro'yxati `localStorage.listening.shorts.seen` da
(`SEEN_MAX = 600` id ~4KB), video FAOL slot bo'lganda `markSeen` orqali darrov
yoziladi. Serverga `exclude=` bilan oxirgi `EXCLUDE_MAX = 400` id jo'natiladi
(~2.4KB query — nginx/proxy uchun xavfsiz). News/movies/cartoons uchun ham amal
qiladi (u yerda tartib "eng yangisi birinchi", seen chetlashtirilgach — eng
yangi KO'RILMAGANI chiqadi).

**Chuqurlik/takror:** 400–600 lik oyna odatiy foydalanuvchining ~1 haftalik
ko'rish hajmini qoplaydi, shu bois hafta ichida ko'rilgan video deyarli
qaytmaydi. Undan nariga (600+ oldin ko'rilgan) yoki localStorage tozalansa,
video qaytishi mumkin — LEKIN tartib `?random` sabab har doim boshqacha, shu
bois "bir xil ketma-ketlik" hech qachon takrorlanmaydi.

> To'liq, qurilmalararo va cheksiz "ko'rilgan" tarixi kerak bo'lsa — kirgan
> foydalanuvchilar uchun server tomonda per-user seen jadvali kerak (feed
> server'da `exclude` qiladi). Bu qo'shimcha DB yozuvi/o'qishi — hozircha
> ataylab qo'shilmagan (yengillik uchun). Kerak bo'lsa opt-in qilib qo'shsa
> bo'ladi.

### Shrift skaleri (A− / A+) — butun feed uchun umumiy

Savol paneli tepasida A− / A+ tugmalari. Skaler `FontScaleContext` orqali
BUTUN feed'ga tarqaladi — bitta video'da bosilsa barcha videolarga darrov
ta'sir qiladi (ilgari har panel o'z holatini saqlar edi va foydalanuvchi
har video'da qaytadan sozlashga majbur edi). `localStorage.listening.shorts.fontScale`
(0.8–1.4). CSS `--sq-scale` orqali savol/variant/tab matni birga masshtablanadi.

### Auth gate — guest 2 ta shorts ko'radi, 3-slot kirish devori

**Ko'rish chegarasi (`GUEST_LIMIT = 2`):** ro'yxatdan o'tmagan foydalanuvchi
faqat dastlabki **2 ta shorts**'ni ko'ra oladi. 3-slot — `GuestGateSlot`
(video emas, chiroyli login kartochka) va unga scroll qilinganda
`AuthGateModal` ochiladi. Guest'ga feed ortiqcha sahifa yuklamaydi
(prefetch `items.length >= GUEST_LIMIT` da to'xtaydi).
- `visibleItems = isLoggedIn ? items : items.slice(0, 2)`
- `slotCount` (= visibleItems + gate) scroll chegarasini belgilaydi
  (`slotCountRef`, `currentIndex`/`scrollToIdx` shuni ishlatadi).

**Ishlash chegarasi (`ShortsAuthContext.requireAuth`):** guest ko'rgan 2 ta
short'da ham savolga javob (`pickMcq/pickTfng/submitFill`) yoki like/dislike
(`applyReaction`) bosolmaydi — modal chiqadi.

**Diktant/Imtihon:** `DictationPage` da "Diktant"/"Imtihon" tugmalari guest
uchun `AuthGateModal` ochadi (boshlay olmaydi). Modal: `components/AuthGateModal.tsx`.

### Lenta tartibi va ko'rishlar

Tartib `content_type` ga bog'liq (`randomOrder`):

| Feed | So'rov | Natija |
|---|---|---|
| `/shorts` | `random: true` | Server: `-priority`, `?` — tasodifiy kashfiyot |
| `/news`, `/movies`, `/cartoons` | `random: false` | Server: `-priority`, `-created_at` — **eng yangisi birinchi** |

Ikkalasida ham `priority` **qat'iy pog'ona**: admin qo'lda bergan yuqori
priority'li KO'RILMAGAN video har doim lentaning boshida chiqadi
(ko'rilganlar `exclude=` bilan tashlanadi).

`trackView(id)` — slot faol bo'lganda chaqiriladi: ko'rilganlar ro'yxatiga
qo'shadi **va** `POST /shorts/{id}/view/` bilan serverdagi `views` ni
oshiradi. Sessiya davomida `viewCounted` Set dedupe qiladi — oldinga-orqaga
scroll qilinganda hisoblagich shishmaydi. (Ro'yxat endpoint'i `views` ni
oshirmaydi, shu bois bu alohida chaqiruv kerak.)

### Isbot (proof)

`proof_from_text` = `"[0.0] gap [4.1] yana gap"`. `parseProof()` barcha vaqt
belgilarini iqtibosdan tozalaydi va birinchisini seek uchun oladi. Vaqt
belgisi bo'lmasa ▶ tugmasi umuman ko'rsatilmaydi.

### `components/ShortsPlayer.tsx`

Shorts uchun soddalashtirilgan YouTube player: overlay yo'q, YouTube'ning
o'z control'lari. `seek/play/pause` — imperativ handle. Video tugasa
boshidan (loop). Tab yashirilsa to'xtaydi.

> YouTube IFrame API loader **`utils/youtube.ts`** da — yagona. Ilgari
> `YouTubePlayer.tsx` va `ShortsPlayer.tsx` ikkalasi ham
> `window.onYouTubeIframeAPIReady` ni qayta yozardi: diktant sahifasidan
> Shorts'ga o'tilganda promise resolve bo'lmay qora ekran qolardi.


## Api klient (`api/`)

- `client.ts` — axios instance, JWT bearer, 401 → refresh interceptor
- `endpoints.ts` — barcha API chaqiruvlari
- `types.ts` — barcha TS turlari (`Dictation`, `DictationDetail`,
  `DictationType`, `DictationChunk`, `Me`, ...)

**Endpoint funksiyalari:**
- `fetchDictations(params)` — ro'yxat
- `fetchDictationTypes()` — mavzular + counts
- `fetchDictation(slug)` — batafsil (body bilan)
- `fetchDictationProgress(slug)`, `saveDictationProgress(slug, ...)`
- `addDictationPlayedTime(slug, ms)` — global statistika
- Boshqa: `verifyOtp`, `fetchMe`, `fetchStats`, `fetchLeaderboard`, `fetchPlans`

## Komponentlar

### `components/Layout.tsx`

Navbar: **Asosiy · Shorts · Videolar · Filmlar · Multfilmlar · Yangiliklar ·
Reyting** + (agar admin sozlagan bo'lsa) **Bog'lanish** · Profil + tinglash
vaqti pill + tungi rejim toggle (SVG) + til (UZ/EN). Mobil ekranda hamburger.
Shorts float button o'ng pastda.

**Bog'lanish** — `fetchSiteConfig()` (`GET /api/config/`) admin kiritgan
`contact_telegram` username'ni beradi. Bo'sh bo'lmasa navbarda tashqi link
(`t.me/<username>`) ko'rinadi. Admin `/admin/common/siteconfig/` (singleton).

### Like / dislike + views (barcha videolarda)

Shorts va Diktant/video sahifalarida bir xil mexanizm:
- **Views** — `registerShortView` / `registerDictationView`: HAR ko'rish
  hisoblanadi (dedup yo'q). Shorts har faol slotda, Diktant har boshlashda.
- **Like/dislike** — server HAR USER 1 marta (`reactToShort`/`reactToDictation`,
  `{reaction:'like'|'dislike'}` yuboradi, server toggle qiladi). Kirmagan
  bo'lsa `AuthGateModal`. Joriy holat `*/my-feedback/` dan (`my_reaction`).
  Diktant sahifasida tugmalar sub-header'da (`LikeButton`), har rejimda
  ko'rinadi. Optimistik yangilanadi, server javobi bilan aniqlanadi.

### `components/FeedbackModals.tsx`

`ModalShell`, `ReportModal`, `QuestionFeedbackModal` — **Shorts va Diktant
test sahifasi uchun umumiy**. API funksiyalari prop orqali beriladi
(`loadReasons`, `submit`), shu bois bir xil UI ikkala endpoint to'plami bilan
ham ishlaydi. 409 (allaqachon yuborilgan) xato emas — "yuborilgan" deb
hisoblanadi.

### `components/OnboardingHint.tsx`

Kichik "coach mark" kartochkasi + chizmalar (`HintArtPositions`,
`HintArtProof`). Fon qorayimaydi, `Esc` / tashqariga bosish / "Tushunarli"
bilan yopiladi. Qachon ko'rsatilishini `utils/onboarding.ts` hal qiladi.

### `utils/grade.ts`

- `normalize(text)` — bag'rikeng normalizatsiya (kasa-kichik, tinish, `26th`=`26`, `1,000`=`1000`)
- `gradeDictation(expected, given)` — DictationResult (isCorrect, score, matched, total, words[])

### Songs sahifasi olib tashlangan

`/songs` route, `features/songs/*`, `song*` i18n stringlar va
`ContentKind='song'` — hammasi o'chirildi. Frontend'da qo'shiq mavzusi yo'q.
Backend'da `FAKE_SONGS`/`build_songs()` ham olib tashlangan. Kelajakda
qaytarilsa Shorts uslubidagi feed sifatida yasash osonroq (bitta model,
bitta pipeline).

### StartCard — Listening test = asosiy CTA

`DictationPage.tsx::StartCard` da savollar bor kontent uchun ierarxiya:
- **Katta gradient tugma** (blue → purple, "TAVSIYA" badge, IconPlay + MCQ/
  TFNG/Fill chip'lari) → `Listening test` rejimini yoqadi
- Ostida **kichik ikkinchi darajali** havola "yoki diktant yozish (N ta gap)"
Bu ko'rinish savollari bor har diktantda yoqiladi. Savollar yo'q kontentda
diktant tugmasi asosiy va yagona.

### Chunk bo'lish — ikki pog'onali

Diktant chunklari `useMemo` da uch bosqichdan o'tadi:

1. **`mergeIntoSentences`** — gap chegaralari (`.`/`!`/`?`) bo'yicha
   guruhlaydi. Har chunk = to'liq gap.
2. **`splitLongChunks(sentences, words_json, 20)`** — agar bitta chunkda
   **20+ so'z** bo'lsa, 20-inchi so'zdan boshlab **BIRINCHI uchragan tinish
   belgisi** (`,` `;` `:` `—` va h.k.) da bo'linadi. Uzun IELTS-uslubidagi
   gaplarni foydalanuvchi qulay yoza oladigan qismlarga tushiradi. Tinish
   belgisi topilmasa umuman bo'linmaydi (keyingi bosqich hal qiladi).
3. **`forceSplitLongChunks`** — OXIRGI xavfsizlik chegarasi.
   **`needsForceSplit` GAP TURINI tekshiradi** (`endsWithSentencePunct`):
   - **To'liq gap** (`.`/`!`/`?`/`…` bilan tugaydi) → BUTUN o'qiladi
     (nuqtagacha). Faqat patologik uzun (`> 40` so'z yoki `> 32s`) bo'lsa
     bo'linadi — masalan Whisper bir necha gapni nuqtasiz qo'shib yuborsa.
   - **Tinish belgisiz blok** (qo'shiq) → `> 16` so'z / `> 14s` da
     `words_json`'dagi eng katta tanaffus bo'yicha bo'linadi.

**Chegaralar:**
- Gap: `SENTENCE_MAX_WORDS = 40`, `SENTENCE_MAX_MS = 32000`
- Blok (qo'shiq): `HARD_MAX_WORDS = 16`, `HARD_MAX_MS = 14000`
- `MIN_PIECE_WORDS = 4`, `MAX_SPLIT_DEPTH = 8`

**Nima uchun gap/blok ajratildi?** Foydalanuvchi shikoyati: 17 so'zli
NORMAL gap (vergulsiz, nuqta bilan tugaydi) `HARD_MAX_WORDS=16` tufayli
gap o'rtasidan uzilib, audio "...Ameri" da kesilar edi. Universal yechim:
**nuqta bilan tugagan gap hech qachon o'rtasidan uzilmaydi** — butun
o'qiladi. Faqat qo'shiq kabi tinish belgisiz uzun bloklar bo'linadi.
Uzun IELTS gaplari esa 2-bosqich (`splitLongChunks`, 20+ so'z → tinish
belgisida) orqali baribir bo'linadi.

### MCQ variantlari ARALASHTIRILADI (`utils/shuffle.ts`)

Claude to'g'ri javobni tasodifiy joyga qo'ymaydi. Real bazada o'lchandi
(2026-09-01, 53 ta MCQ): **50% javob "B"**, A va C — 24% dan. Ya'ni doim "B"
tanlagan foydalanuvchi tinglamasdan savollarning yarmini to'g'ri topardi.

`shuffleOptions(options)` — Fisher–Yates:

- **Kalit o'zgarmaydi** (`A`/`B`/`C`/`D`), faqat ko'rsatish tartibi aralashadi
  → javob tekshiruvi (`picked === q.answer`) hech qanday o'zgarishsiz ishlaydi.
- Foydalanuvchiga **joylashuv harfi** ko'rsatiladi (1-variant "A", 2-si "B"...)
  — aks holda ro'yxat "C, A, D, B" bo'lib g'alati ko'rinardi.
- Shu sababdan to'g'ri javobni **ko'rsatganda** ham `displayLetter()` ishlating,
  asl kalitni emas (`DictationPage` dagi `ProofRow expected`).
- Tartib `useMemo` bilan qotirilgan — javob berayotganda variantlar sakramaydi;
  savol qayta ochilganda esa yangi tartib chiqadi.

Ishlatilgan joylar: `ShortsPage::McqCard`, `DictationPage::QuestionCard`.
Mobilda ayni mantiq — `mobile/src/components/QuizPanel.tsx`.

### Savol pozitsiyasi indikatorlari (opt-in)

Foydalanuvchi checkbox bilan yoqib qo'yishi mumkin — har savol AUDIO/VIDEO
ning qaysi soniyasida ekanligini rangli belgilar bilan ko'rsatadi. Tanlov
`localStorage` da saqlanadi va boshqa dictation/shorts'larga ham ta'sir qiladi.

**MUHIM — belgi raqami = PANELDAGI savol raqami** (`positionMarks` `useMemo`,
ham ShortsPage ham DictationPage): 1..N MCQ, keyin TFNG, keyin fill-gap —
`TestView`/`QuizPanel` bilan aynan bir xil. Belgilar chizish uchun isbot vaqti
bo'yicha saralanadi, lekin **raqam o'zgarmaydi**.

> **Ilgari xato bor edi:** belgilar saralangach KETMA-KET qayta raqamlanardi
> (1,2,3...). Natijada bardagi raqam paneldagi savolga MOS KELMASDI. Real
> misol (`Short #14`): bardagi "2" 16.2 s da turardi, paneldagi 2-savolning
> javobi esa 33.8 s da — **17.6 s farq**. Foydalanuvchi shuni "savol joyi
> noto'g'ri" deb ko'rardi. ("Isbot" tugmasi to'g'ri ishlardi, chunki u
> savolning O'Z `proof_from_text` vaqtini oladi — muammo faqat shu barda edi.)
>
> Chapdan o'ngga raqamlar ketma-ket bo'lmasligi mumkin — bu **normal**, chunki
> har bo'lim (MCQ, TFNG, fill) videoni boshdan-oxir bosib o'tadi. Muhimi —
> belgini ko'rgan odam panelda AYNAN o'sha savolni topa olishi.

**Ikki komponent — bir g'oya, ikki layout:**

| Komponent | Qayerda | Yo'nalish | localStorage kaliti |
|---|---|---|---|
| `components/QuestionPositionBar.tsx` | Diktant test rejimida (video ostida) | Gorizontal | `listening.test.qpos` |
| `components/QuestionPositionThermometer.tsx` | Shorts rail'ida (like'lar yonida) | Vertikal | `listening.shorts.qpos` |

### Mobil (responsive)

- **Shorts (`≤900px`) — YouTube/Instagram Shorts uslubi**: video **TO'LIQ
  ekran** (full-bleed, `.shorts-video` absolute inset 0). Action tugmalari
  (like/dislike/qayta/shikoyat) — **o'ngda vertikal overlay**, yarim-shaffof
  oq (video ustida). Up/down nav yashirin (`.shorts-nav-group` — swipe/scroll
  bilan yuriladi). Savollar — pastdan ochiladigan **bottom-sheet** (peek 58px
  handle "Savollar · 0/5" → bosilsa 84vh, "komment" kabi). `.shorts-sheet`
  desktop'da `display:contents` (shaffof — panel avvalgidek yonda), mobil'da
  FAQAT faol slot (`.playing`) fixed sheet. `ShortSlot` da `sheetOpen` state.
- **Diktant test (`≤1024px`)**: `.test-layout` bitta ustunga tushadi (video
  tepada, savollar pastda). `minmax(0, ...)` grid — gorizontal scroll bo'lmaydi.

**Umumiy xulq-atvor:**
- **Ranglar** (savol turi bo'yicha): MCQ = `#2563EB` (ko'k), TFNG = `#7C3AED`
  (binafsha), Fill = `#F59E0B` (amber).
- **Joriy savol** — amber gradient (`#F59E0B → #B45309`) + scale 1.25-1.3× +
  oq halqa. Playback vaqti + `proof_from_text` dagi `[t.t]` timestamp orqali
  aniqlanadi (poll interval: 400 ms).
- **Progress fill** — chapdan/tepadan yashil gradient (`#10B981 → #059669`)
  audio/video pozitsiyasi bo'yicha to'ladi.
- **Faqat yoqilganda** poll boshlanadi (checkbox off → hech qanday timer).

**Onboarding — `utils/onboarding.ts` + `components/OnboardingHint.tsx`:**
Ilgari bu yerda `qposHint` CSS pulsi bor edi (har shorts slotda qayta yonib
o'chardi). U olib tashlandi — takrorlanardi va nima uchun yonayotgani
tushunarsiz edi. O'rniga **bir martalik kichik ipuchi kartochkasi**:

| Qoida | Qiymat |
|---|---|
| Kimga | `date_joined` dan **2 kundan kam** bo'lgan foydalanuvchiga |
| Anonim mehmon | `localStorage.listening.onboarding.first_visit` dan hisoblanadi |
| Necha marta | Har ipuchi **umrida 1 marta** (`listening.onboarding.seen.<key>`) |
| Fon | Qorayimaydi — video ijro davom etadi, ish to'xtamaydi |

`useOnboardingHint(key, ready, delayMs)` — `ready` bo'lgach `delayMs` kutib
ochadi; profil yuklanmagunicha (`auth.loading`) hech narsa ko'rsatmaydi.

Kalitlar (`HINT`):

| Kalit | Qayerda | Nima o'rgatadi |
|---|---|---|
| `shorts-positions` | Shorts, **birinchi** slot ijro boshlagach | termometr checkbox'i |
| `test-positions` | Listening test rejimiga kirilganda | pozitsiya bari checkbox'i |
| `test-proof` | "Isbot" tugmasi birinchi marta ko'ringanda | isbot videoni surishi |

Ipuchi ochiq turganda tegishli checkbox `.onb-spotlight` klass'ini oladi
(yashil halqa) — `spotlight` prop orqali, ikkala komponentda ham.

**Icon** — 12×12 SVG (`IconPositions`) ikonasi (3 ta ko'tarilgan vertikal
ustun, `currentColor`). Emoji ishlatilmagan.

**Diqqat:** Shorts termometri faqat `playing` slot uchun mount qilinadi —
scroll paytida boshqa slotlar poll qilmaydi (RAM tejashish).

## Profil — rasm va username (`features/profile/ProfilePage.tsx`)

Saytda ham mobil ilovadagi kabi:

- **Avatar** — rasm ustiga bosiladi, `<input type="file" hidden>` ochiladi,
  `updateAvatar(file)` `PATCH /me/` ga `multipart/form-data` yuboradi
  (backend JSON'ni ham, multipart'ni ham qabul qiladi). Rasm yo'q bo'lsa
  bosh harf gradient doira ko'rinadi. Server tomonda cheklov bor —
  **5 MB**, jpeg/png/webp/gif, tomoni ≤ 4096 px
  (`../backend/CLAUDE.md` → "Avatar validatori"); xato matni profil
  kartasida qizil qatorda ko'rsatiladi.
- **Username** — tahrirlash formasida. `checkUsername()` (`GET
  /api/auth/username-check/`) **400 ms debounce** bilan bandligini
  tekshiradi; band bo'lsa "Saqlash" tugmasi o'chadi. O'zining hozirgi
  username'i "band" deb ko'rsatilmaydi. Kiritishda `[^a-zA-Z0-9_]`
  belgilar olib tashlanadi, uzunligi 32 bilan cheklangan.

Reytingda ham avatar chiqadi (`avatar_url`, bo'lmasa bosh harf) —
`../backend/CLAUDE.md` → "Reyting javobida avatar va username".

## Profil sahifasidagi yangi kartalar

`features/profile/ProfilePage.tsx` uchtaga bo'lindi — asosiy sahifa +
ikki karta:

| Fayl | Nima |
|---|---|
| `SessionsCard.tsx` | **Kirgan qurilmalar** — ro'yxat + "Chiqarish" / "Boshqalarini chiqarish" |
| `PlanHistoryCard.tsx` | **Tarif tarixi** — qachon, qaysi tarif, qanday yo'l bilan, qachongacha |

**Sessiyalar.** Qoida serverda: bir vaqtda 1 brauzer + 1 telefon, oxirgi
kirgan yutadi (`../backend/CLAUDE.md` → "Sessiyalar"). Karta yangi ruxsat
bermaydi — faqat ko'rsatadi va uzib qo'yish imkonini beradi. Chiqarilgan
qurilma DARROV 401 oladi. Mobil ilovada aynan shu API ishlatiladi
(`mobile/src/components/SessionsSection.tsx`).

`signOut()` endi `POST /api/auth/logout/` ni ham chaqiradi (javobni
KUTMAYDI) — aks holda serverdagi sessiya qatori qolib, ro'yxatda ko'rinib
turardi.

**Tarif tarixi** faqat saytda bor (mobilda ataylab yo'q). Manba —
`SubscriptionEvent` jadvali: har tarif berilishi/uzaytirilishi bitta qator.
Har yozuv paytida foydalanuvchiga Telegram xabari ham ketgan bo'ladi.

**Rasm tahrirlash rejimida ham turadi.** Ilgari avatar tugmasi faqat
KO'RISH rejimida chizilardi va "Tahrirlash" bosilgach yo'qolib qolardi —
foydalanuvchi rasmni umuman topa olmasdi. Endi ikkala rejimda ham bor.

**Taklif kartasi** endi sovg'a qoidasi, keyingi sovg'agacha progress bari va
olingan sovg'alar ro'yxatini ko'rsatadi (`GET /api/me/invites/`). Havola
BOTGA olib boradi (`t.me/<bot>?start=<kod>`) — hisob shu orqali yuritiladi.

## i18n: lug'atda FUNKSIYA bo'lmaydi

`Strings = typeof uz` tipi lug'atni faqat satrlardan iborat deb biladi —
funksiya qo'shsangiz `i18n/index.tsx` da tip xatosi chiqadi. O'rin
almashtiruvchi matnlar `{n}` / `{plan}` ko'rinishida yoziladi va
`utils/format.ts::fill(template, values)` bilan to'ldiriladi.

## Tariflar sahifasi (`features/billing/BillingPage.tsx`)

**`/profile/billing`** — bugungi sarf (`GET /me/limits/`) + tariflar ro'yxati
va tanlash tugmalari.

**Nega ALOHIDA sahifa:** mobil ilovada tashqi to'lov havolasi bo'lishi mumkin
emas (App Store / Play Store qoidalari — publish'da muammo bo'ladi). Shu bois
ilova limitga yetilganda faqat "qaysi tarifdasiz + ertaga yangilanadi" deydi,
**Telegram bot** esa foydalanuvchiga aynan shu sahifaning havolasini yuboradi
(`../backend/apps/billing/limits.py::notify_limit_once`).

Sahifa manzilini o'zgartirsangiz botdagi matnni ham yangilang — ikkalasi
bog'langan.

## Auth (`features/auth/AuthPage.tsx`)

Telegram OTP kirish — 6 xonali kod maydonlari. O'zgarmagan.

## Papka tuzilishi

```
src/
  api/         client.ts (JWT + refresh), endpoints.ts, types.ts
  components/  Layout, ui/
  features/    auth home lessons leaderboard profile
  i18n/        strings.ts (uz/en), index.tsx
  store/       auth.ts (Zustand)
  styles/      global.css (shu yerda `.shorts-*` bloki)
  theme/       ThemeProvider.tsx
  utils/       grade.ts (client-side dictation grader), format.ts,
               youtube.ts (IFrame API loader),
               onboarding.ts (2 kunlik ipuchi oynasi, bir martalik ko'rsatish)
```

## O'chirilgan sahifalar

- `features/ielts` — IELTS mock-imtihon hub, savol turlari, ExamPage.
  IELTS endi shunchaki diktant mavzusi: `/topics/ielts-listening`
- `features/videos` — soxta /videos sahifasi. "Videolar" navbar havolasi
  endi `/topics/random-videos` ga ketadi
- `features/movies` — /movies, /cartoons, /movies/:id
- `features/songs` — /songs, /songs/:id
- `features/videos` — /videos, /videos/:id
- `features/news` — /news, /news/:id
- `components/ExerciseRunner.tsx`, `AudioPlayer.tsx`

Hammasi backend'da tegishli modellar o'chirilgani sabab yo'q qilindi.

## Testlash

```bash
npx tsc -b --noEmit    # TypeScript check (toza)
npm run build          # prod build
```

Runtime testlar hozircha yo'q. Backend testlari (16) mijoz grader'i bilan
bir xil natija bermasligini ta'minlaydi.

## Hali qilinmagan

- **Vitest testlari** — `utils/grade.ts` uchun bo'lishi kerak
- **Offline / PWA rejim**
- **Rasm optimallashtirish**

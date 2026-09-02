// src/features/lessons/DictationPage.tsx
import { useCallback as useCallback4, useEffect as useEffect9, useMemo as useMemo4, useRef as useRef3, useState as useState8 } from "react";
import { Link as Link2, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

// src/api/client.ts
import axios from "axios";
var ACCESS_KEY = "listening.access";
var REFRESH_KEY = "listening.refresh";
var tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  save(access, refresh) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  saveAccess(access) {
    localStorage.setItem(ACCESS_KEY, access);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
};
var api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" }
});
api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
var refreshPromise = null;
async function refreshAccessToken() {
  const refresh = tokenStore.refresh;
  if (!refresh) return null;
  try {
    const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh/`, { refresh });
    tokenStore.saveAccess(data.access);
    if (data.refresh) tokenStore.save(data.access, data.refresh);
    return data.access;
  } catch {
    tokenStore.clear();
    return null;
  }
}
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.includes("/auth/");
    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const token = await refreshPromise;
      refreshPromise = null;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      window.dispatchEvent(new CustomEvent("listening:signed-out"));
    }
    return Promise.reject(error);
  }
);

// src/api/endpoints.ts
async function fetchDictation(slug) {
  const { data } = await api.get(`/dictations/${slug}/`);
  return data;
}
async function addDictationPlayedTime(slug, ms) {
  const { data } = await api.post(
    `/dictations/${slug}/add-time/`,
    { ms }
  );
  return data;
}
async function fetchDictationReportReasons() {
  const { data } = await api.get("/dictations/report-reasons/");
  return data;
}
async function reportDictation(slug, payload) {
  const { data } = await api.post(`/dictations/${slug}/report/`, payload);
  return data;
}
async function reportDictationQuestion(slug, text) {
  const { data } = await api.post(
    `/dictations/${slug}/question-feedback/`,
    { text }
  );
  return data;
}
async function fetchMyDictationFeedback(slug) {
  const { data } = await api.get(
    `/dictations/${slug}/my-feedback/`
  );
  return data;
}
async function fetchMe() {
  const { data } = await api.get("/me/");
  return data;
}
async function trackActivity(seconds) {
  const { data } = await api.post("/me/activity/track/", { seconds });
  return data;
}

// src/components/Layout.tsx
import { useEffect as useEffect3, useState as useState3 } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

// src/i18n/index.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// src/store/auth.ts
import { create } from "zustand";
var useAuth = create((set) => ({
  user: null,
  loading: true,
  isLoggedIn: false,
  signIn: (access, refresh, user) => {
    tokenStore.save(access, refresh);
    set({ user, isLoggedIn: true, loading: false });
  },
  signOut: () => {
    tokenStore.clear();
    set({ user: null, isLoggedIn: false, loading: false });
  },
  setUser: (user) => set({ user, isLoggedIn: true }),
  /** Sahifa yangilanganda tokenni tekshirib, profilni qayta yuklaydi. */
  hydrate: async () => {
    if (!tokenStore.access) {
      set({ loading: false, isLoggedIn: false });
      return;
    }
    try {
      const user = await fetchMe();
      set({ user, isLoggedIn: true, loading: false });
    } catch {
      tokenStore.clear();
      set({ user: null, isLoggedIn: false, loading: false });
    }
  },
  addPlayedSeconds: async (seconds) => {
    if (seconds <= 0) return;
    const state = useAuth.getState();
    if (!state.isLoggedIn || !state.user) return;
    try {
      const result = await trackActivity(seconds);
      set((s) => ({
        user: s.user ? { ...s.user, today_seconds: result.today_seconds } : null
      }));
    } catch {
    }
  }
}));
window.addEventListener("listening:signed-out", () => useAuth.getState().signOut());

// src/i18n/index.tsx
var LangContext = createContext(null);
function useLang() {
  const context = useContext(LangContext);
  if (!context) throw new Error("useLang faqat LangProvider ichida ishlaydi");
  return context;
}
function useT() {
  return useLang().t;
}

// src/theme/ThemeProvider.tsx
import { createContext as createContext2, useCallback as useCallback2, useContext as useContext2, useEffect as useEffect2, useMemo as useMemo2, useState as useState2 } from "react";
var ThemeContext = createContext2(null);

// src/components/ui/index.tsx
function HeadphoneIcon({ size = 20, color = "currentColor", strokeWidth = 1.8 }) {
  return /* @__PURE__ */ React.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth,
      strokeLinecap: "round",
      "aria-hidden": "true"
    },
    /* @__PURE__ */ React.createElement("path", { d: "M4 13V12A8 8 0 0 1 20 12V13" }),
    /* @__PURE__ */ React.createElement("rect", { x: "2.5", y: "13", width: "4", height: "6", rx: "1.5" }),
    /* @__PURE__ */ React.createElement("rect", { x: "17.5", y: "13", width: "4", height: "6", rx: "1.5" })
  );
}
function ChevronIcon({ size = 16, color = "currentColor", dir = "right" }) {
  const path = dir === "left" ? "M15 18L9 12L15 6" : dir === "down" ? "M6 9L12 15L18 9" : "M9 6L15 12L9 18";
  return /* @__PURE__ */ React.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    /* @__PURE__ */ React.createElement("path", { d: path })
  );
}
function Badge({ children, style }) {
  return /* @__PURE__ */ React.createElement("span", { className: "badge", style }, children);
}
function Spinner({ label }) {
  const t = useT();
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px" } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "3px solid var(--border)",
    borderTopColor: "#10B981",
    animation: "spin .8s linear infinite"
  } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "var(--text-secondary)" } }, label ?? t.loading));
}
function ErrorState({ onRetry }) {
  const t = useT();
  return /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "56px 20px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, fontWeight: 700, marginBottom: 10 } }, t.error), onRetry && /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: onRetry }, t.retry));
}
function ProgressBar({ percent, color = "#10B981", height = 6 }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    height,
    borderRadius: height / 2,
    background: "var(--border)",
    overflow: "hidden",
    width: "100%"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    height: "100%",
    width: `${Math.max(0, Math.min(100, percent))}%`,
    background: color,
    borderRadius: height / 2,
    transition: "width .3s"
  } }));
}

// src/utils/format.ts
function formatMinutes(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${s}s`;
}

// src/components/Layout.tsx
function Logo() {
  const t = useT();
  return /* @__PURE__ */ React.createElement(Link, { to: "/", style: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
    color: "var(--text)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: "linear-gradient(135deg,#10B981 0%,#059669 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  } }, /* @__PURE__ */ React.createElement(HeadphoneIcon, { size: 18, color: "#FFFFFF", strokeWidth: 2 })), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em" } }, t.appName));
}
function PageHeader({ children }) {
  const t = useT();
  const { user, isLoggedIn } = useAuth();
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px clamp(16px,4vw,48px)",
    borderBottom: "1px solid var(--border)",
    flexWrap: "wrap",
    gap: 12
  } }, /* @__PURE__ */ React.createElement(Logo, null), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" } }, children, isLoggedIn ? /* @__PURE__ */ React.createElement(Link, { to: "/profile", "aria-label": t.tabProfile, style: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#10B981 0%,#2563EB 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    color: "#FFF",
    textDecoration: "none"
  } }, user?.initial ?? "?") : /* @__PURE__ */ React.createElement(
    Link,
    {
      to: "/auth",
      className: "btn btn-primary",
      style: { padding: "8px 16px", fontSize: 13, borderRadius: 20, textDecoration: "none" }
    },
    t.loginCta
  )));
}

// src/components/YouTubePlayer.tsx
import { forwardRef, useEffect as useEffect4, useImperativeHandle, useRef as useRef2, useState as useState4 } from "react";

// src/utils/youtube.ts
var SCRIPT_ID = "youtube-iframe-api";
var ytPromise = null;
function loadYouTubeApi() {
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((resolve) => {
    const w = window;
    if (w.YT?.Player) {
      resolve(w.YT);
      return;
    }
    const prev = typeof w.onYouTubeIframeAPIReady === "function" ? w.onYouTubeIframeAPIReady : null;
    w.onYouTubeIframeAPIReady = () => {
      try {
        prev?.();
      } catch {
      }
      resolve(w.YT);
    };
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (w.YT?.Player) {
        window.clearInterval(timer);
        resolve(w.YT);
      } else if (Date.now() - startedAt > 2e4) {
        window.clearInterval(timer);
      }
    }, 120);
  });
  return ytPromise;
}
function killCaptions(p) {
  if (!p) return;
  try {
    p.unloadModule?.("captions");
  } catch {
  }
  try {
    p.unloadModule?.("cc");
  } catch {
  }
  try {
    p.setOption?.("captions", "track", {});
  } catch {
  }
  try {
    p.setOption?.("cc", "track", {});
  } catch {
  }
  try {
    p.setOption?.("captions", "reload", true);
  } catch {
  }
}

// src/components/YouTubePlayer.tsx
function loadYT() {
  return loadYouTubeApi().then(() => void 0);
}
var YouTubePlayer = forwardRef(function YouTubePlayer2({ youtubeId, onReady, autoplay = false, nativeControls = false }, ref) {
  const holderRef = useRef2(null);
  const playerRef = useRef2(null);
  const [holderId] = useState4(() => `yt-${Math.random().toString(36).slice(2)}`);
  const [ready, setReady] = useState4(false);
  const [playing, setPlaying] = useState4(false);
  const chunkEndMsRef = useRef2(null);
  const chunkStartMsRef = useRef2(null);
  const pendingRateRef = useRef2(1);
  const pendingPlayRef = useRef2(null);
  const readyRef = useRef2(false);
  const [awaitingPlay, setAwaitingPlay] = useState4(false);
  const hasPlayedOnceRef = useRef2(false);
  const [volume, setVolumeState] = useState4(() => {
    try {
      const raw = localStorage.getItem("listening.yt.volume");
      const v = raw != null ? Number(raw) : NaN;
      return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 80;
    } catch {
      return 80;
    }
  });
  const [muted, setMutedState] = useState4(() => {
    try {
      return localStorage.getItem("listening.yt.muted") === "1";
    } catch {
      return false;
    }
  });
  useEffect4(() => {
    try {
      localStorage.setItem("listening.yt.volume", String(volume));
    } catch {
    }
    const p = playerRef.current;
    if (p && readyRef.current) {
      try {
        p.setVolume(volume);
      } catch {
      }
    }
  }, [volume]);
  useEffect4(() => {
    try {
      localStorage.setItem("listening.yt.muted", muted ? "1" : "0");
    } catch {
    }
    const p = playerRef.current;
    if (p && readyRef.current) {
      try {
        muted ? p.mute() : p.unMute();
      } catch {
      }
    }
  }, [muted]);
  const isUsable = (p) => !!p && readyRef.current && typeof p.seekTo === "function" && typeof p.playVideo === "function";
  const doPlayRange = (startMs, endMs) => {
    const p = playerRef.current;
    chunkStartMsRef.current = startMs;
    chunkEndMsRef.current = endMs ?? null;
    if (!isUsable(p)) {
      pendingPlayRef.current = { startMs, endMs };
      setAwaitingPlay(true);
      return;
    }
    if (!hasPlayedOnceRef.current) setAwaitingPlay(true);
    try {
      p.setPlaybackRate?.(pendingRateRef.current);
    } catch {
    }
    const SEEK_SKIP_BEFORE_MS = 250;
    const SEEK_SKIP_AFTER_MS = 30;
    let curMs = -1;
    try {
      curMs = (p.getCurrentTime?.() ?? 0) * 1e3;
    } catch {
    }
    const closeEnough = hasPlayedOnceRef.current && curMs >= 0 && curMs >= startMs - SEEK_SKIP_BEFORE_MS && curMs <= startMs + SEEK_SKIP_AFTER_MS;
    if (!closeEnough) {
      try {
        p.seekTo(startMs / 1e3, true);
      } catch {
      }
    }
    try {
      p.playVideo();
    } catch {
    }
  };
  useImperativeHandle(ref, () => ({
    play: () => {
      const p = playerRef.current;
      if (!isUsable(p)) {
        if (chunkStartMsRef.current != null) {
          pendingPlayRef.current = {
            startMs: chunkStartMsRef.current,
            endMs: chunkEndMsRef.current ?? void 0
          };
        }
        setAwaitingPlay(true);
        return;
      }
      if (!hasPlayedOnceRef.current) setAwaitingPlay(true);
      try {
        p.playVideo();
      } catch {
      }
    },
    pause: () => {
      const p = playerRef.current;
      if (!isUsable(p)) return;
      try {
        p.pauseVideo();
      } catch {
      }
    },
    playRange: doPlayRange,
    seek: (ms) => {
      const p = playerRef.current;
      if (!isUsable(p)) return;
      try {
        p.seekTo(ms / 1e3, true);
      } catch {
      }
    },
    currentTimeMs: () => {
      const p = playerRef.current;
      if (!isUsable(p)) return 0;
      try {
        return p.getCurrentTime() * 1e3;
      } catch {
        return 0;
      }
    },
    setPlaybackRate: (rate) => {
      pendingRateRef.current = rate;
      const p = playerRef.current;
      if (!isUsable(p)) return;
      try {
        p.setPlaybackRate(rate);
      } catch {
      }
    },
    isPlaying: () => {
      const p = playerRef.current;
      if (!isUsable(p) || typeof p.getPlayerState !== "function") return false;
      try {
        return p.getPlayerState() === 1;
      } catch {
        return false;
      }
    },
    setVolume: (v) => {
      const clamped = Math.max(0, Math.min(100, Math.round(v)));
      setVolumeState(clamped);
    },
    getVolume: () => {
      const p = playerRef.current;
      if (!isUsable(p) || typeof p.getVolume !== "function") return null;
      try {
        return p.getVolume();
      } catch {
        return null;
      }
    },
    mute: () => setMutedState(true),
    unMute: () => setMutedState(false),
    isMuted: () => muted
  }));
  useEffect4(() => {
    let cancelled = false;
    loadYT().then(() => {
      if (cancelled || !holderRef.current) return;
      const YT = window.YT;
      playerRef.current = new YT.Player(holderId, {
        videoId: youtubeId,
        // nocookie domain — cookie/tracking yo'q, tezroq yuklanadi
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          controls: nativeControls ? 1 : 0,
          disablekb: nativeControls ? 0 : 1,
          fs: nativeControls ? 1 : 0,
          iv_load_policy: 3,
          // Video annotationlari yashiriladi
          cc_load_policy: 0,
          // Captions/subtitle default'da yoqilmasin
          cc_lang_pref: "xx",
          // Yaramas til → captions yuklanmaydi
          hl: "xx",
          // Interface tili — xato → CC ham xato
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            setReady(true);
            killCaptions(playerRef.current);
            try {
              playerRef.current?.setPlaybackRate?.(pendingRateRef.current);
              playerRef.current?.setVolume?.(volume);
              if (muted) playerRef.current?.mute?.();
              else playerRef.current?.unMute?.();
            } catch {
            }
            const pending = pendingPlayRef.current;
            if (pending) {
              pendingPlayRef.current = null;
              doPlayRange(pending.startMs, pending.endMs);
            }
            onReady?.();
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e) => {
            setPlaying(e.data === 1);
            if (e.data === 1) {
              hasPlayedOnceRef.current = true;
              setAwaitingPlay(false);
            }
            if (e.data === 1) {
              const p = playerRef.current;
              if (!p) return;
              killCaptions(p);
              const endMs = chunkEndMsRef.current;
              const startMs = chunkStartMsRef.current;
              if (endMs == null || startMs == null) return;
              const cur = p.getCurrentTime() * 1e3;
              if (cur >= endMs || cur < startMs - 500) {
                p.seekTo(startMs / 1e3, true);
              }
            }
          }
        }
      });
    });
    const timer = window.setInterval(() => {
      const p = playerRef.current;
      const endMs = chunkEndMsRef.current;
      if (!p || endMs == null) return;
      if (typeof p.getPlayerState !== "function") return;
      if (p.getPlayerState() !== 1) return;
      if (typeof p.getCurrentTime !== "function") return;
      if (p.getCurrentTime() * 1e3 >= endMs) {
        try {
          p.pauseVideo();
        } catch {
        }
      }
    }, 100);
    return () => {
      cancelled = true;
      readyRef.current = false;
      hasPlayedOnceRef.current = false;
      window.clearInterval(timer);
      try {
        playerRef.current?.destroy?.();
      } catch {
      }
      playerRef.current = null;
    };
  }, [youtubeId, holderId, autoplay, onReady]);
  return /* @__PURE__ */ React.createElement("div", { style: {
    position: "relative",
    aspectRatio: "16/9",
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    background: "#0F172A"
  } }, /* @__PURE__ */ React.createElement("div", { id: holderId, ref: holderRef, style: { width: "100%", height: "100%" } }), !nativeControls && /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick: () => {
        const p = playerRef.current;
        if (!isUsable(p)) return;
        if (playing) {
          try {
            p.pauseVideo();
          } catch {
          }
        } else {
          setAwaitingPlay(true);
          try {
            p.playVideo();
          } catch {
          }
        }
      },
      onContextMenu: (e) => e.preventDefault(),
      title: playing ? "To'xtatish uchun bosing" : "Ijro uchun bosing",
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 48,
        background: "transparent",
        cursor: "pointer"
      }
    }
  ), ready && !awaitingPlay && !playing && /* @__PURE__ */ React.createElement(
    "div",
    {
      "aria-hidden": "true",
      style: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: "rgba(0,0,0,.55)",
        color: "#FFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        fontWeight: 700,
        pointerEvents: "none",
        border: "2px solid rgba(255,255,255,.35)"
      }
    },
    "\u25B6"
  ), awaitingPlay && /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    inset: 0,
    background: "rgba(15,23,42,.85)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: 600,
    zIndex: 3,
    pointerEvents: "none"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "3px solid rgba(255,255,255,.12)",
    borderTopColor: "#10B981",
    animation: "ytSpin 0.7s linear infinite"
  } }), /* @__PURE__ */ React.createElement("span", null, ready ? "Video ochilyapti..." : "YouTube tayyorlanmoqda..."), /* @__PURE__ */ React.createElement("style", null, `@keyframes ytSpin { to { transform: rotate(360deg); } }`)), !nativeControls && /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
    background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.65) 100%)",
    zIndex: 2
  } }, /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: 11,
    color: "rgba(255,255,255,.7)",
    fontWeight: 600,
    pointerEvents: "none"
  } }, "Videoga bosing \u2014 pauza / ijro"), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => setMutedState((m) => !m),
      "aria-label": muted ? "Ovozni yoqish" : "Ovozni o'chirish",
      title: muted ? "Ovozni yoqish" : "Ovozni o'chirish",
      style: {
        width: 30,
        height: 30,
        borderRadius: 8,
        cursor: "pointer",
        background: "rgba(255,255,255,.14)",
        color: "#FFF",
        border: "1px solid rgba(255,255,255,.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14
      }
    },
    muted || volume === 0 ? "\u{1F507}" : volume < 50 ? "\u{1F508}" : "\u{1F50A}"
  ), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "range",
      min: 0,
      max: 100,
      step: 1,
      value: muted ? 0 : volume,
      onChange: (e) => {
        const v = Number(e.target.value);
        setVolumeState(v);
        if (v > 0 && muted) setMutedState(false);
      },
      "aria-label": "Ovoz",
      title: `Ovoz: ${muted ? 0 : volume}`,
      style: {
        width: 96,
        accentColor: "#10B981",
        cursor: "pointer"
      }
    }
  ), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement(
    "a",
    {
      href: `https://www.youtube.com/watch?v=${youtubeId}`,
      target: "_blank",
      rel: "noopener noreferrer",
      title: "Asl manbani YouTube'da ochish",
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "#FFF",
        textDecoration: "none",
        background: "rgba(239, 68, 68, .85)",
        border: "1px solid rgba(255,255,255,.25)",
        borderRadius: 8,
        padding: "6px 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    },
    /* @__PURE__ */ React.createElement("span", { "aria-hidden": true }, "\u25B6"),
    "YouTube'da ochish"
  )));
});
var YouTubePlayer_default = YouTubePlayer;

// src/components/QuestionPositionBar.tsx
import { useEffect as useEffect5, useMemo as useMemo3, useState as useState5 } from "react";
function parseSec(mark) {
  if (Number.isFinite(mark.sec)) return mark.sec;
  const m = (mark.proof || "").match(/\[\s*([0-9]+(?:\.[0-9]+)?)\s*\]/);
  return m ? parseFloat(m[1]) : NaN;
}
function QuestionPositionBar({
  totalSec,
  questions,
  getCurrentSec,
  localStorageKey,
  label = "Savol pozitsiyalarini ko'rsatish",
  spotlight = false
}) {
  const [enabled, setEnabled] = useState5(() => {
    try {
      return localStorage.getItem(localStorageKey) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(localStorageKey, next ? "1" : "0");
      } catch {
      }
      return next;
    });
  };
  const marks = useMemo3(() => questions.map((q) => ({ ...q, secResolved: parseSec(q) })).filter((x) => Number.isFinite(x.secResolved)), [questions]);
  const [curSec, setCurSec] = useState5(0);
  useEffect5(() => {
    if (!enabled) return;
    let alive = true;
    const tick = () => {
      if (alive) setCurSec(getCurrentSec() || 0);
    };
    const id = window.setInterval(tick, 400);
    tick();
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [enabled, getCurrentSec]);
  const total = Math.max(totalSec || 0, 1);
  let activeIdx = -1;
  for (let i = 0; i < marks.length; i++) {
    if (marks[i].secResolved <= curSec + 0.5) activeIdx = i;
    else break;
  }
  const badgeBg = (label2, active) => {
    if (active) return "linear-gradient(135deg,#F59E0B,#B45309)";
    if (label2 === "MCQ") return "#2563EB";
    if (label2 === "TFNG") return "#7C3AED";
    return "#F59E0B";
  };
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(
    "label",
    {
      className: spotlight ? "onb-spotlight" : void 0,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-secondary)",
        cursor: "pointer",
        userSelect: "none"
      }
    },
    /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: enabled,
        onChange: toggle,
        style: { cursor: "pointer", accentColor: "#2563EB" }
      }
    ),
    label
  ), enabled && marks.length > 0 && /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 8,
    position: "relative",
    height: 26,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "0 10px"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    left: 10,
    top: 12,
    right: 10,
    height: 2,
    background: "var(--border)",
    borderRadius: 2
  } }), /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    left: 10,
    top: 12,
    width: `calc((100% - 20px) * ${Math.max(0, Math.min(1, curSec / total))})`,
    height: 2,
    background: "#10B981",
    borderRadius: 2,
    transition: "width .25s linear"
  } }), marks.map((m, i) => {
    const pct = m.secResolved / total * 100;
    const active = i === activeIdx;
    return /* @__PURE__ */ React.createElement(
      "span",
      {
        key: i,
        title: `${m.label} #${m.n} \u2014 ${m.secResolved.toFixed(1)}s`,
        style: {
          position: "absolute",
          top: "50%",
          left: `calc(10px + (100% - 20px) * ${pct / 100})`,
          transform: active ? "translate(-50%, -50%) scale(1.25)" : "translate(-50%, -50%)",
          minWidth: 18,
          height: 18,
          padding: "0 5px",
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: badgeBg(m.label, active),
          color: "#FFF",
          boxShadow: active ? "0 4px 12px rgba(245,158,11,.5)" : "0 2px 4px rgba(0,0,0,.15)",
          transition: "transform .15s"
        }
      },
      m.n
    );
  })));
}

// src/components/OnboardingHint.tsx
import { useEffect as useEffect6 } from "react";
function OnboardingHint({
  title,
  text,
  art,
  placement = "bottom-right",
  onClose
}) {
  useEffect6(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const pos = placement === "bottom-center" ? { left: "50%", transform: "translateX(-50%)", bottom: 24 } : { right: "clamp(12px, 3vw, 28px)", bottom: "clamp(12px, 4vh, 32px)" };
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick: onClose,
      "aria-hidden": true,
      style: { position: "fixed", inset: 0, zIndex: 998, background: "transparent" }
    }
  ), /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "dialog",
      "aria-label": title,
      className: `onb-hint${placement === "bottom-center" ? " onb-hint--center" : ""}`,
      style: {
        position: "fixed",
        zIndex: 999,
        ...pos,
        width: "min(320px, calc(100vw - 24px))",
        background: "var(--card-solid, var(--bg-secondary))",
        border: "1px solid var(--border)",
        borderRadius: 16,
        boxShadow: "0 18px 48px rgba(15,23,42,.28)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        font: "inherit"
      }
    },
    art && /* @__PURE__ */ React.createElement("div", { style: {
      borderRadius: 12,
      padding: 12,
      background: "var(--bg)",
      border: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    } }, art),
    /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 14,
      fontWeight: 800,
      color: "var(--text)",
      marginBottom: 4
    } }, title), /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 12.5,
      lineHeight: 1.55,
      color: "var(--text-secondary)",
      fontWeight: 500
    } }, text)),
    /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: onClose,
        className: "btn btn-primary",
        style: {
          alignSelf: "stretch",
          padding: "9px 14px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer"
        }
      },
      "Tushunarli"
    )
  ));
}
function HintArtPositions({ vertical = false }) {
  const marks = [
    { at: 18, color: "#2563EB", n: "1" },
    { at: 48, color: "#7C3AED", n: "2" },
    { at: 78, color: "#F59E0B", n: "3" }
  ];
  if (vertical) {
    return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14 } }, /* @__PURE__ */ React.createElement("div", { style: {
      position: "relative",
      width: 20,
      height: 108,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 999
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      top: 4,
      left: "50%",
      transform: "translateX(-50%)",
      width: 4,
      bottom: 4,
      background: "rgba(148,163,184,.3)",
      borderRadius: 2
    } }), /* @__PURE__ */ React.createElement("div", { className: "onb-fill-v", style: {
      position: "absolute",
      top: 4,
      left: "50%",
      transform: "translateX(-50%)",
      width: 4,
      background: "linear-gradient(180deg,#10B981,#059669)",
      borderRadius: 2
    } }), marks.map((m) => /* @__PURE__ */ React.createElement("span", { key: m.n, style: {
      position: "absolute",
      left: "50%",
      top: `${m.at}%`,
      transform: "translate(-50%,-50%)",
      width: 16,
      height: 16,
      borderRadius: 999,
      background: m.color,
      color: "#FFF",
      fontSize: 9.5,
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    } }, m.n))), /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 11,
      fontWeight: 700,
      color: "var(--text-secondary)",
      lineHeight: 1.6
    } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { color: "#10B981" } }, "\u25AE"), " hozir shu yerdasiz"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { color: "#2563EB" } }, "\u25CF"), " savol shu soniyada")));
  }
  return /* @__PURE__ */ React.createElement("div", { style: { width: "100%" } }, /* @__PURE__ */ React.createElement("div", { style: {
    position: "relative",
    height: 26,
    borderRadius: 999,
    padding: "0 10px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 12,
    height: 2,
    background: "var(--border)",
    borderRadius: 2
  } }), /* @__PURE__ */ React.createElement("div", { className: "onb-fill-h", style: {
    position: "absolute",
    left: 10,
    top: 12,
    height: 2,
    background: "#10B981",
    borderRadius: 2
  } }), marks.map((m) => /* @__PURE__ */ React.createElement("span", { key: m.n, style: {
    position: "absolute",
    top: "50%",
    left: `calc(10px + (100% - 20px) * ${m.at / 100})`,
    transform: "translate(-50%,-50%)",
    width: 18,
    height: 18,
    borderRadius: 999,
    background: m.color,
    color: "#FFF",
    fontSize: 10,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  } }, m.n))), /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-secondary)",
    display: "flex",
    gap: 12,
    flexWrap: "wrap"
  } }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { style: { color: "#10B981" } }, "\u25AE"), " hozirgi vaqt"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { style: { color: "#2563EB" } }, "\u25CF"), " savolning joyi")));
}
function HintArtProof() {
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } }, /* @__PURE__ */ React.createElement("span", { style: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 11px",
    borderRadius: 999,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    fontSize: 11.5,
    fontWeight: 800,
    color: "var(--text)",
    whiteSpace: "nowrap"
  } }, /* @__PURE__ */ React.createElement("svg", { width: "10", height: "10", viewBox: "0 0 24 24", "aria-hidden": true }, /* @__PURE__ */ React.createElement("path", { d: "M6 4l14 8-14 8z", fill: "currentColor" })), "Isbot"), /* @__PURE__ */ React.createElement("svg", { width: "26", height: "12", viewBox: "0 0 26 12", "aria-hidden": true, className: "onb-arrow" }, /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M0 6h20M15 1l6 5-6 5",
      stroke: "var(--text-secondary)",
      strokeWidth: "1.8",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  )), /* @__PURE__ */ React.createElement("div", { style: {
    position: "relative",
    width: 92,
    height: 54,
    borderRadius: 8,
    background: "#0F172A",
    overflow: "hidden",
    flexShrink: 0
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    height: 3,
    background: "rgba(255,255,255,.25)"
  } }), /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    left: 0,
    bottom: 8,
    height: 3,
    width: "58%",
    background: "#10B981"
  } }), /* @__PURE__ */ React.createElement("span", { style: {
    position: "absolute",
    left: "58%",
    bottom: 9.5,
    transform: "translate(-50%,50%)",
    width: 9,
    height: 9,
    borderRadius: 999,
    background: "#FFF",
    boxShadow: "0 0 0 3px rgba(16,185,129,.5)"
  } })));
}

// src/components/FeedbackModals.tsx
import { useEffect as useEffect7, useState as useState6 } from "react";
function ModalShell({ title, onClose, children }) {
  useEffect7(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 16
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: {
      background: "var(--bg)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: 20,
      width: "100%",
      maxWidth: 460,
      maxHeight: "90vh",
      overflowY: "auto",
      boxShadow: "0 24px 60px rgba(0,0,0,.45)",
      display: "flex",
      flexDirection: "column",
      gap: 14
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("h3", { style: { margin: 0, fontSize: 16, fontWeight: 800 } }, title), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: onClose,
        "aria-label": "Yopish",
        style: {
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          cursor: "pointer",
          fontSize: 15,
          fontWeight: 800,
          color: "var(--text-secondary)"
        }
      },
      "\xD7"
    )), children)
  );
}
function describeError(e) {
  const err = e;
  const status = err?.response?.status;
  if (status === 409) return { alreadySent: true, message: "" };
  if (status === 401) return { alreadySent: false, message: "Yuborish uchun kirish kerak." };
  return {
    alreadySent: false,
    message: err?.response?.data?.detail || "Yubora olmadik. Qaytadan urinib ko'ring."
  };
}
function ReportModal({ loadReasons, submit, onClose, onSubmitted }) {
  const [reasons, setReasons] = useState6([]);
  const [chosen, setChosen] = useState6("");
  const [text, setText] = useState6("");
  const [busy, setBusy] = useState6(false);
  const [error, setError] = useState6("");
  useEffect7(() => {
    let cancelled = false;
    loadReasons().then((r) => {
      if (!cancelled) setReasons(r);
    }).catch(() => {
      if (!cancelled) setError("Sabablarni yuklab bo'lmadi.");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const send = async () => {
    if (!chosen) {
      setError("Iltimos, sabab tanlang.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submit({ reason: chosen, text: text.trim() || void 0 });
      onSubmitted();
    } catch (e) {
      const { alreadySent, message } = describeError(e);
      if (alreadySent) onSubmitted();
      else setError(message);
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ React.createElement(ModalShell, { title: "Shikoyat yuborish", onClose }, /* @__PURE__ */ React.createElement("p", { style: { margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 } }, "Ushbu video haqida sababni tanlang. Ma'muriyat ko'rib chiqadi."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, reasons.map((r) => {
    const active = chosen === r.key;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: r.key,
        type: "button",
        onClick: () => setChosen(r.key),
        disabled: busy,
        style: {
          textAlign: "left",
          padding: "10px 12px",
          borderRadius: 10,
          cursor: "pointer",
          fontSize: 13.5,
          fontWeight: 600,
          background: active ? "var(--ok-bg)" : "var(--bg-secondary)",
          color: active ? "var(--ok-text)" : "var(--text)",
          border: `1.5px solid ${active ? "#10B981" : "var(--border)"}`,
          display: "flex",
          alignItems: "center",
          gap: 10
        }
      },
      /* @__PURE__ */ React.createElement("span", { "aria-hidden": true, style: {
        width: 16,
        height: 16,
        borderRadius: "50%",
        border: `2px solid ${active ? "#10B981" : "var(--border)"}`,
        background: active ? "#10B981" : "transparent",
        flexShrink: 0
      } }),
      r.label
    );
  })), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: text,
      onChange: (e) => setText(e.target.value),
      disabled: busy,
      placeholder: "Ixtiyoriy \u2014 qo'shimcha izoh yozing (masalan: aniq daqiqa, kontekst)\u2026",
      rows: 3,
      style: {
        width: "100%",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 13,
        resize: "vertical",
        background: "var(--bg-secondary)",
        color: "var(--text)",
        fontFamily: "inherit"
      }
    }
  ), error && /* @__PURE__ */ React.createElement(ErrorLine, { text: error }), /* @__PURE__ */ React.createElement(ModalActions, { busy, onClose, onSubmit: send, submitLabel: "Yuborish" }));
}
function QuestionFeedbackModal({ submit, onClose, onSubmitted }) {
  const [text, setText] = useState6("");
  const [busy, setBusy] = useState6(false);
  const [error, setError] = useState6("");
  const send = async () => {
    if (text.trim().length < 3) {
      setError("Iltimos, batafsilroq yozing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submit(text.trim());
      onSubmitted();
    } catch (e) {
      const { alreadySent, message } = describeError(e);
      if (alreadySent) onSubmitted();
      else setError(message);
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ React.createElement(ModalShell, { title: "Savol xato tuzilgan", onClose }, /* @__PURE__ */ React.createElement("p", { style: { margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 } }, "Qaysi savol qanday xato deb hisoblaysiz? Ma'muriyat AI natijasini qayta ko'rib chiqadi."), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: text,
      onChange: (e) => setText(e.target.value),
      disabled: busy,
      placeholder: 'Masalan: "1-savol xato tuzilgan, to\u2018g\u2018ri javob True bo\u2018ladi"',
      rows: 5,
      autoFocus: true,
      style: {
        width: "100%",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 13.5,
        resize: "vertical",
        background: "var(--bg-secondary)",
        color: "var(--text)",
        fontFamily: "inherit",
        minHeight: 100
      }
    }
  ), error && /* @__PURE__ */ React.createElement(ErrorLine, { text: error }), /* @__PURE__ */ React.createElement(ModalActions, { busy, onClose, onSubmit: send, submitLabel: "Yuborish" }));
}
function ErrorLine({ text }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12,
    color: "#B91C1C",
    padding: "8px 10px",
    background: "rgba(239,68,68,.1)",
    borderRadius: 8
  } }, text);
}
function ModalActions({ busy, onClose, onSubmit, submitLabel }) {
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: onClose,
      disabled: busy,
      className: "btn btn-ghost",
      style: { borderRadius: 10, fontWeight: 700, flex: "1 1 100px" }
    },
    "Bekor qilish"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: onSubmit,
      disabled: busy,
      className: "btn btn-primary",
      style: { borderRadius: 10, fontWeight: 800, flex: "1 1 140px" }
    },
    busy ? "Yuborilmoqda\u2026" : submitLabel
  ));
}

// src/utils/onboarding.ts
import { useCallback as useCallback3, useEffect as useEffect8, useState as useState7 } from "react";
var ONBOARDING_WINDOW_MS = 2 * 24 * 60 * 60 * 1e3;
var SEEN_PREFIX = "listening.onboarding.seen.";
var FIRST_VISIT_KEY = "listening.onboarding.first_visit";
var HINT = {
  /** Shorts: rail'dagi savol-pozitsiyasi termometri nima qilishi. */
  shortsPositions: "shorts-positions",
  /** Listening test: savol pozitsiyasi bari + "Isbot" tugmasi. */
  testPositions: "test-positions",
  /** Listening test: "Isbot" bosilganda video o'sha joyga suriladi. */
  testProof: "test-proof"
};
function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
}
function isNewUser(dateJoined) {
  if (dateJoined) {
    const joined = Date.parse(dateJoined);
    if (Number.isFinite(joined)) return Date.now() - joined < ONBOARDING_WINDOW_MS;
  }
  const stored = safeGet(FIRST_VISIT_KEY);
  const first = stored ? Number(stored) : NaN;
  if (!Number.isFinite(first)) {
    safeSet(FIRST_VISIT_KEY, String(Date.now()));
    return true;
  }
  return Date.now() - first < ONBOARDING_WINDOW_MS;
}
function hintSeen(key) {
  return safeGet(SEEN_PREFIX + key) === "1";
}
function markHintSeen(key) {
  safeSet(SEEN_PREFIX + key, "1");
}
function useOnboardingHint(key, ready, delayMs = 1500) {
  const dateJoined = useAuth((s) => s.user?.date_joined);
  const authLoading = useAuth((s) => s.loading);
  const [open, setOpen] = useState7(false);
  useEffect8(() => {
    if (!ready || authLoading) return;
    if (hintSeen(key) || !isNewUser(dateJoined)) return;
    const id = window.setTimeout(() => setOpen(true), delayMs);
    return () => window.clearTimeout(id);
  }, [key, ready, authLoading, dateJoined, delayMs]);
  const dismiss = useCallback3(() => {
    markHintSeen(key);
    setOpen(false);
  }, [key]);
  return { open, dismiss };
}

// src/utils/grade.ts
var CURLY_QUOTES = /[‘’]/g;
var NUM_SEP = /(\d)[,.](\d)/g;
var ORDINAL = /(\d+)(st|nd|rd|th)\b/gi;
var PUNCT = /[^\p{L}\p{N}\s']/gu;
var SPACE = /\s+/g;
function normalize(text) {
  if (!text) return "";
  let s = text.normalize("NFKC").toLowerCase().trim();
  s = s.replace(CURLY_QUOTES, "'");
  let prev;
  do {
    prev = s;
    s = s.replace(NUM_SEP, "$1$2");
  } while (s !== prev);
  s = s.replace(ORDINAL, "$1");
  s = s.replace(PUNCT, " ");
  return s.replace(SPACE, " ").trim();
}
function gradeDictation(expected, given) {
  const givenWords = normalize(given).split(" ").filter(Boolean);
  const rawWords = expected.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) {
    return { isCorrect: false, score: 0, words: [], matched: 0, total: 0 };
  }
  let cursor = 0;
  let matched = 0;
  let total = 0;
  const wordFeedback = [];
  for (const raw of rawWords) {
    const cleaned = normalize(raw);
    if (!cleaned) {
      wordFeedback.push({ w: raw, found: true, dots: "" });
      continue;
    }
    const subs = cleaned.split(" ").filter(Boolean);
    let allFound = true;
    for (const sub of subs) {
      total += 1;
      const idx = givenWords.indexOf(sub, cursor);
      if (idx >= 0) {
        cursor = idx + 1;
        matched += 1;
      } else {
        allFound = false;
      }
    }
    wordFeedback.push({
      w: raw,
      found: allFound,
      dots: allFound ? "" : "\u2022".repeat(Math.max(2, cleaned.length || 3))
    });
  }
  if (total === 0) {
    return { isCorrect: false, score: 0, words: wordFeedback, matched: 0, total: 0 };
  }
  return {
    isCorrect: matched === total,
    score: Math.round(matched / total * 1e4) / 1e4,
    words: wordFeedback,
    matched,
    total
  };
}

// src/features/lessons/DictationPage.tsx
var SETTINGS_KEY = "listening.dictation.settings";
var DEFAULT_SETTINGS = {
  showAnswerImmediately: false,
  showFullAnswer: false,
  playbackRate: 1,
  chunkMode: "sentence",
  chunkMinWords: 15
};
var MIN_ALLOWED_WORDS = 5;
var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];
var CHUNK_LEAD_MS = 200;
var CHUNK_TAIL_MS = 250;
var AUTO_NEXT_MS = 500;
var SKIP_NEXT_MS = 800;
var ABBREVIATIONS = /* @__PURE__ */ new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "prof.",
  "st.",
  "sr.",
  "jr.",
  "vs.",
  "e.g.",
  "i.e.",
  "etc.",
  "no."
]);
function mergeIntoSentences(body, allWords) {
  const result = [];
  let buffer = [];
  const endsSentence = (text) => {
    let t = text.trim().replace(/[)}\]"'"']+$/, "");
    if (!t) return false;
    const last = t[t.length - 1];
    if (!".!?\u2026".includes(last)) return false;
    const lastWord = t.split(/\s+/).pop() ?? "";
    if (ABBREVIATIONS.has(lastWord.toLowerCase())) return false;
    return true;
  };
  const flush = () => {
    if (buffer.length === 0) return;
    result.push({
      start_ms: buffer[0].start_ms,
      end_ms: buffer[buffer.length - 1].end_ms,
      text: buffer.map((b) => b.text.trim()).join(" ").trim()
    });
    buffer = [];
  };
  for (const chunk of body) {
    const parts = splitByBoundary(chunk.text);
    if (parts.length <= 1) {
      buffer.push(chunk);
      if (endsSentence(chunk.text)) flush();
      continue;
    }
    const partsWithTimes = assignTimesToParts(chunk, parts, allWords);
    partsWithTimes.forEach((seg, i) => {
      buffer.push(seg);
      if (endsSentence(parts[i])) flush();
    });
  }
  if (buffer.length > 0) flush();
  return result;
}
function assignTimesToParts(chunk, parts, allWords) {
  if (!allWords || allWords.length === 0) {
    return proportionalTimes(chunk, parts);
  }
  const startS = chunk.start_ms / 1e3;
  const endS = chunk.end_ms / 1e3;
  const inRange = allWords.filter(
    (w) => w.end >= startS - 0.05 && w.start <= endS + 0.05
  );
  if (inRange.length === 0) return proportionalTimes(chunk, parts);
  const wordCounts = parts.map((p) => p.trim().split(/\s+/).filter(Boolean).length);
  const total = wordCounts.reduce((a, b) => a + b, 0);
  if (total === 0 || Math.abs(total - inRange.length) > Math.max(2, Math.round(total * 0.15))) {
    return proportionalTimes(chunk, parts);
  }
  const scale = inRange.length / total;
  const out = [];
  let used = 0;
  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    const take = isLast ? inRange.length - used : Math.max(1, Math.round(wordCounts[i] * scale));
    const slice = inRange.slice(used, used + take);
    if (slice.length === 0) {
      out.push({ start_ms: chunk.start_ms, end_ms: chunk.end_ms, text: parts[i] });
      continue;
    }
    const startMs = i === 0 ? chunk.start_ms : Math.max(chunk.start_ms, Math.round(slice[0].start * 1e3));
    const endMs = isLast ? chunk.end_ms : Math.min(chunk.end_ms, Math.round(slice[slice.length - 1].end * 1e3));
    out.push({ start_ms: startMs, end_ms: endMs, text: parts[i] });
    used += take;
  }
  return out;
}
function normalizeWord(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function snapChunksToWords(chunks, allWords) {
  if (!allWords || allWords.length === 0) return chunks;
  const normWords = allWords.map((w) => normalizeWord(w.word));
  const findClosest = (target, targetMs, maxDistMs) => {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < normWords.length; i++) {
      if (normWords[i] !== target) continue;
      const wMid = (allWords[i].start + allWords[i].end) * 500;
      const dist = Math.abs(wMid - targetMs);
      if (dist < bestDist && dist <= maxDistMs) {
        bestIdx = i;
        bestDist = dist;
      }
    }
    return bestIdx;
  };
  const TOL_MS = 3e3;
  return chunks.map((chunk) => {
    const textWords = chunk.text.trim().split(/\s+/).map(normalizeWord).filter(Boolean);
    if (textWords.length === 0) return chunk;
    const first = textWords[0];
    const last = textWords[textWords.length - 1];
    const firstIdx = findClosest(first, chunk.start_ms, TOL_MS);
    const lastIdx = findClosest(last, chunk.end_ms, TOL_MS);
    if (firstIdx < 0 && lastIdx < 0) return chunk;
    const start_ms = firstIdx >= 0 ? Math.round(allWords[firstIdx].start * 1e3) : chunk.start_ms;
    const end_ms = lastIdx >= 0 ? Math.round(allWords[lastIdx].end * 1e3) : chunk.end_ms;
    if (end_ms <= start_ms) return chunk;
    return { start_ms, end_ms, text: chunk.text };
  });
}
function proportionalTimes(chunk, parts) {
  const dur = chunk.end_ms - chunk.start_ms;
  const totalLen = parts.reduce((a, p) => a + p.length, 0) || 1;
  const out = [];
  let t = chunk.start_ms;
  parts.forEach((p, i) => {
    const partDur = Math.round(p.length / totalLen * dur);
    const partEnd = i === parts.length - 1 ? chunk.end_ms : t + partDur;
    out.push({ start_ms: t, end_ms: partEnd, text: p });
    t = partEnd;
  });
  return out;
}
var WEAK_BOUNDARY = /[,;:—–.!?]$/;
function splitLongChunks(chunks, allWords, minWords) {
  if (!chunks.length) return chunks;
  const n = Math.max(MIN_ALLOWED_WORDS, Math.floor(minWords));
  const out = [];
  for (const chunk of chunks) {
    const words = chunk.text.trim().split(/\s+/).filter(Boolean);
    if (words.length < n) {
      out.push(chunk);
      continue;
    }
    let cutIdx = -1;
    for (let i = n - 1; i < words.length - 1; i++) {
      const w = words[i].replace(/[)}\]"'"']+$/, "");
      if (WEAK_BOUNDARY.test(w)) {
        cutIdx = i;
        break;
      }
    }
    if (cutIdx < 0) {
      out.push(chunk);
      continue;
    }
    const leftWords = words.slice(0, cutIdx + 1);
    const rightWords = words.slice(cutIdx + 1);
    const leftText = leftWords.join(" ");
    const rightText = rightWords.join(" ");
    const [leftEnd, rightStart] = resolveSplitTime(
      chunk,
      leftWords,
      rightWords,
      allWords
    );
    out.push({ start_ms: chunk.start_ms, end_ms: leftEnd, text: leftText });
    const rest = splitLongChunks(
      [{ start_ms: rightStart, end_ms: chunk.end_ms, text: rightText }],
      allWords,
      n
    );
    out.push(...rest);
  }
  return out;
}
var HARD_MAX_WORDS = 16;
var HARD_MAX_MS = 14e3;
var MIN_PIECE_WORDS = 4;
var MAX_SPLIT_DEPTH = 8;
function needsForceSplit(chunk) {
  const words = chunk.text.trim().split(/\s+/).filter(Boolean);
  if (words.length < MIN_PIECE_WORDS * 2) return false;
  return words.length > HARD_MAX_WORDS || chunk.end_ms - chunk.start_ms > HARD_MAX_MS;
}
function wordsInsideChunk(chunk, allWords) {
  if (!allWords || allWords.length === 0) return [];
  const startS = chunk.start_ms / 1e3;
  const endS = chunk.end_ms / 1e3;
  return allWords.filter((w) => w.start >= startS - 0.05 && w.end <= endS + 0.05);
}
function bestSplitIndex(inRange, wordCount) {
  const lo = MIN_PIECE_WORDS - 1;
  const hi = wordCount - MIN_PIECE_WORDS - 1;
  if (hi < lo) return -1;
  const mid = (wordCount - 1) / 2;
  let bestIdx = -1;
  let bestScore = -Infinity;
  for (let i = lo; i <= hi; i++) {
    const cur = inRange[i];
    const next = inRange[i + 1];
    if (!cur || !next) continue;
    const gapMs = (next.start - cur.end) * 1e3;
    const score = gapMs - Math.abs(i - mid) * 12;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}
function forceSplitLongChunks(chunks, allWords, depth = 0) {
  if (!chunks.length || depth > MAX_SPLIT_DEPTH) return chunks;
  const out = [];
  let didSplit = false;
  for (const chunk of chunks) {
    if (!needsForceSplit(chunk)) {
      out.push(chunk);
      continue;
    }
    const words = chunk.text.trim().split(/\s+/).filter(Boolean);
    const inRange = wordsInsideChunk(chunk, allWords);
    let cutIdx = -1;
    let leftEnd = 0;
    let rightStart = 0;
    if (inRange.length === words.length) {
      cutIdx = bestSplitIndex(inRange, words.length);
      if (cutIdx >= 0) {
        leftEnd = Math.round(inRange[cutIdx].end * 1e3);
        rightStart = Math.round(inRange[cutIdx + 1].start * 1e3);
      }
    }
    if (cutIdx < 0) {
      cutIdx = Math.floor((words.length - 1) / 2);
      const ratio = (cutIdx + 1) / words.length;
      const boundary = chunk.start_ms + Math.round(ratio * (chunk.end_ms - chunk.start_ms));
      leftEnd = boundary;
      rightStart = boundary;
    }
    didSplit = true;
    out.push({
      start_ms: chunk.start_ms,
      end_ms: Math.max(chunk.start_ms + 1, leftEnd),
      text: words.slice(0, cutIdx + 1).join(" ")
    });
    out.push({
      start_ms: Math.min(rightStart, chunk.end_ms - 1),
      end_ms: chunk.end_ms,
      text: words.slice(cutIdx + 1).join(" ")
    });
  }
  return didSplit ? forceSplitLongChunks(out, allWords, depth + 1) : out;
}
function resolveSplitTime(chunk, leftWords, rightWords, allWords) {
  if (allWords && allWords.length) {
    const startS = chunk.start_ms / 1e3;
    const endS = chunk.end_ms / 1e3;
    const inRange = allWords.filter((w) => w.start >= startS - 0.05 && w.end <= endS + 0.05);
    if (inRange.length >= leftWords.length) {
      const lastLeft = inRange[leftWords.length - 1];
      const firstRight = inRange[leftWords.length];
      if (lastLeft && firstRight) {
        return [
          Math.round(lastLeft.end * 1e3),
          Math.round(firstRight.start * 1e3)
        ];
      }
    }
  }
  const totalLen = leftWords.join("").length + rightWords.join("").length;
  const leftLen = leftWords.join("").length;
  const dur = chunk.end_ms - chunk.start_ms;
  const boundary = chunk.start_ms + Math.round(leftLen / (totalLen || 1) * dur);
  return [boundary, boundary];
}
function splitByBoundary(text) {
  const parts = [];
  const words = text.trim().split(/\s+/);
  let cur = [];
  for (const w of words) {
    cur.push(w);
    const clean = w.replace(/[)}\]"'"']+$/, "");
    const last = clean[clean.length - 1];
    if (".!?\u2026".includes(last) && !ABBREVIATIONS.has(clean.toLowerCase())) {
      parts.push(cur.join(" "));
      cur = [];
    }
  }
  if (cur.length > 0) parts.push(cur.join(" "));
  return parts.filter((p) => p.trim().length > 0);
}
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function extractYouTubeId(url) {
  if (!url) return "";
  const m1 = url.match(/[?&]v=([^&]+)/);
  if (m1) return m1[1].slice(0, 11);
  const m2 = url.match(/youtu\.be\/([^?&/]+)/);
  if (m2) return m2[1].slice(0, 11);
  const m3 = url.match(/\/shorts\/([^?&/]+)/);
  if (m3) return m3[1].slice(0, 11);
  const m4 = url.match(/\/embed\/([^?&/]+)/);
  if (m4) return m4[1].slice(0, 11);
  if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return "";
}
function DictationPage() {
  const t = useT();
  const params = useParams();
  const slug = params.slug ?? params.id ?? "";
  const { isLoggedIn, addPlayedSeconds } = useAuth();
  const audioRef = useRef3(null);
  const ytRef = useRef3(null);
  const textareaRef = useRef3(null);
  const autoNextTimer = useRef3(null);
  const stopAtMsRef = useRef3(null);
  const [tab, setTab] = useState8("dictation");
  const [index, setIndex] = useState8(0);
  const [answers, setAnswers] = useState8({});
  const [results, setResults] = useState8({});
  const [settings, setSettings] = useState8(loadSettings);
  const [showFull, setShowFull] = useState8(false);
  const [finished, setFinished] = useState8(false);
  const [started, setStarted] = useState8(false);
  const [testMode, setTestMode] = useState8(false);
  const [reportOpen, setReportOpen] = useState8(false);
  const [questionFbOpen, setQuestionFbOpen] = useState8(false);
  const [feedback, setFeedback] = useState8({ reported: false, questionReported: false });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dictation", slug],
    queryFn: () => fetchDictation(slug),
    enabled: Boolean(slug)
  });
  const chunks = useMemo4(() => {
    const sentences = mergeIntoSentences(data?.body ?? [], data?.words_json);
    const base = forceSplitLongChunks(sentences, data?.words_json);
    return snapChunksToWords(base, data?.words_json);
  }, [data]);
  useEffect9(() => {
    if (chunks.length > 0 && index >= chunks.length) {
      setIndex(chunks.length - 1);
    }
  }, [chunks.length, index]);
  const current = chunks[index];
  const fullAnswer = current?.text ?? "";
  const youtubeId = useMemo4(
    () => data && !data.audio_url && data.youtube_link ? extractYouTubeId(data.youtube_link) : "",
    [data]
  );
  const hasYouTube = Boolean(youtubeId);
  const hasAudio = Boolean(data?.audio_url);
  const seekTo = useCallback4((sec) => {
    const safe = Math.max(0, sec);
    if (audioRef.current) {
      audioRef.current.currentTime = safe;
      audioRef.current.play().catch(() => {
      });
    } else if (ytRef.current) {
      ytRef.current.playRange(safe * 1e3);
    }
  }, []);
  const positionMarks = useMemo4(() => {
    const mcqList = data?.mcq_questions ?? [];
    const tfngList = data?.tfng_questions ?? [];
    const fillList = data?.fill_gap_questions ?? [];
    return [
      ...mcqList.map((q, i) => ({ n: i + 1, label: "MCQ", proof: q.proof_from_text })),
      ...tfngList.map((q, i) => ({
        n: mcqList.length + i + 1,
        label: "TFNG",
        proof: q.proof_from_text
      })),
      ...fillList.map((q, i) => ({
        n: mcqList.length + tfngList.length + i + 1,
        label: "Fill",
        proof: q.proof_from_text
      }))
    ];
  }, [data?.mcq_questions, data?.tfng_questions, data?.fill_gap_questions]);
  useEffect9(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);
  useEffect9(() => {
    if (!testMode || !slug) return;
    let cancelled = false;
    fetchMyDictationFeedback(slug).then((res) => {
      if (!cancelled) {
        setFeedback({ reported: res.reported, questionReported: res.question_reported });
      }
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [testMode, slug]);
  const positionsHint = useOnboardingHint(HINT.testPositions, testMode, 2e3);
  const [proofSeen, setProofSeen] = useState8(false);
  const proofHint = useOnboardingHint(
    HINT.testProof,
    testMode && proofSeen && !positionsHint.open,
    900
  );
  const solved = Object.values(results).filter((r) => r.isCorrect).length;
  const percent = chunks.length ? Math.round(solved / chunks.length * 100) : 0;
  const isFinished = finished || chunks.length > 0 && solved === chunks.length;
  const isLastChunk = chunks.length > 0 && index === chunks.length - 1;
  useEffect9(() => {
    if (audioRef.current) audioRef.current.playbackRate = settings.playbackRate;
    ytRef.current?.setPlaybackRate(settings.playbackRate);
  }, [settings.playbackRate, current?.start_ms]);
  useEffect9(() => {
    if (current) stopAtMsRef.current = current.end_ms + CHUNK_TAIL_MS;
  }, [current?.start_ms, current?.end_ms]);
  const playChunk = useCallback4(() => {
    if (!current) return;
    const startMs = Math.max(0, current.start_ms - CHUNK_LEAD_MS);
    const endMs = current.end_ms + CHUNK_TAIL_MS;
    stopAtMsRef.current = endMs;
    if (audioRef.current) {
      const el = audioRef.current;
      el.playbackRate = settings.playbackRate;
      el.currentTime = startMs / 1e3;
      el.play().catch(() => {
      });
    } else if (ytRef.current) {
      ytRef.current.playRange(startMs, endMs);
    }
  }, [current, settings.playbackRate]);
  useEffect9(() => {
    if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current);
    setShowFull(false);
    textareaRef.current?.focus();
    if (started) playChunk();
  }, [index, current?.start_ms, playChunk, started]);
  useEffect9(() => {
    if (tab !== "dictation" || isFinished) {
      audioRef.current?.pause();
      ytRef.current?.pause();
    }
  }, [tab, isFinished]);
  useEffect9(() => {
    const el = audioRef.current;
    if (!el) return;
    const enforce = () => {
      const stopAt = stopAtMsRef.current;
      if (stopAt == null || el.paused) return;
      if (el.currentTime * 1e3 >= stopAt) el.pause();
    };
    el.addEventListener("timeupdate", enforce);
    const timer = window.setInterval(enforce, 50);
    return () => {
      el.removeEventListener("timeupdate", enforce);
      window.clearInterval(timer);
    };
  }, [current?.start_ms]);
  const awardedRef = useRef3({ dictation: false, test: false });
  const awardCompletion = useCallback4((kind) => {
    if (awardedRef.current[kind]) return;
    awardedRef.current[kind] = true;
    const seconds = Math.max(1, Math.round(data?.duration_sec || 0));
    if (seconds <= 0) return;
    void addPlayedSeconds(seconds);
    void addDictationPlayedTime(slug, seconds * 1e3).catch(() => {
    });
  }, [addPlayedSeconds, slug, data?.duration_sec]);
  const advance = useCallback4(() => {
    if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current);
    if (index < chunks.length - 1) setIndex((i) => i + 1);
    else setFinished(true);
  }, [chunks.length, index]);
  useEffect9(() => {
    if (isFinished) awardCompletion("dictation");
  }, [isFinished, awardCompletion]);
  const check = useCallback4(() => {
    if (!current) return;
    const existing = results[index];
    if (existing?.isCorrect) {
      advance();
      return;
    }
    const given = answers[index] ?? "";
    const result2 = gradeDictation(fullAnswer, given);
    setResults((r) => ({ ...r, [index]: result2 }));
    if (result2.isCorrect) {
      setAnswers((a) => ({ ...a, [index]: fullAnswer }));
      if (AUTO_NEXT_MS > 0) {
        autoNextTimer.current = window.setTimeout(advance, AUTO_NEXT_MS);
      } else {
        advance();
      }
    }
  }, [advance, answers, current, fullAnswer, index, results]);
  const goTo = useCallback4((next) => {
    if (next < 0 || next >= chunks.length) return;
    setIndex(next);
  }, [chunks.length]);
  const restart = useCallback4(() => {
    if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current);
    setIndex(0);
    setResults({});
    setAnswers({});
    setFinished(false);
    setShowFull(false);
    setStarted(true);
  }, []);
  const finishNow = useCallback4(() => {
    if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current);
    setFinished(true);
  }, []);
  const skipChunk = useCallback4(() => {
    if (!current) return;
    setAnswers((a) => ({ ...a, [index]: fullAnswer }));
    if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current);
    if (SKIP_NEXT_MS > 0) {
      autoNextTimer.current = window.setTimeout(advance, SKIP_NEXT_MS);
    } else {
      advance();
    }
  }, [advance, current, fullAnswer, index]);
  const onKeyDown = useCallback4((event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      check();
      return;
    }
    if (event.key === "Control") {
      event.preventDefault();
      playChunk();
    }
  }, [check, playChunk]);
  if (isLoading) return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(PageHeader, null), /* @__PURE__ */ React.createElement(Spinner, null));
  if (isError || !data) return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(PageHeader, null), /* @__PURE__ */ React.createElement(ErrorState, { onRetry: () => refetch() }));
  const result = current ? results[index] : void 0;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px clamp(16px,4vw,48px)",
    borderBottom: "1px solid var(--border)",
    flexWrap: "wrap",
    gap: 12
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", minWidth: 0 } }, /* @__PURE__ */ React.createElement(Link2, { to: `/topics/${data.type_slug || data.type}`, style: { fontSize: 13, fontWeight: 600 } }, "\u2039 ", data.type_label), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--border)" } }, "/"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 14, fontWeight: 700 } }, data.title), data.cefr_level && /* @__PURE__ */ React.createElement(Badge, null, data.cefr_level)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
    "span",
    {
      title: "Ishni oxirigacha tugatsangiz shu vaqt hisobga qo'shiladi",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 999,
        background: "var(--bg-secondary)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border)"
      }
    },
    /* @__PURE__ */ React.createElement(IconHeadphones, null),
    data.duration_label
  ), /* @__PURE__ */ React.createElement("button", { onClick: restart, title: "Boshidan boshlash", style: {
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: 12,
    background: "var(--bg-secondary)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    cursor: "pointer"
  } }, "\u21BB Boshidan"), !testMode && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 } }, solved, " / ", chunks.length), /* @__PURE__ */ React.createElement("div", { style: { width: 140, maxWidth: "30vw" } }, /* @__PURE__ */ React.createElement(ProgressBar, { percent }))))), /* @__PURE__ */ React.createElement("div", { className: "page", style: { maxWidth: testMode ? 1360 : 720 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, borderBottom: "1px solid var(--border)", marginBottom: 24 } }, ["dictation", "transcript"].map((key) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key,
      onClick: () => setTab(key),
      "aria-pressed": tab === key,
      style: {
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "10px 16px",
        fontSize: 14,
        fontWeight: 700,
        color: tab === key ? "#10B981" : "var(--text-secondary)",
        borderBottom: `2px solid ${tab === key ? "#10B981" : "transparent"}`,
        marginBottom: -1
      }
    },
    key === "dictation" ? t.dictationTabLabel : t.transcriptTabLabel
  ))), /* @__PURE__ */ React.createElement("div", { style: { display: tab === "transcript" ? "block" : "none" } }, /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 28, fontSize: 16, lineHeight: 1.9 } }, chunks.map((c, i) => /* @__PURE__ */ React.createElement("p", { key: i, style: { margin: "0 0 12px" } }, c.text)))), /* @__PURE__ */ React.createElement("div", { style: { display: tab === "dictation" && chunks.length === 0 ? "block" : "none" } }, /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 24, color: "var(--text-secondary)" } }, "Bu diktantda hali gap yo'q. Admin panelida Segment editor bilan qo'shing.")), /* @__PURE__ */ React.createElement("div", { style: { display: tab === "dictation" && isFinished ? "block" : "none" } }, /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 40, textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    margin: "0 auto 20px",
    background: "var(--ok-bg)",
    color: "var(--ok-text)",
    border: "2px solid #10B981",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }, "aria-hidden": true }, /* @__PURE__ */ React.createElement("svg", { width: "30", height: "30", viewBox: "0 0 24 24" }, /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M4 12.5l5.5 5.5L20 7",
      stroke: "currentColor",
      strokeWidth: "2.6",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  ))), /* @__PURE__ */ React.createElement("h2", { style: { fontSize: 26, fontWeight: 800, margin: "0 0 10px" } }, t.lessonDone), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 15, color: "var(--text-secondary)", margin: "0 0 24px" } }, "Barcha ", chunks.length, " ta gap to'g'ri yozildi."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: restart }, "Boshidan qayta ishlash"), /* @__PURE__ */ React.createElement(
    Link2,
    {
      to: `/topics/${data.type_slug || data.type}`,
      className: "btn btn-ghost",
      style: { textDecoration: "none" }
    },
    "Boshqa diktant"
  )))), /* @__PURE__ */ React.createElement("div", { style: {
    display: tab === "dictation" && !isFinished && current && !testMode ? "block" : "none"
  } }, current && /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: "clamp(16px,3vw,24px)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => goTo(index - 1),
      disabled: index === 0,
      "aria-label": "prev",
      style: navBtn
    },
    /* @__PURE__ */ React.createElement(ChevronIcon, { dir: "left", color: "var(--text-secondary)", size: 18 })
  ), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 14, fontWeight: 700, minWidth: 56, textAlign: "center" } }, index + 1, " / ", chunks.length), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => goTo(index + 1),
      disabled: index >= chunks.length - 1,
      "aria-label": "next",
      style: navBtn
    },
    /* @__PURE__ */ React.createElement(ChevronIcon, { dir: "right", color: "var(--text)", size: 18 })
  ), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: settings.playbackRate,
      onChange: (e) => setSettings((s) => ({ ...s, playbackRate: Number(e.target.value) })),
      "aria-label": "Ijro tezligi",
      style: {
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "4px 8px",
        background: "var(--bg-secondary)",
        color: "var(--text)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer"
      }
    },
    SPEEDS.map((s) => /* @__PURE__ */ React.createElement("option", { key: s, value: s }, s, "x"))
  )), hasAudio ? /* @__PURE__ */ React.createElement(
    "audio",
    {
      ref: audioRef,
      src: data.audio_url,
      controls: true,
      preload: "metadata",
      style: { width: "100%", marginBottom: 6 }
    }
  ) : hasYouTube ? /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10, position: "relative" } }, /* @__PURE__ */ React.createElement(YouTubePlayer_default, { ref: ytRef, youtubeId }), !started && !testMode && /* @__PURE__ */ React.createElement(
    VideoPosterOverlay,
    {
      youtubeId,
      onClick: restart,
      primaryLabel: "Boshlash"
    }
  ), started && /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 11,
    color: "var(--text-secondary)",
    marginTop: 6
  } }, "YouTube playeri \u2014 chunk vaqtida avtomatik to'xtaydi")) : /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 13,
    color: "var(--text-secondary)",
    marginBottom: 12,
    padding: "10px 14px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 10
  } }, "Audio yoki video biriktirilmagan."), !started && !testMode && /* @__PURE__ */ React.createElement(
    StartCard,
    {
      title: data.title,
      chunksCount: chunks.length,
      typeLabel: data.type_label,
      cefr: data.cefr_level,
      hasTests: Boolean(
        (data.mcq_questions?.length || 0) + (data.tfng_questions?.length || 0) + (data.fill_gap_questions?.length || 0)
      ),
      onStart: restart,
      onTest: () => setTestMode(true)
    }
  ), started && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12,
    color: "var(--text-secondary)",
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12
  } }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "Ctrl"), " \u2014 chunk'ni qayta qo'yish"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "Enter"), " \u2014 tekshirish")), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      ref: textareaRef,
      value: answers[index] ?? "",
      onChange: (e) => setAnswers((a) => ({ ...a, [index]: e.target.value })),
      onKeyDown,
      placeholder: t.dictationPlaceholder,
      "aria-label": t.dictationTabLabel,
      autoFocus: true,
      style: {
        width: "100%",
        minHeight: 96,
        border: `1.5px solid ${result?.isCorrect ? "#10B981" : result ? "#F59E0B" : "var(--border)"}`,
        borderRadius: 14,
        padding: 16,
        fontSize: 16,
        color: "var(--text)",
        background: "var(--bg-secondary)",
        outline: "none",
        resize: "vertical",
        lineHeight: 1.6
      }
    }
  ), result && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14 } }, result.isCorrect ? /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 700,
    color: "var(--ok-text)"
  } }, /* @__PURE__ */ React.createElement(IconCheck, null), " ", t.correctLabel) : /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 700,
    color: "#D97706",
    marginBottom: 8
  } }, result.matched, "/", result.total, " to'g'ri")), result && !result.isCorrect && (showFull || settings.showAnswerImmediately) && fullAnswer && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, fontSize: 16, lineHeight: 1.7 } }, /* @__PURE__ */ React.createElement(FeedbackLine, { full: fullAnswer, words: result.words })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-primary",
      onClick: check,
      style: { flex: "1 1 200px" }
    },
    t.checkBtn
  ), isLastChunk ? /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-ghost",
      onClick: finishNow,
      style: {
        background: "var(--ok-bg)",
        color: "var(--ok-text)",
        border: "1px solid var(--ok-text)",
        fontWeight: 700
      }
    },
    "Yakunlash"
  ) : /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-ghost",
      onClick: skipChunk,
      title: "Kanonik javobni ko'rsatib keyingi chunk'ga o'tadi"
    },
    t.skipBtn
  ), !settings.showAnswerImmediately && !showFull && result && !result.isCorrect && /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-ghost",
      onClick: () => setShowFull(true),
      "aria-label": "Javobni ko'rsatish"
    },
    "Javobni ko'rsatish"
  )), /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 20,
    paddingTop: 16,
    borderTop: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: 14
  } }, false, /* @__PURE__ */ React.createElement(
    Checkbox,
    {
      checked: settings.showAnswerImmediately,
      onChange: (v) => setSettings((s) => ({ ...s, showAnswerImmediately: v })),
      label: "Xato bo'lsa javobni darrov ko'rsat"
    }
  ), /* @__PURE__ */ React.createElement(
    Checkbox,
    {
      checked: settings.showFullAnswer,
      onChange: (v) => setSettings((s) => ({ ...s, showFullAnswer: v })),
      label: "Har doim to'liq javobni ko'rsat"
    }
  )), (result || showFull) && settings.showFullAnswer && fullAnswer && /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 1.6,
    padding: "10px 14px",
    background: "var(--bg-secondary)",
    borderRadius: 10,
    color: "var(--text-secondary)"
  } }, /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".03em",
    display: "block",
    marginBottom: 4
  } }, "To'liq javob"), fullAnswer)))), tab === "dictation" && testMode && // Grid `global.css` dagi `.test-layout` da — u yerda tor ekran
  // uchun media query ham bor (video tepada, savollar pastda).
  /* @__PURE__ */ React.createElement("div", { className: "test-layout" }, /* @__PURE__ */ React.createElement("div", { className: "test-layout-video" }, /* @__PURE__ */ React.createElement("div", { style: {
    position: "relative",
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    background: "#000",
    aspectRatio: hasYouTube ? "16/9" : void 0,
    border: "1px solid var(--border)"
  } }, hasAudio ? /* @__PURE__ */ React.createElement(
    "audio",
    {
      ref: audioRef,
      src: data.audio_url,
      controls: true,
      preload: "metadata",
      style: { width: "100%", display: "block" }
    }
  ) : hasYouTube ? /* @__PURE__ */ React.createElement(YouTubePlayer_default, { ref: ytRef, youtubeId, nativeControls: true }) : /* @__PURE__ */ React.createElement("div", { style: {
    aspectRatio: "16/9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#FFF",
    fontSize: 13
  } }, "Audio/video biriktirilmagan")), /* @__PURE__ */ React.createElement(
    QuestionPositionBar,
    {
      totalSec: data.duration_sec,
      localStorageKey: "listening.test.qpos",
      spotlight: positionsHint.open,
      getCurrentSec: () => audioRef.current ? audioRef.current.currentTime : (ytRef.current?.currentTimeMs?.() ?? 0) / 1e3,
      questions: positionMarks
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "test-layout-panel" }, /* @__PURE__ */ React.createElement(
    TestView,
    {
      mcq: data.mcq_questions ?? [],
      tfng: data.tfng_questions ?? [],
      fill: data.fill_gap_questions ?? [],
      onExit: () => setTestMode(false),
      onSeek: seekTo,
      onProofVisible: () => setProofSeen(true),
      onCompleted: () => awardCompletion("test"),
      onReport: () => setReportOpen(true),
      onQuestionFeedback: () => setQuestionFbOpen(true),
      reported: feedback.reported,
      questionReported: feedback.questionReported
    }
  ), /* @__PURE__ */ React.createElement("div", { "aria-hidden": true, style: {
    position: "sticky",
    bottom: 0,
    height: 40,
    marginTop: -40,
    pointerEvents: "none",
    background: "linear-gradient(180deg, transparent, var(--bg) 80%)"
  } }))), positionsHint.open && /* @__PURE__ */ React.createElement(
    OnboardingHint,
    {
      title: "Qayerga kelganingiz shu yerda",
      text: "Belgini yoqsangiz, video davomida qaysi savolga yaqinlashayotganingiz ko'rinib turadi.",
      art: /* @__PURE__ */ React.createElement(HintArtPositions, null),
      placement: "bottom-center",
      onClose: positionsHint.dismiss
    }
  ), proofHint.open && /* @__PURE__ */ React.createElement(
    OnboardingHint,
    {
      title: "Javob qayerda aytilgan?",
      text: "\xABIsbot\xBB bosing \u2014 video javob eshitiladigan joyga, 2 soniya oldinroqdan qo'yiladi.",
      art: /* @__PURE__ */ React.createElement(HintArtProof, null),
      onClose: proofHint.dismiss
    }
  ), reportOpen && /* @__PURE__ */ React.createElement(
    ReportModal,
    {
      loadReasons: fetchDictationReportReasons,
      submit: (payload) => reportDictation(slug, payload),
      onClose: () => setReportOpen(false),
      onSubmitted: () => {
        setReportOpen(false);
        setFeedback((f) => ({ ...f, reported: true }));
      }
    }
  ), questionFbOpen && /* @__PURE__ */ React.createElement(
    QuestionFeedbackModal,
    {
      submit: (text) => reportDictationQuestion(slug, text),
      onClose: () => setQuestionFbOpen(false),
      onSubmitted: () => {
        setQuestionFbOpen(false);
        setFeedback((f) => ({ ...f, questionReported: true }));
      }
    }
  ), isLoggedIn && /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 20,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "10px 16px",
    fontSize: 12.5,
    color: "var(--text-secondary)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    fontWeight: 600
  } }, /* @__PURE__ */ React.createElement(IconHeadphones, null), /* @__PURE__ */ React.createElement("span", null, "Bugun tinglagan vaqtingiz: ", /* @__PURE__ */ React.createElement("b", { style: { color: "var(--text)" } }, formatMinutes(useAuth.getState().user?.today_seconds ?? 0))), /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.75 } }, "\xB7 faqat audio/video haqiqatan ijro etilgan sekundlar hisoblanadi"))));
}
var navBtn = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "50%",
  width: 36,
  height: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer"
};
function VideoPosterOverlay({ youtubeId, onClick, primaryLabel }) {
  const [broken, setBroken] = useState8(false);
  const [triedHq, setTriedHq] = useState8(false);
  const src = broken ? "" : triedHq ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : `https://i.ytimg.com/vi_webp/${youtubeId}/maxresdefault.webp`;
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick,
      "aria-label": primaryLabel,
      style: {
        position: "absolute",
        inset: 0,
        padding: 0,
        margin: 0,
        border: "none",
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        background: "#0F172A",
        display: "block"
      }
    },
    !broken && /* @__PURE__ */ React.createElement(
      "img",
      {
        src,
        alt: "",
        decoding: "async",
        onError: () => triedHq ? setBroken(true) : setTriedHq(true),
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block"
        }
      }
    ),
    /* @__PURE__ */ React.createElement("span", { "aria-hidden": true, style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.35) 100%)"
    } }),
    /* @__PURE__ */ React.createElement("span", { "aria-hidden": true, style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 76,
      height: 54,
      borderRadius: 14,
      background: "rgba(239, 68, 68, .95)",
      color: "#FFF",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 26,
      fontWeight: 900,
      letterSpacing: "-.02em",
      boxShadow: "0 10px 24px rgba(0,0,0,.35)"
    } }, "\u25B6"),
    /* @__PURE__ */ React.createElement("span", { "aria-hidden": true, style: {
      position: "absolute",
      left: 14,
      bottom: 12,
      color: "#FFF",
      fontSize: 13,
      fontWeight: 800,
      letterSpacing: ".01em",
      textShadow: "0 1px 4px rgba(0,0,0,.5)"
    } }, primaryLabel)
  );
}
function StartCard({ title, chunksCount, typeLabel, cefr, onStart, hasTests, onTest }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    padding: "20px 8px 4px",
    textAlign: "center"
  } }, /* @__PURE__ */ React.createElement("h2", { style: { fontSize: 20, fontWeight: 800, margin: 0 } }, title), /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 13,
    color: "var(--text-secondary)",
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center"
  } }, /* @__PURE__ */ React.createElement("span", null, typeLabel), cefr && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", null, "\xB7"), /* @__PURE__ */ React.createElement("span", null, cefr))), hasTests && onTest ? /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    width: "100%",
    maxWidth: 380
  } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: onTest,
      className: "btn btn-primary",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
        fontSize: 17,
        padding: "16px 28px",
        borderRadius: 14,
        fontWeight: 800,
        cursor: "pointer"
      }
    },
    /* @__PURE__ */ React.createElement(IconPlay, null),
    "Listening test"
  ), /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12.5,
    color: "var(--text-secondary)",
    lineHeight: 1.5
  } }, "Videoni ko'rib savollarga javob bering \u2014 IELTS uslubida."), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: onStart,
      style: {
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "8px 14px",
        borderRadius: 10,
        fontSize: 13.5,
        fontWeight: 700,
        color: "var(--text-secondary)",
        textDecoration: "underline",
        textUnderlineOffset: 4,
        fontFamily: "inherit"
      }
    },
    "yoki diktant yozish (",
    chunksCount,
    " ta gap)"
  )) : /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    marginTop: 4
  } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: onStart,
      className: "btn btn-primary",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 16,
        padding: "15px 28px",
        borderRadius: 13,
        fontWeight: 800,
        cursor: "pointer"
      }
    },
    /* @__PURE__ */ React.createElement(IconPlay, null),
    "Diktantni boshlash"
  ), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--text-secondary)" } }, "Tayyor bo'lganda bosing \u2014 audio darrov boshlanadi.")));
}
function Checkbox({ checked, onChange, label }) {
  return /* @__PURE__ */ React.createElement("label", { style: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    fontSize: 13.5,
    color: "var(--text)"
  } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      checked,
      onChange: (e) => onChange(e.target.checked),
      style: { width: 16, height: 16, cursor: "pointer", accentColor: "#2563EB" }
    }
  ), /* @__PURE__ */ React.createElement("span", null, label));
}
function FeedbackLine({ full, words }) {
  if (!words || words.length === 0) {
    return /* @__PURE__ */ React.createElement("span", { style: { color: "var(--text)", wordBreak: "break-word" } }, full);
  }
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 6px",
    lineHeight: 1.9,
    maxWidth: "100%",
    overflowWrap: "anywhere"
  } }, words.map((word, index) => {
    const style = word.found ? { color: "#059669", fontWeight: 700 } : {
      color: "var(--text-secondary)",
      fontWeight: 500,
      textDecoration: "underline",
      textDecorationColor: "#F59E0B",
      textDecorationThickness: 2,
      textUnderlineOffset: 3,
      background: "rgba(245, 158, 11, .08)",
      borderRadius: 4,
      padding: "0 3px"
    };
    return /* @__PURE__ */ React.createElement(
      "span",
      {
        key: index,
        style: { ...style, wordBreak: "break-word" },
        title: word.found ? "to'g'ri" : "xato yoki tushib qolgan"
      },
      word.w
    );
  }));
}
var TEST_SETTINGS_KEY = "listening.test.settings";
var PROOF_REWIND_SEC = 2;
var FONT_STEPS = [0.9, 1, 1.15, 1.3, 1.5];
var DEFAULT_FONT_STEP = 2;
var DEFAULT_TEST_SETTINGS = {
  checkMode: "instant",
  fontStep: DEFAULT_FONT_STEP
};
function loadTestSettings() {
  try {
    const raw = localStorage.getItem(TEST_SETTINGS_KEY);
    if (!raw) return DEFAULT_TEST_SETTINGS;
    const parsed = { ...DEFAULT_TEST_SETTINGS, ...JSON.parse(raw) };
    parsed.fontStep = Math.max(0, Math.min(FONT_STEPS.length - 1, Number(parsed.fontStep) || 0));
    if (parsed.checkMode !== "exam") parsed.checkMode = "instant";
    return parsed;
  } catch {
    return DEFAULT_TEST_SETTINGS;
  }
}
function normAnswer(v) {
  return (v || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/[^a-z0-9' ]/g, "");
}
function fillAnswers(q) {
  return [...q.answers ?? [], ...q.answer ? [q.answer] : []].map(normAnswer).filter(Boolean);
}
function proofSeconds(proof) {
  const m = (proof || "").match(/\[\s*([0-9]+(?:\.[0-9]+)?)\s*\]/);
  return m ? parseFloat(m[1]) : null;
}
function proofQuote(proof) {
  return (proof || "").replace(/\[\s*[0-9]+(?:\.[0-9]+)?\s*\]/g, " ").replace(/\s+/g, " ").trim();
}
function buildQuestions(mcq, tfng, fill) {
  const out = [];
  mcq.forEach((q, i) => out.push({ kind: "mcq", key: `mcq-${i}`, n: out.length + 1, q }));
  tfng.forEach((q, i) => out.push({ kind: "tfng", key: `tfng-${i}`, n: out.length + 1, q }));
  fill.forEach((q, i) => out.push({ kind: "fill", key: `fill-${i}`, n: out.length + 1, q }));
  return out;
}
function isAnswerCorrect(item, given) {
  if (!given) return false;
  if (item.kind === "mcq") return given === item.q.answer;
  if (item.kind === "tfng") {
    return given.toLowerCase() === (item.q.answer || "").toLowerCase();
  }
  return fillAnswers(item.q).includes(normAnswer(given));
}
function proofOf(item) {
  return item.q.proof_from_text || "";
}
function TestView({
  mcq,
  tfng,
  fill,
  onExit,
  onSeek,
  onProofVisible,
  onCompleted,
  onReport,
  onQuestionFeedback,
  reported,
  questionReported
}) {
  const [settings, setSettings] = useState8(loadTestSettings);
  const [answers, setAnswers] = useState8({});
  const [committed, setCommitted] = useState8({});
  const [submitted, setSubmitted] = useState8(false);
  const panelRef = useRef3(null);
  useEffect9(() => {
    try {
      localStorage.setItem(TEST_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
    }
  }, [settings]);
  const items = useMemo4(() => buildQuestions(mcq, tfng, fill), [mcq, tfng, fill]);
  const total = items.length;
  const answered = items.filter((i) => answers[i.key]).length;
  const allAnswered = total > 0 && answered === total;
  const revealAll = submitted || settings.checkMode === "instant" && allAnswered;
  const showResult = submitted || settings.checkMode === "instant" && allAnswered;
  const score = useMemo4(
    () => items.filter((i) => isAnswerCorrect(i, answers[i.key] || "")).length,
    [items, answers]
  );
  const completedRef = useRef3(false);
  useEffect9(() => {
    if (!showResult || completedRef.current) return;
    completedRef.current = true;
    onCompleted?.();
  }, [showResult, onCompleted]);
  const scale = FONT_STEPS[settings.fontStep] ?? 1;
  const fs = useCallback4((base) => Math.round(base * scale * 10) / 10, [scale]);
  const setAnswer = useCallback4((key, value, commit = true) => {
    setAnswers((a) => a[key] === value ? a : { ...a, [key]: value });
    if (commit) setCommitted((c) => c[key] ? c : { ...c, [key]: true });
  }, []);
  const reset = useCallback4(() => {
    setAnswers({});
    setCommitted({});
    setSubmitted(false);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const submit = useCallback4(() => {
    setSubmitted(true);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const seekProof = useCallback4((proof) => {
    const sec = proofSeconds(proof);
    if (sec == null) return;
    onSeek(Math.max(0, sec - PROOF_REWIND_SEC));
  }, [onSeek]);
  const proofNotifiedRef = useRef3(false);
  useEffect9(() => {
    if (proofNotifiedRef.current || !onProofVisible) return;
    const anyProof = items.some(
      (i) => (revealAll || answers[i.key]) && proofSeconds(proofOf(i)) != null
    );
    if (!anyProof) return;
    proofNotifiedRef.current = true;
    onProofVisible();
  }, [items, answers, revealAll, onProofVisible]);
  const jumpTo = (n) => {
    document.getElementById(`test-q-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const sections = [
    {
      kind: "mcq",
      title: "Multiple choice",
      rule: "Choose the correct letter \u2014 A, B, C or D.",
      note: "Har savolga bitta to'g'ri javob."
    },
    {
      kind: "tfng",
      title: "True / False / Not given",
      rule: "Do the following statements agree with the information in the recording?",
      note: "True \u2014 matn tasdiqlaydi \xB7 False \u2014 matn inkor qiladi \xB7 Not given \u2014 matnda yo\u2019q."
    },
    {
      kind: "fill",
      title: "Sentence completion",
      rule: "Complete the sentences below.",
      note: "Har savolning tepasida so'z chegarasi alohida yozilgan."
    }
  ];
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: panelRef,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: fs(14),
        width: "100%",
        fontSize: fs(14),
        lineHeight: 1.55,
        color: "var(--text)"
      }
    },
    /* @__PURE__ */ React.createElement(
      TestToolbar,
      {
        answered,
        total,
        fs,
        settings,
        onSettings: setSettings,
        onExit,
        onReport,
        onQuestionFeedback,
        reported,
        questionReported,
        locked: submitted
      }
    ),
    showResult && /* @__PURE__ */ React.createElement(
      ResultCard,
      {
        score,
        total,
        fs,
        wrong: items.filter((i) => !isAnswerCorrect(i, answers[i.key] || "")),
        onJump: jumpTo,
        onReset: reset
      }
    ),
    sections.map((section) => {
      const list = items.filter((i) => i.kind === section.kind);
      if (list.length === 0) return null;
      const from = list[0].n;
      const to = list[list.length - 1].n;
      return /* @__PURE__ */ React.createElement("section", { key: section.kind, style: { display: "flex", flexDirection: "column", gap: fs(10) } }, /* @__PURE__ */ React.createElement(
        SectionHeader,
        {
          from,
          to,
          title: section.title,
          rule: section.rule,
          note: section.note,
          fs
        }
      ), list.map((item) => /* @__PURE__ */ React.createElement(
        QuestionCard,
        {
          key: item.key,
          item,
          fs,
          given: answers[item.key] || "",
          reveal: revealAll || settings.checkMode === "instant" && Boolean(committed[item.key]),
          locked: submitted,
          onAnswer: (v, commit) => setAnswer(item.key, v, commit),
          onProof: () => seekProof(proofOf(item))
        }
      )));
    }),
    total > 0 && !showResult && /* @__PURE__ */ React.createElement("div", { style: {
      position: "sticky",
      bottom: 0,
      paddingTop: fs(10),
      paddingBottom: fs(4),
      background: "linear-gradient(180deg, transparent, var(--bg) 45%)",
      display: "flex",
      flexDirection: "column",
      gap: 6
    } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: submit,
        className: "btn btn-primary",
        disabled: answered === 0,
        style: {
          width: "100%",
          padding: `${fs(12)}px ${fs(18)}px`,
          borderRadius: 12,
          fontSize: fs(14.5),
          fontWeight: 800,
          cursor: answered ? "pointer" : "not-allowed"
        }
      },
      "Natijani tekshirish"
    ), /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: fs(11.5),
      fontWeight: 600,
      color: "var(--text-secondary)",
      textAlign: "center"
    } }, allAnswered ? "Hamma savol belgilandi" : `${total - answered} ta savol javobsiz`))
  );
}
function TestToolbar({
  answered,
  total,
  fs,
  settings,
  onSettings,
  onExit,
  onReport,
  onQuestionFeedback,
  reported,
  questionReported,
  locked
}) {
  const pct = total ? Math.round(answered / total * 100) : 0;
  return /* @__PURE__ */ React.createElement("div", { style: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "var(--bg)",
    border: "1px solid var(--border)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("h3", { style: { margin: 0, fontSize: fs(15), fontWeight: 800 } }, "Listening test"), /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: fs(12),
    fontWeight: 700,
    color: "var(--text-secondary)"
  } }, answered, " / ", total), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 40 } }, /* @__PURE__ */ React.createElement("div", { style: { height: 4, borderRadius: 2, background: "var(--border)" } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: `${pct}%`,
    height: "100%",
    borderRadius: 2,
    background: "var(--text-secondary)",
    transition: "width .25s"
  } }))), /* @__PURE__ */ React.createElement(IconButton, { title: "Diktantga qaytish", onClick: onExit, label: "Diktant" }, /* @__PURE__ */ React.createElement(IconBack, null))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
    SegmentedControl,
    {
      value: settings.checkMode,
      disabled: locked,
      onChange: (v) => onSettings((s) => ({ ...s, checkMode: v })),
      options: [
        { value: "instant", label: "Darrov tekshirish" },
        { value: "exam", label: "Imtihon" }
      ],
      fs
    }
  ), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 2 } }, /* @__PURE__ */ React.createElement(
    FontButton,
    {
      label: "A\u2212",
      title: "Matnni kichiklashtirish",
      disabled: settings.fontStep <= 0,
      onClick: () => onSettings((s) => ({ ...s, fontStep: Math.max(0, s.fontStep - 1) }))
    }
  ), /* @__PURE__ */ React.createElement(
    FontButton,
    {
      label: "A+",
      title: "Matnni kattalashtirish",
      disabled: settings.fontStep >= FONT_STEPS.length - 1,
      onClick: () => onSettings((s) => ({
        ...s,
        fontStep: Math.min(FONT_STEPS.length - 1, s.fontStep + 1)
      }))
    }
  )), /* @__PURE__ */ React.createElement(
    IconButton,
    {
      title: reported ? "Shikoyat allaqachon yuborilgan" : "Shikoyat yuborish",
      onClick: onReport,
      active: reported
    },
    /* @__PURE__ */ React.createElement(IconFlag, null)
  ), /* @__PURE__ */ React.createElement(
    IconButton,
    {
      title: questionReported ? "Xabar allaqachon yuborilgan" : "Savol xato tuzilgan",
      onClick: onQuestionFeedback,
      active: questionReported
    },
    /* @__PURE__ */ React.createElement(IconAlert, null)
  )));
}
function SegmentedControl({ value, options, onChange, disabled, fs }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "inline-flex",
    padding: 2,
    borderRadius: 999,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    opacity: disabled ? 0.55 : 1
  } }, options.map((o) => {
    const active = o.value === value;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: o.value,
        onClick: () => !disabled && onChange(o.value),
        disabled,
        "aria-pressed": active,
        style: {
          border: "none",
          borderRadius: 999,
          cursor: disabled ? "default" : "pointer",
          padding: `${fs(5)}px ${fs(12)}px`,
          fontSize: fs(12),
          fontWeight: 700,
          background: active ? "var(--text)" : "transparent",
          color: active ? "var(--bg)" : "var(--text-secondary)",
          transition: "background .15s, color .15s"
        }
      },
      o.label
    );
  }));
}
function FontButton({ label, title, onClick, disabled }) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick,
      title,
      "aria-label": title,
      disabled,
      style: {
        width: 30,
        height: 30,
        borderRadius: 8,
        cursor: disabled ? "default" : "pointer",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        fontSize: 12.5,
        fontWeight: 800,
        opacity: disabled ? 0.4 : 1
      }
    },
    label
  );
}
function IconButton({ title, onClick, children, active, label }) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick,
      title,
      "aria-label": title,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 30,
        padding: label ? "0 10px" : "0 8px",
        borderRadius: 8,
        cursor: "pointer",
        background: "var(--bg-secondary)",
        border: `1px solid ${active ? "var(--ok-text)" : "var(--border)"}`,
        color: active ? "var(--ok-text)" : "var(--text-secondary)",
        fontSize: 12,
        fontWeight: 700
      }
    },
    children,
    label && /* @__PURE__ */ React.createElement("span", null, label)
  );
}
function SectionHeader({ from, to, title, rule, note, fs }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: `${fs(10)}px ${fs(12)}px`,
    borderRadius: 10,
    background: "var(--bg-secondary)",
    borderLeft: "3px solid var(--text-secondary)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: fs(11),
    fontWeight: 800,
    letterSpacing: ".06em",
    textTransform: "uppercase",
    color: "var(--text-secondary)"
  } }, from === to ? `Question ${from}` : `Questions ${from}\u2013${to}`, " \xB7 ", title), /* @__PURE__ */ React.createElement("div", { style: { fontSize: fs(13.5), fontWeight: 700, color: "var(--text)" } }, rule), /* @__PURE__ */ React.createElement("div", { style: { fontSize: fs(11.5), fontWeight: 500, color: "var(--text-secondary)" } }, note));
}
function QuestionCard({ item, given, reveal, locked, onAnswer, onProof, fs }) {
  const correct = isAnswerCorrect(item, given);
  const proof = proofOf(item);
  const hasProof = proofSeconds(proof) != null;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      id: `test-q-${item.n}`,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: fs(9),
        padding: `${fs(13)}px ${fs(14)}px`,
        borderRadius: 12,
        background: "var(--bg-secondary)",
        border: `1px solid ${reveal ? correct ? "#10B981" : "#EF4444" : "var(--border)"}`,
        transition: "border-color .2s"
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: fs(9) } }, /* @__PURE__ */ React.createElement("span", { style: {
      flexShrink: 0,
      minWidth: fs(24),
      height: fs(24),
      borderRadius: 7,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: fs(12),
      fontWeight: 800,
      background: reveal ? correct ? "var(--ok-bg)" : "rgba(239,68,68,.12)" : "var(--bg)",
      color: reveal ? correct ? "var(--ok-text)" : "#B91C1C" : "var(--text-secondary)",
      border: `1px solid ${reveal ? correct ? "#10B981" : "#EF4444" : "var(--border)"}`
    } }, item.n), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, item.kind === "fill" ? /* @__PURE__ */ React.createElement(FillHint, { hint: item.q.hint, fs }) : /* @__PURE__ */ React.createElement("div", { style: { fontSize: fs(14.5), fontWeight: 700, lineHeight: 1.5 } }, item.q.question))),
    item.kind === "mcq" && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: fs(6) } }, Object.entries(item.q.options || {}).map(([k, v]) => /* @__PURE__ */ React.createElement(
      OptionButton,
      {
        key: k,
        fs,
        label: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("b", { style: { marginRight: fs(8) } }, k), v),
        picked: given === k,
        isAnswer: k === item.q.answer,
        reveal,
        disabled: locked,
        onClick: () => onAnswer(k)
      }
    ))),
    item.kind === "tfng" && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: fs(6), flexWrap: "wrap" } }, ["True", "False", "Not given"].map((v) => /* @__PURE__ */ React.createElement(
      OptionButton,
      {
        key: v,
        fs,
        pill: true,
        label: v,
        picked: given === v,
        isAnswer: v.toLowerCase() === (item.q.answer || "").toLowerCase(),
        reveal,
        disabled: locked,
        onClick: () => onAnswer(v)
      }
    ))),
    item.kind === "fill" && /* @__PURE__ */ React.createElement(
      FillSentence,
      {
        q: item.q,
        given,
        reveal,
        locked,
        onAnswer,
        fs
      }
    ),
    reveal && /* @__PURE__ */ React.createElement(
      ProofRow,
      {
        correct,
        expected: item.kind === "fill" ? item.q.answers?.length ? item.q.answers.join(" / ") : item.q.answer || "" : item.kind === "mcq" ? `${item.q.answer}${item.q.options?.[item.q.answer] ? ` \u2014 ${item.q.options[item.q.answer]}` : ""}` : item.q.answer,
        quote: proofQuote(proof),
        hasProof,
        onProof,
        fs
      }
    )
  );
}
function FillHint({ hint, fs }) {
  const text = (hint || "").trim() || "Complete the sentence below.";
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "inline-flex",
    alignItems: "center",
    gap: fs(7),
    padding: `${fs(5)}px ${fs(10)}px`,
    borderRadius: 8,
    background: "var(--bg)",
    border: "1px dashed var(--border)",
    fontSize: fs(12),
    fontWeight: 700,
    color: "var(--text)",
    letterSpacing: ".01em"
  } }, /* @__PURE__ */ React.createElement(IconPencil, null), /* @__PURE__ */ React.createElement("span", null, text));
}
function FillSentence({ q, given, reveal, locked, onAnswer, fs }) {
  const parts = (q.sentence || "").split("___");
  const correct = fillAnswers(q).includes(normAnswer(given));
  return /* @__PURE__ */ React.createElement("div", { style: { fontSize: fs(14.5), fontWeight: 600, lineHeight: 1.9 } }, parts.map((p, i) => /* @__PURE__ */ React.createElement("span", { key: i }, p, i < parts.length - 1 && (reveal ? /* @__PURE__ */ React.createElement("b", { style: {
    padding: `0 ${fs(5)}px`,
    color: correct ? "var(--ok-text)" : "#B91C1C",
    borderBottom: `2px solid ${correct ? "#10B981" : "#EF4444"}`
  } }, given || "\u2014") : /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      value: given,
      disabled: locked,
      onChange: (e) => onAnswer(e.target.value, false),
      onBlur: () => given.trim() && onAnswer(given.trim()),
      onKeyDown: (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (given.trim()) onAnswer(given.trim());
        }
      },
      placeholder: "\u2026",
      "aria-label": "Javob",
      style: {
        width: fs(130),
        margin: `0 ${fs(4)}px`,
        padding: `${fs(2)}px ${fs(8)}px`,
        border: "none",
        borderBottom: `2px solid ${given.trim() ? "var(--text)" : "var(--border)"}`,
        background: "transparent",
        color: "var(--text)",
        fontSize: fs(14.5),
        fontWeight: 800,
        outline: "none",
        fontFamily: "inherit"
      }
    }
  )))));
}
function OptionButton({ label, picked, isAnswer, reveal, disabled, onClick, pill, fs }) {
  const showCorrect = reveal && isAnswer;
  const showWrong = reveal && picked && !isAnswer;
  const border = showCorrect ? "#10B981" : showWrong ? "#EF4444" : picked ? "var(--text)" : "var(--border)";
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick,
      disabled: disabled || reveal,
      style: {
        textAlign: "left",
        cursor: disabled || reveal ? "default" : "pointer",
        padding: `${fs(9)}px ${fs(12)}px`,
        borderRadius: pill ? 999 : 9,
        fontSize: fs(13.5),
        fontWeight: 600,
        lineHeight: 1.45,
        fontFamily: "inherit",
        background: showCorrect ? "var(--ok-bg)" : showWrong ? "rgba(239,68,68,.1)" : picked ? "var(--bg)" : "var(--bg)",
        color: showCorrect ? "var(--ok-text)" : showWrong ? "#B91C1C" : "var(--text)",
        border: `1.5px solid ${border}`,
        transition: "border-color .15s, background .15s"
      }
    },
    label
  );
}
function ProofRow({ correct, expected, quote, hasProof, onProof, fs }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "flex-start",
    gap: fs(9),
    flexWrap: "wrap",
    padding: `${fs(8)}px ${fs(11)}px`,
    borderRadius: 9,
    background: correct ? "var(--ok-bg)" : "rgba(239,68,68,.08)",
    color: correct ? "var(--ok-text)" : "#B91C1C",
    border: `1px solid ${correct ? "rgba(16,185,129,.45)" : "rgba(239,68,68,.4)"}`
  } }, /* @__PURE__ */ React.createElement("span", { style: {
    display: "inline-flex",
    alignItems: "center",
    gap: fs(5),
    fontSize: fs(12),
    fontWeight: 800,
    flexShrink: 0
  } }, correct ? /* @__PURE__ */ React.createElement(IconCheck, null) : /* @__PURE__ */ React.createElement(IconCross, null), correct ? "To'g'ri" : "Xato"), !correct && expected && /* @__PURE__ */ React.createElement("span", { style: { fontSize: fs(12.5), fontWeight: 700 } }, "Javob: ", /* @__PURE__ */ React.createElement("b", null, expected)), quote && /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: fs(12.5),
    fontStyle: "italic",
    flex: "1 1 140px",
    color: "var(--text-secondary)",
    lineHeight: 1.5
  } }, "\u201C", quote, "\u201D"), hasProof && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: onProof,
      title: `Videoni shu joydan (${PROOF_REWIND_SEC}s oldinroqdan) qo'yadi`,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: fs(5),
        marginLeft: "auto",
        flexShrink: 0,
        background: "var(--bg)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        borderRadius: 999,
        padding: `${fs(4)}px ${fs(11)}px`,
        fontSize: fs(11.5),
        fontWeight: 800,
        cursor: "pointer",
        fontFamily: "inherit"
      }
    },
    /* @__PURE__ */ React.createElement(IconPlay, null),
    "Isbot"
  ));
}
function ResultCard({ score, total, wrong, onJump, onReset, fs }) {
  const pct = total ? Math.round(score / total * 100) : 0;
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    flexDirection: "column",
    gap: fs(10),
    padding: `${fs(16)}px ${fs(16)}px`,
    borderRadius: 12,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: fs(14) } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: fs(28),
    fontWeight: 800,
    lineHeight: 1,
    color: "var(--text)",
    whiteSpace: "nowrap"
  } }, score, /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: fs(16),
    color: "var(--text-secondary)",
    fontWeight: 700
  } }, " / ", total)), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 60 } }, /* @__PURE__ */ React.createElement("div", { style: { height: 6, borderRadius: 3, background: "var(--border)" } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: `${pct}%`,
    height: "100%",
    borderRadius: 3,
    background: pct >= 70 ? "#10B981" : pct >= 40 ? "var(--text-secondary)" : "#EF4444",
    transition: "width .4s"
  } })), /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 5,
    fontSize: fs(12),
    fontWeight: 700,
    color: "var(--text-secondary)"
  } }, "Test yakunlandi \xB7 ", pct, "%")), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: onReset,
      className: "btn btn-ghost",
      style: {
        borderRadius: 10,
        fontWeight: 800,
        fontSize: fs(12.5),
        padding: `${fs(8)}px ${fs(14)}px`
      }
    },
    "Qayta ishlash"
  )), wrong.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: fs(8), flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: fs(12), fontWeight: 700, color: "var(--text-secondary)" } }, "Xato savollar:"), wrong.map((w) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: w.key,
      onClick: () => onJump(w.n),
      title: `${w.n}-savolga o'tish`,
      style: {
        minWidth: fs(26),
        height: fs(26),
        borderRadius: 7,
        background: "rgba(239,68,68,.1)",
        color: "#B91C1C",
        border: "1px solid rgba(239,68,68,.4)",
        fontSize: fs(12),
        fontWeight: 800,
        cursor: "pointer",
        fontFamily: "inherit"
      }
    },
    w.n
  ))));
}
function IconPlay() {
  return /* @__PURE__ */ React.createElement("svg", { width: "9", height: "9", viewBox: "0 0 24 24", "aria-hidden": true, style: { display: "block" } }, /* @__PURE__ */ React.createElement("path", { d: "M6 4l14 8-14 8z", fill: "currentColor" }));
}
function IconCheck() {
  return /* @__PURE__ */ React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 24 24", "aria-hidden": true, style: { display: "block" } }, /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M4 12.5l5.5 5.5L20 7",
      stroke: "currentColor",
      strokeWidth: "2.6",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  ));
}
function IconCross() {
  return /* @__PURE__ */ React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 24 24", "aria-hidden": true, style: { display: "block" } }, /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M6 6l12 12M18 6L6 18",
      stroke: "currentColor",
      strokeWidth: "2.6",
      fill: "none",
      strokeLinecap: "round"
    }
  ));
}
function IconBack() {
  return /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", "aria-hidden": true, style: { display: "block" } }, /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M15 5l-7 7 7 7",
      stroke: "currentColor",
      strokeWidth: "2.4",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  ));
}
function IconFlag() {
  return /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", "aria-hidden": true, style: { display: "block" } }, /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M5 21V4M5 4h11l-2 3.5L16 11H5",
      stroke: "currentColor",
      strokeWidth: "2",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  ));
}
function IconAlert() {
  return /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", "aria-hidden": true, style: { display: "block" } }, /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M12 4l9 16H3z",
      stroke: "currentColor",
      strokeWidth: "2",
      fill: "none",
      strokeLinejoin: "round"
    }
  ), /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M12 10v4M12 17h.01",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round"
    }
  ));
}
function IconPencil() {
  return /* @__PURE__ */ React.createElement("svg", { width: "11", height: "11", viewBox: "0 0 24 24", "aria-hidden": true, style: { display: "block" } }, /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M4 20h4L20 8l-4-4L4 16z",
      stroke: "currentColor",
      strokeWidth: "2",
      fill: "none",
      strokeLinejoin: "round"
    }
  ));
}
function IconHeadphones() {
  return /* @__PURE__ */ React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 24 24", "aria-hidden": true, style: { display: "block" } }, /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M4 14v-2a8 8 0 0116 0v2",
      stroke: "currentColor",
      strokeWidth: "2",
      fill: "none",
      strokeLinecap: "round"
    }
  ), /* @__PURE__ */ React.createElement("rect", { x: "2.5", y: "13.5", width: "4.5", height: "7", rx: "2", fill: "currentColor" }), /* @__PURE__ */ React.createElement("rect", { x: "17", y: "13.5", width: "4.5", height: "7", rx: "2", fill: "currentColor" }));
}
export {
  DictationPage as default,
  forceSplitLongChunks,
  splitLongChunks
};

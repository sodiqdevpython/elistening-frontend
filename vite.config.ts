import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Dev'da /api va /media so'rovlari Django'ga uzatiladi — CORS muammosi bo'lmaydi.
// `host: true` — Vite 0.0.0.0 da tinglaydi, LAN'dagi boshqa qurilmalar (masalan
// telefon) ham `http://<sizning-IP>:5173` orqali ochishi mumkin. Proxy'ning o'zi
// Django'ga localhost bo'yicha uzatadi (Vite dev server orqali bir xil origin).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://192.168.1.178:8000', changeOrigin: true },
      '/media': { target: 'http://192.168.1.178:8000', changeOrigin: true },
    },
  },
})

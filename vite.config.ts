import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Supaya QR code bisa di-share ke orang lain di jaringan lokal
  server: {
    host: true
  }
})

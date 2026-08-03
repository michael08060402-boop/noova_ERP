import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy para la API local del módulo Nube en desarrollo
    proxy: {
      '/api/nube': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('chart.js') || id.includes('react-chartjs')) return 'charts';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf';
          if (id.includes('modules/nube')) return 'nube';
        }
      }
    },
    chunkSizeWarningLimit: 600,
    sourcemap: false
  }
})

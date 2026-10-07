import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('chart.js') || id.includes('react-chartjs')) return 'charts';
          if (id.includes('jspdf')) return 'pdf';
          if (id.includes('modules/nube')) return 'nube';
        }
      }
    },
    chunkSizeWarningLimit: 700,
    sourcemap: false
  }
})

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
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf';
          if (id.includes('modules/nube')) return 'nube';
        }
      }
    },
    // jsPDF se entrega en un chunk lazy separado; 700 kB evita alertas sobre
    // ese proveedor sin inflar el bundle inicial del ERP.
    chunkSizeWarningLimit: 700,
    sourcemap: false
  }
})

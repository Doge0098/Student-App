import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Rutas relativas: la misma build sirve para publicarla en cualquier carpeta
  // y para cargarla desde archivos en la futura versión de escritorio.
  base: './',
})

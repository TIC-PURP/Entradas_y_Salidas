// Comentario para personas no técnicas: Archivo de configuración que indica a las herramientas cómo compilar o procesar el proyecto.

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',
        secondary: '#64748B',
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626'
      }
    }
  },
  plugins: []
};
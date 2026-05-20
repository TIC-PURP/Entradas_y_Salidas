// Archivo de configuración que indica a las herramientas cómo compilar o procesar el proyecto.

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
        success: 'oklch(0.5 0.134 242.749)',
        warning: '#F59E0B',
        danger: '#DC2626'
      }
    }
  },
  plugins: []
};

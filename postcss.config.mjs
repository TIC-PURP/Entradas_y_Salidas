// Comentario para personas no técnicas: Archivo de configuración que indica a las herramientas cómo compilar o procesar el proyecto.

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config

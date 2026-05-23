import { redirect } from "next/navigation"

// La operación de accesos vive en la pantalla principal porque depende de la sesión
// Odoo/PWA y de los permisos dinámicos. Evitamos mantener una segunda vista sin contexto.
export default function AccesosPage() {
  redirect("/")
}

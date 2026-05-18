// Comentario para personas no técnicas: Reúne funciones pequeñas que evitan repetir lógica, como combinar clases visuales.

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

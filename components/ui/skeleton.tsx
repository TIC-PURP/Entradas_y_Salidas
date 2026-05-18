// Comentario para personas no técnicas: Componente visual reutilizable; sirve como pieza de construcción para botones, formularios, menús y tarjetas.

import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-accent animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }

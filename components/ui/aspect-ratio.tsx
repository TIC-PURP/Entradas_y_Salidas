'use client'

// Comentario para personas no técnicas: Componente visual reutilizable; sirve como pieza de construcción para botones, formularios, menús y tarjetas.

import * as AspectRatioPrimitive from '@radix-ui/react-aspect-ratio'

function AspectRatio({
  ...props
}: React.ComponentProps<typeof AspectRatioPrimitive.Root>) {
  return <AspectRatioPrimitive.Root data-slot="aspect-ratio" {...props} />
}

export { AspectRatio }

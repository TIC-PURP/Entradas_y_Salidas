"use client"

// Boton que revisa avisos para guardia y permite abrir el viaje relacionado.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bell, Check, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getGuardNotifications, acknowledgeGuardNotification, getTripByCode } from "@/lib/api"
import type { GuardNotification, OdooContext, Trip } from "@/lib/types"

interface NotificationsButtonProps {
  onOpenTrip: (trip: Trip) => void
  context?: OdooContext
}

const NOTIFICATION_POLL_MS = 15000

function showBrowserNotification(item: GuardNotification) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return

  try {
    new Notification(item.title || `Comentario en ${item.folio}`, {
      body: item.message,
      tag: item.id,
      icon: "/icons/icon-192x192.png",
    })
  } catch (error) {
    console.error("Error showing browser notification", error)
  }
}

// Boton flotante que concentra los avisos pendientes para el guardia.
export function NotificationsButton({ onOpenTrip, context }: NotificationsButtonProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<GuardNotification[]>([])
  const seenThisSessionRef = useRef<Set<string>>(new Set())

  // Solo cuenta avisos que todavia no han sido atendidos.
  const pending = useMemo(
    () => items.filter((item) => !item.done),
    [items],
  )

  const contextKey = useMemo(() => JSON.stringify(context || {}), [context])

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission === "default") {
      await Notification.requestPermission()
    }
  }

  const load = useCallback(async () => {
    try {
      const unread = await getGuardNotifications(context)
      setItems(unread)

      for (const item of unread) {
        if (!seenThisSessionRef.current.has(item.id)) {
          seenThisSessionRef.current.add(item.id)
          toast.info(item.title || `Comentario en ${item.folio}`, {
            description: item.message,
          })
          showBrowserNotification(item)
        }
      }
    } catch (error) {
      console.error("Error loading chatter notifications", error)
    }
  }, [context])

  // Consulta avisos periodicamente mientras la aplicacion esta visible.
  useEffect(() => {
    requestNotificationPermission()
    load()
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, NOTIFICATION_POLL_MS)

    const onFocus = () => load()
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void load()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [load, contextKey])

  // Abrir tambien resuelve el aviso global, para que no siga en otros equipos.
  const handleOpen = async (notification: GuardNotification) => {
    await acknowledgeGuardNotification(notification.id)
    const trip = await getTripByCode(notification.folio, context)
    if (trip) {
      setOpen(false)
      onOpenTrip(trip)
    }
    await load()
  }

  // Marca un aviso individual como leido o resuelto.
  const handleAcknowledge = async (notification: GuardNotification) => {
    await acknowledgeGuardNotification(notification.id)
    await load()
  }

  const handleAcknowledgeAll = async () => {
    for (const notification of pending) {
      await acknowledgeGuardNotification(notification.id)
    }
    await load()
  }

  return (
    <div className="fixed right-4 top-[max(4.5rem,env(safe-area-inset-top))] z-50">
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="relative h-12 w-12 rounded-full border border-border bg-card/90 shadow-lg backdrop-blur-md"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notificaciones pendientes"
      >
        <Bell className="h-5 w-5 text-primary" />
        {pending.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground shadow">
            {pending.length}
          </span>
        )}
      </Button>

      {open && (
        <Card className="absolute right-0 mt-3 w-[calc(100vw-2rem)] max-w-80 border-border bg-card/95 p-3 shadow-2xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Notificaciones</p>
              <p className="text-xs text-muted-foreground">
                {context?.activePlant ? `Almacen ${context.activePlant}` : "Comentarios nuevos del chatter"}
              </p>
            </div>
            <Badge variant="secondary">{pending.length}</Badge>
          </div>

          {pending.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="mb-3 w-full" onClick={handleAcknowledgeAll}>
              Marcar todas como leidas
            </Button>
          )}

          {pending.length === 0 ? (
            <div className="rounded-lg bg-secondary/50 p-4 text-center text-sm text-muted-foreground">
              No hay comentarios nuevos.
            </div>
          ) : (
            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {pending.map((notification) => (
                <div key={notification.id} className="rounded-lg border border-border bg-secondary/40 p-3">
                  <p className="font-semibold">{notification.title || notification.folio}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{notification.message}</p>
                  {notification.date && (
                    <p className="mt-2 text-xs text-muted-foreground">{notification.date}</p>
                  )}
                  {notification.almacen && (
                    <p className="mt-1 text-xs font-medium text-muted-foreground">Almacen: {notification.almacen}</p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={() => handleOpen(notification)}>
                      <ExternalLink className="mr-1 h-4 w-4" /> Abrir
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleAcknowledge(notification)}>
                      <Check className="mr-1 h-4 w-4" /> Enterado
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

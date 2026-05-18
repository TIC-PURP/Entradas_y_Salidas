"use client"

// Comentario para personas no técnicas: Botón que revisa avisos para guardia y permite abrir el viaje relacionado.

import { useEffect, useMemo, useRef, useState } from "react"
import { Bell, Check, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getGuardNotifications, acknowledgeGuardNotification, getTripByCode } from "@/lib/api"
import type { GuardNotification, Trip } from "@/lib/types"

const STORAGE_KEY = "purp.chatterNotifications.readIds.v1"

interface NotificationsButtonProps {
  onOpenTrip: (trip: Trip) => void
}

function readStoredIds() {
  if (typeof window === "undefined") return new Set<string>()
  try {
    return new Set<string>(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]"))
  } catch {
    return new Set<string>()
  }
}

function writeStoredIds(ids: Set<string>) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-500)))
}

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

// Botón flotante que concentra los avisos pendientes para el guardia.
export function NotificationsButton({ onOpenTrip }: NotificationsButtonProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<GuardNotification[]>([])
  const readIdsRef = useRef<Set<string>>(readStoredIds())
  const seenThisSessionRef = useRef<Set<string>>(new Set())

  // Solo cuenta avisos que todavía no han sido atendidos.
  const pending = useMemo(
    () => items.filter((item) => !readIdsRef.current.has(item.id) && !item.done),
    [items],
  )

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission === "default") {
      await Notification.requestPermission()
    }
  }

  const load = async () => {
    try {
      const result = await getGuardNotifications()
      const unread = result.filter((item) => !readIdsRef.current.has(item.id))
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
  }

  // Consulta avisos periódicamente para que caseta vea cambios sin recargar la página.
  useEffect(() => {
    requestNotificationPermission()
    load()
    const interval = window.setInterval(load, 5000)

    const onFocus = () => load()
    window.addEventListener("focus", onFocus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  // Abre el viaje relacionado con el aviso para que el guardia lo revise.
  const handleOpen = async (notification: GuardNotification) => {
    const trip = await getTripByCode(notification.folio)
    if (trip) {
      setOpen(false)
      onOpenTrip(trip)
    }
  }

  // Marca un aviso individual como leído o resuelto.
  const handleAcknowledge = async (notification: GuardNotification) => {
    await acknowledgeGuardNotification(notification.id)
    readIdsRef.current.add(notification.id)
    writeStoredIds(readIdsRef.current)
    await load()
  }

  const handleAcknowledgeAll = async () => {
    for (const notification of pending) {
      readIdsRef.current.add(notification.id)
    }
    writeStoredIds(readIdsRef.current)
    await load()
  }

  return (
    <div className="absolute right-4 top-4 z-50">
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
        <Card className="absolute right-0 mt-3 w-80 border-border bg-card/95 p-3 shadow-2xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Notificaciones</p>
              <p className="text-xs text-muted-foreground">Comentarios nuevos del chatter</p>
            </div>
            <Badge variant="secondary">{pending.length}</Badge>
          </div>

          {pending.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="mb-3 w-full" onClick={handleAcknowledgeAll}>
              Marcar todas como leídas
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
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">{notification.message}</p>
                  {notification.date && (
                    <p className="mt-2 text-xs text-muted-foreground">{notification.date}</p>
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

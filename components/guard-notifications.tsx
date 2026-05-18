"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { acknowledgeGuardNotification, getGuardNotifications } from "@/lib/api";
import type { GuardNotification } from "@/lib/types";

interface GuardNotificationsProps {
  onOpenTrip: (folio: string) => void;
}

export function GuardNotifications({ onOpenTrip }: GuardNotificationsProps) {
  const [notifications, setNotifications] = useState<GuardNotification[]>([]);
  const [open, setOpen] = useState(false);
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    const load = async () => {
      const result = await getGuardNotifications();
      if (!active) return;
      setNotifications(result);

      for (const notification of result) {
        if (!notified.current.has(notification.id)) {
          notified.current.add(notification.id);
          toast.info(notification.title, { description: notification.message });
        }
      }
    };

    load();
    const timer = window.setInterval(load, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const pendingCount = notifications.length;

  const handleOpenTrip = (folio: string) => {
    setOpen(false);
    onOpenTrip(folio);
  };

  const handleAcknowledge = async (folio: string) => {
    await acknowledgeGuardNotification(folio);
    setNotifications((prev) => prev.filter((item) => item.folio !== folio));
  };

  return (
    <div className="fixed right-4 top-4 z-50">
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="relative h-12 w-12 rounded-full border border-border bg-card/95 shadow-lg backdrop-blur"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notificaciones pendientes"
      >
        <Bell className="h-5 w-5 text-primary" />
        {pendingCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-warning px-1.5 text-xs font-bold text-warning-foreground shadow">
            {pendingCount}
          </span>
        )}
      </Button>

      {open && (
        <Card className="absolute right-0 mt-3 w-[calc(100vw-2rem)] max-w-sm border-border bg-card/98 p-3 shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Notificaciones</p>
              <p className="text-xs text-muted-foreground">Solo pendientes</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {pendingCount === 0 ? (
            <div className="rounded-lg border border-border bg-secondary/40 p-4 text-center text-sm text-muted-foreground">
              No hay notificaciones pendientes.
            </div>
          ) : (
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {notifications.map((notification) => (
                <div key={notification.id} className="rounded-lg border border-warning/40 bg-warning/10 p-3">
                  <p className="text-sm font-semibold">{notification.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                  <p className="mt-2 text-xs font-medium text-warning">Viaje: {notification.folio}</p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={() => handleOpenTrip(notification.folio)}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleAcknowledge(notification.folio)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Enterado
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from 'react';
import { getGuardNotifications, acknowledgeGuardNotification } from '../lib/api';

interface Notification {
  id: string;
  title?: string;
  message: string;
  folio: string;
}

/**
 * Ícono de notificaciones.
 *
 * Muestra la cantidad de notificaciones pendientes. Al hacer clic,
 * despliega una lista de notificaciones con botones para revisar
 * (abre el viaje) o marcar como enterado. Las notificaciones se
 * actualizan periódicamente.
 */
export default function NotificationsIcon() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function fetchNotifications() {
      const notifs = await getGuardNotifications();
      setNotifications(notifs);
    }
    fetchNotifications();
    // Consulta periódica cada 30 segundos
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Permite confirmar un aviso desde el icono de notificaciones.
  async function handleAcknowledge(folio: string) {
    await acknowledgeGuardNotification(folio);
    const notifs = await getGuardNotifications();
    setNotifications(notifs);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-200">
        {/* Bell icon from Heroicons (outline) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.737 19.608a2.25 2.25 0 01-5.09 0m10.573-4.446c-.833-.968-1.406-2.22-1.406-3.662V9a6 6 0 10-12 0v2.5c0 1.441-.573 2.694-1.406 3.662-.534.62-.908 1.675-.908 2.389A1.944 1.944 0 005.5 18h13a1.944 1.944 0 001.994-1.935c0-.714-.374-1.77-.908-2.389z"
          />
        </svg>
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-danger rounded-full transform translate-x-1/2 -translate-y-1/2">
            {notifications.length}
          </span>
        )}
      </button>
      {open && notifications.length > 0 && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <ul className="divide-y divide-gray-200">
            {notifications.map((notif) => (
              <li key={notif.id} className="p-2 space-y-1">
                <p className="text-sm font-medium">{notif.title}</p>
                <p className="text-xs text-gray-600">{notif.message}</p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => {
                      // Abrir viaje en la lista de viajes
                      window.location.href = '/viajes';
                      setOpen(false);
                    }}
                    className="text-primary text-xs underline"
                  >
                    Abrir
                  </button>
                  <button
                    onClick={() => notif.folio && handleAcknowledge(notif.folio)}
                    className="text-xs text-gray-500 underline"
                  >
                    Enterado
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
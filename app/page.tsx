"use client";

// Pantalla principal de caseta: escanea códigos, busca viajes y muestra el resultado al guardia.

import { useState, useCallback } from "react";
import { Scanner } from "@/components/scanner";
import { TripCard } from "@/components/trip-card";
import { ManualMode } from "@/components/manual-mode";
import { EmployeeSession, Trip } from "@/lib/types";
import { getTripByCode } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { NotificationsButton } from "@/components/notifications-button";
import { clearStoredEmployee, EmployeeLogin } from "@/components/employee-login";
import { Button } from "@/components/ui/button";
import { LogOut, UserCheck } from "lucide-react";

// Vistas posibles de la pantalla principal: cámara, detalle del viaje o búsqueda manual.
type AppView = "scanner" | "trip" | "manual";

export default function Home() {
  // Guarda qué pantalla ve el guardia en este momento.
  const [view, setView] = useState<AppView>("scanner");
  // Guarda el viaje encontrado para mostrar sus datos y acciones.
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  // Evita dobles búsquedas mientras el sistema consulta la información.
  const [isLoading, setIsLoading] = useState(false);
  // Empleado operativo autenticado en la PWA. No es usuario de Odoo; es hr.employee.
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);

  // Cuando la cámara o el modo manual entregan un código, se busca el viaje correspondiente.
  const handleScan = useCallback(async (code: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const trip = await getTripByCode(code);
      if (trip) {
        setSelectedTrip(trip);
        setView("trip");
        toast.success(`Viaje ${trip.folio} encontrado`);
      } else {
        toast.error("Código no encontrado", {
          description: `No se encontró ningún viaje con el código: ${code}`,
        });
      }
    } catch {
      toast.error("Error al buscar", {
        description: "Ocurrió un error al buscar el viaje. Intenta de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Refresca la tarjeta cuando una acción cambia el estado del viaje.
  const handleTripUpdate = useCallback((updatedTrip: Trip) => {
    setSelectedTrip(updatedTrip);
    toast.success("Estado actualizado", {
      description: `El viaje ${updatedTrip.folio} ha sido actualizado`,
    });
  }, []);

  // Permite abrir un viaje elegido desde la búsqueda manual o desde notificaciones.
  const handleSelectTrip = useCallback((trip: Trip) => {
    setSelectedTrip(trip);
    setView("trip");
  }, []);

  const handleBack = useCallback(() => {
    setSelectedTrip(null);
    setView("scanner");
  }, []);

  const handleManualMode = useCallback(() => {
    setView("manual");
  }, []);

  const handleBackToScanner = useCallback(() => {
    setView("scanner");
  }, []);

  const handleLogout = useCallback(() => {
    clearStoredEmployee();
    setEmployee(null);
    setSelectedTrip(null);
    setView("scanner");
    toast.info("Sesión de operador cerrada");
  }, []);

  if (!employee) {
    return (
      <>
        <EmployeeLogin onLogin={setEmployee} />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UserCheck className="h-4 w-4 text-primary" />
              <span className="truncate">{employee.name}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {employee.job_title || employee.department || "Operador PWA"}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-4 w-4" />
            Salir
          </Button>
        </div>
      </div>
      {/* Botón de avisos: si logística manda una alerta, el guardia puede abrir el viaje relacionado. */}
      <NotificationsButton onOpenTrip={(trip) => { setSelectedTrip(trip); setView("trip"); }} />
      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4">
        {/* Pantalla normal: abre la cámara para escanear códigos. */}
        {view === "scanner" && (
          <Scanner
            onScan={handleScan}
            onManualMode={handleManualMode}
            isLoading={isLoading}
          />
        )}

        {/* Pantalla de detalle: muestra la información y acciones del viaje encontrado. */}
        {view === "trip" && selectedTrip && (
          <TripCard
            trip={selectedTrip}
            onUpdate={handleTripUpdate}
            onBack={handleBack}
            employee={employee}
          />
        )}

        {/* Alternativa sin cámara: permite buscar el viaje escribiendo datos. */}
        {view === "manual" && (
          <ManualMode
            onSelectTrip={handleSelectTrip}
            onBack={handleBackToScanner}
            employee={employee}
          />
        )}
      </div>
      <Toaster position="top-center" richColors />
    </main>
  );
}

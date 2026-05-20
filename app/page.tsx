"use client";

// Pantalla principal de caseta: escanea códigos, busca viajes y muestra el resultado al guardia.

import { useState, useCallback, useRef } from "react";
import { Scanner } from "@/components/scanner";
import { TripCard } from "@/components/trip-card";
import { ManualMode } from "@/components/manual-mode";
import { EmployeeSession, Trip } from "@/lib/types";
import { getTripByCode, lookupEmployeeAccess } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { NotificationsButton } from "@/components/notifications-button";
import { clearStoredEmployee, EmployeeLogin } from "@/components/employee-login";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, UserCheck } from "lucide-react";
import { AccessControl } from "@/components/access-control";

// Vistas posibles de la pantalla principal: cámara, detalle del viaje o búsqueda manual.
type AppView = "scanner" | "trip" | "manual" | "access";

export default function Home() {
  // Guarda qué pantalla ve el guardia en este momento.
  const [view, setView] = useState<AppView>("scanner");
  // Guarda el viaje encontrado para mostrar sus datos y acciones.
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  // Evita dobles búsquedas mientras el sistema consulta la información.
  const [isLoading, setIsLoading] = useState(false);
  // Empleado operativo autenticado en la PWA. No es usuario de Odoo; es hr.employee.
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [accessPrefillName, setAccessPrefillName] = useState("");
  const [accessSearch, setAccessSearch] = useState("");
  const [accessEmployeeId, setAccessEmployeeId] = useState<number | undefined>(undefined);
  const scanInFlightRef = useRef(false);

  // Cuando la cámara o el modo manual entregan un código, se busca el viaje correspondiente.
  const handleScan = useCallback(async (code: string) => {
    if (isLoading || scanInFlightRef.current) return;
    
    scanInFlightRef.current = true;
    setIsLoading(true);
    try {
      const trip = await getTripByCode(code, employee || undefined);
      if (trip) {
        setSelectedTrip(trip);
        setView("trip");
        toast.success(`Viaje ${trip.folio} encontrado`);
        return;
      }

      const accessLookup = await lookupEmployeeAccess(code);
      if (accessLookup.openAccess) {
        setAccessPrefillName("");
        setAccessSearch(accessLookup.employee.name);
        setAccessEmployeeId(accessLookup.employee.id);
        setView("access");
        toast.info("Empleado con entrada activa", {
          description: `${accessLookup.employee.name}. Abre su registro para confirmar salida.`,
        });
        return;
      }

      setAccessPrefillName(accessLookup.employee.name);
      setAccessSearch(accessLookup.employee.name);
      setAccessEmployeeId(accessLookup.employee.id);
      setView("access");
      toast.success("Empleado encontrado", {
        description: `${accessLookup.employee.name}. Completa vehículo y registra entrada.`,
      });
    } catch (error) {
      toast.error("Código no encontrado", {
        description: error instanceof Error ? error.message : "No se encontró viaje ni empleado con ese código.",
      });
    } finally {
      setIsLoading(false);
      scanInFlightRef.current = false;
    }
  }, [employee, isLoading]);

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
    setAccessPrefillName("");
    setAccessSearch("");
    setAccessEmployeeId(undefined);
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
    <main className="min-h-dvh flex flex-col bg-background">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UserCheck className="h-4 w-4 text-primary" />
              <span className="truncate">{employee.name}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <p className="truncate text-xs text-muted-foreground">
                {employee.job_title || employee.department || "Operador PWA"}
              </p>
              {employee.work_location && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {employee.work_location}
                </Badge>
              )}
              {employee.can_view_all_locations && (
                <Badge className="h-5 px-1.5 text-[10px]">
                  Supervisor
                </Badge>
              )}
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* Botón de avisos: si logística manda una alerta, el guardia puede abrir el viaje relacionado. */}
      <NotificationsButton employee={employee} onOpenTrip={(trip) => { setSelectedTrip(trip); setView("trip"); }} />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-3 sm:p-4 lg:p-6">
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

        {view === "access" && (
          <AccessControl
            onBack={handleBackToScanner}
            employee={employee}
            prefillName={accessPrefillName}
            initialSearch={accessSearch}
            autoCreate={Boolean(accessPrefillName)}
            prefillEmployeeId={accessEmployeeId}
          />
        )}
      </div>
      <Toaster position="top-center" richColors />
    </main>
  );
}

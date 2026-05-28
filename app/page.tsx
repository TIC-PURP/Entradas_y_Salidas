"use client";

// Pantalla principal: login Odoo, permisos PWA, scanner y operación de caseta.

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import type { AppSession, EmployeeSession, Trip } from "@/lib/types";
import { buildOdooContext, getAccessByCode, getTripByCode, lookupEmployeeAccess, odooLogout, updatePwaPlant } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { clearStoredSession, EmployeeLogin, storeSession, storeTheme } from "@/components/employee-login";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Settings, UserCheck } from "lucide-react";

type AppView = "scanner" | "trip" | "manual" | "access";
const PLANTS = ["Pinitos", "Burrión"];

function ViewLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-72 flex-1 items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
      {label}
    </div>
  );
}

const Scanner = dynamic(() => import("@/components/scanner").then((module) => module.Scanner), {
  loading: () => <ViewLoading label="Activando camara..." />,
});
const TripCard = dynamic(() => import("@/components/trip-card").then((module) => module.TripCard), {
  loading: () => <ViewLoading label="Cargando viaje..." />,
});
const ManualMode = dynamic(() => import("@/components/manual-mode").then((module) => module.ManualMode), {
  loading: () => <ViewLoading label="Cargando lista..." />,
});
const AccessControl = dynamic(() => import("@/components/access-control").then((module) => module.AccessControl), {
  loading: () => <ViewLoading label="Cargando accesos..." />,
});
const NotificationsButton = dynamic(
  () => import("@/components/notifications-button").then((module) => module.NotificationsButton),
);

export default function Home() {
  const [view, setView] = useState<AppView>("scanner");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<AppSession | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accessPrefillName, setAccessPrefillName] = useState("");
  const [accessSearch, setAccessSearch] = useState("");
  const [accessEmployeeId, setAccessEmployeeId] = useState<number | undefined>(undefined);

  const permissions = session?.permissions;
  const operativeEmployee = useMemo<EmployeeSession | undefined>(() => {
    return session?.employee || session?.permissions.empleado || undefined;
  }, [session]);

  const context = useMemo(() => buildOdooContext(session), [session]);
  const canSeeLogistics = Boolean(permissions?.puede_logistica);
  const canOpenManualMode = Boolean(permissions?.puede_logistica || permissions?.puede_entrada_salida);

  useEffect(() => {
    const theme = session?.theme || "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [session?.theme]);

  const updateSession = useCallback((patch: Partial<AppSession>) => {
    setSession((current) => {
      if (!current) return current;
      const updated = { ...current, ...patch };
      storeSession(updated);
      return updated;
    });
  }, []);

  const handleScan = useCallback(async (code: string) => {
    if (isLoading || !session) return;
    setIsLoading(true);

    try {
      const trip = canSeeLogistics ? await getTripByCode(code, context) : null;
      if (trip) {
        if (permissions?.puede_abrir_odoo && !permissions?.puede_entrada_salida) {
          toast.success(`Abriendo ${trip.folio} en Odoo`);
          window.location.href = trip.odoo_url || `${process.env.NEXT_PUBLIC_ODOO_URL || ""}/odoo/x_viajes/${trip.id}`;
          return;
        }

        setSelectedTrip(trip);
        setView("trip");
        toast.success(`Viaje ${trip.folio} encontrado`);
        return;
      }

      if (!permissions?.puede_entrada_salida) {
        toast.error("Código no encontrado", {
          description: "Este usuario puede abrir documentos de Odoo, pero el código no corresponde a un viaje visible.",
        });
        return;
      }

      const accessByFolio = await getAccessByCode(code, context);
      if (accessByFolio) {
        setAccessPrefillName("");
        setAccessSearch(accessByFolio.folio || accessByFolio.nombre || String(accessByFolio.id));
        setAccessEmployeeId(undefined);
        setView("access");
        toast.success("Entrada encontrada", {
          description: `${accessByFolio.folio || accessByFolio.nombre}. Puedes registrar la salida.`,
        });
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
    }
  }, [context, isLoading, permissions?.puede_abrir_odoo, permissions?.puede_entrada_salida, session, canSeeLogistics]);

  const handleTripUpdate = useCallback((updatedTrip: Trip) => {
    setSelectedTrip(updatedTrip);
    toast.success("Estado actualizado", {
      description: `El viaje ${updatedTrip.folio} ha sido actualizado`,
    });
  }, []);

  const handleSelectTrip = useCallback((trip: Trip) => {
    if (permissions?.puede_abrir_odoo && !permissions?.puede_entrada_salida) {
      window.location.href = trip.odoo_url || "#";
      return;
    }
    setSelectedTrip(trip);
    setView("trip");
  }, [permissions?.puede_abrir_odoo, permissions?.puede_entrada_salida]);

  const handleBack = useCallback(() => {
    setSelectedTrip(null);
    setAccessPrefillName("");
    setAccessSearch("");
    setAccessEmployeeId(undefined);
    setView("scanner");
  }, []);

  const handleLogout = useCallback(() => {
    void odooLogout().catch(() => undefined);
    clearStoredSession();
    setSession(null);
    setSelectedTrip(null);
    setView("scanner");
    toast.info("Sesión cerrada");
  }, []);

  if (!session) {
    return (
      <>
        <EmployeeLogin onLogin={setSession} />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  const canOperateAccess = Boolean(permissions?.puede_entrada_salida && operativeEmployee?.id);

  return (
    <main className="min-h-dvh flex flex-col bg-background">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UserCheck className="h-4 w-4 text-primary" />
              <span className="truncate">{session.odooUser.name}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {session.activePlant || permissions?.planta_predeterminada || "Sin planta"}
              {operativeEmployee?.name ? ` • ${operativeEmployee.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {permissions?.puede_entrada_salida && <NotificationsButton context={context} onOpenTrip={(trip) => { setSelectedTrip(trip); setView("trip"); }} />}

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-3 sm:p-4 lg:p-6">
        {view === "scanner" && (
          <Scanner
            onScan={handleScan}
            onManualMode={() => setView("manual")}
            isLoading={isLoading}
            showManualMode={canOpenManualMode}
          />
        )}

        {view === "trip" && selectedTrip && canOperateAccess && operativeEmployee && (
          <TripCard
            trip={selectedTrip}
            onUpdate={handleTripUpdate}
            onBack={handleBack}
            employee={operativeEmployee}
            context={context}
          />
        )}

        {view === "manual" && canOpenManualMode && (
          <ManualMode
            onSelectTrip={handleSelectTrip}
            onBack={() => setView("scanner")}
            session={session}
            employee={operativeEmployee}
          />
        )}

        {view === "manual" && !canOpenManualMode && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
            Este usuario no tiene permiso para ver logística ni entradas/salidas.
          </div>
        )}

        {view === "access" && canOperateAccess && operativeEmployee && (
          <AccessControl
            onBack={() => setView("scanner")}
            employee={operativeEmployee}
            context={context}
            activePlant={session.activePlant || permissions?.planta_predeterminada || ""}
            prefillName={accessPrefillName}
            initialSearch={accessSearch}
            autoCreate={Boolean(accessPrefillName)}
            prefillEmployeeId={accessEmployeeId}
          />
        )}

        {view === "access" && !canOperateAccess && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
            Este usuario no tiene permiso o empleado operativo para registrar entradas/salidas.
          </div>
        )}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuración PWA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Planta operativa</Label>
              <Select
                value={session.activePlant || ""}
                onValueChange={async (value) => {
                  try {
                    const result = await updatePwaPlant(session.permissions.id, value, context);
                    updateSession({
                      activePlant: result.plant,
                      permissions: { ...session.permissions, ...result.permissions, planta_predeterminada: result.plant },
                    });
                    toast.success("Planta actualizada", { description: `Permisos PWA actualizados a ${result.plant}.` });
                  } catch (error) {
                    toast.error("No se pudo actualizar la planta", { description: error instanceof Error ? error.message : "Error desconocido" });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona planta" />
                </SelectTrigger>
                <SelectContent>
                  {PLANTS.map((plant) => <SelectItem key={plant} value={plant}>{plant}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tema</Label>
              <Select
                value={session.theme || "dark"}
                onValueChange={(value) => {
                  const theme = value as "dark" | "light";
                  storeTheme(theme);
                  updateSession({ theme });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Oscuro</SelectItem>
                  <SelectItem value="light">Claro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster position="top-center" richColors />
    </main>
  );
}

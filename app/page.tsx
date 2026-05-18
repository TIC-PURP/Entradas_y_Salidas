"use client";

import { useState, useCallback } from "react";
import { Scanner } from "@/components/scanner";
import { TripCard } from "@/components/trip-card";
import { ManualMode } from "@/components/manual-mode";
import { Trip } from "@/lib/types";
import { getTripByCode } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { NotificationsButton } from "@/components/notifications-button";

type AppView = "scanner" | "trip" | "manual";

export default function Home() {
  const [view, setView] = useState<AppView>("scanner");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleTripUpdate = useCallback((updatedTrip: Trip) => {
    setSelectedTrip(updatedTrip);
    toast.success("Estado actualizado", {
      description: `El viaje ${updatedTrip.folio} ha sido actualizado`,
    });
  }, []);

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

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <NotificationsButton onOpenTrip={(trip) => { setSelectedTrip(trip); setView("trip"); }} />
      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4">
        {view === "scanner" && (
          <Scanner
            onScan={handleScan}
            onManualMode={handleManualMode}
            isLoading={isLoading}
          />
        )}

        {view === "trip" && selectedTrip && (
          <TripCard
            trip={selectedTrip}
            onUpdate={handleTripUpdate}
            onBack={handleBack}
          />
        )}

        {view === "manual" && (
          <ManualMode
            onSelectTrip={handleSelectTrip}
            onBack={handleBackToScanner}
          />
        )}
      </div>
      <Toaster position="top-center" richColors />
    </main>
  );
}

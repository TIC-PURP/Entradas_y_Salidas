"use client";

// Permite buscar y elegir viajes sin cámara cuando el escaneo no está disponible.

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { EmployeeSession, Trip, TripStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import { getAllTrips } from "@/lib/api";
import { Search, ArrowLeft, Truck, Filter, ScanLine, UserCheck, Building2 } from "lucide-react";
import { AccessControl } from "@/components/access-control";

interface ManualModeProps {
  onSelectTrip: (trip: Trip) => void;
  onBack: () => void;
  employee: EmployeeSession;
}

type ManualView = "menu" | "trips" | "access";

const STATUS_FILTERS: { value: TripStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "en_camino", label: "En Camino" },
  { value: "en_revision", label: "En Revisión" },
  { value: "en_espera", label: "En Espera" },
  { value: "en_proceso", label: "En Proceso" },
  { value: "finalizado", label: "Finalizado" },
];

// Pantalla de respaldo para encontrar viajes escribiendo folio, orden, chofer o placas.
export function ManualMode({ onSelectTrip, onBack, employee }: ManualModeProps) {
  const [view, setView] = useState<ManualView>("menu");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TripStatus | "all">("all");

  // Al abrir la pantalla, carga los viajes disponibles para poder filtrarlos localmente.
  useEffect(() => {
    if (view !== "trips") return;
    const loadTrips = async () => {
      setLoading(true);
      try {
        setTrips(await getAllTrips(employee));
      } finally {
        setLoading(false);
      }
    };
    loadTrips();
  }, [view, employee]);

  // Filtra la lista según el texto buscado y el estado elegido por el guardia.
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const term = search.toLowerCase();
      const matchesSearch =
        search === "" ||
        trip.folio.toLowerCase().includes(term) ||
        trip.orden.toLowerCase().includes(term) ||
        trip.chofer.toLowerCase().includes(term) ||
        trip.placas.toLowerCase().includes(term) ||
        trip.linea_fletera.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || trip.estado === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [trips, search, statusFilter]);

  if (view === "access") {
    return <AccessControl onBack={() => setView("menu")} employee={employee} />;
  }

  if (view === "menu") {
    return (
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="lg" onClick={onBack}>
            <ArrowLeft className="mr-2 h-5 w-5" />
            Escanear
          </Button>
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            <span className="font-semibold">Modo Manual</span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card className="p-6 border-border cursor-pointer active:scale-[0.98] transition" onClick={() => setView("trips")}>
            <Truck className="h-12 w-12 text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">Viajes en planta</h2>
            <p className="text-muted-foreground">Buscar viajes por folio, chofer, placas o etapa.</p>
          </Card>

          <Card className="p-6 border-border cursor-pointer active:scale-[0.98] transition" onClick={() => setView("access")}>
            <UserCheck className="h-12 w-12 text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">Entradas y Salidas</h2>
            <p className="text-muted-foreground">Registrar entradas y salidas manuales de personas y vehículos.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="lg" onClick={() => setView("menu")}>
          <ArrowLeft className="mr-2 h-5 w-5" />
          Manual
        </Button>
        <span className="font-semibold">Viajes en planta</span>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input type="search" placeholder="Buscar por folio, orden, chofer, placas..." className="pl-12 h-14 text-lg bg-secondary border-border" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {STATUS_FILTERS.map((filter) => (
          <Button key={filter.value} variant={statusFilter === filter.value ? "default" : "secondary"} size="sm" className="shrink-0" onClick={() => setStatusFilter(filter.value)}>
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto -mx-4 px-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12"><Spinner className="h-10 w-10 mb-4" />Cargando viajes...</div>
        ) : filteredTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Truck className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">No se encontraron viajes</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {filteredTrips.map((trip) => (
              <Card key={trip.folio} className="cursor-pointer border-border p-4 transition-colors hover:bg-secondary/50 active:scale-[0.98]" onClick={() => onSelectTrip(trip)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="break-words text-lg font-bold">{trip.folio}</span>
                      {trip.almacen && (
                        <Badge variant="secondary" className="text-xs">
                          <Building2 className="mr-1 h-3 w-3" />
                          {trip.almacen}
                        </Badge>
                      )}
                      <Badge className={`text-xs ${STATUS_COLORS[trip.estado]}`}>{STATUS_LABELS[trip.estado]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{trip.orden} • {trip.chofer}</p>
                    <p className="text-sm text-muted-foreground truncate">{trip.placas} • {trip.linea_fletera}</p>
                  </div>
                  <Truck className="h-6 w-6 text-muted-foreground shrink-0" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

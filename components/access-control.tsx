"use client";

// Comentario para personas no técnicas: Interfaz de apoyo para registrar accesos y salidas de visitantes o unidades internas.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Car, Clock, LogOut, Plus, Search, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ACCESS_STATUS_COLORS, ACCESS_STATUS_LABELS, AccessRecord, FleetVehicle, VehicleType } from "@/lib/types";
import { createAccessRecord, getAccessRecords, getFleetVehicles, registerAccessExit } from "@/lib/api";

interface AccessControlProps {
  onBack: () => void;
}

// Control completo de accesos manuales usado cuando se necesita una vista dedicada.
export function AccessControl({ onBack }: AccessControlProps) {
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [nombre, setNombre] = useState("");
  const [vehiculo, setVehiculo] = useState<VehicleType>("Vehículo PURP");
  const [vehiculoPurp, setVehiculoPurp] = useState("");
  const [descripcionVehiculo, setDescripcionVehiculo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const [recordsData, vehiclesData] = await Promise.all([
        getAccessRecords(),
        getFleetVehicles().catch(() => [] as FleetVehicle[]),
      ]);
      setRecords(recordsData);
      setFleetVehicles(vehiclesData);
      if (!vehiculoPurp && vehiclesData.length > 0) {
        setVehiculoPurp(String(vehiclesData[0].id));
      }
    } finally {
      setLoading(false);
    }
  };

  // Crea un diccionario para mostrar el nombre del vehículo a partir de su identificador.
  const vehicleNameById = useMemo(() => {
    return new Map(fleetVehicles.map((vehicle) => [String(vehicle.id), vehicle.name]));
  }, [fleetVehicles]);

  // Muestra solo registros que coinciden con la búsqueda escrita por el usuario.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) => {
      const displayVehiculoPurp = r.vehiculo_purp && vehicleNameById.get(String(r.vehiculo_purp))
        ? vehicleNameById.get(String(r.vehiculo_purp))
        : r.vehiculo_purp;
      if (!term) return true;
      return (
        r.nombre.toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term) ||
        (displayVehiculoPurp ?? "").toLowerCase().includes(term) ||
        (r.descripcion_vehiculo ?? "").toLowerCase().includes(term)
      );
    });
  }, [records, search, vehicleNameById]);

  const formatDate = (value?: string) => {
    if (!value) return "—";
    return new Date(value).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
  };

  // Valida los campos básicos y registra una nueva entrada manual.
  const handleCreate = async () => {
    if (!nombre.trim()) {
      toast.error("Captura el nombre");
      return;
    }
    if (vehiculo === "Vehículo PURP" && !vehiculoPurp.trim()) {
      toast.error("Selecciona un vehículo PURP");
      return;
    }
    if (vehiculo === "Otro vehículo" && !descripcionVehiculo.trim()) {
      toast.error("Describe el vehículo");
      return;
    }

    setSaving(true);
    try {
      const record = await createAccessRecord({
        nombre: nombre.trim(),
        vehiculo,
        vehiculo_purp: vehiculoPurp,
        descripcion_vehiculo: descripcionVehiculo.trim(),
      });
      setRecords((prev) => [record, ...prev]);
      setNombre("");
      setDescripcionVehiculo("");
      setCreating(false);
      toast.success("Entrada registrada");
    } finally {
      setSaving(false);
    }
  };

  // Marca la salida de un registro y actualiza la lista en pantalla.
  const handleExit = async (id: string) => {
    const updated = await registerAccessExit(id);
    if (!updated) return;
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
    toast.success("Salida registrada");
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="lg" onClick={onBack}>
          <ArrowLeft className="mr-2 h-5 w-5" />
          Manual
        </Button>
        <span className="font-semibold">Control de acceso</span>
      </div>

      {!creating ? (
        <Button size="lg" className="h-14 text-lg" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-5 w-5" />
          Nueva entrada
        </Button>
      ) : (
        <Card className="border-border">
          <CardHeader className="font-semibold">Registrar entrada manual</CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Nombre visitante..." className="h-12 text-base" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <select className="h-12 w-full rounded-md bg-secondary px-3 text-base border border-border" value={vehiculo} onChange={(e) => setVehiculo(e.target.value as VehicleType)}>
              <option>Vehículo PURP</option>
              <option>Otro vehículo</option>
            </select>
            {vehiculo === "Vehículo PURP" ? (
              <select className="h-12 w-full rounded-md bg-secondary px-3 text-base border border-border" value={vehiculoPurp} onChange={(e) => setVehiculoPurp(e.target.value)}>
                {fleetVehicles.length === 0 ? (
                  <option value="">No hay vehículos disponibles</option>
                ) : (
                  fleetVehicles.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)
                )}
              </select>
            ) : (
              <Input placeholder="Describe el vehículo..." className="h-12 text-base" value={descripcionVehiculo} onChange={(e) => setDescripcionVehiculo(e.target.value)} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" size="lg" onClick={() => setCreating(false)}>Cancelar</Button>
              <Button size="lg" onClick={handleCreate} disabled={saving}>{saving ? <Spinner className="mr-2" /> : null}Registrar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input placeholder="Buscar persona o vehículo..." className="pl-12 h-12" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex-1 overflow-y-auto -mx-4 px-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12"><Spinner className="h-10 w-10 mb-4" />Cargando accesos...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No hay registros</div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {filtered.map((record) => (
              <Card key={record.id} className="p-4 border-border">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <span className="font-bold text-lg truncate">{record.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Car className="h-4 w-4" />
                      <span>{record.vehiculo === "Vehículo PURP" ? record.vehiculo_purp : record.descripcion_vehiculo}</span>
                    </div>
                  </div>
                  <Badge className={ACCESS_STATUS_COLORS[record.estado]}>{ACCESS_STATUS_LABELS[record.estado]}</Badge>
                </div>

                <div className="grid gap-1 text-sm text-muted-foreground mb-3">
                  <span><Clock className="inline h-4 w-4 mr-1" /> Entrada: {formatDate(record.fecha_entrada)}</span>
                  <span><Clock className="inline h-4 w-4 mr-1" /> Salida: {formatDate(record.fecha_salida)}</span>
                </div>

                {record.estado === "en_planta" && (
                  <Button className="w-full h-12" variant="secondary" onClick={() => handleExit(record.id)}>
                    <LogOut className="mr-2 h-5 w-5" /> Registrar salida
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

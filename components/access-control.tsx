"use client";

// Interfaz de apoyo para registrar accesos y salidas de visitantes o unidades internas.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Car, Clock, LogOut, MessageSquare, Plus, Printer, RefreshCw, Search, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ACCESS_STATUS_COLORS, ACCESS_STATUS_LABELS, AccessRecord, EmployeeSession, FleetVehicle, VehicleType } from "@/lib/types";
import { createAccessRecord, getAccessRecords, getFleetVehicles, registerAccessExit } from "@/lib/api";
import { formatOdooDateTime } from "@/lib/date-time";
import { RecordChatter } from "@/components/record-chatter";

interface AccessControlProps {
  onBack: () => void;
  employee: EmployeeSession;
  context?: any;
  activePlant?: string;
  prefillName?: string;
  initialSearch?: string;
  autoCreate?: boolean;
  prefillEmployeeId?: number;
}

// Control completo de accesos manuales usado cuando se necesita una vista dedicada.
export function AccessControl({ onBack, employee, context, activePlant = "", prefillName = "", initialSearch = "", autoCreate = false, prefillEmployeeId }: AccessControlProps) {
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [creating, setCreating] = useState(autoCreate);
  const [search, setSearch] = useState(initialSearch);
  const [nombre, setNombre] = useState(prefillName);
  const [vehiculo, setVehiculo] = useState<VehicleType>("Vehículo PURP");
  const [vehiculoPurp, setVehiculoPurp] = useState("");
  const [descripcionVehiculo, setDescripcionVehiculo] = useState("");
  const [saving, setSaving] = useState(false);
  const [openChatterId, setOpenChatterId] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await getAccessRecords(context));
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron cargar los registros de acceso";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [context]);

  const loadFleetVehicles = useCallback(async () => {
    setFleetLoading(true);
    setFleetError(null);
    try {
      const vehiclesData = await getFleetVehicles();
      setFleetVehicles(vehiclesData);
      if (vehiclesData.length > 0) {
        setVehiculoPurp((current) => current || String(vehiclesData[0].id));
      } else {
        setVehiculoPurp("");
        setFleetError("No hay vehículos activos disponibles en Flotilla.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron cargar vehículos de Flotilla";
      setFleetVehicles([]);
      setVehiculoPurp("");
      setFleetError(message);
      toast.error(message);
    } finally {
      setFleetLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
    loadFleetVehicles();
  }, [loadRecords, loadFleetVehicles]);

  useEffect(() => {
    if (prefillName) {
      setNombre(prefillName);
      setCreating(true);
    }
    if (initialSearch) setSearch(initialSearch);
  }, [prefillName, initialSearch]);

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
        (r.folio ?? "").toLowerCase().includes(term) ||
        (displayVehiculoPurp ?? "").toLowerCase().includes(term) ||
        (r.descripcion_vehiculo ?? "").toLowerCase().includes(term)
      );
    });
  }, [records, search, vehicleNameById]);

  const formatDate = (value?: string) => {
    if (!value) return "—";
    return formatOdooDateTime(value);
  };


  const printTicket = (record: AccessRecord) => {
    const folio = record.folio?.trim();
    if (!folio) {
      toast.error("No se puede imprimir", {
        description: "Esta entrada aún no tiene folio generado por Odoo. Actualiza la lista e intenta de nuevo.",
      });
      return;
    }

    const title = record.nombre || "Entrada a Planta";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=0&data=${encodeURIComponent(folio)}`;
    const ticket = window.open("", "_blank", "width=420,height=640");
    if (!ticket) {
      toast.error("El navegador bloqueó la ventana de impresión");
      return;
    }

    ticket.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Ticket ${folio}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: 58mm auto; margin: 4mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, Helvetica, sans-serif;
              color: #111827;
              background: #ffffff;
              text-align: center;
            }
            .ticket {
              width: 100%;
              max-width: 58mm;
              margin: 0 auto;
              padding: 2mm 1mm;
            }
            .name {
              font-size: 18px;
              line-height: 1.08;
              font-weight: 800;
              margin: 0 0 4mm;
              word-break: break-word;
            }
            .folio {
              font-size: 15px;
              font-weight: 800;
              letter-spacing: .2px;
              margin: 0 0 6mm;
            }
            .folio span { font-weight: 500; }
            img {
              width: 42mm;
              height: 42mm;
              image-rendering: pixelated;
              display: block;
              margin: 0 auto 7mm;
            }
            .line {
              border-top: 1px dashed #9ca3af;
              margin: 0 0 3mm;
            }
            .footer {
              font-size: 13px;
              font-weight: 600;
              color: #374151;
            }
            @media print {
              body { margin: 0; }
              .ticket { max-width: none; }
            }
          </style>
        </head>
        <body>
          <main class="ticket">
            <h1 class="name">${escapeHtml(title)}</h1>
            <p class="folio">Folio: <span>${escapeHtml(folio)}</span></p>
            <img src="${qrUrl}" alt="QR ${escapeHtml(folio)}" />
            <div class="line"></div>
            <div class="footer">Entrada a Planta</div>
          </main>
          <script>
            const img = document.querySelector('img');
            const doPrint = () => setTimeout(() => { window.print(); }, 250);
            if (img && !img.complete) img.onload = doPrint; else doPrint();
          </script>
        </body>
      </html>
    `);
    ticket.document.close();
  };

  const escapeHtml = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

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
        employeeId: employee.id,
        accessEmployeeId: prefillEmployeeId,
        planta: activePlant,
      }, context);
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
    const updated = await registerAccessExit(id, employee.id, context);
    if (!updated) return;
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
    toast.success("Salida registrada");
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
          <CardHeader className="font-semibold">{prefillName ? "Registrar entrada de empleado" : "Registrar entrada manual"}</CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Nombre visitante o empleado..." className="h-12 text-base" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            {prefillName && (
              <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                Gafete detectado: {prefillName}.
              </div>
            )}
            <select className="h-12 w-full rounded-md bg-secondary px-3 text-base border border-border" value={vehiculo} onChange={(e) => setVehiculo(e.target.value as VehicleType)}>
              <option>Vehículo PURP</option>
              <option>Otro vehículo</option>
            </select>
            {vehiculo === "Vehículo PURP" ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    className="h-12 w-full rounded-md bg-secondary px-3 text-base border border-border disabled:opacity-60"
                    value={vehiculoPurp}
                    onChange={(e) => setVehiculoPurp(e.target.value)}
                    disabled={fleetLoading || fleetVehicles.length === 0}
                  >
                    {fleetLoading ? (
                      <option value="">Cargando vehículos...</option>
                    ) : fleetVehicles.length === 0 ? (
                      <option value="">No hay vehículos disponibles</option>
                    ) : (
                      fleetVehicles.map((v) => (
                        <option key={v.id} value={String(v.id)}>
                          {v.name}
                        </option>
                      ))
                    )}
                  </select>
                  <Button type="button" variant="secondary" size="icon" className="h-12 w-12 shrink-0" onClick={loadFleetVehicles} disabled={fleetLoading}>
                    {fleetLoading ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>

                {fleetError && (
                  <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{fleetError}</span>
                  </div>
                )}
              </div>
            ) : (
              <Input placeholder="Describe el vehículo..." className="h-12 text-base" value={descripcionVehiculo} onChange={(e) => setDescripcionVehiculo(e.target.value)} />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="secondary" size="lg" onClick={() => setCreating(false)}>Cancelar</Button>
              <Button size="lg" onClick={handleCreate} disabled={saving || (vehiculo === "Vehículo PURP" && (fleetLoading || fleetVehicles.length === 0))}>{saving ? <Spinner className="mr-2" /> : null}Registrar</Button>
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
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <span className="break-words text-lg font-bold">{record.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Car className="h-4 w-4" />
                      <span className="break-words">{record.vehiculo === "Vehículo PURP" ? (vehicleNameById.get(String(record.vehiculo_purp)) || record.vehiculo_purp) : record.descripcion_vehiculo}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {record.folio && <Badge variant="outline" className="w-fit">{record.folio}</Badge>}
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-9 w-9 rounded-full"
                        title="Imprimir ticket de entrada"
                        onClick={() => printTicket(record)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                    {record.planta && <Badge variant="outline" className="w-fit">{record.planta}</Badge>}
                    <Badge className={`w-fit ${ACCESS_STATUS_COLORS[record.estado]}`}>{ACCESS_STATUS_LABELS[record.estado]}</Badge>
                  </div>
                </div>

                <div className="grid gap-1 text-sm text-muted-foreground mb-3">
                  <span><Clock className="inline h-4 w-4 mr-1" /> Entrada: {formatDate(record.fecha_entrada)}</span>
                  <span><Clock className="inline h-4 w-4 mr-1" /> Salida: {formatDate(record.fecha_salida)}</span>
                  {record.operador_entrada && <span>Operador entrada: {record.operador_entrada}</span>}
                  {record.operador_salida && <span>Operador salida: {record.operador_salida}</span>}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    className="h-12"
                    variant="secondary"
                    onClick={() => setOpenChatterId((current) => current === record.id ? null : record.id)}
                  >
                    <MessageSquare className="mr-2 h-5 w-5" />
                    Conversación
                  </Button>

                  {record.estado === "en_planta" && (
                    <Button className="h-12" variant="secondary" onClick={() => handleExit(record.id)}>
                      <LogOut className="mr-2 h-5 w-5" /> Registrar salida
                    </Button>
                  )}
                </div>

                {openChatterId === record.id && (
                  <div className="mt-3">
                    <RecordChatter
                      recordType="access"
                      recordId={Number(record.id)}
                      context={context}
                      title={`Conversación de entrada ${record.folio || record.nombre}`}
                      compact
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

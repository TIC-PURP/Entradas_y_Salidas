"use client";

// Presenta la información de un viaje y los botones para cambiar su estado de entrada o salida.

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  EmployeeSession,
  Trip,
  TripStatus,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/types";
import {
  validateEntry,
  markInvalid,
  validateCorrection,
  registerExit,
} from "@/lib/api";
import {
  Truck,
  User,
  FileText,
  Building2,
  CheckCircle2,
  XCircle,
  LogOut,
  Clock,
  ArrowLeft,
} from "lucide-react";

interface TripCardProps {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
  onBack: () => void;
  employee: EmployeeSession;
}

// Tarjeta que resume un viaje y ofrece las acciones que caseta puede realizar.
export function TripCard({ trip, onUpdate, onBack, employee }: TripCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  // Ejecuta una acción del viaje, como validar entrada, pedir revisión o registrar salida.
  const handleAction = async (
    action: () => Promise<Trip | null>,
    actionName: string
  ) => {
    setLoading(actionName);
    try {
      const updatedTrip = await action();
      if (updatedTrip) {
        onUpdate(updatedTrip);
      }
    } catch {
      console.error("Error executing action:", actionName);
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const renderActions = () => {
    switch (trip.estado) {
      case "en_camino":
        return (
          <div className="flex flex-col gap-4">
            <Button
              size="lg"
              className="h-16 text-lg font-semibold bg-success hover:bg-success/90 text-success-foreground"
              onClick={() =>
                handleAction(() => validateEntry(trip.folio, employee.id), "validate")
              }
              disabled={loading !== null}
            >
              {loading === "validate" ? (
                <Spinner className="mr-2" />
              ) : (
                <CheckCircle2 className="mr-2 h-6 w-6" />
              )}
              Validar Entrada
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="h-16 text-lg font-semibold"
              onClick={() =>
                handleAction(() => markInvalid(trip.folio, employee.id), "invalid")
              }
              disabled={loading !== null}
            >
              {loading === "invalid" ? (
                <Spinner className="mr-2" />
              ) : (
                <XCircle className="mr-2 h-6 w-6" />
              )}
              Marcar Inválido
            </Button>
          </div>
        );

      case "en_revision":
        return (
          <Button
            size="lg"
            className="h-16 text-lg font-semibold w-full bg-warning hover:bg-warning/90 text-warning-foreground"
            onClick={() =>
              handleAction(() => validateCorrection(trip.folio), "correction")
            }
            disabled={loading !== null}
          >
            {loading === "correction" ? (
              <Spinner className="mr-2" />
            ) : (
              <CheckCircle2 className="mr-2 h-6 w-6" />
            )}
            Validar Corrección
          </Button>
        );

      case "en_espera":
        return (
          <div className="flex items-center justify-center gap-3 p-6 bg-accent/20 rounded-lg border border-accent/30">
            <Clock className="h-8 w-8 text-accent" />
            <span className="text-lg font-medium text-accent">
              Camión autorizado, pendiente de carga
            </span>
          </div>
        );

      case "en_proceso":
        return (
          <Button
            size="lg"
            className="h-16 text-lg font-semibold w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() =>
              handleAction(() => registerExit(trip.folio, employee.id), "exit")
            }
            disabled={loading !== null}
          >
            {loading === "exit" ? (
              <Spinner className="mr-2" />
            ) : (
              <LogOut className="mr-2 h-6 w-6" />
            )}
            Registrar Salida
          </Button>
        );

      case "finalizado":
        return (
          <div className="flex items-center justify-center gap-3 p-6 bg-muted rounded-lg border border-border">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            <span className="text-lg font-medium text-muted-foreground">
              Viaje finalizado
            </span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Button
        variant="ghost"
        size="lg"
        className="self-start mb-4 text-muted-foreground hover:text-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="mr-2 h-5 w-5" />
        Volver a escanear
      </Button>

      <Card className="flex-1 border-2 border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">
                Folio
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                {trip.folio}
              </h2>
            </div>
            <Badge
              className={`text-sm px-4 py-2 ${STATUS_COLORS[trip.estado]}`}
            >
              {STATUS_LABELS[trip.estado]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <InfoRow
              icon={<FileText className="h-5 w-5" />}
              label="Orden de Venta"
              value={trip.orden}
            />
            <InfoRow
              icon={<User className="h-5 w-5" />}
              label="Chofer"
              value={trip.chofer}
            />
            <InfoRow
              icon={<Truck className="h-5 w-5" />}
              label="Placas"
              value={trip.placas}
            />
            <InfoRow
              icon={<Building2 className="h-5 w-5" />}
              label="Línea Fletera"
              value={trip.linea_fletera}
            />
          </div>

          {(trip.fecha_entrada || trip.fecha_salida) && (
            <div className="pt-4 border-t border-border">
              <div className="grid gap-3">
                {trip.fecha_entrada && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      Fecha de entrada:
                    </span>
                    <span className="font-medium">
                      {formatDate(trip.fecha_entrada)}
                    </span>
                  </div>
                )}
                {trip.fecha_salida && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      Fecha de salida:
                    </span>
                    <span className="font-medium">
                      {formatDate(trip.fecha_salida)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {(trip.operador_entrada || trip.operador_salida) && (
            <div className="pt-4 border-t border-border">
              <div className="grid gap-3 text-sm">
                {trip.operador_entrada && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Operador entrada:</span>
                    <span className="font-medium text-right">{trip.operador_entrada}</span>
                  </div>
                )}
                {trip.operador_salida && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Operador salida:</span>
                    <span className="font-medium text-right">{trip.operador_salida}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-4">{renderActions()}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="text-lg font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

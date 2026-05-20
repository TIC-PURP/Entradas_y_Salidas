"use client";

// Muestra la cámara para leer códigos QR o de barras y avisar cuando se detecta un viaje.

import { useEffect, useRef, useState } from "react";
import { Scanner as QRScanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ScanLine, Camera, AlertCircle, List } from "lucide-react";

interface ScannerProps {
  onScan: (code: string) => void;
  onManualMode: () => void;
  isLoading: boolean;
}

// Componente que guía al guardia para usar la cámara y leer un código.
export function Scanner({ onScan, onManualMode, isLoading }: ScannerProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scanLockedRef = useRef(false);

  useEffect(() => {
    if (!isLoading) scanLockedRef.current = false;
  }, [isLoading]);

  // Toma el primer código detectado y lo entrega a la pantalla principal.
  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (isLoading || scanLockedRef.current) return;

    const code = detectedCodes[0]?.rawValue?.trim();
    if (!code) return;

    scanLockedRef.current = true;
    onScan(code);
  };

  // Si la cámara falla, muestra un mensaje simple para que el usuario sepa qué hacer.
  const handleError = (err: unknown) => {
    console.error("Scanner error:", err);

    setCameraError(
      "No se pudo acceder a la cámara. Revisa permisos del navegador o usa HTTPS si entras por IP."
    );
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-4 sm:gap-6">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Entradas y Salidas
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Escanea el código QR o de barras del camión
        </p>
      </div>

      <Card className="relative min-h-[320px] flex-1 overflow-hidden border-2 border-border bg-card sm:min-h-[420px] lg:min-h-[520px]">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card z-10">
            <Spinner className="h-12 w-12 mb-4 text-primary" />
            <p className="text-lg font-medium">Buscando información...</p>
          </div>
        ) : cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <p className="text-lg font-medium mb-2">Cámara no disponible</p>
            <p className="text-muted-foreground mb-6">{cameraError}</p>

            <Button onClick={() => setCameraError(null)}>
              Reintentar cámara
            </Button>
          </div>
        ) : (
          <>
            <div className="absolute inset-0">
              <QRScanner
                onScan={handleScan}
                onError={handleError}
                constraints={{
                  facingMode: "environment",
                }}
                styles={{
                  container: {
                    width: "100%",
                    height: "100%",
                  },
                  video: {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  },
                }}
                components={{
                  torch: true,
                }}
              />
            </div>

            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/40" />

              <div className="absolute inset-6 rounded-lg border-2 border-primary/50 sm:inset-8 lg:inset-12">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />

                <div className="absolute left-2 right-2 h-0.5 bg-primary/80 scan-line shadow-[0_0_10px_2px] shadow-primary/50" />
              </div>
            </div>

            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 backdrop-blur-sm sm:left-4 sm:top-4">
              <Camera className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Cámara activa</span>
            </div>
          </>
        )}
      </Card>

      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <ScanLine className="h-5 w-5" />
          <span className="text-sm">Apunta al código QR o de barras</span>
        </div>

        <Button
          variant="secondary"
          size="lg"
          className="h-14 text-base sm:text-lg"
          onClick={onManualMode}
        >
          <List className="mr-2 h-5 w-5" />
          Modo Manual
        </Button>
      </div>
    </div>
  );
}

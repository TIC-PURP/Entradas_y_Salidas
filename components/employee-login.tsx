"use client";

import { useEffect, useRef, useState } from "react";
import { Scanner as QRScanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { BadgeCheck, Camera, IdCard, LogIn, ScanLine, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { EmployeeSession } from "@/lib/types";
import { employeeLogin } from "@/lib/api";

interface EmployeeLoginProps {
  onLogin: (employee: EmployeeSession) => void;
}

const STORAGE_KEY = "purp_pwa_employee";

export function getStoredEmployee(): EmployeeSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as EmployeeSession) : null;
  } catch {
    return null;
  }
}

export function storeEmployee(employee: EmployeeSession) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(employee));
}

export function clearStoredEmployee() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function EmployeeLogin({ onLogin }: EmployeeLoginProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scanLockedRef = useRef(false);

  useEffect(() => {
    const employee = getStoredEmployee();
    if (employee?.id) onLogin(employee);
  }, [onLogin]);

  const submit = async (overrideCode?: string) => {
    const clean = (overrideCode ?? code).trim();
    if (!clean) {
      toast.error("Escanea o captura el RFID/NIP del empleado.");
      return;
    }

    setLoading(true);
    try {
      const employee = await employeeLogin(clean);
      storeEmployee(employee);
      onLogin(employee);
      toast.success(`Sesión iniciada: ${employee.name}`);
    } catch (error) {
      toast.error("No se pudo iniciar sesión", {
        description: error instanceof Error ? error.message : "Verifica el código del empleado.",
      });
    } finally {
      setLoading(false);
      scanLockedRef.current = false;
    }
  };

  const handleCameraScan = (detectedCodes: IDetectedBarcode[]) => {
    if (loading || scanLockedRef.current) return;

    const scannedCode = detectedCodes[0]?.rawValue?.trim();
    if (!scannedCode) return;

    scanLockedRef.current = true;
    setCode(scannedCode);
    setScannerOpen(false);
    setScannerError(null);
    void submit(scannedCode);
  };

  const handleCameraError = (error: unknown) => {
    console.error("Employee badge scanner error:", error);
    setScannerError(
      "No se pudo abrir la cámara. Revisa permisos del navegador. Si entras por IP, usa HTTPS."
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-2 border-border bg-card">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <IdCard className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Acceso de operador</h1>
          <p className="text-muted-foreground">
            Escanea el gafete del empleado o captura su NIP.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <ScanLine className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder="Escanea RFID o captura NIP"
              className="h-14 pl-12 pr-14 text-lg"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              disabled={loading}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2"
              onClick={() => {
                setScannerError(null);
                setScannerOpen(true);
              }}
              disabled={loading}
              aria-label="Escanear gafete con cámara"
              title="Escanear gafete con cámara"
            >
              <Camera className="h-5 w-5" />
            </Button>
          </div>

          <Button size="lg" className="h-14 w-full text-lg" onClick={() => submit()} disabled={loading}>
            {loading ? <Spinner className="mr-2" /> : <LogIn className="mr-2 h-5 w-5" />}
            Iniciar sesión
          </Button>
        </CardContent>
      </Card>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden" showCloseButton={false}>
          <DialogHeader className="px-5 pt-5 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>Escanear gafete</DialogTitle>
                <DialogDescription>
                  Apunta la cámara al QR o código de barras del empleado.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setScannerOpen(false)}
                aria-label="Cerrar scanner"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="px-5 pb-5">
            <div className="relative h-80 overflow-hidden rounded-xl border bg-black">
              <QRScanner
                onScan={handleCameraScan}
                onError={handleCameraError}
                constraints={{ facingMode: "environment" }}
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

              <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/70" />
            </div>

            {scannerError ? (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {scannerError}
              </div>
            ) : (
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Al detectar el gafete, la sesión iniciará automáticamente.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

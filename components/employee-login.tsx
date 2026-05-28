"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { Camera, IdCard, KeyRound, LogIn, ScanLine, User, X } from "lucide-react";
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
import type { AppSession, EmployeeSession, OdooLoginResult } from "@/lib/types";
import { employeePermissionLogin, odooUserLogin, refreshAppSession } from "@/lib/api";

const QRScanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((module) => module.Scanner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Activando camara...
      </div>
    ),
  },
);

interface EmployeeLoginProps {
  onLogin: (session: AppSession) => void;
}

const STORAGE_KEY = "purp_pwa_session";
const LEGACY_EMPLOYEE_KEY = "purp_pwa_employee";
const SESSION_VERSION = "guard-permissions-v2";
const THEME_KEY = "purp_pwa_theme";

export function getStoredSession(): AppSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as AppSession;
    return session.sessionVersion === SESSION_VERSION ? session : null;
  } catch {
    return null;
  }
}

export function storeSession(session: AppSession) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.localStorage.removeItem(LEGACY_EMPLOYEE_KEY);
}

export function clearStoredSession() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_EMPLOYEE_KEY);
}

export function getStoredTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  const value = window.localStorage.getItem(THEME_KEY);
  return value === "light" ? "light" : "dark";
}

export function storeTheme(theme: "dark" | "light") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// Compatibilidad con versiones anteriores del proyecto.
export const getStoredEmployee = getStoredSession;
export const storeEmployee = storeSession;
export const clearStoredEmployee = clearStoredSession;

export function EmployeeLogin({ onLogin }: EmployeeLoginProps) {
  const [step, setStep] = useState<"odoo" | "employee">("odoo");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [odooResult, setOdooResult] = useState<OdooLoginResult | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scanLockedRef = useRef(false);

  useEffect(() => {
    const storedTheme = getStoredTheme();
    document.documentElement.classList.toggle("dark", storedTheme === "dark");

    const session = getStoredSession();
    if (!session?.odooUser?.uid) return;

    let cancelled = false;
    setLoading(true);
    refreshAppSession({ ...session, theme: storedTheme })
      .then((freshSession) => {
        if (cancelled) return;
        const nextSession = {
          ...freshSession,
          theme: storedTheme,
          sessionVersion: SESSION_VERSION,
        };
        storeSession(nextSession);
        onLogin(nextSession);
      })
      .catch((error) => {
        if (cancelled) return;
        clearStoredSession();
        toast.error("La sesión local ya no es válida", {
          description: error instanceof Error ? error.message : "Vuelve a iniciar sesión.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onLogin]);

  const finishLogin = (result: OdooLoginResult, employee?: EmployeeSession | null, permissionsOverride?: OdooLoginResult["permissions"]) => {
    const effectivePermissions = permissionsOverride || result.permissions;
    const effectiveEmployee = employee || effectivePermissions.empleado || result.permissions.empleado || null;
    const session: AppSession = {
      odooUser: result.user,
      permissions: effectivePermissions,
      employee: effectiveEmployee,
      activePlant: effectivePermissions.planta_predeterminada || effectiveEmployee?.work_location || "",
      theme: getStoredTheme(),
      sessionVersion: SESSION_VERSION,
    };
    storeSession(session);
    onLogin(session);
    toast.success(`Sesión iniciada: ${result.user.name}`);
  };

  const submitOdoo = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Captura usuario y contraseña de Odoo.");
      return;
    }

    setLoading(true);
    try {
      const result = await odooUserLogin(username.trim(), password);
      setOdooResult(result);

      if (result.permissions.requiere_gafete) {
        setStep("employee");
        toast.info("Identifica al empleado operativo", {
          description: "Escanea el gafete o captura el NIP del guardia.",
        });
      } else {
        finishLogin(result, result.permissions.empleado || null);
      }
    } catch (error) {
      toast.error("No se pudo iniciar sesión en Odoo", {
        description: error instanceof Error ? error.message : "Verifica usuario, contraseña y permisos PWA.",
      });
    } finally {
      setLoading(false);
    }
  };

  const submitEmployee = async (overrideCode?: string) => {
    const clean = (overrideCode ?? code).trim();
    if (!clean) {
      toast.error("Escanea o captura el RFID/NIP del empleado.");
      return;
    }
    if (!odooResult) {
      toast.error("Primero inicia sesión con usuario Odoo.");
      setStep("odoo");
      return;
    }

    setLoading(true);
    try {
      const result = await employeePermissionLogin(clean, odooResult.user.uid);
      finishLogin(odooResult, result.employee, result.permissions);
    } catch (error) {
      toast.error("No se pudo identificar al empleado", {
        description: error instanceof Error ? error.message : "Verifica el gafete/NIP.",
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
    void submitEmployee(scannedCode);
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
            {step === "odoo" ? <User className="h-8 w-8 text-primary" /> : <IdCard className="h-8 w-8 text-primary" />}
          </div>
          <h1 className="text-2xl font-bold">{step === "odoo" ? "PURP" : "Identificar operador"}</h1>
          <p className="text-muted-foreground">
            {step === "odoo"
              ? "Inicia sesión con tus credenciales de Odoo."
              : "Escanea el gafete del empleado o captura su NIP."}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {step === "odoo" ? (
            <>
              <div className="relative">
                <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  type="text"
                  autoComplete="username"
                  placeholder="Usuario Odoo"
                  className="h-14 pl-12 text-lg"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitOdoo();
                  }}
                  disabled={loading}
                />
              </div>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Contraseña Odoo"
                  className="h-14 pl-12 text-lg"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitOdoo();
                  }}
                  disabled={loading}
                />
              </div>
              <Button size="lg" className="h-14 w-full text-lg" onClick={submitOdoo} disabled={loading}>
                {loading ? <Spinner className="mr-2" /> : <LogIn className="mr-2 h-5 w-5" />}
                Iniciar sesión
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-lg border bg-secondary/50 p-3 text-sm text-muted-foreground">
                Usuario Odoo: <span className="font-medium text-foreground">{odooResult?.user.name}</span>
              </div>
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
                    if (event.key === "Enter") void submitEmployee();
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

              <Button size="lg" className="h-14 w-full text-lg" onClick={() => submitEmployee()} disabled={loading}>
                {loading ? <Spinner className="mr-2" /> : <LogIn className="mr-2 h-5 w-5" />}
                Entrar como operador
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => setStep("odoo")} disabled={loading}>
                Cambiar usuario Odoo
              </Button>
            </>
          )}
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

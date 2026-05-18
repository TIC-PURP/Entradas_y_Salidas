import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Entradas y Salidas",
  description:
    "PWA de entradas y salidas para validación de entrada y salida",
  generator: "Next.js",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Entradas y Salidas",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: "/icons/purp-icon.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icons/purp-icon.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/icons/Espiga.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1a1a2e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="bg-background">
      <body className="font-sans antialiased">{children}
      {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}

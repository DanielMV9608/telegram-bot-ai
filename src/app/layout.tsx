import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bot Autónomo Telegram - Plataforma de Gestión",
  description: "Plataforma para conectar y gestionar bots de Telegram con IA. Captura leads automáticamente y gestiona clientes sin escribir código.",
  keywords: ["Telegram Bot", "IA", "Automatización", "Leads", "Atención al Cliente", "Chatbot"],
  authors: [{ name: "Built by GLM" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Bot Autónomo Telegram",
    description: "Conecta tu bot de Telegram con IA y captura leads automáticamente",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

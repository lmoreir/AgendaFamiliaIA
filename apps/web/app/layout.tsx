import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Agenda da Familia IA",
    template: "%s | Agenda da Familia IA",
  },
  description: "Organize as atividades dos seus filhos com ajuda de inteligencia artificial. Lembretes automaticos via WhatsApp.",
  keywords: ["agenda familia", "atividades filhos", "lembretes", "whatsapp"],
  authors: [{ name: "Agenda da Familia IA" }],
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 antialiased">
        {children}
      </body>
    </html>
  );
}

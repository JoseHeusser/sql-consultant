import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/app/lib/i18n";

export const metadata: Metadata = {
  title: "Berlin Trees · SQL Consultant — NL → PostgreSQL",
  description: "Ask Berlin's official tree cadaster of 962,000 trees in natural language (English or German). Claude generates PostgreSQL, runs it on Supabase + PostGIS, plots results on a map and interprets them.",
  openGraph: {
    title: "Berlin Trees · SQL Consultant",
    description: "Natural-language consultant over Berlin's tree cadaster.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}

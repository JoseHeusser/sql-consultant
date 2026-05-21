import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SQL Consultant — Berlin commercial real estate · NL → SQL",
  description: "Ask questions in natural language about a database of 5,000 Berlin commercial properties. AI translates to SQL, runs in your browser, interprets the results.",
  openGraph: {
    title: "SQL Consultant — Berlin commercial real estate",
    description: "Natural-language consultant over a SQLite database, browser-side, with AI interpretation.",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}

"use client";

import "./globals.css";

export const metadata = {
  title: "Lurk",
  description: "A lightweight, fast, open video board.",
};

export default function RootLayout({ children }) {
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

  return (
    <html lang="en" data-api-base={apiBase}>
      <body>{children}</body>
    </html>
  );
}

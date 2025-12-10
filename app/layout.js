// ❌ DO NOT PUT "use client" HERE

import "./globals.css";

export const metadata = {
  title: "Lurk",
  description: "A lightweight, fast, open video board.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

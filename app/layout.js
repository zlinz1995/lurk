// ----------------------------------------
// Global Metadata
// ----------------------------------------
export const metadata = {
  title: "Lurk",
  description: "A lightweight, fast, open video board.",
};

// ----------------------------------------
// Imports
// ----------------------------------------
import ChatWidget from "./components/chat/ChatWidget";
import NavMenu from "./components/NavMenu";
import "../public/styles.css";

// ----------------------------------------
// Root Layout — MUST be a Server Component
// ----------------------------------------
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png" />
      </head>

      <body>
        <NavMenu />
        {/* Page Content */}
        {children}

        {/* Floating Chat Widget */}
        <ChatWidget />

        {/* Load main.js (WebSocket, threads, chimes, etc.) ONLY ONCE */}
      </body>
    </html>
  );
}

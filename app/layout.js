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
import MainScriptLoader from "./components/MainScriptLoader";
import "../public/styles.css";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

// ----------------------------------------
// Root Layout — MUST be a Server Component
// ----------------------------------------
export default function RootLayout({ children }) {
  return (
    <html lang="en" data-api-base={API_BASE}>
      <head>
        <link rel="icon" href="/favicon.png" />
      </head>

      <body data-api-base={API_BASE}>
        <NavMenu />
        <MainScriptLoader />
        {/* Page Content */}
        {children}

        {/* Floating Chat Widget */}
        <ChatWidget />
      </body>
    </html>
  );
}

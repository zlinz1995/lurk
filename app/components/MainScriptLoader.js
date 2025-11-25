"use client";

import { useEffect } from "react";

export default function MainScriptLoader() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__lurkMainInjected) return;
    const existing = document.querySelector("script[data-lurk-main]");
    if (existing) {
      window.__lurkMainInjected = true;
      return;
    }
    const script = document.createElement("script");
    script.src = "/main.js";
    script.async = true;
    script.dataset.lurkMain = "true";
    script.addEventListener(
      "load",
      () => {
        window.__lurkMainInjected = true;
      },
      { once: true }
    );
    document.body.appendChild(script);
  }, []);

  return null;
}

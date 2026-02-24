"use client";

import { useEffect, useState } from "react";
import PlayablesClient from "../[id]/playables-client.jsx";

function getPlayableIdFromQuery() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || "";
}

export default function PlayablePlayPage() {
  const [id, setId] = useState("");

  useEffect(() => {
    const sync = () => setId(getPlayableIdFromQuery());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return <PlayablesClient id={id} />;
}

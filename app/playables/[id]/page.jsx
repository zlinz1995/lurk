import fs from "fs";
import path from "path";
import PlayablesClient from "./playables-client.jsx";

export function generateStaticParams() {
  const manifestPath = path.join(
    process.cwd(),
    "public",
    "playables",
    "manifest.json"
  );
  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const data = JSON.parse(raw);
    const games = Array.isArray(data?.games) ? data.games : [];
    return games
      .map((game) => game?.id)
      .filter(Boolean)
      .map((id) => ({ id: String(id) }));
  } catch {
    return [];
  }
}

export default function PlayablePage({ params }) {
  return <PlayablesClient id={params?.id || ""} />;
}

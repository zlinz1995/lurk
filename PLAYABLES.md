# Lurk Playables SDK

This repo includes a lightweight Playables SDK for embedding HTML5 games inside Lurk.

## Files
- `public/playables/sdk.js` — the runtime SDK loaded by games.
- `public/playables/manifest.json` — catalog of playable games.
- `public/playables-assets/<game-id>/` — each game lives in its own folder.

## Add A New Game
1. Create a new folder in `public/playables-assets/<game-id>/`.
2. Add an `index.html`, `style.css`, and any JS assets you need.
3. Load the SDK with `<script src="/playables/sdk.js"></script>` before your game script.
4. Register the game in `public/playables/manifest.json`.
5. Run `npm run build` to export the static pages.

## SDK Events
The SDK is a small wrapper around `postMessage`. The parent player sends control
messages and the game sends state updates.

### Game -> Host
Use the SDK inside your game:
```
LurkPlayables.init({ id: "my-game", title: "My Game", version: "1.0.0" });
LurkPlayables.ready();
LurkPlayables.start();
LurkPlayables.score({ player: 1, cpu: 0 });
LurkPlayables.gameOver({ winner: "player" });
LurkPlayables.event("level_up", { level: 2 });
```

### Host -> Game
Listen for host events inside your game:
```
LurkPlayables.on("pause", () => pauseGame());
LurkPlayables.on("resume", () => resumeGame());
LurkPlayables.on("mute", () => muteAudio());
LurkPlayables.on("unmute", () => unmuteAudio());
```

## Notes
- Games are served from `public/playables-assets/`, so they must be fully static.
- The Playables player UI is implemented in `app/playables/[id]/`.

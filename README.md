# MC Server Manager

A local desktop app for managing Minecraft servers — built with Electron, React, and TypeScript.

![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)

---

## Features

### Server Management
- **Setup Wizard** — download and install Vanilla or Fabric servers directly from official sources (Mojang / FabricMC)
- **Multi-server support** — manage multiple servers from a single sidebar, switch between them instantly
- **Start / Stop / Restart** — full lifecycle control with one click
- **Live console** — real-time server output with color-coded log levels, command history (↑↓), and auto-scroll

### Mod Manager *(Fabric only)*
- Browse mods from [Modrinth](https://modrinth.com) — only mods compatible with your server's Minecraft version and the Fabric loader are shown
- Install mods with a single click — downloaded directly into the server's `mods/` folder with a live progress bar
- View and remove installed mods from the Installed tab

### Settings
- Configure server properties (`server.properties`) from a UI — no manual file editing
- Adjust RAM allocation per server
- Whitelist management — add/remove players by username (UUID resolved automatically via Mojang API)

### Player Directory
- See all players who have ever joined the server
- Detailed player profiles: coordinates, dimension, XP, health, hunger, gamemode, active effects
- Inventory and Ender Chest item viewer
- Player stats: distance walked/flown/swum, blocks mined, kills, deaths, diamonds mined
- Achievement timeline
- Filtered log history per player

### Performance Monitor
- Live CPU and RAM usage of the server process
- Updates every 2 seconds while the server is running

---

## Requirements

- [Node.js](https://nodejs.org) 18+
- [Java](https://adoptium.net) 17+ (required to run the Minecraft server)
- Windows (tested on Windows 11)

---

## Getting Started

```bash
# Install dependencies
npm install

# Start in development mode (hot reload)
npm run dev

# Build for production
npm run build

# Package as a standalone Windows app
npm run package
```

The packaged app is output to `release/`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 42 |
| UI | React 19 + TypeScript 6 |
| Styling | Tailwind CSS 4 |
| Build | Vite 8 + Rolldown |
| NBT parsing | prismarine-nbt |
| Process stats | pidusage |

---

## Project Structure

```
electron/
  main.js       — Electron main process, all IPC handlers
  preload.js    — Context bridge exposing APIs to the renderer
src/
  App.tsx       — Root component, routing between views
  global.d.ts   — TypeScript declarations for window.api
  components/
    SetupWizard.tsx    — Server installation flow
    Dashboard.tsx      — Main server control panel
    ModManager.tsx     — Modrinth mod browser (Fabric servers)
    SettingsPage.tsx   — Server properties + RAM + whitelist
    PlayerDirectory.tsx — Player list
    PlayerProfile.tsx  — Detailed player stats + inventory
    Sidebar.tsx        — Multi-server navigation
```

---

## License

MIT

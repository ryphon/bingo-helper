# OSRS Bingo Tracker

Web app for tracking OSRS clan bingo progress.

## Quick Start

```bash
docker-compose up -d
```

Access at http://localhost:8080

## Features

- Multi-item tile tracking
- Individual item progress counts
- OSRS Wiki integration (click item names)
- Export/import boards (JSON)
- LocalStorage persistence (state survives browser refresh)
- Responsive grid layout

## State Persistence

State is stored in browser's localStorage - persists across:
- Browser refresh
- Container restart
- System reboot

Clear browser data = lose state (export first!)

## Manual Build

```bash
docker build -t bingo-helper .
docker run -p 8080:80 bingo-helper
```

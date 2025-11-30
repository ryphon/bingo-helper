# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OSRS (Old School RuneScape) Bingo Tracker - A web application for tracking clan bingo progress with multi-item tiles, progress counts, and OSRS Wiki integration. Built as a static single-page application using vanilla JavaScript with localStorage persistence.

## Development Commands

### Local Development (Docker)
```bash
# Quick start - runs on http://localhost:8080
docker-compose up -d

# Manual build and run
docker build -t bingo-helper .
docker run -p 8080:80 bingo-helper
```

### Kubernetes Deployment

**Build and deploy:**
```bash
# Build image
docker build -t bingo-helper:latest .

# Deploy all resources
kubectl apply -f k8s/

# Or deploy individually
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/middleware.yaml
kubectl apply -f k8s/ingressroute.yaml
```

**Testing deployment:**
```bash
# Port forward for local testing
kubectl port-forward service/bingo-helper 8080:80

# Check deployment status
kubectl get deployments
kubectl get pods
kubectl get services

# View logs
kubectl logs -l app=bingo-helper
```

**Scaling:**
```bash
kubectl scale deployment bingo-helper --replicas=3
```

**Cleanup:**
```bash
kubectl delete -f k8s/
```

## Architecture

### Application Structure

The application is a client-side-only SPA with no backend:

- **index.html** - Main HTML structure with bingo grid, stats display, tile creation form, and modal
- **script.js** - Single `BingoTracker` class managing all application logic
- **style.css** - Styling with OSRS/RuneScape theme (see k8s deployment notes)
- **Dockerfile** - nginx:alpine serving static files on port 80

### Key Technical Details

**State Management:**
- All state stored in browser localStorage (`bingoTiles` key)
- State persists across browser refresh and container restarts
- No server-side storage - clearing browser data loses progress
- Export/import via JSON for backup/sharing

**Data Model:**
```javascript
{
  id: string,           // Unique tile ID
  name: string,         // Tile name
  description: string,  // Optional description
  notes: string,        // Optional notes with markdown link support
  orLogic: boolean,     // true = ANY item completes tile, false = ALL items required
  completed: boolean,   // Auto-calculated based on item progress
  items: [{
    name: string,       // Item name
    quantity: number,   // Required quantity
    current: number,    // Current progress
    source: string      // Optional source label
  }]
}
```

**BingoTracker Class:**
- Constructor initializes from localStorage, loads OSRS item database from runescape.wiki API
- `renderGrid()` - Main render function, handles drag-and-drop tile reordering
- `calculateTileProgress()` - Computes progress % based on orLogic (AND vs OR)
- `updateTileCompletion()` - Auto-updates tile.completed flag when items change
- Autocomplete uses OSRS item database from `https://prices.runescape.wiki/api/v1/osrs/mapping`

**Item Wiki Integration:**
- Item names link to OSRS Wiki: `https://oldschool.runescape.wiki/w/{item_name}`
- Item icons loaded from: `https://oldschool.runescape.wiki/images/{item_name}.png`
- Links open in new tab and stop click propagation

**Drag and Drop:**
- Tiles are draggable for reordering
- Uses HTML5 drag and drop API with visual feedback
- Order persisted to localStorage

### Deployment Architecture

**Docker:**
- nginx:alpine base image
- Static files served from `/usr/share/nginx/html/`
- No environment variables or configuration needed

**Kubernetes (Production):**
- 2 replicas by default in k8s/deployment.yaml
- Uses Traefik IngressRoute (not standard Ingress) for routing
- ClusterIP service on port 80
- Middleware for HTTPS redirect available in k8s/middleware.yaml
- Resource limits: 128Mi memory, 100m CPU
- Health checks on `/` endpoint

**Important K8s Notes:**
- This deployment uses Traefik-specific resources (IngressRoute, Middleware)
- For external access, edit `k8s/ingressroute.yaml` to set your domain
- If using HTTPS, uncomment TLS IngressRoute section and configure cert resolver
- Alternative: Change service to LoadBalancer type in k8s/service.yaml

## Important Implementation Patterns

**Tile Editing:**
- Editing preserves item progress (current counts) by matching indices
- Edit mode populates form and sets `editingTileId`
- Form submit updates existing tile or creates new based on `editingTileId`

**Event Propagation:**
- Inline buttons use `onclick="event.stopPropagation()"` in HTML
- Wiki links also stop propagation to prevent tile modal opening
- Delete/edit buttons manually call `e.stopPropagation()` in listeners

**Progress Calculation:**
- OR logic: any single item at quantity = 100%, else shows best progress
- AND logic: average of all item progress percentages
- Completion auto-updates when item counts change

**Form Management:**
- Dynamic item inputs with add/remove functionality
- Autocomplete requires min 2 characters, shows top 10 matches
- Remove button disabled when only one item remains

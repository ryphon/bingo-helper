# Session Sharing - OSRS Bingo Helper

## Overview

The OSRS Bingo Helper now supports **team-based session sharing** with optional password protection. This allows multiple players to work together on the same bingo card in real-time, perfect for team competitions and collaborative gameplay.

## Features

- **Shareable Session Codes** - Generate unique session codes (e.g., `OSRS-A3F9K2`)
- **Real-time Sync** - All team members see updates automatically
- **Optional Password Protection** - Claim ownership of a session anytime
- **Offline Fallback** - Continues working without backend connectivity
- **Local Backup** - All data is backed up to localStorage
- **No Forced Sign-up** - Use anonymously or protect with password

## Quick Start

### Creating a Shared Session

1. Open the OSRS Bingo Helper
2. Click **"Create Shared Session"** button
3. Share the generated session code (e.g., `OSRS-A3F9K2`) with your team
4. Your current tiles will be uploaded to the shared session

### Joining a Shared Session

1. Click **"Join Session"** button
2. Enter the session code provided by your team
3. If password protected, enter the password
4. Start tracking progress together!

### Protecting a Session with Password

1. While in a shared session, click **"Protect with Password"**
2. Enter and confirm a password
3. Once protected, all saves require the password
4. **Note:** Sessions can only be claimed once - first person to set a password owns it

### Leaving a Session

1. Click **"Leave Session"** button
2. Your tiles will be saved to local storage
3. You can rejoin later or create a new session

## How It Works

### Architecture

```
┌─────────────┐         ┌──────────────┐         ┌────────────────┐
│   Browser   │◄───────►│  Backend API │◄───────►│   PostgreSQL   │
│  (Frontend) │         │  (Node.js)   │         │   (Database)   │
└─────────────┘         └──────────────┘         └────────────────┘
   localStorage           REST API Endpoints       Session Storage
```

### Data Flow

1. **Create Session**
   - Frontend sends current tiles to backend
   - Backend generates unique session code
   - Session stored in PostgreSQL
   - Code returned to frontend

2. **Join Session**
   - Frontend requests session by code
   - Backend retrieves tiles from database
   - Tiles loaded into frontend
   - Session code saved to localStorage

3. **Update Progress**
   - User marks item as complete
   - Frontend saves to localStorage (instant)
   - Frontend syncs to backend (async)
   - Other users fetch updates when they reload

4. **Offline Mode**
   - If backend unavailable, uses localStorage
   - Data syncs when backend comes back online

## Deployment

### Docker Compose (Development)

```bash
# Build and start all services
docker-compose up -d

# Services:
# - Frontend (Nginx): http://localhost:8080
# - Backend API: http://localhost:3000
# - PostgreSQL: localhost:5432
```

### Kubernetes (Production)

```bash
# Apply PostgreSQL StatefulSet
kubectl apply -f k8s/postgres-statefulset.yaml

# Apply backend deployment
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# Apply ingress routes
kubectl apply -f k8s/backend-ingressroute.yaml

# Verify deployment
kubectl get pods
kubectl get services
kubectl get statefulsets
```

## API Endpoints

### Create Session
```http
POST /api/session/create
Content-Type: application/json

{
  "tiles": [...]
}

Response:
{
  "success": true,
  "sessionCode": "OSRS-A3F9K2",
  "createdAt": "2025-11-30T12:00:00Z"
}
```

### Load Session
```http
GET /api/session/:code

Response:
{
  "success": true,
  "sessionCode": "OSRS-A3F9K2",
  "isProtected": false,
  "tiles": [...]
}
```

### Save Progress
```http
POST /api/session/:code/save
Content-Type: application/json

{
  "tiles": [...],
  "password": "optional_if_protected"
}

Response:
{
  "success": true,
  "message": "Session saved successfully"
}
```

### Claim Session (Protect with Password)
```http
POST /api/session/:code/claim
Content-Type: application/json

{
  "password": "your_password"
}

Response:
{
  "success": true,
  "message": "Password protection enabled"
}
```

## Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    session_code VARCHAR(12) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- NULL = unprotected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tiles Table
```sql
CREATE TABLE tiles (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    tile_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    notes TEXT,
    or_logic BOOLEAN DEFAULT FALSE,
    completed BOOLEAN DEFAULT FALSE,
    position INTEGER DEFAULT 0
);
```

### Items Table
```sql
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    tile_id INTEGER REFERENCES tiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    current INTEGER DEFAULT 0,
    source VARCHAR(255),
    position INTEGER DEFAULT 0
);
```

## Security Considerations

### Password Protection
- Passwords are hashed using bcrypt (salt rounds: 10)
- Never stored in plaintext
- Required for all save operations on protected sessions

### Session Code Format
- Format: `OSRS-XXXXXX` (6 alphanumeric characters)
- Excludes similar-looking characters (0, O, I, 1, l)
- ~2 billion possible combinations

### Best Practices
1. **Share session codes securely** - Don't post publicly unless you want anyone to join
2. **Claim sessions early** - First person to set password controls it
3. **Use strong passwords** - Minimum 4 characters, but longer is better
4. **Backup regularly** - Use Export feature to save JSON backups

## Troubleshooting

### "Failed to load session"
- Check that backend is running: `http://localhost:3000/health`
- Verify session code is correct (format: `OSRS-XXXXXX`)
- Check browser console for detailed errors

### "Password required"
- Session is password protected
- Ask the person who created the session for the password
- If you set the password and forgot it, the session cannot be recovered

### "Failed to sync with server"
- Backend is offline or unreachable
- Data is still saved to localStorage
- Will auto-sync when backend comes back online

### Session shows old data
- Click browser refresh to load latest from backend
- Check `last_updated` timestamp in database
- Verify other users are saving correctly

## Environment Variables

### Backend (.env)
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bingo_helper
DB_USER=bingo_user
DB_PASSWORD=change_me_in_production
```

### Frontend
The frontend automatically detects the environment:
- **Development** (`localhost`): Uses `http://localhost:3000`
- **Production** (any other domain): Uses `/api` (proxied by ingress)

## Development

### Running Locally

1. **Start PostgreSQL**
   ```bash
   docker run -d \
     -e POSTGRES_DB=bingo_helper \
     -e POSTGRES_USER=bingo_user \
     -e POSTGRES_PASSWORD=postgres \
     -p 5432:5432 \
     -v $(pwd)/backend/db/init.sql:/docker-entrypoint-initdb.d/init.sql \
     postgres:15-alpine
   ```

2. **Start Backend**
   ```bash
   cd backend
   npm install
   npm start
   ```

3. **Serve Frontend**
   ```bash
   # Use any static file server
   python3 -m http.server 8080
   # or
   npx serve .
   ```

### Testing

#### Test Session Creation
```bash
curl -X POST http://localhost:3000/api/session/create \
  -H "Content-Type: application/json" \
  -d '{"tiles": []}'
```

#### Test Session Load
```bash
curl http://localhost:3000/api/session/OSRS-A3F9K2
```

#### Test Password Claim
```bash
curl -X POST http://localhost:3000/api/session/OSRS-A3F9K2/claim \
  -H "Content-Type: application/json" \
  -d '{"password": "test123"}'
```

## Roadmap

Future enhancements being considered:

- [ ] Real-time WebSocket updates (no refresh needed)
- [ ] Session leaderboards and statistics
- [ ] Team member list (who's currently viewing)
- [ ] Session expiration/cleanup (auto-delete old sessions)
- [ ] Export session as shareable image
- [ ] Mobile-friendly responsive design improvements

## Support

For issues, feature requests, or questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review browser console for errors
- Check backend logs: `docker-compose logs backend`
- Open a GitHub issue with reproduction steps

## License

Same license as the main OSRS Bingo Helper project.

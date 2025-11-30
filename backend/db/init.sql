-- OSRS Bingo Helper - Database Schema
-- Session sharing with optional password protection

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_code VARCHAR(12) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL = unprotected, NOT NULL = password protected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tiles table - stores all tiles for a session
CREATE TABLE IF NOT EXISTS tiles (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    tile_id VARCHAR(50) NOT NULL, -- The frontend tile ID (timestamp-based)
    name VARCHAR(255) NOT NULL,
    description TEXT,
    notes TEXT,
    or_logic BOOLEAN DEFAULT FALSE,
    completed BOOLEAN DEFAULT FALSE,
    position INTEGER DEFAULT 0, -- For ordering tiles
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, tile_id)
);

-- Items table - stores items for each tile
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    tile_id INTEGER REFERENCES tiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    current INTEGER DEFAULT 0,
    source VARCHAR(255),
    position INTEGER DEFAULT 0, -- For ordering items within a tile
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(session_code);
CREATE INDEX IF NOT EXISTS idx_tiles_session ON tiles(session_id);
CREATE INDEX IF NOT EXISTS idx_items_tile ON items(tile_id);

-- Function to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sessions SET last_updated = CURRENT_TIMESTAMP WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update session timestamp when tiles are modified
CREATE TRIGGER update_session_on_tile_change
AFTER INSERT OR UPDATE ON tiles
FOR EACH ROW
EXECUTE FUNCTION update_session_timestamp();

-- Trigger to update session timestamp when items are modified
CREATE OR REPLACE FUNCTION update_session_timestamp_from_items()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sessions
    SET last_updated = CURRENT_TIMESTAMP
    WHERE id = (SELECT session_id FROM tiles WHERE id = NEW.tile_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_on_item_change
AFTER INSERT OR UPDATE ON items
FOR EACH ROW
EXECUTE FUNCTION update_session_timestamp_from_items();

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./db/database');
const { generateSessionCode, isValidSessionCode } = require('./utils/sessionCode');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// SESSION CREATION - POST /api/session/create
// ============================================================================
app.post('/api/session/create', async (req, res) => {
    const client = await pool.connect();
    try {
        const { tiles } = req.body;

        if (!tiles || !Array.isArray(tiles)) {
            return res.status(400).json({ error: 'Tiles array is required' });
        }

        // Generate unique session code
        let sessionCode;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            sessionCode = generateSessionCode();
            const checkResult = await client.query(
                'SELECT id FROM sessions WHERE session_code = $1',
                [sessionCode]
            );

            if (checkResult.rows.length === 0) {
                break; // Found unique code
            }
            attempts++;
        }

        if (attempts === maxAttempts) {
            return res.status(500).json({ error: 'Failed to generate unique session code' });
        }

        // Start transaction
        await client.query('BEGIN');

        // Create session
        const sessionResult = await client.query(
            'INSERT INTO sessions (session_code) VALUES ($1) RETURNING id, session_code, created_at',
            [sessionCode]
        );

        const session = sessionResult.rows[0];

        // Insert tiles
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            const tileResult = await client.query(
                `INSERT INTO tiles (session_id, tile_id, name, description, notes, or_logic, completed, position)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id`,
                [
                    session.id,
                    tile.id,
                    tile.name,
                    tile.description || '',
                    tile.notes || '',
                    tile.orLogic || false,
                    tile.completed || false,
                    i
                ]
            );

            const tileDbId = tileResult.rows[0].id;

            // Insert items for this tile
            if (tile.items && Array.isArray(tile.items)) {
                for (let j = 0; j < tile.items.length; j++) {
                    const item = tile.items[j];
                    await client.query(
                        `INSERT INTO items (tile_id, name, quantity, current, source, position)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            tileDbId,
                            item.name,
                            item.quantity || 1,
                            item.current || 0,
                            item.source || '',
                            j
                        ]
                    );
                }
            }
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            sessionCode: session.session_code,
            createdAt: session.created_at
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session' });
    } finally {
        client.release();
    }
});

// ============================================================================
// SESSION LOAD - GET /api/session/:code
// ============================================================================
app.get('/api/session/:code', async (req, res) => {
    try {
        const { code } = req.params;

        if (!isValidSessionCode(code)) {
            return res.status(400).json({ error: 'Invalid session code format' });
        }

        // Get session
        const sessionResult = await pool.query(
            `SELECT id, session_code, password_hash IS NOT NULL as is_protected, created_at, last_updated
             FROM sessions
             WHERE session_code = $1`,
            [code]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const session = sessionResult.rows[0];

        // Get tiles with items
        const tilesResult = await pool.query(
            `SELECT t.id as db_id, t.tile_id, t.name, t.description, t.notes, t.or_logic, t.completed, t.position
             FROM tiles t
             WHERE t.session_id = $1
             ORDER BY t.position`,
            [session.id]
        );

        const tiles = [];

        for (const tileRow of tilesResult.rows) {
            const itemsResult = await pool.query(
                `SELECT name, quantity, current, source
                 FROM items
                 WHERE tile_id = $1
                 ORDER BY position`,
                [tileRow.db_id]
            );

            tiles.push({
                id: tileRow.tile_id,
                name: tileRow.name,
                description: tileRow.description,
                notes: tileRow.notes,
                orLogic: tileRow.or_logic,
                completed: tileRow.completed,
                items: itemsResult.rows
            });
        }

        res.json({
            success: true,
            sessionCode: session.session_code,
            isProtected: session.is_protected,
            createdAt: session.created_at,
            lastUpdated: session.last_updated,
            tiles
        });

    } catch (error) {
        console.error('Error loading session:', error);
        res.status(500).json({ error: 'Failed to load session' });
    }
});

// ============================================================================
// PASSWORD VERIFICATION MIDDLEWARE
// ============================================================================
async function verifySessionPassword(req, res, next) {
    try {
        const { code } = req.params;
        const { password } = req.body;

        // Check if session is password protected
        const result = await pool.query(
            'SELECT password_hash FROM sessions WHERE session_code = $1',
            [code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const passwordHash = result.rows[0].password_hash;

        // If session has no password, allow access
        if (!passwordHash) {
            return next();
        }

        // If session has password but none provided
        if (!password) {
            return res.status(401).json({
                error: 'Password required',
                requiresPassword: true
            });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, passwordHash);
        if (!isValid) {
            return res.status(403).json({ error: 'Invalid password' });
        }

        next();
    } catch (error) {
        console.error('Error verifying password:', error);
        res.status(500).json({ error: 'Password verification failed' });
    }
}

// ============================================================================
// SESSION SAVE - POST /api/session/:code/save
// ============================================================================
app.post('/api/session/:code/save', verifySessionPassword, async (req, res) => {
    const client = await pool.connect();
    try {
        const { code } = req.params;
        const { tiles } = req.body;

        if (!isValidSessionCode(code)) {
            return res.status(400).json({ error: 'Invalid session code format' });
        }

        if (!tiles || !Array.isArray(tiles)) {
            return res.status(400).json({ error: 'Tiles array is required' });
        }

        // Get session ID
        const sessionResult = await pool.query(
            'SELECT id FROM sessions WHERE session_code = $1',
            [code]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const sessionId = sessionResult.rows[0].id;

        await client.query('BEGIN');

        // Delete existing tiles and items (cascade will handle items)
        await client.query('DELETE FROM tiles WHERE session_id = $1', [sessionId]);

        // Insert updated tiles
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            const tileResult = await client.query(
                `INSERT INTO tiles (session_id, tile_id, name, description, notes, or_logic, completed, position)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id`,
                [
                    sessionId,
                    tile.id,
                    tile.name,
                    tile.description || '',
                    tile.notes || '',
                    tile.orLogic || false,
                    tile.completed || false,
                    i
                ]
            );

            const tileDbId = tileResult.rows[0].id;

            // Insert items
            if (tile.items && Array.isArray(tile.items)) {
                for (let j = 0; j < tile.items.length; j++) {
                    const item = tile.items[j];
                    await client.query(
                        `INSERT INTO items (tile_id, name, quantity, current, source, position)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            tileDbId,
                            item.name,
                            item.quantity || 1,
                            item.current || 0,
                            item.source || '',
                            j
                        ]
                    );
                }
            }
        }

        // Update session timestamp
        await client.query(
            'UPDATE sessions SET last_updated = CURRENT_TIMESTAMP WHERE id = $1',
            [sessionId]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Session saved successfully'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving session:', error);
        res.status(500).json({ error: 'Failed to save session' });
    } finally {
        client.release();
    }
});

// ============================================================================
// PASSWORD CLAIM - POST /api/session/:code/claim
// ============================================================================
app.post('/api/session/:code/claim', async (req, res) => {
    try {
        const { code } = req.params;
        const { password } = req.body;

        if (!isValidSessionCode(code)) {
            return res.status(400).json({ error: 'Invalid session code format' });
        }

        if (!password || password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }

        // Check if session exists and is not already protected
        const result = await pool.query(
            'SELECT id, password_hash FROM sessions WHERE session_code = $1',
            [code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (result.rows[0].password_hash) {
            return res.status(409).json({ error: 'Session is already password protected' });
        }

        // Hash password and update session
        const passwordHash = await bcrypt.hash(password, 10);
        await pool.query(
            'UPDATE sessions SET password_hash = $1 WHERE session_code = $2',
            [passwordHash, code]
        );

        res.json({
            success: true,
            message: 'Password protection enabled'
        });

    } catch (error) {
        console.error('Error claiming session:', error);
        res.status(500).json({ error: 'Failed to claim session' });
    }
});

// ============================================================================
// START SERVER
// ============================================================================
app.listen(PORT, () => {
    console.log(`🚀 Bingo Helper API running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

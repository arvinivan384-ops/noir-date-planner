const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL Connection
// PostgreSQL Connection
const pool = new Pool({
    connectionString: process.env.DB_URL || process.env.DATABASE_URL,   // ← CHANGE TO THIS
    ssl: { rejectUnauthorized: false }
});
pool.connect((err) => {
    if (err) {
        console.error('❌ PostgreSQL error:', err);
    } else {
        console.log('✅ Connected to PostgreSQL');
        createTables();
    }
});

async function createTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT,
                role TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS date_plans (
                id SERIAL PRIMARY KEY,
                plan_key TEXT UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users(id),
                recipient_name TEXT DEFAULT 'Radhia',
                page_viewed BOOLEAN DEFAULT FALSE,
                yes_clicked BOOLEAN DEFAULT FALSE,
                vibe_selected TEXT,
                place_selected TEXT,
                date_confirmed TEXT,
                viewed_at TIMESTAMP,
                yes_clicked_at TIMESTAMP,
                confirmed_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tracking_log (
                id SERIAL PRIMARY KEY,
                plan_key TEXT,
                step TEXT,
                data TEXT,
                user_agent TEXT,
                ip TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        const adminCheck = await pool.query('SELECT * FROM users WHERE email = $1', ['admin@noir.com']);
        if (adminCheck.rows.length === 0) {
            await pool.query(`
                INSERT INTO users (email, password, role) 
                VALUES ($1, $2, 'admin')
            `, ['admin@noir.com', crypto.createHash('sha256').update('admin123').digest('hex')]);
            console.log('✅ Admin created');
        }
        console.log('✅ All tables ready');
    } catch (err) {
        console.error('❌ Table error:', err);
    }
}

// Create plan - POST
app.post('/api/create-plan', async (req, res) => {
    const { email, recipientName = 'Radhia' } = req.body;
    const planKey = crypto.randomBytes(8).toString('hex');
    try {
        let user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        let userId;
        if (user.rows.length > 0) {
            userId = user.rows[0].id;
        } else {
            const password = crypto.randomBytes(8).toString('hex');
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            const newUser = await pool.query(
                'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id',
                [email, hashedPassword, 'user']
            );
            userId = newUser.rows[0].id;
        }
        await pool.query(
            'INSERT INTO date_plans (plan_key, user_id, recipient_name) VALUES ($1, $2, $3)',
            [planKey, userId, recipientName]
        );
        res.json({
            success: true,
            planKey: planKey,
            link: `${req.protocol}://${req.get('host')}/?plan=${planKey}`,
            adminLink: `${req.protocol}://${req.get('host')}/?plan=${planKey}&dashboard=secret`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create plan - GET
app.get('/api/create-plan', async (req, res) => {
    const { email, recipientName = 'Radhia' } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const planKey = crypto.randomBytes(8).toString('hex');
    try {
        let user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        let userId;
        if (user.rows.length > 0) {
            userId = user.rows[0].id;
        } else {
            const password = crypto.randomBytes(8).toString('hex');
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            const newUser = await pool.query(
                'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id',
                [email, hashedPassword, 'user']
            );
            userId = newUser.rows[0].id;
        }
        await pool.query(
            'INSERT INTO date_plans (plan_key, user_id, recipient_name) VALUES ($1, $2, $3)',
            [planKey, userId, recipientName]
        );
        res.json({
            success: true,
            planKey: planKey,
            link: `${req.protocol}://${req.get('host')}/?plan=${planKey}`,
            adminLink: `${req.protocol}://${req.get('host')}/?plan=${planKey}&dashboard=secret`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get status
app.get('/api/status/:planKey', async (req, res) => {
    const planKey = req.params.planKey;
    try {
        const result = await pool.query(`
            SELECT dp.*, u.email as user_email 
            FROM date_plans dp
            JOIN users u ON dp.user_id = u.id
            WHERE dp.plan_key = $1
        `, [planKey]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
        const row = result.rows[0];
        res.json({
            recipient_name: row.recipient_name,
            page_viewed: row.page_viewed,
            yes_clicked: row.yes_clicked,
            vibe_selected: row.vibe_selected || null,
            place_selected: row.place_selected || null,
            date_confirmed: row.date_confirmed || null,
            viewed_at: row.viewed_at || null,
            yes_clicked_at: row.yes_clicked_at || null,
            confirmed_at: row.confirmed_at || null,
            updated_at: row.updated_at
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin - all plans
app.get('/api/admin/plans', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'NOIR_ADMIN_2026') return res.status(401).json({ error: 'Unauthorized' });
    try {
        const result = await pool.query(`
            SELECT dp.*, u.email as user_email
            FROM date_plans dp
            JOIN users u ON dp.user_id = u.id
            ORDER BY dp.created_at DESC
        `);
        res.json({
            total_plans: result.rows.length,
            plans: result.rows.map(row => ({
                plan_key: row.plan_key,
                recipient: row.recipient_name,
                user_email: row.user_email,
                page_viewed: row.page_viewed,
                yes_clicked: row.yes_clicked,
                vibe: row.vibe_selected,
                place: row.place_selected,
                date_confirmed: row.date_confirmed,
                created_at: row.created_at,
                confirmed_at: row.confirmed_at
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Track
app.post('/api/track/:planKey', async (req, res) => {
    const planKey = req.params.planKey;
    const { step, data } = req.body;
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    try {
        await pool.query(
            'INSERT INTO tracking_log (plan_key, step, data) VALUES ($1, $2, $3)',
            [planKey, step, JSON.stringify(data)]
        );
        let updateQuery = '', updateParams = [];
        switch (step) {
            case 'page_viewed':
                updateQuery = `UPDATE date_plans SET page_viewed = TRUE, viewed_at = $1, updated_at = $2 WHERE plan_key = $3`;
                updateParams = [timestamp, timestamp, planKey];
                break;
            case 'yes_clicked':
                updateQuery = `UPDATE date_plans SET yes_clicked = TRUE, yes_clicked_at = $1, updated_at = $2 WHERE plan_key = $3`;
                updateParams = [timestamp, timestamp, planKey];
                break;
            case 'vibe_selected':
                updateQuery = `UPDATE date_plans SET vibe_selected = $1, updated_at = $2 WHERE plan_key = $3`;
                updateParams = [data.vibe || data.label, timestamp, planKey];
                break;
            case 'place_selected':
                updateQuery = `UPDATE date_plans SET place_selected = $1, updated_at = $2 WHERE plan_key = $3`;
                updateParams = [data.place, timestamp, planKey];
                break;
            case 'date_confirmed':
                updateQuery = `UPDATE date_plans SET date_confirmed = $1, confirmed_at = $2, updated_at = $3 WHERE plan_key = $4`;
                updateParams = [data.details, timestamp, timestamp, planKey];
                break;
            default:
                return res.json({ success: true });
        }
        await pool.query(updateQuery, updateParams);
        res.json({ success: true, step, timestamp });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Routes
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 DYNAMIC DATE PLANNER SERVER IS RUNNING!              ║
║                                                           ║
║  📡 Server: http://localhost:${PORT}                      ║
║  📊 Admin: http://localhost:${PORT}/admin               ║
║  🔑 Admin Key: NOIR_ADMIN_2026                           ║
║  👤 Admin: admin@noir.com / admin123                     ║
║                                                           ║
║  💛 Ready!                                               ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

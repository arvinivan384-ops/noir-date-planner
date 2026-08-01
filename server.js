const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================================================
//  DATABASE SETUP
// ============================================================
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('❌ Database error:', err);
    } else {
        console.log('✅ Connected to SQLite database');
        createTables();
    }
});

function createTables() {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Date plans table
    db.run(`
        CREATE TABLE IF NOT EXISTS date_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_key TEXT UNIQUE NOT NULL,
            user_id INTEGER,
            recipient_name TEXT DEFAULT 'Radhia',
            page_viewed BOOLEAN DEFAULT 0,
            yes_clicked BOOLEAN DEFAULT 0,
            vibe_selected TEXT,
            place_selected TEXT,
            date_confirmed TEXT,
            viewed_at DATETIME,
            yes_clicked_at DATETIME,
            confirmed_at DATETIME,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Tracking log
    db.run(`
        CREATE TABLE IF NOT EXISTS tracking_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_key TEXT,
            step TEXT,
            data TEXT,
            user_agent TEXT,
            ip TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create admin user
    db.get('SELECT * FROM users WHERE email = ?', ['admin@noir.com'], (err, row) => {
        if (!row) {
            db.run(`
                INSERT INTO users (email, password, role) 
                VALUES ('admin@noir.com', ?, 'admin')
            `, [crypto.createHash('sha256').update('admin123').digest('hex')]);
            console.log('✅ Admin created: admin@noir.com / admin123');
        }
    });
}

// ============================================================
//  USER MANAGEMENT
// ============================================================

app.post('/api/register', (req, res) => {
    const { email } = req.body;
    const password = crypto.randomBytes(8).toString('hex');
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    db.run(`
        INSERT INTO users (email, password, role) 
        VALUES (?, ?, 'user')
    `, [email, hashedPassword], function(err) {
        if (err) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        res.json({ 
            success: true, 
            password: password
        });
    });
});

/// ============================================================
//  PLAN MANAGEMENT
// ============================================================

app.post('/api/create-plan', (req, res) => {
    const { email, recipientName = 'Radhia' } = req.body;
    // ... your existing POST code ...
});

// 👇 PASTE THE GET CODE RIGHT HERE 👇

// GET version for easy browser testing
app.get('/api/create-plan', (req, res) => {
    const { email, recipientName = 'Radhia' } = req.query;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    const planKey = crypto.randomBytes(8).toString('hex');
    
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        let userId;
        if (row) {
            userId = row.id;
            createPlan();
        } else {
            const password = crypto.randomBytes(8).toString('hex');
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            db.run(`
                INSERT INTO users (email, password, role) 
                VALUES (?, ?, 'user')
            `, [email, hashedPassword], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                userId = this.lastID;
                createPlan();
            });
        }

        function createPlan() {
            db.run(`
                INSERT INTO date_plans (plan_key, user_id, recipient_name)
                VALUES (?, ?, ?)
            `, [planKey, userId, recipientName], function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ 
                    success: true, 
                    planKey: planKey,
                    link: `${req.protocol}://${req.get('host')}/?plan=${planKey}`,
                    adminLink: `${req.protocol}://${req.get('host')}/?plan=${planKey}&dashboard=secret`
                });
            });
        }
    });
});

// ============================================================
//  PLAN DATA (PRIVATE)
// ============================================================

app.get('/api/status/:planKey', (req, res) => {
    const planKey = req.params.planKey;

    db.get(`
        SELECT dp.*, u.email as user_email 
        FROM date_plans dp
        JOIN users u ON dp.user_id = u.id
        WHERE dp.plan_key = ?
    `, [planKey], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Plan not found' });
        
        res.json({
            recipient_name: row.recipient_name,
            page_viewed: row.page_viewed === 1,
            yes_clicked: row.yes_clicked === 1,
            vibe_selected: row.vibe_selected || null,
            place_selected: row.place_selected || null,
            date_confirmed: row.date_confirmed || null,
            viewed_at: row.viewed_at || null,
            yes_clicked_at: row.yes_clicked_at || null,
            confirmed_at: row.confirmed_at || null,
            updated_at: row.updated_at
        });
    });
});

// ============================================================
//  ADMIN DASHBOARD - SEE ALL RESPONSES
// ============================================================

app.get('/api/admin/plans', (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'NOIR_ADMIN_2026') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    db.all(`
        SELECT 
            dp.*, 
            u.email as user_email,
            u.created_at as user_created_at
        FROM date_plans dp
        JOIN users u ON dp.user_id = u.id
        ORDER BY dp.created_at DESC
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            total_plans: rows.length,
            plans: rows.map(row => ({
                plan_key: row.plan_key,
                recipient: row.recipient_name,
                user_email: row.user_email,
                page_viewed: row.page_viewed === 1,
                yes_clicked: row.yes_clicked === 1,
                vibe: row.vibe_selected,
                place: row.place_selected,
                date_confirmed: row.date_confirmed,
                created_at: row.created_at,
                confirmed_at: row.confirmed_at
            }))
        });
    });
});

app.get('/api/admin/logs', (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'NOIR_ADMIN_2026') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    db.all(`
        SELECT * FROM tracking_log ORDER BY created_at DESC LIMIT 100
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ============================================================
//  TRACKING
// ============================================================

app.post('/api/track', (req, res) => {
    const { step, data = {}, planKey = 'default' } = req.body;
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    db.run(`
        INSERT INTO tracking_log (plan_key, step, data, user_agent, ip)
        VALUES (?, ?, ?, ?, ?)
    `, [planKey, step, JSON.stringify(data), userAgent, ip], (logError) => {
        if (logError) {
            return res.status(500).json({ error: logError.message });
        }
    });

    let updateQuery = '', updateParams = [];
    switch(step) {
        case 'page_viewed':
            updateQuery = `UPDATE date_plans SET page_viewed = 1, viewed_at = ?, updated_at = ? WHERE plan_key = ?`;
            updateParams = [timestamp, timestamp, planKey];
            break;
        case 'yes_clicked':
            updateQuery = `UPDATE date_plans SET yes_clicked = 1, yes_clicked_at = ?, updated_at = ? WHERE plan_key = ?`;
            updateParams = [timestamp, timestamp, planKey];
            break;
        case 'vibe_selected':
            updateQuery = `UPDATE date_plans SET vibe_selected = ?, updated_at = ? WHERE plan_key = ?`;
            updateParams = [data.vibe || data.label, timestamp, planKey];
            break;
        case 'place_selected':
            updateQuery = `UPDATE date_plans SET place_selected = ?, updated_at = ? WHERE plan_key = ?`;
            updateParams = [data.place, timestamp, planKey];
            break;
        case 'date_confirmed':
            updateQuery = `UPDATE date_plans SET date_confirmed = ?, confirmed_at = ?, updated_at = ? WHERE plan_key = ?`;
            updateParams = [data.details, timestamp, timestamp, planKey];
            break;
        default:
            return res.json({ success: true });
    }
    db.run(updateQuery, updateParams, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, step, timestamp });
    });
});

// ============================================================
//  ADMIN WEB INTERFACE
// ============================================================

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Admin.html'));
});

// ============================================================
//  SERVE FRONTEND
// ============================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 DYNAMIC DATE PLANNER SERVER IS RUNNING!              ║
║                                                           ║
║  📡 Server: http://localhost:${PORT}                      ║
║  📊 Admin: http://localhost:${PORT}/admin               ║
║  🔑 Admin Key: NOIR_ADMIN_2026                           ║
║  👤 Admin Login: admin@noir.com / admin123               ║
║                                                           ║
║  💛 Ready!                                               ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
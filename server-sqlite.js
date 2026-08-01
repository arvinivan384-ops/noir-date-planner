const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================================================
// SQLite Database (No password needed!)
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
    db.run(`
        CREATE TABLE IF NOT EXISTS date_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_key TEXT UNIQUE NOT NULL,
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('❌ Table creation error:', err);
        } else {
            console.log('✅ Date plans table ready');
            db.get('SELECT COUNT(*) as count FROM date_plans', (err, row) => {
                if (row && row.count === 0) {
                    db.run(`
                        INSERT INTO date_plans (plan_key, recipient_name) 
                        VALUES ('default', 'Radhia')
                    `);
                    console.log('✅ Default plan created');
                }
            });
        }
    });

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
    `, (err) => {
        if (!err) console.log('✅ Tracking log table ready');
    });
}

// ============================================================
// API ENDPOINTS
// ============================================================

app.get('/api/status/:planKey?', (req, res) => {
    const planKey = req.params.planKey || 'default';
    db.get(`
        SELECT page_viewed, yes_clicked, vibe_selected, place_selected,
               date_confirmed, viewed_at, yes_clicked_at, confirmed_at, updated_at
        FROM date_plans WHERE plan_key = ?
    `, [planKey], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Plan not found' });
        res.json({
            page_viewed: row.page_viewed === 1,
            yes_clicked: row.yes_clicked === 1,
            vibe_selected: row.vibe_selected || null,
            place_selected: row.place_selected || null,
            date_confirmed: row.date_confirmed || null,
            viewed_at: row.viewed_at || null,
            yes_clicked_at: row.yes_clicked_at || null,
            confirmed_at: row.confirmed_at || null,
            updated_at: row.updated_at,
            page_status: row.page_viewed === 1 ? '✅ Viewed' : '⏳ Not viewed',
            yes_status: row.yes_clicked === 1 ? '💛 YES!' : '⏳ Waiting',
            vibe_status: row.vibe_selected ? `🎯 ${row.vibe_selected}` : '⏳ Waiting',
            overall_status: row.date_confirmed ? '✅ DATE CONFIRMED! 🎉' : '⏳ Awaiting confirmation'
        });
    });
});

app.post('/api/track', (req, res) => {
    const { step, data, planKey = 'default' } = req.body;
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    db.run(`INSERT INTO tracking_log (plan_key, step, data, user_agent, ip) VALUES (?, ?, ?, ?, ?)`,
        [planKey, step, JSON.stringify(data), req.headers['user-agent'] || 'unknown', ip]);

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

app.get('/api/plans', (req, res) => {
    db.all(`SELECT * FROM date_plans ORDER BY created_at DESC`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/reset/:planKey?', (req, res) => {
    const planKey = req.params.planKey || 'default';
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    db.run(`
        UPDATE date_plans 
        SET page_viewed = 0, yes_clicked = 0, vibe_selected = NULL,
            place_selected = NULL, date_confirmed = NULL,
            viewed_at = NULL, yes_clicked_at = NULL, confirmed_at = NULL,
            updated_at = ?
        WHERE plan_key = ?
    `, [timestamp, planKey], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: '✅ Plan reset', planKey });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 DYNAMIC DATE PLANNER SERVER IS RUNNING!              ║
║                                                           ║
║  📡 Server: http://localhost:${PORT}                      ║
║  📊 API: http://localhost:${PORT}/api/status              ║
║  📋 Logs: http://localhost:${PORT}/api/plans             ║
║                                                           ║
║  💛 Ready for Radhia!                                    ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
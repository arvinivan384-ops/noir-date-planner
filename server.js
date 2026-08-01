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
const pool = new Pool({
    connectionString: 'postgresql://date_planner_db_m5jx_user:6NlxfInsdNcYYdT90TkV445yWqEKl9fz@dpg-d9ml5rtaeets73a820og-a/date_planner_db_m5jx',
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
        // Users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT,
                role TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Date plans table with DEFAULT 'Your Date'
        await pool.query(`
            CREATE TABLE IF NOT EXISTS date_plans (
                id SERIAL PRIMARY KEY,
                plan_key TEXT UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users(id),
                recipient_name TEXT DEFAULT 'Your Date',
                page_viewed BOOLEAN DEFAULT FALSE,
                yes_clicked BOOLEAN DEFAULT FALSE,
                vibe_selected TEXT,
                place_selected TEXT,
                date_confirmed TEXT,
                viewer_name TEXT,
                viewed_at TIMESTAMP,
                yes_clicked_at TIMESTAMP,
                confirmed_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add viewer_name column if not exists
        try {
            await pool.query(`
                ALTER TABLE date_plans ADD COLUMN IF NOT EXISTS viewer_name TEXT
            `);
            console.log('✅ viewer_name column added to date_plans');
        } catch (err) {
            console.log('ℹ️ viewer_name column check:', err.message);
        }

        // Tracking log
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tracking_log (
                id SERIAL PRIMARY KEY,
                plan_key TEXT,
                step TEXT,
                data TEXT,
                viewer_name TEXT,
                user_agent TEXT,
                ip TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Love quotes table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS love_quotes (
                id SERIAL PRIMARY KEY,
                quote TEXT NOT NULL,
                author VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert quotes if empty
        const quoteCheck = await pool.query('SELECT COUNT(*) FROM love_quotes');
        if (parseInt(quoteCheck.rows[0].count) === 0) {
            const quotes = [
                ['Love is not about how many days, months, or years you\'ve been together. It\'s about how much you love each other every single day.', 'Unknown'],
                ['The best thing to hold onto in life is each other.', 'Audrey Hepburn'],
                ['I have found the one whom my soul loves.', 'Song of Solomon'],
                ['In all the world, there is no heart for me like yours.', 'Maya Angelou'],
                ['You are the finest, loveliest, tenderest, and most beautiful person I have ever known.', 'F. Scott Fitzgerald'],
                ['I love you without knowing how, or when, or from where. I love you simply.', 'Pablo Neruda'],
                ['Love is when the other person\'s happiness is more important than your own.', 'H. Jackson Brown Jr.'],
                ['The only thing we never get enough of is love.', 'Henry Miller'],
                ['If I know what love is, it is because of you.', 'Hermann Hesse'],
                ['You are my today and all of my tomorrows.', 'Leo Christopher'],
                ['With you, I\'m home.', 'Unknown'],
                ['Love is not just looking at each other, it\'s looking in the same direction.', 'Antoine de Saint-Exupéry'],
                ['I would rather spend one lifetime with you, than face all the ages of this world alone.', 'J.R.R. Tolkien'],
                ['You make my heart smile.', 'Unknown'],
                ['Forever is a long time, but I wouldn\'t mind spending it by your side.', 'Unknown'],
                ['You are my sunshine.', 'Unknown'],
                ['I choose you. And I\'ll choose you over and over again.', 'Unknown'],
                ['You are the best thing that\'s ever been mine.', 'Taylor Swift'],
                ['I still fall for you every day.', 'Unknown'],
                ['I love you to the moon and back.', 'Sam McBratney'],
                ['You had me at hello.', 'Jerry Maguire'],
                ['My heart is, and always will be, yours.', 'Jane Austen'],
                ['You are my greatest adventure.', 'Unknown'],
                ['I love you more than words can say.', 'Unknown'],
                ['You make everything better.', 'Unknown'],
                ['You are my happy place.', 'Unknown'],
                ['I love you more than coffee.', 'Unknown'],
                ['You are the peanut butter to my jelly.', 'Unknown'],
                ['My favorite place is next to you.', 'Unknown'],
                ['You are my everything.', 'Unknown'],
                ['Love is composed of a single soul inhabiting two bodies.', 'Aristotle'],
                ['Where there is love there is life.', 'Mahatma Gandhi'],
                ['To love and be loved is to feel the sun from both sides.', 'David Viscott'],
                ['The giving of love is an education in itself.', 'Eleanor Roosevelt'],
                ['Love is the only force capable of transforming an enemy into a friend.', 'Martin Luther King Jr.'],
                ['We are shaped and fashioned by what we love.', 'Johann Wolfgang von Goethe'],
                ['The greatest happiness of life is the conviction that we are loved.', 'Victor Hugo'],
                ['Love is the beauty of the soul.', 'Saint Augustine'],
                ['Life without love is like a tree without blossoms or fruit.', 'Khalil Gibran'],
                ['Love is a friendship set to music.', 'Joseph Campbell'],
                ['The best and most beautiful things in this world cannot be seen or even heard, but must be felt with the heart.', 'Helen Keller'],
                ['Love is the only thing that grows when shared.', 'Unknown'],
                ['To be brave is to love someone unconditionally, without expecting anything in return.', 'Madonna'],
                ['There is no remedy for love but to love more.', 'Henry David Thoreau'],
                ['You complete me.', 'Jerry Maguire'],
                ['As you wish.', 'The Princess Bride'],
                ['You are the only person who ever made me feel like I matter.', 'Unknown'],
                ['Upendo ni nguvu.', 'Swahili Proverb'],
                ['Moyo wangu ni wako.', 'Swahili Proverb'],
                ['Pendana.', 'Swahili Proverb'],
                ['Love is like a beautiful flower that needs care and attention to bloom.', 'African Proverb'],
                ['When love is in the heart, the eyes see beauty everywhere.', 'African Proverb'],
                ['A man who loves you will always find a way to show it.', 'African Proverb'],
                ['Love is the only wealth that multiplies when shared.', 'African Proverb'],
                ['The heart that loves is always young.', 'African Proverb'],
                ['I love you more than pizza.', 'Unknown'],
                ['You\'re the cheese to my macaroni.', 'Unknown'],
                ['You\'re my favorite person to annoy.', 'Unknown'],
                ['I love you more than my phone.', 'Unknown'],
                ['How do I love thee? Let me count the ways.', 'Elizabeth Barrett Browning'],
                ['I carry your heart with me (I carry it in my heart).', 'E.E. Cummings'],
                ['She walks in beauty, like the night.', 'Lord Byron'],
                ['Love is not love which alters when it alteration finds.', 'William Shakespeare'],
                ['My love is like a red, red rose.', 'Robert Burns'],
                ['I loved you first, but afterwards your love outrunning mine.', 'Christina Rossetti'],
                ['Love has no desire but to fulfill itself.', 'Khalil Gibran'],
                ['Love is the voice under all silences.', 'E.E. Cummings'],
                ['The heart has its reasons which reason knows nothing of.', 'Blaise Pascal'],
                ['To love is to receive a glimpse of heaven.', 'Karen Sunde'],
                ['Love is a canvas furnished by nature and embroidered by imagination.', 'Voltaire'],
                ['Love is the flower of life, and blossoms unexpectedly and without law.', 'D.H. Lawrence'],
                ['Be the reason someone smiles today.', 'Unknown'],
                ['Love is the bridge between you and everything.', 'Rumi'],
                ['The greatest gift you can give someone is your time, your attention, your love.', 'Unknown'],
                ['Love means never having to say you\'re sorry.', 'Erich Segal'],
                ['The best love is the kind that awakens the soul.', 'Nicholas Sparks'],
                ['Love is not about possession. It\'s all about appreciation.', 'Unknown'],
                ['To love is nothing. To be loved is something. But to love and be loved, that\'s everything.', 'Unknown'],
                ['You are the best thing that ever happened to me.', 'Unknown'],
                ['I love you more than all the stars in the sky.', 'Unknown'],
                ['Forever is not long enough with you.', 'Unknown'],
                ['My heart beats only for you.', 'Unknown'],
                ['You are my dream come true.', 'Unknown'],
                ['I can\'t imagine my life without you.', 'Unknown'],
                ['You are my biggest blessing.', 'Unknown'],
                ['I love you with all my heart and soul.', 'Unknown'],
                ['You are the answer to my prayers.', 'Unknown'],
                ['A hundred hearts would be too few to carry all my love for you.', 'Unknown'],
                ['You are the poem I never knew how to write.', 'Unknown'],
                ['I love you more than all the words in all the books.', 'Unknown'],
                ['You are my favorite thought.', 'Unknown'],
                ['I didn\'t know what love was until I met you.', 'Unknown'],
                ['You make my world brighter.', 'Unknown'],
                ['I love you to the moon and back, and then some.', 'Unknown'],
                ['You are the reason I believe in love.', 'Unknown'],
                ['My love for you grows stronger every day.', 'Unknown'],
                ['You are my one and only.', 'Unknown'],
                ['I love you more than any words can express.', 'Unknown'],
                ['You are the greatest love story ever told.', 'Unknown'],
                ['Every love song makes sense now, because of you.', 'Unknown'],
                ['You are the best part of my day.', 'Unknown'],
                ['I love you beyond measure.', 'Unknown'],
                ['You are my forever.', 'Unknown'],
                ['I choose you, today and always.', 'Unknown'],
                ['You are the most beautiful thing that has ever happened to me.', 'Unknown'],
                ['There is no one else I would rather share my life with.', 'Unknown'],
                ['You are my sunshine on a rainy day.', 'Unknown']
            ];

            for (const [quote, author] of quotes) {
                await pool.query('INSERT INTO love_quotes (quote, author) VALUES ($1, $2)', [quote, author]);
            }
            console.log('✅ 100+ love quotes added');
        }

        // Admin user
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

// ============================================================
//  LOVE QUOTES API
// ============================================================

// Get random quote
app.get('/api/quote/random', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM love_quotes ORDER BY RANDOM() LIMIT 1');
        res.json({
            quote: result.rows[0].quote,
            author: result.rows[0].author || 'Unknown'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin - Get all quotes
app.get('/api/admin/quotes', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'NOIR_ADMIN_2026') return res.status(401).json({ error: 'Unauthorized' });
    try {
        const result = await pool.query('SELECT * FROM love_quotes ORDER BY RANDOM()');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin - Add quote
app.post('/api/admin/quotes', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'NOIR_ADMIN_2026') return res.status(401).json({ error: 'Unauthorized' });
    const { quote, author } = req.body;
    try {
        await pool.query('INSERT INTO love_quotes (quote, author) VALUES ($1, $2)', [quote, author]);
        res.json({ success: true, message: 'Quote added' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  CREATE PLAN
// ============================================================

// Create plan - GET (Default: 'Your Date')
app.get('/api/create-plan', async (req, res) => {
    const { email, recipientName = 'Your Date' } = req.query;
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
            adminLink: `${req.protocol}://${req.get('host')}/?plan=${planKey}&dashboard=secret`,
            customerLink: `${req.protocol}://${req.get('host')}/customer?plan=${planKey}`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create plan - POST (Default: 'Your Date')
app.post('/api/create-plan', async (req, res) => {
    const { email, recipientName = 'Your Date' } = req.body;
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
            adminLink: `${req.protocol}://${req.get('host')}/?plan=${planKey}&dashboard=secret`,
            customerLink: `${req.protocol}://${req.get('host')}/customer?plan=${planKey}`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  GET STATUS
// ============================================================
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
            viewer_name: row.viewer_name || null,
            viewed_at: row.viewed_at || null,
            yes_clicked_at: row.yes_clicked_at || null,
            confirmed_at: row.confirmed_at || null,
            updated_at: row.updated_at
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  ADMIN - ALL PLANS
// ============================================================
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
                viewer_name: row.viewer_name || null,
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

// ============================================================
//  ADMIN - UPDATE PLAN (Fix recipient name)
// ============================================================
app.patch('/api/admin/update-plan/:planKey', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'NOIR_ADMIN_2026') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const planKey = req.params.planKey;
    const { recipient_name } = req.body;
    
    if (!recipient_name) {
        return res.status(400).json({ error: 'recipient_name is required' });
    }
    
    try {
        const result = await pool.query(
            'UPDATE date_plans SET recipient_name = $1, updated_at = CURRENT_TIMESTAMP WHERE plan_key = $2 RETURNING *',
            [recipient_name, planKey]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        
        res.json({ 
            success: true, 
            message: 'Updated recipient name',
            plan: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  ADMIN - DELETE PLAN (NEW - FIXED)
// ============================================================
app.delete('/api/admin/delete-plan/:planKey', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'NOIR_ADMIN_2026') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const planKey = req.params.planKey;

    try {
        // First delete tracking logs (foreign key constraint)
        await pool.query('DELETE FROM tracking_log WHERE plan_key = $1', [planKey]);
        
        // Then delete the plan
        const result = await pool.query('DELETE FROM date_plans WHERE plan_key = $1 RETURNING *', [planKey]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        
        res.json({ 
            success: true, 
            message: `Deleted plan: ${planKey}`
        });
    } catch (err) {
        console.error('❌ Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  TRACKING - FIXED: viewer_name becomes recipient_name on name_entered
// ============================================================
app.post('/api/track/:planKey', async (req, res) => {
    const planKey = req.params.planKey;
    const { step, data } = req.body;
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const viewerName = data.viewerName || null;

    try {
        await pool.query(
            'INSERT INTO tracking_log (plan_key, step, data, viewer_name) VALUES ($1, $2, $3, $4)',
            [planKey, step, JSON.stringify(data), viewerName]
        );

        let updateQuery = '', updateParams = [];
        switch (step) {
            case 'page_viewed':
                updateQuery = `UPDATE date_plans SET page_viewed = TRUE, viewed_at = $1, updated_at = $2 WHERE plan_key = $3`;
                updateParams = [timestamp, timestamp, planKey];
                break;

            case 'name_entered':
                // ✅ FIX: When she enters her name, update BOTH viewer_name AND recipient_name
                updateQuery = `
                    UPDATE date_plans 
                    SET viewer_name = $1, 
                        recipient_name = $1, 
                        updated_at = $2 
                    WHERE plan_key = $3
                `;
                updateParams = [viewerName, timestamp, planKey];
                console.log(`📝 Name entered: "${viewerName}" - Updated recipient_name to match`);
                break;

            case 'yes_clicked':
                // If somehow name wasn't set earlier, set it now
                updateQuery = `
                    UPDATE date_plans 
                    SET yes_clicked = TRUE, 
                        yes_clicked_at = $1, 
                        updated_at = $2,
                        viewer_name = COALESCE(viewer_name, $3),
                        recipient_name = COALESCE(recipient_name, $3)
                    WHERE plan_key = $4
                `;
                updateParams = [timestamp, timestamp, viewerName, planKey];
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
        console.error('❌ Tracking error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  CUSTOMER STATUS
// ============================================================
app.get('/customer', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'customer.html'));
});

app.get('/api/customer/status/:planKey', async (req, res) => {
    const planKey = req.params.planKey;

    try {
        const result = await pool.query(`
            SELECT recipient_name, page_viewed, yes_clicked,
                   vibe_selected, place_selected, date_confirmed,
                   viewer_name, viewed_at, yes_clicked_at, confirmed_at
            FROM date_plans
            WHERE plan_key = $1
        `, [planKey]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        const plan = result.rows[0];
        res.json({
            recipient: plan.recipient_name,
            page_viewed: plan.page_viewed,
            yes_clicked: plan.yes_clicked,
            vibe_selected: plan.vibe_selected,
            place_selected: plan.place_selected,
            date_confirmed: plan.date_confirmed,
            viewer_name: plan.viewer_name,
            viewed_at: plan.viewed_at,
            yes_clicked_at: plan.yes_clicked_at,
            confirmed_at: plan.confirmed_at,
            status: plan.yes_clicked ? '💛 She said YES!' :
                    plan.page_viewed ? '👀 She opened the page' :
                    '⏳ Waiting for her to open'
        });
    } catch (err) {
        console.error('❌ Customer status error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  ROUTES
// ============================================================
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
//  START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 DYNAMIC DATE PLANNER SERVER IS RUNNING!              ║
║                                                           ║
║  📡 Server: http://localhost:${PORT}                      ║
║  📊 Admin: http://localhost:${PORT}/admin               ║
║  👤 Customer: http://localhost:${PORT}/customer?plan=KEY ║
║  💛 Auto-Recipient: Viewer name becomes recipient       ║
║  💛 Love Quotes: 100+ loaded                             ║
║  🔑 Admin Key: NOIR_ADMIN_2026                           ║
║  👤 Admin: admin@noir.com / admin123                     ║
║                                                           ║
║  💛 Ready!                                               ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

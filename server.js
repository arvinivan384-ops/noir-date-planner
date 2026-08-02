const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');  // ← FIXED: @sendgrid

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================================================
//  DATABASE CONNECTION
// ============================================================
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

// ============================================================
//  CREATE TABLES
// ============================================================
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

        // Add indexes for speed
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_date_plans_plan_key ON date_plans(plan_key)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_date_plans_user_id ON date_plans(user_id)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_tracking_log_plan_key ON tracking_log(plan_key)
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS tracking_log (
                id SERIAL PRIMARY KEY,
                plan_key TEXT,
                step TEXT,
                data TEXT,
                viewer_name TEXT,
                ip TEXT,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS love_quotes (
                id SERIAL PRIMARY KEY,
                quote TEXT NOT NULL,
                author VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add quotes
        const quoteCheck = await pool.query('SELECT COUNT(*) FROM love_quotes');
        if (parseInt(quoteCheck.rows[0].count) === 0) {
            const quotes = [
                ['Love is not about how many days, months, or years you\'ve been together. It\'s about how much you love each other every single day.', 'Unknown'],
                ['The best thing to hold onto in life is each other.', 'Audrey Hepburn'],
                ['I have found the one whom my soul loves.', 'Song of Solomon'],
                ['You are the finest, loveliest, tenderest, and most beautiful person I have ever known.', 'F. Scott Fitzgerald'],
                ['I love you without knowing how, or when, or from where. I love you simply.', 'Pablo Neruda'],
                ['Love is when the other person\'s happiness is more important than your own.', 'H. Jackson Brown Jr.'],
                ['You are my today and all of my tomorrows.', 'Leo Christopher'],
                ['With you, I\'m home.', 'Unknown'],
                ['I choose you. And I\'ll choose you over and over again.', 'Unknown'],
                ['You are my sunshine.', 'Unknown'],
                ['You are my greatest adventure.', 'Unknown'],
                ['I love you to the moon and back.', 'Sam McBratney'],
                ['You had me at hello.', 'Jerry Maguire'],
                ['My heart is, and always will be, yours.', 'Jane Austen'],
                ['You are my everything.', 'Unknown'],
                ['Love is composed of a single soul inhabiting two bodies.', 'Aristotle'],
                ['Where there is love there is life.', 'Mahatma Gandhi'],
                ['To love and be loved is to feel the sun from both sides.', 'David Viscott'],
                ['Love is the only force capable of transforming an enemy into a friend.', 'Martin Luther King Jr.'],
                ['The greatest happiness of life is the conviction that we are loved.', 'Victor Hugo'],
                ['Love is the beauty of the soul.', 'Saint Augustine'],
                ['Life without love is like a tree without blossoms or fruit.', 'Khalil Gibran'],
                ['Love is a friendship set to music.', 'Joseph Campbell'],
                ['Love is the only thing that grows when shared.', 'Unknown'],
                ['To be brave is to love someone unconditionally, without expecting anything in return.', 'Madonna'],
                ['There is no remedy for love but to love more.', 'Henry David Thoreau'],
                ['You complete me.', 'Jerry Maguire'],
                ['As you wish.', 'The Princess Bride'],
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
                ['You are my sunshine on a rainy day.', 'Unknown'],
                ['Love is the only thing that makes life worth living.', 'Unknown'],
                ['Every day with you is a beautiful day.', 'Unknown']
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
//  EMAIL NOTIFICATIONS - SENDGRID (FIXED!)
// ============================================================

// ✅ API key comes from Render Environment (NOT hardcoded)
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail(to, subject, message, htmlMessage = null) {
    try {
        const msg = {
            to: to,
            from: 'noir.invites@gmail.com',
            subject: subject,
            text: message,
            html: htmlMessage || `<p>${message.replace(/\n/g, '<br>')}</p>`
        };
        await sgMail.send(msg);
        console.log(`📧 Email sent to: ${to}`);
        return true;
    } catch (error) {
        console.error('❌ Email error:', error.message);
        return false;
    }
}

async function getClientEmail(planKey) {
    const result = await pool.query(`
        SELECT u.email FROM date_plans dp
        JOIN users u ON dp.user_id = u.id
        WHERE dp.plan_key = $1
    `, [planKey]);
    return result.rows[0]?.email || null;
}

// ============================================================
//  API: LOVE QUOTES
// ============================================================
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

// ============================================================
//  API: CREATE PLAN - SPEED OPTIMIZED!
// ============================================================
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

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const inviteLink = `${baseUrl}/?plan=${planKey}`;
        const customerLink = `${baseUrl}/customer?plan=${planKey}`;

        // ✅ FIRE AND FORGET - Send email in background (NO AWAIT)
        sendEmail(
            email,
            `💛 Your Date Plan for ${recipientName} is Ready!`,
            `Hi there,\n\nYour date invitation for ${recipientName} is ready! 🎉\n\n🔗 Send this link to ${recipientName}:\n${inviteLink}\n\n📊 Track her response here:\n${customerLink}\n\nShe'll open it, type her name, and tell you YES! 💛\n\nGood luck!\n- Noir Team`
        );

        res.json({
            success: true,
            planKey: planKey,
            link: inviteLink,
            customerLink: customerLink,
            emailSent: true,
            emailTo: email
        });
    } catch (err) {
        console.error('❌ Create plan error:', err);
        res.status(500).json({ error: err.message });
    }
});

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

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const inviteLink = `${baseUrl}/?plan=${planKey}`;
        const customerLink = `${baseUrl}/customer?plan=${planKey}`;

        sendEmail(
            email,
            `💛 Your Date Plan for ${recipientName} is Ready!`,
            `Hi there,\n\nYour date invitation for ${recipientName} is ready! 🎉\n\n🔗 Send this link to ${recipientName}:\n${inviteLink}\n\n📊 Track her response here:\n${customerLink}\n\nShe'll open it, type her name, and tell you YES! 💛\n\nGood luck!\n- Noir Team`
        );

        res.json({
            success: true,
            planKey: planKey,
            link: inviteLink,
            customerLink: customerLink,
            emailSent: true,
            emailTo: email
        });
    } catch (err) {
        console.error('❌ Create plan error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  API: GET STATUS
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
//  API: ADMIN - ALL PLANS (MASTER TRACKER)
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
//  API: ADMIN - DELETE PLAN
// ============================================================
app.delete('/api/admin/delete-plan/:planKey', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'NOIR_ADMIN_2026') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const planKey = req.params.planKey;
    try {
        await pool.query('DELETE FROM tracking_log WHERE plan_key = $1', [planKey]);
        const result = await pool.query('DELETE FROM date_plans WHERE plan_key = $1 RETURNING *', [planKey]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        res.json({ success: true, message: `Deleted plan: ${planKey}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  API: TRACKING (WITH EMAIL NOTIFICATIONS)
// ============================================================
app.post('/api/track/:planKey', async (req, res) => {
    const planKey = req.params.planKey;
    const { step, data } = req.body;
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const viewerName = data.viewerName || null;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    try {
        await pool.query(
            'INSERT INTO tracking_log (plan_key, step, data, viewer_name, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
            [planKey, step, JSON.stringify(data), viewerName, ip, userAgent]
        );

        let updateQuery = '', updateParams = [];
        switch (step) {
            case 'page_viewed':
                updateQuery = `UPDATE date_plans SET page_viewed = TRUE, viewed_at = $1, updated_at = $2 WHERE plan_key = $3`;
                updateParams = [timestamp, timestamp, planKey];
                break;

            case 'name_entered':
                updateQuery = `
                    UPDATE date_plans 
                    SET viewer_name = $1, recipient_name = $1, updated_at = $2 
                    WHERE plan_key = $3
                `;
                updateParams = [viewerName, timestamp, planKey];
                console.log(`📝 Name entered: "${viewerName}"`);
                
                sendEmail(
                    'admin@noir.com',
                    `📝 ${viewerName} entered their name`,
                    `Plan: ${planKey}\nName: ${viewerName}\nIP: ${ip}`
                );
                break;

            case 'yes_clicked':
                updateQuery = `
                    UPDATE date_plans 
                    SET yes_clicked = TRUE, yes_clicked_at = $1, updated_at = $2,
                        viewer_name = COALESCE(viewer_name, $3),
                        recipient_name = COALESCE(recipient_name, $3)
                    WHERE plan_key = $4
                `;
                updateParams = [timestamp, timestamp, viewerName, planKey];
                
                const clientEmailYes = await getClientEmail(planKey);
                const planResultYes = await pool.query('SELECT recipient_name FROM date_plans WHERE plan_key = $1', [planKey]);
                const recipientNameYes = planResultYes.rows[0]?.recipient_name || 'Your Date';
                const statusLinkYes = `https://noir-date-planner.onrender.com/customer?plan=${planKey}`;
                
                sendEmail(
                    'admin@noir.com',
                    `💛 ${recipientNameYes} said YES!`,
                    `💛 She said YES!\n\nPlan: ${planKey}\nRecipient: ${recipientNameYes}\nTime: ${new Date().toISOString()}\nIP: ${ip}`
                );
                
                if (clientEmailYes) {
                    sendEmail(
                        clientEmailYes,
                        `💛 ${recipientNameYes} said YES! 🎉`,
                        `💛 ${recipientNameYes} said YES! 🎉\n\nShe's planning the date now!\n\n📊 Track live: ${statusLinkYes}\n\n- Noir Team`
                    );
                }
                break;

            case 'vibe_selected':
                updateQuery = `UPDATE date_plans SET vibe_selected = $1, updated_at = $2 WHERE plan_key = $3`;
                updateParams = [data.vibe || data.label, timestamp, planKey];
                
                sendEmail(
                    'admin@noir.com',
                    `🎯 Vibe Selected: ${data.vibe || data.label}`,
                    `Plan: ${planKey}\nVibe: ${data.vibe || data.label}\nTime: ${new Date().toISOString()}`
                );
                break;

            case 'place_selected':
                updateQuery = `UPDATE date_plans SET place_selected = $1, updated_at = $2 WHERE plan_key = $3`;
                updateParams = [data.place, timestamp, planKey];
                
                sendEmail(
                    'admin@noir.com',
                    `📍 Place Chosen: ${data.place}`,
                    `Plan: ${planKey}\nPlace: ${data.place}\nTime: ${new Date().toISOString()}`
                );
                break;

            case 'date_confirmed':
                updateQuery = `UPDATE date_plans SET date_confirmed = $1, confirmed_at = $2, updated_at = $3 WHERE plan_key = $4`;
                updateParams = [data.details, timestamp, timestamp, planKey];
                
                const clientEmailConfirm = await getClientEmail(planKey);
                const planResultConfirm = await pool.query('SELECT recipient_name FROM date_plans WHERE plan_key = $1', [planKey]);
                const recipientNameConfirm = planResultConfirm.rows[0]?.recipient_name || 'Your Date';
                const statusLink = `https://noir-date-planner.onrender.com/customer?plan=${planKey}`;
                
                sendEmail(
                    'admin@noir.com',
                    `📅 ${recipientNameConfirm} Confirmed the Date!`,
                    `📅 Date Confirmed!\n\nPlan: ${planKey}\nRecipient: ${recipientNameConfirm}\nDetails: ${data.details}\nTime: ${new Date().toISOString()}`
                );
                
                if (clientEmailConfirm) {
                    sendEmail(
                        clientEmailConfirm,
                        `💛 ${recipientNameConfirm} said YES! 🎉 - View Her Response`,
                        `Hi there,\n\n${recipientNameConfirm} said YES! 🎉\n\n📊 View her full response here:\n${statusLink}\n\nDetails:\n${data.details.replace(/ · /g, '\n')}\n\n💛 Congratulations!\n\n- Noir Team`,
                        `<h2>💛 ${recipientNameConfirm} said YES! 🎉</h2>
                         <p><strong>📊 View her full response:</strong><br>
                         <a href="${statusLink}" style="color:#00f0ff;">${statusLink}</a></p>
                         <p><strong>Details:</strong><br>
                         ${data.details.replace(/ · /g, '<br>')}</p>
                         <p>💛 Congratulations!</p>
                         <p>- Noir Team</p>`
                    );
                    console.log(`📧 Customer status email sent to: ${clientEmailConfirm}`);
                }
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
//  API: CUSTOMER STATUS
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

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ============================================================
//  START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 NOIR DATE PLANNER - SENDGRID ✅ (SECURE!)          ║
║                                                           ║
║  📡 Server: http://localhost:${PORT}                      ║
║  📊 Admin: http://localhost:${PORT}/admin               ║
║  👤 Customer: http://localhost:${PORT}/customer?plan=KEY ║
║  🔐 Login: http://localhost:${PORT}/login               ║
║                                                           ║
║  📧 Email: noir.invites@gmail.com  ✅                   ║
║  📤 SendGrid: API key from Render Environment           ║
║  🔒 NO API KEY IN CODE!                                 ║
║  ⚡ Speed: Fire & Forget (NO WAITING!)                  ║
║  🔑 Admin Key: NOIR_ADMIN_2026                           ║
║  👤 Admin: admin@noir.com / admin123                     ║
║                                                           ║
║  💛 Ready!                                               ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

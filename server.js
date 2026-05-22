// =============================================
// FindIt — Lost & Found
// server.js — Express + MySQL Backend
// =============================================

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'findit-sti-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// ── MySQL Connection Pool ──────────────────────────────────────────────────
let pool;
if (process.env.DATABASE_URL) {
  // Connection via full Cloud URL (e.g. mysql://user:pass@host:port/db)
  pool = mysql.createPool(process.env.DATABASE_URL);
} else if (process.env.MYSQLHOST) {
  // Railway auto-injects these variables when a MySQL service is linked
  pool = mysql.createPool({
    host:     process.env.MYSQLHOST,
    user:     process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port:     parseInt(process.env.MYSQLPORT || '3306'),
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10
  });
} else {
  // Local fallback
  pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '12345678',
    database: process.env.DB_NAME     || 'findit_db',
    port:     parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10
  });
}

// Test DB connection on startup
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected to database');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err);
    console.error('   Make sure MySQL is running and database exists.');
    console.error('   Run: mysql -u root < database/schema.sql');
  }
})();

// ── Auth Middleware ─────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    console.error('Auth failed: session is', req.session);
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════════════════

// ── Register ──
app.post('/api/auth/register', async (req, res) => {
  try {
    const { first_name, last_name, email, password, phone } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if email exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (first_name, last_name, email, password, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [first_name, last_name, email, hashedPassword, phone || '', 'user']
    );

    // Auto-login after registration
    req.session.userId = result.insertId;
    req.session.role = 'user';
    req.session.userName = first_name + ' ' + last_name;

    res.status(201).json({
      message: 'Account created successfully',
      user: { id: result.insertId, first_name, last_name, email, role: 'user' }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Login ──
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.userName = user.first_name + ' ' + user.last_name;

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Logout ──
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logged out' });
  });
});

// ── Get Current User ──
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, first_name, last_name, email, phone, role, created_at FROM users WHERE id = ?',
      [req.session.userId]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Update Profile ──
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password } = req.body;
    const userId = req.session.userId;

    if (password && password.length > 0) {
      const hashed = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE users SET first_name=?, last_name=?, email=?, phone=?, password=? WHERE id=?',
        [first_name, last_name, email, phone || '', hashed, userId]
      );
    } else {
      await pool.query(
        'UPDATE users SET first_name=?, last_name=?, email=?, phone=? WHERE id=?',
        [first_name, last_name, email, phone || '', userId]
      );
    }

    req.session.userName = first_name + ' ' + last_name;
    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ════════════════════════════════════════════════════════════════════════════
// ITEMS ROUTES
// ════════════════════════════════════════════════════════════════════════════

// ── List Items (with filters) ──
app.get('/api/items', requireAuth, async (req, res) => {
  try {
    const { status, category, search, limit } = req.query;
    let sql = `SELECT items.*, users.first_name AS poster_first, users.last_name AS poster_last
               FROM items JOIN users ON items.user_id = users.id WHERE 1=1`;
    const params = [];

    if (status) { sql += ' AND items.status = ?'; params.push(status); }
    if (category) { sql += ' AND items.category = ?'; params.push(category); }
    if (search) {
      sql += ' AND (items.name LIKE ? OR items.location LIKE ? OR items.description LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    sql += ' ORDER BY items.created_at DESC';
    if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }

    const [rows] = await pool.query(sql, params);

    // Add poster field
    const items = rows.map(r => ({
      ...r,
      poster: r.poster_first + ' ' + r.poster_last
    }));

    res.json(items);
  } catch (err) {
    console.error('List items error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Get Single Item ──
app.get('/api/items/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT items.*, users.first_name AS poster_first, users.last_name AS poster_last
       FROM items JOIN users ON items.user_id = users.id WHERE items.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    const item = rows[0];
    item.poster = item.poster_first + ' ' + item.poster_last;
    res.json(item);
  } catch (err) {
    console.error('Get item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Create Item ──
app.post('/api/items', requireAuth, async (req, res) => {
  try {
    const { name, type, category, date_reported, location, description, contact } = req.body;

    if (!name || !type || !date_reported || !location) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const [result] = await pool.query(
      `INSERT INTO items (user_id, name, type, category, date_reported, location, description, contact, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.session.userId, name, type, category || 'Other', date_reported, location, description || '', contact || '', type]
    );

    res.status(201).json({ message: 'Item reported', id: result.insertId });
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Delete Item (admin) ──
app.delete('/api/items/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM items WHERE id = ?', [req.params.id]);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('Delete item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Get My Items ──
app.get('/api/my-items', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT items.*, users.first_name AS poster_first, users.last_name AS poster_last
       FROM items JOIN users ON items.user_id = users.id WHERE items.user_id = ? ORDER BY items.created_at DESC`,
      [req.session.userId]
    );
    const items = rows.map(r => ({ ...r, poster: r.poster_first + ' ' + r.poster_last }));
    res.json(items);
  } catch (err) {
    console.error('My items error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ════════════════════════════════════════════════════════════════════════════
// CLAIMS ROUTES
// ════════════════════════════════════════════════════════════════════════════

// ── List Claims ──
app.get('/api/claims', requireAuth, async (req, res) => {
  try {
    let sql, params;
    if (req.session.role === 'admin') {
      sql = `SELECT claims.*, items.name AS item_name
             FROM claims JOIN items ON claims.item_id = items.id
             ORDER BY claims.created_at DESC`;
      params = [];
    } else {
      sql = `SELECT claims.*, items.name AS item_name
             FROM claims JOIN items ON claims.item_id = items.id
             WHERE claims.user_id = ? ORDER BY claims.created_at DESC`;
      params = [req.session.userId];
    }
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('List claims error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Submit Claim ──
app.post('/api/claims', requireAuth, async (req, res) => {
  try {
    const { item_id, claimant_name, proof, contact } = req.body;

    if (!item_id || !claimant_name || !proof) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const [result] = await pool.query(
      'INSERT INTO claims (item_id, user_id, claimant_name, proof, contact, status) VALUES (?, ?, ?, ?, ?, ?)',
      [item_id, req.session.userId, claimant_name, proof, contact || '', 'pending']
    );

    res.status(201).json({ message: 'Claim submitted', id: result.insertId });
  } catch (err) {
    console.error('Submit claim error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Approve Claim (admin) ──
app.put('/api/claims/:id/approve', requireAdmin, async (req, res) => {
  try {
    const [claims] = await pool.query('SELECT * FROM claims WHERE id = ?', [req.params.id]);
    if (claims.length === 0) return res.status(404).json({ error: 'Claim not found' });

    const claim = claims[0];
    await pool.query('UPDATE claims SET status = ? WHERE id = ?', ['approved', claim.id]);
    await pool.query('UPDATE items SET status = ? WHERE id = ?', ['claimed', claim.item_id]);

    res.json({ message: 'Claim approved' });
  } catch (err) {
    console.error('Approve claim error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Reject Claim (admin) ──
app.put('/api/claims/:id/reject', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE claims SET status = ? WHERE id = ?', ['rejected', req.params.id]);
    res.json({ message: 'Claim rejected' });
  } catch (err) {
    console.error('Reject claim error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ════════════════════════════════════════════════════════════════════════════
// STATS ROUTE
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const [[{ lost }]] = await pool.query('SELECT COUNT(*) AS lost FROM items WHERE status = "lost"');
    const [[{ found }]] = await pool.query('SELECT COUNT(*) AS found FROM items WHERE status = "found"');
    const [[{ claimed }]] = await pool.query('SELECT COUNT(*) AS claimed FROM items WHERE status = "claimed"');
    const [[{ pending }]] = await pool.query('SELECT COUNT(*) AS pending FROM claims WHERE status = "pending"');
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM items');

    const rate = total > 0 ? Math.round((claimed / total) * 100) : 0;

    res.json({ lost, found, claimed, pending, total, rate });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ════════════════════════════════════════════════════════════════════════════
// PAGE ROUTES
// ════════════════════════════════════════════════════════════════════════════

// Serve admin page only if admin
app.get('/admin.html', (req, res) => {
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve login page
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Redirect root to index
app.get('/', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 FindIt server running at http://localhost:${PORT}`);
  console.log(`   Login page:  http://localhost:${PORT}/login.html`);
  console.log(`   Admin login: admin@findit.com / admin123\n`);
});

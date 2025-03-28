require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise'); // Using mysql2 with promises
const path = require('path')
const cors = require('cors')

const app = express();

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'dist')));

// Catch-all route to serve index.html for React routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = 5000;

// Database configuration
const pool = mysql.createPool({
  host: 'sql5.freesqldatabase.com',
  user: 'sql5769448',
  password: 'QHhtRJMIUA',
  database: 'sql5769448',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection on startup
async function testDbConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('✅ Successfully connected to MySQL database');
    await connection.query('SELECT 1'); // Simple test query
  } catch (err) {
    console.error('❌ Failed to connect to MySQL:', err.message);
    process.exit(1); // Exit if can't connect
  } finally {
    if (connection) connection.release();
  }
}

// Call the test function when starting
testDbConnection().catch(console.error);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.post('/api/login', async (req, res) => {
  const { username } = req.body;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Record individual login
    await connection.query(
      'INSERT INTO user_logins (username, ip_address) VALUES (?, ?)',
      [username, ipAddress]
    );

    // 2. Update daily stats
    const today = new Date().toISOString().split('T')[0];
    
    // Try to update existing record
    const [updateResult] = await connection.query(
      'UPDATE daily_stats SET login_count = login_count + 1 WHERE stat_date = ?',
      [today]
    );

    // If no rows were updated, insert new record
    if (updateResult.affectedRows === 0) {
      await connection.query(
        'INSERT INTO daily_stats (stat_date, login_count) VALUES (?, 1)',
        [today]
      );
    }

    await connection.commit();
    res.status(200).json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Login tracking error:', error);
    res.status(500).json({ success: false, error: 'Failed to track login' });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/stats', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Get daily stats for last 30 days
    const [dailyStats] = await connection.query(
      'SELECT * FROM daily_stats ORDER BY stat_date DESC LIMIT 30'
    );

    // Get unique user count
    const [[uniqueUsers]] = await connection.query(
      'SELECT COUNT(DISTINCT username) as count FROM user_logins'
    );

    // Get total login count
    const [[totalLogins]] = await connection.query(
      'SELECT COUNT(*) as count FROM user_logins'
    );

    res.json({
      dailyStats,
      totalLogins: totalLogins.count,
      uniqueUsers: uniqueUsers.count
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware to verify token
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all transactions
router.get('/', authMiddleware, (req, res) => {
  const query = 'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC';
  db.query(query, [req.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Create transaction
router.post('/', authMiddleware, (req, res) => {
  const { type, amount, category, division, description, account } = req.body;

  const query = 'INSERT INTO transactions (user_id, type, amount, category, division, description, account) VALUES (?, ?, ?, ?, ?, ?, ?)';
  db.query(query, [req.userId, type, amount, category, division, description, account], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    // Update account balance
    const updateAccountQuery = 'UPDATE accounts SET balance = balance + ? WHERE user_id = ? AND name = ?';
    const balanceChange = type === 'income' ? parseFloat(amount) : -parseFloat(amount);
    db.query(updateAccountQuery, [balanceChange, req.userId, account], (err) => {
      if (err) console.error('Failed to update account balance:', err);
    });

    res.status(201).json({ id: result.insertId, message: 'Transaction created' });
  });
});

// Update transaction
router.put('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { amount, category, division, description } = req.body;

  const query = 'UPDATE transactions SET amount = ?, category = ?, division = ?, description = ? WHERE id = ? AND user_id = ?';
  db.query(query, [amount, category, division, description, id, req.userId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ message: 'Transaction updated' });
  });
});

// Get summary
router.get('/summary/:view', authMiddleware, (req, res) => {
  const { view } = req.params;
  let dateFilter = '';

  if (view === 'weekly') {
    dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  } else if (view === 'monthly') {
    dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  } else if (view === 'yearly') {
    dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)';
  }

  const query = `SELECT type, SUM(amount) as total FROM transactions WHERE user_id = ? ${dateFilter} GROUP BY type`;
  db.query(query, [req.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Get category summary
router.get('/summary/category', authMiddleware, (req, res) => {
  const query = 'SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = "expense" GROUP BY category';
  db.query(query, [req.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Filter transactions
router.get('/filter', authMiddleware, (req, res) => {
  const { category, division, from, to } = req.query;
  let query = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [req.userId];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (division) {
    query += ' AND division = ?';
    params.push(division);
  }
  if (from) {
    query += ' AND created_at >= ?';
    params.push(from);
  }
  if (to) {
    query += ' AND created_at <= ?';
    params.push(to);
  }

  query += ' ORDER BY created_at DESC';

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Get accounts
router.get('/accounts', authMiddleware, (req, res) => {
  const query = 'SELECT * FROM accounts WHERE user_id = ?';
  db.query(query, [req.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Create account
router.post('/accounts', authMiddleware, (req, res) => {
  const { name, balance } = req.body;

  const query = 'INSERT INTO accounts (user_id, name, balance) VALUES (?, ?, ?)';
  db.query(query, [req.userId, name, balance || 0], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.status(201).json({ id: result.insertId, message: 'Account created' });
  });
});

module.exports = router;
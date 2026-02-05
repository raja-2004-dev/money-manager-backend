const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production');
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all transactions
router.get('/', auth, (req, res) => {
  db.query(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC',
    [req.userId],
    (err, results) => {
      if (err) {
        console.error('Get transactions error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results);
    }
  );
});

// Create transaction
router.post('/', auth, (req, res) => {
  const { type, amount, category, division, description, account } = req.body;

  db.query(
    'INSERT INTO transactions (user_id, type, amount, category, division, description, account) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.userId, type, amount, category, division || 'Personal', description, account],
    (err, result) => {
      if (err) {
        console.error('Create transaction error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Update account balance
      const balanceChange = type === 'income' ? parseFloat(amount) : -parseFloat(amount);
      db.query(
        'UPDATE accounts SET balance = balance + ? WHERE user_id = ? AND name = ?',
        [balanceChange, req.userId, account],
        (err) => {
          if (err) console.error('Update balance error:', err);
        }
      );

      res.status(201).json({ id: result.insertId, message: 'Transaction created' });
    }
  );
});

// Update transaction
router.put('/:id', auth, (req, res) => {
  const { amount, category, division, description } = req.body;

  db.query(
    'UPDATE transactions SET amount = ?, category = ?, division = ?, description = ? WHERE id = ? AND user_id = ?',
    [amount, category, division, description, req.params.id, req.userId],
    (err, result) => {
      if (err) {
        console.error('Update transaction error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      res.json({ message: 'Transaction updated' });
    }
  );
});

// Get summary
router.get('/summary/:view', auth, (req, res) => {
  let dateFilter = '';
  
  if (req.params.view === 'weekly') {
    dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  } else if (req.params.view === 'monthly') {
    dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  } else if (req.params.view === 'yearly') {
    dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)';
  }

  db.query(
    `SELECT type, SUM(amount) as total FROM transactions WHERE user_id = ? ${dateFilter} GROUP BY type`,
    [req.userId],
    (err, results) => {
      if (err) {
        console.error('Get summary error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results);
    }
  );
});

// Get category summary
router.get('/summary/category', auth, (req, res) => {
  db.query(
    'SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = ? GROUP BY category',
    [req.userId, 'expense'],
    (err, results) => {
      if (err) {
        console.error('Get category summary error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results);
    }
  );
});

// Filter transactions
router.get('/filter', auth, (req, res) => {
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
    if (err) {
      console.error('Filter transactions error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// Get accounts
router.get('/accounts', auth, (req, res) => {
  db.query(
    'SELECT * FROM accounts WHERE user_id = ?',
    [req.userId],
    (err, results) => {
      if (err) {
        console.error('Get accounts error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results);
    }
  );
});

// Create account
router.post('/accounts', auth, (req, res) => {
  const { name, balance } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Account name is required' });
  }

  db.query(
    'INSERT INTO accounts (user_id, name, balance) VALUES (?, ?, ?)',
    [req.userId, name, balance || 0],
    (err, result) => {
      if (err) {
        console.error('Create account error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({ id: result.insertId, message: 'Account created' });
    }
  );
});

module.exports = router;
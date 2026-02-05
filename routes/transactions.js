const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.get('/', auth, (req, res) => {
  db.query('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC', [req.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

router.post('/', auth, (req, res) => {
  const { type, amount, category, division, description, account } = req.body;
  db.query('INSERT INTO transactions (user_id, type, amount, category, division, description, account) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [req.userId, type, amount, category, division || 'Personal', description, account], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const balanceChange = type === 'income' ? parseFloat(amount) : -parseFloat(amount);
    db.query('UPDATE accounts SET balance = balance + ? WHERE user_id = ? AND name = ?', [balanceChange, req.userId, account], () => {});
    res.status(201).json({ id: result.insertId, message: 'Transaction created' });
  });
});

router.put('/:id', auth, (req, res) => {
  const { amount, category, division, description } = req.body;
  db.query('UPDATE transactions SET amount = ?, category = ?, division = ?, description = ? WHERE id = ? AND user_id = ?', 
    [amount, category, division, description, req.params.id, req.userId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Updated' });
  });
});

router.get('/summary/:view', auth, (req, res) => {
  let dateFilter = '';
  if (req.params.view === 'weekly') dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  else if (req.params.view === 'monthly') dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  else if (req.params.view === 'yearly') dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)';
  
  db.query(`SELECT type, SUM(amount) as total FROM transactions WHERE user_id = ? ${dateFilter} GROUP BY type`, [req.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

router.get('/summary/category', auth, (req, res) => {
  db.query('SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = ? GROUP BY category', 
    [req.userId, 'expense'], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

router.get('/accounts', auth, (req, res) => {
  db.query('SELECT * FROM accounts WHERE user_id = ?', [req.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

router.post('/accounts', auth, (req, res) => {
  const { name, balance } = req.body;
  if (!name) return res.status(400).json({ error: 'Account name required' });
  db.query('INSERT INTO accounts (user_id, name, balance) VALUES (?, ?, ?)', [req.userId, name, balance || 0], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.status(201).json({ id: result.insertId, message: 'Account created' });
  });
});

module.exports = router;
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

// Signup route
router.post('/signup', async (req, res) => {
  console.log('Signup request received:', req.body);
  
  const { name, email, password } = req.body;

  // Validation
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Check if email already exists
    const checkQuery = 'SELECT * FROM users WHERE email = ?';
    db.query(checkQuery, [email], async (err, results) => {
      if (err) {
        console.error('Database check error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // If email exists, return error
      if (results.length > 0) {
        console.log('Email already exists:', email);
        return res.status(400).json({ error: 'Email already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new user
      const insertQuery = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
      db.query(insertQuery, [name, email, hashedPassword], (err, result) => {
        if (err) {
          console.error('Insert user error:', err);
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Failed to create user' });
        }

        console.log('User created successfully:', email);
        res.status(201).json({ 
          message: 'User created successfully',
          userId: result.insertId 
        });
      });
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login route
router.post('/login', (req, res) => {
  console.log('Login request received:', req.body);
  
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const query = 'SELECT * FROM users WHERE email = ?';
  db.query(query, [email], async (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Check if user exists
    if (results.length === 0) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = results[0];

    try {
      // Compare password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        console.log('Invalid password for:', email);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Create JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      console.log('Login successful:', email);
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email 
        } 
      });
    } catch (error) {
      console.error('Password comparison error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

module.exports = router;
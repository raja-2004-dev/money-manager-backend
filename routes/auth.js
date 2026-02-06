const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

// Signup route
router.post('/signup', async (req, res) => {
  console.log('📝 Signup request received:', { email: req.body.email, name: req.body.name });
  const { name, email, password } = req.body;

  // Validation
  if (!name || !email || !password) {
    console.log('❌ Missing fields');
    return res.status(400).json({ error: 'All fields required' });
  }

  if (password.length < 6) {
    console.log('❌ Password too short');
    return res.status(400).json({ error: 'Password must be 6+ characters' });
  }

  try {
    console.log('🔍 Checking if email exists...');
    db.query('SELECT id FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('❌ Database query error:', err.message);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      
      if (results.length > 0) {
        console.log('❌ Email already exists:', email);
        return res.status(400).json({ error: 'Email already exists' });
      }

      try {
        console.log('🔐 Hashing password...');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        console.log('💾 Inserting user into database...');
        db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword], (err, result) => {
          if (err) {
            console.error('❌ Insert error:', err.message);
            return res.status(500).json({ error: 'Failed to create user: ' + err.message });
          }
          console.log('✅ User created successfully with ID:', result.insertId);
          res.status(201).json({ message: 'User created successfully', userId: result.insertId });
        });
      } catch (hashError) {
        console.error('❌ Password hashing error:', hashError.message);
        res.status(500).json({ error: 'Password hashing failed: ' + hashError.message });
      }
    });
  } catch (error) {
    console.error('❌ Signup error:', error.message);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Login route
router.post('/login', (req, res) => {
  console.log('🔐 Login request received:', { email: req.body.email });
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    console.log('❌ Missing email or password');
    return res.status(400).json({ error: 'Email and password required' });
  }

  console.log('🔍 Looking up user...');
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) {
      console.error('❌ Database error:', err.message);
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }

    if (results.length === 0) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = results[0];
    console.log('👤 User found:', user.id);

    try {
      console.log('🔐 Comparing password...');
      const validPassword = await bcrypt.compare(password, user.password);
      
      if (!validPassword) {
        console.log('❌ Invalid password for user:', email);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      console.log('🎫 Generating JWT token...');
      const token = jwt.sign(
        { id: user.id, email: user.email }, 
        process.env.JWT_SECRET || 'fallback-secret-key', 
        { expiresIn: '30d' }
      );
      
      console.log('✅ Login successful for user:', email);
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email 
        } 
      });
    } catch (compareError) {
      console.error('❌ Password comparison error:', compareError.message);
      res.status(500).json({ error: 'Authentication failed: ' + compareError.message });
    }
  });
});

module.exports = router;
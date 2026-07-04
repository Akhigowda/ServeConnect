const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

const router = express.Router();

// ============================================
// POST /api/auth/signup
// ============================================
router.post('/signup', async (req, res) => {
  try {
    const { role, full_name, phone, password, college_name, business_name } = req.body;

    if (!role || !full_name || !phone || !password) {
      return res.status(400).json({ error: 'role, full_name, phone and password are required' });
    }
    if (!['student', 'caterer'].includes(role)) {
      return res.status(400).json({ error: 'role must be student or caterer' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this phone number already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await pool.query(
      `INSERT INTO users (id, role, full_name, phone, password_hash, college_name, business_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, role, full_name, phone, password_hash, college_name || null, business_name || null]
    );

    const token = jwt.sign({ id, role, phone }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    res.status(201).json({
      message: 'Account created',
      token,
      user: { id, role, full_name, phone }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong during signup' });
  }
});

// ============================================
// POST /api/auth/login
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'phone and password are required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        role: user.role,
        full_name: user.full_name,
        phone: user.phone,
        college_name: user.college_name,
        business_name: user.business_name,
        reliability_score: user.reliability_score
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong during login' });
  }
});

module.exports = router;

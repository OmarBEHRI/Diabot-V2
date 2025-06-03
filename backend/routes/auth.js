/**
 * Authentication Routes
 * 
 * Handles user authentication for the Diabot application:
 * - User registration with password hashing
 * - User login with credential verification
 * - JWT token generation for authenticated sessions
 * - Error handling for invalid credentials and server errors
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'diabot-secret-key';

// Register a new user
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Simple validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter all fields' });
  }

  const db = getDb();

  try {
    // Check if user already exists
    const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user into database
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hashedPassword);
    
    // Create JWT token
    const token = jwt.sign(
      { user: { id: result.lastInsertRowid } },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: result.lastInsertRowid,
        username
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter all fields' });
  }

  const db = getDb();

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { user: { id: user.id } },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

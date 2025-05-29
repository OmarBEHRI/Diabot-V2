import express from 'express';
import { getDb } from '../db.js';

const router = express.Router();

// Get all topics
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const topics = db.prepare('SELECT * FROM topics').all();
    res.json(topics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a specific topic by ID
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    res.json(topic);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

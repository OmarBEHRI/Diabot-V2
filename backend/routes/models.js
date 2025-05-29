import express from 'express';
import { getDb } from '../db.js';

const router = express.Router();

// Get all models
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const models = db.prepare('SELECT * FROM models').all();
    res.json(models);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a specific model by ID
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json(model);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

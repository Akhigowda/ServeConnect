const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================
// POST /api/ratings  (either side rates the other after a job)
// body: { job_id, to_user_id, score, comment }
// ============================================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { job_id, to_user_id, score, comment } = req.body;

    if (!job_id || !to_user_id || !score) {
      return res.status(400).json({ error: 'job_id, to_user_id and score are required' });
    }
    if (score < 1 || score > 5) {
      return res.status(400).json({ error: 'score must be between 1 and 5' });
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO ratings (id, job_id, from_user_id, to_user_id, score, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, job_id, req.user.id, to_user_id, score, comment || null]
    );

    // Recompute average rating-based score for the recipient (blended with reliability elsewhere)
    await pool.query(
      `UPDATE users SET reliability_score = (
         SELECT ROUND(AVG(score), 2) FROM ratings WHERE to_user_id = ?
       ) WHERE id = ?`,
      [to_user_id, to_user_id]
    );

    res.status(201).json({ message: 'Rating submitted' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You already rated this person for this job' });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not submit rating' });
  }
});

// ============================================
// GET /api/ratings/user/:userId  (view all ratings received by a user)
// ============================================
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    const [ratings] = await pool.query(
      `SELECT r.score, r.comment, r.created_at, u.full_name AS from_name
       FROM ratings r JOIN users u ON r.from_user_id = u.id
       WHERE r.to_user_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.userId]
    );
    res.json({ ratings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch ratings' });
  }
});

module.exports = router;

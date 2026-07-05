const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// ============================================
// POST /api/jobs  (caterer posts a new job)
// ============================================
router.post('/', requireAuth, requireRole('caterer'), async (req, res) => {
  try {
    const { title, description, event_date, start_time, end_time, location, pay_rate, workers_needed } = req.body;

    if (!title || !event_date || !start_time || !end_time || !location || !pay_rate || !workers_needed) {
      return res.status(400).json({ error: 'Missing required job fields' });
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO jobs (id, caterer_id, title, description, event_date, start_time, end_time, location, pay_rate, workers_needed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, title, description || null, event_date, start_time, end_time, location, pay_rate, workers_needed]
    );

    res.status(201).json({ message: 'Job posted', job_id: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create job' });
  }
});

// ============================================
// GET /api/jobs  (students browse open jobs)
// Supports optional ?location= filter
// ============================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const { location } = req.query;
    let query = `
      SELECT j.*, u.business_name, u.full_name AS caterer_name,
             (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status != 'withdrawn') AS applicant_count,
             a_me.id AS my_application_id,
             a_me.status AS my_application_status
      FROM jobs j
      JOIN users u ON j.caterer_id = u.id
      LEFT JOIN applications a_me ON a_me.job_id = j.id AND a_me.student_id = ?
      WHERE j.status = 'open'
    `;
    const params = [req.user.id];

    if (location) {
      query += ' AND j.location LIKE ?';
      params.push(`%${location}%`);
    }

    query += ' ORDER BY j.event_date ASC';

    const [jobs] = await pool.query(query, params);
    res.json({ jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch jobs' });
  }
});

// ============================================
// GET /api/jobs/mine  (caterer views their own posted jobs)
// ============================================
router.get('/mine', requireAuth, requireRole('caterer'), async (req, res) => {
  try {
    const [jobs] = await pool.query(
      'SELECT * FROM jobs WHERE caterer_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch your jobs' });
  }
});

// ============================================
// GET /api/jobs/:id  (view single job with applicant count)
// ============================================
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [jobs] = await pool.query(
      `SELECT j.*, u.business_name, u.full_name AS caterer_name
       FROM jobs j JOIN users u ON j.caterer_id = u.id
       WHERE j.id = ?`,
      [req.params.id]
    );
    if (jobs.length === 0) return res.status(404).json({ error: 'Job not found' });
    res.json({ job: jobs[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch job' });
  }
});

// ============================================
// PATCH /api/jobs/:id/cancel  (caterer cancels a job)
// ============================================
router.patch('/:id/cancel', requireAuth, requireRole('caterer'), async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE jobs SET status = 'cancelled' WHERE id = ? AND caterer_id = ?`,
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Job not found or not yours' });
    }
    res.json({ message: 'Job cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not cancel job' });
  }
});

module.exports = router;

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// ============================================
// POST /api/applications  (student applies to a job)
// ============================================
router.post('/', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ error: 'job_id is required' });

    const [jobs] = await pool.query('SELECT * FROM jobs WHERE id = ?', [job_id]);
    if (jobs.length === 0) return res.status(404).json({ error: 'Job not found' });
    if (jobs[0].status !== 'open') {
      return res.status(400).json({ error: 'This job is no longer accepting applications' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM applications WHERE job_id = ? AND student_id = ?',
      [job_id, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'You already applied to this job' });
    }

    const id = uuidv4();
    await pool.query(
      'INSERT INTO applications (id, job_id, student_id) VALUES (?, ?, ?)',
      [id, job_id, req.user.id]
    );

    res.status(201).json({ message: 'Application submitted', application_id: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not submit application' });
  }
});

// ============================================
// GET /api/applications/job/:jobId  (caterer views applicants for their job)
// ============================================
router.get('/job/:jobId', requireAuth, requireRole('caterer'), async (req, res) => {
  try {
    const [jobs] = await pool.query('SELECT * FROM jobs WHERE id = ? AND caterer_id = ?', [
      req.params.jobId,
      req.user.id
    ]);
    if (jobs.length === 0) return res.status(404).json({ error: 'Job not found or not yours' });

    const [applicants] = await pool.query(
      `SELECT a.id AS application_id, a.status, a.applied_at, a.confirmation_deadline,
              u.id AS student_id, u.full_name, u.phone, u.college_name, u.reliability_score, u.total_gigs_completed
       FROM applications a
       JOIN users u ON a.student_id = u.id
       WHERE a.job_id = ?
       ORDER BY a.applied_at ASC`,
      [req.params.jobId]
    );

    res.json({ job: jobs[0], applicants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch applicants' });
  }
});

// ============================================
// GET /api/applications/mine  (student views their own applications)
// ============================================
router.get('/mine', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const [applications] = await pool.query(
      `SELECT a.id AS application_id, a.status, a.applied_at, a.confirmation_deadline,
              j.id AS job_id, j.title, j.event_date, j.start_time, j.end_time, j.location, j.pay_rate,
              u.business_name, u.full_name AS caterer_name
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       JOIN users u ON j.caterer_id = u.id
       WHERE a.student_id = ?
       ORDER BY a.applied_at DESC`,
      [req.user.id]
    );
    res.json({ applications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch your applications' });
  }
});

// ============================================
// PATCH /api/applications/:id/select  (caterer selects an applicant)
// Sets a 24-hour confirmation window
// ============================================
router.patch('/:id/select', requireAuth, requireRole('caterer'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, j.caterer_id, j.status AS job_status
       FROM applications a JOIN jobs j ON a.job_id = j.id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Application not found' });
    const application = rows[0];

    if (application.caterer_id !== req.user.id) {
      return res.status(403).json({ error: 'This is not your job posting' });
    }
    if (application.job_status !== 'open') {
      return res.status(400).json({ error: 'This job is no longer open' });
    }

    await pool.query(
      `UPDATE applications SET status = 'selected', confirmation_deadline = DATE_ADD(NOW(), INTERVAL 24 HOUR)
       WHERE id = ?`,
      [req.params.id]
    );

    res.json({ message: 'Applicant selected. Waiting for their confirmation.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not select applicant' });
  }
});

// ============================================
// PATCH /api/applications/:id/reject  (caterer rejects an applicant)
// ============================================
router.patch('/:id/reject', requireAuth, requireRole('caterer'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, j.caterer_id FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Application not found' });
    if (rows[0].caterer_id !== req.user.id) {
      return res.status(403).json({ error: 'This is not your job posting' });
    }

    await pool.query(`UPDATE applications SET status = 'rejected' WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Applicant rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reject applicant' });
  }
});

// ============================================
// PATCH /api/applications/:id/confirm  (student confirms their selection)
// Auto-closes the job if workers_needed is now met
// ============================================
router.patch('/:id/confirm', requireAuth, requireRole('student'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Application not found' });
    const application = rows[0];

    if (application.student_id !== req.user.id) {
      return res.status(403).json({ error: 'This is not your application' });
    }
    if (application.status !== 'selected') {
      return res.status(400).json({ error: 'This application is not awaiting confirmation' });
    }
    if (new Date(application.confirmation_deadline) < new Date()) {
      return res.status(400).json({ error: 'Confirmation window has expired' });
    }

    await connection.beginTransaction();

    await connection.query(`UPDATE applications SET status = 'confirmed' WHERE id = ?`, [req.params.id]);

    const [jobRows] = await connection.query('SELECT * FROM jobs WHERE id = ? FOR UPDATE', [application.job_id]);
    const job = jobRows[0];
    const newConfirmedCount = job.workers_confirmed + 1;
    const newStatus = newConfirmedCount >= job.workers_needed ? 'filled' : job.status;

    await connection.query('UPDATE jobs SET workers_confirmed = ?, status = ? WHERE id = ?', [
      newConfirmedCount,
      newStatus,
      job.id
    ]);

    await connection.commit();
    res.json({ message: 'Confirmed! You are booked for this gig.', job_status: newStatus });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Could not confirm application' });
  } finally {
    connection.release();
  }
});

// ============================================
// PATCH /api/applications/:id/withdraw  (student withdraws their application)
// ============================================
router.patch('/:id/withdraw', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE applications SET status = 'withdrawn' WHERE id = ? AND student_id = ? AND status IN ('applied','selected')`,
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Application not found or cannot be withdrawn' });
    }
    res.json({ message: 'Application withdrawn' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not withdraw application' });
  }
});

// ============================================
// PATCH /api/applications/:id/no-show  (caterer marks a confirmed worker as a no-show)
// This feeds the student's reliability score
// ============================================
router.patch('/:id/no-show', requireAuth, requireRole('caterer'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, j.caterer_id FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Application not found' });
    const application = rows[0];

    if (application.caterer_id !== req.user.id) {
      return res.status(403).json({ error: 'This is not your job posting' });
    }
    if (application.status !== 'confirmed') {
      return res.status(400).json({ error: 'Only confirmed applicants can be marked as no-show' });
    }

    await pool.query(`UPDATE applications SET status = 'no_show' WHERE id = ?`, [req.params.id]);

    // Simple reliability penalty: recompute score as ratio of non-no-show completed gigs
    await pool.query(
      `UPDATE users u
       SET reliability_score = (
         SELECT ROUND(
           (COUNT(CASE WHEN a.status IN ('confirmed') THEN 1 END) * 1.0) /
           GREATEST(COUNT(CASE WHEN a.status IN ('confirmed','no_show') THEN 1 END), 1) * 5
         , 2)
         FROM applications a WHERE a.student_id = u.id
       )
       WHERE u.id = ?`,
      [application.student_id]
    );

    res.json({ message: 'Marked as no-show. Reliability score updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update application' });
  }
});

module.exports = router;

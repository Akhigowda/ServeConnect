const pool = require('./db');

// Reverts 'selected' applications whose confirmation window has passed back to 'rejected',
// freeing up the slot for the caterer to select someone else.
async function expireStaleSelections() {
  try {
    const [result] = await pool.query(
      `UPDATE applications
       SET status = 'rejected'
       WHERE status = 'selected' AND confirmation_deadline < NOW()`
    );
    if (result.affectedRows > 0) {
      console.log(`[scheduler] Expired ${result.affectedRows} unconfirmed selection(s)`);
    }
  } catch (err) {
    console.error('[scheduler] Failed to expire stale selections:', err.message);
  }
}

// Marks jobs as 'completed' once their event date has passed, so the rating flow can trigger.
// Marks jobs as 'completed' once their end time has actually passed, so the rating flow can trigger.
async function completePastJobs() {
  try {
    const [result] = await pool.query(
      `UPDATE jobs
       SET status = 'completed'
       WHERE status IN ('open', 'filled')
       AND TIMESTAMP(event_date, end_time) < NOW()`
    );
    if (result.affectedRows > 0) {
      console.log(`[scheduler] Marked ${result.affectedRows} job(s) as completed`);
    }
  } catch (err) {
    console.error('[scheduler] Failed to complete past jobs:', err.message);
  }
}

function startScheduler() {
  const INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

  // Run once on startup, then repeat
  expireStaleSelections();
  completePastJobs();

  setInterval(() => {
    expireStaleSelections();
    completePastJobs();
  }, INTERVAL_MS);

  console.log('[scheduler] Background jobs started (runs every 15 minutes)');
}

module.exports = { startScheduler };

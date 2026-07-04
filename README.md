# ServeConnect

A marketplace connecting students seeking flexible part-time work with caterers and event organizers who need temporary staff.

## Structure

```
serveconnect/
  backend/     Node.js + Express + MySQL API
  frontend/    Plain HTML/CSS/JS (no build step required)
```

## Backend setup

1. Install MySQL locally (or use a hosted MySQL instance).
2. Create the database and tables:
   ```
   mysql -u root -p < backend/schema.sql
   ```
3. Install dependencies:
   ```
   cd backend
   npm install
   ```
4. Copy `.env.example` to `.env` and fill in your MySQL credentials and a random JWT secret:
   ```
   cp .env.example .env
   ```
5. Start the server:
   ```
   npm start
   ```
   The API runs on `http://localhost:5000` by default. Check `http://localhost:5000/api/health` to confirm it's up.

## Frontend setup

The frontend is plain HTML/CSS/JS — no npm install, no build step.

1. Open `frontend/js/api.js` and confirm `API_BASE` points to your backend (defaults to `http://localhost:5000/api`).
2. Open `frontend/index.html` directly in a browser, or serve the folder with any static server, e.g.:
   ```
   cd frontend
   npx serve .
   ```

## What's built (v1 core loop)

- Signup/login (student or caterer) with phone + password, JWT-based auth
- Caterer: post a job, view own jobs, view/select/reject applicants, cancel a job
- Student: browse open jobs, apply, view own applications, confirm a selection, withdraw
- 24-hour confirmation window: once a caterer selects a student, they must confirm within 24 hours or the slot can be reopened
- Jobs auto-close (`status = 'filled'`) once enough workers have confirmed
- No-show marking and a basic reliability score that updates based on confirmed vs. no-show history
- Ratings table + endpoints for post-event mutual rating (UI for this can be added next)

## Not yet built (intentionally deferred)

- Payments — caterers pay workers directly (cash/UPI), off-platform, per the current plan. Caterer subscription/per-post billing isn't wired up yet.
- SMS/OTP verification — currently phone + password. Swap in Twilio/MSG91 when ready for phone verification.
- Automated expiry of unconfirmed selections (needs a scheduled job/cron checking `confirmation_deadline`)
- Post-event rating UI (backend routes exist in `routes/ratings.js`)

## Notes on the reliability score

`no-show` marking recomputes a simple score based on confirmed vs. no-show ratio. Ratings submissions separately recompute an average-of-scores value. In production you'll want to decide how these two blend (e.g., weighted average) rather than one silently overwriting the other — flagged here so it doesn't surprise you later.

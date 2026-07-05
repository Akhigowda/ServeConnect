# ServeConnect Project Details

ServeConnect is a simple full-stack marketplace for campus and event work. It connects students who want short-term shifts with caterers or event organizers who need temporary staff for a specific date and time.

This document is the detailed project reference for the current codebase: what the app does, how it is structured, how data flows through it, and what each major file is responsible for.

## 1. Project Purpose

The goal of ServeConnect is to make it easy for:

- Students to find flexible part-time gigs
- Caterers and event organizers to post jobs and fill shifts quickly
- Both sides to manage applications, confirmations, cancellations, and post-event ratings

The product is currently designed around a core hiring loop:

1. A caterer posts a job.
2. Students browse open jobs and apply.
3. The caterer selects one or more applicants.
4. The student confirms within a deadline.
5. The job fills when enough workers confirm.
6. After the event, both sides can rate each other.

## 2. Tech Stack

### Backend

- Node.js
- Express
- MySQL
- JWT authentication
- bcryptjs for password hashing
- uuid for record IDs
- cors and dotenv for API/runtime setup

### Frontend

- Plain HTML
- Plain CSS
- Plain JavaScript
- No framework or build step

### Database

- MySQL schema stored in `backend/schema.sql`
- Uses four main tables: `users`, `jobs`, `applications`, and `ratings`

## 3. Repository Structure

```text
serveconnect/
  README.md
  PROJECT_DETAILS.md
  backend/
    db.js
    scheduler.js
    schema.sql
    server.js
    package.json
    middleware/
      auth.js
    routes/
      auth.js
      jobs.js
      applications.js
      ratings.js
  frontend/
    index.html
    login.html
    signup.html
    jobs.html
    job-detail.html
    my-applications.html
    my-jobs.html
    post-job.html
    rate.html
    css/
      style.css
    js/
      api.js
```

## 4. How The App Works

### Authentication

Users register and log in with:

- full name
- phone number
- password
- role: student or caterer

After login, the backend returns a JWT token. The frontend stores the token and user profile in local storage and sends the token on API requests.

### Student flow

Students can:

- browse open jobs
- filter jobs by location
- apply to a job
- view all of their applications
- confirm a selection when chosen
- withdraw from a job before it is confirmed
- rate a caterer after the job is completed

### Caterer flow

Caterers can:

- post a new job
- view jobs they created
- open one job and inspect all applicants
- select or reject applicants
- mark a confirmed worker as a no-show
- cancel a job
- rate a student after the job is completed

## 5. Backend Files

### `backend/server.js`

This is the main Express entry point. It:

- loads environment variables
- creates the Express app
- enables JSON parsing and CORS
- mounts all API routers
- starts the HTTP server
- starts the background scheduler after the server begins listening

### `backend/db.js`

Creates and exports the MySQL connection pool using values from `.env`.

### `backend/middleware/auth.js`

Contains request guards for authenticated routes and role-restricted routes.

Typical responsibilities:

- verify JWT token
- load the current user onto the request
- block access if the user is not logged in
- block access if the user does not have the right role

### `backend/routes/auth.js`

Handles signup and login.

Expected responsibilities:

- create user accounts
- hash passwords
- verify credentials
- issue JWT tokens

### `backend/routes/jobs.js`

Handles job posting and job browsing.

Main endpoints:

- `POST /api/jobs` to post a new job
- `GET /api/jobs` to browse open jobs
- `GET /api/jobs/mine` to list a caterer’s own jobs
- `GET /api/jobs/:id` to fetch a single job
- `PATCH /api/jobs/:id/cancel` to cancel a job

Important behavior:

- student browsing only shows jobs with `status = 'open'`
- job browse results include `applicant_count`
- browse results can be filtered by location

### `backend/routes/applications.js`

Handles all job application actions.

Main endpoints:

- `POST /api/applications` to apply to a job
- `GET /api/applications/job/:jobId` for caterers to see applicants
- `GET /api/applications/mine` for students to see their own applications
- `PATCH /api/applications/:id/select` to select an applicant
- `PATCH /api/applications/:id/reject` to reject an applicant
- `PATCH /api/applications/:id/confirm` for a student to confirm selection
- `PATCH /api/applications/:id/withdraw` for a student to withdraw
- `PATCH /api/applications/:id/no-show` for a caterer to mark a no-show

Important behavior:

- selected applicants get a 24 hour confirmation deadline
- confirming a selected application increments `workers_confirmed`
- jobs are marked `filled` when enough workers confirm
- no-show updates feed into the reliability score logic

### `backend/routes/ratings.js`

Handles post-event ratings.

Main endpoints:

- `POST /api/ratings` to submit a rating
- `GET /api/ratings/user/:userId` to view ratings received by a user

The rating table stores:

- the job being rated
- who gave the rating
- who received the rating
- score from 1 to 5
- optional comment

### `backend/scheduler.js`

Runs background cleanup jobs on a timer.

Current automated tasks:

- expire stale `selected` applications whose confirmation deadline has passed
- mark past jobs as `completed` once the event date is over

This scheduler is started automatically from `server.js`.

## 6. Database Schema

The schema is stored in `backend/schema.sql`.

### `users`

Stores both student and caterer accounts.

Important columns:

- `role`
- `full_name`
- `phone`
- `password_hash`
- `college_name`
- `business_name`
- `profile_photo_url`
- `is_verified`
- `reliability_score`
- `total_gigs_completed`

### `jobs`

Stores posted work opportunities.

Important columns:

- `caterer_id`
- `title`
- `description`
- `event_date`
- `start_time`
- `end_time`
- `location`
- `pay_rate`
- `workers_needed`
- `workers_confirmed`
- `status`

Current job statuses in the schema:

- `open`
- `filled`
- `closed`
- `cancelled`
- `completed`

### `applications`

Stores student applications for jobs.

Important columns:

- `job_id`
- `student_id`
- `status`
- `confirmation_deadline`
- `applied_at`

Application statuses currently include:

- `applied`
- `selected`
- `confirmed`
- `rejected`
- `no_show`
- `withdrawn`

### `ratings`

Stores mutual feedback after a job.

Important columns:

- `job_id`
- `from_user_id`
- `to_user_id`
- `score`
- `comment`
- `created_at`

## 7. Frontend Pages

### `frontend/index.html`

Landing page for the app.

### `frontend/signup.html`

User registration page.

### `frontend/login.html`

Login page for returning users.

### `frontend/jobs.html`

Student-facing job browser.

Features:

- lists open jobs
- shows pay, date, time, location, and caterer name
- shows spots left
- shows application count
- supports location filtering

### `frontend/job-detail.html`

Caterer-facing job detail and applicant management page.

Features:

- shows the full job summary
- lists applicants
- lets the caterer select, reject, or mark no-show
- shows rate buttons for completed jobs

### `frontend/my-applications.html`

Student dashboard for tracking submitted applications.

Features:

- lists all applications
- shows selected/confirmed state
- shows confirmation deadline when needed
- allows confirmation and withdrawal
- shows a rating button after completion

### `frontend/my-jobs.html`

Caterer dashboard for managing posted jobs.

### `frontend/post-job.html`

Form for creating a new job posting.

### `frontend/rate.html`

Shared rating page used by both roles.

Features:

- 1 to 5 star rating
- optional comment
- redirects back after submission

### `frontend/css/style.css`

Shared visual system for all pages.

Current style direction:

- warm brass accent
- dark charcoal text
- paper background
- card-based layouts
- responsive grid for job cards
- status badges for application and job states

### `frontend/js/api.js`

Shared client-side helper functions.

Includes:

- API request wrapper
- login guard
- logout helper
- date and time formatting helpers
- HTML escaping helper

## 8. Current Feature Snapshot

The codebase currently supports:

- student and caterer signup/login
- JWT authentication
- job creation and browsing
- apply/select/reject/confirm/withdraw flows
- 24 hour confirmation window
- auto-expiry of stale selections through the scheduler
- auto-completion of past jobs
- no-show marking and reliability score updates
- post-job ratings with a dedicated UI
- applicant count on job cards
- completed job status styling

## 9. Important Business Rules

These rules are currently encoded in the app logic:

- A student can only apply to open jobs.
- A student cannot apply twice to the same job.
- A caterer can only manage jobs they created.
- A selected student must confirm within the deadline.
- A caterer can mark a confirmed worker as a no-show.
- Ratings are stored per job and per direction.

## 10. Local Setup

### Backend

1. Install dependencies inside `backend`.
2. Create the database using `backend/schema.sql`.
3. Configure the `.env` file with MySQL credentials and JWT secret.
4. Start the API with `npm start`.

### Frontend

The frontend has no build step.

1. Open the HTML files directly or serve the `frontend` folder with a static server.
2. Make sure `frontend/js/api.js` points to the correct backend URL.

## 11. Current Caveats And Follow-Ups

This project is functional, but a few things are still worth improving later:

- ratings should be validated more strictly against job participation
- there is no automated phone verification yet
- payments are not handled in-app
- the UI is intentionally simple and could be further polished for mobile
- some views still rely on basic loading text instead of skeleton states

## 12. Quick Summary

ServeConnect is a lightweight job marketplace for temporary campus/event staffing. The backend owns the real business logic, the frontend is static and simple, and the database keeps the workflow state. The app is already past the initial signup/browse/apply stage and now includes background cleanup, completion tracking, and ratings.
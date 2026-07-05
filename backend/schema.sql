-- ============================================
-- ServeConnect Database Schema (MySQL)
-- ============================================

CREATE DATABASE IF NOT EXISTS serveconnect;
USE serveconnect;

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  role ENUM('student', 'caterer') NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  college_name VARCHAR(150) DEFAULT NULL,      -- for students
  business_name VARCHAR(150) DEFAULT NULL,     -- for caterers
  profile_photo_url VARCHAR(500) DEFAULT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  reliability_score DECIMAL(3,2) DEFAULT 0.00,
  total_gigs_completed INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- JOBS
-- ============================================
CREATE TABLE jobs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  caterer_id CHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location VARCHAR(255) NOT NULL,
  pay_rate DECIMAL(10,2) NOT NULL,
  workers_needed INT NOT NULL,
  workers_confirmed INT DEFAULT 0,
  status ENUM('open', 'filled', 'closed', 'cancelled', 'completed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (caterer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- APPLICATIONS
-- ============================================
CREATE TABLE applications (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  job_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  status ENUM('applied', 'selected', 'confirmed', 'rejected', 'no_show', 'withdrawn') DEFAULT 'applied',
  confirmation_deadline TIMESTAMP NULL DEFAULT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_application (job_id, student_id)
);

-- ============================================
-- RATINGS
-- ============================================
CREATE TABLE ratings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  job_id CHAR(36) NOT NULL,
  from_user_id CHAR(36) NOT NULL,
  to_user_id CHAR(36) NOT NULL,
  score INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_rating (job_id, from_user_id, to_user_id)
);

-- Helpful indexes
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_applications_job ON applications(job_id);
CREATE INDEX idx_applications_student ON applications(student_id);

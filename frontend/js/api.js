// ============================================
// Shared API helper
// Change API_BASE to your deployed backend URL when you connect it.
// ============================================
const API_BASE = 'http://localhost:5000/api';

async function apiRequest(path, { method = 'GET', body = null, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = localStorage.getItem('sc_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

function getCurrentUser() {
  const raw = localStorage.getItem('sc_user');
  return raw ? JSON.parse(raw) : null;
}

function requireLogin(expectedRole = null) {
  const user = getCurrentUser();
  if (!user || !localStorage.getItem('sc_token')) {
    window.location.href = 'login.html';
    return null;
  }
  if (expectedRole && user.role !== expectedRole) {
    window.location.href = user.role === 'student' ? 'jobs.html' : 'my-jobs.html';
    return null;
  }
  return user;
}

function logout() {
  localStorage.removeItem('sc_token');
  localStorage.removeItem('sc_user');
  window.location.href = 'index.html';
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  // timeStr like "18:00:00"
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${period}`;
}

function getJobEndDateTime(job) {
  if (!job || !job.event_date) return null;
  const endTime = job.end_time || '00:00:00';
  const endDateTime = new Date(`${job.event_date}T${endTime}`);
  return Number.isNaN(endDateTime.getTime()) ? null : endDateTime;
}

function isJobCompleted(job) {
  if (!job) return false;
  if (job.status === 'completed') return true;

  const endDateTime = getJobEndDateTime(job);
  return endDateTime ? endDateTime < new Date() : false;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

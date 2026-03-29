

import { collection, getDocs, query, where } from
  'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { db } from './firebase.js';
import { JOBS } from './jobs-data.js';

const params = new URLSearchParams(location.search);
const jobId  = params.get('id');
const job    = JOBS.find(j => j.id === jobId);

document.addEventListener('DOMContentLoaded', async () => {
  if (!job) {
    document.getElementById('jd-company').textContent = 'No role selected';
    document.getElementById('jd-title').innerHTML =
      'Role not found. <a href="index.html" style="font-size:1rem;color:var(--sky);text-decoration:underline;">← Browse all roles</a>';
    document.getElementById('jd-meta').innerHTML =
      '<p style="color:var(--txt-2);font-size:.9rem;">This page needs a job ID in the URL. Please select a role from the main portal.</p>';
    return;
  }

  renderJob(job);
  await loadPopularity(job);
});


function renderJob(job) {
  document.title = `${job.title} @ ${job.company} — Coding Protocol`;

  const today    = new Date(); today.setHours(0,0,0,0);
  const deadline = new Date(job.deadline);
  const daysLeft = Math.ceil((deadline - today) / 86400000);
  const expired  = daysLeft < 0;
  const urgent   = !expired && daysLeft <= 5;

  document.getElementById('jd-company').textContent  = job.company;
  document.getElementById('jd-title').textContent    = job.title;
  document.getElementById('jd-co-name').textContent  = job.company;
  document.getElementById('jd-co-info').textContent  = job.companyInfo;
  document.getElementById('jd-desc').textContent     = job.description;

  // Meta row
  const meta = document.getElementById('jd-meta');
  meta.innerHTML = `
    <span class="meta-pill"><strong>₹${job.stipend.toLocaleString('en-IN')}</strong> / month</span>
    <span class="meta-pill type-tag ${job.type.toLowerCase()}" style="border-radius:100px;">${job.type}</span>
    <span class="meta-pill"><strong>Branches:</strong> ${job.branch.join(', ')}</span>
    <span class="meta-pill ${urgent ? 'urgent' : ''}" style="${urgent ? 'color:var(--rose);border-color:rgba(244,63,94,.3);background:var(--rose-dim);' : ''}">
      ${expired ? '🔒 Closed' : urgent ? `⚡ ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` : `Closes ${deadline.toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}`}
    </span>
  `;

  // Responsibilities
  document.getElementById('jd-resp').innerHTML =
    job.responsibilities.map(r => `<li>${r}</li>`).join('');

  // Skills
  document.getElementById('jd-skills').innerHTML =
    job.skills.map(s => `<span class="skill-chip" style="font-size:.78rem;padding:4px 10px;">${s}</span>`).join('');

  // Perks
  document.getElementById('jd-perks').innerHTML =
    job.perks.map(p => `<div class="jd-perk">${p}</div>`).join('');

  // Sidebar quick info
  document.getElementById('jd-location').textContent      = `📍 ${job.location}`;
  document.getElementById('jd-type').textContent          = `🏢 ${job.type}`;
  document.getElementById('jd-duration').textContent      = `⏳ ${job.duration}`;
  document.getElementById('jd-deadline-info').textContent = `📅 Deadline: ${deadline.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`;
  document.getElementById('jd-stipend-info').textContent  = `💰 ₹${job.stipend.toLocaleString('en-IN')} / month`;

  // Apply button state
  const applyBtn  = document.getElementById('jd-apply-btn');
  const applyNote = document.getElementById('jd-apply-note');

  if (expired) {
    applyBtn.disabled           = true;
    applyBtn.textContent        = 'Applications Closed';
    applyNote.textContent       = 'The deadline for this role has passed.';
  } else {
    applyNote.textContent = 'Upload your resume on the main portal to check match score first.';
  }
}


async function loadPopularity(job) {
  try {
    const q    = query(collection(db, 'applications'), where('role', '==', job.title));
    const snap = await getDocs(q);
    const count = snap.size;

    const quota    = job.quota;
    const fillPct  = Math.min(Math.round((count / quota) * 100), 100);
    const isFull   = count >= quota;
    const isHot    = count >= Math.floor(quota * 0.5);

    // Quota display
    document.getElementById('jd-quota-num').textContent      = isFull ? '0' : quota - Math.min(count, quota);
    document.getElementById('jd-applied-label').textContent  = `${count} applied`;
    document.getElementById('jd-quota-pct').textContent      = `${fillPct}% full`;

    const fill = document.getElementById('jd-quota-fill');
    fill.style.width = `${fillPct}%`;
    fill.className   = `quota-fill${fillPct >= 100 ? ' full' : fillPct >= 60 ? ' warn' : ''}`;

    // Popularity
    const popText = document.getElementById('jd-pop-text');
    if (count === 0)       popText.textContent = 'Be the first to apply — low competition!';
    else if (count < 3)    popText.textContent = `Only ${count} application${count !== 1 ? 's' : ''} — low competition`;
    else if (isHot)        popText.textContent = `🔥 ${count} students applied — high demand`;
    else                   popText.textContent = `${count} student${count !== 1 ? 's' : ''} applied`;

    // Disable apply if full
    if (isFull) {
      const btn  = document.getElementById('jd-apply-btn');
      const note = document.getElementById('jd-apply-note');
      btn.disabled    = true;
      btn.textContent = 'Quota Full';
      note.textContent = `All ${quota} seats have been filled. Check back next cycle.`;
    }

  } catch (err) {
    console.error('Could not fetch popularity:', err);
    document.getElementById('jd-pop-text').textContent = '— applicants';
  }
}


window.startApply = function startApply() {
  sessionStorage.setItem('cp_pending_job', job.id);
  window.location.href = 'index.html';
};


window.toast = function toast(msg, type = 'info') {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3800);
};

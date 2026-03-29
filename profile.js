/**
 * profile.js — User Profile System
 * Features: completeness meter (0–100%) · editable skills with chip UI
 *           education history · certifications · project showcase
 *           portfolio links (GitHub, LinkedIn, Website, LeetCode)
 *           multiple contacts · resume timestamp · public/private toggle
 *           localStorage-persisted · save indicator
 */

'use strict';

/* ── Data structure stored in localStorage under 'cp_profile' ── */
let profile = {
  basic:      { name:'', email:'', phone1:'', phone2:'', college:'', branch:'', year:'', cgpa:'' },
  links:      { linkedin:'', github:'', website:'', leetcode:'' },
  education:  { '10-board':'', '10-score':'', '12-board':'', '12-score':'', deg:'' },
  skills:     [],
  certs:      [],      // [{ name, issuer, year }]
  projects:   [],      // [{ name, desc, link, tech }]
  resume:     { fileName:'', uploadedAt:'' },
  visibility: 'public',
};

let dirty = false;

/* ── Boot ──────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  renderAll();
  updateCompleteness();

  // Back to top
  window.addEventListener('scroll', () => {
    const btn = document.getElementById('backToTop');
    if (btn) btn.classList.toggle('visible', window.scrollY > 300);
  });
});

/* ── Load / Save ────────────────────────── */
function loadProfile() {
  const stored = localStorage.getItem('cp_profile');
  if (stored) {
    try { Object.assign(profile, JSON.parse(stored)); } catch { /* skip */ }
  }
  // Also prefill from last form if basic fields empty
  if (!profile.basic.name) {
    const lf = localStorage.getItem('cp_last_form');
    if (lf) {
      const d = JSON.parse(lf);
      profile.basic.name    = d.name    || '';
      profile.basic.email   = d.email   || '';
      profile.basic.phone1  = d.contact || '';
      profile.basic.college = d.college || '';
      profile.basic.branch  = d.branch  || '';
      profile.basic.year    = d.year    || '';
      profile.basic.cgpa    = d.cgpa    || '';
    }
  }
}

window.saveProfile = function () {
  collectFormValues();
  localStorage.setItem('cp_profile', JSON.stringify(profile));
  dirty = false;
  updateSaveBadge(false);
  renderAll();
  updateCompleteness();
  toast('Profile saved ✓', 'success');
};

window.savePart = function (/* section */) {
  dirty = true;
  updateSaveBadge(true);
  updateCompleteness();
};

function collectFormValues() {
  // Basic
  ['name','email','phone1','phone2','college','branch','year','cgpa'].forEach(k => {
    const el = document.getElementById(`p-${k}`); if (el) profile.basic[k] = el.value.trim();
  });
  // Links
  ['linkedin','github','website','leetcode'].forEach(k => {
    const el = document.getElementById(`p-${k}`); if (el) profile.links[k] = el.value.trim();
  });
  // Education
  ['10-board','10-score','12-board','12-score','deg'].forEach(k => {
    const el = document.getElementById(`ed-${k}`); if (el) profile.education[k] = el.value.trim();
  });
}

function updateSaveBadge(unsaved) {
  const badge = document.getElementById('saveBadge');
  if (!badge) return;
  badge.textContent  = unsaved ? '● Unsaved changes' : 'All changes saved';
  badge.style.color  = unsaved ? 'var(--amber)' : 'var(--txt-3)';
}

/* ── Render all fields ──────────────────── */
function renderAll() {
  // Basic inputs
  ['name','email','phone1','phone2','college','branch','year','cgpa'].forEach(k => {
    const el = document.getElementById(`p-${k}`); if (el) el.value = profile.basic[k] || '';
  });
  // Links
  ['linkedin','github','website','leetcode'].forEach(k => {
    const el = document.getElementById(`p-${k}`); if (el) el.value = profile.links[k] || '';
  });
  // Education
  ['10-board','10-score','12-board','12-score','deg'].forEach(k => {
    const el = document.getElementById(`ed-${k}`); if (el) el.value = profile.education[k] || '';
  });

  renderHero();
  renderSkills();
  renderCerts();
  renderProjects();
  renderResumeStatus();
  renderVisibility();
}

/* ── Hero ───────────────────────────────── */
function renderHero() {
  const name    = profile.basic.name  || 'Your Name';
  const initials= name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || '?';
  document.getElementById('avatarDisplay').textContent   = initials;
  document.getElementById('profileNameDisplay').textContent = name;
  const meta = [profile.basic.college, profile.basic.branch, profile.basic.year ? `Batch ${profile.basic.year}` : ''].filter(Boolean).join(' · ');
  document.getElementById('profileMetaDisplay').textContent = meta || 'Set up your profile';

  // Links row
  const linksEl = document.getElementById('profileLinks');
  const linkDefs = [
    { key:'linkedin', label:'LinkedIn', icon:'🔗' },
    { key:'github',   label:'GitHub',   icon:'🐙' },
    { key:'website',  label:'Website',  icon:'🌐' },
    { key:'leetcode', label:'LeetCode', icon:'⚡' },
  ];
  linksEl.innerHTML = linkDefs.filter(l => profile.links[l.key]).map(l =>
    `<a href="${esc(profile.links[l.key])}" target="_blank" rel="noopener" class="profile-link">${l.icon} ${l.label}</a>`
  ).join('');
}

/* ── Skills ─────────────────────────────── */
function renderSkills() {
  const el = document.getElementById('skillsDisplay');
  if (!el) return;
  el.innerHTML = profile.skills.map(s =>
    `<span style="font-size:.78rem;font-weight:600;background:var(--sky-dim);color:var(--sky);border:1px solid var(--border-hi);border-radius:100px;padding:4px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" onclick="removeSkill('${esc(s)}')">${esc(s)} <span style="opacity:.6;font-size:.8rem;">×</span></span>`
  ).join('');
}

window.addSkill = function () {
  const inp = document.getElementById('skillInput');
  const val = inp.value.trim();
  if (!val) return;
  if (profile.skills.map(s=>s.toLowerCase()).includes(val.toLowerCase())) { toast('Already added.','warning'); inp.value=''; return; }
  profile.skills.push(val);
  inp.value = '';
  renderSkills();
  savePart('skills');
};

window.removeSkill = function (skill) {
  profile.skills = profile.skills.filter(s => s !== skill);
  renderSkills();
  savePart('skills');
};

/* ── Certifications ─────────────────────── */
function renderCerts() {
  const el = document.getElementById('certList');
  if (!el) return;
  if (!profile.certs.length) { el.innerHTML = '<p style="font-size:.82rem;color:var(--txt-3);">No certifications added.</p>'; return; }
  el.innerHTML = profile.certs.map((c,i) => `
    <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--r-sm);">
      <div class="form-field" style="margin:0;"><label>Certification Name</label><input value="${esc(c.name||'')}" oninput="updateCert(${i},'name',this.value)"></div>
      <div class="form-field" style="margin:0;"><label>Issuer</label><input value="${esc(c.issuer||'')}" oninput="updateCert(${i},'issuer',this.value)"></div>
      <button class="btn btn-danger btn-xs" onclick="removeCert(${i})" style="align-self:flex-end;">✕</button>
    </div>`).join('');
}

window.addCert = function () {
  profile.certs.push({ name:'', issuer:'' });
  renderCerts(); savePart('certs');
};
window.removeCert = function (i) {
  profile.certs.splice(i,1); renderCerts(); savePart('certs');
};
window.updateCert = function (i, key, val) {
  if (profile.certs[i]) profile.certs[i][key] = val; savePart('certs');
};

/* ── Projects ───────────────────────────── */
function renderProjects() {
  const el = document.getElementById('projectList');
  if (!el) return;
  if (!profile.projects.length) { el.innerHTML = '<p style="font-size:.82rem;color:var(--txt-3);">No projects added.</p>'; return; }
  el.innerHTML = profile.projects.map((p,i) => `
    <div style="padding:14px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--r-sm);">
      <div class="form-grid" style="margin-bottom:8px;">
        <div class="form-field"><label>Project Name</label><input value="${esc(p.name||'')}" oninput="updateProject(${i},'name',this.value)"></div>
        <div class="form-field"><label>GitHub / Live Link</label><input value="${esc(p.link||'')}" oninput="updateProject(${i},'link',this.value)"></div>
        <div class="form-field"><label>Tech Stack</label><input value="${esc(p.tech||'')}" placeholder="React, Node.js, Firebase…" oninput="updateProject(${i},'tech',this.value)"></div>
        <div style="display:flex;align-items:flex-end;"><button class="btn btn-danger btn-sm" onclick="removeProject(${i})">✕ Remove</button></div>
      </div>
      <div class="form-field"><label>Description</label><textarea oninput="updateProject(${i},'desc',this.value)" style="min-height:64px;">${esc(p.desc||'')}</textarea></div>
    </div>`).join('');
}

window.addProject = function () {
  profile.projects.push({ name:'', desc:'', link:'', tech:'' });
  renderProjects(); savePart('projects');
};
window.removeProject = function (i) {
  profile.projects.splice(i,1); renderProjects(); savePart('projects');
};
window.updateProject = function (i, key, val) {
  if (profile.projects[i]) profile.projects[i][key] = val; savePart('projects');
};

/* ── Resume upload ──────────────────────── */
window.handleResumeUpload = function (input) {
  const file = input.files[0]; if (!file) return;
  if (file.type !== 'application/pdf') { toast('PDF files only.','error'); return; }
  profile.resume = { fileName: file.name, uploadedAt: new Date().toLocaleString('en-IN') };
  renderResumeStatus();
  savePart('resume');
  toast(`Resume "${file.name}" saved.`, 'success');
};

function renderResumeStatus() {
  const el = document.getElementById('resumeStatus');
  if (!el) return;
  if (profile.resume.fileName) {
    el.innerHTML = `<strong style="color:var(--em);">✓ ${esc(profile.resume.fileName)}</strong><br><span>Uploaded: ${esc(profile.resume.uploadedAt)}</span>`;
    el.style.color = 'var(--txt-2)';
  } else {
    el.textContent = 'No resume on file'; el.style.color = 'var(--txt-3)';
  }
}

/* ── Visibility toggle ──────────────────── */
window.toggleVisibility = function () {
  profile.visibility = profile.visibility === 'public' ? 'private' : 'public';
  renderVisibility();
  savePart('visibility');
};

function renderVisibility() {
  const badge = document.getElementById('visibilityBadge');
  if (!badge) return;
  if (profile.visibility === 'public') {
    badge.textContent = '🌐 Public';
    badge.style.background = 'var(--em-dim)'; badge.style.color = 'var(--em)';
    badge.style.borderColor = 'rgba(16,185,129,.28)';
  } else {
    badge.textContent = '🔒 Private';
    badge.style.background = 'rgba(71,85,105,.15)'; badge.style.color = 'var(--txt-3)';
    badge.style.borderColor = 'rgba(71,85,105,.3)';
  }
}

/* ── Completeness meter ─────────────────── */
const COMPLETENESS_CHECKS = [
  { label:'Name',            fn: p => !!p.basic.name },
  { label:'Email',           fn: p => !!p.basic.email },
  { label:'Contact',         fn: p => !!p.basic.phone1 },
  { label:'College',         fn: p => !!p.basic.college },
  { label:'Branch & Year',   fn: p => !!p.basic.branch && !!p.basic.year },
  { label:'CGPA',            fn: p => !!p.basic.cgpa },
  { label:'LinkedIn',        fn: p => !!p.links.linkedin },
  { label:'GitHub',          fn: p => !!p.links.github },
  { label:'Skills (3+)',     fn: p => p.skills.length >= 3 },
  { label:'Education (10th)',fn: p => !!p.education['10-board'] },
  { label:'Education (12th)',fn: p => !!p.education['12-board'] },
  { label:'1 Certification', fn: p => p.certs.some(c => c.name) },
  { label:'1 Project',       fn: p => p.projects.some(pr => pr.name) },
  { label:'Resume uploaded', fn: p => !!p.resume.fileName },
];

function updateCompleteness() {
  // Read from current form state without saving
  const snapshot = JSON.parse(JSON.stringify(profile));
  ['name','email','phone1','phone2','college','branch','year','cgpa'].forEach(k => {
    const el = document.getElementById(`p-${k}`); if (el) snapshot.basic[k] = el.value.trim();
  });
  ['linkedin','github','website','leetcode'].forEach(k => {
    const el = document.getElementById(`p-${k}`); if (el) snapshot.links[k] = el.value.trim();
  });

  const done  = COMPLETENESS_CHECKS.filter(c => c.fn(snapshot)).length;
  const total = COMPLETENESS_CHECKS.length;
  const pct   = Math.round((done / total) * 100);

  const bar  = document.getElementById('completenessBar');
  const val  = document.getElementById('completenessValue');
  const items= document.getElementById('completenessItems');

  if (bar)  bar.style.width = `${pct}%`;
  if (val)  { val.textContent = `${pct}%`; val.style.color = pct>=80?'var(--em)':pct>=50?'var(--amber)':'var(--rose)'; }
  if (items) {
    items.innerHTML = COMPLETENESS_CHECKS.map(c => {
      const isDone = c.fn(snapshot);
      return `<span class="comp-item ${isDone?'done':'todo'}">${isDone?'✓':'+'}  ${c.label}</span>`;
    }).join('');
  }
}

/* ── Helpers ─────────────────────────────── */
function esc(s) { return String(s||'').replace(/[<>"'&]/g,c=>({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c])); }

function toast(msg, type='info') {
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const el=document.createElement('div'); el.className=`toast ${type}`;
  el.innerHTML=`<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(),3500);
}

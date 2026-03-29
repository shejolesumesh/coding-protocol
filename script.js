/**
 * script.js — Student Portal v4
 * Onboarding · categories · featured banner · skeleton→cards
 * drag-drop resume · draft auto-save · preview modal
 * similar jobs · recently viewed · keyboard shortcuts · back-to-top
 * app limit · quick apply · quota enforcement · duplicate prevention
 */

import { collection, addDoc, getDocs, query, where } from
  'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { db } from './firebase.js';
import { JOBS, BRANCHES, CATEGORIES, APP_LIMIT, DIFFICULTY_META } from './jobs-data.js';

/* ── State ─────────────────────────────────── */
let selectedJob    = null;
let resumeText     = '';
let resumeAnalysis = null;
let savedJobs      = JSON.parse(localStorage.getItem('cp_saved')  || '[]');
let recentlyViewed = JSON.parse(localStorage.getItem('cp_recent') || '[]');
let progressState  = parseInt(localStorage.getItem('cp_progress') || '0');
let popularityMap  = {};
let activeCategory = 'All';
let draftTimer     = null;

/* ── Boot ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // First-visit onboarding
  if (!localStorage.getItem('cp_onboarded')) {
    document.getElementById('onboarding').style.display = 'flex';
  }

  // Quick apply banner
  if (localStorage.getItem('cp_last_form')) {
    document.getElementById('quickBanner').classList.add('visible');
  }

  // Restore draft into form fields
  const draft = localStorage.getItem('cp_draft');
  if (draft) {
    try {
      const d = JSON.parse(draft);
      ['name','email','college','contact','linkedin','branch','year','cgpa','message'].forEach(k => {
        const el = document.getElementById(`f-${k}`); if (el && d[k]) el.value = d[k];
      });
    } catch {}
  }

  populateBranchFilter();
  buildCategoryTabs();
  await loadPopularityMap();
  renderFeatured();

  // Show skeleton 0.6s then render real cards
  setTimeout(renderJobs, 600);
  restoreProgress();

  // Back-to-top
  window.addEventListener('scroll', () => {
    document.getElementById('backToTop')?.classList.toggle('visible', window.scrollY > 400);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if (e.key === '/') { e.preventDefault(); document.getElementById('searchInput').focus(); }
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      document.getElementById('onboarding').style.display = 'none';
    }
  });

  // Drag-and-drop on upload area
  const ua = document.getElementById('uploadArea');
  ua.addEventListener('dragover',  e => { e.preventDefault(); ua.classList.add('drag-over'); });
  ua.addEventListener('dragleave', () => ua.classList.remove('drag-over'));
  ua.addEventListener('drop', e => {
    e.preventDefault(); ua.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) handleResumeFile(f);
  });

  document.getElementById('resumeFile').addEventListener('change', e => {
    if (e.target.files[0]) handleResumeFile(e.target.files[0]);
  });

  // Handle pending job from job.html redirect
  const pending = sessionStorage.getItem('cp_pending_job');
  if (pending) {
    sessionStorage.removeItem('cp_pending_job');
    selectedJob = JOBS.find(j => j.id === pending);
    if (selectedJob && resumeText) runMatchAnalysis();
    else if (selectedJob) {
      toast(`Upload your resume to apply for ${selectedJob.title}`, 'info');
      document.querySelector('.upload-area').scrollIntoView({ behavior: 'smooth' });
    }
  }
});

/* ── Onboarding ───────────────────────────── */
window.dismissOnboarding = function () {
  document.getElementById('onboarding').style.display = 'none';
  localStorage.setItem('cp_onboarded', '1');
};

/* ── Category tabs ────────────────────────── */
function buildCategoryTabs() {
  const wrap = document.getElementById('categoryTabs');
  if (!wrap) return;
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `cat-tab${cat === activeCategory ? ' active' : ''}`;
    btn.textContent = cat;
    btn.onclick = () => {
      activeCategory = cat;
      document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderJobs();
    };
    wrap.appendChild(btn);
  });
}

/* ── Featured banner ──────────────────────── */
function renderFeatured() {
  const el = document.getElementById('featuredJobs');
  if (!el) return;
  JOBS.filter(j => j.featured).forEach(j => {
    const chip = document.createElement('div');
    chip.className = 'featured-chip';
    chip.innerHTML = `<strong>${j.company}</strong> · ${j.title} · ₹${j.stipend.toLocaleString('en-IN')}/mo`;
    chip.onclick = () => quickSelectJob(j.id);
    el.appendChild(chip);
  });
}

window.quickSelectJob = function (id) {
  selectedJob = JOBS.find(j => j.id === id);
  if (!selectedJob) return;
  if (!resumeText) { toast('Upload your resume first to check match.', 'info'); return; }
  runMatchAnalysis();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* ── Popularity map ───────────────────────── */
async function loadPopularityMap() {
  try {
    const snap = await getDocs(collection(db, 'applications'));
    snap.forEach(d => {
      const r = d.data().role;
      if (r) popularityMap[r] = (popularityMap[r] || 0) + 1;
    });
  } catch { /* offline – graceful */ }
}

/* ── Branch filter ────────────────────────── */
function populateBranchFilter() {
  const sel = document.getElementById('branchFilter');
  if (!sel) return;
  BRANCHES.filter(b => b !== 'Any').forEach(b => {
    const o = document.createElement('option'); o.value = b; o.textContent = b;
    sel.appendChild(o);
  });
}

/* ── Job cards ────────────────────────────── */
window.renderJobs = function () {
  const q       = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
  const branch  = document.getElementById('branchFilter')?.value || '';
  const type    = document.getElementById('typeFilter')?.value || '';
  const sort    = document.getElementById('sortBy')?.value || 'default';
  const maxStip = parseInt(document.getElementById('stipendRange')?.value || 30000);
  const today   = new Date(); today.setHours(0,0,0,0);

  let list = JOBS.filter(j => {
    if (activeCategory !== 'All' && j.category !== activeCategory) return false;
    if (q) {
      const hay = [j.title, j.company, ...(j.skills||[]), ...(j.keywords||[])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (branch && !j.branch.includes(branch) && !j.branch.includes('Any')) return false;
    if (type && j.type !== type) return false;
    if (j.stipend > maxStip) return false;
    return true;
  });

  if (sort === 'stipend_hi') list.sort((a,b) => b.stipend - a.stipend);
  if (sort === 'stipend_lo') list.sort((a,b) => a.stipend - b.stipend);
  if (sort === 'deadline')   list.sort((a,b) => new Date(a.deadline) - new Date(b.deadline));
  if (sort === 'popularity') list.sort((a,b) => (popularityMap[b.title]||0) - (popularityMap[a.title]||0));

  const countEl = document.getElementById('jobsCount');
  if (countEl) countEl.textContent = `${list.length} role${list.length !== 1 ? 's' : ''}`;

  const grid = document.getElementById('cardsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!list.length) {
    grid.innerHTML = '<div class="no-jobs">No roles match your filters. Try broadening your search.</div>';
    return;
  }

  list.forEach(job => {
    const dl       = new Date(job.deadline);
    const daysLeft = Math.ceil((dl - today) / 86400000);
    const expired  = daysLeft < 0;
    const urgent   = !expired && daysLeft <= 5;
    const isSaved  = savedJobs.includes(job.id);
    const isRecent = recentlyViewed.includes(job.id);
    const count    = popularityMap[job.title] || 0;
    const quota    = job.quota || 10;
    const fillPct  = Math.min(Math.round((count / quota) * 100), 100);
    const isFull   = count >= quota;

    const dlText = expired ? 'Closed'
      : urgent ? `⚡ ${daysLeft}d left`
      : `Closes ${dl.toLocaleDateString('en-IN', { day:'numeric', month:'short' })}`;

    const popBadge = count === 0
      ? `<span class="popularity-badge low">Low competition</span>`
      : count >= Math.floor(quota * 0.6)
        ? `<span class="popularity-badge">🔥 ${count} applied</span>`
        : `<span class="popularity-badge low">${count} applied</span>`;

    // Difficulty badge
    const diff = (DIFFICULTY_META && DIFFICULTY_META[job.difficulty]) || { color:'var(--sky)', bg:'var(--sky-dim)', border:'var(--border-hi)' };
    const diffBadge = job.difficulty
      ? `<span style="font-size:.7rem;font-weight:700;padding:2px 9px;border-radius:100px;background:${diff.bg};color:${diff.color};border:1px solid ${diff.border};">${job.difficulty}</span>`
      : '';

    // Tags
    const tagsHTML = (job.tags || []).slice(0,3).map(t =>
      `<span style="font-size:.68rem;font-weight:600;color:var(--violet);background:var(--vi-dim);border:1px solid rgba(167,139,250,.2);border-radius:4px;padding:2px 7px;">${t}</span>`
    ).join('');

    const card = document.createElement('article');
    card.className = `card${isSaved ? ' saved' : ''}${(expired||isFull) ? ' expired' : ''}${isRecent ? ' recently-viewed' : ''}`;
    card.innerHTML = `
      ${popBadge}
      ${job.isNew ? '<span class="new-badge">New</span>' : ''}
      <span class="card-co">${job.company}</span>
      <h3>${job.title}</h3>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
        <span class="verified-tag">✔ Verified</span>
        <span class="type-tag ${job.type.toLowerCase()}">${job.type}</span>
        ${diffBadge}
      </div>
      <div class="card-row"><strong>Branches:</strong> ${job.branch.slice(0,3).join(', ')}${job.branch.length>3?'…':''}</div>
      <div class="card-stipend">₹${job.stipend.toLocaleString('en-IN')} / mo</div>
      <div class="card-deadline ${urgent ? 'urgent' : ''}">${isFull ? '🔒 Quota Full' : dlText}</div>
      <div class="quota-bar-wrap">
        <div class="quota-bar">
          <div class="quota-fill${fillPct>=100?' full':fillPct>=60?' warn':''}" style="width:${fillPct}%"></div>
        </div>
      </div>
      <div class="card-skills">${(job.skills||[]).slice(0,3).map(s=>`<span class="skill-chip">${s}</span>`).join('')}</div>
      ${tagsHTML ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;">${tagsHTML}</div>` : ''}
      <div class="card-actions">
        <a href="job.html?id=${job.id}" class="btn btn-ghost btn-sm" style="flex:.45;text-align:center;" onclick="trackView('${job.id}')">Details</a>
        <button class="btn btn-primary btn-sm" style="flex:1;"
          onclick="selectJob('${job.id}')"
          ${(expired||isFull) ? 'disabled' : ''}>
          ${expired ? 'Closed' : isFull ? 'Full' : 'Check Match'}
        </button>
        <button class="save-btn ${isSaved ? 'saved' : ''}"
          onclick="toggleSave('${job.id}', event)"
          title="${isSaved ? 'Unsave' : 'Save job'}">${isSaved ? '★' : '☆'}</button>
      </div>
    `;
    grid.appendChild(card);
  });

  // Show similar jobs if a job is already selected
  if (selectedJob) renderSimilarJobs(selectedJob);
};

/* ── Track recently viewed ────────────────── */
window.trackView = function (id) {
  if (!recentlyViewed.includes(id)) {
    recentlyViewed.unshift(id);
    recentlyViewed = recentlyViewed.slice(0, 5);
    localStorage.setItem('cp_recent', JSON.stringify(recentlyViewed));
  }
};

/* ── Save / unsave ────────────────────────── */
window.toggleSave = function (id, e) {
  e.stopPropagation();
  const idx = savedJobs.indexOf(id);
  if (idx === -1) { savedJobs.push(id); toast('Job saved ★', 'success'); }
  else            { savedJobs.splice(idx, 1); toast('Job unsaved', 'info'); }
  localStorage.setItem('cp_saved', JSON.stringify(savedJobs));
  renderJobs();
};

/* ── Select job for match check ───────────── */
window.selectJob = function (id) {
  selectedJob = JOBS.find(j => j.id === id);
  if (!selectedJob) return;
  trackView(id);
  if (!resumeText) {
    toast('Upload your resume first.', 'warning');
    document.querySelector('.upload-area').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  runMatchAnalysis();
};

/* ── Resume upload ────────────────────────── */
async function handleResumeFile(file) {
  if (file.type !== 'application/pdf') { toast('PDF files only.', 'error'); return; }
  toast('Extracting resume text…', 'info');
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const c = await page.getTextContent();
      text += c.items.map(i => i.str).join(' ') + '\n';
    }
    resumeText = text.toLowerCase();
    const analysis = analyseResume(resumeText, null);
    displayAnalysis(analysis, null);
    advanceProgress(1);
    document.getElementById('progressSection').style.display = 'block';
    logActivity('📎', 'Resume uploaded and analysed');
    toast('Resume analysed ✓', 'success');
  } catch (err) {
    console.error(err);
    toast('Could not parse PDF. Make sure it is a text-based PDF, not a scan.', 'error');
  }
}

/* ── Skill detection ──────────────────────── */
const SKILL_LIST = [
  'javascript','typescript','react','vue','angular','node','nodejs','python','java','c++','c#','go','php',
  'html','css','tailwind','bootstrap','sql','mysql','postgresql','mongodb','redis','graphql','rest','api',
  'aws','azure','gcp','docker','kubernetes','linux','git','tensorflow','pytorch','scikit','keras',
  'pandas','numpy','matplotlib','power bi','tableau','excel','matlab',
  'figma','adobe xd','photoshop','ui','ux','autocad','solidworks','catia','ansys','plc','circuit',
  'seo','sem','content','google analytics','communication','leadership','agile','scrum','jira',
];

const RESOURCES = {
  'react':     { label:'React — Official Docs',        url:'https://react.dev/' },
  'node':      { label:'Node.js — Odin Project',       url:'https://www.theodinproject.com/' },
  'nodejs':    { label:'Node.js — Full Course (YT)',   url:'https://www.youtube.com/watch?v=Oe421EPjeBE' },
  'python':    { label:'Python — CS50 Harvard (free)', url:'https://cs50.harvard.edu/python/' },
  'tensorflow':{ label:'TensorFlow — Tutorials',       url:'https://www.tensorflow.org/tutorials' },
  'sql':       { label:'SQL — Mode Analytics',         url:'https://mode.com/sql-tutorial/' },
  'docker':    { label:'Docker — Play with Docker',    url:'https://labs.play-with-docker.com/' },
  'figma':     { label:'Figma — Learn Hub',            url:'https://help.figma.com/' },
  'aws':       { label:'AWS — Free Tier',              url:'https://aws.amazon.com/free/' },
  'git':       { label:'Git — Pro Git Book',           url:'https://git-scm.com/book/en/v2' },
  'power bi':  { label:'Power BI — Microsoft Learn',   url:'https://learn.microsoft.com/power-bi/' },
  'solidworks':{ label:'SolidWorks — Tutorial Playlist',url:'https://www.youtube.com/results?search_query=solidworks+tutorial' },
  'seo':       { label:'SEO — Moz Beginners Guide',    url:'https://moz.com/beginners-guide-to-seo' },
};

function analyseResume(text, job) {
  const detected = SKILL_LIST.filter(s => text.includes(s));
  let score = 0;
  if (text.includes('education'))                                   score += 10;
  if (text.includes('experience') || text.includes('project'))     score += 15;
  if (text.includes('skill'))                                       score += 10;
  if (text.includes('certificate') || text.includes('certification')) score += 8;
  if (text.includes('github') || text.includes('linkedin'))         score += 7;
  score += Math.min(detected.length * 3, 30);
  const nums = (text.match(/\d+%|\d+ (project|app|website|model|year|month)s?/g) || []).length;
  score += Math.min(nums * 3, 15);
  if (text.split(/\s+/).length > 200) score += 5;
  score = Math.min(score, 100);

  const missing = [];
  if (job) {
    const jobSkills = job.skills.map(s => s.toLowerCase());
    jobSkills.forEach(s => { if (!detected.includes(s) && !text.includes(s)) missing.push(s); });
    const overlap = jobSkills.filter(s => detected.includes(s) || text.includes(s)).length;
    score = Math.min(score + Math.round((overlap / jobSkills.length) * 20), 100);
  }
  return { score, detected, missing };
}

function displayAnalysis(analysis, job) {
  document.getElementById('analysisBox').classList.add('visible');
  const circle = document.getElementById('scoreCircle');
  const title  = document.getElementById('scoreTitle');
  const desc   = document.getElementById('scoreDesc');

  circle.textContent = `${analysis.score}%`;
  circle.className   = `score-circle ${analysis.score >= 75 ? 'good' : analysis.score >= 50 ? 'ok' : 'poor'}`;

  if (analysis.score >= 75)      { title.textContent = job ? `Strong match — ${job.title}` : 'Strong Resume'; desc.textContent = 'Well-structured with good keyword coverage.'; }
  else if (analysis.score >= 50) { title.textContent = job ? `Partial match — ${job.title}` : 'Needs improvement'; desc.textContent = 'Some key areas are missing. See recommendations below.'; }
  else                           { title.textContent = 'Resume needs more work'; desc.textContent = 'Add more projects, skills, and measurable achievements.'; }

  document.getElementById('detectedSkills').innerHTML = analysis.detected.length
    ? analysis.detected.slice(0,20).map(s => `<span class="gap-chip present">${s}</span>`).join('')
    : '<span style="color:var(--txt-3);font-size:.82rem;">No recognised skills found.</span>';

  const gs = document.getElementById('gapSection');
  if (job && analysis.missing.length) {
    gs.style.display = 'block';
    document.getElementById('missingSkills').innerHTML = analysis.missing.map(s => `<span class="gap-chip">${s}</span>`).join('');
    const resources = analysis.missing.slice(0,5).map(s =>
      RESOURCES[s.toLowerCase()] || { label:`Learn ${s}`, url:`https://www.youtube.com/results?search_query=${encodeURIComponent(s+' tutorial')}` }
    );
    document.getElementById('resourceList').innerHTML = resources.map(r =>
      `<div class="resource-item"><span>${r.label}</span><a href="${r.url}" target="_blank" rel="noopener">Learn →</a></div>`
    ).join('');
  } else { gs.style.display = 'none'; }

  document.getElementById('applyBtn').style.display = (job && analysis.score >= 75) ? 'inline-flex' : 'none';
}

/* ── Match analysis ───────────────────────── */
function runMatchAnalysis() {
  const analysis = analyseResume(resumeText, selectedJob);
  resumeAnalysis = analysis;
  displayAnalysis(analysis, selectedJob);
  advanceProgress(2);
  document.getElementById('progressSection').style.display = 'block';
  logActivity('🔍', `Match check: ${selectedJob.title} at ${selectedJob.company} — ${analysis.score}%`);
  toast(`${analysis.score}% match${analysis.score >= 75 ? ' — eligible ✓' : ' — below 75%'}`, analysis.score >= 75 ? 'success' : 'warning');
  document.getElementById('analysisBox').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  renderSimilarJobs(selectedJob);
}

/* ── Similar jobs ─────────────────────────── */
function renderSimilarJobs(job) {
  const similar = JOBS.filter(j =>
    j.id !== job.id && (j.category === job.category || j.branch.some(b => job.branch.includes(b)))
  ).slice(0, 6);
  if (!similar.length) return;
  const sec = document.getElementById('similarSection');
  const strip = document.getElementById('similarStrip');
  if (!sec || !strip) return;
  sec.style.display = 'block';
  strip.innerHTML = similar.map(j => `
    <div class="similar-pill" onclick="selectJob('${j.id}')">
      <div class="sp-co">${j.company}</div>
      <div class="sp-title">${j.title}</div>
      <div class="sp-stip">₹${j.stipend.toLocaleString('en-IN')}/mo · ${j.type}</div>
    </div>`).join('');
}

/* ── Open form ────────────────────────────── */
window.openForm = async function () {
  if (!resumeAnalysis || resumeAnalysis.score < 75) {
    toast('Minimum 75% resume match required to apply.', 'warning'); return;
  }

  // App limit check (query by email only, filter in JS)
  const email = localStorage.getItem('cp_email');
  if (email) {
    try {
      const snap = await getDocs(query(collection(db,'applications'), where('email','==',email)));
      const active = snap.docs.filter(d => !['rejected','withdrawn'].includes(d.data().status)).length;
      if (active >= APP_LIMIT) {
        toast(`Limit reached — ${APP_LIMIT} active applications max. Go to My Applications and withdraw one first.`, 'warning');
        document.getElementById('appLimitMsg').textContent = `⚠ ${active}/${APP_LIMIT} active slots used.`;
        return;
      }
      document.getElementById('appLimitMsg').textContent = `${active} of ${APP_LIMIT} active slots used.`;
    } catch (err) { console.warn('Limit check skipped:', err); }
  }

  document.getElementById('roleLabel').textContent = `${selectedJob.title} @ ${selectedJob.company}`;
  const form = document.getElementById('applyForm');
  form.style.display = 'block';
  prefillForm();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ── Draft auto-save ──────────────────────── */
window.saveDraft = function () {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const d = {};
    ['name','email','college','contact','linkedin','branch','year','cgpa','message'].forEach(k => {
      const el = document.getElementById(`f-${k}`); if (el) d[k] = el.value;
    });
    localStorage.setItem('cp_draft', JSON.stringify(d));
    const ind = document.getElementById('draftIndicator');
    if (ind) {
      ind.className = 'draft-indicator saved';
      ind.innerHTML = '<span>✓</span><span>Draft saved</span>';
      setTimeout(() => { ind.className = 'draft-indicator'; ind.innerHTML = '<span>○</span><span>Draft not saved</span>'; }, 2500);
    }
  }, 800);
};

/* ── Cancel form ──────────────────────────── */
window.cancelForm = function () {
  document.getElementById('applyForm').style.display = 'none';
  toast('Application cancelled.', 'info');
};

/* ── Prefill from quick apply ─────────────── */
function prefillForm() {
  const stored = localStorage.getItem('cp_last_form') || localStorage.getItem('cp_draft');
  if (!stored) return;
  try {
    const d = JSON.parse(stored);
    ['name','email','college','contact','linkedin','branch','year','cgpa','message'].forEach(k => {
      const el = document.getElementById(`f-${k}`); if (el && d[k]) el.value = d[k];
    });
  } catch {}
}

/* ── Application preview modal ────────────── */
window.showPreview = function () {
  const get = id => document.getElementById(id)?.value?.trim() || '';
  const rows = {
    'Role':        `${selectedJob?.title || '—'} @ ${selectedJob?.company || '—'}`,
    'Full Name':   get('f-name'),
    'Email':       get('f-email'),
    'College':     get('f-college'),
    'Contact':     get('f-contact'),
    'LinkedIn':    get('f-linkedin'),
    'Branch':      get('f-branch'),
    'Grad Year':   get('f-year'),
    'CGPA':        get('f-cgpa'),
    'Match Score': resumeAnalysis ? `${resumeAnalysis.score}%` : '—',
    'Message':     get('f-message') || '(none)',
  };

  if (!rows['Full Name'] || !rows['Email']) {
    toast('Fill in your name and email first.', 'warning'); return;
  }

  document.getElementById('previewBody').innerHTML = Object.entries(rows).map(([k,v]) => `
    <div class="preview-row">
      <span class="preview-key">${k}</span>
      <span class="preview-val">${v}</span>
    </div>`).join('');
  document.getElementById('previewOverlay').classList.add('active');
};

/* ── Submit application ───────────────────── */
window.submitApplication = async function () {
  document.getElementById('previewOverlay').classList.remove('active');

  const get = id => document.getElementById(id)?.value?.trim() || '';
  const data = {
    name:        get('f-name'),
    email:       get('f-email'),
    collegeName: get('f-college'),
    contact:     get('f-contact'),
    linkedin:    get('f-linkedin'),
    branch:      get('f-branch'),
    year:        get('f-year'),
    cgpa:        get('f-cgpa'),
    message:     get('f-message'),
  };

  const required = ['name','email','collegeName','contact','linkedin','branch','year','cgpa'];
  if (required.some(k => !data[k])) { toast('Fill all required fields.', 'warning'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))             { toast('Invalid email.', 'error'); return; }
  if (!/^[6-9]\d{9}$/.test(data.contact))                         { toast('Invalid mobile number (must start 6-9, 10 digits).', 'error'); return; }
  if (!data.linkedin.startsWith('https://www.linkedin.com/'))      { toast('LinkedIn URL must start with https://www.linkedin.com/', 'error'); return; }
  const cgpa = parseFloat(data.cgpa);
  if (isNaN(cgpa) || cgpa < 0 || cgpa > 10)                       { toast('CGPA must be between 0 and 10.', 'error'); return; }

  // Duplicate check
  const dupQ = query(collection(db,'applications'), where('email','==',data.email), where('role','==',selectedJob.title));
  const dupSn = await getDocs(dupQ);
  if (!dupSn.empty) { toast('You have already applied for this role.', 'warning'); return; }

  // Quota check
  const qtQ  = query(collection(db,'applications'), where('role','==',selectedJob.title));
  const qtSn = await getDocs(qtQ);
  if (qtSn.size >= selectedJob.quota) { toast('This role is now full. All seats have been filled.', 'warning'); return; }

  // App limit check
  const limSn = await getDocs(query(collection(db,'applications'), where('email','==',data.email)));
  const active = limSn.docs.filter(d => !['rejected','withdrawn'].includes(d.data().status)).length;
  if (active >= APP_LIMIT) { toast(`Max ${APP_LIMIT} active applications. Withdraw one first.`, 'warning'); return; }

  // Sanitise
  const san = s => String(s).replace(/[<>"']/g, '');
  Object.keys(data).forEach(k => { data[k] = san(data[k]); });

  try {
    await addDoc(collection(db, 'applications'), {
      ...data,
      role:       selectedJob.title,
      company:    selectedJob.company,
      matchScore: resumeAnalysis?.score ?? null,
      date:       new Date().toLocaleString('en-IN'),
      status:     'pending',
    });

    localStorage.setItem('cp_email', data.email);
    localStorage.setItem('cp_last_form', JSON.stringify({
      name: data.name, email: data.email, college: data.collegeName,
      contact: data.contact, linkedin: data.linkedin,
      branch: data.branch, year: data.year, cgpa: data.cgpa,
    }));
    localStorage.removeItem('cp_draft');
    logActivity('📝', `Applied for ${selectedJob.title} at ${selectedJob.company}`);
    advanceProgress(3);
    popularityMap[selectedJob.title] = (popularityMap[selectedJob.title] || 0) + 1;
    toast('Application submitted! 🎉', 'success');
    document.getElementById('applyForm').style.display = 'none';
    document.getElementById('applyBtn').style.display  = 'none';
    renderJobs();
  } catch (err) {
    console.error(err);
    toast('Submission failed. Check your connection and try again.', 'error');
  }
};

/* ── Clear quick apply ────────────────────── */
window.clearQuickApply = function () {
  localStorage.removeItem('cp_last_form');
  document.getElementById('quickBanner').classList.remove('visible');
  toast('Saved details cleared.', 'info');
};

/* ── Progress tracker ─────────────────────── */
function advanceProgress(step) {
  if (step > progressState) { progressState = step; localStorage.setItem('cp_progress', step); }
  restoreProgress();
}
function restoreProgress() {
  if (progressState === 0) return;
  document.getElementById('progressSection').style.display = 'block';
  ['step1','step2','step3','step4','step5'].forEach((id, idx) => {
    const el = document.getElementById(id); if (!el) return;
    el.classList.remove('done','active');
    if (idx < progressState)        el.classList.add('done');
    else if (idx === progressState)  el.classList.add('active');
  });
}

/* ── Activity log ─────────────────────────── */
function logActivity(icon, text) {
  const feed = JSON.parse(localStorage.getItem('cp_activity') || '[]');
  feed.unshift({ icon, text, time: new Date().toLocaleString('en-IN') });
  localStorage.setItem('cp_activity', JSON.stringify(feed.slice(0, 30)));
}

/* ── AI Tutor (Gemini-powered with KB fallback) ──────────────── */
const GEMINI_API_KEY = 'AIzaSyDCgPMAPmbgu84IokBxEjusqndsk05jWsY';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are a friendly, concise Career AI Tutor on "Coding Protocol" — an internship and placement platform for Indian engineering students.

Platform context:
- Students can upload a PDF resume for skill analysis and match scoring (75%+ required to apply)
- There are 10 internship/placement roles from companies like Google, Amazon, IBM, Adobe, Tata Motors, etc.
- Students can have max 5 active applications at once; they can withdraw to free slots
- Pipeline stages: Pending → Shortlisted → Interview → Selected / Rejected
- Students track applications on the "My Applications" dashboard using their email

Your role:
- Answer questions about resumes, interviews, internships, skill gaps, career advice, and how to use this platform
- Be specific, practical, and encouraging — keep answers under 80 words
- If asked about the platform, answer based on the context above
- If someone seems stressed or discouraged, be motivating
- Do NOT answer unrelated topics (politics, code generation, etc.) — politely redirect to career topics`;

let aiHistory = [];

const KB = [
  { keys:['resume'],          ans:'Keep it to one page, use action verbs, and tailor keywords per role.' },
  { keys:['ats'],             ans:'Use job description keywords, avoid tables and images, keep formatting simple.' },
  { keys:['internship'],      ans:'Treat it like a real job — deliver quality, ask questions, build relationships.' },
  { keys:['interview'],       ans:'Practice mocks, revise fundamentals, use STAR method for behavioural questions.' },
  { keys:['linkedin'],        ans:'Sharp headline, updated projects, connect with people in your target domain.' },
  { keys:['skill','missing'], ans:'Upload your resume and click Check Match on a role to see your skill gaps.' },
  { keys:['limit','how many'],ans:`You can have up to ${APP_LIMIT} active applications. Withdraw to free a slot.` },
  { keys:['withdraw'],        ans:'Go to My Applications and click Withdraw on any active application.' },
  { keys:['preview'],         ans:'Click Preview Application to review all details before final submission.' },
  { keys:['draft'],           ans:'Your form auto-saves as you type. Data is restored if you close the tab.' },
  { keys:['sad','fail','stress','tired','give up'], ans:'Discipline compounds — small daily progress builds what you cannot yet see. Keep going.' },
];

function kbFallback(txt) {
  const lq = txt.toLowerCase();
  return KB.find(e => e.keys.some(k => lq.includes(k)))?.ans
    || 'Try asking about resumes, internships, interviews, LinkedIn, or skill gaps.';
}

window.aiSend = async function () {
  const inp  = document.getElementById('aiInput');
  const msgs = document.getElementById('aiMessages');
  const txt  = inp.value.trim();
  if (!txt) return;

  msgs.innerHTML += `<div class="ai-user">${txt}</div>`;
  inp.value = '';
  msgs.scrollTop = msgs.scrollHeight;

  const typingId = 'ai-typing-' + Date.now();
  msgs.innerHTML += `<div class="ai-bot" id="${typingId}" style="opacity:.6;">Thinking…</div>`;
  msgs.scrollTop = msgs.scrollHeight;

  aiHistory.push({ role: 'user', parts: [{ text: txt }] });
  if (aiHistory.length > 20) aiHistory = aiHistory.slice(-20);

  let reply;
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: aiHistory,
        generationConfig: { maxOutputTokens: 180, temperature: 0.7 }
      })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error('Empty response');
    aiHistory.push({ role: 'model', parts: [{ text: reply }] });
  } catch (err) {
    console.warn('Gemini unavailable, using fallback:', err);
    reply = kbFallback(txt);
    aiHistory.pop(); // remove the unanswered user turn from history
  }

  const typingEl = document.getElementById(typingId);
  if (typingEl) { typingEl.style.opacity = '1'; typingEl.textContent = reply; }
  else msgs.innerHTML += `<div class="ai-bot">${reply}</div>`;
  msgs.scrollTop = msgs.scrollHeight;
};

/* ── Toast ────────────────────────────────── */
window.toast = function (msg, type = 'info') {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
};
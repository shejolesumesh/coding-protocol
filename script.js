
import { collection, addDoc, getDocs, query, where } from
  'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { db } from './firebase.js';
import { JOBS, BRANCHES, CATEGORIES, APP_LIMIT, DIFFICULTY_META } from './jobs-data.js';


let selectedJob    = null;
let resumeText     = '';
let resumeAnalysis = null;
let savedJobs      = JSON.parse(localStorage.getItem('cp_saved')  || '[]');
let recentlyViewed = JSON.parse(localStorage.getItem('cp_recent') || '[]');
let progressState  = parseInt(localStorage.getItem('cp_progress') || '0');
let popularityMap  = {};
let activeCategory = 'All';
let draftTimer     = null;


document.addEventListener('DOMContentLoaded', async () => {

  if (!localStorage.getItem('cp_onboarded')) {
    document.getElementById('onboarding').style.display = 'flex';
  }

  
  if (localStorage.getItem('cp_last_form')) {
    document.getElementById('quickBanner').classList.add('visible');
  }

  
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

  
  setTimeout(renderJobs, 600);
  restoreProgress();

  
  window.addEventListener('scroll', () => {
    document.getElementById('backToTop')?.classList.toggle('visible', window.scrollY > 400);
  });

  
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if (e.key === '/') { e.preventDefault(); document.getElementById('searchInput').focus(); }
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      document.getElementById('onboarding').style.display = 'none';
    }
  });

  
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


async function loadPopularityMap() {
  try {
    const snap = await getDocs(collection(db, 'applications'));
    snap.forEach(d => {
      const r = d.data().role;
      if (r) popularityMap[r] = (popularityMap[r] || 0) + 1;
    });
  } catch { /* offline – graceful */ }
}


function populateBranchFilter() {
  const sel = document.getElementById('branchFilter');
  if (!sel) return;
  BRANCHES.filter(b => b !== 'Any').forEach(b => {
    const o = document.createElement('option'); o.value = b; o.textContent = b;
    sel.appendChild(o);
  });
}


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


window.trackView = function (id) {
  if (!recentlyViewed.includes(id)) {
    recentlyViewed.unshift(id);
    recentlyViewed = recentlyViewed.slice(0, 5);
    localStorage.setItem('cp_recent', JSON.stringify(recentlyViewed));
  }
};


window.toggleSave = function (id, e) {
  e.stopPropagation();
  const idx = savedJobs.indexOf(id);
  if (idx === -1) { savedJobs.push(id); toast('Job saved ★', 'success'); }
  else            { savedJobs.splice(idx, 1); toast('Job unsaved', 'info'); }
  localStorage.setItem('cp_saved', JSON.stringify(savedJobs));
  renderJobs();
};


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


window.cancelForm = function () {
  document.getElementById('applyForm').style.display = 'none';
  toast('Application cancelled.', 'info');
};


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


window.clearQuickApply = function () {
  localStorage.removeItem('cp_last_form');
  document.getElementById('quickBanner').classList.remove('visible');
  toast('Saved details cleared.', 'info');
};


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


function logActivity(icon, text) {
  const feed = JSON.parse(localStorage.getItem('cp_activity') || '[]');
  feed.unshift({ icon, text, time: new Date().toLocaleString('en-IN') });
  localStorage.setItem('cp_activity', JSON.stringify(feed.slice(0, 30)));
}



const KB = [
  
  { keys:['resume tip','resume advice','improve resume','better resume'],
    ans:'Keep it to one page, use strong action verbs (built, led, optimised), and tailor keywords to each role description.' },
  { keys:['resume format','resume template','how to write resume'],
    ans:'Use a clean single-column layout: Header → Summary → Skills → Experience → Projects → Education. Avoid photos, tables, or fancy graphics.' },
  { keys:['resume length','how long resume'],
    ans:'One page is ideal for students and freshers. Add a second page only if you have 3+ years of solid experience.' },
  { keys:['resume objective','resume summary'],
    ans:'Write a 2-line summary: your role target + top 2 skills + one measurable win. Example: "Final-year CSE student skilled in React & Node.js with 2 deployed projects."' },
  { keys:['resume project','projects on resume'],
    ans:'List 2–3 projects with: what you built, tech stack used, and one measurable outcome (e.g. "reduced load time by 40%"). GitHub links add instant credibility.' },
  { keys:['resume'],
    ans:'Keep it to one page, use action verbs, quantify achievements, and tailor keywords per role. Upload it here for an instant match score.' },

  
  { keys:['ats score','ats check','ats friendly'],
    ans:'Mirror exact keywords from the job description in your resume. Use standard section headings. Avoid headers/footers, columns, and images — ATS bots can miss them.' },
  { keys:['ats'],
    ans:'Use job-description keywords, avoid tables and images, keep formatting simple, and save as PDF to preserve layout.' },

  
  { keys:['match score','75','score low','score below','percentage'],
    ans:'You need 75%+ to apply. Upload your resume, pick a role, and click "Check Match". The gap panel shows exactly which skills to add.' },
  { keys:['score','check match'],
    ans:'Click "Check Match" on any job card after uploading your resume. A score ≥75% unlocks the Apply button.' },

  
  { keys:['skill gap','missing skill','what skill','which skill'],
    ans:'After uploading your resume, click "Check Match" on a role. The Gap panel shows missing skills with free learning resources for each.' },
  { keys:['learn python','study python'],
    ans:'Try CS50P from Harvard (free at cs50.harvard.edu/python) or "Automate the Boring Stuff with Python" — both are beginner-friendly.' },
  { keys:['learn javascript','study js'],
    ans:'Start with The Odin Project (free) or javascript.info. Build small projects after each module — that\'s what recruiters actually look for.' },
  { keys:['learn react','study react'],
    ans:'Official docs at react.dev are excellent. Follow the "Tic-Tac-Toe" tutorial first, then build a CRUD project to solidify hooks.' },
  { keys:['learn sql','study sql'],
    ans:'SQLZoo and Mode Analytics SQL Tutorial are free and beginner-friendly. Practice writing JOINs and aggregations — they come up in every data role interview.' },
  { keys:['learn git','version control'],
    ans:'Read the free Pro Git book (git-scm.com). Core commands to master: clone, branch, commit, push, pull, merge, rebase.' },
  { keys:['certif','certification','course'],
    ans:'Prefer project-based certs over passive video certs. Google, AWS, and Microsoft offer respected free-tier certifications. LinkedIn Learning and Coursera have financial aid.' },
  { keys:['skill','missing'],
    ans:'Upload your resume and click "Check Match" on a role to see your personalised skill gaps and learning resources.' },


  { keys:['internship tip','internship advice','how to get internship'],
    ans:'Apply early, customise your cover note for each role, follow up politely after a week, and network on LinkedIn with alumni in the company.' },
  { keys:['internship stipend','salary internship'],
    ans:'Indian tech internships range from ₹5k–₹80k/month. Roles here show exact stipends on each card. Sort by "Stipend ↑" to find the highest paying ones.' },
  { keys:['internship duration','how long internship'],
    ans:'Roles on this platform range from 1–6 months. Duration is listed on each job detail page. Most companies prefer 3-month commitments.' },
  { keys:['internship convert','ppo','pre placement offer'],
    ans:'PPO chances improve when you: exceed your assigned KPIs, proactively own extra tasks, and build strong relationships with your mentor and team.' },
  { keys:['internship'],
    ans:'Treat every internship like a real job — deliver quality work, ask thoughtful questions, and build genuine relationships. Many PPOs come from strong intern performance.' },


  { keys:['placement','full time','full-time job','campus placement'],
    ans:'Campus placements usually start in Sept–Nov for Dec batches. Keep your resume updated, attend mock tests, and practice DSA daily from July onwards.' },
  { keys:['package','ctc','salary'],
    ans:'For freshers, Indian IT packages range ₹3–8 LPA (service), ₹12–45 LPA (product). Focus on DSA + system design + a strong project portfolio to target product companies.' },

  
  { keys:['interview tip','interview advice','how to prepare interview'],
    ans:'Practice mocks on Pramp or interviewing.io, revise your projects deeply, and prepare 5 STAR stories. Research the company\'s recent news before each round.' },
  { keys:['star method','behavioural','behaviour question'],
    ans:'STAR = Situation → Task → Action → Result. Practice 5 stories: a challenge you solved, a failure you learnt from, leadership, teamwork, and a tight deadline.' },
  { keys:['dsa','data structure','algorithm','leetcode','coding round'],
    ans:'Start with Arrays, Strings, HashMaps, Two-Pointers, and Sliding Window. Aim for 2 LeetCode mediums/day for 60 days. NeetCode 150 is a great structured list.' },
  { keys:['system design','low level design','hld','lld'],
    ans:'For freshers, focus on LLD: SOLID principles, design patterns (Factory, Singleton, Observer), and class diagrams. Grokking System Design (free on GitHub) covers HLD basics.' },
  { keys:['hr round','hr interview'],
    ans:'Prepare: "Tell me about yourself" (60 sec), why this company, your biggest strength/weakness, and where you see yourself in 3 years. Be genuine — HR detects rehearsed answers.' },
  { keys:['group discussion','gd','extempore'],
    ans:'In GDs: initiate if you\'re confident, use data to back points, acknowledge others\' views, and summarise at the end. Quality beats quantity of points made.' },
  { keys:['aptitude','quantitative','reasoning','verbal'],
    ans:'Practice 20 questions/day on IndiaBix or PrepInsta. Focus on Time-Speed-Distance, Percentages, Syllogisms, and Reading Comprehension — common in mass recruiters.' },
  { keys:['interview'],
    ans:'Practice mocks, revise your resume projects thoroughly, and use the STAR method for behavioural questions. Revise fundamentals of your core subjects too.' },

  
  { keys:['linkedin headline','linkedin profile','linkedin bio'],
    ans:'Headline: "Final-year [Branch] Student | [Top 2 Skills] | Seeking [Role]". Add a professional photo, 3+ featured projects, and a warm summary in first person.' },
  { keys:['linkedin connect','linkedin network','linkedin message'],
    ans:'Send personalised connection requests (note why you\'re reaching out). After connecting, message with a specific question — not a generic "please refer me".' },
  { keys:['linkedin job','linkedin apply'],
    ans:'Turn on "Open to Work" (private to recruiters). Use the "Easy Apply" filter sparingly — quality applications on company portals convert better.' },
  { keys:['linkedin'],
    ans:'Sharp headline, updated project section with links, consistent activity (1 post/week), and targeted connections in your domain. Recruiters search LinkedIn daily.' },

  
  { keys:['how to apply','apply for job','apply here'],
    ans:'Upload your PDF resume → click "Check Match" on a role → score 75%+ → click "Apply" → fill the form → Preview → Submit. Takes under 3 minutes.' },
  { keys:['limit','how many application','max application'],
    ans:`You can hold up to ${APP_LIMIT} active applications at once. Go to My Applications to withdraw from a role and free up a slot.` },
  { keys:['withdraw','cancel application','remove application'],
    ans:'Open "My Applications", find the role, and click "Withdraw". Your slot is freed immediately so you can apply elsewhere.' },
  { keys:['preview','preview application'],
    ans:'Click "Preview Application" before submitting to review every field. It\'s your last chance to catch typos or wrong details.' },
  { keys:['draft','auto save','autosave'],
    ans:'The form auto-saves as you type (800ms delay). If you accidentally close the tab, your data will be restored when you reopen it.' },
  { keys:['status','application status','pending','shortlisted','pipeline'],
    ans:'Pipeline: Pending → Shortlisted → Interview → Selected / Rejected. Track all stages in "My Applications" using your registered email.' },
  { keys:['quick apply','prefill','saved details'],
    ans:'If you\'ve applied before, a Quick Apply banner appears at the top. Click it to prefill your form with previous details — just update role-specific fields.' },
  { keys:['quota','seats','slots full'],
    ans:'Each role has a seat quota. The progress bar on each card shows how full it is. 🔥 badge = high competition. Apply early to secure a seat.' },
  { keys:['deadline','closing date','last date'],
    ans:'Each card shows the closing date. ⚡ means ≤5 days left — apply immediately. "Closed" roles no longer accept applications.' },
  { keys:['featured','banner','top role'],
    ans:'Featured roles in the top banner are handpicked high-value opportunities. Click any chip to jump directly to that role\'s match check.' },
  { keys:['save job','bookmark','saved'],
    ans:'Click the ☆ star icon on any card to save a job. Saved jobs get a gold border so you can spot them instantly later.' },
  { keys:['search','filter','find job'],
    ans:'Use the search bar (shortcut: press "/"), branch filter, type filter, stipend slider, and category tabs together to zero in on perfect-fit roles.' },
  { keys:['keyboard shortcut','shortcut'],
    ans:'Press "/" to focus the search bar instantly. Press "Escape" to close any open modal. These shortcuts work anywhere on the page.' },
  { keys:['similar job','related job','other role'],
    ans:'After checking a match, a "Similar Roles" strip appears below. These are jobs in the same category or matching your branch — worth exploring.' },

  
  { keys:['portfolio','personal website'],
    ans:'Build a simple portfolio with: About, Skills, Projects (with live links), and Contact. Use GitHub Pages or Netlify for free hosting — takes under an hour.' },
  { keys:['github','open source','contribution'],
    ans:'A green contribution graph signals consistency to recruiters. Start by fixing README typos in popular repos, then tackle "good first issue" labelled tasks.' },

  
  { keys:['communication','soft skill','speak'],
    ans:'Join Toastmasters or a college debate club. Record yourself explaining a technical concept — it exposes filler words and pacing issues fast.' },
  { keys:['network','networking','alumni'],
    ans:'Attend college tech fests, hackathons, and local meetups. Alumni on LinkedIn are often happy to do 15-min informational calls — just ask politely.' },
  { keys:['hackathon','competition','contest'],
    ans:'Hackathons build shipping speed, teamwork, and portfolio projects in 24–48 hours. Even non-winning projects make great resume entries with a GitHub link.' },
  { keys:['freelance','side project','freelancing'],
    ans:'Freelancing sharpens real-world skills and adds client experience to your resume. Toptal, Upwork, and LinkedIn are good starting points once you have 1–2 strong projects.' },

  
  { keys:['reject','rejected','no response','ghosted'],
    ans:'Every rejection is data, not identity. Note what you can improve (resume, skills, preparation), adjust, and reapply. Most offers come after 20–50 applications.' },
  { keys:['nervous','anxious','anxiety','scared'],
    ans:'Nerves are normal — they show you care. Prepare thoroughly so preparation replaces fear. Do 3 deep breaths before interviews; it physically lowers cortisol.' },
  { keys:['compare','everyone got job','friends placed','behind','comparison'],
    ans:'Everyone\'s timeline is different. Focus on your skill-building streak, not others\' highlights. Consistent daily progress beats sprint-and-crash every time.' },
  { keys:['sad','fail','stress','tired','give up','demotivated','depressed'],
    ans:'Discipline compounds — small daily progress builds what you cannot yet see. Rest if you must, but don\'t quit. Your breakthrough is closer than it feels.' },
  { keys:['motivation','inspire','encourage'],
    ans:'Bookmark one role you truly want. Look at it every morning. Let the vision pull you forward on days when discipline alone isn\'t enough.' },

  
  { keys:['hello','hi','hey','good morning','good evening'],
    ans:'Hi there! 👋 I\'m your Career AI Tutor. Ask me about resumes, interviews, internships, skill gaps, LinkedIn, or how to use this platform.' },
  { keys:['thank','thanks','thankyou'],
    ans:'Happy to help! Best of luck with your applications. 🚀 Feel free to come back anytime.' },
  { keys:['who are you','what are you','what can you do'],
    ans:'I\'m the Career AI Tutor for Coding Protocol. I can help with resume tips, interview prep, skill gaps, platform guidance, and career motivation. What\'s on your mind?' },
];

function kbFallback(txt) {
  const lq = txt.toLowerCase();
  
  const multiMatch = KB.find(e => e.keys.length > 1 && e.keys.every(k => lq.includes(k)));
  if (multiMatch) return multiMatch.ans;
  const anyMatch = KB.find(e => e.keys.some(k => lq.includes(k)));
  return anyMatch?.ans || 'I can help with resumes, interviews, internships, LinkedIn, skill gaps, and how to use this platform. Try asking about one of those!';
}

window.aiSend = function () {
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

  setTimeout(() => {
    const reply = kbFallback(txt);
    const typingEl = document.getElementById(typingId);
    if (typingEl) { typingEl.style.opacity = '1'; typingEl.textContent = reply; }
    else msgs.innerHTML += `<div class="ai-bot">${reply}</div>`;
    msgs.scrollTop = msgs.scrollHeight;
  }, 420);
};


window.toast = function (msg, type = 'info') {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
};
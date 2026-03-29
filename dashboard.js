/**
 * dashboard.js — Student Dashboard v4
 * Features: success rate analytics · pipeline visualization
 *           withdrawal · activity feed · saved jobs panel
 *           application tips · charts · last-applied tracking
 */

import { collection, getDocs, updateDoc, doc, query, where } from
  'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { db } from './firebase.js';
import { JOBS, PIPELINE_STAGES } from './jobs-data.js';

let myApps      = [];
let statusChart = null;
let roleChart   = null;

/* ── Boot ──────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Restore saved email
  const saved = localStorage.getItem('cp_email');
  if (saved) { document.getElementById('emailInput').value = saved; loadDashboard(); }

  // Back to top
  window.addEventListener('scroll', () => {
    document.getElementById('backToTop')?.classList.toggle('visible', window.scrollY > 400);
  });

  renderTips();
});

/* ── Load dashboard ─────────────────────── */
window.loadDashboard = async function () {
  const email = document.getElementById('emailInput').value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast('Enter a valid email.', 'warning'); return;
  }
  localStorage.setItem('cp_email', email);

  try {
    const q    = query(collection(db,'applications'), where('email','==',email));
    const snap = await getDocs(q);
    myApps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    myApps.sort((a,b) => new Date(b.date) - new Date(a.date));

    if (!myApps.length) { toast('No applications found for this email.', 'info'); return; }

    updateStats();
    renderSuccessRate();
    renderCharts();
    renderTable();
    renderActivityFeed();
    renderSavedJobs();

    document.getElementById('statGrid').style.display   = 'grid';
    document.getElementById('chartsRow').style.display  = 'grid';
    document.getElementById('appSection').style.display = 'block';
    document.getElementById('feedRow').style.display    = 'grid';

    toast(`Loaded ${myApps.length} application${myApps.length!==1?'s':''}.`, 'success');
  } catch (err) {
    console.error(err); toast('Error loading applications.', 'error');
  }
};

/* ── Stats ─────────────────────────────── */
function updateStats() {
  const c = { total:myApps.length, pending:0, shortlisted:0, interview:0, selected:0, rejected:0 };
  myApps.forEach(a => { if (c[a.status]!==undefined) c[a.status]++; });
  Object.entries(c).forEach(([k,v]) => { const el=document.getElementById('st-'+k); if(el) el.textContent=v; });
}

/* ── Success rate ───────────────────────── */
function renderSuccessRate() {
  const total    = myApps.length;
  const selected = myApps.filter(a => a.status === 'selected').length;
  const advanced = myApps.filter(a => ['shortlisted','interview','selected'].includes(a.status)).length;
  const rate     = total ? Math.round((selected / total) * 100) : 0;
  const adv      = total ? Math.round((advanced / total) * 100) : 0;

  document.getElementById('successRateDisplay').innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span style="font-size:.8rem;color:var(--txt-2);">Offer rate</span>
      <span style="font-family:var(--f-head);font-size:1.1rem;font-weight:700;color:${rate>=30?'var(--em)':rate>=15?'var(--amber)':'var(--rose)'};">${rate}%</span>
    </div>
    <div class="success-rate-bar"><div class="success-rate-fill" style="width:${rate}%"></div></div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;">
      <span style="font-size:.78rem;color:var(--txt-3);">${selected} offer${selected!==1?'s':''} from ${total} applications</span>
      <span style="font-size:.78rem;color:var(--sky);">${adv}% advanced</span>
    </div>
  `;
}

/* ── Charts ─────────────────────────────── */
function renderCharts() {
  const counts = { pending:0, shortlisted:0, interview:0, selected:0, rejected:0, withdrawn:0 };
  myApps.forEach(a => { if(counts[a.status]!==undefined) counts[a.status]++; });

  if (statusChart) statusChart.destroy();
  statusChart = new Chart(document.getElementById('statusChart').getContext('2d'), {
    type:'doughnut',
    data:{ labels:['Pending','Shortlisted','Interview','Selected','Rejected','Withdrawn'],
           datasets:[{ data:Object.values(counts), backgroundColor:['#f59e0b','#38bdf8','#a78bfa','#10b981','#f43f5e','#475569'], borderColor:'rgba(0,0,0,.3)', borderWidth:2 }] },
    options:{ plugins:{ legend:{ labels:{ color:'#94a3b8', font:{family:'DM Sans'} }}}, cutout:'62%' }
  });

  const roleCounts = {};
  myApps.forEach(a => { roleCounts[a.role]=(roleCounts[a.role]||0)+1; });
  const sorted = Object.entries(roleCounts).sort((a,b)=>b[1]-a[1]);

  if (roleChart) roleChart.destroy();
  roleChart = new Chart(document.getElementById('roleChart').getContext('2d'), {
    type:'bar',
    data:{ labels:sorted.map(([k])=>k.length>22?k.slice(0,22)+'…':k),
           datasets:[{ label:'Applications', data:sorted.map(([,v])=>v), backgroundColor:'rgba(56,189,248,.6)', borderColor:'#38bdf8', borderWidth:1, borderRadius:4 }] },
    options:{ indexAxis:'y', plugins:{ legend:{display:false} }, scales:{ x:{ ticks:{color:'#94a3b8'}, grid:{color:'rgba(255,255,255,.05)'} }, y:{ticks:{color:'#94a3b8'}} } }
  });
}

/* ── Applications table ─────────────────── */
function renderTable() {
  const PIPE_KEYS = ['pending','shortlisted','interview','selected'];
  const tbody = document.getElementById('appBody');
  if (!myApps.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📭</div><p>No applications yet.</p></div></td></tr>'; return;
  }
  tbody.innerHTML = myApps.map(a => {
    const active   = !['rejected','withdrawn'].includes(a.status);
    const pipeHTML = PIPE_KEYS.map((k,i) => {
      const done    = PIPE_KEYS.indexOf(a.status) > i;
      const current = a.status === k;
      const color   = done||current ? (a.status==='selected'?'var(--em)':'var(--sky)') : 'var(--border)';
      const title   = PIPELINE_STAGES.find(s=>s.key===k)?.label || k;
      return `<span title="${title}" style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;border:2px solid ${color};"></span>`;
    }).join('<span style="flex:1;height:2px;background:rgba(255,255,255,.08);align-self:center;"></span>');

    const matchColor = !a.matchScore?'var(--txt-3)':a.matchScore>=75?'var(--em)':a.matchScore>=50?'var(--amber)':'var(--rose)';

    return `
    <tr>
      <td>${esc(a.role)}</td>
      <td>${esc(a.company||'')}</td>
      <td style="font-weight:700;color:${matchColor}">${a.matchScore!=null?a.matchScore+'%':'—'}</td>
      <td><span class="status-badge s-${a.status}">${a.status}</span></td>
      <td><div style="display:flex;align-items:center;gap:2px;min-width:140px;">${pipeHTML}</div></td>
      <td style="font-size:.75rem;color:var(--txt-3);">${esc(a.date||'—')}</td>
      <td>
        ${active ? `<button class="btn btn-danger btn-xs" onclick="withdrawApp('${a.id}','${esc(a.role)}')">Withdraw</button>` : `<span style="font-size:.75rem;color:var(--txt-3);">${a.status}</span>`}
      </td>
    </tr>`;
  }).join('');
}

function esc(s) { return String(s||'').replace(/[<>"'&]/g,c=>({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c])); }

/* ── Withdraw ───────────────────────────── */
window.withdrawApp = function (id, role) {
  document.getElementById('popupTitle').textContent = `Withdraw from ${role}?`;
  document.getElementById('popupMsg').textContent   = 'This frees up one active application slot.';
  document.getElementById('popupOk').onclick = async () => {
    document.getElementById('popup').classList.remove('active');
    try {
      await updateDoc(doc(db,'applications',id), { status:'withdrawn' });
      const a = myApps.find(x=>x.id===id); if(a) a.status='withdrawn';
      updateStats(); renderSuccessRate(); renderCharts(); renderTable();
      logActivity('↩️', `Withdrew from ${role}`);
      toast(`Withdrawn from ${role}.`, 'info');
    } catch { toast('Withdrawal failed.', 'error'); }
  };
  document.getElementById('popupCancel').onclick = () => document.getElementById('popup').classList.remove('active');
  document.getElementById('popup').classList.add('active');
};

/* ── Activity feed ──────────────────────── */
function renderActivityFeed() {
  const activity = JSON.parse(localStorage.getItem('cp_activity') || '[]');
  const feed     = document.getElementById('activityFeed');
  if (!activity.length) { feed.innerHTML = '<div class="activity-empty">No activity yet.</div>'; return; }
  feed.innerHTML = activity.map(e => `
    <div class="activity-item">
      <span class="activity-icon">${e.icon}</span>
      <div class="activity-content">
        <div class="act-title">${esc(e.text)}</div>
        <div class="act-time">${esc(e.time)}</div>
      </div>
    </div>`).join('');
}

function logActivity(icon, text) {
  const feed = JSON.parse(localStorage.getItem('cp_activity') || '[]');
  feed.unshift({ icon, text, time: new Date().toLocaleString('en-IN') });
  localStorage.setItem('cp_activity', JSON.stringify(feed.slice(0,30)));
  renderActivityFeed();
}

/* ── Saved jobs ─────────────────────────── */
function renderSavedJobs() {
  const savedIds = JSON.parse(localStorage.getItem('cp_saved') || '[]');
  const list     = document.getElementById('savedJobsList');
  if (!savedIds.length) { list.innerHTML = '<p style="font-size:.875rem;color:var(--txt-3);">No saved jobs yet. Star a job on the portal to save it.</p>'; return; }
  const jobs = JOBS.filter(j => savedIds.includes(j.id));
  list.innerHTML = jobs.map(j => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--r-sm);">
      <div>
        <div style="font-family:var(--f-head);font-size:.85rem;font-weight:700;color:#fff;">${esc(j.title)}</div>
        <div style="font-size:.75rem;color:var(--txt-3);">${esc(j.company)} · ₹${j.stipend.toLocaleString('en-IN')}/mo</div>
      </div>
      <a href="job.html?id=${j.id}" class="btn btn-ghost btn-xs">View</a>
    </div>`).join('');
}

/* ── Tips ───────────────────────────────── */
const TIPS = [
  { icon:'📝', title:'Tailor every application', text:'Use keywords from the job description in your resume. A 75%+ match score unlocks the apply button on this platform.' },
  { icon:'⚡', title:'Apply within first 48 hours', text:'Early applicants are more likely to be noticed. Set "Deadline: Soonest" in the sort filter.' },
  { icon:'🔗', title:'LinkedIn matters more than you think', text:'Recruiters check LinkedIn before every call. Keep it updated and connect it in your application.' },
  { icon:'📊', title:'Track your success rate', text:'Aim for at least 20% advancement rate (shortlisted or beyond). If lower, revisit your resume.' },
  { icon:'💬', title:'Use the message field', text:'A concise, specific message to the recruiter can differentiate your application.' },
  { icon:'🎯', title:'Don\'t apply everywhere', text:`You have ${5} active slots for a reason — focus on quality over quantity.` },
];
function renderTips() {
  document.getElementById('tipsGrid').innerHTML = TIPS.map(t => `
    <div class="tip-card">
      <div class="tip-icon">${t.icon}</div>
      <h5>${t.title}</h5>
      <p>${t.text}</p>
    </div>`).join('');
}

/* ── Toast ──────────────────────────────── */
function toast(msg, type='info') {
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const el=document.createElement('div'); el.className=`toast ${type}`;
  el.innerHTML=`<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(),3800);
}

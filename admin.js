import { collection, getDocs, updateDoc, doc, deleteDoc } from
  'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { db } from './firebase.js';
import { PIPELINE_STAGES } from './jobs-data.js';

if (sessionStorage.getItem('adminLoggedIn') !== 'true') location.href = 'admin-login.html';

let allApps = [], filtered = [], sortState = { col: null, asc: true }, selected = new Set();
let pipelineChart = null, roleChart = null, adminLog = [];

document.addEventListener('DOMContentLoaded', () => { loadApplications(); });

window.loadApplications = async function () {
  try {
    const snap = await getDocs(collection(db, 'applications'));
    allApps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('lastSyncTime').textContent = 'Synced at ' + new Date().toLocaleTimeString('en-IN');
    updateStats(); updateCharts(); populateRoleFilter(); renderTable();
  } catch (err) { console.error(err); toast('Failed to load applications.', 'error'); }
};

function updateStats() {
  const c = { total:allApps.length, pending:0, shortlisted:0, interview:0, selected:0, rejected:0 };
  allApps.forEach(a => { if (c[a.status]!==undefined) c[a.status]++; });
  Object.entries(c).forEach(([k,v]) => { const el=document.getElementById('st-'+k); if(el) el.textContent=v; });
}

function updateCharts() {
  const c = { pending:0, shortlisted:0, interview:0, selected:0, rejected:0, withdrawn:0 };
  allApps.forEach(a => { if(c[a.status]!==undefined) c[a.status]++; });
  const pEl = document.getElementById('pipelineChart');
  if (pipelineChart) pipelineChart.destroy();
  pipelineChart = new Chart(pEl.getContext('2d'), {
    type:'doughnut',
    data:{ labels:['Pending','Shortlisted','Interview','Selected','Rejected','Withdrawn'],
           datasets:[{ data:Object.values(c), backgroundColor:['#f59e0b','#38bdf8','#a78bfa','#10b981','#f43f5e','#475569'], borderColor:'rgba(0,0,0,.3)', borderWidth:2 }] },
    options:{ plugins:{ legend:{ labels:{ color:'#94a3b8', font:{family:'DM Sans'} }}}, cutout:'65%' }
  });
  const roleCounts = {};
  allApps.forEach(a => { roleCounts[a.role]=(roleCounts[a.role]||0)+1; });
  const sorted = Object.entries(roleCounts).sort((a,b)=>b[1]-a[1]).slice(0,7);
  const rEl = document.getElementById('roleChart');
  if (roleChart) roleChart.destroy();
  roleChart = new Chart(rEl.getContext('2d'), {
    type:'bar',
    data:{ labels:sorted.map(([k])=>k.length>20?k.slice(0,20)+'…':k),
           datasets:[{ label:'Applications', data:sorted.map(([,v])=>v), backgroundColor:'rgba(37,99,235,.7)', borderColor:'#2563eb', borderWidth:1, borderRadius:4 }] },
    options:{ indexAxis:'y', plugins:{ legend:{display:false} }, scales:{ x:{ ticks:{color:'#94a3b8'}, grid:{color:'rgba(255,255,255,.05)'} }, y:{ticks:{color:'#94a3b8'}} } }
  });
}

function populateRoleFilter() {
  const sel = document.getElementById('roleFilter');
  const roles = [...new Set(allApps.map(a=>a.role))].sort();
  sel.innerHTML = '<option value="">All Roles</option>';
  roles.forEach(r => { const o=document.createElement('option'); o.value=r; o.textContent=r; sel.appendChild(o); });
}

window.renderTable = function () {
  const q       = document.getElementById('tableSearch').value.toLowerCase();
  const status  = document.getElementById('statusFilter').value;
  const role    = document.getElementById('roleFilter').value;
  const topOnly = document.getElementById('topOnlyFilter').checked;
  filtered = allApps.filter(a => {
    if (q && !`${a.name} ${a.email} ${a.role} ${a.company}`.toLowerCase().includes(q)) return false;
    if (status && a.status !== status) return false;
    if (role && a.role !== role) return false;
    if (topOnly && a.adminTag !== 'strong') return false;
    return true;
  });
  if (sortState.col) {
    filtered.sort((a,b) => {
      let va=parseFloat(a[sortState.col])||0, vb=parseFloat(b[sortState.col])||0;
      if (sortState.col==='date') { va=new Date(a.date).getTime(); vb=new Date(b.date).getTime(); }
      return sortState.asc ? va-vb : vb-va;
    });
  }
  document.getElementById('tableCount').textContent = `${filtered.length} of ${allApps.length} shown`;
  const tbody = document.getElementById('appBody');
  if (!filtered.length) { tbody.innerHTML='<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">🔍</div><p>No applications match.</p></div></td></tr>'; return; }
  tbody.innerHTML = filtered.map(a => {
    const tag   = a.adminTag==='strong' ? `<span class="admin-tag tag-strong" onclick="cycleTag('${a.id}','strong')">⭐ Strong</span>`
                : a.adminTag==='avg'    ? `<span class="admin-tag tag-avg"    onclick="cycleTag('${a.id}','avg')">〜 Avg</span>`
                :                        `<span class="admin-tag tag-none"    onclick="cycleTag('${a.id}','none')">· Untagged</span>`;
    const opts  = PIPELINE_STAGES.map(s=>`<option value="${s.key}"${s.key===a.status?' selected':''}>${s.label}</option>`).join('');
    const match = a.matchScore!=null ? `${a.matchScore}%` : '—';
    const mc    = !a.matchScore?'var(--txt-3)':a.matchScore>=75?'var(--em)':a.matchScore>=50?'var(--amber)':'var(--rose)';
    return `
    <tr class="${a.adminTag==='strong'?'highlight-row':''}">
      <td><input type="checkbox" class="row-check" data-id="${a.id}" onchange="handleRowCheck(this)"></td>
      <td>${esc(a.name)}<br><span style="font-size:.72rem;color:var(--txt-3);">${esc(a.branch||'')} · ${esc(a.year||'')}</span></td>
      <td style="font-size:.8rem;">${esc(a.email)}</td>
      <td style="font-size:.8rem;">${esc(a.role)}<br><span style="font-size:.7rem;color:var(--txt-3);">${esc(a.company||'')}</span></td>
      <td><strong>${a.cgpa||'—'}</strong></td>
      <td><strong style="color:${mc}">${match}</strong></td>
      <td><select class="pipeline-select" onchange="updateStage('${a.id}',this.value)">${opts}</select></td>
      <td>${tag}</td>
      <td style="font-size:.75rem;color:var(--txt-3);">${esc(a.date||'—')}</td>
      <td><div class="action-col"><button class="btn btn-danger btn-xs" onclick="confirmDelete('${a.id}','${esc(a.name)}')">Remove</button></div></td>
    </tr>`;
  }).join('');
  syncCheckboxes();
};

function esc(s) { return String(s||'').replace(/[<>"'&]/g,c=>({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c])); }

function syncCheckboxes() {
  document.querySelectorAll('.row-check').forEach(c => { c.checked = selected.has(c.dataset.id); });
}

window.sortBy = function (col) {
  sortState = { col, asc: sortState.col===col ? !sortState.asc : true };
  renderTable();
};

window.updateStage = async function (id, status) {
  try {
    await updateDoc(doc(db,'applications',id), { status });
    const a = allApps.find(x=>x.id===id); if(a) a.status=status;
    updateStats(); updateCharts();
    addAdminLog('🔄', `Stage → ${status}`, a?.name);
    toast(`Moved to ${status}`, 'success');
  } catch { toast('Update failed.', 'error'); }
};

window.cycleTag = async function (id, current) {
  const next = current==='none'?'strong':current==='strong'?'avg':'none';
  try {
    await updateDoc(doc(db,'applications',id), { adminTag:next });
    const a = allApps.find(x=>x.id===id); if(a) a.adminTag=next;
    addAdminLog('🏷', `Tag → ${next}`, a?.name);
    renderTable();
  } catch { toast('Tag failed.', 'error'); }
};

window.confirmDelete = function (id, name) {
  showConfirm(`Remove ${name}?`, 'This permanently deletes their application.', async () => {
    try {
      await deleteDoc(doc(db,'applications',id));
      allApps = allApps.filter(a=>a.id!==id);
      addAdminLog('🗑', 'Removed', name);
      updateStats(); updateCharts(); renderTable();
      toast(`${name} removed.`, 'success');
    } catch { toast('Delete failed.', 'error'); }
  });
};

// ── BULK ──
window.toggleSelectAll = function (cb) {
  document.querySelectorAll('.row-check').forEach(c => { c.checked=cb.checked; cb.checked?selected.add(c.dataset.id):selected.delete(c.dataset.id); });
  updateBulkBar();
};
window.handleRowCheck = function (cb) { cb.checked?selected.add(cb.dataset.id):selected.delete(cb.dataset.id); updateBulkBar(); };
function updateBulkBar() {
  document.getElementById('bulkCount').textContent = `${selected.size} selected`;
  document.getElementById('bulkBar').classList.toggle('active', selected.size>0);
}
window.clearSelection = function () {
  selected.clear();
  document.querySelectorAll('.row-check').forEach(c=>c.checked=false);
  document.getElementById('selectAll').checked=false;
  updateBulkBar();
};
window.bulkUpdateStage = async function () {
  const stage = document.getElementById('bulkStageSelect').value;
  if (!stage) { toast('Pick a stage.','warning'); return; }
  if (!selected.size) { toast('Nothing selected.','warning'); return; }
  let done=0;
  for (const id of selected) {
    try { await updateDoc(doc(db,'applications',id),{status:stage}); const a=allApps.find(x=>x.id===id); if(a) a.status=stage; done++; } catch{}
  }
  addAdminLog('⚡', `Bulk → ${stage} (${done})`);
  toast(`${done} moved to ${stage}.`,'success');
  clearSelection(); updateStats(); updateCharts(); renderTable();
};
window.bulkExport = function () {
  const rows = allApps.filter(a=>selected.has(a.id));
  downloadCSV(rows, `bulk-${Date.now()}.csv`);
  addAdminLog('⬇', `Bulk export (${rows.length})`);
};

// ── CSV ──
window.exportCSV = function () {
  const filterVal = document.getElementById('exportStatus').value;
  const rows = filterVal==='all' ? allApps : allApps.filter(a=>a.status===filterVal);
  downloadCSV(rows, `applications-${filterVal}-${Date.now()}.csv`);
  addAdminLog('⬇', `Export: ${filterVal} (${rows.length})`);
};
function downloadCSV(rows, filename) {
  if (!rows.length) { toast('No data.','warning'); return; }
  const h = ['Name','Email','College','Contact','LinkedIn','Branch','Year','CGPA','Role','Company','Match%','Status','Tag','Date','Message'];
  const e = v => `"${String(v||'').replace(/"/g,'""')}"`;
  const lines = [h.join(','), ...rows.map(a=>[a.name,a.email,a.collegeName,a.contact,a.linkedin,a.branch,a.year,a.cgpa,a.role,a.company,a.matchScore,a.status,a.adminTag||'',a.date,a.message||''].map(e).join(','))];
  const blob = new Blob([lines.join('\n')],{type:'text/csv'});
  const el = document.createElement('a'); el.href=URL.createObjectURL(blob); el.download=filename; el.click();
  toast(`Exported ${rows.length} rows.`,'success');
}

// ── Activity log ──
function addAdminLog(icon, action, subject='') {
  adminLog.unshift({ icon, action, subject, time:new Date().toLocaleTimeString('en-IN') });
  adminLog = adminLog.slice(0,30);
  document.getElementById('adminActivityFeed').innerHTML = adminLog.map(e=>`
    <div class="activity-item">
      <span class="activity-icon">${e.icon}</span>
      <div class="activity-content">
        <div class="act-title">${e.action}${e.subject?` — <span style="color:var(--sky)">${esc(e.subject)}</span>`:''}
        </div>
        <div class="act-time">${e.time}</div>
      </div>
    </div>`).join('');
}

// ── Confirm modal ──
function showConfirm(title, msg, onOk) {
  document.getElementById('popupTitle').textContent = title;
  document.getElementById('popupMsg').textContent = msg;
  document.getElementById('popupOk').onclick = ()=>{ document.getElementById('popup').classList.remove('active'); onOk(); };
  document.getElementById('popupCancel').style.display = 'inline-flex';
  document.getElementById('popupCancel').onclick = ()=>document.getElementById('popup').classList.remove('active');
  document.getElementById('popup').classList.add('active');
}

// ── Toast ──
function toast(msg, type='info') {
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const el=document.createElement('div'); el.className=`toast ${type}`;
  el.innerHTML=`<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(),3800);
}

window.adminLogout = function () { sessionStorage.removeItem('adminLoggedIn'); location.href='admin-login.html'; };

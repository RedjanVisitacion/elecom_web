document.addEventListener('DOMContentLoaded', function(){
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const closeSidebar = document.getElementById('closeSidebar');

  if (menuToggle && sidebar && sidebarOverlay) {
    menuToggle.addEventListener('click', function(){ sidebar.classList.add('active'); sidebarOverlay.classList.add('active'); });
  }
  if (closeSidebar && sidebar && sidebarOverlay) {
    closeSidebar.addEventListener('click', function(){ sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); });
  }
  if (sidebarOverlay && sidebar) {
    sidebarOverlay.addEventListener('click', function(){ sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); });
  }
  window.addEventListener('resize', function(){
    if (window.innerWidth > 992 && sidebar && sidebarOverlay) {
      sidebar.classList.remove('active');
      sidebarOverlay.classList.remove('active');
    }
  });

  const startEl = document.getElementById('repStart');
  const endEl = document.getElementById('repEnd');
  const clearBtn = document.getElementById('clearDates');
  const applyWinBtn = document.getElementById('applyWindow');
  const alertBox = document.getElementById('alertBox');
  const fmtCards = Array.from(document.querySelectorAll('.format-card'));
  let selectedFormat = 'pdf';

  fmtCards.forEach(btn => {
    btn.addEventListener('click', () => {
      fmtCards.forEach(b=> b.classList.remove('btn-outline-primary','border-2','active'));
      fmtCards.forEach(b=> b.classList.add('btn-light'));
      btn.classList.remove('btn-light');
      btn.classList.add('btn-outline-primary','border-2','active');
      selectedFormat = btn.getAttribute('data-format') || 'pdf';
    });
  });

  function formatDate(d){
    try { return new Date(d).toLocaleDateString(); } catch(e){ return d || 'All time'; }
  }

  function showAlert(msg, type='danger'){
    if (!alertBox) return;
    if (!msg) { alertBox.classList.add('d-none'); alertBox.textContent=''; return; }
    alertBox.className = 'alert alert-'+type;
    alertBox.textContent = msg;
    alertBox.classList.remove('d-none');
  }

  function validateDates(){
    const s = startEl.value; const e = endEl.value;
    if (s && e && e < s) { showAlert('End date must be on or after Start date.'); return false; }
    showAlert('');
    return true;
  }

  if (clearBtn){
    clearBtn.addEventListener('click', ()=>{
      startEl.value='';
      endEl.value='';
      validateDates();
    });
  }

  startEl.addEventListener('change', validateDates);
  endEl.addEventListener('change', validateDates);

  async function loadElectionWindow(){
    try {
      const res = await fetch('/api/admin/election-window/', { credentials: 'same-origin' });
      const data = await res.json();
      if (!data || !data.ok || !data.window) return null;
      return data.window;
    } catch (e) {
      return null;
    }
  }

  let defaultStart = '';
  let defaultEnd = '';

  function isoDateOnly(iso){
    if (!iso) return '';
    try { return String(iso).slice(0,10); } catch(e){ return ''; }
  }

  (async ()=>{
    const w = await loadElectionWindow();
    if (w) {
      defaultStart = isoDateOnly(w.start_at);
      defaultEnd = isoDateOnly(w.end_at);
      if (applyWinBtn) applyWinBtn.classList.remove('d-none');
    }

    if (applyWinBtn){
      applyWinBtn.addEventListener('click', ()=>{
        if (defaultStart) startEl.value = defaultStart;
        if (defaultEnd) endEl.value = defaultEnd;
        validateDates();
      });
    }
  })();

  function buildReportHTML(data){
    const range = data?.range || {}; const totals = data?.totals || {};
    const byOrg = data?.by_org || {}; const byPos = data?.by_pos || {}; const cand = data?.candidates || [];
    const rowsOrg = Object.keys(byOrg).map(k=>`<tr><td>${k}</td><td class="text-end">${byOrg[k]}</td></tr>`).join('');
    const rowsPos = Object.keys(byPos).map(k=>`<tr><td>${k}</td><td class="text-end">${byPos[k]}</td></tr>`).join('');
    const rowsCand = cand.map(c=>`<tr><td>${c.organization||'USG'}</td><td>${c.position||''}</td><td>${[c.last_name,c.first_name].filter(Boolean).join(', ')}</td><td class="text-end">${c.votes||0}</td></tr>`).join('');
    return `
      <div>
        <h3 class="mb-1">Election Report</h3>
        <div class="text-muted mb-3">Range: ${range.start?formatDate(range.start):'All time'} ${range.end?('– '+formatDate(range.end)) : ''}</div>
        <div class="row g-3 mb-3">
          <div class="col-12 col-md-4"><div class="p-3 border rounded"><div class="text-muted small">Total Votes</div><div class="h4 mb-0">${totals.total_votes||0}</div></div></div>
          <div class="col-12 col-md-4"><div class="p-3 border rounded"><div class="text-muted small">Distinct Voters</div><div class="h4 mb-0">${totals.distinct_voters||0}</div></div></div>
          <div class="col-12 col-md-4"><div class="p-3 border rounded"><div class="text-muted small">Candidates</div><div class="h4 mb-0">${totals.total_candidates||0}</div></div></div>
        </div>
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <div class="border rounded">
              <div class="p-2 border-bottom fw-semibold">Votes by Organization</div>
              <div class="p-2">
                <table class="table table-sm mb-0"><tbody>${rowsOrg||'<tr><td class="text-muted">No data</td></tr>'}</tbody></table>
              </div>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="border rounded">
              <div class="p-2 border-bottom fw-semibold">Votes by Position</div>
              <div class="p-2">
                <table class="table table-sm mb-0"><tbody>${rowsPos||'<tr><td class="text-muted">No data</td></tr>'}</tbody></table>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-3">
          <div class="p-2 border rounded mb-1 fw-semibold">Candidates</div>
          <div class="p-2">
            <table class="table table-sm"><thead><tr><th>Org</th><th>Position</th><th>Name</th><th class="text-end">Votes</th></tr></thead><tbody>${rowsCand||'<tr><td colspan=4 class="text-muted">No candidates</td></tr>'}</tbody></table>
          </div>
        </div>
      </div>`;
  }

  function buildReportText(data){
    const range = data?.range || {}; const totals = data?.totals || {}; const byOrg = data?.by_org || {}; const byPos = data?.by_pos || {}; const cand = data?.candidates || [];
    let out = '';
    out += 'Election Report\n';
    out += 'Range: ' + (range.start||'All time') + (range.end?(' - '+range.end):'') + '\n\n';
    out += 'Totals\n';
    out += '- Total Votes: ' + (totals.total_votes||0) + '\n';
    out += '- Distinct Voters: ' + (totals.distinct_voters||0) + '\n';
    out += '- Candidates: ' + (totals.total_candidates||0) + '\n\n';
    out += 'Votes by Organization\n';
    for (const k in byOrg) out += '  * ' + k + ': ' + byOrg[k] + '\n';
    out += '\nVotes by Position\n';
    for (const k in byPos) out += '  * ' + k + ': ' + byPos[k] + '\n';
    out += '\nCandidates\n';
    cand.forEach(c=>{ out += `  * ${c.organization||'USG'} | ${c.position||''} | ${[c.last_name,c.first_name].filter(Boolean).join(', ')} | votes: ${c.votes||0}\n`; });
    return out;
  }

  function buildReportCSV(data){
    const totals = data?.totals || {}; const byOrg = data?.by_org || {}; const byPos = data?.by_pos || {}; const cand = data?.candidates || [];
    const rows = [];
    rows.push(['Section','Key','Value','Org','Position','Name','Votes']);
    rows.push(['Overview','total_votes', String(totals.total_votes||0),'','','','']);
    rows.push(['Overview','distinct_voters', String(totals.distinct_voters||0),'','','','']);
    rows.push(['Overview','total_candidates', String(totals.total_candidates||0),'','','','']);
    Object.keys(byOrg).forEach(k=>{ rows.push(['By Organization',k,String(byOrg[k]||0),'','','','']); });
    Object.keys(byPos).forEach(k=>{ rows.push(['By Position',k,String(byPos[k]||0),'','','','']); });
    cand.forEach(c=>{ rows.push(['Candidates','','',''+(c.organization||'USG'),''+(c.position||''),[c.last_name,c.first_name].filter(Boolean).join(', '), String(c.votes||0)]); });
    const esc = v => '"'+String(v).replaceAll('"','""')+'"';
    return rows.map(r=>r.map(esc).join(',')).join('\n');
  }

  async function getSummary(){
    const s = startEl.value || '';
    const e = endEl.value || '';
    if (!validateDates()) { throw new Error('invalid_date'); }
    const url = new URL('/api/admin/reports/summary/', window.location.origin);
    if (s) url.searchParams.set('start', s);
    if (e) url.searchParams.set('end', e);
    const res = await fetch(url.toString(), { credentials: 'same-origin' });
    return await res.json();
  }

  const previewCard = document.getElementById('reportPreviewCard');
  const previewEl = document.getElementById('reportPreview');

  function setLoading(b){
    fmtCards.forEach(bn=> bn.disabled = b);
    startEl.disabled = b;
    endEl.disabled = b;
    const genBtn = document.getElementById('genReportBtn');
    const prevBtn = document.getElementById('previewBtn');
    genBtn.disabled = b;
    prevBtn.disabled = b;
    if (b){
      if (!genBtn.dataset.orig) genBtn.dataset.orig = genBtn.innerHTML;
      genBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...';
    } else {
      if (genBtn.dataset.orig) { genBtn.innerHTML = genBtn.dataset.orig; delete genBtn.dataset.orig; }
    }
  }

  async function refreshPreview(){
    setLoading(true);
    try{
      const data = await getSummary();
      if (!data || !data.ok) {
        showAlert((data && data.error) ? data.error : 'Failed to load report summary.');
        return null;
      }
      previewEl.innerHTML = buildReportHTML(data);
      previewCard.classList.remove('d-none');
      return data;
    } finally {
      setLoading(false);
    }
  }

  document.getElementById('previewBtn').addEventListener('click', refreshPreview);

  document.getElementById('genReportBtn').addEventListener('click', async ()=>{
    try{
      const data = await refreshPreview();
      if (!data) return;
      if (selectedFormat === 'pdf'){
        const opt = { margin: 8, filename: 'election_report_'+ new Date().toISOString().replaceAll(':','-').slice(0,19) + '.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
        await html2pdf().from(previewEl).set(opt).save();
      } else if (selectedFormat === 'csv') {
        const csv = buildReportCSV(data);
        const blob = new Blob([csv], {type:'text/csv'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'election_report_'+ new Date().toISOString().slice(0,10) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
      } else {
        const text = buildReportText(data);
        const blob = new Blob([text], {type:'text/plain'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'election_report_'+ new Date().toISOString().slice(0,10) + '.txt'; document.body.appendChild(a); a.click(); a.remove();
      }
    } catch(e){
      if (String(e&&e.message) === 'invalid_date') showAlert('Please fix the date range before generating.');
      else showAlert('Failed to generate report.','danger');
    }
  });
});

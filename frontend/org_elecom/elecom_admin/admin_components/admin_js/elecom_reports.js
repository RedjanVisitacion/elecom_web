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
  const previewCard = document.getElementById('reportPreviewCard');
  const previewEl = document.getElementById('reportPreview');
  let selectedFormat = 'pdf';

  fmtCards.forEach(btn => {
    btn.addEventListener('click', () => {
      fmtCards.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFormat = btn.getAttribute('data-format') || 'pdf';
    });
  });

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(d){
    if (!d) return 'All time';
    try { return new Date(d).toLocaleDateString(); } catch(e){ return d; }
  }

  function formatDateTime(d = new Date()){
    return d.toLocaleString([], { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  function pct(value, total){
    const n = Number(value || 0);
    const d = Number(total || 0);
    if (!d) return 0;
    return Math.round((n / d) * 1000) / 10;
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

  function isoDateOnly(iso){
    if (!iso) return '';
    try { return String(iso).slice(0,10); } catch(e){ return ''; }
  }

  (async ()=>{
    const w = await loadElectionWindow();
    if (!w || !applyWinBtn) return;
    const defaultStart = isoDateOnly(w.start_at);
    const defaultEnd = isoDateOnly(w.end_at);
    applyWinBtn.classList.remove('d-none');
    applyWinBtn.addEventListener('click', ()=>{
      if (defaultStart) startEl.value = defaultStart;
      if (defaultEnd) endEl.value = defaultEnd;
      validateDates();
    });
  })();

  function candidateName(c){
    return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed candidate';
  }

  function rankedCandidates(candidates){
    return [...(candidates || [])]
      .sort((a, b) => Number(b.votes || 0) - Number(a.votes || 0) || candidateName(a).localeCompare(candidateName(b)));
  }

  function enrichReport(data){
    const totals = data?.totals || {};
    const candidates = rankedCandidates(data?.candidates || []);
    const totalVotes = Number(totals.total_votes || 0);
    const totalVoters = Number(totals.total_voters || 0);
    const turnout = pct(totals.distinct_voters || 0, totalVoters);
    const byOrg = data?.by_org || {};
    const byPos = data?.by_pos || {};
    const leadingOrg = Object.entries(byOrg).sort((a,b) => Number(b[1] || 0) - Number(a[1] || 0))[0];
    const highestCandidate = candidates[0];
    const topVotes = Number(highestCandidate?.votes || 0);
    return { totals, candidates, totalVotes, totalVoters, turnout, byOrg, byPos, leadingOrg, highestCandidate, topVotes };
  }

  function barRows(entries, total, emptyLabel){
    const list = entries.filter(([, value]) => Number(value || 0) > 0);
    if (!list.length) {
      return `<div class="report-empty-mini">${escapeHtml(emptyLabel)}</div>`;
    }
    return list.map(([label, value]) => {
      const width = Math.max(3, pct(value, total));
      return `
        <div class="report-bar-row">
          <div class="report-bar-label">${escapeHtml(label)}</div>
          <div class="report-bar-track"><span style="width:${width}%"></span></div>
          <div class="report-bar-value">${Number(value || 0)}</div>
        </div>`;
    }).join('');
  }

  function candidateStatus(candidate, topVotes){
    const votes = Number(candidate.votes || 0);
    if (!votes) return 'No votes';
    if (votes === topVotes) return 'Leading';
    return 'Ranked';
  }

  function candidateTableRows(candidates, totalVotes, topVotes){
    if (!candidates.length) {
      return '<tr><td colspan="7" class="text-muted text-center py-4">No candidates found.</td></tr>';
    }
    return candidates.map((c, index) => {
      const votes = Number(c.votes || 0);
      const status = candidateStatus(c, topVotes);
      const statusClass = status === 'Leading' ? 'is-leading' : (status === 'No votes' ? 'is-empty' : '');
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(c.organization || 'USG')}</td>
          <td>${escapeHtml(c.position || '')}</td>
          <td>${escapeHtml(candidateName(c))}</td>
          <td class="text-end">${votes}</td>
          <td class="text-end">${pct(votes, totalVotes)}%</td>
          <td><span class="report-status ${statusClass}">${status}</span></td>
        </tr>`;
    }).join('');
  }

  function simpleRows(obj, total, emptyText){
    const entries = Object.entries(obj || {}).sort((a,b) => Number(b[1] || 0) - Number(a[1] || 0));
    if (!entries.length) return `<tr><td colspan="3" class="text-muted text-center py-3">${escapeHtml(emptyText)}</td></tr>`;
    return entries.map(([label, value]) => `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td class="text-end">${Number(value || 0)}</td>
        <td class="text-end">${pct(value, total)}%</td>
      </tr>`).join('');
  }

  function buildReportHTML(data){
    const range = data?.range || {};
    const enriched = enrichReport(data);
    const hasVotes = enriched.totalVotes > 0;
    const orgEntries = Object.entries(enriched.byOrg).sort((a,b) => Number(b[1] || 0) - Number(a[1] || 0));
    const posEntries = Object.entries(enriched.byPos).sort((a,b) => Number(b[1] || 0) - Number(a[1] || 0));
    const topCandidates = enriched.candidates.slice(0, 8).map(c => [candidateName(c), Number(c.votes || 0)]);
    const rangeText = `${range.start ? formatDate(range.start) : 'All time'}${range.end ? ' - ' + formatDate(range.end) : ''}`;
    const highestName = enriched.highestCandidate ? candidateName(enriched.highestCandidate) : 'None yet';
    const leadingOrg = enriched.leadingOrg ? `${enriched.leadingOrg[0]} (${enriched.leadingOrg[1]})` : 'None yet';

    return `
      <article class="official-report">
        <header class="official-report-header">
          <div class="official-brand">
            <img src="/static/assets/elecom.png" alt="ELECOM Logo">
            <div>
              <div class="official-kicker">Electoral Commission</div>
              <h2>Election Report</h2>
              <p>Generated ${escapeHtml(formatDateTime())}</p>
            </div>
          </div>
          <div class="official-range">
            <span>Date Range</span>
            <strong>${escapeHtml(rangeText)}</strong>
          </div>
        </header>

        ${hasVotes ? '' : `
          <section class="report-empty-state">
            <i class="bi bi-inbox"></i>
            <div>
              <h3>No votes recorded yet</h3>
              <p>Report will update once voters start submitting ballots.</p>
            </div>
          </section>`}

        <section class="report-summary-grid">
          <div class="report-summary-card"><span>Total Votes</span><strong>${enriched.totalVotes}</strong></div>
          <div class="report-summary-card"><span>Distinct Voters</span><strong>${enriched.totals.distinct_voters || 0}</strong></div>
          <div class="report-summary-card"><span>Total Candidates</span><strong>${enriched.totals.total_candidates || 0}</strong></div>
          <div class="report-summary-card"><span>Voter Turnout</span><strong>${enriched.turnout}%</strong></div>
          <div class="report-summary-card wide"><span>Leading Organization</span><strong>${escapeHtml(leadingOrg)}</strong></div>
          <div class="report-summary-card wide"><span>Highest Vote Candidate</span><strong>${escapeHtml(highestName)}</strong></div>
        </section>

        <section class="report-chart-grid">
          <div class="report-chart-card">
            <h3>Votes by Organization</h3>
            ${barRows(orgEntries, Math.max(...orgEntries.map(([,v]) => Number(v || 0)), 1), 'No organization votes yet')}
          </div>
          <div class="report-chart-card">
            <h3>Votes by Position</h3>
            ${barRows(posEntries, Math.max(...posEntries.map(([,v]) => Number(v || 0)), 1), 'No position votes yet')}
          </div>
          <div class="report-chart-card">
            <h3>Candidate Ranking</h3>
            ${barRows(topCandidates, Math.max(...topCandidates.map(([,v]) => Number(v || 0)), 1), 'No candidate votes yet')}
          </div>
          <div class="report-chart-card turnout-card">
            <h3>Turnout</h3>
            <div class="turnout-ring" style="--turnout:${enriched.turnout}">
              <strong>${enriched.turnout}%</strong>
              <span>${enriched.totals.distinct_voters || 0}/${enriched.totalVoters || 0}</span>
            </div>
          </div>
        </section>

        <section class="report-table-grid">
          <div class="report-table-card">
            <h3>Organization Results</h3>
            <div class="report-table-wrap">
              <table class="table table-sm">
                <thead><tr><th>Organization</th><th class="text-end">Votes</th><th class="text-end">Share</th></tr></thead>
                <tbody>${simpleRows(enriched.byOrg, enriched.totalVotes, 'No organization data')}</tbody>
              </table>
            </div>
          </div>
          <div class="report-table-card">
            <h3>Position Results</h3>
            <div class="report-table-wrap">
              <table class="table table-sm">
                <thead><tr><th>Position</th><th class="text-end">Votes</th><th class="text-end">Share</th></tr></thead>
                <tbody>${simpleRows(enriched.byPos, enriched.totalVotes, 'No position data')}</tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="report-table-card">
          <h3>Candidate Results</h3>
          <div class="report-table-wrap">
            <table class="table table-sm candidate-report-table">
              <thead>
                <tr>
                  <th>Rank</th><th>Organization</th><th>Position</th><th>Candidate Name</th>
                  <th class="text-end">Total Votes</th><th class="text-end">Percentage</th><th>Status</th>
                </tr>
              </thead>
              <tbody>${candidateTableRows(enriched.candidates, enriched.totalVotes, enriched.topVotes)}</tbody>
            </table>
          </div>
        </section>

        <footer class="official-report-footer">Generated by ELECOM System</footer>
      </article>`;
  }

  function buildReportText(data){
    const enriched = enrichReport(data);
    const range = data?.range || {};
    let out = '';
    out += 'ELECOM Election Report\n';
    out += 'Generated: ' + formatDateTime() + '\n';
    out += 'Range: ' + (range.start||'All time') + (range.end?(' - '+range.end):'') + '\n\n';
    out += 'Summary\n';
    out += '- Total Votes: ' + enriched.totalVotes + '\n';
    out += '- Distinct Voters: ' + (enriched.totals.distinct_voters||0) + '\n';
    out += '- Total Candidates: ' + (enriched.totals.total_candidates||0) + '\n';
    out += '- Voter Turnout: ' + enriched.turnout + '%\n';
    out += '- Leading Organization: ' + (enriched.leadingOrg ? enriched.leadingOrg[0] : 'None yet') + '\n';
    out += '- Highest Vote Candidate: ' + (enriched.highestCandidate ? candidateName(enriched.highestCandidate) : 'None yet') + '\n\n';
    out += 'Votes by Organization\n';
    Object.entries(enriched.byOrg).forEach(([k,v]) => { out += '  * ' + k + ': ' + v + '\n'; });
    out += '\nVotes by Position\n';
    Object.entries(enriched.byPos).forEach(([k,v]) => { out += '  * ' + k + ': ' + v + '\n'; });
    out += '\nCandidates\n';
    enriched.candidates.forEach((c, i)=>{ out += `  ${i+1}. ${c.organization||'USG'} | ${c.position||''} | ${candidateName(c)} | votes: ${c.votes||0} | ${pct(c.votes, enriched.totalVotes)}%\n`; });
    return out;
  }

  function buildReportCSV(data){
    const enriched = enrichReport(data);
    const rows = [];
    rows.push(['Section','Key','Value','Org','Position','Name','Votes','Percentage','Status']);
    rows.push(['Overview','total_votes', String(enriched.totalVotes),'','','','','','']);
    rows.push(['Overview','distinct_voters', String(enriched.totals.distinct_voters||0),'','','','','','']);
    rows.push(['Overview','total_candidates', String(enriched.totals.total_candidates||0),'','','','','','']);
    rows.push(['Overview','voter_turnout_percent', String(enriched.turnout),'','','','','','']);
    Object.entries(enriched.byOrg).forEach(([k,v]) => rows.push(['By Organization',k,String(v||0),'','','','',String(pct(v, enriched.totalVotes)),'']));
    Object.entries(enriched.byPos).forEach(([k,v]) => rows.push(['By Position',k,String(v||0),'',''+k,'','',String(pct(v, enriched.totalVotes)),'']));
    enriched.candidates.forEach((c, i) => rows.push(['Candidates',String(i+1),'',''+(c.organization||'USG'),''+(c.position||''),candidateName(c),String(c.votes||0),String(pct(c.votes, enriched.totalVotes)),candidateStatus(c, enriched.topVotes)]));
    const esc = v => '"' + String(v).replace(/"/g,'""') + '"';
    return rows.map(r => r.map(esc).join(',')).join('\n');
  }

  async function getSummary(){
    const s = startEl.value || '';
    const e = endEl.value || '';
    if (!validateDates()) throw new Error('invalid_date');
    const url = new URL('/api/admin/reports/summary/', window.location.origin);
    if (s) url.searchParams.set('start', s);
    if (e) url.searchParams.set('end', e);
    const res = await fetch(url.toString(), { credentials: 'same-origin' });
    return await res.json();
  }

  function setLoading(isLoading){
    fmtCards.forEach(btn => { btn.disabled = isLoading; });
    startEl.disabled = isLoading;
    endEl.disabled = isLoading;
    const genBtn = document.getElementById('genReportBtn');
    const prevBtn = document.getElementById('previewBtn');
    genBtn.disabled = isLoading;
    prevBtn.disabled = isLoading;
    if (isLoading){
      if (!genBtn.dataset.orig) genBtn.dataset.orig = genBtn.innerHTML;
      genBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...';
    } else if (genBtn.dataset.orig) {
      genBtn.innerHTML = genBtn.dataset.orig;
      delete genBtn.dataset.orig;
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
      const stamp = new Date().toISOString().replace(/:/g,'-').slice(0,19);
      if (selectedFormat === 'pdf'){
        const opt = {
          margin: 8,
          filename: 'election_report_' + stamp + '.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        };
        await html2pdf().from(previewEl).set(opt).save();
      } else if (selectedFormat === 'csv') {
        const blob = new Blob([buildReportCSV(data)], {type:'text/csv'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'election_report_' + new Date().toISOString().slice(0,10) + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const blob = new Blob([buildReportText(data)], {type:'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'election_report_' + new Date().toISOString().slice(0,10) + '.txt';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch(e){
      if (String(e && e.message) === 'invalid_date') showAlert('Please fix the date range before generating.');
      else showAlert('Failed to generate report.','danger');
    }
  });
});

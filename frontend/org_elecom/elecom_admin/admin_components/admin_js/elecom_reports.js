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
  const reportElectionSelect = document.getElementById('reportElectionSelect');
  const alertBox = document.getElementById('alertBox');
  const fmtCards = Array.from(document.querySelectorAll('.format-card'));
  const previewCard = document.getElementById('reportPreviewCard');
  const previewEl = document.getElementById('reportPreview');
  const summaryElection = document.getElementById('summaryElection');
  const summaryDates = document.getElementById('summaryDates');
  const summaryFormat = document.getElementById('summaryFormat');
  const summaryRecords = document.getElementById('summaryRecords');
  const summaryStatus = document.getElementById('summaryStatus');
  const pageParams = new URLSearchParams(window.location.search);
  const routeElectionMatch = window.location.pathname.match(/\/elections\/(\d+)\/reports\/?$/);
  const pageScope = (pageParams.get('scope') || '').toLowerCase();
  let selectedElectionId = pageScope === 'all' ? '' : (pageParams.get('election_id') || (routeElectionMatch ? routeElectionMatch[1] : ''));
  let loadedElections = [];
  let selectedFormat = 'pdf';
  let estimateTimer = null;

  fmtCards.forEach(btn => {
    btn.addEventListener('click', () => {
      fmtCards.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      selectedFormat = btn.getAttribute('data-format') || 'pdf';
      updateSummaryPanel();
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

  function reportScopeLabel(){
    if (!selectedElectionId) return 'All elections';
    const selectedOption = reportElectionSelect?.selectedOptions?.[0];
    return selectedOption ? selectedOption.textContent.trim() : `Election #${selectedElectionId}`;
  }

  function selectedFormatLabel(){
    const active = fmtCards.find(card => card.classList.contains('active'));
    return active?.dataset?.formatLabel || selectedFormat.toUpperCase();
  }

  function dateCoverageLabel(){
    const s = startEl.value || '';
    const e = endEl.value || '';
    if (s && e) return `${formatDate(s)} - ${formatDate(e)}`;
    if (s) return `From ${formatDate(s)}`;
    if (e) return `Until ${formatDate(e)}`;
    return 'All time';
  }

  function selectedElectionStatus(){
    if (!selectedElectionId) return 'All records';
    const selected = selectedElectionWindow();
    if (!selected) return 'Selected year';
    if (selected.is_active) return 'Active';
    return selected.status || 'Archived';
  }

  function setText(el, value){
    if (el) el.textContent = value;
  }

  function updateSummaryPanel(data){
    setText(summaryElection, reportScopeLabel());
    setText(summaryDates, dateCoverageLabel());
    setText(summaryFormat, selectedFormatLabel());
    setText(summaryStatus, selectedElectionStatus());
    if (data && data.totals) {
      const votes = Number(data.totals.total_votes || 0);
      const candidates = Number(data.totals.total_candidates || 0);
      setText(summaryRecords, `${votes} votes / ${candidates} candidates`);
    } else if (summaryRecords && !summaryRecords.textContent) {
      setText(summaryRecords, 'Ready');
    }
  }

  function buildSummaryUrl(){
    const s = startEl.value || '';
    const e = endEl.value || '';
    const url = new URL('/api/admin/reports/summary/', window.location.origin);
    if (s) url.searchParams.set('start', s);
    if (e) url.searchParams.set('end', e);
    if (selectedElectionId) {
      url.searchParams.set('election_id', selectedElectionId);
    } else {
      url.searchParams.set('scope', 'all');
    }
    return url;
  }

  function scheduleSummaryEstimate(){
    updateSummaryPanel();
    if (!summaryRecords || !startEl || !endEl) return;
    if (estimateTimer) window.clearTimeout(estimateTimer);
    if (startEl.value && endEl.value && endEl.value < startEl.value) {
      setText(summaryRecords, 'Check dates');
      return;
    }
    setText(summaryRecords, 'Checking...');
    estimateTimer = window.setTimeout(async () => {
      try {
        const res = await fetch(buildSummaryUrl().toString(), { credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) updateSummaryPanel(data);
        else setText(summaryRecords, 'Ready');
      } catch (e) {
        setText(summaryRecords, 'Ready');
      }
    }, 350);
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
      scheduleSummaryEstimate();
    });
  }

  startEl.addEventListener('change', () => {
    validateDates();
    scheduleSummaryEstimate();
  });
  endEl.addEventListener('change', () => {
    validateDates();
    scheduleSummaryEstimate();
  });

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

  function electionLabel(election){
    const name = election.name || `Election #${election.id}`;
    return `${name}${election.school_year ? ` (${election.school_year})` : ''}`;
  }

  async function loadElectionChoices(){
    if (!reportElectionSelect) return;
    try {
      const res = await fetch('/api/admin/elections/', { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return;
      loadedElections = data.elections || [];
      reportElectionSelect.innerHTML = [
        '<option value="">All elections</option>',
        ...loadedElections.map((election) => {
          const id = String(election.id || '');
          const status = election.is_active ? 'Active' : (election.status || 'Archived');
          return `<option value="${escapeHtml(id)}" ${id === String(selectedElectionId || '') ? 'selected' : ''}>${escapeHtml(electionLabel(election))} - ${escapeHtml(status)}</option>`;
        }),
      ].join('');
    } catch (e) {
      // Leave the default "All elections" option in place.
    }
  }

  function selectedElectionWindow(){
    if (selectedElectionId) {
      return loadedElections.find(election => String(election.id) === String(selectedElectionId)) || null;
    }
    return null;
  }

  function applyWindowToDates(windowData){
    if (!windowData || !applyWinBtn) return false;
    const defaultStart = isoDateOnly(windowData.start_at);
    const defaultEnd = isoDateOnly(windowData.end_at);
    if (!defaultStart && !defaultEnd) return false;
    applyWinBtn.classList.remove('d-none');
    applyWinBtn.onclick = ()=>{
      if (defaultStart) startEl.value = defaultStart;
      if (defaultEnd) endEl.value = defaultEnd;
      validateDates();
      scheduleSummaryEstimate();
    };
    return true;
  }

  async function configureElectionDateButton(){
    if (!applyWinBtn) return;
    applyWinBtn.classList.add('d-none');
    applyWinBtn.onclick = null;
    const selected = selectedElectionWindow();
    if (selected && applyWindowToDates(selected)) return;
    const w = await loadElectionWindow();
    applyWindowToDates(w);
  }

  reportElectionSelect?.addEventListener('change', () => {
    selectedElectionId = reportElectionSelect.value || '';
    const url = new URL(window.location.href);
    if (selectedElectionId) {
      url.searchParams.set('election_id', selectedElectionId);
      url.searchParams.delete('scope');
    } else {
      url.searchParams.delete('election_id');
      url.searchParams.set('scope', 'all');
    }
    window.history.pushState({ electionId: selectedElectionId }, '', url.toString());
    configureElectionDateButton();
    scheduleSummaryEstimate();
    if (previewCard && !previewCard.classList.contains('d-none')) {
      refreshPreview();
    }
  });

  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const scope = (params.get('scope') || '').toLowerCase();
    selectedElectionId = scope === 'all' ? '' : (params.get('election_id') || (routeElectionMatch ? routeElectionMatch[1] : ''));
    if (reportElectionSelect) reportElectionSelect.value = selectedElectionId;
    configureElectionDateButton();
    scheduleSummaryEstimate();
    if (previewCard && !previewCard.classList.contains('d-none')) {
      refreshPreview();
    }
  });

  (async ()=>{
    await loadElectionChoices();
    await configureElectionDateButton();
    fmtCards.forEach(card => card.setAttribute('aria-pressed', card.classList.contains('active') ? 'true' : 'false'));
    scheduleSummaryEstimate();
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
    const scopeText = reportScopeLabel();
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
            <span>Election Scope</span>
            <strong>${escapeHtml(scopeText)}</strong>
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
    out += 'Election Scope: ' + reportScopeLabel() + '\n';
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
    rows.push(['Overview','election_scope',reportScopeLabel(),'','','','','','']);
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

  function blobToDataUrl(blob){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function inlineReportImages(reportNode){
    const images = Array.from(reportNode.querySelectorAll('img'));
    await Promise.all(images.map(async (img) => {
      try {
        const src = img.getAttribute('src') || '';
        if (!src || src.startsWith('data:')) return;
        const absoluteUrl = new URL(src, window.location.origin).toString();
        const res = await fetch(absoluteUrl, { credentials: 'same-origin', cache: 'force-cache' });
        if (!res.ok) return;
        img.src = await blobToDataUrl(await res.blob());
      } catch (e) {
        // Keep the original source if inlining fails.
      }
    }));
    await Promise.all(images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));
  }

  function trimCanvasTop(canvas){
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas;
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let firstContentRow = 0;
    outer:
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const alpha = data[i + 3];
        const isWhite = data[i] > 248 && data[i + 1] > 248 && data[i + 2] > 248;
        if (alpha > 12 && !isWhite) {
          firstContentRow = Math.max(0, y - 8);
          break outer;
        }
      }
    }
    if (firstContentRow <= 0) return canvas;
    const trimmed = document.createElement('canvas');
    trimmed.width = width;
    trimmed.height = height - firstContentRow;
    const trimmedCtx = trimmed.getContext('2d');
    trimmedCtx.fillStyle = '#ffffff';
    trimmedCtx.fillRect(0, 0, trimmed.width, trimmed.height);
    trimmedCtx.drawImage(canvas, 0, firstContentRow, width, trimmed.height, 0, 0, width, trimmed.height);
    return trimmed;
  }

  async function saveCanvasAsPdf(canvas, filename){
    await html2pdf().set({
      margin: [8, 8, 8, 8],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      pagebreak: { mode: ['css', 'legacy'] },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(canvas, 'canvas').save();
  }

  async function exportPdfReport(data, stamp){
    previewEl.innerHTML = buildReportHTML(data);
    previewCard.classList.remove('d-none');
    const reportNode = previewEl.querySelector('.official-report');
    if (!reportNode) throw new Error('missing_report_preview');

    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;
    reportNode.classList.add('pdf-rendering');
    reportNode.scrollIntoView({ block: 'start', inline: 'nearest' });
    await inlineReportImages(reportNode);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
      const canvas = await html2pdf().from(reportNode).set({
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: Math.max(document.documentElement.clientWidth, reportNode.scrollWidth),
          windowHeight: Math.max(document.documentElement.clientHeight, reportNode.scrollHeight),
        },
      }).toCanvas().get('canvas');
      await saveCanvasAsPdf(trimCanvasTop(canvas), 'election_report_' + stamp + '.pdf');
    } finally {
      reportNode.classList.remove('pdf-rendering');
      window.scrollTo(originalScrollX, originalScrollY);
    }
  }

  async function getSummary(){
    if (!validateDates()) throw new Error('invalid_date');
    const url = buildSummaryUrl();
    const res = await fetch(url.toString(), { credentials: 'same-origin' });
    return await res.json();
  }

  function setLoading(isLoading){
    fmtCards.forEach(btn => { btn.disabled = isLoading; });
    startEl.disabled = isLoading;
    endEl.disabled = isLoading;
    if (reportElectionSelect) reportElectionSelect.disabled = isLoading;
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
      updateSummaryPanel(data);
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
        await exportPdfReport(data, stamp);
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

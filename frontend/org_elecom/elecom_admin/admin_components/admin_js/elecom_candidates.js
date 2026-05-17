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

  const listEl = document.getElementById('candidatesList');
  const listCount = document.getElementById('listCount');
  const searchInput = document.getElementById('listSearch');
  const searchBtn = document.getElementById('listSearchBtn');
  const exportCandidatesBtn = document.getElementById('exportCandidatesBtn');
  const importCandidatesBtn = document.getElementById('importCandidatesBtn');
  const importCandidatesFile = document.getElementById('importCandidatesFile');

  const API_BASE = '/api/admin/candidates/';

  const ORG_ORDER = ['USG', 'SITE', 'PAFE', 'AFPRO', 'AFPROTECHS'];
  const USG_POSITION_ORDER = [
    'PRESIDENT',
    'VICE PRESIDENT',
    'GENERAL SECRETARY',
    'ASSOCIATE SECRETARY',
    'TREASURER',
    'AUDITOR',
    'PUBLIC INFORMATION OFFICER',
    'PIO',
    'IT REPRESENTATIVE',
    'BSIT REPRESENTATIVE',
    'BTLED REPRESENTATIVE',
    'BFPT REPRESENTATIVE',
  ];
  const ORG_POSITION_ORDER = [
    'PRESIDENT',
    'VICE PRESIDENT',
    'GENERAL SECRETARY',
    'ASSOCIATE SECRETARY',
    'TREASURER',
    'AUDITOR',
    'PUBLIC INFORMATION OFFICER',
    'PIO',
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeOrg(org) {
    const up = String(org || 'USG').trim().toUpperCase();
    if (up === 'AFPRO' || up === 'AFPROTECHS' || up.includes('AFPRO')) return 'AFPRO';
    if (up.includes('SITE')) return 'SITE';
    if (up.includes('PAFE')) return 'PAFE';
    if (up.includes('USG')) return 'USG';
    return up || 'USG';
  }

  function normalizePosition(pos) {
    return String(pos || 'Unspecified')
      .trim()
      .replace(/\bP\.?\s*I\.?\s*O\.?\b/gi, 'PIO') || 'Unspecified';
  }

  function positionSortKey(org, pos) {
    const normalized = normalizePosition(pos).toUpperCase();
    const order = normalizeOrg(org) === 'USG' ? USG_POSITION_ORDER : ORG_POSITION_ORDER;

    if (normalized.includes('REPRESENTATIVE')) {
      const repIndex = order.findIndex(label => normalized.includes(label));
      return [repIndex === -1 ? 1000 : repIndex, normalized];
    }

    const index = order.findIndex((label) => {
      if (label === 'PIO') {
        return normalized === 'PIO' || normalized === 'P.I.O' || normalized === 'PUBLIC INFORMATION OFFICER';
      }
      return normalized === label || normalized.includes(label);
    });

    return [index === -1 ? 500 : index, normalized];
  }

  function orgSortKey(org) {
    const normalized = normalizeOrg(org);
    const index = ORG_ORDER.indexOf(normalized);
    return [index === -1 ? 999 : index, normalized];
  }

  function buildCandidateName(candidate) {
    return [candidate.first_name, candidate.middle_name, candidate.last_name].filter(Boolean).join(' ');
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadTextFile(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function normalizeHeader(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_/-]+/g, '');
  }

  function getImportValue(row, names) {
    const keys = Object.keys(row || {});
    for (const name of names) {
      const wanted = normalizeHeader(name);
      const key = keys.find(k => normalizeHeader(k) === wanted);
      if (key) return String(row[key] ?? '').trim();
    }
    return '';
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push(cell);
        cell = '';
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && next === '\n') i += 1;
        row.push(cell);
        if (row.some(v => String(v).trim() !== '')) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }

    row.push(cell);
    if (row.some(v => String(v).trim() !== '')) rows.push(row);
    if (!rows.length) return [];

    const headers = rows.shift().map(h => String(h || '').replace(/^\uFEFF/, '').trim());
    return rows.map(values => {
      const out = {};
      headers.forEach((header, index) => {
        out[header] = values[index] ?? '';
      });
      return out;
    });
  }

  function rowToCandidatePayload(row) {
    const firstName = getImportValue(row, ['First Name', 'first_name', 'firstname']);
    const middleName = getImportValue(row, ['Middle Name', 'middle_name', 'middlename']);
    const lastName = getImportValue(row, ['Last Name', 'last_name', 'lastname']);
    const partyName = getImportValue(row, ['Party', 'Party Name', 'party_name', 'partyname']);
    const candidateType = getImportValue(row, ['Candidate Type', 'candidate_type', 'candidatetype'])
      || (partyName && partyName.toLowerCase() !== 'independent' ? 'Political Party' : 'Independent');

    return {
      student_id: getImportValue(row, ['Student ID', 'student_id', 'studentid']),
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      organization: getImportValue(row, ['Organization', 'Org']),
      position: getImportValue(row, ['Position']),
      party_name: partyName,
      candidate_type: candidateType,
      program: getImportValue(row, ['Program']),
      year_section: getImportValue(row, ['Year/Section', 'Year Section', 'year_section', 'yearsection']),
      platform: getImportValue(row, ['Platform']),
      photo_url: getImportValue(row, ['Photo URL', 'Photo Url', 'photo_url', 'photourl']),
      party_logo_url: getImportValue(row, ['Party Logo URL', 'Party Logo Url', 'party_logo_url', 'partylogourl']),
    };
  }

  function cleanPayload(payload) {
    const cleaned = {};
    Object.entries(payload).forEach(([key, value]) => {
      const text = String(value ?? '').trim();
      if (text) cleaned[key] = text;
    });
    return cleaned;
  }

  let redirectedToSearch = false;
  function goToSearchPage() {
    if (redirectedToSearch) return;
    redirectedToSearch = true;
    const q = searchInput ? searchInput.value.trim() : '';
    const url = new URL('/static/org_elecom/elecom_admin/search_results.html', window.location.origin);
    url.searchParams.set('focus', '1');
    if (q) url.searchParams.set('q', q);
    window.location.href = window.ElecomAdminSecureUrl ? window.ElecomAdminSecureUrl(url.toString()) : url.toString();
  }

  function cardTemplate(item){
    const name = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(' ');
    const hasPhoto = !!(item.photo_url && item.photo_url.startsWith('http'));
    const avatarHtml = hasPhoto
      ? `<img src="${escapeHtml(item.photo_url)}" class="rounded-circle border candidate-avatar-img" alt="">`
      : `<div class="rounded-circle border d-flex align-items-center justify-content-center bg-light candidate-avatar-placeholder"><i class="bi bi-person fs-4 text-secondary"></i></div>`;
    const partyLogo = item.party_logo_url && item.party_logo_url.startsWith('http')
      ? `<img src="${escapeHtml(item.party_logo_url)}" class="rounded-circle border candidate-party-logo" alt="">`
      : '';

    return `
      <div class="p-3 border rounded d-flex align-items-center gap-3 candidate-card" data-id="${item.id}">
        <div class="form-check">
          <input class="form-check-input row-check" type="checkbox" value="${item.id}">
        </div>
        ${avatarHtml}
        <div class="flex-grow-1">
          <div class="fw-semibold">${escapeHtml(name || item.student_id)}</div>
          <div class="small text-muted d-flex align-items-center gap-1">${partyLogo}<span>${escapeHtml(item.party_name || 'Independent')}</span></div>
          <div class="small text-muted">${escapeHtml(item.program || '')}${item.year_section ? ' · ' + escapeHtml(item.year_section) : ''}</div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-outline-primary btn-sm" data-action="edit" data-id="${item.id}"><i class="bi bi-pencil-square"></i></button>
          <button class="btn btn-outline-danger btn-sm" data-action="delete" data-id="${item.id}" data-name="${escapeHtml(name || item.student_id)}"><i class="bi bi-person-dash"></i></button>
        </div>
      </div>`;
  }

  function groupAndRender(list){
    if(!listEl || !listCount) return;
    if(!list || list.length===0){
      listEl.innerHTML='<div class="text-muted">No candidates found.</div>';
      listCount.textContent='0 candidate(s)';
      return;
    }

    const byOrg = {};
    list.forEach(it=>{
      const org = normalizeOrg(it.organization);
      const pos = normalizePosition(it.position);
      if(!byOrg[org]) byOrg[org] = {};
      if(!byOrg[org][pos]) byOrg[org][pos] = [];
      byOrg[org][pos].push(it);
    });

    let html = '';
    const orgKeys = Object.keys(byOrg).sort((a,b)=>{
      const ka = orgSortKey(a);
      const kb = orgSortKey(b);
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      return ka[1].localeCompare(kb[1]);
    });

    orgKeys.forEach(org=>{
      const totalInOrg = Object.values(byOrg[org]).reduce((a,arr)=> a + arr.length, 0);
      html += `
        <section class="candidate-org-section">
          <div class="candidate-org-header candidate-org-${escapeHtml(org.toLowerCase())}">
            <div class="candidate-org-title">${escapeHtml(org)}</div>
            <span class="badge text-bg-secondary">${totalInOrg}</span>
          </div>`;

      const positions = Object.keys(byOrg[org]).sort((a,b)=>{
        const ka = positionSortKey(org, a);
        const kb = positionSortKey(org, b);
        if (ka[0] !== kb[0]) return ka[0] - kb[0];
        return ka[1].localeCompare(kb[1]);
      });

      positions.forEach(pos=>{
        const candidates = byOrg[org][pos].slice().sort((a,b)=>{
          const pa = String(a.party_name || 'Independent');
          const pb = String(b.party_name || 'Independent');
          if (pa !== pb) return pa.localeCompare(pb);
          const an = [a.last_name, a.first_name, a.middle_name].filter(Boolean).join(' ');
          const bn = [b.last_name, b.first_name, b.middle_name].filter(Boolean).join(' ');
          return an.localeCompare(bn);
        });

        html += `
          <div class="candidate-position-group">
            <div class="candidate-position-header">
              <span>${escapeHtml(pos)}</span>
              <small>${candidates.length} candidate${candidates.length === 1 ? '' : 's'}</small>
            </div>
            <div class="vstack gap-2">`;
        candidates.forEach(item=>{ html += cardTemplate(item); });
        html += `
            </div>
          </div>`;
      });

      html += '</section>';
    });

    listEl.innerHTML = html;
    listCount.textContent = `${list.length} candidate(s)`;
  }

  async function loadList(){
    if(!searchInput) return;
    const q = searchInput.value.trim();
    const url = new URL(API_BASE + 'list/', window.location.origin);
    if (q) url.searchParams.set('q', q);
    const res = await fetch(url.toString(), { credentials: 'same-origin' });
    const data = await res.json();
    const rows = (data && data.ok) ? (data.candidates || []) : [];
    groupAndRender(rows);

    const selectAll = document.getElementById('selectAll');
    if (selectAll) selectAll.checked = false;
    updateBulkState();
  }

  let searchDebounce = null;
  if (searchInput) {
    searchInput.addEventListener('focus', ()=>{ goToSearchPage(); });
    searchInput.addEventListener('click', ()=>{ goToSearchPage(); });
    searchInput.addEventListener('keydown', e=>{
      if(e.key==='Enter'){
        goToSearchPage();
      }
    });
    searchInput.addEventListener('input', ()=>{
      if (redirectedToSearch) return;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(loadList, 300);
    });
  }
  if (searchBtn) searchBtn.addEventListener('click', goToSearchPage);
  loadList();

  async function fetchCandidateDetail(candidate) {
    try {
      const res = await fetch(`${API_BASE}detail/?id=${encodeURIComponent(candidate.id)}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data && data.ok && data.candidate) {
        return { ...candidate, ...data.candidate };
      }
    } catch (_) {}
    return candidate;
  }

  async function exportCandidates() {
    if (!exportCandidatesBtn) return;

    const originalHtml = exportCandidatesBtn.innerHTML;
    exportCandidatesBtn.disabled = true;
    exportCandidatesBtn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Exporting...';

    try {
      const url = new URL(API_BASE + 'list/', window.location.origin);
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      const data = await res.json();
      const baseRows = (data && data.ok) ? (data.candidates || []) : [];

      if (!baseRows.length) {
        alert('No candidates to export.');
        return;
      }

      const rows = await Promise.all(baseRows.map(fetchCandidateDetail));
      rows.sort((a, b) => {
        const orgA = orgSortKey(a.organization);
        const orgB = orgSortKey(b.organization);
        if (orgA[0] !== orgB[0]) return orgA[0] - orgB[0];
        if (orgA[1] !== orgB[1]) return orgA[1].localeCompare(orgB[1]);

        const posA = positionSortKey(a.organization, a.position);
        const posB = positionSortKey(b.organization, b.position);
        if (posA[0] !== posB[0]) return posA[0] - posB[0];
        if (posA[1] !== posB[1]) return posA[1].localeCompare(posB[1]);

        return buildCandidateName(a).localeCompare(buildCandidateName(b));
      });

      const headers = [
        'Candidate ID',
        'Student ID',
        'First Name',
        'Middle Name',
        'Last Name',
        'Full Name',
        'Organization',
        'Position',
        'Party',
        'Candidate Type',
        'Program',
        'Year/Section',
        'Platform',
        'Photo URL',
        'Party Logo URL',
      ];

      const lines = [
        headers.map(csvCell).join(','),
        ...rows.map(candidate => [
          candidate.id,
          candidate.student_id,
          candidate.first_name,
          candidate.middle_name,
          candidate.last_name,
          buildCandidateName(candidate),
          normalizeOrg(candidate.organization),
          normalizePosition(candidate.position),
          candidate.party_name || 'Independent',
          candidate.candidate_type || (candidate.party_name ? 'Political Party' : 'Independent'),
          candidate.program,
          candidate.year_section,
          candidate.platform,
          candidate.photo_url,
          candidate.party_logo_url,
        ].map(csvCell).join(',')),
      ];

      const stamp = new Date().toISOString().slice(0, 10);
      downloadTextFile(`elecom_candidates_${stamp}.csv`, `\uFEFF${lines.join('\r\n')}`, 'text/csv;charset=utf-8;');
    } catch (err) {
      alert('Failed to export candidates.');
    } finally {
      exportCandidatesBtn.disabled = false;
      exportCandidatesBtn.innerHTML = originalHtml;
    }
  }

  if (exportCandidatesBtn) {
    exportCandidatesBtn.addEventListener('click', exportCandidates);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
      reader.readAsText(file);
    });
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  async function rowsFromImportFile(file) {
    const name = String(file?.name || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      if (!window.XLSX) {
        throw new Error('Excel reader is not loaded. Please save the file as CSV and import again.');
      }
      const buffer = await readFileAsArrayBuffer(file);
      const workbook = window.XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) return [];
      return window.XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
    }

    const text = await readFileAsText(file);
    return parseCsv(text);
  }

  function validateCandidatePayload(payload, rowNumber) {
    const missing = [];
    if (!payload.student_id) missing.push('Student ID');
    if (!payload.first_name) missing.push('First Name');
    if (!payload.last_name) missing.push('Last Name');
    if (!payload.organization) missing.push('Organization');
    if (!payload.position) missing.push('Position');
    if (!payload.program) missing.push('Program');
    if (!payload.year_section) missing.push('Year/Section');
    if (!payload.platform) missing.push('Platform');
    return missing.length ? `Row ${rowNumber}: missing ${missing.join(', ')}` : '';
  }

  async function importCandidatePayload(payload) {
    const res = await fetch(API_BASE + 'create/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(cleanPayload(payload)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Failed to import candidate.');
    }
    return data;
  }

  async function handleImportCandidatesFile(file) {
    if (!file || !importCandidatesBtn) return;

    const originalHtml = importCandidatesBtn.innerHTML;
    importCandidatesBtn.disabled = true;
    if (exportCandidatesBtn) exportCandidatesBtn.disabled = true;
    importCandidatesBtn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Importing...';

    try {
      const rows = await rowsFromImportFile(file);
      if (!rows.length) {
        alert('No candidate rows found in the file.');
        return;
      }

      const payloads = rows.map(rowToCandidatePayload);
      const validationErrors = payloads
        .map((payload, index) => validateCandidatePayload(payload, index + 2))
        .filter(Boolean);

      if (validationErrors.length) {
        alert(`Please fix the import file first:\n\n${validationErrors.slice(0, 10).join('\n')}${validationErrors.length > 10 ? '\n...' : ''}`);
        return;
      }

      if (!confirm(`Import ${payloads.length} candidate(s) from this file?`)) return;

      let imported = 0;
      const failed = [];
      for (let i = 0; i < payloads.length; i += 1) {
        const payload = payloads[i];
        try {
          await importCandidatePayload(payload);
          imported += 1;
        } catch (err) {
          const name = buildCandidateName(payload) || payload.student_id || `Row ${i + 2}`;
          failed.push(`${name}: ${err.message || 'Failed'}`);
        }
      }

      loadList();
      alert(`Import finished.\n\nImported: ${imported}\nFailed: ${failed.length}${failed.length ? `\n\n${failed.slice(0, 8).join('\n')}${failed.length > 8 ? '\n...' : ''}` : ''}`);
    } catch (err) {
      alert(err && err.message ? err.message : 'Failed to import candidates.');
    } finally {
      importCandidatesBtn.disabled = false;
      if (exportCandidatesBtn) exportCandidatesBtn.disabled = false;
      importCandidatesBtn.innerHTML = originalHtml;
      if (importCandidatesFile) importCandidatesFile.value = '';
    }
  }

  if (importCandidatesBtn && importCandidatesFile) {
    importCandidatesBtn.addEventListener('click', () => importCandidatesFile.click());
    importCandidatesFile.addEventListener('change', () => {
      const file = importCandidatesFile.files && importCandidatesFile.files[0];
      handleImportCandidatesFile(file);
    });
  }

  function updateBulkState(){
    const checks = Array.from(document.querySelectorAll('.row-check'));
    const any = checks.some(c=>c.checked);
    const bulkBtn = document.getElementById('bulkDeleteBtn');
    if (bulkBtn) bulkBtn.disabled = !any;
  }

  document.addEventListener('change', (e)=>{
    if(e.target && e.target.classList.contains('row-check')){ updateBulkState(); }
  });

  const selectAll = document.getElementById('selectAll');
  if (selectAll) {
    selectAll.addEventListener('change', (e)=>{
      const on = e.target.checked;
      document.querySelectorAll('.row-check').forEach(cb=>{ cb.checked = on; });
      updateBulkState();
    });
  }

  const bulkBtn = document.getElementById('bulkDeleteBtn');
  if (bulkBtn) {
    bulkBtn.addEventListener('click', async ()=>{
      const ids = Array.from(document.querySelectorAll('.row-check:checked')).map(cb=>parseInt(cb.value,10)).filter(Boolean);
      if(ids.length===0) return;
      if(!confirm(`Unregister ${ids.length} selected candidate(s)?`)) return;
      const res = await fetch(API_BASE + 'bulk-delete/', {
        method:'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ids }),
      });
      const d = await res.json();
      if(d && d.ok){ loadList(); }
      else { alert(d && d.error ? d.error : 'Failed to unregister selected'); }
    });
  }

  const viewModalEl = document.getElementById('viewModal');
  const viewModal = viewModalEl ? bootstrap.Modal.getOrCreateInstance(viewModalEl) : null;
  if (viewModalEl) {
    viewModalEl.addEventListener('hidden.bs.modal', ()=>{
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop').forEach(b=>b.remove());
    });
  }

  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-action]');
    if (btn) return;

    if (e.target && (e.target.closest('.form-check') || e.target.closest('input.row-check') || e.target.closest('label'))) {
      return;
    }

    const card = e.target.closest('.candidate-card');
    if(!card) return;
    const id = card.getAttribute('data-id');
    try {
      const res = await fetch(`${API_BASE}detail/?id=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
      const d = await res.json();
      if (d && d.ok && d.candidate) {
        const c = d.candidate;
        const name = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ');
        document.getElementById('vd_name').textContent = name || '';
        document.getElementById('vd_student_id').textContent = c.student_id || '';
        document.getElementById('vd_org').textContent = c.organization || '';
        document.getElementById('vd_position').textContent = c.position || '';
        document.getElementById('vd_program').textContent = c.program || '';
        document.getElementById('vd_year').textContent = c.year_section || '';
        document.getElementById('vd_party').textContent = c.party_name || 'Independent';

        const img = document.getElementById('vd_photo');
        if (c.photo_url && c.photo_url.startsWith('http')) { img.src = c.photo_url; img.style.display = 'block'; }
        else { img.style.display = 'none'; }

        const logo = document.getElementById('vd_party_logo');
        if (c.party_logo_url && c.party_logo_url.startsWith('http')) { logo.src = c.party_logo_url; logo.style.display = 'inline-block'; }
        else { logo.style.display = 'none'; }

        document.getElementById('vd_platform').textContent = c.platform || '';
        if (viewModal) viewModal.show();
      }
    } catch(_) {}
  });

  const editModalEl = document.getElementById('editModal');
  const editModal = editModalEl ? bootstrap.Modal.getOrCreateInstance(editModalEl) : null;
  if (editModalEl) {
    editModalEl.addEventListener('hidden.bs.modal', ()=>{
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop').forEach(b=>b.remove());
    });
  }

  const edForm = document.getElementById('editForm');

  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;

    const id = btn.getAttribute('data-id');

    if(btn.getAttribute('data-action')==='edit'){
      const res = await fetch(`${API_BASE}detail/?id=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
      const d = await res.json();
      if(d && d.ok && d.candidate){
        const c = d.candidate;
        document.getElementById('ed_id').value = c.id;
        document.getElementById('ed_first_name').value = c.first_name || '';
        document.getElementById('ed_middle_name').value = c.middle_name || '';
        document.getElementById('ed_last_name').value = c.last_name || '';
        document.getElementById('ed_org').value = c.organization || '';
        document.getElementById('ed_position').value = c.position || '';
        document.getElementById('ed_program').value = c.program || '';
        document.getElementById('ed_year').value = c.year_section || '';
        document.getElementById('ed_platform').value = c.platform || '';
        document.getElementById('ed_photo_url').value = c.photo_url || '';
        document.getElementById('ed_party_logo_url').value = c.party_logo_url || '';
        if (editModal) editModal.show();
      }
    }

    if(btn.getAttribute('data-action')==='delete'){
      document.getElementById('delName').textContent = btn.getAttribute('data-name') || '';
      document.getElementById('confirmDeleteBtn').setAttribute('data-id', id);
      new bootstrap.Modal(document.getElementById('deleteModal')).show();
    }
  });

  const saveEditBtn = document.getElementById('saveEditBtn');
  if (saveEditBtn) {
    saveEditBtn.addEventListener('click', async function(){
      if (!edForm) return;
      const payload = {
        id: document.getElementById('ed_id').value,
        first_name: document.getElementById('ed_first_name').value,
        middle_name: document.getElementById('ed_middle_name').value,
        last_name: document.getElementById('ed_last_name').value,
        organization: document.getElementById('ed_org').value,
        position: document.getElementById('ed_position').value,
        program: document.getElementById('ed_program').value,
        year_section: document.getElementById('ed_year').value,
        platform: document.getElementById('ed_platform').value,
        photo_url: document.getElementById('ed_photo_url').value,
        party_logo_url: document.getElementById('ed_party_logo_url').value,
      };

      const res = await fetch(API_BASE + 'update/', {
        method:'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      const d = await res.json();
      if(d && d.ok){ if (editModal) editModal.hide(); loadList(); }
      else { alert(d && d.error ? d.error : 'Failed to save changes'); }
    });
  }

  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async function(){
      const id = this.getAttribute('data-id');
      const res = await fetch(API_BASE + 'delete/', {
        method:'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id }),
      });
      const d = await res.json();
      if(d && d.ok){ bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide(); loadList(); }
      else { alert(d && d.error ? d.error : 'Failed to unregister'); }
    });
  }
});

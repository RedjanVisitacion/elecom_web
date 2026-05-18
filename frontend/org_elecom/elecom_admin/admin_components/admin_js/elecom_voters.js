document.addEventListener('DOMContentLoaded', function(){
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const closeSidebar = document.getElementById('closeSidebar');
  const tableBody = document.getElementById('votersTableBody');
  const votersCount = document.getElementById('votersCount');
  const voterSearch = document.getElementById('voterSearch');
  const voterSearchBtn = document.getElementById('voterSearchBtn');
  const exportVotersBtn = document.getElementById('exportVotersBtn');
  const importVotersBtn = document.getElementById('importVotersBtn');
  const importVotersFile = document.getElementById('importVotersFile');
  const yearFilter = document.getElementById('yearFilter');
  const sectionFilter = document.getElementById('sectionFilter');
  const courseFilterButtons = Array.from(document.querySelectorAll('[data-course-filter]'));

  const API_BASE = '/api/admin/voters/';
  const IMPORT_BATCH_SIZE = 250;
  let currentRows = [];
  let filteredRows = [];
  let activeCourse = 'ALL';

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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fullName(voter) {
    return [voter.first_name, voter.middle_name, voter.last_name].filter(Boolean).join(' ');
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
    return String(value || '').trim().toLowerCase().replace(/[\s_/-]+/g, '');
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

  function rowToVoterPayload(row) {
    return {
      id_number: getImportValue(row, ['ID Number', 'Student ID', 'student_id', 'id_number', 'idnumber']),
      first_name: getImportValue(row, ['First Name', 'first_name', 'firstname']),
      middle_name: getImportValue(row, ['Middle Name', 'middle_name', 'middlename']),
      last_name: getImportValue(row, ['Last Name', 'last_name', 'lastname']),
      course: getImportValue(row, ['Course', 'Department', 'Program']),
      year: getImportValue(row, ['Year', 'Year Level', 'year_level', 'yearlevel']),
      section: getImportValue(row, ['Section']),
      email: getImportValue(row, ['Email']),
      phone_number: getImportValue(row, ['Phone Number', 'Phone', 'phone_number', 'phonenumber']),
      role: getImportValue(row, ['Role']) || 'student',
      position: getImportValue(row, ['Position']),
      photo_url: getImportValue(row, ['Photo URL', 'Photo Url', 'photo_url', 'photourl']),
    };
  }

  function validateVoterPayload(payload, rowNumber) {
    const missing = [];
    if (!payload.id_number) missing.push('ID Number');
    if (!payload.first_name) missing.push('First Name');
    if (!payload.last_name) missing.push('Last Name');
    if (!payload.course) missing.push('Course');
    if (!payload.year) missing.push('Year');
    if (!payload.section) missing.push('Section');
    if (!payload.email) missing.push('Email');
    if (!payload.phone_number) missing.push('Phone Number');
    return missing.length ? `Row ${rowNumber}: missing ${missing.join(', ')}` : '';
  }

  function formatImportFailures(failed, limit = 10) {
    const list = Array.isArray(failed) ? failed : [];
    if (!list.length) return '';
    return list.slice(0, limit)
      .map(f => `Row ${f.row || '?'}${f.id_number ? ` (${f.id_number})` : ''}: ${f.error || 'Failed to import row.'}`)
      .join('\n') + (list.length > limit ? '\n...' : '');
  }

  async function postVoterImportBatch(voters, rowStart) {
    const res = await fetch(API_BASE + 'import/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ voters, row_start: rowStart }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const detail = formatImportFailures(data.failed, 8);
      throw new Error(`${data.error || 'Failed to import voters.'}${detail ? `\n\n${detail}` : ''}`);
    }
    return data;
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.map(v => String(v ?? '').trim()).filter(Boolean)))
      .sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return a.localeCompare(b);
      });
  }

  function fillSelectOptions(select, values, placeholder) {
    if (!select) return;
    const previous = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    values.forEach(value => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    });
    if (values.includes(previous)) select.value = previous;
  }

  function refreshFilterOptions() {
    fillSelectOptions(yearFilter, uniqueSorted(currentRows.map(row => row.year)), 'All years');
    fillSelectOptions(sectionFilter, uniqueSorted(currentRows.map(row => row.section)), 'All sections');
  }

  function applyVoterFilters() {
    const selectedYear = yearFilter ? String(yearFilter.value || '') : '';
    const selectedSection = sectionFilter ? String(sectionFilter.value || '') : '';

    filteredRows = currentRows.filter(row => {
      const course = String(row.course || '').trim().toUpperCase();
      const year = String(row.year ?? '').trim();
      const section = String(row.section || '').trim();

      if (activeCourse !== 'ALL' && course !== activeCourse) return false;
      if (selectedYear && year !== selectedYear) return false;
      if (selectedSection && section !== selectedSection) return false;
      return true;
    });

    renderVoters(filteredRows);
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

  function renderVoters(rows) {
    if (!tableBody || !votersCount) return;
    const list = Array.isArray(rows) ? rows : [];
    votersCount.textContent = `${list.length} voter(s)`;

    if (!list.length) {
      tableBody.innerHTML = '<tr><td colspan="8" class="text-muted text-center py-4">No voters found.</td></tr>';
      return;
    }

    tableBody.innerHTML = list.map(voter => {
      const name = fullName(voter) || voter.id_number;
      const accepted = voter.terms_accepted_at ? 'Accepted terms' : 'Not opened';
      return `
        <tr>
          <td class="fw-semibold">${escapeHtml(voter.id_number)}</td>
          <td>
            <div class="voter-name">${escapeHtml(name)}</div>
            <div class="voter-meta">${escapeHtml(voter.role || 'student')}</div>
          </td>
          <td>${escapeHtml(voter.course)}</td>
          <td>${escapeHtml(voter.year)}</td>
          <td>${escapeHtml(voter.section)}</td>
          <td>${escapeHtml(voter.email)}</td>
          <td>${escapeHtml(voter.phone_number)}</td>
          <td><span class="voter-status"><i class="bi bi-person-check"></i>${escapeHtml(accepted)}</span></td>
        </tr>`;
    }).join('');
  }

  async function loadVoters() {
    const q = voterSearch ? voterSearch.value.trim() : '';
    const url = new URL(API_BASE + 'list/', window.location.origin);
    if (q) url.searchParams.set('q', q);
    const res = await fetch(url.toString(), { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));

    if (res.status === 403) {
      alert(data.error || 'Admin password is required to open voters management.');
      const dashboardUrl = '/static/org_elecom/elecom_admin/admin_dashboard.html';
      window.location.href = window.ElecomAdminSecureUrl ? window.ElecomAdminSecureUrl(dashboardUrl) : dashboardUrl;
      return;
    }

    currentRows = data && data.ok ? (data.voters || []) : [];
    refreshFilterOptions();
    applyVoterFilters();
  }

  function exportVoters() {
    const rowsToExport = filteredRows.length || currentRows.length ? filteredRows : [];
    if (!rowsToExport.length) {
      alert('No voters to export.');
      return;
    }

    const headers = [
      'ID Number',
      'First Name',
      'Middle Name',
      'Last Name',
      'Course',
      'Year',
      'Section',
      'Email',
      'Phone Number',
      'Role',
      'Position',
      'Photo URL',
    ];

    const lines = [
      headers.map(csvCell).join(','),
      ...rowsToExport.map(voter => [
        voter.id_number,
        voter.first_name,
        voter.middle_name,
        voter.last_name,
        voter.course,
        voter.year,
        voter.section,
        voter.email,
        voter.phone_number,
        voter.role || 'student',
        voter.position,
        voter.photo_url,
      ].map(csvCell).join(',')),
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`elecom_voters_${stamp}.csv`, `\uFEFF${lines.join('\r\n')}`, 'text/csv;charset=utf-8;');
  }

  async function importVoters(file) {
    if (!file || !importVotersBtn) return;
    const originalHtml = importVotersBtn.innerHTML;
    importVotersBtn.disabled = true;
    if (exportVotersBtn) exportVotersBtn.disabled = true;
    importVotersBtn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Importing...';

    try {
      const rows = await rowsFromImportFile(file);
      if (!rows.length) {
        alert('No voter rows found in the file.');
        return;
      }

      const voters = rows.map(rowToVoterPayload);
      const errors = voters
        .map((payload, index) => validateVoterPayload(payload, index + 2))
        .filter(Boolean);
      if (errors.length) {
        alert(`Please fix the import file first:\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? '\n...' : ''}`);
        return;
      }

      if (!confirm(`Import ${voters.length} voter(s)? Password will be set to each voter's ID number.`)) return;

      let imported = 0;
      const failed = [];
      for (let start = 0; start < voters.length; start += IMPORT_BATCH_SIZE) {
        const batch = voters.slice(start, start + IMPORT_BATCH_SIZE);
        importVotersBtn.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Importing ${Math.min(start + batch.length, voters.length)}/${voters.length}...`;
        const data = await postVoterImportBatch(batch, start + 2);
        imported += Number(data.imported || 0);
        failed.push(...(data.failed || []));
      }

      await loadVoters();
      const failedText = failed.length
        ? `\n\nFailed: ${failed.length}\n${formatImportFailures(failed, 8)}`
        : '';
      alert(`Import finished.\n\nImported: ${imported}${failedText}`);
    } catch (err) {
      alert(err && err.message ? err.message : 'Failed to import voters.');
    } finally {
      importVotersBtn.disabled = false;
      if (exportVotersBtn) exportVotersBtn.disabled = false;
      importVotersBtn.innerHTML = originalHtml;
      if (importVotersFile) importVotersFile.value = '';
    }
  }

  let searchDebounce = null;
  if (voterSearch) {
    voterSearch.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(loadVoters, 250);
    });
    voterSearch.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') loadVoters();
    });
  }
  if (voterSearchBtn) voterSearchBtn.addEventListener('click', loadVoters);
  if (exportVotersBtn) exportVotersBtn.addEventListener('click', exportVoters);
  if (yearFilter) yearFilter.addEventListener('change', applyVoterFilters);
  if (sectionFilter) sectionFilter.addEventListener('change', applyVoterFilters);
  courseFilterButtons.forEach(button => {
    button.addEventListener('click', () => {
      activeCourse = String(button.getAttribute('data-course-filter') || 'ALL').toUpperCase();
      courseFilterButtons.forEach(btn => {
        const isActive = btn === button;
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('btn-dark', isActive);
        btn.classList.toggle('btn-outline-dark', !isActive);
      });
      applyVoterFilters();
    });
  });
  if (importVotersBtn && importVotersFile) {
    importVotersBtn.addEventListener('click', () => importVotersFile.click());
    importVotersFile.addEventListener('change', () => {
      const file = importVotersFile.files && importVotersFile.files[0];
      importVoters(file);
    });
  }

  loadVoters();
});

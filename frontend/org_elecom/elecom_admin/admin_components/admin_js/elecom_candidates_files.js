(() => {
  'use strict';
  const orgs = ['USG', 'PAFE', 'SITE', 'AFPROTECHS'];
  const documents = [['Certificate of Candidacy', 'certificate_available', 'bi-file-earmark-pdf'], ['Certificate of Enrollment', 'enrollment_certificate_url', 'bi-file-earmark-text'], ['Grade Card', 'grades_url', 'bi-file-earmark-text'], ['Good Moral Certificate', 'good_moral_url', 'bi-file-earmark-text']];
  const grid = document.getElementById('filesGrid');
  const search = document.getElementById('filesSearch');
  const status = document.getElementById('filesStatus');
  const election = document.getElementById('filesElection');
  const scope = document.getElementById('filesScope');
  let rows = [], org = '', candidate = null, generation = 0, loading = false, csrfToken = '', saving = false;
  const name = row => [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ') || String(row.student_id);
  const group = row => {
    const label = String(row.organization || 'Other').trim().toUpperCase();
    return label === 'AFPRO' ? 'AFPROTECHS' : label;
  };
  const view = { value: 'grid' };
  const viewButtons = [...document.querySelectorAll('[data-files-view]')];
  const sort = document.getElementById('filesSort');
  const direction = { value: 'asc' };
  const directionButton = document.getElementById('filesDirection');
  const timestamp = value => Date.parse(value || '') || 0;
  const compare = (a, b) => {
    if (sort.value === 'date' && (!a.date || !b.date) && a.date !== b.date) return a.date ? -1 : 1;
    const value = sort.value === 'date' ? (a.date || 0) - (b.date || 0) : sort.value === 'details' ? a.detail.localeCompare(b.detail, undefined, { numeric: true }) : a.label.localeCompare(b.label, undefined, { numeric: true });
    return (value || a.label.localeCompare(b.label)) * (direction.value === 'desc' ? -1 : 1);
  };
  const url = value => {
    try { const parsed = new URL(value); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : ''; } catch (_) { return ''; }
  };
  function tile(label, detail, icon, action, href, missing = false, metadata = null, kind = null) {
    const el = document.createElement(href && !kind ? 'a' : action ? 'button' : 'div');
    el.className = `file-tile${href || missing ? ' document' : ''}${missing ? ' missing' : ''}`;
    if (action) { el.type = 'button'; el.addEventListener('click', action); }
    if (href && !kind) { el.href = href; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
    const graphic = document.createElement('i'); graphic.className = `bi ${icon}`; graphic.setAttribute('aria-hidden', 'true');
    const title = document.createElement('strong'); title.textContent = label;
    const meta = document.createElement('small'); meta.textContent = detail;
    if (metadata) {
      meta.className = 'file-metadata';
      meta.replaceChildren();
      for (const [label, value] of metadata) {
        const cell = document.createElement('span');
        cell.className = 'file-meta-cell';
        const caption = document.createElement('span'); caption.className = 'file-meta-label'; caption.textContent = label;
        const content = document.createElement('span'); content.textContent = value;
        cell.append(caption, content); meta.append(cell);
      }
    }
    el.append(graphic, title, meta);
    if (kind) {
      const actions = document.createElement('div'); actions.className = 'file-document-actions';
      if (href) {
        const open = document.createElement('button'); open.type = 'button';
        open.addEventListener('click', () => openPreview(kind, label));
        open.className = 'files-control'; open.textContent = 'Open'; open.setAttribute('aria-label', `Open ${label}`); actions.append(open);
      }
      if (kind === 'certificate') { el.append(actions); grid.append(el); return; }
      const upload = document.createElement('button'); upload.type = 'button'; upload.className = 'files-control';
      upload.textContent = href ? 'Replace' : 'Upload'; upload.disabled = saving;
      upload.setAttribute('aria-label', `${upload.textContent} ${label}`);
      upload.addEventListener('click', () => openDocumentDialog(kind, label, false, Boolean(href))); actions.append(upload);
      if (href) {
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'files-control file-delete';
        remove.textContent = 'Delete'; remove.disabled = saving; remove.setAttribute('aria-label', `Delete ${label}`);
        remove.addEventListener('click', () => openDocumentDialog(kind, label, true, true)); actions.append(remove);
      }
      el.append(actions);
    }
    grid.append(el);
  }
  function navigate(nextOrg = '', nextCandidate = null) { org = nextOrg; candidate = nextCandidate; search.value = ''; render(); }
  function render() {
    grid.replaceChildren();
    viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filesView === view.value)));
    const ascending = direction.value === 'asc';
    directionButton.firstElementChild.className = ascending ? 'bi bi-sort-alpha-down' : 'bi bi-sort-alpha-up';
    directionButton.title = ascending ? 'Ascending order; click for descending' : 'Descending order; click for ascending';
    directionButton.setAttribute('aria-label', directionButton.title);
    grid.classList.toggle('files-list', view.value === 'list');
    document.getElementById('filesBack').disabled = !org || loading;
    const crumbs = document.getElementById('filesBreadcrumb'); crumbs.replaceChildren();
    const crumb = (label, action) => { const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = label; btn.addEventListener('click', action); crumbs.append(btn); };
    crumb('Candidate Files', () => navigate());
    if (org) { crumbs.append(' / '); crumb(org, () => navigate(org)); }
    if (candidate) { crumbs.append(' / '); const span = document.createElement('span'); span.textContent = name(candidate); crumbs.append(span); }
    if (loading) { status.textContent = 'Loading candidate files…'; return; }
    const query = search.value.trim().toLowerCase();
    search.placeholder = candidate ? 'Search documents...' : org ? 'Search candidates in this organization...' : 'Search candidates or organizations...';
    search.setAttribute('aria-label', search.placeholder.replace('...', ''));
    const items = [];
    if (candidate) {
      for (const [label, key, icon] of documents) {
        if (!label.toLowerCase().includes(query)) continue;
        const isCertificate = key === 'certificate_available';
        const href = isCertificate
          ? (candidate.source === 'application' && candidate[key] === true ? `/api/admin/candidate-applications/${encodeURIComponent(candidate.id)}/certificate/` : '')
          : (candidate[key] ? url(candidate[key]) : '');
        items.push({ label, detail: href ? 'Open file ↗' : 'Not submitted', icon, href, missing: !href, kind: isCertificate ? 'certificate' : key.replace(/_url$/, '') });
      }
    } else if (org || query) {
      rows.filter(row => (!org || group(row) === org) && `${name(row)} ${row.student_id} ${row.position} ${group(row)}`.toLowerCase().includes(query))
        .sort((a, b) => name(a).localeCompare(name(b))).forEach(row => {
          const count = documents.filter(([, key]) => row[key] && url(row[key])).length;
          items.push({ label: name(row), detail: `${row.student_id} · ${row.position} · ${count}/4 files · ${row.status}`, date: timestamp(row.created_at), metadata: [['ID', String(row.student_id)], ['Role', row.position || '?'], ['Files', `${count}/4 submitted`], ['Status', String(row.status || '').replaceAll('_', ' ')]], icon: 'bi-folder-fill', action: () => navigate(group(row), row) });
        });
    } else {
      [...new Set([...orgs, ...rows.map(group)])].filter(label => label.toLowerCase().includes(query)).forEach(label => {
        const members = rows.filter(row => group(row) === label);
        const count = members.length;
        const date = Math.max(0, ...members.map(row => timestamp(row.created_at)));
        items.push({ label: `${label} Candidates`, detail: `${count} candidate folder${count === 1 ? '' : 's'}`, date, icon: 'bi-folder-fill', action: () => navigate(label) });
      });
    }
    items.sort(compare).forEach(item => tile(item.label, item.detail, item.icon, item.action, item.href, item.missing, item.metadata, item.kind));
    status.textContent = grid.children.length ? `${grid.children.length} item${grid.children.length === 1 ? '' : 's'}` : query ? 'No matching items in this folder.' : 'No candidates in this organization for the selected election.';
  }
  let filesRequest = null;
  const candidateMatches = (row, selected) =>
    (row.id === selected.id && row.source === selected.source)
    || (String(row.student_id) === String(selected.student_id) && group(row) === group(selected) && row.position === selected.position);
  async function load(silent = false) {
    if (silent && (filesRequest || loading || saving || document.hidden
        || document.querySelector('.modal.show'))) return;
    if (filesRequest) filesRequest.abort();
    const controller = new AbortController(); filesRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    const previous = candidate;
    const id = ++generation;
    if (!silent) { loading = true; render(); }
    try {
      const params = new URLSearchParams(); if (election.value) params.set('election_id', election.value);
      params.set('view', scope.value);
      const res = await fetch(`/api/admin/candidates/files/?${params}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Unable to load candidate files.');
      if (id !== generation) return;
      const nextRows = data.candidates || [];
      const changed = JSON.stringify(rows) !== JSON.stringify(nextRows);
      csrfToken = data.csrf_token || csrfToken;
      // Navigation can change during a background request; use the current folder.
      const selected = silent ? candidate : previous;
      rows = nextRows;
      candidate = selected ? rows.find(row => candidateMatches(row, selected)) || null : null;
      loading = false;
      if (!silent || changed) render();
    } catch (error) {
      if (id !== generation) return;
      loading = false;
      // Retain the last successful contents and retry on the next poll.
      if (!silent) { render(); status.textContent = `${error.name === 'AbortError' ? 'The request timed out.' : error.message} Use Refresh to try again.`; }
    } finally {
      clearTimeout(timeout);
      if (filesRequest === controller) filesRequest = null;
    }
  }
  let pollTimer = null;
  function startPolling() {
    if (pollTimer || document.hidden) return;
    pollTimer = setInterval(() => load(true), 3000);
  }
  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPolling();
    else { load(true); startPolling(); }
  });
  window.addEventListener('pagehide', () => { stopPolling(); if (filesRequest) filesRequest.abort(); });
  window.addEventListener('pageshow', () => { startPolling(); });
  const previewElement = document.getElementById('candidatePreviewModal');
  const previewModal = new bootstrap.Modal(previewElement);
  const previewBody = document.getElementById('candidatePreviewBody');
  let previewUrl = '', previewRequest = null;
  function clearPreview() {
    if (previewRequest) previewRequest.abort();
    previewRequest = null; previewBody.replaceChildren();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  }
  previewElement.addEventListener('hidden.bs.modal', clearPreview);
  async function openPreview(kind, label) {
    if (!candidate) return;
    clearPreview();
    const controller = new AbortController(); previewRequest = controller;
    document.getElementById('candidatePreviewTitle').textContent = `${label} ? ${name(candidate)}`;
    const message = document.createElement('p'); message.className = 'preview-message'; message.setAttribute('role', 'status'); message.textContent = 'Loading file?';
    previewBody.append(message); previewModal.show();
    const params = new URLSearchParams({ id: candidate.id, source: candidate.source, election_id: candidate.election_id || '', kind });
    try {
      const previewEndpoint = kind === 'certificate'
        ? `/api/admin/candidate-applications/${encodeURIComponent(candidate.id)}/certificate/`
        : `/api/admin/candidates/document/preview/?${params}`;
      const response = await fetch(previewEndpoint, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      const type = response.headers.get('content-type') || '';
      if (!response.ok) {
        const data = type.includes('application/json') ? await response.json() : null;
        throw new Error(data?.error || 'Unable to load this file. Refresh the page and try again.');
      }
      if (!['application/pdf', 'image/jpeg', 'image/png'].some(allowed => type.startsWith(allowed))) throw new Error('This file type cannot be previewed.');
      const blob = await response.blob();
      if (controller.signal.aborted || previewRequest !== controller) return;
      previewUrl = URL.createObjectURL(blob);
      const viewer = document.createElement(type.startsWith('image/') ? 'img' : 'iframe');
      viewer.className = type.startsWith('image/') ? 'candidate-preview-photo' : 'candidate-preview-pdf';
      if (type.startsWith('image/')) viewer.alt = label;
      else viewer.title = label;
      viewer.src = previewUrl;
      viewer.addEventListener('error', () => { message.textContent = 'Unable to display this file in your browser.'; previewBody.replaceChildren(message); });
      previewBody.replaceChildren(viewer);
    } catch (error) {
      if (error.name === 'AbortError' || previewRequest !== controller) return;
      message.textContent = error.message; message.classList.add('text-danger'); previewBody.replaceChildren(message);
    }
  }
  const dialogElement = document.getElementById('candidateDocumentModal');
  const dialog = new bootstrap.Modal(dialogElement);
  const fileInput = document.getElementById('documentUpload');
  const dialogError = document.getElementById('documentError');
  const confirm = document.getElementById('documentConfirm');
  let pending = null;
  function openDocumentDialog(kind, label, deleting, replacing) {
    if (saving || !candidate) return;
    pending = { kind, deleting, target: { ...candidate } };
    document.getElementById('documentTitle').textContent = `${deleting ? 'Delete' : replacing ? 'Replace' : 'Upload'} ${label}`;
    document.getElementById('documentMessage').textContent = deleting
      ? `Remove ${label} from ${name(candidate)}'s folder?`
      : `Choose ${kind === 'requirements_photo' ? 'a JPG or PNG photo' : 'a PDF document'} for ${name(candidate)}. Maximum file size: 8 MB.`;
    document.getElementById('documentUploadGroup').hidden = deleting;
    fileInput.value = ''; fileInput.accept = kind === 'requirements_photo' ? '.jpg,.jpeg,.png' : '.pdf';
    dialogError.textContent = ''; confirm.disabled = false;
    confirm.textContent = deleting ? 'Delete file' : replacing ? 'Replace file' : 'Upload file';
    confirm.className = deleting ? 'btn btn-danger' : 'btn btn-primary'; dialog.show();
  }
  dialogElement.addEventListener('hide.bs.modal', event => { if (saving) event.preventDefault(); });
  confirm.addEventListener('click', async () => {
    if (!pending || saving) return;
    const operation = pending;
    const file = fileInput.files[0];
    if (!operation.deleting && (!file || file.size <= 0 || file.size > 8 * 1024 * 1024)) {
      dialogError.textContent = 'Select a non-empty file of at most 8 MB.'; return;
    }
    if (!operation.deleting && !(operation.kind === 'requirements_photo' ? /\.(jpe?g|png)$/i : /\.pdf$/i).test(file.name)) {
      dialogError.textContent = operation.kind === 'requirements_photo' ? 'Select a JPG or PNG photo.' : 'Select a PDF document.'; return;
    }
    const form = new FormData();
    form.set('id', operation.target.id); form.set('source', operation.target.source);
    form.set('election_id', operation.target.election_id || ''); form.set('kind', operation.kind);
    form.set('action', operation.deleting ? 'delete' : 'upload');
    if (!operation.deleting) form.set(operation.kind, file);
    saving = true; confirm.disabled = true; confirm.textContent = operation.deleting ? 'Deleting?' : 'Uploading?';
    try {
      const response = await fetch('/api/admin/candidates/document/', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRFToken': csrfToken }, body: form });
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : null;
      if (!response.ok || !data?.ok) throw new Error(data?.error || (response.status === 413 ? 'The server rejected the upload size.' : 'Unable to update the document. Refresh the page and try again.'));
      saving = false; dialog.hide(); await load();
    } catch (error) {
      saving = false; dialogError.textContent = error.message; confirm.disabled = false;
      confirm.textContent = operation.deleting ? 'Delete file' : 'Upload file';
    }
  });
  search.addEventListener('input', render);
  function saveAndRender() {
    try { localStorage.setItem('elecom_candidate_files_view', JSON.stringify({ view: view.value, sort: sort.value, direction: direction.value })); } catch (_) { /* Storage may be unavailable. */ }
    render();
  }
  sort.addEventListener('change', saveAndRender);
  directionButton.addEventListener('click', () => { direction.value = direction.value === 'asc' ? 'desc' : 'asc'; saveAndRender(); });
  viewButtons.forEach(button => button.addEventListener('click', () => { view.value = button.dataset.filesView; saveAndRender(); }));
  try {
    const saved = JSON.parse(localStorage.getItem('elecom_candidate_files_view') || '{}');
    if (['grid', 'list'].includes(saved.view)) view.value = saved.view;
    if (['asc', 'desc'].includes(saved.direction)) direction.value = saved.direction;
    if ([...sort.options].some(option => option.value === saved.sort)) sort.value = saved.sort;
  } catch (_) { /* Use default browser view. */ }
  election.addEventListener('change', () => { org = ''; candidate = null; load(); });
  scope.addEventListener('change', () => { org = ''; candidate = null; load(); });
  document.getElementById('filesBack').addEventListener('click', () => navigate(candidate ? org : ''));
  document.getElementById('filesRefresh').addEventListener('click', () => load());
  async function init() {
    try {
      const res = await fetch('/api/admin/elections/', { credentials: 'same-origin' }); const data = await res.json();
      if (res.ok && data.ok) for (const item of data.elections || []) { const option = document.createElement('option'); option.value = item.id; option.textContent = `${item.name || item.election_name || 'Election'} (${item.school_year || item.id})`; election.append(option); }
      const selected = new URLSearchParams(location.search).get('election_id');
      if (selected && [...election.options].some(option => option.value === selected)) election.value = selected;
    } catch (_) { /* Current election remains available. */ }
    await load();
    startPolling();
  }
  init();
})();

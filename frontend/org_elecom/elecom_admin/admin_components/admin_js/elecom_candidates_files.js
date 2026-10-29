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
    if (href && !kind) { el.href = href; }
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
    el.append(graphic, title);
    if (detail || metadata) el.append(meta);
    if (kind) {
      const actions = document.createElement('div'); actions.className = 'file-document-actions';
      if (href) {
        const open = document.createElement('button'); open.type = 'button';
        open.addEventListener('click', () => openDocument(kind, label));
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
        items.push({ label, detail: href ? '' : 'Not submitted', icon, href, missing: !href, kind: isCertificate ? 'certificate' : key.replace(/_url$/, '') });
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
  function notify(message, error = false) {
    if (window.ElecomToast) return window.ElecomToast.show(message, { id: "files", type: error ? "error" : "success", title: 'Candidate Files', duration: error ? 0 : 6000 });
    const element = document.getElementById('filesToast');
    document.getElementById('filesToastTitle').textContent = error ? 'Please check Candidate Files' : 'Candidate Files updated';
    document.getElementById('filesToastBody').textContent = message;
    document.getElementById('filesToastIcon').className = `bi ${error ? 'bi-exclamation-circle-fill text-danger' : 'bi-check-circle-fill text-success'} me-2`;
    element.setAttribute('role', error ? 'alert' : 'status');
    element.setAttribute('aria-live', error ? 'assertive' : 'polite');
    bootstrap.Toast.getInstance(element)?.dispose();
    new bootstrap.Toast(element, { autohide: !error, delay: 6000 }).show();
  }
  let filesRequest = null;
  const candidateMatches = (row, selected) =>
    (row.id === selected.id && row.source === selected.source)
    || (String(row.student_id) === String(selected.student_id) && group(row) === group(selected) && row.position === selected.position);
  async function load(silent = false, announceRefresh = false) {
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
      if (silent && changed) notify('Candidate folders and submitted files have been updated.');
      else if (announceRefresh) notify('Candidate files refreshed.');
    } catch (error) {
      if (id !== generation) return;
      loading = false;
      // Retain the last successful contents and retry on the next poll.
      if (!silent) { render(); notify(`${error.name === 'AbortError' ? 'The request timed out.' : error.message} Use Refresh to try again.`, true); }
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
  const previewFrame = document.getElementById('candidatePreviewFrame');
  const previewStatus = document.getElementById('candidatePreviewStatus');
  const previewRetry = document.getElementById('candidatePreviewRetry');
  const previewZoomOut = document.getElementById('candidatePreviewZoomOut');
  const previewZoomIn = document.getElementById('candidatePreviewZoomIn');
  const previewZoomLabel = document.getElementById('candidatePreviewZoomLabel');
  const previewDownload = document.getElementById('candidatePreviewDownload');
  let previewZoom = 1, previewReady = false, previewFileName = '';
  function updatePreviewZoom() {
    previewZoomLabel.textContent = `${Math.round(previewZoom * 100)}%`;
    previewZoomOut.disabled = !previewReady || previewZoom <= 0.5;
    previewZoomIn.disabled = !previewReady || previewZoom >= 3;
    for (const page of previewFrame.children) page.style.width = `${previewZoom * 100}%`;
  }
  function changePreviewZoom(delta) {
    if (!previewReady) return;
    const previous = previewZoom;
    previewZoom = Math.max(0.5, Math.min(3, Math.round((previewZoom + delta) * 100) / 100));
    const ratio = previewZoom / previous;
    const top = (previewFrame.scrollTop + previewFrame.clientHeight / 2) * ratio - previewFrame.clientHeight / 2;
    const left = (previewFrame.scrollLeft + previewFrame.clientWidth / 2) * ratio - previewFrame.clientWidth / 2;
    updatePreviewZoom();
    previewFrame.scrollTop = top;
    previewFrame.scrollLeft = left;
  }
  previewZoomOut.addEventListener('click', () => changePreviewZoom(-0.25));
  previewZoomIn.addEventListener('click', () => changePreviewZoom(0.25));
  previewDownload.addEventListener('click', () => {
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = previewDownload.dataset.fileName;
    document.body.append(link);
    link.click();
    link.remove();
  });
  let previewRequest = null, previewUrl = '', previewEndpoint = '', previewOpener = null;
  let previewPdfTask = null, previewRenderTask = null, previewLibraryPromise;
  function previewLibrary() {
    if (!previewLibraryPromise) {
      previewLibraryPromise = import('/static/org_elecom/elecom_admin/admin_components/vendor/pdfjs-4.10.38/pdf.min.js').then(lib => {
        lib.GlobalWorkerOptions.workerSrc = '/static/org_elecom/elecom_admin/admin_components/vendor/pdfjs-4.10.38/pdf.worker.min.js';
        return lib;
      }).catch(error => { previewLibraryPromise = null; throw error; });
    }
    return previewLibraryPromise;
  }
  function clearPreview() {
    if (previewRequest) previewRequest.abort();
    previewRequest = null;
    previewReady = false;
    previewZoom = 1;
    updatePreviewZoom();
    previewDownload.disabled = true;
    delete previewDownload.dataset.fileName;
    previewFrame.hidden = true;
    previewFrame.replaceChildren();
    if (previewRenderTask) previewRenderTask.cancel();
    previewRenderTask = null;
    if (previewPdfTask) previewPdfTask.destroy().catch(() => {});
    previewPdfTask = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  }
  previewElement.addEventListener('hide.bs.modal', clearPreview);
  previewElement.addEventListener('hidden.bs.modal', () => {
    previewEndpoint = '';
    if (previewOpener?.isConnected) previewOpener.focus();
  });
  async function loadPreview() {
    clearPreview();
    previewStatus.hidden = false;
    previewStatus.textContent = 'Loading document…';
    previewRetry.hidden = true;
    const controller = new AbortController();
    previewRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(previewEndpoint, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('The document could not be loaded. Please try again.');
      const blob = await response.blob();
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(blob.type.split(';')[0])) {
        throw new Error('This file cannot be previewed. Please check the uploaded document.');
      }
      if (previewRequest !== controller) return;
      clearTimeout(timeout);
      previewUrl = URL.createObjectURL(blob);
      const extension = blob.type.startsWith('image/png') ? 'png' : blob.type.startsWith('image/jpeg') ? 'jpg' : 'pdf';
      previewDownload.dataset.fileName = `${previewFileName}.${extension}`;
      previewDownload.disabled = false;
      if (blob.type.split(';')[0] === 'application/pdf') {
        const lib = await previewLibrary();
        const bytes = await blob.arrayBuffer();
        if (previewRequest !== controller) return;
        const task = lib.getDocument({ data: bytes, isEvalSupported: false });
        previewPdfTask = task;
        const pdf = await task.promise;
        if (previewRequest !== controller) return;
        previewFrame.hidden = false;
        previewFrame.scrollTop = 0;
        for (let number = 1; number <= pdf.numPages; number++) {
          const page = await pdf.getPage(number);
          if (previewRequest !== controller) return;
          const base = page.getViewport({ scale: 1 });
          const width = Math.max(240, previewFrame.clientWidth);
          const scale = Math.min(width / base.width * Math.min(window.devicePixelRatio || 1, 1.5), Math.sqrt(2000000 / (base.width * base.height)));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `${previewFrame.title}, page ${number} of ${pdf.numPages}`);
          const render = page.render({ canvasContext: canvas.getContext('2d'), viewport });
          previewRenderTask = render;
          await render.promise;
          if (previewRequest !== controller) return;
          previewRenderTask = null;
          previewFrame.append(canvas);
          page.cleanup();
          previewStatus.hidden = true;
        }
      } else {
        const image = document.createElement('img');
        image.alt = previewFrame.title;
        image.src = previewUrl;
        previewFrame.replaceChildren(image);
        previewFrame.hidden = false;
        previewFrame.scrollTop = 0;
        previewStatus.hidden = true;
      }
      previewReady = true;
      updatePreviewZoom();
    } catch (error) {
      if (previewRequest !== controller) return;
      previewStatus.textContent = error.name === 'AbortError' ? 'The document took too long to load. Please try again.' : error.message;
      previewFrame.hidden = true;
      previewStatus.hidden = false;
      previewRetry.hidden = false;
    } finally {
      clearTimeout(timeout);
      if (previewRequest === controller) previewRequest = null;
    }
  }
  previewRetry.addEventListener('click', loadPreview);
  function openDocument(kind, label) {
    if (!candidate) return;
    const params = new URLSearchParams({ id: candidate.id, source: candidate.source, election_id: candidate.election_id || '', kind });
    // Use authenticated same-origin endpoints and their readable filename headers.
    const endpoint = kind === 'certificate'
      ? `/api/admin/candidate-applications/${encodeURIComponent(candidate.id)}/certificate/`
      : `/api/admin/candidates/document/preview/?${params}`;
    previewOpener = document.activeElement;
    document.getElementById('candidatePreviewTitle').textContent = `${label} — ${name(candidate)}`;
    previewFrame.title = label;
    previewFileName = `${label}_${name(candidate)}`.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, '_').slice(0, 150);
    previewEndpoint = endpoint;
    previewModal.show();
    loadPreview();
  }
  const dialogElement = document.getElementById('candidateDocumentModal');
  const dialog = new bootstrap.Modal(dialogElement);
  const fileInput = document.getElementById('documentUpload');
  const dialogError = document.getElementById('documentError');
  const confirm = document.getElementById('documentConfirm');
  let pending = null;
  function openDocumentDialog(kind, label, deleting, replacing) {
    if (saving || !candidate) return;
    pending = { kind, deleting, replacing, label, target: { ...candidate } };
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
      dialogError.textContent = 'Select a non-empty file of at most 8 MB.'; notify(dialogError.textContent, true); return;
    }
    if (!operation.deleting && !(operation.kind === 'requirements_photo' ? /\.(jpe?g|png)$/i : /\.pdf$/i).test(file.name)) {
      dialogError.textContent = operation.kind === 'requirements_photo' ? 'Select a JPG or PNG photo.' : 'Select a PDF document.'; notify(dialogError.textContent, true); return;
    }
    const form = new FormData();
    form.set('id', operation.target.id); form.set('source', operation.target.source);
    form.set('election_id', operation.target.election_id || ''); form.set('kind', operation.kind);
    form.set('action', operation.deleting ? 'delete' : 'upload');
    if (!operation.deleting) form.set(operation.kind, file);
    saving = true; confirm.disabled = true; confirm.textContent = operation.deleting ? 'Deleting...' : 'Uploading...';
    try {
      const response = await fetch('/api/admin/candidates/document/', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRFToken': csrfToken }, body: form });
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : null;
      if (!response.ok || !data?.ok) throw new Error(data?.error || (response.status === 413 ? 'The server rejected the upload size.' : 'Unable to update the document. Refresh the page and try again.'));
      saving = false; dialog.hide();
      notify(`${operation.label} ${operation.deleting ? 'deleted' : operation.replacing ? 'replaced' : 'uploaded'} successfully.`);
      await load();
    } catch (error) {
      saving = false; dialogError.textContent = error.message; notify(error.message, true); confirm.disabled = false;
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
  document.getElementById('filesRefresh').addEventListener('click', () => load(false, true));
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

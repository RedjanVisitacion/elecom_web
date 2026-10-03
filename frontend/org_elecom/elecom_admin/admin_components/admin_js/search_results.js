document.addEventListener('DOMContentLoaded', function () {
  // ── Sidebar toggle ──────────────────────────────────────────────────────────
  const menuToggle    = document.getElementById('menuToggle');
  const sidebar       = document.getElementById('sidebar');
  const sidebarOverlay= document.getElementById('sidebarOverlay');
  const closeSidebar  = document.getElementById('closeSidebar');

  if (menuToggle && sidebar && sidebarOverlay) {
    menuToggle.addEventListener('click', () => { sidebar.classList.add('active'); sidebarOverlay.classList.add('active'); });
  }
  if (closeSidebar && sidebar && sidebarOverlay) {
    closeSidebar.addEventListener('click', () => { sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); });
  }
  if (sidebarOverlay && sidebar) {
    sidebarOverlay.addEventListener('click', () => { sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); });
  }
  window.addEventListener('resize', () => {
    if (window.innerWidth > 992 && sidebar) {
      sidebar.classList.remove('active');
      if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }
  });

  // ── Elements ────────────────────────────────────────────────────────────────
  const inputEl  = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');
  const listEl   = document.getElementById('searchList');
  const statusEl = document.getElementById('searchStatus');
  const countEl  = document.getElementById('searchCount');
  const API_BASE = '/api/admin/candidates/';

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const escapeHtml = (s) =>
    String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const setStatus = (msg) => { if (statusEl) { statusEl.textContent = msg; statusEl.style.display = msg ? '' : 'none'; } };
  const setCount  = (msg) => { if (countEl)  { countEl.textContent  = msg; countEl.style.display  = msg ? '' : 'none'; } };

  // ── Result card template ────────────────────────────────────────────────────
  function resultTemplate(item) {
    const name = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(' ');
    const meta = [item.student_id ? `ID: ${item.student_id}` : '', item.position || '', item.organization || ''].filter(Boolean).join(' • ');
    const avatar = (item.photo_url && String(item.photo_url).startsWith('http'))
      ? `<img src="${escapeHtml(item.photo_url)}" alt="" class="search-result-avatar">`
      : `<div class="search-result-avatar-placeholder"><i class="bi bi-person"></i></div>`;
    return `
      <div class="search-result-item">
        <a href="#" class="d-flex align-items-center gap-3 flex-grow-1 text-decoration-none" data-id="${escapeHtml(item.id)}" style="min-width:0; color:inherit;">
          ${avatar}
          <div class="flex-grow-1 overflow-hidden">
            <div class="search-result-name">${escapeHtml(name || item.student_id || '')}</div>
            <div class="search-result-meta">${escapeHtml(meta)}</div>
          </div>
          <div class="search-result-party">${escapeHtml(item.party_name || 'Independent')}</div>
        </a>
        <div class="d-flex gap-1 ms-2 flex-shrink-0">
          <button type="button" class="btn btn-sm btn-outline-primary"
                  data-action="edit" data-id="${escapeHtml(item.id)}" title="Edit">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger"
                  data-action="delete" data-id="${escapeHtml(item.id)}"
                  data-name="${escapeHtml(name)}" title="Unregister">
            <i class="bi bi-person-dash"></i>
          </button>
        </div>
      </div>`;
  }

  // ── Search ──────────────────────────────────────────────────────────────────
  let searchTimer = null;

  async function doSearch() {
    const q = inputEl ? inputEl.value.trim() : '';
    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
    if (!q) { if (listEl) listEl.innerHTML = ''; setStatus(''); setCount(''); return; }
    setStatus('Searching...'); setCount(''); if (listEl) listEl.innerHTML = '';
    try {
      const url = new URL(API_BASE + 'list/', window.location.origin);
      url.searchParams.set('q', q);
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      const rows = (data && data.ok) ? (data.candidates || []) : [];
      setStatus('');
      if (!rows.length) { setStatus('No candidates found.'); setCount(''); if (listEl) listEl.innerHTML = ''; return; }
      setCount(`${rows.length} result${rows.length === 1 ? '' : 's'} for "${escapeHtml(q)}"`);
      if (listEl) listEl.innerHTML = rows.map(resultTemplate).join('');
    } catch (e) { setStatus('Search failed. Please try again.'); setCount(''); }
  }

  if (inputEl) {
    inputEl.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    inputEl.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(doSearch, 220); });
    inputEl.focus();
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (inputEl) { inputEl.value = ''; inputEl.focus(); }
      clearBtn.style.display = 'none';
      if (listEl) listEl.innerHTML = '';
      setStatus(''); setCount('');
    });
  }

  // ── View profile modal ──────────────────────────────────────────────────────
  const viewModalEl = document.getElementById('candidateModal');
  const viewModal   = viewModalEl ? bootstrap.Modal.getOrCreateInstance(viewModalEl) : null;

  async function openCandidate(id) {
    if (!id || !viewModal) return;
    try {
      const res = await fetch(`${API_BASE}detail/?id=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
      const d = await res.json().catch(() => ({}));
      if (!d || !d.ok || !d.candidate) return;
      const c = d.candidate;
      const name = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ');
      const setText = (elId, v) => { const el = document.getElementById(elId); if (el) el.textContent = v || '—'; };
      setText('cd_name', name); setText('cd_student_id', c.student_id); setText('cd_position', c.position);
      setText('cd_org', c.organization); setText('cd_party', c.party_name); setText('cd_program', c.program);
      setText('cd_year', c.year_section);
      const platformEl = document.getElementById('cd_platform'); if (platformEl) platformEl.textContent = c.platform || '';
      const titleEl = document.getElementById('cd_name_title'); if (titleEl) titleEl.textContent = name || 'Candidate Details';
      const orgTitleEl = document.getElementById('cd_org_title'); if (orgTitleEl) orgTitleEl.textContent = [c.organization, c.position].filter(Boolean).join(' • ');
      const imgEl = document.getElementById('cd_photo');
      if (imgEl) { if (c.photo_url && String(c.photo_url).startsWith('http')) { imgEl.src = c.photo_url; imgEl.style.display = 'block'; } else { imgEl.style.display = 'none'; } }
      viewModal.show();
    } catch (e) {}
  }

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const editModalEl = document.getElementById('srEditModal');
  const editModal   = editModalEl ? bootstrap.Modal.getOrCreateInstance(editModalEl) : null;

  async function openEditModal(id) {
    if (!id || !editModal) return;
    try {
      const res = await fetch(`${API_BASE}detail/?id=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
      const d = await res.json().catch(() => ({}));
      if (!d || !d.ok || !d.candidate) return;
      const c = d.candidate;
      const set = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v || ''; };
      set('sr_ed_id', c.id); set('sr_ed_first_name', c.first_name); set('sr_ed_middle_name', c.middle_name);
      set('sr_ed_last_name', c.last_name); set('sr_ed_org', c.organization); set('sr_ed_position', c.position);
      set('sr_ed_program', c.program); set('sr_ed_year', c.year_section); set('sr_ed_platform', c.platform);
      set('sr_ed_photo_url', c.photo_url); set('sr_ed_party_logo_url', c.party_logo_url);
      ['sr_ed_photo_file','sr_ed_party_logo_file'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      ['sr_ed_photo_status','sr_ed_party_logo_status'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
      const prev = document.getElementById('sr_ed_photo_preview');
      const plch = document.getElementById('sr_ed_photo_placeholder');
      if (prev && plch) {
        if (c.photo_url && c.photo_url.startsWith('http')) { prev.src = c.photo_url; prev.style.display = ''; plch.style.display = 'none'; }
        else { prev.style.display = 'none'; plch.style.display = ''; }
      }
      editModal.show();
    } catch (e) {}
  }

  const srSaveEditBtn = document.getElementById('srSaveEditBtn');
  if (srSaveEditBtn) {
    srSaveEditBtn.addEventListener('click', async () => {
      const photoFile = document.getElementById('sr_ed_photo_file')?.files[0];
      const partyFile = document.getElementById('sr_ed_party_logo_file')?.files[0];
      let photoUrl = document.getElementById('sr_ed_photo_url')?.value || '';
      let partyUrl = document.getElementById('sr_ed_party_logo_url')?.value || '';

      if (photoFile) {
        const st = document.getElementById('sr_ed_photo_status'); if (st) st.textContent = 'Uploading…';
        try {
          const fd = new FormData(); fd.append('image', photoFile); fd.append('type', 'candidate_photo');
          const r = await fetch('/api/admin/candidates/upload-image/', { method:'POST', credentials:'same-origin', body: fd });
          const j = await r.json(); photoUrl = j.url || photoUrl;
          if (st) st.textContent = '';
          const el = document.getElementById('sr_ed_photo_url'); if (el) el.value = photoUrl;
        } catch { const st = document.getElementById('sr_ed_photo_status'); if (st) st.textContent = 'Upload failed'; return; }
      }
      if (partyFile) {
        const st = document.getElementById('sr_ed_party_logo_status'); if (st) st.textContent = 'Uploading…';
        try {
          const fd = new FormData(); fd.append('image', partyFile); fd.append('type', 'party_logo');
          const r = await fetch('/api/admin/candidates/upload-image/', { method:'POST', credentials:'same-origin', body: fd });
          const j = await r.json(); partyUrl = j.url || partyUrl;
          if (st) st.textContent = '';
          const el = document.getElementById('sr_ed_party_logo_url'); if (el) el.value = partyUrl;
        } catch { const st = document.getElementById('sr_ed_party_logo_status'); if (st) st.textContent = 'Upload failed'; return; }
      }

      const get = (elId) => { const el = document.getElementById(elId); return el ? el.value : ''; };
      const payload = {
        id: get('sr_ed_id'), first_name: get('sr_ed_first_name'), middle_name: get('sr_ed_middle_name'),
        last_name: get('sr_ed_last_name'), organization: get('sr_ed_org'), position: get('sr_ed_position'),
        program: get('sr_ed_program'), year_section: get('sr_ed_year'), platform: get('sr_ed_platform'),
        photo_url: photoUrl, party_logo_url: partyUrl,
      };
      const res = await fetch(API_BASE + 'update/', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (d && d.ok) { editModal.hide(); doSearch(); }
      else { alert(d && d.error ? d.error : 'Failed to save changes.'); }
    });
  }

  // ── Delete modal ─────────────────────────────────────────────────────────────
  const deleteModalEl = document.getElementById('srDeleteModal');
  const deleteModal   = deleteModalEl ? bootstrap.Modal.getOrCreateInstance(deleteModalEl) : null;

  function openDeleteModal(id, name) {
    if (!deleteModal) return;
    const nameEl = document.getElementById('srDelName'); if (nameEl) nameEl.textContent = name || '';
    const confirmBtn = document.getElementById('srConfirmDeleteBtn'); if (confirmBtn) confirmBtn.setAttribute('data-id', id);
    deleteModal.show();
  }

  const srConfirmDeleteBtn = document.getElementById('srConfirmDeleteBtn');
  if (srConfirmDeleteBtn) {
    srConfirmDeleteBtn.addEventListener('click', async function () {
      const id = this.getAttribute('data-id');
      const res = await fetch(API_BASE + 'delete/', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify({ id }) });
      const d = await res.json().catch(() => ({}));
      if (d && d.ok) { deleteModal.hide(); doSearch(); }
      else { alert(d && d.error ? d.error : 'Failed to unregister candidate.'); }
    });
  }

  // ── Unified list click handler ───────────────────────────────────────────────
  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const link      = e.target.closest('a[data-id]');
      const editBtn   = e.target.closest('[data-action="edit"]');
      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (editBtn)   { e.preventDefault(); openEditModal(editBtn.getAttribute('data-id')); return; }
      if (deleteBtn) { e.preventDefault(); openDeleteModal(deleteBtn.getAttribute('data-id'), deleteBtn.getAttribute('data-name')); return; }
      if (link)      { e.preventDefault(); openCandidate(link.getAttribute('data-id')); }
    });
  }
});

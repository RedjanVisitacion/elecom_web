document.addEventListener('DOMContentLoaded', function () {
  // ── Sidebar toggle ──────────────────────────────────────────────────────────
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const closeSidebar = document.getElementById('closeSidebar');

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
      sidebarOverlay && sidebarOverlay.classList.remove('active');
    }
  });

  // ── Elements ────────────────────────────────────────────────────────────────
  const inputEl   = document.getElementById('searchInput');
  const clearBtn  = document.getElementById('searchClear');
  const listEl    = document.getElementById('searchList');
  const statusEl  = document.getElementById('searchStatus');
  const countEl   = document.getElementById('searchCount');

  const API_BASE  = '/api/admin/candidates/';

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const escapeHtml = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const setStatus = (msg) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.display = msg ? '' : 'none';
  };

  const setCount = (msg) => {
    if (!countEl) return;
    countEl.textContent = msg;
    countEl.style.display = msg ? '' : 'none';
  };

  // ── Result card template ────────────────────────────────────────────────────
  function resultTemplate(item) {
    const name = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(' ');
    const meta = [
      item.student_id ? `ID: ${item.student_id}` : '',
      item.position || '',
      item.organization || '',
    ].filter(Boolean).join(' • ');

    const avatar = (item.photo_url && String(item.photo_url).startsWith('http'))
      ? `<img src="${escapeHtml(item.photo_url)}" alt="" class="search-result-avatar">`
      : `<div class="search-result-avatar-placeholder"><i class="bi bi-person"></i></div>`;

    return `
      <a href="#" class="search-result-item" data-id="${escapeHtml(item.id)}">
        ${avatar}
        <div class="flex-grow-1 overflow-hidden">
          <div class="search-result-name">${escapeHtml(name || item.student_id || '')}</div>
          <div class="search-result-meta">${escapeHtml(meta)}</div>
        </div>
        <div class="search-result-party">${escapeHtml(item.party_name || 'Independent')}</div>
      </a>`;
  }

  // ── Search ──────────────────────────────────────────────────────────────────
  let searchTimer = null;

  async function doSearch() {
    const q = inputEl ? inputEl.value.trim() : '';

    // Toggle clear button
    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

    if (!q) {
      if (listEl) listEl.innerHTML = '';
      setStatus('');
      setCount('');
      return;
    }

    setStatus('Searching...');
    setCount('');
    if (listEl) listEl.innerHTML = '';

    try {
      const url = new URL(API_BASE + 'list/', window.location.origin);
      url.searchParams.set('q', q);
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      const rows = (data && data.ok) ? (data.candidates || []) : [];

      setStatus('');

      if (!rows.length) {
        setStatus('No candidates found.');
        setCount('');
        if (listEl) listEl.innerHTML = '';
        return;
      }

      setCount(`${rows.length} result${rows.length === 1 ? '' : 's'} for "${escapeHtml(q)}"`);
      if (listEl) listEl.innerHTML = rows.map(resultTemplate).join('');
    } catch (e) {
      setStatus('Search failed. Please try again.');
      setCount('');
    }
  }

  if (inputEl) {
    // Clear any browser-autofilled value on load so we don't fire a search immediately
    inputEl.value = '';
    if (clearBtn) clearBtn.style.display = 'none';

    inputEl.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(doSearch, 220);
    });
    inputEl.focus();
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (inputEl) { inputEl.value = ''; inputEl.focus(); }
      clearBtn.style.display = 'none';
      if (listEl) listEl.innerHTML = '';
      setStatus('');
      setCount('');
    });
  }

  // ── Candidate profile modal ─────────────────────────────────────────────────
  const modalEl = document.getElementById('candidateModal');
  const modal   = modalEl ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;

  async function openCandidate(id) {
    if (!id || !modal) return;
    try {
      const res = await fetch(`${API_BASE}detail/?id=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
      const d = await res.json().catch(() => ({}));
      if (!d || !d.ok || !d.candidate) return;
      const c = d.candidate;

      const name = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ');

      const set = (elId, v) => { const el = document.getElementById(elId); if (el) el.textContent = v || '—'; };
      set('cd_name',       name);
      set('cd_student_id', c.student_id);
      set('cd_position',   c.position);
      set('cd_org',        c.organization);
      set('cd_party',      c.party_name);
      set('cd_program',    c.program);
      set('cd_year',       c.year_section);

      const platformEl = document.getElementById('cd_platform');
      if (platformEl) platformEl.textContent = c.platform || '';

      const titleEl = document.getElementById('cd_name_title');
      if (titleEl) titleEl.textContent = name || 'Candidate Details';

      const orgTitleEl = document.getElementById('cd_org_title');
      if (orgTitleEl) orgTitleEl.textContent = [c.organization, c.position].filter(Boolean).join(' • ');

      const imgEl = document.getElementById('cd_photo');
      if (imgEl) {
        if (c.photo_url && String(c.photo_url).startsWith('http')) {
          imgEl.src = c.photo_url;
          imgEl.style.display = 'block';
        } else {
          imgEl.style.display = 'none';
        }
      }

      modal.show();
    } catch (e) {}
  }

  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-id]');
      if (!a) return;
      e.preventDefault();
      openCandidate(a.getAttribute('data-id'));
    });
  }
});

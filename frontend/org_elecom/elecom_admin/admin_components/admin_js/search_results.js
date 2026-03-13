document.addEventListener('DOMContentLoaded', function(){
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const closeSidebar = document.getElementById('closeSidebar');

  // Guard: if any sidebar link (e.g. Home) accidentally overlaps the main content,
  // block navigation when the click happens outside the sidebar's visible bounds.
  document.addEventListener('click', (e) => {
    if (!sidebar) return;
    const link = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!link) return;
    if (!sidebar.contains(link)) return;

    const rect = sidebar.getBoundingClientRect();
    const insideSidebar = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
    if (!insideSidebar) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  if (menuToggle && sidebar && sidebarOverlay) {
    menuToggle.addEventListener('click', function(){ sidebar.classList.add('active'); sidebarOverlay.classList.add('active'); });
  }

  function hideSuggestions(){
    if (!suggestEl) return;
    suggestEl.style.display = 'none';
    suggestEl.innerHTML = '';
  }

  function showSuggestions(items){
    if (!suggestEl) return;
    if (!items || items.length === 0) { hideSuggestions(); return; }
    const placeholder = 'https://via.placeholder.com/40x40?text=%20';
    suggestEl.innerHTML = items.map((item) => {
      const name = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(' ');
      const photo = item.photo_url && String(item.photo_url).startsWith('http') ? item.photo_url : placeholder;
      return `\n<a href="#" class="list-group-item list-group-item-action" data-id="${escapeHtml(item.id)}">\n  <div class="d-flex align-items-center gap-2">\n    <img src="${escapeHtml(photo)}" alt="" class="rounded-circle border" style="width:40px;height:40px;object-fit:cover;">\n    <div class="flex-grow-1">\n      <div class="d-flex w-100 justify-content-between">\n        <strong>${escapeHtml(name)}</strong>\n        <small>${escapeHtml(item.student_id || '')}</small>\n      </div>\n      <div class="small text-muted">${escapeHtml(item.position || '')}${item.organization ? ' • ' + escapeHtml(item.organization) : ''}</div>\n    </div>\n  </div>\n</a>`;
    }).join('');
    suggestEl.style.display = 'block';
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

  const subtitleEl = document.getElementById('searchSubtitle');
  const titleEl = document.getElementById('searchTitle');
  const countEl = document.getElementById('searchCount');
  const emptyEl = document.getElementById('searchEmpty');
  const listEl = document.getElementById('searchList');
  const inputEl = document.getElementById('searchInput');
  const suggestEl = document.getElementById('searchSuggestions');

  const API_BASE = '/api/admin/candidates/';

  const getQuery = () => {
    try {
      const url = new URL(window.location.href);
      return (url.searchParams.get('q') || '').trim();
    } catch (e) {
      return '';
    }
  };

  const shouldFocus = () => {
    try {
      const url = new URL(window.location.href);
      return (url.searchParams.get('focus') || '') === '1';
    } catch (e) {
      return false;
    }
  };

  const setVisible = (el, show) => {
    if (!el) return;
    el.style.display = show ? '' : 'none';
  };

  const escapeHtml = (s) => {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  function rowTemplate(item){
    const name = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(' ');
    const line2 = [item.student_id ? `ID: ${item.student_id}` : '', item.position || '', item.organization || ''].filter(Boolean).join(' • ');

    const hasPhoto = !!(item.photo_url && String(item.photo_url).startsWith('http'));
    const avatarHtml = hasPhoto
      ? `<img src="${escapeHtml(item.photo_url)}" alt="" class="rounded-circle border" style="width:40px;height:40px;object-fit:cover;">`
      : `<div class="rounded-circle border d-flex align-items-center justify-content-center bg-light" style="width:40px;height:40px;"><i class="bi bi-person fs-5 text-secondary"></i></div>`;

    return `
      <a href="#" class="list-group-item list-group-item-action" data-id="${escapeHtml(item.id)}">
        <div class="d-flex align-items-start justify-content-between gap-3">
          <div class="d-flex align-items-start gap-2 flex-grow-1">
            ${avatarHtml}
            <div class="flex-grow-1">
              <div class="fw-semibold">${escapeHtml(name || item.student_id || '')}</div>
              <div class="small text-muted">${escapeHtml(line2)}</div>
            </div>
          </div>
          <div class="text-muted small">${escapeHtml(item.party_name || 'Independent')}</div>
        </div>
      </a>`;
  }

  async function loadResults(){
    const q = getQuery();
    if (inputEl) inputEl.value = q;

    hideSuggestions();

    if (inputEl && shouldFocus()) {
      try {
        inputEl.focus();
        const len = inputEl.value.length;
        inputEl.setSelectionRange(len, len);
      } catch (e) {}
    }

    if (!q) {
      if (titleEl) titleEl.style.display = 'none';
      if (subtitleEl) subtitleEl.style.display = 'none';
    } else {
      if (titleEl) titleEl.style.display = '';
      if (subtitleEl) subtitleEl.style.display = '';
      if (subtitleEl) subtitleEl.textContent = `Showing results for "${q}"`;
    }

    if (!q) {
      if (countEl) countEl.textContent = '';
      setVisible(emptyEl, false);
      setVisible(listEl, false);
      if (listEl) listEl.innerHTML = '';
      return;
    }

    setVisible(emptyEl, false);
    setVisible(listEl, false);
    if (countEl) countEl.textContent = 'Loading...';

    try {
      const url = new URL(API_BASE + 'list/', window.location.origin);
      url.searchParams.set('q', q);
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      const rows = (data && data.ok) ? (data.candidates || []) : [];

      if (countEl) countEl.textContent = `${rows.length} result(s)`;

      if (!rows || rows.length === 0) {
        if (emptyEl) emptyEl.textContent = 'No candidates found.';
        setVisible(emptyEl, true);
        setVisible(listEl, false);
        if (listEl) listEl.innerHTML = '';
        return;
      }

      if (listEl) listEl.innerHTML = rows.map(rowTemplate).join('');
      setVisible(listEl, true);
    } catch (e) {
      if (countEl) countEl.textContent = '';
      if (emptyEl) emptyEl.textContent = 'Failed to load results.';
      setVisible(emptyEl, true);
      setVisible(listEl, false);
      if (listEl) listEl.innerHTML = '';
    }
  }

  const modalEl = document.getElementById('candidateModal');
  const modal = modalEl ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;

  async function openCandidate(id){
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}detail/?id=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
      const d = await res.json().catch(() => ({}));
      if (!d || !d.ok || !d.candidate) return;
      const c = d.candidate;
      const name = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ');
      const setValue = (elId, v) => {
        const el = document.getElementById(elId);
        if (el) el.value = v || '';
      };
      setValue('cd_name', name);
      setValue('cd_student_id', c.student_id);
      setValue('cd_position', c.position);
      setValue('cd_org', c.organization);
      setValue('cd_program', c.program);
      setValue('cd_year', c.year_section);
      const platform = document.getElementById('cd_platform');
      if (platform) platform.textContent = c.platform || '';
      const img = document.getElementById('cd_photo');
      if (img) {
        if (c.photo_url && String(c.photo_url).startsWith('http')) {
          img.src = c.photo_url;
          img.style.display = 'block';
        } else {
          img.style.display = 'none';
        }
      }
      if (modal) modal.show();
    } catch (e) {}
  }

  let suggestTimer = null;

  async function doSuggest(){
    if (!inputEl) return;
    const q = inputEl.value.trim();
    if (!q || q.length < 2) {
      hideSuggestions();
      return;
    }

    try {
      const url = new URL(API_BASE + 'list/', window.location.origin);
      url.searchParams.set('q', q);
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      const rows = (data && data.ok) ? (data.candidates || []) : [];
      showSuggestions(rows.slice(0, 8));
    } catch (e) {
      hideSuggestions();
    }
  }

  if (inputEl) {
    inputEl.addEventListener('input', () => {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(doSuggest, 200);
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        hideSuggestions();
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!suggestEl || !inputEl) return;
    if (!suggestEl.contains(e.target) && e.target !== inputEl) {
      hideSuggestions();
    }
  });

  if (suggestEl) {
    suggestEl.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-id]');
      if (!a) return;
      e.preventDefault();
      hideSuggestions();
      openCandidate(a.getAttribute('data-id'));
    });
  }

  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-id]');
      if (!a) return;
      e.preventDefault();
      openCandidate(a.getAttribute('data-id'));
    });
  }

  loadResults();
});

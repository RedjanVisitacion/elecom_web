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

  let redirectedToSearch = false;
  function goToSearchPage() {
    if (redirectedToSearch) return;
    redirectedToSearch = true;
    const q = searchInput ? searchInput.value.trim() : '';
    const url = new URL('/static/org_elecom/elecom_admin/search_results.html', window.location.origin);
    url.searchParams.set('focus', '1');
    if (q) url.searchParams.set('q', q);
    window.location.href = url.toString();
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

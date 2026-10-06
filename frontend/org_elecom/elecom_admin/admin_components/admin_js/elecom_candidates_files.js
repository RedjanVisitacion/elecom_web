(() => {
  'use strict';
  const orgs = ['USG', 'PAFE', 'SITE', 'AFPROTECHS'];
  const documents = [['2x2 Picture', 'requirements_photo_url', 'bi-file-earmark-image'], ['Certificate of Enrollment', 'enrollment_certificate_url', 'bi-file-earmark-text'], ['Grade Card', 'grades_url', 'bi-file-earmark-text'], ['Good Moral Certificate', 'good_moral_url', 'bi-file-earmark-text']];
  const grid = document.getElementById('filesGrid');
  const search = document.getElementById('filesSearch');
  const status = document.getElementById('filesStatus');
  const election = document.getElementById('filesElection');
  let rows = [], org = '', candidate = null, generation = 0, loading = false;
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
  function tile(label, detail, icon, action, href, missing = false, metadata = null) {
    const el = document.createElement(href ? 'a' : action ? 'button' : 'div');
    el.className = `file-tile${href || missing ? ' document' : ''}${missing ? ' missing' : ''}`;
    if (action) { el.type = 'button'; el.addEventListener('click', action); }
    if (href) { el.href = href; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
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
    el.append(graphic, title, meta); grid.append(el);
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
    const items = [];
    if (candidate) {
      for (const [label, key, icon] of documents) {
        if (!label.toLowerCase().includes(query)) continue;
        const href = candidate[key] ? url(candidate[key]) : '';
        items.push({ label, detail: href ? 'Open file ↗' : 'Not submitted', icon, href, missing: !href });
      }
    } else if (org) {
      rows.filter(row => group(row) === org && `${name(row)} ${row.student_id} ${row.position}`.toLowerCase().includes(query))
        .sort((a, b) => name(a).localeCompare(name(b))).forEach(row => {
          const count = documents.filter(([, key]) => row[key] && url(row[key])).length;
          items.push({ label: name(row), detail: `${row.student_id} · ${row.position} · ${count}/4 files · ${row.status}`, date: timestamp(row.created_at), metadata: [['ID', String(row.student_id)], ['Role', row.position || '?'], ['Files', `${count}/4 submitted`], ['Status', String(row.status || '').replaceAll('_', ' ')]], icon: 'bi-folder-fill', action: () => navigate(org, row) });
        });
    } else {
      [...new Set([...orgs, ...rows.map(group)])].filter(label => label.toLowerCase().includes(query)).forEach(label => {
        const members = rows.filter(row => group(row) === label);
        const count = members.length;
        const date = Math.max(0, ...members.map(row => timestamp(row.created_at)));
        items.push({ label: `${label} Candidates`, detail: `${count} candidate folder${count === 1 ? '' : 's'}`, date, icon: 'bi-folder-fill', action: () => navigate(label) });
      });
    }
    items.sort(compare).forEach(item => tile(item.label, item.detail, item.icon, item.action, item.href, item.missing, item.metadata));
    status.textContent = grid.children.length ? `${grid.children.length} item${grid.children.length === 1 ? '' : 's'}` : query ? 'No matching items in this folder.' : 'No candidates in this organization for the selected election.';
  }
  async function load() {
    const id = ++generation; loading = true; rows = []; candidate = null; render();
    try {
      const params = new URLSearchParams(); if (election.value) params.set('election_id', election.value);
      const res = await fetch(`/api/admin/candidates/files/?${params}`, { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Unable to load candidate files.');
      if (id !== generation) return;
      rows = data.candidates || []; loading = false; render();
    } catch (error) {
      if (id !== generation) return;
      loading = false; grid.replaceChildren(); status.textContent = `${error.message} Use Refresh to try again.`;
    }
  }
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
  election.addEventListener('change', () => { org = ''; load(); });
  document.getElementById('filesBack').addEventListener('click', () => navigate(candidate ? org : ''));
  document.getElementById('filesRefresh').addEventListener('click', load);
  async function init() {
    try {
      const res = await fetch('/api/admin/elections/', { credentials: 'same-origin' }); const data = await res.json();
      if (res.ok && data.ok) for (const item of data.elections || []) { const option = document.createElement('option'); option.value = item.id; option.textContent = `${item.name || item.election_name || 'Election'} (${item.school_year || item.id})`; election.append(option); }
      const selected = new URLSearchParams(location.search).get('election_id');
      if (selected && [...election.options].some(option => option.value === selected)) election.value = selected;
    } catch (_) { /* Current election remains available. */ }
    load();
  }
  init();
})();

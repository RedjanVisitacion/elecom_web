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
  const group = row => String(row.organization || 'Other').trim().toUpperCase();
  const url = value => {
    try { const parsed = new URL(value); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : ''; } catch (_) { return ''; }
  };
  function tile(label, detail, icon, action, href, missing = false) {
    const el = document.createElement(href ? 'a' : action ? 'button' : 'div');
    el.className = `file-tile${href || missing ? ' document' : ''}${missing ? ' missing' : ''}`;
    if (action) { el.type = 'button'; el.addEventListener('click', action); }
    if (href) { el.href = href; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
    const graphic = document.createElement('i'); graphic.className = `bi ${icon}`; graphic.setAttribute('aria-hidden', 'true');
    const title = document.createElement('strong'); title.textContent = label;
    const meta = document.createElement('small'); meta.textContent = detail;
    el.append(graphic, title, meta); grid.append(el);
  }
  function navigate(nextOrg = '', nextCandidate = null) { org = nextOrg; candidate = nextCandidate; search.value = ''; render(); }
  function render() {
    grid.replaceChildren();
    document.getElementById('filesBack').disabled = !org || loading;
    const crumbs = document.getElementById('filesBreadcrumb'); crumbs.replaceChildren();
    const crumb = (label, action) => { const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = label; btn.addEventListener('click', action); crumbs.append(btn); };
    crumb('Candidates Files', () => navigate());
    if (org) { crumbs.append(' / '); crumb(org, () => navigate(org)); }
    if (candidate) { crumbs.append(' / '); const span = document.createElement('span'); span.textContent = name(candidate); crumbs.append(span); }
    if (loading) { status.textContent = 'Loading candidate files…'; return; }
    const query = search.value.trim().toLowerCase();
    if (candidate) {
      for (const [label, key, icon] of documents) {
        if (!label.toLowerCase().includes(query)) continue;
        const href = candidate[key] ? url(candidate[key]) : '';
        tile(label, href ? 'Open file ↗' : 'Not submitted', icon, null, href, !href);
      }
    } else if (org) {
      rows.filter(row => group(row) === org && `${name(row)} ${row.student_id} ${row.position}`.toLowerCase().includes(query))
        .sort((a, b) => name(a).localeCompare(name(b))).forEach(row => {
          const count = documents.filter(([, key]) => row[key] && url(row[key])).length;
          tile(name(row), `${row.student_id} · ${row.position} · ${count}/4 files · ${row.status}`, 'bi-folder-fill', () => navigate(org, row));
        });
    } else {
      [...new Set([...orgs, ...rows.map(group)])].filter(label => label.toLowerCase().includes(query)).forEach(label => {
        const count = rows.filter(row => group(row) === label).length;
        tile(`${label} Candidates`, `${count} candidate folder${count === 1 ? '' : 's'}`, 'bi-folder-fill', () => navigate(label));
      });
    }
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

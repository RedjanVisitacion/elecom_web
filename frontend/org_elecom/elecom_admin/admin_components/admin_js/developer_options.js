(() => {
  'use strict';
  const status = document.getElementById('developerUsersStatus');
  const rows = document.getElementById('developerUsersRows');
  const query = document.getElementById('developerUserQuery');
  const previous = document.getElementById('developerUsersPrevious');
  const next = document.getElementById('developerUsersNext');
  let page = 1, csrf = '', busy = false, hasMore = false;
  function controls() { previous.disabled = busy || page === 1; next.disabled = busy || !hasMore; }
  async function load() {
    if (busy) return;
    busy = true; controls(); status.textContent = 'Loading users…'; rows.replaceChildren();
    try {
      const params = new URLSearchParams({ page, q: query.value.trim() });
      const res = await fetch(`/api/admin/developer/users/?${params}`, { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Unable to load users.');
      csrf = data.csrf_token; hasMore = data.has_more;
      for (const user of data.users) {
        const tr = document.createElement('tr');
        const name = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ');
        for (const text of [user.student_id || user.id, name || '—', user.email || '—', user.role || '—']) {
          const td = document.createElement('td'); td.textContent = text; tr.append(td);
        }
        const action = document.createElement('td');
        if (String(user.role).trim().toLowerCase() !== 'admin') {
          const button = document.createElement('button'); button.type = 'button';
          button.className = 'btn btn-outline-primary btn-sm'; button.textContent = 'Make admin';
          button.addEventListener('click', async () => {
            if (busy || !window.confirm(`Grant full admin access to ${name || user.student_id || user.id}?`)) return;
            busy = true; button.disabled = true; controls();
            try {
              const response = await fetch('/api/admin/developer/users/', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf }, body: JSON.stringify({ id: user.id, role: 'admin' }) });
              const result = await response.json();
              if (!response.ok || !result.ok) throw new Error(result.error || 'Unable to update role.');
              busy = false; await load(); status.textContent = result.message;
            } catch (error) { status.textContent = error.message; }
            finally { busy = false; button.disabled = false; controls(); }
          });
          action.append(button);
        } else { action.textContent = 'Administrator'; }
        tr.append(action); rows.append(tr);
      }
      status.textContent = data.users.length ? `Page ${page} · ${data.users.length} accounts` : 'No matching accounts.';
    } catch (error) { hasMore = false; status.textContent = error.message; }
    finally { busy = false; controls(); }
  }
  document.querySelectorAll('[data-developer-panel]').forEach(button => button.addEventListener('click', () => {
    for (const id of ['resetPanel', 'usersPanel']) document.getElementById(id).hidden = id !== button.dataset.developerPanel;
    if (button.dataset.developerPanel === 'usersPanel') load();
  }));
  document.getElementById('developerUserSearch').addEventListener('submit', event => { event.preventDefault(); if (!busy) { page = 1; load(); } });
  previous.addEventListener('click', () => { if (!busy && page > 1) { page--; load(); } });
  next.addEventListener('click', () => { if (!busy && hasMore) { page++; load(); } });
  controls();
})();

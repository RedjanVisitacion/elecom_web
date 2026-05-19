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

  const listEl = document.getElementById('electionsList');
  const alertEl = document.getElementById('electionAlert');
  const form = document.getElementById('newElectionForm');
  const refreshBtn = document.getElementById('refreshElectionsBtn');
  const createBtn = document.getElementById('createElectionBtn');
  const cancelEditBtn = document.getElementById('cancelEditElectionBtn');
  const editingElectionId = document.getElementById('editingElectionId');
  const formTitle = document.getElementById('electionFormTitle');
  const formHint = document.getElementById('electionFormHint');
  let loadedElections = [];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showAlert(message, type) {
    if (!alertEl) return;
    if (!message) {
      alertEl.className = 'alert d-none';
      alertEl.textContent = '';
      return;
    }
    alertEl.className = `alert alert-${type || 'danger'}`;
    alertEl.textContent = message;
    alertEl.classList.remove('d-none');
  }

  function formatDateTime(value) {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function statusInfo(election) {
    const raw = String(election.status || 'draft').toLowerCase();
    if (election.is_active) return { className: 'active', label: 'Active' };
    if (raw === 'upcoming') return { className: 'upcoming', label: 'Upcoming' };
    if (raw === 'closed') return { className: 'closed', label: 'Closed' };
    return { className: 'archived', label: 'Archived' };
  }

  function setLoading(isLoading) {
    if (refreshBtn) refreshBtn.disabled = !!isLoading;
    if (createBtn) createBtn.disabled = !!isLoading;
    if (cancelEditBtn) cancelEditBtn.disabled = !!isLoading;
  }

  function setFormMode(election) {
    const isEditing = !!election;
    if (editingElectionId) editingElectionId.value = isEditing ? election.id : '';
    if (formTitle) formTitle.textContent = isEditing ? 'Edit Election Schedule' : 'Create New Election';
    if (formHint) {
      formHint.textContent = isEditing
        ? 'Update the date and time for this election without creating a new record.'
        : 'The newest election becomes the active election. Old records stay archived.';
    }
    if (cancelEditBtn) cancelEditBtn.classList.toggle('d-none', !isEditing);
    if (createBtn) {
      createBtn.innerHTML = isEditing
        ? '<i class="bi bi-save"></i> Save Election Dates'
        : '<i class="bi bi-plus-circle"></i> Create New Active Election';
    }
    document.getElementById('electionName')?.toggleAttribute('readonly', isEditing);
    document.getElementById('schoolYear')?.toggleAttribute('readonly', isEditing);
  }

  function fillElectionForm(election) {
    document.getElementById('electionName').value = election.name || '';
    document.getElementById('schoolYear').value = election.school_year || '';
    document.getElementById('electionStart').value = election.start_at_local || '';
    document.getElementById('electionEnd').value = election.end_at_local || '';
    document.getElementById('electionResults').value = election.results_at_local || '';
    document.getElementById('electionNote').value = election.note || '';
    document.getElementById('electionPassword').value = '';
    setFormMode(election);
    form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function rowHtml(election) {
    const rawStatus = String(election.status || 'draft').toLowerCase();
    const primaryStatus = statusInfo(election);
    const candidateCount = Number(election.candidate_count || 0);
    const voteCount = Number(election.vote_count || 0);
    const voterCount = Number(election.voter_count || 0);
    const turnout = voterCount > 0 ? `${Math.round((voteCount / voterCount) * 100)}%` : '0%';
    const reportsUrl = `/static/org_elecom/elecom_admin/elecom_reports.html?election_id=${encodeURIComponent(election.id)}`;
    const resultsUrl = `/static/org_elecom/elecom_admin/elecom_results.html?election_id=${encodeURIComponent(election.id)}`;
    return `
      <article class="election-row">
        <div>
          <div class="election-title">
            <h3>${escapeHtml(election.name || `Election #${election.id}`)}</h3>
            <span class="election-pill ${escapeHtml(primaryStatus.className)}">${escapeHtml(primaryStatus.label)}</span>
            ${rawStatus !== primaryStatus.className && rawStatus !== 'draft' ? `<span class="election-pill ${escapeHtml(rawStatus)}">${escapeHtml(rawStatus)}</span>` : ''}
          </div>
          <div class="election-info-grid">
            <span class="election-info"><i class="bi bi-calendar-week"></i>${escapeHtml(election.school_year || 'No school year')}</span>
            <span class="election-info"><i class="bi bi-play-circle"></i>${escapeHtml(formatDateTime(election.start_at))}</span>
            <span class="election-info"><i class="bi bi-stop-circle"></i>${escapeHtml(formatDateTime(election.end_at))}</span>
            <span class="election-info"><i class="bi bi-flag"></i>${escapeHtml(formatDateTime(election.results_at))}</span>
          </div>
          <div class="election-stats">
            <span class="election-stat"><i class="bi bi-people"></i> Candidates<strong>${candidateCount}</strong></span>
            <span class="election-stat"><i class="bi bi-check2-square"></i> Votes Cast<strong>${voteCount}</strong></span>
            <span class="election-stat"><i class="bi bi-percent"></i> Turnout<strong>${turnout}</strong></span>
            <span class="election-stat"><i class="bi bi-activity"></i> Status<strong>${escapeHtml(primaryStatus.label)}</strong></span>
          </div>
        </div>
        <div class="election-actions">
          ${election.is_active ? `<button class="btn btn-sm btn-outline-dark" type="button" data-edit-election="${escapeHtml(election.id)}"><i class="bi bi-pencil-square"></i> Edit Dates</button>` : ''}
          <a class="btn btn-sm btn-outline-dark" href="${resultsUrl}"><i class="bi bi-graph-up"></i> Results</a>
          <a class="btn btn-sm btn-dark" href="${reportsUrl}"><i class="bi bi-file-earmark-bar-graph"></i> Reports</a>
        </div>
      </article>
    `;
  }

  async function loadElections() {
    setLoading(true);
    showAlert('');
    if (listEl) listEl.innerHTML = '<div class="empty-state">Loading elections...</div>';
    try {
      const res = await fetch('/api/admin/elections/', { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load elections.');
      const elections = data.elections || [];
      loadedElections = elections;
      if (!listEl) return;
      listEl.innerHTML = elections.length
        ? elections.map(rowHtml).join('')
        : '<div class="empty-state">No elections found. Create the first election event.</div>';
    } catch (error) {
      if (listEl) listEl.innerHTML = '<div class="empty-state">Failed to load elections.</div>';
      showAlert(error.message || 'Failed to load elections.', 'danger');
    } finally {
      setLoading(false);
    }
  }

  if (refreshBtn) refreshBtn.addEventListener('click', loadElections);
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', function(){
      form?.reset();
      setFormMode(null);
      showAlert('');
    });
  }
  if (listEl) {
    listEl.addEventListener('click', function(event){
      const editBtn = event.target.closest('[data-edit-election]');
      if (!editBtn) return;
      const election = loadedElections.find(item => String(item.id) === String(editBtn.dataset.editElection));
      if (!election) return;
      fillElectionForm(election);
    });
  }

  if (form) {
    form.addEventListener('submit', async function(event){
      event.preventDefault();
      showAlert('');
      const isEditing = !!(editingElectionId && editingElectionId.value);
      const payload = {
        action: isEditing ? 'update' : 'create',
        election_id: isEditing ? editingElectionId.value : '',
        name: document.getElementById('electionName')?.value || '',
        school_year: document.getElementById('schoolYear')?.value || '',
        start_at: document.getElementById('electionStart')?.value || '',
        end_at: document.getElementById('electionEnd')?.value || '',
        results_at: document.getElementById('electionResults')?.value || '',
        note: document.getElementById('electionNote')?.value || '',
        admin_password: document.getElementById('electionPassword')?.value || '',
      };
      setLoading(true);
      try {
        const res = await fetch('/api/admin/elections/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || (isEditing ? 'Failed to update election.' : 'Failed to create election.'));
        form.reset();
        setFormMode(null);
        showAlert(isEditing ? 'Election date and time updated.' : 'New active election created. Previous election records are kept as history.', 'success');
        await loadElections();
      } catch (error) {
        showAlert(error.message || (isEditing ? 'Failed to update election.' : 'Failed to create election.'), 'danger');
      } finally {
        setLoading(false);
      }
    });
  }

  loadElections();
});

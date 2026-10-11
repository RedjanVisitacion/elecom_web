document.addEventListener('DOMContentLoaded', function(){
  const votingInput = document.getElementById('voting_date_range');
  const startInput = document.getElementById('electionStart');
  const endInput = document.getElementById('electionEnd');
  const resultsInput = document.getElementById('electionResults');
  const startTime = document.getElementById('voting_start_time');
  const endTime = document.getElementById('voting_end_time');
  const resultsDate = document.getElementById('results_release_date');
  const resultsTime = document.getElementById('results_release_time');
  let votingPicker = null, resultsPicker = null, resultsTimePicker = null;
  const timePickers = new Map();
  const time24 = (value) => {
    const match = value.trim().match(/^(\d{1,2}):(\d{2}) (AM|PM)$/i);
    if (!match || Number(match[1]) < 1 || Number(match[1]) > 12 || Number(match[2]) > 59) return '';
    const hour = Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return `${String(hour).padStart(2, '0')}:${match[2]}`;
  };
  const syncResults = () => {
    const time = time24(resultsTime.value);
    resultsInput.value = resultsDate.value && time ? `${resultsDate.value}T${time}` : '';
    const sameDay = resultsDate.value && resultsDate.value === endInput.value.slice(0, 10);
    resultsTimePicker?.set('minTime', sameDay ? endInput.value.slice(11, 16) : null);
  };
  const syncVotingValues = () => {
    const dates = votingPicker ? votingPicker.selectedDates.map(date => votingPicker.formatDate(date, 'Y-m-d')) : votingInput.value.split(' to ');
    const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
    const start = time24(startTime.value), end = time24(endTime.value);
    startInput.value = validDate(dates[0]) && start ? `${dates[0]}T${start}` : '';
    endInput.value = validDate(dates[1]) && end ? `${dates[1]}T${end}` : '';
    const complete = !!(startInput.value && endInput.value);
    resultsDate.disabled = !complete; resultsTime.disabled = !complete;
    resultsPicker?.set('minDate', complete ? dates[1] : null);
    syncResults();
  };
  if (window.flatpickr) {
    const floating = { static: false, appendTo: document.body, disableMobile: true, position: 'auto left' };
    votingPicker = window.flatpickr(votingInput, {
      ...floating, mode: 'range', enableTime: false, dateFormat: 'Y-m-d', onChange: syncVotingValues,
    });
    resultsPicker = window.flatpickr(resultsDate, {
      ...floating, enableTime: false, dateFormat: 'Y-m-d', onChange: syncResults,
      onReady: (_, __, picker) => picker.calendarContainer.classList.add('results-release-calendar'),
    });
    for (const input of [startTime, endTime, resultsTime]) {
      const picker = window.flatpickr(input, {
        ...floating, noCalendar: true, enableTime: true, dateFormat: 'h:i K', time_24hr: false,
        minuteIncrement: 1, defaultDate: input.value,
        onChange: input === resultsTime ? syncResults : syncVotingValues,
      });
      timePickers.set(input.id, picker);
    }
    resultsTimePicker = timePickers.get('results_release_time');
  }
  votingInput.addEventListener('input', syncVotingValues);
  startTime.addEventListener('input', syncVotingValues); endTime.addEventListener('input', syncVotingValues);
  resultsDate.addEventListener('input', syncResults); resultsTime.addEventListener('input', syncResults);
  const setTime = (input, value) => {
    const picker = timePickers.get(input.id);
    if (picker) picker.setDate(value, false, 'H:i');
    else {
      const [hour, minute] = value.split(':').map(Number);
      input.value = `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
    }
  };
  const scheduleValue = id => document.getElementById(id)?.value || '';
  const focusVotingRange = () => votingInput.focus({ preventScroll: true });
  document.getElementById('newElectionForm')?.addEventListener('reset', () => {
    // Wait for the browser reset before restoring picker state and defaults.
    queueMicrotask(() => {
      votingPicker?.clear(); resultsPicker?.clear();
      votingInput.value = ''; resultsDate.value = '';
      setTime(startTime, '08:00'); setTime(endTime, '17:00'); setTime(resultsTime, '17:00');
      syncVotingValues();
    });
  });
  syncVotingValues();

  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const closeSidebar = document.getElementById('closeSidebar');

  // Password show/hide toggle
  const togglePwBtn = document.getElementById('toggleElectionPassword');
  const togglePwIcon = document.getElementById('toggleElectionPasswordIcon');
  const pwInput = document.getElementById('electionPassword');
  if (togglePwBtn && pwInput && togglePwIcon) {
    togglePwBtn.addEventListener('click', function () {
      const isHidden = pwInput.type === 'password';
      pwInput.type = isHidden ? 'text' : 'password';
      togglePwIcon.classList.toggle('bi-eye', !isHidden);
      togglePwIcon.classList.toggle('bi-eye-slash', isHidden);
    });
  }

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

  const header = document.querySelector('.top-navbar');
  function measureHeader() {
    if (header) document.documentElement.style.setProperty('--election-header-height', `${header.getBoundingClientRect().height}px`);
  }
  measureHeader();
  if (header && typeof ResizeObserver !== 'undefined') new ResizeObserver(measureHeader).observe(header);
  const viewButtons = Array.from(document.querySelectorAll('[data-election-view]'));
  function selectElectionView(view) {
    const grid = document.querySelector('.elections-grid');
    if (grid) grid.dataset.view = view;
    viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.electionView === view)));
  }
  viewButtons.forEach(button => button.addEventListener('click', () => selectElectionView(button.dataset.electionView)));

  const listEl = document.getElementById('electionsList');
  const alertEl = document.getElementById('electionAlert');
  const form = document.getElementById('newElectionForm');
  const createBtn = document.getElementById('createElectionBtn');
  const cancelEditBtn = document.getElementById('cancelEditElectionBtn');
  const editingElectionId = document.getElementById('editingElectionId');
  const formTitle = document.getElementById('electionFormTitle');
  let loadedElections = [];

  const schoolYear = document.getElementById('schoolYear');
  const schoolYearToggle = document.getElementById('schoolYearToggle');
  const schoolYearMenu = document.getElementById('schoolYearMenu');
  let schoolYearChanged = false;
  const currentYear = new Date().getFullYear();
  const fallbackYear = new Date().getMonth() >= 5 ? currentYear : currentYear - 1;
  for (let year = currentYear - 2; year <= currentYear + 5; year++) {
    schoolYear.add(new Option(`${year}-${year + 1}`, `${year}-${year + 1}`, year === fallbackYear, year === fallbackYear));
  }
  const syncSchoolYear = () => { schoolYearToggle.textContent = schoolYear.value || 'Select school year'; };
  const closeSchoolYear = (focus = false) => {
    schoolYearMenu.hidden = true; schoolYearToggle.setAttribute('aria-expanded', 'false');
    if (focus) schoolYearToggle.focus();
  };
  const setSchoolYearDefault = (value) => {
    if (!value) return;
    if (!Array.from(schoolYear.options).some(option => option.value === value)) schoolYear.add(new Option(value, value));
    Array.from(schoolYear.options).forEach(option => { option.defaultSelected = option.value === value; });
    schoolYear.value = value; syncSchoolYear();
  };
  schoolYearToggle.addEventListener('click', () => {
    if (!schoolYearMenu.hidden) { closeSchoolYear(); return; }
    votingPicker?.close(); resultsPicker?.close(); timePickers.forEach(picker => picker.close());
    schoolYearMenu.replaceChildren();
    for (const option of Array.from(schoolYear.options)) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'school-year-option'; button.textContent = option.textContent;
      button.classList.toggle('active', option.value === schoolYear.value);
      button.setAttribute('aria-pressed', String(option.value === schoolYear.value));
      button.addEventListener('click', () => {
        schoolYear.value = option.value; schoolYearChanged = true; syncSchoolYear(); closeSchoolYear(true);
      });
      schoolYearMenu.appendChild(button);
    }
    const rect = schoolYearToggle.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
    const downward = below >= 180 || below >= above;
    const height = Math.min(180, downward ? below : above);
    schoolYearMenu.style.maxHeight = `${Math.max(0, height)}px`;
    schoolYearMenu.style.width = `${rect.width}px`;
    schoolYearMenu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))}px`;
    schoolYearMenu.style.top = `${downward ? rect.bottom + 4 : rect.top - height - 4}px`;
    schoolYearMenu.hidden = false; schoolYearToggle.setAttribute('aria-expanded', 'true');
    const selected = schoolYearMenu.querySelector('.active');
    selected?.focus({ preventScroll: true }); selected?.scrollIntoView({ block: 'nearest' });
  });
  schoolYearMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeSchoolYear(true); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const options = Array.from(schoolYearMenu.children), index = options.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1);
      options[Math.max(0, Math.min(options.length - 1, next))]?.focus();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!schoolYearMenu.contains(event.target) && !schoolYearToggle.contains(event.target)) closeSchoolYear();
  });
  document.addEventListener('focusin', event => {
    if (!schoolYearMenu.hidden && !schoolYearMenu.contains(event.target) && event.target !== schoolYearToggle) closeSchoolYear();
  });
  window.addEventListener('resize', () => closeSchoolYear());
  document.addEventListener('scroll', event => {
    if (!schoolYearMenu.contains(event.target)) closeSchoolYear();
  }, true);
  form?.addEventListener('reset', () => {
    schoolYearChanged = false; closeSchoolYear(); queueMicrotask(syncSchoolYear);
  });
  syncSchoolYear();

  function electionIdFromRoute() {
    const match = window.location.pathname.match(/\/elections\/(\d+)\/edit-dates\/?$/);
    if (match) return match[1];
    const params = new URLSearchParams(window.location.search);
    return params.get('edit_election_id') || params.get('election_id') || '';
  }

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
    if (message && type === 'success' && window.bootstrap?.Toast) {
      const toast = document.getElementById('electionSuccessToast');
      const text = document.getElementById('electionSuccessMessage');
      if (toast && text) {
        alertEl.className = 'alert d-none'; alertEl.textContent = '';
        text.textContent = message;
        window.bootstrap.Toast.getOrCreateInstance(toast, { delay: 5000, autohide: true }).show();
        return;
      }
    }
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
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function statusInfo(election) {
    // is_active identifies the current term, not whether voting is still open.
    const raw = String(election.status || '').trim().toLowerCase();
    const statuses = { active: 'Active', upcoming: 'Upcoming', closed: 'Closed', archived: 'Archived', draft: 'Draft' };
    if (statuses[raw]) return { className: raw, label: statuses[raw] };
    return election.is_active
      ? { className: 'active', label: 'Active' }
      : { className: 'archived', label: 'Archived' };
  }

  function setLoading(isLoading) {
    if (createBtn) createBtn.disabled = !!isLoading;
    if (cancelEditBtn) cancelEditBtn.disabled = !!isLoading;
  }

  function setFormMode(election) {
    const isEditing = !!election;
    if (editingElectionId) editingElectionId.value = isEditing ? election.id : '';
    if (formTitle) formTitle.textContent = isEditing ? 'Edit Election Schedule' : 'Create New Election';
    if (cancelEditBtn) cancelEditBtn.classList.toggle('d-none', !isEditing);
    if (createBtn) {
      createBtn.innerHTML = isEditing
        ? '<i class="bi bi-save"></i> Save Election Dates'
        : '<i class="bi bi-plus-circle"></i> Create New Active Election';
    }
    document.getElementById('electionName')?.toggleAttribute('readonly', isEditing);
    // schoolYear is a <select> — use disabled when editing (school year shouldn't change)
    const syEl = document.getElementById('schoolYear');
    if (syEl) syEl.disabled = isEditing;
    schoolYearToggle.disabled = isEditing;
    closeSchoolYear(); syncSchoolYear();
  }

  function fillElectionForm(election) {
    document.getElementById('electionName').value = election.name || '';
    // Set school year select; add option if the stored value isn't in the list
    const syEl = document.getElementById('schoolYear');
    if (syEl) {
      const syVal = election.school_year || '';
      if (syVal && !Array.from(syEl.options).some(o => o.value === syVal)) {
        const opt = document.createElement('option');
        opt.value = syVal;
        opt.textContent = syVal;
        syEl.insertBefore(opt, syEl.firstChild);
      }
      syEl.value = syVal;
    }
    const startLocal = election.start_at_local || '', endLocal = election.end_at_local || '';
    const dates = [startLocal.slice(0, 10), endLocal.slice(0, 10)].filter(Boolean);
    if (votingPicker) votingPicker.setDate(dates, false, 'Y-m-d');
    else votingInput.value = dates.join(' to ');
    setTime(startTime, startLocal.slice(11, 16) || '08:00');
    setTime(endTime, endLocal.slice(11, 16) || '17:00');
    syncVotingValues();
    const release = election.results_at_local || '';
    if (resultsPicker) resultsPicker.setDate(release.slice(0, 10), false, 'Y-m-d');
    else resultsDate.value = release.slice(0, 10);
    setTime(resultsTime, release.slice(11, 16) || '17:00');
    syncResults();
    const noteEl = document.getElementById('electionNote');
    if (noteEl) noteEl.value = election.note || '';
    document.getElementById('electionPassword').value = '';
    setFormMode(election);
    selectElectionView('form');
  }

  function rowHtml(election) {
    const primaryStatus = statusInfo(election);
    const candidateCount = Number(election.candidate_count || 0);
    const voteCount = Number(election.vote_count || 0);
    const voterCount = Number(election.voter_count || 0);
    const turnout = voterCount > 0 ? `${Math.round((voteCount / voterCount) * 100)}%` : '0%';
    const editUrl = `/elections/${encodeURIComponent(election.id)}/edit-dates/`;
    const reportsUrl = `/elections/${encodeURIComponent(election.id)}/reports/`;
    const resultsUrl = `/elections/${encodeURIComponent(election.id)}/results/`;
    return `
      <article class="election-row${primaryStatus.className === 'active' ? ' active-election-card' : ''}">
        <div>
          <div class="election-title">
            <h3>${escapeHtml(election.name || `Election #${election.id}`)}</h3>
            <span class="election-pill ${escapeHtml(primaryStatus.className)}">${escapeHtml(primaryStatus.label)}</span>
          </div>
          <div class="election-info-grid">
            <span class="election-info"><span class="election-info-label"><i class="bi bi-calendar-week" aria-hidden="true"></i>School Year</span>${escapeHtml(election.school_year || 'Not set')}</span>
            <span class="election-info"><span class="election-info-label"><i class="bi bi-play-circle" aria-hidden="true"></i>Start Date</span>${escapeHtml(formatDateTime(election.start_at))}</span>
            <span class="election-info"><span class="election-info-label"><i class="bi bi-stop-circle" aria-hidden="true"></i>End Date</span>${escapeHtml(formatDateTime(election.end_at))}</span>
            <span class="election-info"><span class="election-info-label"><i class="bi bi-flag" aria-hidden="true"></i>Results Release Date</span>${escapeHtml(formatDateTime(election.results_at))}</span>
          </div>
          <div class="election-stats">
            <span class="election-stat"><i class="bi bi-people"></i> Candidates<strong>${candidateCount}</strong></span>
            <span class="election-stat"><i class="bi bi-check2-square"></i> Votes Cast<strong>${voteCount}</strong></span>
            <span class="election-stat"><i class="bi bi-percent"></i> Turnout<strong>${turnout}</strong></span>
          </div>
        </div>
        <div class="election-actions">
          ${election.is_active ? `<a class="btn btn-sm btn-outline-dark" href="${editUrl}" data-edit-election="${escapeHtml(election.id)}"><i class="bi bi-pencil-square"></i> Edit Dates</a>` : ''}
          <a class="btn btn-sm btn-outline-dark" href="${resultsUrl}"><i class="bi bi-graph-up"></i> Results</a>
          <a class="btn btn-sm btn-dark" href="${reportsUrl}"><i class="bi bi-file-earmark-bar-graph"></i> Reports</a>
        </div>
      </article>
    `;
  }

  async function loadElections(openRouteEditor = false) {
    setLoading(true);
    showAlert('');
    if (listEl) listEl.innerHTML = '<div class="empty-state">Loading elections...</div>';
    try {
      const res = await fetch('/api/admin/elections/', { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load elections.');
      const elections = data.elections || [];
      loadedElections = elections;
      const activeYear = elections.find(election => election.is_active && election.school_year)?.school_year;
      if (!schoolYearChanged && !editingElectionId?.value && activeYear) setSchoolYearDefault(activeYear);
      if (!listEl) return;
      listEl.innerHTML = elections.length
        ? elections.map(rowHtml).join('')
        : '<div class="empty-state">No elections found. Create the first election event.</div>';

      const routeElectionId = electionIdFromRoute();
      if (openRouteEditor && routeElectionId && window.location.pathname.includes('/edit-dates/')) {
        const election = loadedElections.find(item => String(item.id) === String(routeElectionId));
        if (election) fillElectionForm(election);
      }
    } catch (error) {
      if (listEl) listEl.innerHTML = '<div class="empty-state">Failed to load elections.</div>';
      showAlert(error.message || 'Failed to load elections.', 'danger');
    } finally {
      setLoading(false);
    }
  }

  function leaveEditRoute() {
    if (window.location.pathname.includes('/edit-dates/')) {
      window.history.replaceState(window.history.state, '', '/static/org_elecom/elecom_admin/elecom_elections.html');
    }
  }
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', function(){
      form?.reset();
      setFormMode(null);
      leaveEditRoute();
      showAlert('');
    });
  }
  if (listEl) {
    listEl.addEventListener('click', function(event){
      const editBtn = event.target.closest('[data-edit-election]');
      if (!editBtn) return;
      if (editBtn.tagName === 'A' && window.location.pathname !== editBtn.pathname) return;
      event.preventDefault();
      const election = loadedElections.find(item => String(item.id) === String(editBtn.dataset.editElection));
      if (!election) return;
      fillElectionForm(election);
    });
  }

  if (form) {
    form.addEventListener('submit', async function(event){
      event.preventDefault();
      showAlert('');
      syncVotingValues();
      if (resultsDate.value && !time24(resultsTime.value)) {
        showAlert('Choose a valid results release time.', 'danger'); resultsTime.focus(); return;
      }
      const isEditing = !!(editingElectionId && editingElectionId.value);
      const payload = {
        action: isEditing ? 'update' : 'create',
        election_id: isEditing ? editingElectionId.value : '',
        name: document.getElementById('electionName')?.value || '',
        school_year: document.getElementById('schoolYear')?.value || '',
        start_at: scheduleValue('electionStart'),
        end_at: scheduleValue('electionEnd'),
        results_at: scheduleValue('electionResults'),
        note: document.getElementById('electionNote')?.value || '',
        admin_password: document.getElementById('electionPassword')?.value || '',
      };
      const start = Date.parse(payload.start_at), end = Date.parse(payload.end_at);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        showAlert('Select a complete voting window with an end after the start.', 'danger'); focusVotingRange(); return;
      }
      if (payload.results_at && (!Number.isFinite(Date.parse(payload.results_at)) || Date.parse(payload.results_at) < end)) {
        showAlert('Results release cannot be before voting ends.', 'danger');
        resultsDate.focus(); return;
      }
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
        votingPicker?.close(); resultsPicker?.close();
        timePickers.forEach(picker => picker.close());
        form.reset();
        setFormMode(null);
        leaveEditRoute();
        await loadElections();
        showAlert(isEditing ? 'Election date and time updated.' : 'New active election created. Previous election records are kept as history.', 'success');
      } catch (error) {
        showAlert(error.message || (isEditing ? 'Failed to update election.' : 'Failed to create election.'), 'danger');
      } finally {
        setLoading(false);
      }
    });
  }

  loadElections(true);
});

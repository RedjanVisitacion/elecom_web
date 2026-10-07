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

  const resultsEmpty = document.getElementById('resultsEmpty');
  const resultsContainer = document.getElementById('resultsContainer');
  const analyticsGrid = document.getElementById('analyticsGrid');
  const orgFilterTabs = document.getElementById('orgFilterTabs');
  const orgLegendGrid = document.getElementById('orgLegendGrid');
  const totalVotesCenter = document.getElementById('totalVotesCenter');
  const resultElectionSelect = document.getElementById('resultElectionSelect');
  const resultsSubtitle = document.getElementById('resultsSubtitle');

  const ORG_ORDER = ['USG', 'SITE', 'PAFE', 'AFPRO'];
  const ORG_COLORS = {
    USG: '#f8d34a',
    SITE: '#8b1e2d',
    PAFE: '#2563eb',
    AFPRO: '#ec4899',
  };
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

  let activeOrg = 'ALL';
  let normalizedOrgs = [];
  const collapsedOrgs = new Set();
  let orgPieChart = null;

  function collapseAllOrgsByDefault() {
    collapsedOrgs.clear();
    normalizedOrgs.forEach((org) => collapsedOrgs.add(org.organization));
  }

  function routeElectionId() {
    const params = new URLSearchParams(window.location.search);
    const routeMatch = window.location.pathname.match(/\/elections\/(\d+)\/results\/?$/);
    return params.get('election_id') || (routeMatch ? routeMatch[1] : '');
  }

  function electionLabel(election) {
    const name = election.name || `Election #${election.id}`;
    return `${name}${election.school_year ? ` (${election.school_year})` : ''}`;
  }

  function esc(value){
    return String(value ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
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

  function orgDisplayName(org) {
    const normalized = normalizeOrg(org);
    const names = {
      USG: 'University Student Government (USG)',
      SITE: 'Society of Information Technology Enthusiasts (SITE)',
      PAFE: 'Prime Association of Future Educators (PAFE)',
      AFPRO: 'Association of Food Processing Technology Students (AFPROTECHS)',
      AFPROTECHS: 'Association of Food Processing Technology Students (AFPROTECHS)',
    };
    return names[normalized] || String(org || 'Organization');
  }

  function orgShortName(org) {
    const normalized = normalizeOrg(org);
    if (normalized === 'AFPRO') return 'AFPROTECHS';
    return normalized;
  }


  function orgLogoUrl(org) {
    const normalized = normalizeOrg(org);
    const logos = {
      USG: '/static/assets/org_logos/USG_LOGO.png',
      SITE: '/static/assets/org_logos/SITE_LOGO.png',
      PAFE: '/static/assets/org_logos/PAFE_LOGO.png',
      AFPRO: '/static/assets/org_logos/AFPROTECHS_LOGO.png',
      AFPROTECHS: '/static/assets/org_logos/AFPROTECHS_LOGO.png',
    };
    return logos[normalized] || '/static/assets/elecom.png';
  }

  function toOrgFirst(grouped) {
    const orgMap = new Map();

    (grouped || []).forEach((party) => {
      const partyName = party.party_name || 'Independent';
      (party.organizations || []).forEach((orgBlock) => {
        const orgName = normalizeOrg(orgBlock.organization);
        if (!orgMap.has(orgName)) {
          orgMap.set(orgName, { organization: orgName, total_votes: 0, positions: new Map() });
        }
        const orgData = orgMap.get(orgName);

        (orgBlock.positions || []).forEach((posBlock) => {
          const posName = normalizePosition(posBlock.position);
          if (!orgData.positions.has(posName)) {
            orgData.positions.set(posName, { position: posName, total_votes: 0, candidates: [] });
          }
          const posData = orgData.positions.get(posName);

          (posBlock.candidates || []).forEach((candidate) => {
            const votes = Number(candidate.votes || 0);
            const candidateData = { ...candidate, partyName, votes };
            posData.total_votes += votes;
            orgData.total_votes += votes;
            posData.candidates.push(candidateData);
          });
        });
      });
    });

    return Array.from(orgMap.values())
      .sort((a, b) => {
        const ka = orgSortKey(a.organization);
        const kb = orgSortKey(b.organization);
        if (ka[0] !== kb[0]) return ka[0] - kb[0];
        return ka[1].localeCompare(kb[1]);
      })
      .map((org) => ({
        ...org,
        positions: Array.from(org.positions.values())
          .sort((a, b) => {
            const ka = positionSortKey(org.organization, a.position);
            const kb = positionSortKey(org.organization, b.position);
            if (ka[0] !== kb[0]) return ka[0] - kb[0];
            return ka[1].localeCompare(kb[1]);
          })
          .map((pos) => ({
            ...pos,
            candidates: pos.candidates.sort((a, b) => {
              if ((b.votes || 0) !== (a.votes || 0)) return (b.votes || 0) - (a.votes || 0);
              return String(a.name || a.student_id || '').localeCompare(String(b.name || b.student_id || ''));
            }),
          })),
      }));
  }

  function renderCharts(orgs) {
    const orgLabels = orgs.map(org => org.organization);
    const orgValues = orgs.map(org => org.total_votes);
    const totalVotes = orgValues.reduce((sum, value) => sum + value, 0);
    if (totalVotesCenter) totalVotesCenter.textContent = totalVotes.toLocaleString();

    if (orgLegendGrid) {
      orgLegendGrid.innerHTML = orgs.map(org => `
        <div class="org-legend-item" title="${esc(orgDisplayName(org.organization))}">
          <span class="legend-dot" style="background:${ORG_COLORS[org.organization] || '#6b7280'}"></span>
          <strong>${esc(orgShortName(org.organization))}</strong>
          <span>${Number(org.total_votes || 0).toLocaleString()}</span>
        </div>
      `).join('');
    }

    const orgCanvas = document.getElementById('orgPie');
    if (orgCanvas && typeof Chart !== 'undefined') {
      if (orgPieChart) orgPieChart.destroy();
      orgPieChart = new Chart(orgCanvas, {
        type: 'doughnut',
        data: {
          labels: totalVotes ? orgLabels : ['No votes yet'],
          datasets: [{
            data: totalVotes ? orgValues : [1],
            backgroundColor: totalVotes ? orgLabels.map(label => ORG_COLORS[label] || '#6b7280') : ['#d1d5db'],
            borderWidth: 0,
            cutout: '72%',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: !!totalVotes } },
        },
      });
    }

  }

  function renderAnalytics(orgs, ballotsCast) {
    if (!analyticsGrid) return;
    const totalCandidates = orgs.reduce((sum, org) => sum + org.positions.reduce((count, pos) => count + pos.candidates.length, 0), 0);
    const highest = Math.max(0, ...orgs.map(org => org.total_votes));
    const leaders = highest ? orgs.filter(org => org.total_votes === highest).map(org => orgShortName(org.organization)).join(' / ') : 'No votes yet';
    const metrics = [
      ['Total Votes Cast', Number(ballotsCast || 0).toLocaleString(), 'Ballots submitted', 'bi-check2-square'],
      ['Total Candidates', totalCandidates.toLocaleString(), 'Across all organizations', 'bi-person-badge'],
      ['Leading Organization', leaders, highest ? `${highest.toLocaleString()} vote marks${orgs.filter(org => org.total_votes === highest).length > 1 ? ' (tied)' : ''}` : 'Based on vote marks', 'bi-flag'],
    ];
    analyticsGrid.innerHTML = metrics.map(([label, value, note, icon]) => `
      <div class="analytics-card"><div class="analytics-icon"><i class="bi ${icon}" aria-hidden="true"></i></div>
      <div><div class="analytics-label">${esc(label)}</div><div class="analytics-value">${esc(value)}</div><div class="analytics-muted">${esc(note)}</div></div></div>
    `).join('');
  }

  function renderTabs() {
    if (!orgFilterTabs) return;
    const tabs = ['ALL', ...ORG_ORDER];
    orgFilterTabs.innerHTML = tabs.map(tab => `
      <button type="button" class="org-filter-btn ${activeOrg === tab ? 'active' : ''}" data-org-filter="${esc(tab)}" aria-pressed="${activeOrg === tab}" title="${esc(tab === 'ALL' ? 'All Organizations' : orgDisplayName(tab))}">${esc(tab === 'ALL' ? 'ALL' : orgShortName(tab))}</button>
    `).join('');
  }

  function candidateRow(candidate, totalPositionVotes, rank) {
    const name = candidate.name || candidate.student_id || 'Unknown';
    const photo = candidate.photo_url && String(candidate.photo_url).startsWith('http') ? candidate.photo_url : '';
    const votes = Number(candidate.votes || 0);
    const pct = totalPositionVotes > 0 ? (votes / totalPositionVotes) * 100 : 0;
    const isWinner = rank === 1 && votes > 0;
    const avatar = photo
      ? `<img src="${esc(photo)}" class="result-candidate-avatar" alt="">`
      : `<div class="result-candidate-avatar placeholder"><i class="bi bi-person"></i></div>`;

    return `
      <div class="result-candidate-row ${isWinner ? 'is-winner' : ''}">
        <div class="rank-pill">${rank}</div>
        ${avatar}
        <div class="result-candidate-info">
          <div class="result-candidate-name">${esc(name)}</div>
          <div class="result-candidate-meta">${esc(candidate.partyName || 'Independent')}</div>
          <div class="result-track"><div class="result-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="result-vote-count">
          <strong>${votes.toLocaleString()}</strong>
          <span>${pct.toFixed(1)}%</span>
        </div>
      </div>
    `;
  }

  function renderResults() {
    if (!resultsContainer) return;
    renderTabs();
    const shown = activeOrg === 'ALL' ? normalizedOrgs : normalizedOrgs.filter(org => org.organization === activeOrg);
    if (!shown.length) {
      if (resultsEmpty) resultsEmpty.textContent = 'No candidates or votes data.';
      if (resultsEmpty) resultsEmpty.style.display = 'block';
      resultsContainer.innerHTML = '';
      return;
    }

    if (resultsEmpty) resultsEmpty.style.display = 'none';

    resultsContainer.innerHTML = shown.map(org => `
      <section class="result-org-card result-org-${esc(org.organization.toLowerCase())}">
        <button type="button" class="result-org-head" data-toggle-org="${esc(org.organization)}" aria-expanded="${collapsedOrgs.has(org.organization) ? 'false' : 'true'}">
          <div class="result-org-identity">
            <img class="result-org-logo" src="${esc(orgLogoUrl(org.organization))}" alt="${esc(orgDisplayName(org.organization))} logo" onerror="this.onerror=null;this.src='/static/assets/elecom.png';">
            <div>
              <div class="result-org-title">${esc(orgDisplayName(org.organization))}</div>
              <div class="result-org-votes">${Number(org.total_votes || 0).toLocaleString()} votes</div>
            </div>
          </div>
          <i class="bi ${collapsedOrgs.has(org.organization) ? 'bi-chevron-down' : 'bi-chevron-up'}"></i>
        </button>
        <div class="result-position-list" ${collapsedOrgs.has(org.organization) ? 'hidden' : ''}>
          ${org.positions.map(pos => {
            const totalPositionVotes = pos.candidates.reduce((sum, c) => sum + Number(c.votes || 0), 0);
            return `
              <div class="result-position-block">
                <div class="result-position-title">${esc(pos.position)}</div>
                <div class="result-candidate-list">
                  ${pos.candidates.map(candidate => candidateRow(candidate, totalPositionVotes, pos.candidates.findIndex(item => Number(item.votes || 0) === Number(candidate.votes || 0)) + 1)).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `).join('');
  }

  async function loadElectionChoices(selectedId) {
    if (!resultElectionSelect) return;
    try {
      const res = await fetch('/api/admin/elections/', { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return;
      const elections = data.elections || [];
      resultElectionSelect.innerHTML = elections.map((election) => {
        const id = String(election.id || '');
        const status = election.is_active ? 'Active' : (election.status || 'Archived');
        return `<option value="${esc(id)}" ${id === String(selectedId || '') ? 'selected' : ''}>${esc(electionLabel(election))} - ${esc(status)}</option>`;
      }).join('') || '<option value="">No elections found</option>';
    } catch (e) {
      // keep the default option
    }
  }

  let loadVersion = 0;
  async function loadResults(){
    const version = ++loadVersion;
    const resultsData = document.getElementById('resultsData');
    if (resultsData) resultsData.hidden = true;
    document.getElementById('resultsStatus').textContent = 'LOCKED';
    if (resultsEmpty) {
      resultsEmpty.style.display = 'block';
      resultsEmpty.textContent = 'Checking result availability...';
    }
    normalizedOrgs = [];
    orgPieChart?.destroy();
    orgPieChart = null;
    if (resultsContainer) resultsContainer.innerHTML = '';

    try {
      const url = new URL('/api/admin/results/', window.location.origin);
      const electionId = routeElectionId();
      if (electionId) url.searchParams.set('election_id', electionId);
      await loadElectionChoices(electionId);
      const res = await fetch(url.toString(), { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json();
      if (version !== loadVersion) return;
      if (!res.ok || !data || !data.ok || data.published !== true) {
        if (resultsEmpty) resultsEmpty.textContent = data.message || data.error || 'Results are unavailable.';
        if (resultsSubtitle) resultsSubtitle.textContent = 'Results are locked until the scheduled release time';
        if (resultsEmpty) resultsEmpty.style.display = 'block';
        return;
      }

      if (resultsData) resultsData.hidden = false;
      document.getElementById('resultsStatus').textContent = 'LIVE';
      normalizedOrgs = toOrgFirst(data.grouped || []);
      collapseAllOrgsByDefault();
      if (resultsSubtitle) {
        resultsSubtitle.textContent = electionId
          ? `Previewing archived election #${electionId}`
          : 'Published election results';
      }
      if (!document.getElementById('analyticsPanel').hidden) renderCharts(normalizedOrgs);
      renderAnalytics(normalizedOrgs, data.total_votes_cast);
      renderResults();
    } catch (e) {
      if (version !== loadVersion) return;
      if (resultsData) resultsData.hidden = true;
      if (resultsEmpty) resultsEmpty.textContent = 'Unable to load results. Please try again.';
      if (resultsEmpty) resultsEmpty.style.display = 'block';
    }
  }

  const viewTabs = Array.from(document.querySelectorAll('[data-results-tab]'));
  function selectView(tab) {
    viewTabs.forEach(button => {
      const selected = button === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      document.getElementById(button.dataset.resultsTab).hidden = !selected;
    });
    if (tab.dataset.resultsTab === 'analyticsPanel') renderCharts(normalizedOrgs);
  }
  viewTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectView(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? viewTabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + viewTabs.length) % viewTabs.length;
      viewTabs[next].focus();
      selectView(viewTabs[next]);
    });
  });

  orgFilterTabs?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-org-filter]');
    if (!btn) return;
    activeOrg = btn.dataset.orgFilter || 'ALL';
    renderResults();
  });

  resultElectionSelect?.addEventListener('change', () => {
    const electionId = resultElectionSelect.value || '';
    const nextPath = electionId
      ? `/elections/${encodeURIComponent(electionId)}/results/`
      : '/static/org_elecom/elecom_admin/elecom_results.html';
    window.history.pushState({ electionId }, '', nextPath);
    activeOrg = 'ALL';
    collapsedOrgs.clear();
    loadResults();
  });

  window.addEventListener('popstate', () => {
    activeOrg = 'ALL';
    collapsedOrgs.clear();
    loadResults();
  });

  resultsContainer?.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-toggle-org]');
    if (!toggle) return;
    const org = toggle.dataset.toggleOrg;
    if (!org) return;
    if (collapsedOrgs.has(org)) collapsedOrgs.delete(org);
    else collapsedOrgs.add(org);
    renderResults();
  });

  loadResults();
});

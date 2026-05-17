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
  const positionSummary = document.getElementById('positionSummary');
  const analyticsGrid = document.getElementById('analyticsGrid');
  const orgFilterTabs = document.getElementById('orgFilterTabs');
  const orgLegendGrid = document.getElementById('orgLegendGrid');
  const totalVotesCenter = document.getElementById('totalVotesCenter');

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
  let posBarChart = null;

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
        <div class="org-legend-item">
          <span class="legend-dot" style="background:${ORG_COLORS[org.organization] || '#6b7280'}"></span>
          <strong>${esc(org.organization)}</strong>
          <span>${Number(org.total_votes || 0).toLocaleString()}</span>
        </div>
      `).join('');
    }

    const orgCanvas = document.getElementById('orgPie');
    if (orgCanvas) {
      if (orgPieChart) orgPieChart.destroy();
      orgPieChart = new Chart(orgCanvas, {
        type: 'doughnut',
        data: {
          labels: orgLabels,
          datasets: [{
            data: orgValues.length ? orgValues : [1],
            backgroundColor: orgLabels.length ? orgLabels.map(label => ORG_COLORS[label] || '#6b7280') : ['#d1d5db'],
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

    const positionTotals = new Map();
    orgs.forEach(org => {
      org.positions.forEach(pos => {
        positionTotals.set(pos.position, (positionTotals.get(pos.position) || 0) + pos.total_votes);
      });
    });

    const positions = Array.from(positionTotals.entries())
      .sort((a, b) => {
        const ka = positionSortKey('USG', a[0]);
        const kb = positionSortKey('USG', b[0]);
        if (ka[0] !== kb[0]) return ka[0] - kb[0];
        return ka[1].localeCompare(kb[1]);
      });

    const posCanvas = document.getElementById('posBar');
    if (posCanvas) {
      if (posBarChart) posBarChart.destroy();
      posBarChart = new Chart(posCanvas, {
        type: 'bar',
        data: {
          labels: positions.map(([name]) => name),
          datasets: [{
            label: 'Votes',
            data: positions.map(([, value]) => value),
            backgroundColor: '#111827',
            borderColor: '#111827',
            borderWidth: 1,
            borderRadius: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { color: 'rgba(17,24,39,0.08)' },
              ticks: { color: '#4b5563', maxRotation: 45, autoSkip: false },
            },
            y: {
              beginAtZero: true,
              precision: 0,
              grid: { color: 'rgba(17,24,39,0.10)' },
              ticks: { color: '#4b5563' },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#030712',
              borderColor: '#22c55e',
              borderWidth: 1,
              titleColor: '#f9fafb',
              bodyColor: '#d1d5db',
            },
          },
        },
      });
    }
  }

  function renderAnalytics(orgs) {
    if (!analyticsGrid) return;
    const allPositions = orgs.flatMap(org => org.positions.map(pos => ({ ...pos, org: org.organization })));
    const totalVotes = orgs.reduce((sum, org) => sum + org.total_votes, 0);
    const most = allPositions.slice().sort((a, b) => b.total_votes - a.total_votes)[0];
    const least = allPositions.slice().sort((a, b) => a.total_votes - b.total_votes)[0];
    const skipped = allPositions.filter(pos => Number(pos.total_votes || 0) === 0).length;
    const totalCandidates = allPositions.reduce((sum, pos) => sum + pos.candidates.length, 0);
    const avgVotes = allPositions.length ? totalVotes / allPositions.length : 0;

    analyticsGrid.innerHTML = `
      <div class="analytics-card">
        <div class="analytics-icon"><i class="bi bi-people-fill"></i></div>
        <div>
          <div class="analytics-label">Total Vote Marks</div>
          <div class="analytics-value">${totalVotes.toLocaleString()}</div>
        </div>
      </div>
      <div class="analytics-card">
        <div class="analytics-icon"><i class="bi bi-person-badge"></i></div>
        <div>
          <div class="analytics-label">Candidates</div>
          <div class="analytics-value">${totalCandidates.toLocaleString()}</div>
        </div>
      </div>
      <div class="analytics-card">
        <div class="analytics-icon"><i class="bi bi-check2-square"></i></div>
        <div>
          <div class="analytics-label">Position Participation</div>
          <div class="analytics-line"><span>Most Voted</span><strong>${esc(most ? `${most.org} · ${most.position}` : 'Not enough data yet')}</strong></div>
          <div class="analytics-line"><span>Least Voted</span><strong>${esc(least ? `${least.org} · ${least.position}` : 'Not enough data yet')}</strong></div>
          <div class="analytics-line"><span>Skipped Positions</span><strong>${skipped} (${allPositions.length ? ((skipped / allPositions.length) * 100).toFixed(1) : '0.0'}%)</strong></div>
        </div>
      </div>
      <div class="analytics-card">
        <div class="analytics-icon"><i class="bi bi-activity"></i></div>
        <div>
          <div class="analytics-label">Voting Trend</div>
          <div class="analytics-value">${avgVotes.toFixed(1)}</div>
          <div class="analytics-muted">average vote marks per position</div>
        </div>
      </div>
    `;
  }

  function renderTabs(orgs) {
    if (!orgFilterTabs) return;
    const tabs = ['ALL', ...orgs.map(org => org.organization)];
    orgFilterTabs.innerHTML = tabs.map(tab => `
      <button type="button" class="org-filter-btn ${activeOrg === tab ? 'active' : ''}" data-org-filter="${esc(tab)}">${esc(tab)}</button>
    `).join('');
  }

  function renderPositionSummary(orgs) {
    if (!positionSummary) return;
    const shown = activeOrg === 'ALL' ? orgs : orgs.filter(org => org.organization === activeOrg);
    const positionTotals = new Map();
    shown.forEach(org => {
      org.positions.forEach(pos => {
        positionTotals.set(pos.position, (positionTotals.get(pos.position) || 0) + pos.total_votes);
      });
    });
    const rows = Array.from(positionTotals.entries())
      .sort((a, b) => {
        const ka = positionSortKey('USG', a[0]);
        const kb = positionSortKey('USG', b[0]);
        if (ka[0] !== kb[0]) return ka[0] - kb[0];
        return ka[1].localeCompare(kb[1]);
      });
    const max = Math.max(1, ...rows.map(([, votes]) => votes));
    positionSummary.innerHTML = `
      <section class="results-panel mb-4">
        <div class="panel-title">Votes by Position</div>
        <div class="position-summary-list">
          ${rows.map(([position, votes]) => {
            const pct = max > 0 ? (votes / max) * 100 : 0;
            return `
              <div class="position-summary-item">
                <div class="position-summary-row"><strong>${esc(position)}</strong><span>${Number(votes || 0).toLocaleString()} votes</span></div>
                <div class="summary-track"><div class="summary-fill" style="width:${pct}%"></div></div>
              </div>
            `;
          }).join('') || '<div class="text-muted">No position data.</div>'}
        </div>
      </section>
    `;
  }

  function candidateRow(candidate, totalPositionVotes, rank, positionName) {
    const name = candidate.name || candidate.student_id || 'Unknown';
    const photo = candidate.photo_url && String(candidate.photo_url).startsWith('http') ? candidate.photo_url : '';
    const votes = Number(candidate.votes || 0);
    const isRepresentative = String(positionName || candidate.position || '').toUpperCase().includes('REPRESENTATIVE');
    const pct = isRepresentative
      ? (votes > 0 ? 100 : 0)
      : (totalPositionVotes > 0 ? (votes / totalPositionVotes) * 100 : 0);
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
    const shown = activeOrg === 'ALL' ? normalizedOrgs : normalizedOrgs.filter(org => org.organization === activeOrg);
    if (!shown.length) {
      if (resultsEmpty) resultsEmpty.style.display = 'block';
      resultsContainer.innerHTML = '';
      renderPositionSummary([]);
      return;
    }

    if (resultsEmpty) resultsEmpty.style.display = 'none';
    renderTabs(normalizedOrgs);
    renderPositionSummary(normalizedOrgs);

    resultsContainer.innerHTML = shown.map(org => `
      <section class="result-org-card result-org-${esc(org.organization.toLowerCase())}">
        <button type="button" class="result-org-head" data-toggle-org="${esc(org.organization)}" aria-expanded="${collapsedOrgs.has(org.organization) ? 'false' : 'true'}">
          <div>
            <div class="result-org-title">${esc(org.organization)}</div>
            <div class="result-org-votes">${Number(org.total_votes || 0).toLocaleString()} votes</div>
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
                  ${pos.candidates.map((candidate, index) => candidateRow(candidate, totalPositionVotes, index + 1, pos.position)).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `).join('');
  }

  async function loadResults(){
    try {
      const res = await fetch('/api/admin/results/', { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json();
      if (!data || !data.ok) {
        if (resultsEmpty) resultsEmpty.style.display = 'block';
        return;
      }

      normalizedOrgs = toOrgFirst(data.grouped || []);
      renderCharts(normalizedOrgs);
      renderAnalytics(normalizedOrgs);
      renderResults();
    } catch (e) {
      if (resultsEmpty) resultsEmpty.style.display = 'block';
    }
  }

  orgFilterTabs?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-org-filter]');
    if (!btn) return;
    activeOrg = btn.dataset.orgFilter || 'ALL';
    renderResults();
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

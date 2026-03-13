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

  const palette = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#84cc16','#a855f7','#22c55e','#eab308'];
  const orgColorMap = {
    SITE: '#800000',
    PAFE: '#2563eb',
    AFPROTECHS: '#ec4899',
  };

  function renderCharts(orgTotals, positionTotals){
    const orgLabels = Object.keys(orgTotals || {});
    const orgValues = Object.values(orgTotals || {});
    const posLabels = Object.keys(positionTotals || {});
    const posValues = Object.values(positionTotals || {});

    const orgCanvas = document.getElementById('orgPie');
    if (orgCanvas && orgValues.length) {
      const orgBg = orgLabels.map((label, i) => orgColorMap[String(label).toUpperCase()] || palette[i % palette.length]);
      new Chart(orgCanvas, {
        type: 'pie',
        data: { labels: orgLabels, datasets: [{ data: orgValues, backgroundColor: orgBg }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }

    const posCanvas = document.getElementById('posBar');
    if (posCanvas && posValues.length) {
      new Chart(posCanvas, {
        type: 'bar',
        data: { labels: posLabels, datasets: [{ label: 'Votes', data: posValues, backgroundColor: '#3b82f6' }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { ticks: { maxRotation: 45, autoSkip: false } }, y: { beginAtZero: true, precision: 0 } },
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  function esc(s){
    return String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  function renderResults(grouped){
    if (!resultsContainer) return;
    if (!grouped || grouped.length === 0) {
      if (resultsEmpty) resultsEmpty.style.display = 'block';
      resultsContainer.innerHTML = '';
      return;
    }

    if (resultsEmpty) resultsEmpty.style.display = 'none';

    let html = '';
    grouped.forEach(party => {
      const partyLogo = party.party_logo_url || '';
      const partyAvatar = partyLogo
        ? `<img src="${esc(partyLogo)}" class="rounded-circle border result-party-logo" alt="">`
        : `<div class="rounded-circle border d-flex align-items-center justify-content-center bg-light result-party-logo-placeholder"><i class="bi bi-flag text-danger"></i></div>`;

      html += `
        <div class="p-2 px-3 bg-light border rounded d-flex align-items-center justify-content-between mt-3">
          <div class="d-flex align-items-center gap-2">${partyAvatar}<span class="fw-semibold">${esc(party.party_name)}</span></div>
          <span class="badge text-bg-secondary">${Number(party.total_votes || 0)} votes</span>
        </div>`;

      (party.organizations || []).forEach(org => {
        html += `
          <div class="ps-2 pt-3 pb-2 d-flex align-items-center gap-2"><i class="bi bi-building text-info"></i><span class="fw-semibold fs-5 text-primary">${esc(org.organization)}</span></div>`;

        (org.positions || []).forEach(pos => {
          html += `
            <div class="ps-4 pt-2 pb-1 small text-muted fw-semibold fs-6 text-primary">${esc(pos.position)}</div>
            <div class="vstack gap-2 ps-3">`;

          (pos.candidates || []).forEach(c => {
            const name = c.name || c.student_id || '';
            const photo = (c.photo_url && String(c.photo_url).startsWith('http')) ? c.photo_url : '';
            const votes = Number(c.votes || 0);
            const pct = Number(c.percent_in_position || 0);

            const avatar = photo
              ? `<img src="${esc(photo)}" class="rounded-circle border candidate-result-photo" alt="">`
              : `<div class="rounded-circle border d-flex align-items-center justify-content-center bg-light candidate-result-photo-placeholder"><i class="bi bi-person text-secondary"></i></div>`;

            html += `
              <div class="p-3 border rounded d-flex align-items-center gap-3 bg-white shadow-sm">
                ${avatar}
                <div class="flex-grow-1">
                  <div class="fw-semibold">${esc(name)}</div>
                  <div class="small text-muted">${esc(c.program || '')} ${esc(c.year_section || '')}</div>
                  <div class="progress mt-2 result-progress">
                    <div class="progress-bar bg-primary" role="progressbar" style="width: ${pct}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                  </div>
                </div>
                <div class="text-end result-votes-col">
                  <div class="fw-semibold text-primary">${votes} vote${votes===1?'':'s'}</div>
                  <div class="small text-muted">${pct.toFixed(1)}%</div>
                </div>
              </div>`;
          });

          html += `</div>`;
        });
      });
    });

    resultsContainer.innerHTML = html;
  }

  async function loadResults(){
    try {
      const res = await fetch('/api/admin/results/', { credentials: 'same-origin' });
      const data = await res.json();
      if (!data || !data.ok) {
        if (resultsEmpty) resultsEmpty.style.display = 'block';
        return;
      }

      renderCharts(data.org_totals || {}, data.position_totals || {});
      renderResults(data.grouped || []);
    } catch (e) {
      if (resultsEmpty) resultsEmpty.style.display = 'block';
    }
  }

  loadResults();
});

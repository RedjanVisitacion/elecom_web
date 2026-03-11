document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const closeSidebar = document.getElementById('closeSidebar');
  const logoutLink = document.getElementById('logoutLink');

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

  const toLogin = () => {
    try {
      sessionStorage.removeItem('elecom_role');
      sessionStorage.removeItem('elecom_user');
    } catch (e) {}
    const base = window.location.origin;
    window.location.href = `${base}/login/`;
  };

  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      toLogin();
    });
  }

  const displayName = document.getElementById('displayName');
  const displayRole = document.getElementById('displayRole');
  try {
    const role = sessionStorage.getItem('elecom_role') || 'admin';
    const user = sessionStorage.getItem('elecom_user') || '';
    if (displayName) displayName.textContent = user || 'Admin';
    if (displayRole) displayRole.textContent = role;
  } catch (e) {}

  const successAlert = document.getElementById('successAlert');
  const errorAlert = document.getElementById('errorAlert');

  function showAlert(el, msg){
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }
  function hideAlert(el){
    if (!el) return;
    el.textContent = '';
    el.style.display = 'none';
  }

  const startEl = document.getElementById('startAt');
  const endEl = document.getElementById('endAt');
  const resultsEl = document.getElementById('resultsAt');
  const noteEl = document.getElementById('note');
  const passwordEl = document.getElementById('adminPassword');
  const formEl = document.getElementById('electionWindowForm');

  async function loadWindow(){
    hideAlert(successAlert);
    hideAlert(errorAlert);
    try {
      const res = await fetch('/api/admin/election-window/', { credentials: 'same-origin' });
      const data = await res.json();
      if (!data || !data.ok) return;
      const w = data.window || {};
      if (startEl) startEl.value = w.start_at_local || '';
      if (endEl) endEl.value = w.end_at_local || '';
      if (resultsEl) resultsEl.value = w.results_at_local || '';
      if (noteEl) noteEl.value = w.note || '';
    } catch (e) {
      // ignore
    }
  }

  if (formEl) {
    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(successAlert);
      hideAlert(errorAlert);

      const payload = {
        start_at: startEl ? startEl.value : '',
        end_at: endEl ? endEl.value : '',
        results_at: resultsEl ? resultsEl.value : '',
        note: noteEl ? noteEl.value : '',
        admin_password: passwordEl ? passwordEl.value : '',
      };

      try {
        const res = await fetch('/api/admin/election-window/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data && data.ok) {
          if (passwordEl) passwordEl.value = '';
          showAlert(successAlert, 'Election window saved.');
          await loadWindow();
        } else {
          showAlert(errorAlert, (data && data.error) ? data.error : 'Failed to save election window.');
        }
      } catch (err) {
        showAlert(errorAlert, 'Failed to save election window.');
      }
    });
  }

  loadWindow();
});

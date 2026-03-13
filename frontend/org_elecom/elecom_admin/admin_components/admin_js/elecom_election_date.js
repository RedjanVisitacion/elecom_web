document.addEventListener('DOMContentLoaded', function() {
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

  const successAlert = document.getElementById('successAlert');
  const errorAlert = document.getElementById('errorAlert');
  const formEl = document.getElementById('electionWindowForm');
  const submitBtn = formEl ? formEl.querySelector('button[type="submit"]') : null;

  function showAlert(el, msg){
    if (!el) return;
    if (el === successAlert) hideAlert(errorAlert);
    if (el === errorAlert) hideAlert(successAlert);
    el.textContent = msg;
    el.style.display = 'block';
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {}
  }
  function hideAlert(el){
    if (!el) return;
    el.textContent = '';
    el.style.display = 'none';
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = !!loading;
    if (loading) {
      submitBtn.dataset.originalText = submitBtn.dataset.originalText || submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Saving...';
    } else {
      submitBtn.innerHTML = submitBtn.dataset.originalText || 'Save Dates';
    }
  }

  const startEl = document.getElementById('startAt');
  const endEl = document.getElementById('endAt');
  const resultsEl = document.getElementById('resultsAt');
  const noteEl = document.getElementById('note');
  const passwordEl = document.getElementById('adminPassword');
  

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

      setLoading(true);

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
        const data = await res.json().catch(() => ({}));
        if (res.ok && data && data.ok) {
          if (passwordEl) passwordEl.value = '';
          showAlert(successAlert, 'Election window saved.');
          await loadWindow();
        } else {
          showAlert(errorAlert, (data && data.error) ? data.error : 'Failed to save election window.');
        }
      } catch (err) {
        showAlert(errorAlert, (err && err.message) ? String(err.message) : 'Failed to save election window.');
      } finally {
        setLoading(false);
      }
    });
  }

  loadWindow();
});

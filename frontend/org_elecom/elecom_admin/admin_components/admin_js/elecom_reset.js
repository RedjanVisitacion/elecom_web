document.addEventListener('DOMContentLoaded', function(){
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

  const votesCountEl = document.getElementById('votesCount');
  const voteItemsCountEl = document.getElementById('voteItemsCount');
  const notifCountEl = document.getElementById('notifCount');

  async function loadStatus(){
    hideAlert(successAlert);
    hideAlert(errorAlert);
    try {
      const res = await fetch('/api/admin/reset/status/', { credentials: 'same-origin' });
      const data = await res.json();
      if (!data || !data.ok) return;
      if (votesCountEl) votesCountEl.textContent = String(data.counts?.votes ?? 0);
      if (voteItemsCountEl) voteItemsCountEl.textContent = String(data.counts?.vote_items ?? 0);
      if (notifCountEl) notifCountEl.textContent = String(data.counts?.notifications ?? 0);
    } catch (e) {
      // ignore
    }
  }

  const resetVotesForm = document.getElementById('resetVotesForm');
  const resetConfirmEl = document.getElementById('resetConfirm');
  const clearNotifForm = document.getElementById('clearNotifForm');
  const clearConfirmEl = document.getElementById('clearConfirm');

  if (resetVotesForm) {
    resetVotesForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(successAlert);
      hideAlert(errorAlert);
      const confirmText = (resetConfirmEl?.value || '').trim();
      if (confirmText.toUpperCase() !== 'RESET') {
        showAlert(errorAlert, 'Type RESET to confirm.');
        return;
      }
      if (!confirm('This will permanently delete all votes. Continue?')) return;

      try {
        const res = await fetch('/api/admin/reset/votes/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ confirm: confirmText }),
        });
        const data = await res.json();
        if (data && data.ok) {
          if (resetConfirmEl) resetConfirmEl.value = '';
          showAlert(successAlert, 'All votes have been reset.');
          await loadStatus();
        } else {
          showAlert(errorAlert, (data && data.error) ? data.error : 'Failed to reset votes.');
        }
      } catch (err) {
        showAlert(errorAlert, 'Failed to reset votes.');
      }
    });
  }

  if (clearNotifForm) {
    clearNotifForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(successAlert);
      hideAlert(errorAlert);
      const confirmText = (clearConfirmEl?.value || '').trim();
      if (confirmText.toUpperCase() !== 'CLEAR') {
        showAlert(errorAlert, 'Type CLEAR to confirm notifications reset.');
        return;
      }
      if (!confirm('This will permanently delete all notifications in user_notifications. Continue?')) return;

      try {
        const res = await fetch('/api/admin/reset/notifications/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ confirm: confirmText }),
        });
        const data = await res.json();
        if (data && data.ok) {
          if (clearConfirmEl) clearConfirmEl.value = '';
          showAlert(successAlert, 'All notifications have been cleared.');
          await loadStatus();
        } else {
          showAlert(errorAlert, (data && data.error) ? data.error : 'Failed to clear notifications.');
        }
      } catch (err) {
        showAlert(errorAlert, 'Failed to clear notifications.');
      }
    });
  }

  loadStatus();
});

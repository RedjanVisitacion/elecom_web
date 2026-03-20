(function () {
    'use strict';

    const API_BASE = '/api/admin/reset';

    function getCsrfToken() {
        const match = document.cookie.match(/csrftoken=([^;]+)/);
        return match ? match[1] : '';
    }

    async function fetchStatus() {
        try {
            const res = await fetch(`${API_BASE}/status/`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (data && data.ok) {
                updateStatusDisplay(data.counts);
            }
        } catch (err) {
            console.error('Failed to load reset status:', err);
        }
    }

    function updateStatusDisplay(counts) {
        const votesEl = document.getElementById('votesCount');
        const itemsEl = document.getElementById('voteItemsCount');
        const notifsEl = document.getElementById('notificationsCount');

        if (votesEl) votesEl.textContent = formatNumber(counts?.votes ?? 0);
        if (itemsEl) itemsEl.textContent = formatNumber(counts?.vote_items ?? 0);
        if (notifsEl) notifsEl.textContent = formatNumber(counts?.notifications ?? 0);
    }

    function formatNumber(n) {
        if (typeof n !== 'number') return '-';
        return n.toLocaleString();
    }

    function showAlert(id, message) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = message;
        el.style.display = 'block';
        setTimeout(() => {
            el.style.display = 'none';
            el.textContent = '';
        }, 5000);
    }

    function showSuccess(message) {
        showAlert('successAlert', message);
    }

    function showError(message) {
        showAlert('errorAlert', message);
    }

    function setStatusMessage(message, type) {
        const el = document.getElementById('resetStatus');
        if (!el) return;
        el.textContent = message;
        el.style.display = 'block';
        el.className = 'small mt-3 ' + (type === 'success' ? 'text-success' : type === 'error' ? 'text-danger' : 'text-muted');
    }

    function clearStatusMessage() {
        const el = document.getElementById('resetStatus');
        if (!el) return;
        el.style.display = 'none';
        el.textContent = '';
    }

    async function resetVotes() {
        const confirmInput = document.getElementById('confirmInput');
        const btn = document.getElementById('resetVotesBtn');
        const confirmText = (confirmInput?.value || '').trim();

        if (confirmText !== 'RESET') {
            showError('Please type RESET to confirm.');
            confirmInput?.focus();
            return;
        }

        if (!window.confirm('Are you sure you want to permanently delete all vote records? This action cannot be undone.')) {
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Resetting...';
        clearStatusMessage();

        try {
            const res = await fetch(`${API_BASE}/votes/`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({ confirm: 'RESET' })
            });

            const data = await res.json();

            if (res.ok && data.ok) {
                showSuccess('All votes have been reset successfully.');
                setStatusMessage('Votes reset completed.', 'success');
                confirmInput.value = '';
                await fetchStatus();
            } else {
                const msg = data?.error || 'Failed to reset votes.';
                showError(msg);
                setStatusMessage(msg, 'error');
            }
        } catch (err) {
            console.error('Reset votes error:', err);
            showError('Network error. Please try again.');
            setStatusMessage('Network error. Please try again.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-trash me-2"></i>Reset All Votes';
        }
    }

    function init() {
        fetchStatus();

        const resetBtn = document.getElementById('resetVotesBtn');
        const confirmInput = document.getElementById('confirmInput');

        if (resetBtn) {
            resetBtn.addEventListener('click', resetVotes);
        }

        if (confirmInput) {
            confirmInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    resetVotes();
                }
            });
        }
    }

    window.resetVotes = resetVotes;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

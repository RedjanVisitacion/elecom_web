document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const closeSidebar = document.getElementById('closeSidebar');
    const logoutLink = document.getElementById('logoutLink');
    const modalLogout = document.getElementById('modalLogout');
    const electionHelperText = document.getElementById('electionHelperText');
    const ecDays = document.getElementById('ec_days');
    const ecHours = document.getElementById('ec_hours');
    const ecMins = document.getElementById('ec_mins');
    const ecSecs = document.getElementById('ec_secs');

    const toLogin = () => {
        try {
            sessionStorage.removeItem('elecom_role');
            sessionStorage.removeItem('elecom_user');
        } catch (e) { /* ignore */ }
        const base = window.location.origin;
        window.location.href = `${base}/login/`;
    };

    if (logoutLink) logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        toLogin();
    });
    if (modalLogout) modalLogout.addEventListener('click', (e) => {
        e.preventDefault();
        toLogin();
    });

    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            if (sidebar) sidebar.classList.add('active');
            if (sidebarOverlay) sidebarOverlay.classList.add('active');
        });
    }

    if (closeSidebar) {
        closeSidebar.addEventListener('click', function() {
            if (sidebar) sidebar.classList.remove('active');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            if (sidebar) sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        });
    }

    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 992) {
                if (sidebar) sidebar.classList.remove('active');
                if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            }
        });
    });

    window.addEventListener('resize', function() {
        if (window.innerWidth > 992) {
            if (sidebar) sidebar.classList.remove('active');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        }
    });

    const pad2 = (n) => String(Math.max(0, Math.floor(Number(n) || 0))).padStart(2, '0');

    const setCountdown = (totalSeconds) => {
        const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        const days = Math.floor(s / 86400);
        const hours = Math.floor((s % 86400) / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;
        if (ecDays) ecDays.textContent = pad2(days);
        if (ecHours) ecHours.textContent = pad2(hours);
        if (ecMins) ecMins.textContent = pad2(mins);
        if (ecSecs) ecSecs.textContent = pad2(secs);
    };

    let countdownTimer = null;
    const startCountdown = ({ start_at, end_at }) => {
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }

        const start = start_at ? new Date(start_at) : null;
        const end = end_at ? new Date(end_at) : null;
        if (!start || !Number.isFinite(start.getTime()) || !end || !Number.isFinite(end.getTime())) {
            setCountdown(0);
            return;
        }

        const tick = () => {
            const now = Date.now();
            let target = start.getTime();
            if (now >= start.getTime()) {
                target = end.getTime();
            }
            const diffSec = Math.max(0, Math.floor((target - now) / 1000));
            setCountdown(diffSec);
        };

        tick();
        countdownTimer = setInterval(tick, 1000);
    };

    const setElectionTexts = (election) => {
        if (!electionHelperText) return;
        const status = election && election.status ? String(election.status) : 'No schedule';

        if (status === 'No schedule') {
            electionHelperText.textContent = 'Set the election schedule in Set Election Dates.';
            return;
        }

        if (status === 'Upcoming') {
            electionHelperText.textContent = 'Election is upcoming. Countdown shows time until voting starts.';
            return;
        }

        if (status === 'Active') {
            electionHelperText.textContent = 'Election is active. Countdown shows time until voting ends.';
            return;
        }

        if (status === 'Closed') {
            electionHelperText.textContent = 'Voting window ended.';
            return;
        }

        electionHelperText.textContent = status;
    };

    const loadElectionWindow = async () => {
        try {
            const res = await fetch('/api/election/window/', {
                method: 'GET',
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) return;
            const e = data.election || {};
            setElectionTexts(e);
            startCountdown({ start_at: e.start_at, end_at: e.end_at });
        } catch (e) {
        }
    };

    void loadElectionWindow();
});

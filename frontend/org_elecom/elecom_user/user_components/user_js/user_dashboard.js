document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const closeSidebar = document.getElementById('closeSidebar');
    const logoutLink = document.getElementById('logoutLink');
    const userMenu = document.getElementById('userMenu');
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userMenuDropdown = document.getElementById('userMenuDropdown');
    const userMenuLogoutLink = document.getElementById('userMenuLogoutLink');
    const menuName = document.getElementById('menuName');
    const menuRole = document.getElementById('menuRole');
    const userAvatarImg = document.getElementById('userAvatarImg');
    const userAvatarIcon = document.getElementById('userAvatarIcon');
    const menuAvatarImg = document.getElementById('menuAvatarImg');
    const menuAvatarIcon = document.getElementById('menuAvatarIcon');
    const notifBell = document.getElementById('notifBell');
    const notifCount = document.getElementById('notifCount');
    const systemStatusBadge = document.getElementById('systemStatusBadge');
    const systemStatusText = document.getElementById('systemStatusText');
    const modalLogout = document.getElementById('modalLogout');
    const electionHelperText = document.getElementById('electionHelperText');
    const ecDays = document.getElementById('ec_days');
    const ecHours = document.getElementById('ec_hours');
    const ecMins = document.getElementById('ec_mins');
    const ecSecs = document.getElementById('ec_secs');

    const API_PROFILE = '/api/account/profile/';

    const NET_LEVELS = {
        HIGH: 'high',
        LOW: 'low',
        OFFLINE: 'offline',
    };

    const toLogin = () => {
        try {
            sessionStorage.removeItem('elecom_role');
            sessionStorage.removeItem('elecom_user');
        } catch (e) { /* ignore */ }
        const base = window.location.origin;
        window.location.href = `${base}/login/`;
    };

    const setNotifCount = (count) => {
        if (!notifCount) return;
        const n = Number(count || 0);
        const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
        notifCount.textContent = String(safe);
        notifCount.style.display = safe > 0 ? 'inline-block' : 'none';
        notifCount.setAttribute('aria-label', `${safe} unread notifications`);
    };

    const setNetworkUi = ({ level }) => {
        if (!systemStatusBadge || !systemStatusText) return;
        systemStatusBadge.classList.remove('is-high', 'is-low', 'is-offline');

        if (level === NET_LEVELS.OFFLINE) {
            systemStatusBadge.classList.add('is-offline');
            systemStatusText.textContent = 'Network Offline';
            systemStatusBadge.setAttribute('title', 'No network connection');
            return;
        }

        if (level === NET_LEVELS.LOW) {
            systemStatusBadge.classList.add('is-low');
            systemStatusText.textContent = 'Network Low';
            systemStatusBadge.setAttribute('title', 'Weak/slow connection');
            return;
        }

        systemStatusBadge.classList.add('is-high');
        systemStatusText.textContent = 'Network High';
        systemStatusBadge.setAttribute('title', 'Good connection');
    };

    const getNetworkLevelFromConnectionApi = () => {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!conn) return null;

        const effectiveType = String(conn.effectiveType || '').toLowerCase();
        const downlink = Number(conn.downlink);
        const rtt = Number(conn.rtt);

        if (effectiveType && effectiveType !== '4g') return NET_LEVELS.LOW;
        if (Number.isFinite(downlink) && downlink > 0 && downlink < 2.0) return NET_LEVELS.LOW;
        if (Number.isFinite(rtt) && rtt > 180) return NET_LEVELS.LOW;

        return NET_LEVELS.HIGH;
    };

    const pingLatencyMs = async () => {
        const url = new URL(API_PROFILE, window.location.origin);
        url.searchParams.set('_ping', String(Date.now()));

        const controller = new AbortController();
        const t0 = performance.now();
        const timer = setTimeout(() => controller.abort(), 3500);

        try {
            await fetch(url.toString(), {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal,
            });
            return performance.now() - t0;
        } finally {
            clearTimeout(timer);
        }
    };

    const getNetworkLevel = async () => {
        if (!navigator.onLine) return NET_LEVELS.OFFLINE;

        const fromConn = getNetworkLevelFromConnectionApi();
        if (fromConn === NET_LEVELS.LOW) return NET_LEVELS.LOW;

        try {
            const ms = await pingLatencyMs();
            if (Number.isFinite(ms) && ms > 1200) return NET_LEVELS.LOW;
        } catch (e) {
            return NET_LEVELS.OFFLINE;
        }

        return NET_LEVELS.HIGH;
    };

    let netRefreshTimer = null;
    const refreshNetworkUi = async () => {
        const level = await getNetworkLevel();
        setNetworkUi({ level });
    };

    const startNetworkWatch = () => {
        if (!systemStatusBadge || !systemStatusText) return;
        if (netRefreshTimer) clearInterval(netRefreshTimer);
        refreshNetworkUi();
        netRefreshTimer = setInterval(refreshNetworkUi, 8000);
        window.addEventListener('online', refreshNetworkUi);
        window.addEventListener('offline', refreshNetworkUi);

        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn && typeof conn.addEventListener === 'function') {
            conn.addEventListener('change', refreshNetworkUi);
        }
    };

    const applyProfileName = (data) => {
        if (!data || !data.ok) return;
        const user = data.user || {};
        const student = data.student || {};

        const firstName = student.first_name || user.first_name || '';
        const middleName = student.middle_name || user.middle_name || '';
        const lastName = student.last_name || user.last_name || '';
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
        if (!fullName) return;

        if (menuName) menuName.textContent = fullName;

        try {
            sessionStorage.setItem('elecom_user', fullName);
        } catch (e) { /* ignore */ }
    };

    const setAvatarUrl = (url) => {
        const u = String(url || '').trim();
        const has = !!(u && /^https?:\/\//i.test(u));

        if (userAvatarImg) {
            userAvatarImg.src = has ? u : '';
            userAvatarImg.style.display = has ? 'block' : 'none';
        }
        if (menuAvatarImg) {
            menuAvatarImg.src = has ? u : '';
            menuAvatarImg.style.display = has ? 'block' : 'none';
        }
        if (userAvatarIcon) userAvatarIcon.style.display = has ? 'none' : 'inline-block';
        if (menuAvatarIcon) menuAvatarIcon.style.display = has ? 'none' : 'inline-block';

        try {
            if (has) sessionStorage.setItem('elecom_user_photo_url', u);
            else sessionStorage.removeItem('elecom_user_photo_url');
        } catch (e) { /* ignore */ }
    };

    const loadAccountProfileName = async () => {
        try {
            const res = await fetch('/api/account/profile/', { method: 'GET', headers: { Accept: 'application/json' } });
            if (!res.ok) return;
            const data = await res.json().catch(() => ({}));
            applyProfileName(data);

            const photoUrl = data && data.user ? data.user.photo_url : '';
            if (photoUrl) setAvatarUrl(photoUrl);
        } catch (e) { /* ignore */ }
    };

    const setMenuOpen = (open) => {
        if (!userMenuDropdown) return;
        if (open) userMenuDropdown.setAttribute('data-open', '1');
        else userMenuDropdown.removeAttribute('data-open');

        if (userMenuToggle) userMenuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    if (userMenuToggle && userMenuDropdown) {
        userMenuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const isOpen = userMenuDropdown.getAttribute('data-open') === '1';
            setMenuOpen(!isOpen);
        });
    }

    document.addEventListener('click', (e) => {
        if (!userMenuDropdown || !userMenu) return;
        if (userMenuDropdown.getAttribute('data-open') !== '1') return;
        if (!userMenu.contains(e.target)) {
            setMenuOpen(false);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        setMenuOpen(false);
    });

    if (logoutLink) logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        toLogin();
    });
    if (userMenuLogoutLink) userMenuLogoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        toLogin();
    });
    if (modalLogout) modalLogout.addEventListener('click', (e) => {
        e.preventDefault();
        toLogin();
    });

    try {
        const role = (sessionStorage.getItem('elecom_role') || 'student').trim() || 'student';
        const user = (sessionStorage.getItem('elecom_user') || '').trim();
        if (menuName) menuName.textContent = user || 'Student';
        if (menuRole) menuRole.textContent = role;

        const cachedPhoto = (sessionStorage.getItem('elecom_user_photo_url') || '').trim();
        if (cachedPhoto) setAvatarUrl(cachedPhoto);
    } catch (e) { /* ignore */ }

    setNotifCount(0);

    if (notifBell) {
        notifBell.addEventListener('click', (e) => {
            e.preventDefault();
            // Placeholder until notifications feature exists
        });
    }

    startNetworkWatch();

    void loadAccountProfileName();

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

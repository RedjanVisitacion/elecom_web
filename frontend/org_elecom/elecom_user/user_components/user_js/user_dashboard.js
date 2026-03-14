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
    const greetingName = document.getElementById('greetingName');
    const electionStatus = document.getElementById('electionStatus');
    const electionCalendar = document.getElementById('electionCalendar');
    const omnibusSlideshow = document.getElementById('omnibusSlideshow');
    const omnibusPreview = document.getElementById('omnibusPreview');
    const omnibusSlideImg = document.getElementById('omnibusSlideImg');
    const omnibusPrev = document.getElementById('omnibusPrev');
    const omnibusNext = document.getElementById('omnibusNext');
    const omnibusDots = document.getElementById('omnibusDots');
    const omnibusLightbox = document.getElementById('omnibusLightbox');
    const omnibusLightboxBackdrop = document.getElementById('omnibusLightboxBackdrop');
    const omnibusLightboxClose = document.getElementById('omnibusLightboxClose');
    const omnibusLightboxImg = document.getElementById('omnibusLightboxImg');
    const votingStatusContent = document.getElementById('votingStatusContent');
    const ecDays = document.getElementById('ec_days');
    const ecHours = document.getElementById('ec_hours');
    const ecMins = document.getElementById('ec_mins');
    const ecSecs = document.getElementById('ec_secs');

    const API_PROFILE = '/api/account/profile/';
    const API_VOTE_STATUS = '/api/vote/status/';

    const NET_LEVELS = {
        HIGH: 'high',
        LOW: 'low',
        OFFLINE: 'offline',
    };

    const initOmnibusSlideshow = () => {
        if (!omnibusSlideshow || !omnibusSlideImg || !omnibusDots) return;

        const base = '/static/assets/omnibus/';
        const slides = Array.from({ length: 14 }, (_, i) => `${base}page${String(i + 1).padStart(2, '0')}.jpg`);
        const slideCount = slides.length;
        let idx = 0;
        let timer = null;
        let idleTimer = null;

        const renderDots = () => {
            omnibusDots.innerHTML = '';
            Array.from({ length: slideCount }, (_, i) => i).forEach((i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `omnibus-dot${i === idx ? ' is-active' : ''}`;
                b.setAttribute('aria-label', `Slide ${i + 1}`);
                b.addEventListener('click', () => {
                    setIndex(i);
                    restart();
                });
                omnibusDots.appendChild(b);
            });
        };

        const setIndex = (i) => {
            const safe = Number.isFinite(i) ? i : 0;
            idx = (safe + slideCount) % slideCount;
            const url = slides[idx] || '';
            omnibusSlideImg.src = url;
            if (omnibusLightboxImg && omnibusLightbox && omnibusLightbox.classList.contains('is-open')) {
                omnibusLightboxImg.src = url;
            }
            renderDots();
        };

        const next = () => setIndex(idx + 1);
        const prev = () => setIndex(idx - 1);

        const restart = () => {
            if (timer) clearInterval(timer);
            timer = setInterval(next, 4500);
        };

        const setActive = () => {
            omnibusSlideshow.classList.remove('is-idle');
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                omnibusSlideshow.classList.add('is-idle');
            }, 1200);
        };

        const openLightbox = () => {
            if (!omnibusLightbox || !omnibusLightboxImg) return;
            omnibusLightboxImg.src = slides[idx] || '';
            omnibusLightbox.classList.add('is-open');
            omnibusLightbox.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        };

        const closeLightbox = () => {
            if (!omnibusLightbox) return;
            omnibusLightbox.classList.remove('is-open');
            omnibusLightbox.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        };

        if (omnibusNext) omnibusNext.addEventListener('click', () => { next(); restart(); });
        if (omnibusPrev) omnibusPrev.addEventListener('click', () => { prev(); restart(); });

        omnibusSlideshow.addEventListener('mousemove', () => setActive());
        omnibusSlideshow.addEventListener('mouseenter', () => setActive());
        omnibusSlideshow.addEventListener('mouseleave', () => omnibusSlideshow.classList.add('is-idle'));

        if (omnibusPreview) {
            omnibusPreview.addEventListener('click', () => openLightbox());
            omnibusPreview.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLightbox();
                }
            });
        }

        if (omnibusLightboxBackdrop) omnibusLightboxBackdrop.addEventListener('click', () => closeLightbox());
        if (omnibusLightboxClose) omnibusLightboxClose.addEventListener('click', () => closeLightbox());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeLightbox();
        });

        omnibusSlideshow.addEventListener('mouseenter', () => { if (timer) clearInterval(timer); });
        omnibusSlideshow.addEventListener('mouseleave', () => restart());

        setIndex(0);
        restart();
        omnibusSlideshow.classList.add('is-idle');
    };

    const formatVoteTimestamp = (iso) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return String(iso);
            return d.toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch (e) {
            return String(iso);
        }
    };

    const renderVotingStatus = ({ voted, voted_at }) => {
        if (!votingStatusContent) return;

        if (voted) {
            const ts = formatVoteTimestamp(voted_at);
            votingStatusContent.innerHTML = `
                <div class="voting-status-icon text-success"><i class="bi bi-check-circle-fill"></i></div>
                <div class="voting-status-title">Vote Cast Successfully</div>
                <div class="voting-status-meta">Recorded: ${ts || '—'}</div>
            `;
            return;
        }

        votingStatusContent.innerHTML = `
            <div class="voting-status-icon text-danger"><i class="bi bi-x-circle-fill"></i></div>
            <div class="voting-status-title">You haven’t voted yet</div>
            <div class="voting-status-meta">Cast your vote while the election is active.</div>
        `;
    };

    const initVotingStatus = async () => {
        if (!votingStatusContent) return;
        votingStatusContent.innerHTML = '<div class="voting-status-meta">Loading status...</div>';

        try {
            const res = await fetch(API_VOTE_STATUS, { method: 'GET', cache: 'no-store' });
            const data = await res.json();
            if (!res.ok || !data || data.ok !== true) throw new Error((data && data.error) || 'Failed');
            renderVotingStatus({ voted: !!data.voted, voted_at: data.voted_at || null });
        } catch (e) {
            votingStatusContent.innerHTML = '<div class="voting-status-meta">Unable to load voting status.</div>';
        }
    };

    const toLogin = () => {
        try {
            sessionStorage.removeItem('elecom_role');
            sessionStorage.removeItem('elecom_user');
        } catch (e) { /* ignore */ }
        const base = window.location.origin;
        window.location.href = `${base}/login/`;
    };

    initVotingStatus();

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
        if (greetingName) greetingName.textContent = fullName;

        try {
            sessionStorage.setItem('elecom_user', fullName);
        } catch (e) { /* ignore */ }
    };

    const setElectionBadge = (status, statusClass) => {
        if (!electionStatus) return;
        const cls = statusClass || 'secondary';
        electionStatus.className = `badge bg-${cls}`;
        electionStatus.textContent = status || 'No schedule';
    };

    const dateOnlyKey = (d) => {
        if (!d || !Number.isFinite(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const getElectionResultIso = (election) => {
        const iso = election && (election.result_at || election.result_date || election.results_at);
        if (iso) {
            const d = new Date(iso);
            if (Number.isFinite(d.getTime())) return iso;
        }

        const endIso = election && election.end_at;
        if (!endIso) return '';
        const end = new Date(endIso);
        if (!Number.isFinite(end.getTime())) return '';

        const r = new Date(end);
        r.setDate(r.getDate() + 1);
        return r.toISOString();
    };

    const renderElectionCalendar = (startIso, endIso, resultIso) => {
        if (!electionCalendar) return;
        const start = startIso ? new Date(startIso) : null;
        const end = endIso ? new Date(endIso) : null;
        if (!start || !end || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
            electionCalendar.style.display = 'none';
            electionCalendar.innerHTML = '';
            return;
        }

        const WHITE = '#ffffff';
        const BLUE = '#1D4ED8';
        const YELLOW = '#FACC15';
        const RED = '#DC2626';
        const GRAY = '#E0E0E0';

        const result = resultIso ? new Date(resultIso) : null;
        const resultKey = result && Number.isFinite(result.getTime()) ? dateOnlyKey(result) : '';

        const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
        const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        const firstDow = monthStart.getDay();
        const daysInMonth = monthEnd.getDate();

        const startKey = dateOnlyKey(start);
        const endKey = dateOnlyKey(end);
        const todayKey = dateOnlyKey(new Date());

        const monthLabel = monthStart.toLocaleString(undefined, { month: 'long', year: 'numeric' });

        let html = '';
        html += `<div class="d-flex align-items-center justify-content-between mb-1">`;
        html += `<div class="fw-semibold small">${monthLabel}</div>`;
        html += `</div>`;
        html += `<table class="table table-sm mb-0" style="table-layout: fixed;">`;
        html += `<thead><tr>`;
        ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach((w) => {
            html += `<th class="text-center small text-muted" style="border:0;">${w}</th>`;
        });
        html += `</tr></thead><tbody>`;

        let dayNum = 1;
        for (let row = 0; row < 6; row++) {
            html += `<tr>`;
            for (let col = 0; col < 7; col++) {
                const cellIndex = row * 7 + col;
                if (cellIndex < firstDow || dayNum > daysInMonth) {
                    html += `<td style="border:0;"></td>`;
                    continue;
                }

                const y = monthStart.getFullYear();
                const m = monthStart.getMonth() + 1;
                const k = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isStart = k === startKey;
                const isEnd = k === endKey;
                const isToday = k === todayKey;
                const isResult = !!(resultKey && k === resultKey);
                const isTripleSame = isStart && isEnd && isResult;
                const isEndResultSame = !isTripleSame && isEnd && isResult;

                let bg = GRAY;
                let fg = '#111';
                let extra = '';

                if (isToday) {
                    bg = WHITE;
                    extra = 'border:2px solid #000;';
                }

                if (isTripleSame) {
                    bg = `conic-gradient(${BLUE} 0deg 120deg, ${YELLOW} 120deg 240deg, ${RED} 240deg 360deg)`;
                    fg = '#111';
                } else if (isEndResultSame) {
                    bg = `conic-gradient(${YELLOW} 0deg 180deg, ${RED} 180deg 360deg)`;
                    fg = '#111';
                    extra = `${extra}box-shadow:0 0 0 1px rgba(0,0,0,0.28);`;
                } else if (isStart && isEnd) {
                    bg = `conic-gradient(${BLUE} 0deg 180deg, ${YELLOW} 180deg 360deg)`;
                    fg = '#111';
                } else if (isStart) {
                    bg = BLUE;
                    fg = '#fff';
                } else if (isEnd) {
                    bg = YELLOW;
                    fg = '#111';
                    extra = `${extra}box-shadow:0 0 0 1px rgba(0,0,0,0.28);`;
                } else if (isResult) {
                    bg = RED;
                    fg = '#fff';
                } else {
                    const inRange = k >= startKey && k <= endKey;
                    if (inRange) {
                        bg = '#e5e7eb';
                        fg = '#111';
                    }
                }

                html += `<td class="text-center" style="border:0;">`;
                html += `<div style="width:28px;height:28px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${bg};color:${fg};font-weight:700;${extra}">${dayNum}</div>`;
                html += `</td>`;
                dayNum++;
            }
            html += `</tr>`;
            if (dayNum > daysInMonth) break;
        }
        html += `</tbody></table>`;

        electionCalendar.innerHTML = html;
        electionCalendar.style.display = 'block';
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
        if (greetingName) greetingName.textContent = user || 'Student';
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

    initOmnibusSlideshow();

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

            if (electionStatus) setElectionBadge(e.status, e.status_class);
            if (electionCalendar) {
                const resultIso = getElectionResultIso(e);
                renderElectionCalendar(e.start_at, e.end_at, resultIso);
            }
        } catch (e) {
        }
    };

    void loadElectionWindow();
});

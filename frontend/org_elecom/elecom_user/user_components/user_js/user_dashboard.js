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
    const greetingCard = document.querySelector('.greeting-card');
    const greetingCta = document.getElementById('greetingCta');
    const omnibusCard = document.getElementById('omnibusCard');
    const omnibusCompleted = document.getElementById('omnibusCompleted');
    const totalCandidatesCard = document.getElementById('totalCandidatesCard');
    const totalCandidatesValue = document.getElementById('totalCandidatesValue');
    const ecDays = document.getElementById('ec_days');
    const ecHours = document.getElementById('ec_hours');
    const ecMins = document.getElementById('ec_mins');
    const ecSecs = document.getElementById('ec_secs');

    const ballotRoot = document.getElementById('ballotRoot');
    const ballotSubtitle = document.getElementById('ballotSubtitle');
    const ballotProgramLine = document.getElementById('ballotProgramLine');
    const submitBallotBtn = document.getElementById('submitBallotBtn');
    const ballotHint = document.getElementById('ballotHint');

    const API_PROFILE = '/api/account/profile/';
    const API_VOTE_STATUS = '/api/vote/status/';
    const API_CANDIDATES_METRICS = '/api/candidates/metrics/';
    const API_BALLOT = '/api/ballot/';
    const API_VOTE_SUBMIT = '/api/vote/submit/';
    const API_NOTIFICATIONS = '/api/mobile/notifications/';
    const API_NOTIFICATIONS_READ = '/api/mobile/notifications/read/';
    const API_NOTIFICATIONS_READ_ALL = '/api/mobile/notifications/read-all/';
    const API_FACE_ENROLLMENT_STATUS = '/api/mobile/face/enrollment/status/';
    const API_FACE_VERIFY = '/api/mobile/face/verify/';
    const API_APP_UPDATE = '/api/mobile/app/update/';
    const API_STUDENT_PAGE_TOKEN = '/api/user/page-token/';
    const API_NETWORK_CHECK = '/api/network/check/';
    const API_ACCOUNT_PRESENCE = '/api/account/presence/';
    const API_ACCOUNT_LOGOUT = '/api/account/logout/';
    const STUDENT_HASH_KEY = 'elecom_student_page_hash';
    const STUDENT_ROUTE_PREFIX = '/u/';
    const ELECTION_ENTRY_FACE_KEY = 'elecom_election_entry_face_verified';
    const WEB_DISCLAIMER_KEY = 'elecom_student_web_disclaimer_seen_v1';
    const studentSecureRouteCache = new Map();
    let faceVisionModulePromise = null;

    const NET_LEVELS = {
        HIGH: 'high',
        LOW: 'low',
        OFFLINE: 'offline',
        UNAUTHORIZED: 'unauthorized',
    };
    let presenceTimer = null;

    const isStudentStaticPage = (href) => {
        try {
            const url = new URL(href, window.location.origin);
            return url.origin === window.location.origin
                && url.pathname.startsWith('/static/org_elecom/elecom_user/')
                && url.pathname.endsWith('.html');
        } catch (e) {
            return false;
        }
    };

    const isStudentSecureRoute = () => window.location.pathname.startsWith(STUDENT_ROUTE_PREFIX);

    const getStudentPageNameFromHref = (href) => {
        try {
            const url = new URL(href, window.location.origin);
            if (!url.pathname.startsWith('/static/org_elecom/elecom_user/')) return '';
            return url.pathname.split('/').pop() || '';
        } catch (e) {
            return '';
        }
    };

    const getStudentSecureRouteForPage = async (page, queryString = '') => {
        const safePage = String(page || '').trim();
        if (!safePage) return '';
        const cacheKey = `${safePage}${queryString || ''}`;
        if (studentSecureRouteCache.has(cacheKey)) return studentSecureRouteCache.get(cacheKey);

        const url = new URL(API_STUDENT_PAGE_TOKEN, window.location.origin);
        url.searchParams.set('page', safePage);
        const extraParams = new URLSearchParams(String(queryString || '').replace(/^\?/, ''));
        extraParams.forEach((value, key) => {
            if (key === 'election_id' || key === 'next') {
                url.searchParams.set(key, value);
            }
        });

        const resp = await fetch(url.toString(), {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok || !data.secure_url) return '';

        const secureUrl = new URL(String(data.secure_url), window.location.origin).toString();
        studentSecureRouteCache.set(cacheKey, secureUrl);
        try {
            sessionStorage.setItem(`elecom_student_secure_route_${cacheKey}`, secureUrl);
        } catch (e) {
            // ignore
        }
        return secureUrl;
    };

    const rewriteStudentLinks = async () => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        for (const link of links) {
            const href = link.getAttribute('href') || '';
            if (!isStudentStaticPage(href)) continue;
            const page = getStudentPageNameFromHref(href);
            const parsed = new URL(href, window.location.origin);
            const secureUrl = await getStudentSecureRouteForPage(page, parsed.search);
            if (page) link.dataset.studentPage = page;
            if (secureUrl) link.setAttribute('href', secureUrl);
        }
    };

    const getStudentHashToken = () => {
        const raw = String(window.location.hash || '').replace(/^#/, '');
        const params = new URLSearchParams(raw);
        return String(params.get('secure') || '').trim();
    };

    const isStudentDashboardPage = () => /\/static\/org_elecom\/elecom_user\/user_dashboard\.html$/i.test(window.location.pathname);

    const goToStudentDashboard = () => {
        const dashboard = '/static/org_elecom/elecom_user/user_dashboard.html';
        if (isStudentDashboardPage()) return;
        window.location.href = dashboard;
    };

    const validateStudentHashToken = async (token) => {
        const resp = await fetch(API_STUDENT_PAGE_TOKEN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
            body: JSON.stringify({ token }),
        });
        const data = await resp.json().catch(() => ({}));
        return !!(resp.ok && data && data.ok);
    };

    const ensureStudentPageHash = async () => {
        if (!isStudentStaticPage(window.location.href) && !isStudentSecureRoute()) return;

        try {
            if (isStudentSecureRoute()) {
                rewriteStudentLinks();
                return;
            }

            const existingToken = getStudentHashToken();
            if (existingToken) {
                const valid = await validateStudentHashToken(existingToken);
                if (!valid) {
                    goToStudentDashboard();
                    return;
                }
                try {
                    sessionStorage.setItem(STUDENT_HASH_KEY, existingToken);
                } catch (e) {
                    // ignore
                }
                rewriteStudentLinks();
                return;
            }

            if (!isStudentDashboardPage()) {
                goToStudentDashboard();
                return;
            }

            const page = getStudentPageNameFromHref(window.location.href) || 'user_dashboard.html';
            const secureUrl = await getStudentSecureRouteForPage(page, window.location.search);
            if (!secureUrl) return;

            const token = new URL(secureUrl, window.location.origin).pathname.split('/').filter(Boolean)[1] || '';
            try {
                sessionStorage.setItem(STUDENT_HASH_KEY, token);
            } catch (e) {
                // ignore
            }
            window.history.replaceState(null, '', secureUrl);
            rewriteStudentLinks();
        } catch (e) {
            // Keep the page usable if secure URL bootstrapping is temporarily unavailable.
        }
    };

    ensureStudentPageHash();

    const initTotalCandidatesCard = async () => {
        if (!totalCandidatesValue) return;
        totalCandidatesValue.textContent = '—';

        try {
            const res = await fetch(API_CANDIDATES_METRICS, { method: 'GET', cache: 'no-store' });
            const data = await res.json();
            if (!res.ok || !data || data.ok !== true) throw new Error('Failed');
            const m = data.metrics || {};
            const n = Number(m.total_candidates);
            const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
            totalCandidatesValue.textContent = String(safe);
        } catch (e) {
            totalCandidatesValue.textContent = '—';
        }
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

    const showStudentWebDisclaimer = () => {
        try {
            if (sessionStorage.getItem(WEB_DISCLAIMER_KEY) === '1') return;
        } catch (e) { /* ignore */ }

        if (document.getElementById('studentWebDisclaimer')) return;

        const overlay = document.createElement('div');
        overlay.className = 'student-web-disclaimer';
        overlay.id = 'studentWebDisclaimer';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'studentWebDisclaimerTitle');
        overlay.innerHTML = `
            <div class="student-web-disclaimer__panel">
                <button type="button" class="student-web-disclaimer__close" aria-label="Close notice">
                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
                <div class="student-web-disclaimer__icon">
                    <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
                </div>
                <div class="student-web-disclaimer__content">
                    <div class="student-web-disclaimer__eyebrow">Student web portal preview</div>
                    <h2 id="studentWebDisclaimerTitle">ELECOM Web Is Still Under Development</h2>
                    <p>
                        Some web features may still have minor bugs or incomplete behavior while the system is being improved.
                        You can continue using the website, but for the best and more reliable voting experience, please use
                        the ELECOM mobile app when it is available.
                    </p>
                    <div class="student-web-disclaimer__note">
                        <i class="bi bi-info-circle" aria-hidden="true"></i>
                        <span>If something looks incorrect, refresh the page or report it to ELECOM support.</span>
                    </div>
                    <div class="student-web-disclaimer__actions">
                        <a class="student-web-disclaimer__download" href="#" target="_blank" rel="noopener" style="display:none;">
                            <i class="bi bi-download" aria-hidden="true"></i>
                            <span>Download Mobile App</span>
                        </a>
                        <button type="button" class="student-web-disclaimer__continue">Continue to Web Portal</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.classList.add('student-web-disclaimer-open');

        const closeNotice = () => {
            try {
                sessionStorage.setItem(WEB_DISCLAIMER_KEY, '1');
            } catch (e) { /* ignore */ }
            document.body.classList.remove('student-web-disclaimer-open');
            overlay.remove();
        };

        const closeBtn = overlay.querySelector('.student-web-disclaimer__close');
        const continueBtn = overlay.querySelector('.student-web-disclaimer__continue');
        if (closeBtn) closeBtn.addEventListener('click', closeNotice);
        if (continueBtn) continueBtn.addEventListener('click', closeNotice);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeNotice();
        });

        document.addEventListener('keydown', function onDisclaimerKeydown(e) {
            if (!document.getElementById('studentWebDisclaimer')) {
                document.removeEventListener('keydown', onDisclaimerKeydown);
                return;
            }
            if (e.key === 'Escape') closeNotice();
        });

        const loadDownloadLink = async () => {
            try {
                const res = await fetch(API_APP_UPDATE, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                });
                const data = await res.json().catch(() => ({}));
                const apkUrl = data && data.ok ? String(data.apk_url || '').trim() : '';
                const download = overlay.querySelector('.student-web-disclaimer__download');
                if (!download || !apkUrl) return;
                download.href = apkUrl;
                download.style.display = 'inline-flex';
            } catch (e) { /* ignore */ }
        };

        void loadDownloadLink();
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
                <div class="voting-status-icon text-success voting-check-animate"><i class="bi bi-check-circle-fill"></i></div>
                <div class="voting-status-title">Thank you for voting!</div>
                <div class="voting-status-meta">Recorded: ${ts || '—'}</div>
            `;
            return;
        }

        votingStatusContent.innerHTML = `
            <div class="voting-status-icon voting-status-icon--pending"><i class="bi bi-clock-fill"></i></div>
            <div class="voting-status-title voting-status-title--pending">Awaiting Your Vote</div>
            <div class="voting-status-meta">Please cast your ballot before the countdown ends.</div>
        `;
    };

    const applyVotedUiState = ({ voted, voted_at }) => {
        if (!voted) {
            if (greetingCard) greetingCard.classList.remove('is-voted');
            if (omnibusCard) omnibusCard.classList.remove('is-completed');
            if (omnibusCompleted) omnibusCompleted.setAttribute('aria-hidden', 'true');
            if (greetingCta) {
                greetingCta.classList.remove('greeting-verified');
                greetingCta.classList.add('greeting-cta');
                greetingCta.textContent = 'Vote Now';
                greetingCta.setAttribute('href', '/static/org_elecom/elecom_user/user_election.html');
            }
            return;
        }

        if (greetingCard) greetingCard.classList.add('is-voted');

        if (greetingCta) {
            greetingCta.classList.remove('greeting-cta');
            greetingCta.classList.add('greeting-verified');
            greetingCta.textContent = 'Vote Verified';
            greetingCta.setAttribute('href', '#');
        }

        if (omnibusCard) omnibusCard.classList.add('is-completed');
        if (omnibusCompleted) omnibusCompleted.setAttribute('aria-hidden', 'false');

        const key = 'elecom_confetti_voted_at';
        const votedAtKey = String(voted_at || '');
        let shouldConfetti = false;
        try {
            const prev = localStorage.getItem(key) || '';
            if (votedAtKey && prev !== votedAtKey) {
                shouldConfetti = true;
                localStorage.setItem(key, votedAtKey);
            }
        } catch (e) {
            shouldConfetti = false;
        }

        if (shouldConfetti) {
            burstConfetti();
        }
    };

    const burstConfetti = () => {
        const layer = document.createElement('div');
        layer.className = 'confetti-layer';
        document.body.appendChild(layer);

        const colors = ['#1d4ed8', '#facc15', '#10b981', '#38bdf8', '#0b2f8a'];
        const count = 46;
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        for (let i = 0; i < count; i += 1) {
            const p = document.createElement('div');
            p.className = 'confetti-piece';
            p.style.left = `${cx}px`;
            p.style.top = `${cy}px`;
            p.style.background = colors[i % colors.length];

            const dx = (Math.random() * 2 - 1) * (220 + Math.random() * 220);
            const dy = 240 + Math.random() * 420;
            const rot = `${(Math.random() * 2 - 1) * 420}deg`;
            p.style.setProperty('--dx', `${dx}px`);
            p.style.setProperty('--dy', `${dy}px`);
            p.style.setProperty('--rot', rot);

            const size = 7 + Math.random() * 8;
            p.style.width = `${size}px`;
            p.style.height = `${size * (0.6 + Math.random() * 0.9)}px`;
            p.style.animationDelay = `${Math.random() * 120}ms`;

            layer.appendChild(p);
        }

        window.setTimeout(() => {
            try { layer.remove(); } catch (e) { /* ignore */ }
        }, 1550);
    };

    const initVotingStatus = async () => {
        if (!votingStatusContent) return;
        votingStatusContent.innerHTML = '<div class="voting-status-meta">Loading status...</div>';

        try {
            const res = await fetch(API_VOTE_STATUS, { method: 'GET', cache: 'no-store' });
            const data = await res.json();
            if (!res.ok || !data || data.ok !== true) throw new Error((data && data.error) || 'Failed');
            const voted = !!data.voted;
            const votedAt = data.voted_at || null;
            renderVotingStatus({ voted, voted_at: votedAt });
            applyVotedUiState({ voted, voted_at: votedAt });
        } catch (e) {
            votingStatusContent.innerHTML = '<div class="voting-status-meta">Unable to load voting status.</div>';
        }
    };

    const toLogin = () => {
        try {
            if (navigator.sendBeacon) {
                navigator.sendBeacon(API_ACCOUNT_LOGOUT, new Blob(['{}'], { type: 'application/json' }));
            } else {
                fetch(API_ACCOUNT_LOGOUT, {
                    method: 'POST',
                    credentials: 'same-origin',
                    keepalive: true,
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}',
                }).catch(() => {});
            }
        } catch (e) { /* ignore */ }
        try {
            sessionStorage.removeItem('elecom_user');
            sessionStorage.removeItem('elecom_role');
            sessionStorage.removeItem('elecom_user_id');
            sessionStorage.removeItem('elecom_user_photo_url');
            sessionStorage.removeItem(ELECTION_ENTRY_FACE_KEY);
            sessionStorage.removeItem(WEB_DISCLAIMER_KEY);
        } catch (e) { /* ignore */ }
        const base = window.location.origin;
        window.location.href = `${base}/login/`;
    };

    const pingPresence = () => {
        fetch(API_ACCOUNT_PRESENCE, {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
        }).catch(() => {});
    };

    const startPresenceHeartbeat = () => {
        if (presenceTimer) clearInterval(presenceTimer);
        pingPresence();
        presenceTimer = setInterval(pingPresence, 20000);
        window.addEventListener('beforeunload', () => {
            if (presenceTimer) clearInterval(presenceTimer);
        }, { once: true });
    };

    let electionEntryStream = null;
    let electionEntryTargetUrl = '';
    let electionEntryDetector = null;
    let electionEntryDetectionTimer = null;
    let electionEntryCaptureTimer = null;
    let electionEntryLastVideoTime = -1;
    let electionEntryEyesWereOpen = false;
    let electionEntryBlinkClosedSeen = false;
    let electionEntryBlinkDetected = false;
    let electionEntrySubmitting = false;
    let electionEntryFaceReadySince = 0;

    const ensureElectionEntryModal = () => {
        let modal = document.getElementById('electionEntryFaceModal');
        if (modal) return modal;

        const style = document.createElement('style');
        style.textContent = `
            .entry-face-modal{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;padding:18px;opacity:0;pointer-events:none;transition:opacity .18s ease}
            .entry-face-modal.is-open{opacity:1;pointer-events:auto}
            .entry-face-backdrop{position:absolute;inset:0;background:rgba(7,12,24,.58);backdrop-filter:blur(5px)}
            .entry-face-panel{position:relative;z-index:1;width:min(460px,100%);overflow:hidden;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(7,12,24,.28);transform:translateY(10px) scale(.97);transition:transform .18s ease}
            .entry-face-modal.is-open .entry-face-panel{transform:translateY(0) scale(1)}
            .entry-face-head{padding:18px 20px 12px;border-bottom:1px solid #e5eaf1}
            .entry-face-head h2{margin:0;color:#0b1f5b;font-size:20px;font-weight:900}
            .entry-face-head p{margin:5px 0 0;color:#64748b;font-size:13px;font-weight:700}
            .entry-face-camera{position:relative;margin:18px 20px 12px;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:#0b1220}
            .entry-face-camera video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
            .entry-face-placeholder{position:absolute;inset:0;display:grid;place-items:center;color:#cbd5e1;font-weight:800;text-align:center;padding:20px;background:linear-gradient(135deg,#0b1220,#1e293b)}
            .entry-face-status{min-height:22px;margin:0 20px 14px;color:#64748b;font-size:13px;font-weight:800}
            .entry-face-status.is-error{color:#dc2626}.entry-face-status.is-success{color:#15803d}
            .entry-face-steps{display:flex;gap:8px;margin:0 20px 14px}
            .entry-face-step{flex:1;min-height:34px;border-radius:11px;display:grid;place-items:center;border:1px solid #e5eaf1;color:#64748b;font-size:11px;font-weight:900}
            .entry-face-step.is-active{border-color:#f4c430;background:#fff8db;color:#0b1f5b}.entry-face-step.is-done{border-color:#16a34a;background:#ecfdf5;color:#15803d}
            .entry-face-actions{display:flex;gap:10px;justify-content:flex-end;padding:14px 20px 18px;border-top:1px solid #e5eaf1}
            .entry-face-actions button{min-height:42px;padding:0 16px;border-radius:13px;font-weight:900;cursor:pointer}
            .entry-face-cancel{border:1px solid #d6dce5;background:#fff;color:#0b1f5b}
            .entry-face-verify{border:1px solid #111827;background:#111827;color:#fff}
            .entry-face-verify:disabled,.entry-face-cancel:disabled{opacity:.62;cursor:not-allowed}
            @media (max-width:560px){.entry-face-actions{flex-direction:column-reverse}.entry-face-actions button{width:100%}}
        `;
        document.head.appendChild(style);

        modal = document.createElement('div');
        modal.className = 'entry-face-modal';
        modal.id = 'electionEntryFaceModal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="entry-face-backdrop" data-entry-face-cancel></div>
            <section class="entry-face-panel" role="dialog" aria-modal="true" aria-labelledby="entryFaceTitle">
                <header class="entry-face-head">
                    <h2 id="entryFaceTitle">Face Verification Required</h2>
                    <p>Verify your face before opening the election ballot.</p>
                </header>
                <div class="entry-face-camera">
                    <video id="entryFaceVideo" autoplay playsinline muted></video>
                    <canvas id="entryFaceCanvas" width="720" height="540" hidden></canvas>
                    <div class="face-guide-overlay" aria-hidden="true">
                        <div class="face-guide-frame" id="entryFaceGuideFrame" data-state="searching">
                            <span class="face-guide-corner face-guide-corner--tl"></span>
                            <span class="face-guide-corner face-guide-corner--tr"></span>
                            <span class="face-guide-corner face-guide-corner--bl"></span>
                            <span class="face-guide-corner face-guide-corner--br"></span>
                            <span class="face-guide-label" id="entryFaceGuideLabel">Center your face</span>
                        </div>
                    </div>
                    <div class="entry-face-placeholder" id="entryFacePlaceholder">Allow camera access to continue.</div>
                </div>
                <p class="entry-face-status" id="entryFaceStatus" role="status">Opening camera...</p>
                <div class="entry-face-steps" aria-label="Face verification checks">
                    <span class="entry-face-step is-active" id="entryFaceStepPosition">Center</span>
                    <span class="entry-face-step" id="entryFaceStepBlink">Blink</span>
                    <span class="entry-face-step" id="entryFaceStepCapture">Auto verify</span>
                </div>
                <footer class="entry-face-actions">
                    <button class="entry-face-cancel" type="button" id="entryFaceCancel">Cancel</button>
                </footer>
            </section>
        `;
        document.body.appendChild(modal);
        return modal;
    };

    const setElectionEntryStatus = (message, type = '') => {
        const status = document.getElementById('entryFaceStatus');
        if (!status) return;
        status.textContent = message || '';
        status.classList.toggle('is-error', type === 'error');
        status.classList.toggle('is-success', type === 'success');
    };

    const setEntryFaceStep = (id, state = '') => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('is-active', state === 'active');
        el.classList.toggle('is-done', state === 'done');
    };

    const setEntryFaceGuide = (state, label, tone = '') => {
        const frame = document.getElementById('entryFaceGuideFrame');
        const labelEl = document.getElementById('entryFaceGuideLabel');
        if (frame) frame.dataset.state = state || 'searching';
        if (labelEl) {
            labelEl.textContent = label || 'Center your face';
            if (tone) labelEl.dataset.tone = tone;
            else labelEl.removeAttribute('data-tone');
        }
    };

    const resetEntryFaceSmartState = () => {
        electionEntryEyesWereOpen = false;
        electionEntryBlinkClosedSeen = false;
        electionEntryBlinkDetected = false;
        electionEntryFaceReadySince = 0;
        if (electionEntryCaptureTimer) {
            clearTimeout(electionEntryCaptureTimer);
            electionEntryCaptureTimer = null;
        }
        setEntryFaceStep('entryFaceStepPosition', 'active');
        setEntryFaceStep('entryFaceStepBlink', '');
        setEntryFaceStep('entryFaceStepCapture', '');
        setEntryFaceGuide('searching', 'Center your face', 'error');
    };

    const ensureElectionNetworkModal = () => {
        let modal = document.getElementById('electionNetworkModal');
        if (modal) return modal;

        const style = document.createElement('style');
        style.textContent = `
            .entry-network-modal{position:fixed;inset:0;z-index:3100;display:grid;place-items:center;padding:18px;opacity:0;pointer-events:none;transition:opacity .18s ease}
            .entry-network-modal.is-open{opacity:1;pointer-events:auto}
            .entry-network-backdrop{position:absolute;inset:0;background:rgba(7,12,24,.58);backdrop-filter:blur(5px)}
            .entry-network-panel{position:relative;z-index:1;width:min(430px,100%);overflow:hidden;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(7,12,24,.28);transform:translateY(10px) scale(.97);transition:transform .18s ease}
            .entry-network-modal.is-open .entry-network-panel{transform:translateY(0) scale(1)}
            .entry-network-body{padding:24px 22px 18px;text-align:center}
            .entry-network-icon{width:56px;height:56px;margin:0 auto 14px;border-radius:999px;display:grid;place-items:center;background:#fef2f2;color:#dc2626;font-size:28px}
            .entry-network-body h2{margin:0;color:#0b1f5b;font-size:21px;font-weight:900}
            .entry-network-body p{margin:10px 0 0;color:#64748b;font-size:14px;font-weight:700;line-height:1.5}
            .entry-network-actions{display:flex;justify-content:flex-end;padding:14px 20px 18px;border-top:1px solid #e5eaf1}
            .entry-network-close{min-height:42px;padding:0 18px;border-radius:13px;border:1px solid #111827;background:#111827;color:#fff;font-weight:900;cursor:pointer}
        `;
        document.head.appendChild(style);

        modal = document.createElement('div');
        modal.className = 'entry-network-modal';
        modal.id = 'electionNetworkModal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="entry-network-backdrop" data-entry-network-close></div>
            <section class="entry-network-panel" role="dialog" aria-modal="true" aria-labelledby="entryNetworkTitle">
                <div class="entry-network-body">
                    <div class="entry-network-icon"><i class="bi bi-wifi-off" aria-hidden="true"></i></div>
                    <h2 id="entryNetworkTitle">Network Not Authorized</h2>
                    <p id="entryNetworkMessage">You must connect to a network registered by the admin before opening the election ballot.</p>
                </div>
                <footer class="entry-network-actions">
                    <button class="entry-network-close" type="button" id="entryNetworkClose">OK</button>
                </footer>
            </section>
        `;
        document.body.appendChild(modal);
        return modal;
    };

    const showElectionNetworkBlocked = (message, redirectToDashboard = false) => {
        const modal = ensureElectionNetworkModal();
        const messageEl = document.getElementById('entryNetworkMessage');
        const safeMessage = 'You must connect to a network registered by the admin before opening the election ballot.';
        const close = () => {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            if (modal.dataset.redirectToDashboard === 'true') {
                window.location.href = '/static/org_elecom/elecom_user/user_dashboard.html';
            }
        };

        if (messageEl) {
            messageEl.textContent = safeMessage;
        }
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        modal.dataset.redirectToDashboard = redirectToDashboard ? 'true' : 'false';
        document.body.style.overflow = 'hidden';

        modal.querySelectorAll('[data-entry-network-close], #entryNetworkClose').forEach((el) => {
            if (el.dataset.bound) return;
            el.dataset.bound = 'true';
            el.addEventListener('click', close);
        });
    };

    const checkElectionNetworkAccess = async () => {
        try {
            const res = await fetch(API_NETWORK_CHECK, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 401) {
                toLogin();
                return { allowed: false, message: 'Please sign in again.' };
            }
            if (!res.ok || data.ok !== true || data.allowed !== true) {
                return {
                    allowed: false,
                    message: data.message || data.error || 'You must connect to a network registered by the admin before opening the election ballot.',
                };
            }
            return { allowed: true, message: data.message || '' };
        } catch (e) {
            return {
                allowed: false,
                message: 'Unable to verify your network. Please connect to an authorized network and try again.',
            };
        }
    };

    const requireElectionNetworkAccess = async (redirectToDashboard = false) => {
        const result = await checkElectionNetworkAccess();
        if (result.allowed) {
            refreshNetworkUi();
            return true;
        }

        setNetworkUi({ level: NET_LEVELS.UNAUTHORIZED });
        showElectionNetworkBlocked(result.message, redirectToDashboard);
        return false;
    };

    const loadFaceVisionModule = async () => {
        if (!faceVisionModulePromise) {
            faceVisionModulePromise = import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
        }
        return faceVisionModulePromise;
    };

    const dist = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
    const eyeAspectRatio = (lm, idx) => {
        const [outer, upper1, upper2, inner, lower1, lower2] = idx.map((i) => lm[i]);
        return (dist(upper1, lower2) + dist(upper2, lower1)) / Math.max(0.001, 2 * dist(outer, inner));
    };
    const landmarkBox = (lm) => {
        const xs = lm.map((p) => p.x);
        const ys = lm.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    };
    const analyzeEntryLandmarks = (lm) => {
        const box = landmarkBox(lm);
        const leftEar = eyeAspectRatio(lm, [33, 160, 158, 133, 153, 144]);
        const rightEar = eyeAspectRatio(lm, [362, 385, 387, 263, 373, 380]);
        const avgEar = (leftEar + rightEar) / 2;
        const nose = lm[1];
        const mouth = [lm[13], lm[14], lm[61], lm[291]];
        const isInside = (p, margin = 0.02) => p && p.x > margin && p.x < 1 - margin && p.y > margin && p.y < 1 - margin;
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        const faceCentered = Math.abs(centerX - 0.5) <= 0.34 && Math.abs(centerY - 0.50) <= 0.36;
        const keyLandmarksVisible = isInside(nose, 0.015) && mouth.every((p) => isInside(p, 0.005));
        const faceLargeEnough = box.height >= 0.18;
        const faceNotTooLarge = box.height <= 1.05;
        const eyesVisible = leftEar > 0.035 && rightEar > 0.035;
        return {
            valid: faceCentered && faceLargeEnough && faceNotTooLarge && eyesVisible && keyLandmarksVisible,
            tooFar: box.height < 0.18,
            eyesOpen: avgEar > 0.17,
            eyesClosed: avgEar < 0.13,
        };
    };

    const updateEntryFaceSmartUi = (face) => {
        if (!face || !face.valid) {
            resetEntryFaceSmartState();
            setElectionEntryStatus(face && face.tooFar ? 'Move closer and center your face.' : 'Center your face in the camera.', 'error');
            return;
        }

        setEntryFaceGuide('ready', 'Blink once');
        setEntryFaceStep('entryFaceStepPosition', 'done');
        if (!electionEntryFaceReadySince) electionEntryFaceReadySince = Date.now();
        if (face.eyesOpen) {
            electionEntryEyesWereOpen = true;
            if (electionEntryBlinkClosedSeen) electionEntryBlinkDetected = true;
        } else if (electionEntryEyesWereOpen && face.eyesClosed) {
            electionEntryBlinkClosedSeen = true;
        }
        if (!electionEntryBlinkDetected && Date.now() - electionEntryFaceReadySince >= 1700) {
            electionEntryBlinkDetected = true;
        }

        if (electionEntryBlinkDetected) {
            setEntryFaceStep('entryFaceStepBlink', 'done');
            setEntryFaceStep('entryFaceStepCapture', 'active');
            setEntryFaceGuide('done', 'Capturing...', 'success');
            setElectionEntryStatus('Face confirmed. Verifying automatically...', 'success');
            if (!electionEntryCaptureTimer && !electionEntrySubmitting) {
                electionEntryCaptureTimer = window.setTimeout(() => {
                    electionEntryCaptureTimer = null;
                    verifyElectionEntryFace();
                }, 700);
            }
            return;
        }

        setEntryFaceStep('entryFaceStepBlink', 'active');
        setEntryFaceStep('entryFaceStepCapture', '');
        setElectionEntryStatus('Good. Blink once or hold still to verify.');
    };

    const analyzeEntryFace = () => {
        const video = document.getElementById('entryFaceVideo');
        if (!electionEntryStream || !electionEntryDetector || !video || video.readyState < 2 || electionEntrySubmitting) return;
        if (video.currentTime === electionEntryLastVideoTime) return;
        electionEntryLastVideoTime = video.currentTime;
        const result = electionEntryDetector.detectForVideo(video, performance.now());
        const landmarks = result.faceLandmarks && result.faceLandmarks[0];
        updateEntryFaceSmartUi(landmarks ? analyzeEntryLandmarks(landmarks) : null);
    };

    const stopElectionEntryCamera = () => {
        if (electionEntryDetectionTimer) {
            clearInterval(electionEntryDetectionTimer);
            electionEntryDetectionTimer = null;
        }
        if (electionEntryCaptureTimer) {
            clearTimeout(electionEntryCaptureTimer);
            electionEntryCaptureTimer = null;
        }
        if (electionEntryDetector && typeof electionEntryDetector.close === 'function') {
            try { electionEntryDetector.close(); } catch (e) { /* ignore */ }
        }
        electionEntryDetector = null;
        if (electionEntryStream) {
            electionEntryStream.getTracks().forEach((track) => track.stop());
            electionEntryStream = null;
        }
        const video = document.getElementById('entryFaceVideo');
        if (video) video.srcObject = null;
    };

    const closeElectionEntryModal = () => {
        const modal = document.getElementById('electionEntryFaceModal');
        if (!modal) return;
        stopElectionEntryCamera();
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        electionEntryTargetUrl = '';
    };

    const startElectionEntryCamera = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('This browser does not support camera verification. Please use a modern browser.');
        }
        stopElectionEntryCamera();
        const verifyBtn = document.getElementById('entryFaceVerify');
        const placeholder = document.getElementById('entryFacePlaceholder');
        electionEntrySubmitting = false;
        resetEntryFaceSmartState();
        if (verifyBtn) verifyBtn.disabled = true;
        if (placeholder) placeholder.hidden = false;
        setElectionEntryStatus('Opening camera...');

        electionEntryStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 540 } },
            audio: false,
        });

        const video = document.getElementById('entryFaceVideo');
        if (video) {
            video.srcObject = electionEntryStream;
            await video.play().catch(() => {});
        }
        if (placeholder) placeholder.hidden = true;
        if (verifyBtn) {
            verifyBtn.disabled = true;
            verifyBtn.textContent = 'Scanning...';
        }
        setElectionEntryStatus('Loading smart face check...');
        const { FaceLandmarker, FilesetResolver } = await loadFaceVisionModule();
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
        electionEntryDetector = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
                delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            minFaceDetectionConfidence: 0.55,
            minFacePresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
        });
        setElectionEntryStatus('Center your face in the camera.');
        electionEntryDetectionTimer = setInterval(analyzeEntryFace, 120);
    };

    const captureElectionEntryFaceBlob = () => new Promise((resolve, reject) => {
        const video = document.getElementById('entryFaceVideo');
        const canvas = document.getElementById('entryFaceCanvas');
        if (!video || !canvas || !electionEntryStream || video.readyState < 2) {
            reject(new Error('Camera is not ready yet.'));
            return;
        }
        const width = video.videoWidth || 720;
        const height = video.videoHeight || 540;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Could not capture your face. Please try again.'));
                return;
            }
            resolve(blob);
        }, 'image/jpeg', 0.92);
    });

    const verifyElectionEntryFace = async () => {
        const verifyBtn = document.getElementById('entryFaceVerify');
        const cancelBtn = document.getElementById('entryFaceCancel');
        if (electionEntrySubmitting) return;
        electionEntrySubmitting = true;
        if (verifyBtn) verifyBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;
        setElectionEntryStatus('Verifying your face...');

        try {
            const blob = await captureElectionEntryFaceBlob();
            const formData = new FormData();
            formData.append('face_image', blob, 'election-entry-face.jpg');
            formData.append('liveness_passed', 'true');

            const res = await fetch(API_FACE_VERIFY, {
                method: 'POST',
                credentials: 'same-origin',
                body: formData,
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 401) {
                toLogin();
                return;
            }
            if (!res.ok || !data || data.ok !== true || data.verified !== true) {
                throw new Error(data.failure_reason || data.error || 'Face verification failed. Please try again.');
            }

            sessionStorage.setItem(ELECTION_ENTRY_FACE_KEY, 'true');
            setElectionEntryStatus('Face verified. Opening election...', 'success');
            const target = electionEntryTargetUrl || window.location.href;
            stopElectionEntryCamera();
            setTimeout(() => {
                closeElectionEntryModal();
                if (target && target !== window.location.href) window.location.href = target;
            }, 450);
        } catch (error) {
            electionEntrySubmitting = false;
            resetEntryFaceSmartState();
            setElectionEntryStatus(error.message || 'Face verification failed. Please try again.', 'error');
            if (cancelBtn) cancelBtn.disabled = false;
        }
    };

    const openElectionEntryVerification = async (targetUrl = '', options = {}) => {
        if (!options.skipNetworkCheck) {
            const networkAllowed = await requireElectionNetworkAccess(Boolean(ballotRoot));
            if (!networkAllowed) return;
        }

        ensureElectionEntryModal();
        electionEntryTargetUrl = targetUrl || '';
        const modal = document.getElementById('electionEntryFaceModal');
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        const cancelBtn = document.getElementById('entryFaceCancel');
        const verifyBtn = document.getElementById('entryFaceVerify');
        const backdrop = modal.querySelector('[data-entry-face-cancel]');
        if (cancelBtn && !cancelBtn.dataset.bound) {
            cancelBtn.dataset.bound = 'true';
            cancelBtn.addEventListener('click', () => {
                closeElectionEntryModal();
                if (ballotRoot && !sessionStorage.getItem(ELECTION_ENTRY_FACE_KEY)) {
                    window.location.href = '/static/org_elecom/elecom_user/user_dashboard.html';
                }
            });
        }
        if (backdrop && !backdrop.dataset.bound) {
            backdrop.dataset.bound = 'true';
            backdrop.addEventListener('click', () => {
                closeElectionEntryModal();
                if (ballotRoot && !sessionStorage.getItem(ELECTION_ENTRY_FACE_KEY)) {
                    window.location.href = '/static/org_elecom/elecom_user/user_dashboard.html';
                }
            });
        }
        try {
            await startElectionEntryCamera();
        } catch (error) {
            setElectionEntryStatus(error.message || 'Camera access is required before opening the election.', 'error');
            if (verifyBtn) verifyBtn.disabled = true;
        }
    };

    const isElectionLink = (link) => {
        if (!link) return false;
        const page = String(link.dataset.studentPage || '').toLowerCase();
        const href = String(link.getAttribute('href') || '').toLowerCase();
        const text = String(link.textContent || '').trim().toLowerCase();
        return page === 'user_election.html'
            || href.includes('/user_election.html')
            || link.id === 'greetingCta'
            || text === 'election'
            || text === 'vote now';
    };

    document.addEventListener('click', async (event) => {
        const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
        if (!isElectionLink(link)) return;
        event.preventDefault();
        const networkAllowed = await requireElectionNetworkAccess(false);
        if (!networkAllowed) return;
        if (sessionStorage.getItem(ELECTION_ENTRY_FACE_KEY) === 'true') {
            window.location.href = link.href;
            return;
        }
        openElectionEntryVerification(link.href, { skipNetworkCheck: true });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.getElementById('electionEntryFaceModal')?.classList.contains('is-open')) {
            closeElectionEntryModal();
            if (ballotRoot && !sessionStorage.getItem(ELECTION_ENTRY_FACE_KEY)) {
                window.location.href = '/static/org_elecom/elecom_user/user_dashboard.html';
            }
        }
    });

    if (ballotRoot) {
        setTimeout(async () => {
            const networkAllowed = await requireElectionNetworkAccess(true);
            if (!networkAllowed) return;
            if (sessionStorage.getItem(ELECTION_ENTRY_FACE_KEY) !== 'true') {
                openElectionEntryVerification('', { skipNetworkCheck: true });
            }
        }, 350);
    }

    const initElectionBallot = async () => {
        if (!ballotRoot) return;

        const state = {
            selections: {},
        };

        const isMultiSelectPositionKey = (positionKey) => {
            const k = String(positionKey || '').toUpperCase();
            return k.startsWith('USG::') && k.includes('REPRESENTATIVE');
        };

        const setSubmitEnabled = () => {
            if (!submitBallotBtn) return;
            const vals = Object.values(state.selections || {});
            const n = vals.reduce((acc, v) => {
                if (Array.isArray(v)) return acc + (v.length || 0);
                if (v === null || v === undefined || v === '') return acc;
                return acc + 1;
            }, 0);
            submitBallotBtn.disabled = n === 0;
        };

        const buildCandidateOption = ({ positionKey, candidate }) => {
            const wrap = document.createElement('label');
            wrap.className = 'd-flex align-items-center gap-2 p-2 rounded border';
            wrap.style.cursor = 'pointer';

            const isMulti = isMultiSelectPositionKey(positionKey);

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = `pos_${positionKey}`;
            input.value = String(candidate.id);
            input.className = 'form-check-input m-0';

            const left = document.createElement('div');
            left.className = 'd-flex align-items-center gap-2 flex-grow-1';

            const avatar = document.createElement('div');
            avatar.style.width = '34px';
            avatar.style.height = '34px';
            avatar.style.borderRadius = '50%';
            avatar.style.overflow = 'hidden';
            avatar.style.flex = '0 0 auto';
            avatar.style.background = '#f3f4f6';

            if (candidate.photo_url) {
                const img = document.createElement('img');
                img.src = candidate.photo_url;
                img.alt = '';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                avatar.appendChild(img);
            } else {
                const i = document.createElement('i');
                i.className = 'bi bi-person-circle';
                i.style.fontSize = '34px';
                i.style.color = '#9ca3af';
                i.style.display = 'block';
                i.style.lineHeight = '34px';
                i.style.textAlign = 'center';
                avatar.appendChild(i);
            }

            const txt = document.createElement('div');
            const nm = document.createElement('div');
            nm.className = 'fw-semibold';
            nm.textContent = candidate.name || 'Candidate';
            const meta = document.createElement('div');
            meta.className = 'small text-muted';
            meta.textContent = candidate.party_name ? String(candidate.party_name) : '';
            txt.appendChild(nm);
            if (meta.textContent) txt.appendChild(meta);

            left.appendChild(avatar);
            left.appendChild(txt);
            wrap.appendChild(input);
            wrap.appendChild(left);

            input.addEventListener('change', () => {
                const cid = Number(candidate.id);
                if (!Number.isFinite(cid)) return;

                if (!isMulti) {
                    if (input.checked) {
                        const all = document.querySelectorAll(`input[name="pos_${positionKey}"]`);
                        Array.from(all).forEach((el) => {
                            if (el === input) return;
                            el.checked = false;
                        });
                        state.selections[positionKey] = cid;
                    } else {
                        delete state.selections[positionKey];
                    }
                    setSubmitEnabled();
                    return;
                }

                const cur = state.selections[positionKey];
                const arr = Array.isArray(cur) ? cur.slice() : [];

                if (input.checked) {
                    if (arr.length >= 2) {
                        input.checked = false;
                        return;
                    }
                    if (!arr.includes(cid)) arr.push(cid);
                } else {
                    const idx = arr.indexOf(cid);
                    if (idx >= 0) arr.splice(idx, 1);
                }

                if (!arr.length) {
                    delete state.selections[positionKey];
                } else {
                    state.selections[positionKey] = arr;
                }

                // Keep UI consistent with max-2 rule.
                if (isMulti) {
                    const all = document.querySelectorAll(`input[name="pos_${positionKey}"]`);
                    const hasTwo = Array.isArray(state.selections[positionKey]) && state.selections[positionKey].length >= 2;
                    Array.from(all).forEach((el) => {
                        if (el.type !== 'checkbox') return;
                        if (el.checked) {
                            el.disabled = false;
                            return;
                        }
                        el.disabled = hasTwo;
                    });
                }
                setSubmitEnabled();
            });

            return wrap;
        };

        const renderBallot = (ballot) => {
            ballotRoot.innerHTML = '';

            (ballot || []).forEach((orgBlock) => {
                const org = String(orgBlock.organization || '').toUpperCase();
                if (!org) return;

                const orgHeader = document.createElement('div');
                orgHeader.className = 'd-flex align-items-center justify-content-between flex-wrap gap-2 mt-2 mb-2';
                const orgTitle = document.createElement('div');
                orgTitle.className = 'fw-semibold';
                orgTitle.textContent = `Organization: ${org}`;
                orgHeader.appendChild(orgTitle);
                ballotRoot.appendChild(orgHeader);

                (orgBlock.positions || []).forEach((posBlock) => {
                    const pos = String(posBlock.position || '');
                    const positionKey = `${org}::${pos}`;

                    const card = document.createElement('div');
                    card.className = 'card border-0 shadow-sm mb-3';
                    const body = document.createElement('div');
                    body.className = 'card-body';

                    const header = document.createElement('div');
                    header.className = 'fw-semibold mb-2';
                    header.textContent = pos;

                    const list = document.createElement('div');
                    list.className = 'd-grid gap-2';

                    (posBlock.candidates || []).forEach((candidate) => {
                        list.appendChild(buildCandidateOption({ positionKey, candidate }));
                    });

                    body.appendChild(header);
                    body.appendChild(list);
                    card.appendChild(body);
                    ballotRoot.appendChild(card);
                });
            });
        };

        const setStatusText = (t) => {
            if (ballotSubtitle) ballotSubtitle.textContent = t;
        };

        setStatusText('Loading your eligible ballot...');
        if (submitBallotBtn) submitBallotBtn.disabled = true;

        let ballotData = null;
        try {
            const res = await fetch(API_BALLOT, { method: 'GET', cache: 'no-store' });
            const data = await res.json();
            if (res.status === 401) {
                toLogin();
                return;
            }
            if (!res.ok || !data || data.ok !== true) throw new Error('Failed');
            ballotData = data;
        } catch (e) {
            setStatusText('Unable to load ballot.');
            return;
        }

        const program = String(ballotData.program_code || '').trim();
        if (program && ballotProgramLine) {
            ballotProgramLine.style.display = '';
            ballotProgramLine.textContent = `Program: ${program}`;
        }

        const eligibleOrgLine = document.getElementById('eligibleOrgLine');
        const eligible = Array.isArray(ballotData.eligible_organizations) ? ballotData.eligible_organizations : [];
        if (eligibleOrgLine && eligible.length) {
            eligibleOrgLine.style.display = '';
            eligibleOrgLine.textContent = `Eligible organizations: ${eligible.join(', ')}`;
        }

        renderBallot(ballotData.ballot || []);
        setStatusText('Select candidates per position, then submit.');
        if (ballotHint) ballotHint.style.display = '';
        setSubmitEnabled();

        if (submitBallotBtn) {
            submitBallotBtn.addEventListener('click', async () => {
                submitBallotBtn.disabled = true;
                try {
                    // Ensure representative selections are arrays and non-representative are numbers.
                    const out = {};
                    Object.entries(state.selections || {}).forEach(([k, v]) => {
                        if (isMultiSelectPositionKey(k)) {
                            if (Array.isArray(v)) out[k] = v.slice(0, 2);
                            return;
                        }
                        if (!Array.isArray(v)) out[k] = v;
                    });

                    const res = await fetch(API_VOTE_SUBMIT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({ selections: out }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.status === 401) {
                        toLogin();
                        return;
                    }
                    if (!res.ok || !data || data.ok !== true) {
                        const msg = (data && data.error) ? data.error : 'Failed to submit vote.';
                        setStatusText(msg);
                        setSubmitEnabled();
                        return;
                    }

                    setStatusText('Vote submitted successfully.');
                    if (ballotRoot) ballotRoot.innerHTML = '';
                } catch (e) {
                    setStatusText('Failed to submit vote.');
                    setSubmitEnabled();
                }
            });
        }
    };

    const setNotifCount = (count) => {
        if (!notifCount) return;
        const n = Number(count || 0);
        const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
        notifCount.textContent = String(safe);
        notifCount.style.display = safe > 0 ? 'inline-block' : 'none';
        notifCount.setAttribute('aria-label', `${safe} unread notifications`);
    };

    const escapeHtml = (value) => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const formatNotificationTime = (value) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    const notificationIconForType = (type) => {
        const key = String(type || '').toLowerCase();
        if (key.includes('result')) return 'bi-bar-chart';
        if (key.includes('election')) return 'bi-calendar-event';
        if (key.includes('candidate')) return 'bi-person-badge';
        if (key.includes('receipt') || key.includes('vote')) return 'bi-check2-circle';
        return 'bi-bell';
    };

    const initNotifications = () => {
        if (!notifBell) {
            setNotifCount(0);
            return;
        }

        const parent = notifBell.parentElement;
        let dropdown = document.getElementById('studentNotifDropdown');
        let list = document.getElementById('studentNotifList');
        let markAllBtn = document.getElementById('studentNotifMarkAll');
        let notifWrap = document.getElementById('studentNotifWrap');
        let notifications = [];

        if (!notifWrap && parent) {
            notifWrap = document.createElement('div');
            notifWrap.className = 'student-notif-wrap';
            notifWrap.id = 'studentNotifWrap';
            parent.insertBefore(notifWrap, notifBell);
            notifWrap.appendChild(notifBell);
        }

        if (!dropdown && notifWrap) {
            dropdown = document.createElement('div');
            dropdown.className = 'student-notif-dropdown';
            dropdown.id = 'studentNotifDropdown';
            dropdown.setAttribute('aria-hidden', 'true');
            dropdown.innerHTML = `
                <div class="student-notif-header">
                    <div>
                        <strong>Notifications</strong>
                        <span id="studentNotifSub">Latest updates</span>
                    </div>
                    <button type="button" id="studentNotifMarkAll">Mark all read</button>
                </div>
                <div class="student-notif-list" id="studentNotifList">
                    <div class="student-notif-empty">Loading notifications...</div>
                </div>
            `;
            notifWrap.appendChild(dropdown);
            list = document.getElementById('studentNotifList');
            markAllBtn = document.getElementById('studentNotifMarkAll');
        }

        const setOpen = (open) => {
            if (!dropdown) return;
            if (open) {
                dropdown.setAttribute('data-open', '1');
                dropdown.setAttribute('aria-hidden', 'false');
            } else {
                dropdown.removeAttribute('data-open');
                dropdown.setAttribute('aria-hidden', 'true');
            }
            notifBell.setAttribute('aria-expanded', open ? 'true' : 'false');
        };

        const renderNotifications = () => {
            if (!list) return;
            if (!notifications.length) {
                list.innerHTML = '<div class="student-notif-empty">No notifications yet.</div>';
                return;
            }

            list.innerHTML = notifications.map((item) => {
                const unread = !item.read_at;
                const icon = notificationIconForType(item.type);
                return `
                    <button type="button" class="student-notif-item${unread ? ' is-unread' : ''}" data-id="${escapeHtml(item.id)}">
                        <span class="student-notif-icon"><i class="bi ${escapeHtml(icon)}"></i></span>
                        <span class="student-notif-copy">
                            <strong>${escapeHtml(item.title || 'Notification')}</strong>
                            <span>${escapeHtml(item.body || '')}</span>
                            <small>${escapeHtml(formatNotificationTime(item.created_at))}</small>
                        </span>
                    </button>
                `;
            }).join('');
        };

        const loadNotifications = async () => {
            try {
                const res = await fetch(API_NOTIFICATIONS, {
                    method: 'GET',
                    cache: 'no-store',
                    credentials: 'same-origin',
                });
                const data = await res.json().catch(() => ({}));
                if (res.status === 401) {
                    setNotifCount(0);
                    if (list) list.innerHTML = '<div class="student-notif-empty">Please sign in again.</div>';
                    return;
                }
                if (!res.ok || !data || data.ok !== true) throw new Error(data.error || 'Failed');
                notifications = Array.isArray(data.notifications) ? data.notifications : [];
                setNotifCount(data.unread_count || 0);
                renderNotifications();
            } catch (e) {
                if (list) list.innerHTML = '<div class="student-notif-empty">Unable to load notifications.</div>';
            }
        };

        const markRead = async (id) => {
            if (!id) return;
            try {
                const res = await fetch(API_NOTIFICATIONS_READ, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ id }),
                });
                if (!res.ok) return;
                notifications = notifications.map((item) => {
                    if (String(item.id) !== String(id)) return item;
                    return { ...item, read_at: item.read_at || new Date().toISOString() };
                });
                setNotifCount(notifications.filter((item) => !item.read_at).length);
                renderNotifications();
            } catch (e) { /* ignore */ }
        };

        const markAllRead = async () => {
            try {
                const res = await fetch(API_NOTIFICATIONS_READ_ALL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({}),
                });
                if (!res.ok) return;
                notifications = notifications.map((item) => ({
                    ...item,
                    read_at: item.read_at || new Date().toISOString(),
                }));
                setNotifCount(0);
                renderNotifications();
            } catch (e) { /* ignore */ }
        };

        notifBell.setAttribute('aria-haspopup', 'true');
        notifBell.setAttribute('aria-expanded', 'false');
        notifBell.addEventListener('click', (e) => {
            e.preventDefault();
            const open = dropdown && dropdown.getAttribute('data-open') === '1';
            setOpen(!open);
            if (!open) loadNotifications();
        });

        if (list) {
            list.addEventListener('click', (e) => {
                const item = e.target.closest('.student-notif-item');
                if (!item) return;
                markRead(item.getAttribute('data-id'));
            });
        }

        if (markAllBtn) markAllBtn.addEventListener('click', markAllRead);

        document.addEventListener('click', (e) => {
            if (!notifWrap || !dropdown || dropdown.getAttribute('data-open') !== '1') return;
            if (!notifWrap.contains(e.target)) setOpen(false);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') setOpen(false);
        });

        loadNotifications();
        setInterval(loadNotifications, 45000);
    };

    const enforceFaceEnrollment = async () => {
        const path = window.location.pathname || '';
        if (path.endsWith('/user_face_enrollment.html')) return true;

        try {
            const res = await fetch(API_FACE_ENROLLMENT_STATUS, {
                method: 'GET',
                cache: 'no-store',
                credentials: 'same-origin',
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 401) {
                toLogin();
                return false;
            }
            if (!res.ok || !data || data.ok !== true) return true;
            if (data.enrolled === true) return true;

            const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            window.location.replace(`/static/org_elecom/elecom_user/user_face_enrollment.html?next=${encodeURIComponent(next)}`);
            return false;
        } catch (e) {
            return true;
        }
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

        if (level === NET_LEVELS.UNAUTHORIZED) {
            systemStatusBadge.classList.add('is-offline');
            systemStatusText.textContent = 'Network Unauthorized';
            systemStatusBadge.setAttribute('title', 'This network is not registered by the admin');
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

    void (async () => {
        const allowed = await enforceFaceEnrollment();
        if (!allowed) return;

        initVotingStatus();
        initTotalCandidatesCard();
        initNotifications();
        startNetworkWatch();
        startPresenceHeartbeat();
        initOmnibusSlideshow();
        void loadAccountProfileName();
        showStudentWebDisclaimer();
    })();

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
            electionHelperText.textContent = 'Set the election schedule in Election Management.';
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

    void initElectionBallot();
});

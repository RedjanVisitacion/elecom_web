<?php
require_once '../../../db_connection.php';
if (session_status() === PHP_SESSION_NONE) { session_start(); }
$role = isset($_SESSION['role']) ? strtolower((string)$_SESSION['role']) : '';
$full_name = trim($_SESSION['full_name'] ?? '');
$student_id = $_SESSION['student_id'] ?? '';
$display_name = $full_name !== '' ? $full_name : ($student_id !== '' ? $student_id : ($role !== '' ? ucfirst($role) : 'User'));
$display_role = $role !== '' ? ucfirst($role) : 'User';
$icon_class = ($role === 'admin') ? 'bi bi-person-gear' : 'bi bi-person-circle';

// Get total candidates
$total_candidates = 0;
try {
    $stmt = $pdo->query('SELECT COUNT(*) AS total FROM candidates_registration');
    $row = $stmt->fetch();
    if ($row && isset($row['total'])) {
        $total_candidates = (int)$row['total'];
    }
} catch (Throwable $e) {
    $total_candidates = 0;
}
// Get total voters (all users with role = student)
$total_voters = 0;
try {
    $stmt2 = $pdo->prepare("SELECT COUNT(*) AS total FROM users WHERE role = :role");
    $stmt2->execute([':role' => 'student']);
    $row2 = $stmt2->fetch();
    if ($row2 && isset($row2['total'])) {
        $total_voters = (int)$row2['total'];
    }
} catch (Throwable $e) {
    $total_voters = 0;
}

// Get latest election window
$vw = null; $vw_status = 'No schedule';
$vw_status_class = 'secondary';
try {
    $stmt3 = $pdo->query('SELECT * FROM vote_windows ORDER BY id DESC LIMIT 1');
    $vw = $stmt3->fetch();
    if ($vw) {
        $now = time();
        $start_ts = $vw['start_at'] ? strtotime($vw['start_at']) : null;
        $end_ts = $vw['end_at'] ? strtotime($vw['end_at']) : null;
        if ($start_ts && $end_ts) {
            if ($now < $start_ts) { $vw_status = 'Upcoming'; $vw_status_class = 'warning'; }
            elseif ($now >= $start_ts && $now <= $end_ts) { $vw_status = 'Active'; $vw_status_class = 'success'; }
            else { $vw_status = 'Closed'; $vw_status_class = 'danger'; }
        }
    }
} catch (Throwable $e) { /* ignore */ }

// Get total cast votes (ballots submitted)
$total_cast_votes = 0;
try {
    // Primary: count rows in votes table if present
    $stmtCV = $pdo->query('SELECT COUNT(*) AS total FROM votes');
    $rowCV = $stmtCV->fetch();
    if ($rowCV && isset($rowCV['total'])) { $total_cast_votes = (int)$rowCV['total']; }
} catch (Throwable $e) {
    try {
        // Fallback: distinct voters in vote_items (assuming voter_id column)
        $stmtCV2 = $pdo->query('SELECT COUNT(DISTINCT voter_id) AS total FROM vote_items');
        $rowCV2 = $stmtCV2->fetch();
        if ($rowCV2 && isset($rowCV2['total'])) { $total_cast_votes = (int)$rowCV2['total']; }
    } catch (Throwable $e2) {
        $total_cast_votes = 0;
    }
}

// Compute total not voted (after totals above)
$total_not_voted = max(0, (int)$total_voters - (int)$total_cast_votes);

// Fetch recent voting history (latest 10)
$recentVotes = [];
try {
    // Primary: votes.student_id -> student.id_number
    $sql = "SELECT v.student_id AS sid, v.created_at AS voted_at, s.first_name, s.middle_name, s.last_name
            FROM votes v
            LEFT JOIN student s ON s.id_number = v.student_id
            ORDER BY v.created_at DESC
            LIMIT 10";
    $stmtRV = $pdo->query($sql);
    $recentVotes = $stmtRV->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    try {
        // Fallback: votes.voter_id -> student.id_number
        $sql1b = "SELECT v.voter_id AS sid, v.created_at AS voted_at, s.first_name, s.middle_name, s.last_name
                  FROM votes v
                  LEFT JOIN student s ON s.id_number = v.voter_id
                  ORDER BY v.created_at DESC
                  LIMIT 10";
        $stmtRV1b = $pdo->query($sql1b);
        $recentVotes = $stmtRV1b->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e1b) {
        try {
            // Fallback: votes.user_id -> users.user_id (if present)
            $sql2 = "SELECT v.user_id AS sid, v.created_at AS voted_at, u.first_name, u.middle_name, u.last_name
                     FROM votes v
                     LEFT JOIN users u ON u.user_id = v.user_id
                     ORDER BY v.created_at DESC
                     LIMIT 10";
            $stmtRV2 = $pdo->query($sql2);
            $recentVotes = $stmtRV2->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e2) {
            try {
                // Fallback: aggregate from vote_items by voter_id -> student.id_number
                $sql3 = "SELECT vi.voter_id AS sid, MAX(vi.created_at) AS voted_at, s.first_name, s.middle_name, s.last_name
                         FROM vote_items vi
                         LEFT JOIN student s ON s.id_number = vi.voter_id
                         GROUP BY vi.voter_id, s.first_name, s.middle_name, s.last_name
                         ORDER BY voted_at DESC
                         LIMIT 10";
                $stmtRV3 = $pdo->query($sql3);
                $recentVotes = $stmtRV3->fetchAll(PDO::FETCH_ASSOC);
            } catch (Throwable $e3) {
                $recentVotes = [];
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - ELECOM</title>
    <link rel="icon" href="../../../assets/logo/elecom_2.png" type="image/png">

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="../../../assets/css/app.css">
</head>
<body class="theme-elecom">

    <!-- Sidebar Overlay for Mobile -->
    <div class="sidebar-overlay" id="sidebarOverlay"></div>

    <!-- Sidebar -->
    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <div class="sidebar-header-content">
                <div class="logo-container">
                    <img src="../../../assets/logo/elecom_2.png" alt="ELECOM Logo">
                    <h4>Electoral Commission</h4>
                </div>
                <button class="btn-close-sidebar" id="closeSidebar">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        </div>
        <div class="sidebar-menu">
            <ul class="nav flex-column">
                <li class="nav-item">
                    <a class="nav-link active" href="elecom_dashboard.php">
                        <i class="bi bi-house-door"></i>
                        <span>Home</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="elecom_register_candidate.php">
                        <i class="bi bi-person-plus"></i>
                        <span>Register Candidate</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="elecom_election_date.php">
                        <i class="bi bi-calendar-event"></i>
                        <span>Set Election Dates</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="elecom_candidates.php">
                        <i class="bi bi-people"></i>
                        <span>Candidates</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="elecom_results.php">
                        <i class="bi bi-graph-up"></i>
                        <span>Results</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="elecom_reset.php">
                        <i class="bi bi-arrow-counterclockwise"></i>
                        <span>Reset Votes</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="elecom_reports.php">
                        <i class="bi bi-file-earmark-bar-graph"></i>
                        <span>Generate Reports</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="../../../dashboard.php">
                        <i class="bi bi-speedometer2"></i>
                        <span>SocieTree Dashboard</span>
                    </a>
                </li>
            </ul>
        </div>
    </div>

    <!-- Candidate Detail Modal -->
    <div class="modal fade" id="candidateModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="d-flex align-items-center gap-2">
                        <img id="cd_photo" src="" alt="Profile" class="rounded-circle border" style="width:42px;height:42px;object-fit:cover;display:none;">
                        <h5 class="modal-title mb-0">Candidate Details</h5>
                    </div>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="form-floating">
                                <input type="text" class="form-control" id="cd_name" readonly>
                                <label for="cd_name">Name</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-floating">
                                <input type="text" class="form-control" id="cd_student_id" readonly>
                                <label for="cd_student_id">Student ID</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-floating">
                                <input type="text" class="form-control" id="cd_position" readonly>
                                <label for="cd_position">Position</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-floating">
                                <input type="text" class="form-control" id="cd_org" readonly>
                                <label for="cd_org">Organization</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-floating">
                                <input type="text" class="form-control" id="cd_program" readonly>
                                <label for="cd_program">Program</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-floating">
                                <input type="text" class="form-control" id="cd_year" readonly>
                                <label for="cd_year">Year/Section</label>
                            </div>
                        </div>
                        <div class="col-12">
                            <label class="form-label">Platform</label>
                            <div class="p-2 border rounded" id="cd_platform" style="min-height:64px;"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
        <!-- Top Navbar -->
        <nav class="top-navbar">
            <button class="menu-toggle" id="menuToggle">
                <i class="bi bi-list"></i>
            </button>
            <div class="search-box position-relative" style="min-width:320px; flex:1 1 auto; max-width: 760px;">
                <div class="input-group input-group-lg">
                    <input id="candidateSearch" type="text" class="form-control" placeholder="Search candidate by name, ID, position, or organization..." autocomplete="off">
                    <button class="btn btn-outline-secondary" type="button" id="candidateSearchBtn">
                        <i class="bi bi-search"></i>
                    </button>
                </div>
                <div id="searchResults" class="list-group position-absolute w-100" style="z-index:1050; max-height: 320px; overflow:auto; display:none;"></div>
            </div>
            <div class="user-info">
                <!-- <div class="notifications">
                    <i class="bi bi-bell fs-5"></i>
                </div> -->
                <div class="user-avatar">
                    <i class="<?php echo $icon_class; ?>"></i>
                </div>
                <div class="user-details">
                    <div class="user-name"><?php echo htmlspecialchars($display_name); ?></div>
                    <div class="user-role"><?php echo htmlspecialchars($display_role); ?></div>
                </div>
            </div>
        </nav>

        <!-- Content Area -->
        <div class="content-area">
            <!-- Election Countdown -->
            <?php if ($vw && in_array($vw_status, ['Upcoming','Active'])): ?>
            <div class="mb-3">
                <div class="card shadow-sm border-0" style="background: linear-gradient(135deg, #9b8cf2 0%, #ff9ec7 100%); color: #fff;">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
                            <div>
                                <div class="fw-semibold fs-5">USTP-OROQUIETA Election</div>
                                <div class="opacity-75">General Election to legislative assembly</div>
                                <div class="small mt-2">
                                    <?php if ($vw_status === 'Upcoming'): ?>
                                        Voting opens on <?php echo htmlspecialchars(date('M d, Y h:i A', strtotime($vw['start_at']))); ?>
                                    <?php else: ?>
                                        Voting closes on <?php echo htmlspecialchars(date('M d, Y h:i A', strtotime($vw['end_at']))); ?>
                                    <?php endif; ?>
                                </div>
                            </div>
                            <div class="d-flex align-items-center gap-3">
                                <div class="text-center">
                                    <div id="ec_days" class="fs-3 fw-bold">00</div>
                                    <div class="small">days</div>
                                </div>
                                <div class="text-center">
                                    <div id="ec_hours" class="fs-3 fw-bold">00</div>
                                    <div class="small">hours</div>
                                </div>
                                <div class="text-center">
                                    <div id="ec_mins" class="fs-3 fw-bold">00</div>
                                    <div class="small">mins</div>
                                </div>
                                <div class="text-center">
                                    <div id="ec_secs" class="fs-3 fw-bold">00</div>
                                    <div class="small">sec</div>
                                </div>
                            </div>
                            <div>
                                <a href="elecom_election_date.php" class="btn btn-light text-primary fw-semibold">Manage</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <?php endif; ?>

            <!-- KPIs Row -->
            <div class="row g-3 mb-4">
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-body d-flex align-items-center">
                            <div class="me-3 text-primary">
                                <i class="bi bi-people-fill" style="font-size: 2rem;"></i>
                            </div>
                            <div>
                                <div class="small text-muted">Total Candidates</div>
                                <div class="h3 mb-0"><?php echo number_format($total_candidates); ?></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-body d-flex align-items-center">
                            <div class="me-3 text-success">
                                <i class="bi bi-person-vcard-fill" style="font-size: 2rem;"></i>
                            </div>
                            <div>
                                <div class="small text-muted">Total Voters</div>
                                <div class="h3 mb-0"><?php echo number_format($total_voters); ?></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-body d-flex align-items-center">
                            <div class="me-3 text-danger">
                                <i class="bi bi-check2-square" style="font-size: 2rem;"></i>
                            </div>
                            <div>
                                <div class="small text-muted">Total Cast Votes</div>
                                <div class="h3 mb-0"><?php echo number_format($total_cast_votes); ?></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-sm-6 col-lg-3">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-body d-flex align-items-center">
                            <div class="me-3 text-secondary">
                                <i class="bi bi-hourglass-split" style="font-size: 2rem;"></i>
                            </div>
                            <div>
                                <div class="small text-muted">Total Not Voted</div>
                                <div class="h3 mb-0"><?php echo number_format($total_not_voted); ?></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Voting History and Election Date -->
            <div class="row g-3">
                <div class="col-12 col-lg-6">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-body">
                            <h5 class="mb-3">Recent Voting History</h5>
                            <?php if (!empty($recentVotes)): ?>
                                <div style="max-height: 340px; overflow: auto;" id="recentVotesScroll">
                                <ul class="list-group list-group-flush">
                                    <?php foreach ($recentVotes as $rv): ?>
                                        <?php
                                            $nm = trim(($rv['first_name'] ?? '').' '.($rv['middle_name'] ?? '').' '.($rv['last_name'] ?? ''));
                                            $nm = $nm !== '' ? $nm : ($rv['sid'] ?? '');
                                            $dt = '';
                                            try {
                                                if (!empty($rv['voted_at'])) {
                                                    $d = new DateTime($rv['voted_at']);
                                                    $d->modify('-1 hour');
                                                    $dt = $d->format('M d, Y h:i A');
                                                }
                                            } catch (Throwable $e) {
                                                $dt = isset($rv['voted_at']) ? date('M d, Y h:i A', strtotime($rv['voted_at'].' -1 hour')) : '';
                                            }
                                        ?>
                                        <li class="list-group-item d-flex justify-content-between align-items-center">
                                            <div class="d-flex align-items-center gap-2">
                                                <i class="bi bi-person-check text-success"></i>
                                                <div>
                                                    <div class="fw-semibold"><?php echo htmlspecialchars($nm); ?></div>
                                                    <div class="small text-muted"><?php echo htmlspecialchars($rv['sid'] ?? ''); ?></div>
                                                </div>
                                            </div>
                                            <div class="small text-muted"><?php echo htmlspecialchars($dt); ?></div>
                                        </li>
                                    <?php endforeach; ?>
                                </ul>
                                </div>
                            <?php else: ?>
                                <div class="text-muted">No votes have been cast yet.</div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-lg-6">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-body">
                            <div class="d-flex align-items-center justify-content-between mb-2">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="bi bi-calendar-event text-info" style="font-size: 1.5rem;"></i>
                                    <div class="fw-semibold">Election Date</div>
                                </div>
                                <span class="badge bg-<?php echo htmlspecialchars($vw_status_class); ?>"><?php echo htmlspecialchars($vw_status); ?></span>
                            </div>
                            <?php if ($vw): ?>
                                <div class="small text-muted">Start</div>
                                <div class="mb-2"><?php echo htmlspecialchars(date('M d, Y h:i A', strtotime($vw['start_at']))); ?></div>
                                <div class="small text-muted">End</div>
                                <div class="mb-2"><?php echo htmlspecialchars(date('M d, Y h:i A', strtotime($vw['end_at']))); ?></div>
                                <?php if (!empty($vw['results_at'])): ?>
                                    <div class="small text-muted">Results</div>
                                    <div class="mb-2"><?php echo htmlspecialchars(date('M d, Y h:i A', strtotime($vw['results_at']))); ?></div>
                                <?php endif; ?>
                                
                            <?php else: ?>
                                <div class="text-muted">No schedule set. Configure it in <a href="elecom_election_date.php">Set Election Dates</a>.</div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js" integrity="sha384-FKyoEForCGlyvwx9Hj09JcYn3nv7wiPVlz7YYwJrWVcXK/BmnVDxM+D2scQbITxI" crossorigin="anonymous"></script>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const menuToggle = document.getElementById('menuToggle');
            const sidebar = document.getElementById('sidebar');
            const sidebarOverlay = document.getElementById('sidebarOverlay');
            const closeSidebar = document.getElementById('closeSidebar');

            menuToggle.addEventListener('click', function() {
                sidebar.classList.add('active');
                sidebarOverlay.classList.add('active');
            });

            closeSidebar.addEventListener('click', function() {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            });

            sidebarOverlay.addEventListener('click', function() {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            });

            document.querySelectorAll('.sidebar .nav-link').forEach(link => {
                link.addEventListener('click', function() {
                    if (window.innerWidth <= 992) {
                        sidebar.classList.remove('active');
                        sidebarOverlay.classList.remove('active');
                    }
                });
            });

            window.addEventListener('resize', function() {
                if (window.innerWidth > 992) {
                    sidebar.classList.remove('active');
                    sidebarOverlay.classList.remove('active');
                }
            });

            // Candidate Search Logic
            const input = document.getElementById('candidateSearch');
            const btn = document.getElementById('candidateSearchBtn');
            const results = document.getElementById('searchResults');
            let debounceTimer = null;

            function hideResults() {
                results.style.display = 'none';
                results.innerHTML = '';
            }

            function showResults(items) {
                if (!items || items.length === 0) { hideResults(); return; }
                const placeholder = 'https://via.placeholder.com/40x40?text=%20';
                results.innerHTML = items.map(item => {
                    const name = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(' ');
                    const photo = item.photo_url && item.photo_url.startsWith('http') ? item.photo_url : placeholder;
                    return `\n<a href="#" class="list-group-item list-group-item-action" data-id="${item.id}">\n  <div class="d-flex align-items-center gap-2">\n    <img src="${photo}" alt="" class="rounded-circle border" style="width:40px;height:40px;object-fit:cover;">\n    <div class="flex-grow-1">\n      <div class="d-flex w-100 justify-content-between">\n        <strong>${name}</strong>\n        <small>${item.student_id || ''}</small>\n      </div>\n      <div class="small text-muted">${item.position || ''}${item.organization ? ' • ' + item.organization : ''}</div>\n    </div>\n  </div>\n</a>`;
                }).join('');
                results.style.display = 'block';
            }

            async function doSearch() {
                const q = input.value.trim();
                if (!q || q.length < 2) { hideResults(); return; }
                try {
                    const res = await fetch(`elecom_candidates_api.php?action=search&q=${encodeURIComponent(q)}`);
                    const data = await res.json();
                    showResults(data);
                } catch (e) { hideResults(); }
            }

            input.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(doSearch, 250);
            });
            btn.addEventListener('click', (e) => { e.preventDefault(); doSearch(); });

            document.addEventListener('click', (e) => {
                if (!results.contains(e.target) && e.target !== input) {
                    hideResults();
                }
            });

            results.addEventListener('click', async (e) => {
                const link = e.target.closest('a[data-id]');
                if (!link) return;
                e.preventDefault();
                const id = link.getAttribute('data-id');
                hideResults();
                try {
                    const res = await fetch(`elecom_candidates_api.php?action=detail&id=${encodeURIComponent(id)}`);
                    const d = await res.json();
                    if (d && !d.error) {
                        const name = [d.first_name, d.middle_name, d.last_name].filter(Boolean).join(' ');
                        document.getElementById('cd_name').value = name;
                        document.getElementById('cd_student_id').value = d.student_id || '';
                        document.getElementById('cd_position').value = d.position || '';
                        document.getElementById('cd_org').value = d.organization || '';
                        document.getElementById('cd_program').value = d.program || '';
                        document.getElementById('cd_year').value = d.year_section || '';
                        document.getElementById('cd_platform').textContent = d.platform || '';
                        const img = document.getElementById('cd_photo');
                        if (d.photo_url && d.photo_url.startsWith('http')) {
                            img.src = d.photo_url; img.style.display = 'block';
                        } else { img.style.display = 'none'; }
                        const modal = new bootstrap.Modal(document.getElementById('candidateModal'));
                        modal.show();
                    }
                } catch (err) {
                    // ignore
                }
            });

            // Election Countdown timer
            <?php if ($vw && in_array($vw_status, ['Upcoming','Active'])): ?>
            (function(){
                // Build target timestamp in Asia/Manila to avoid client TZ differences
                <?php
                    $dt_str = ($vw_status === 'Upcoming') ? ($vw['start_at'] ?? '') : ($vw['end_at'] ?? '');
                    $target_ts_ms = 0;
                    try {
                        if ($dt_str !== '') {
                            $tz = new DateTimeZone('Asia/Manila');
                            $dt = new DateTime($dt_str, $tz);
                            $target_ts_ms = $dt->getTimestamp() * 1000;
                        }
                    } catch (Throwable $e) { $target_ts_ms = 0; }
                ?>
                const targetTs = <?php echo json_encode($target_ts_ms); ?>;
                const daysEl = document.getElementById('ec_days');
                const hoursEl = document.getElementById('ec_hours');
                const minsEl = document.getElementById('ec_mins');
                const secsEl = document.getElementById('ec_secs');
                if (!daysEl || !hoursEl || !minsEl || !secsEl) return;
                const pad = (n) => String(n).padStart(2,'0');
                function tick(){
                    const now = Date.now();
                    let diff = Math.max(0, targetTs - now);
                    const totalHours = Math.floor(Math.max(0, targetTs - now) / 3600000);
                    const d = Math.floor(diff / 86400000);
                    diff -= d * 86400000;
                    const h = Math.floor(diff / 3600000);
                    diff -= h * 3600000;
                    const m = Math.floor(diff / 60000);
                    diff -= m * 60000;
                    const s = Math.floor(diff / 1000);
                    daysEl.textContent = pad(d);
                    hoursEl.textContent = String(totalHours);
                    minsEl.textContent = pad(m);
                    secsEl.textContent = pad(s);
                    if (targetTs <= now) {
                        clearInterval(timer);
                        setTimeout(() => location.reload(), 1500);
                    }
                }
                tick();
                const timer = setInterval(tick, 1000);
            })();
            <?php endif; ?>
        });
    </script>
</body>
</html>

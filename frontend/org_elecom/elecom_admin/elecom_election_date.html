<?php
require_once '../../../db_connection.php';
if (session_status() === PHP_SESSION_NONE) { session_start(); }
$role = isset($_SESSION['role']) ? strtolower((string)$_SESSION['role']) : '';
$full_name = trim($_SESSION['full_name'] ?? '');
$student_id = $_SESSION['student_id'] ?? '';
$display_name = $full_name !== '' ? $full_name : ($student_id !== '' ? $student_id : ($role !== '' ? ucfirst($role) : 'User'));
$display_role = $role !== '' ? ucfirst($role) : 'User';
$icon_class = ($role === 'admin') ? 'bi bi-person-gear' : 'bi bi-person-circle';

$success = null; $error = null;
$start_at = ''; $end_at = ''; $results_at = ''; $note = '';

// Load current window if exists
try {
    $stmt = $pdo->query('SELECT * FROM vote_windows ORDER BY id DESC LIMIT 1');
    if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $start_at = $row['start_at'] ? date('Y-m-d\TH:i', strtotime($row['start_at'])) : '';
        $end_at = $row['end_at'] ? date('Y-m-d\TH:i', strtotime($row['end_at'])) : '';
        $results_at = $row['results_at'] ? date('Y-m-d\TH:i', strtotime($row['results_at'])) : '';
        $note = $row['note'] ?? '';
    }
} catch (Throwable $e) { /* ignore */ }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $start_at_in = trim($_POST['start_at'] ?? '');
    $end_at_in = trim($_POST['end_at'] ?? '');
    $results_at_in = trim($_POST['results_at'] ?? '');
    $note_in = trim($_POST['note'] ?? '');
    $admin_password = (string)($_POST['admin_password'] ?? '');

    if ($start_at_in === '' || $end_at_in === '') {
        $error = 'Start and End date/time are required.';
    } elseif (strtotime($end_at_in) <= strtotime($start_at_in)) {
        $error = 'End date/time must be after Start date/time.';
    } elseif ($role !== 'admin') {
        $error = 'Only admins can update election dates.';
    } else {
        try {
            $stmtU = $pdo->prepare('SELECT password_hash FROM users WHERE student_id = ? AND role = ? LIMIT 1');
            $stmtU->execute([$student_id, 'admin']);
            $u = $stmtU->fetch(PDO::FETCH_ASSOC);
            if (!$u) {
                $error = 'Admin account not found.';
            } else {
                $hash = (string)$u['password_hash'];
                $ok = false;
                if (preg_match('/^\$2[aby]\$/', $hash)) { $ok = password_verify($admin_password, $hash); }
                else { $ok = hash_equals($hash, $admin_password); }
                if (!$ok) {
                    $error = 'Invalid admin password.';
                } else {
                    // Upsert: update latest row if exists else insert
                    $pdo->beginTransaction();
                    $current = $pdo->query('SELECT id FROM vote_windows ORDER BY id DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC);
                    if ($current) {
                        $upd = $pdo->prepare('UPDATE vote_windows SET start_at = :s, end_at = :e, results_at = :r, note = :n, updated_at = NOW() WHERE id = :id');
                        $upd->execute([':s'=>$start_at_in, ':e'=>$end_at_in, ':r'=>($results_at_in?:null), ':n'=>($note_in?:null), ':id'=>$current['id']]);
                    } else {
                        $ins = $pdo->prepare('INSERT INTO vote_windows (start_at, end_at, results_at, note, created_at) VALUES (:s,:e,:r,:n,NOW())');
                        $ins->execute([':s'=>$start_at_in, ':e'=>$end_at_in, ':r'=>($results_at_in?:null), ':n'=>($note_in?:null)]);
                    }
                    $pdo->commit();
                    $success = 'Election dates saved.';
                    $start_at = date('Y-m-d\TH:i', strtotime($start_at_in));
                    $end_at = date('Y-m-d\TH:i', strtotime($end_at_in));
                    $results_at = $results_at_in ? date('Y-m-d\TH:i', strtotime($results_at_in)) : '';
                    $note = $note_in;
                }
            }
        } catch (Throwable $ex) {
            if ($pdo->inTransaction()) { $pdo->rollBack(); }
            $error = 'Failed to save election dates.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Set Election Dates - ELECOM</title>
    <link rel="icon" href="../../../assets/logo/elecom_2.png" type="image/png">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="../../../assets/css/app.css">
</head>
<body class="theme-elecom">
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <div class="sidebar-header-content">
                <div class="logo-container">
                    <img src="../../../assets/logo/elecom_2.png" alt="ELECOM Logo">
                    <h4>Electoral Commission</h4>
                </div>
                <button class="btn-close-sidebar" id="closeSidebar"><i class="bi bi-x-lg"></i></button>
            </div>
        </div>
        <div class="sidebar-menu">
            <ul class="nav flex-column">
                <li class="nav-item"><a class="nav-link" href="elecom_dashboard.php"><i class="bi bi-house-door"></i><span>Home</span></a></li>
                <li class="nav-item"><a class="nav-link" href="elecom_register_candidate.php"><i class="bi bi-person-plus"></i><span>Register Candidate</span></a></li>
                <li class="nav-item"><a class="nav-link active" href="elecom_election_date.php"><i class="bi bi-calendar-event"></i><span>Set Election Dates</span></a></li>
                <li class="nav-item"><a class="nav-link" href="elecom_candidates.php"><i class="bi bi-people"></i><span>Candidates</span></a></li>
                <li class="nav-item"><a class="nav-link" href="elecom_results.php"><i class="bi bi-graph-up"></i><span>Results</span></a></li>
                <li class="nav-item"><a class="nav-link" href="elecom_reset.php"><i class="bi bi-arrow-counterclockwise"></i><span>Reset Votes</span></a></li>
                <li class="nav-item">
                    <a class="nav-link" href="elecom_reports.php">
                        <i class="bi bi-file-earmark-bar-graph"></i>
                        <span>Generate Reports</span>
                    </a>
                </li>
                <a class="nav-link" href="../../../dashboard.php"><i class="bi bi-speedometer2"></i><span>SocieTree Dashboard</span></a>
            </ul>
        </div>
    </div>

    <div class="main-content">
        <nav class="top-navbar d-flex align-items-center gap-3">
            <button class="menu-toggle" id="menuToggle"><i class="bi bi-list"></i></button>
            <div class="user-info">
                <div class="user-avatar"><i class="<?= htmlspecialchars($icon_class) ?>"></i></div>
                <div class="user-details">
                    <div class="user-name"><?= htmlspecialchars($display_name) ?></div>
                    <div class="user-role"><?= htmlspecialchars($display_role) ?></div>
                </div>
            </div>
        </nav>

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

        <div class="content-area">
            <?php if ($success): ?><div class="alert alert-success"><?= htmlspecialchars($success) ?></div><?php endif; ?>
            <?php if ($error): ?><div class="alert alert-danger"><?= htmlspecialchars($error) ?></div><?php endif; ?>

            <form method="post" class="card p-3 shadow-sm border-0">
                <h5 class="mb-3"><i class="bi bi-calendar3 me-2"></i>Election Window</h5>
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label">Start Date & Time</label>
                        <input type="datetime-local" name="start_at" class="form-control" value="<?= htmlspecialchars($start_at) ?>" required>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">End Date & Time</label>
                        <input type="datetime-local" name="end_at" class="form-control" value="<?= htmlspecialchars($end_at) ?>" required>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Results Date & Time</label>
                        <input type="datetime-local" name="results_at" class="form-control" value="<?= htmlspecialchars($results_at) ?>">
                    </div>
                    <div class="col-12">
                        <label class="form-label">Note (optional)</label>
                        <input type="text" name="note" class="form-control" value="<?= htmlspecialchars($note) ?>" placeholder="Vote wisely">
                    </div>
                </div>

                <div class="mt-4 p-3 border rounded bg-light">
                    <h6 class="mb-3"><i class="bi bi-shield-lock me-2"></i>Confirmation</h6>
                    <div class="row g-3 align-items-end">
                        <div class="col-md-6">
                            <label class="form-label">Admin Password</label>
                            <input type="password" name="admin_password" class="form-control" required>
                        </div>
                        <div class="col-md-6 text-end">
                            <button type="submit" class="btn btn-primary btn-lg">Save Dates</button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const closeSidebar = document.getElementById('closeSidebar');
        menuToggle.addEventListener('click', function(){ sidebar.classList.add('active'); sidebarOverlay.classList.add('active'); });
        closeSidebar.addEventListener('click', function(){ sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); });
        sidebarOverlay.addEventListener('click', function(){ sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); });
        window.addEventListener('resize', function(){ if (window.innerWidth > 992) { sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); } });

        // Removed search features on this page
    });
    </script>
</body>
</html>

<?php
require_once '../../../db_connection.php';
if (session_status() === PHP_SESSION_NONE) { session_start(); }
$role = isset($_SESSION['role']) ? strtolower((string)$_SESSION['role']) : '';
$full_name = trim($_SESSION['full_name'] ?? '');
$student_id = $_SESSION['student_id'] ?? '';
$display_name = $full_name !== '' ? $full_name : ($student_id !== '' ? $student_id : ($role !== '' ? ucfirst($role) : 'User'));
$display_role = $role !== '' ? ucfirst($role) : 'User';
$icon_class = ($role === 'admin') ? 'bi bi-person-gear' : 'bi bi-person-circle';

$success_msg = '';
$error_msg = '';

function ensure_admin_page() {
    global $role;
    if ($role !== 'admin') {
        http_response_code(403);
        echo '<!doctype html><html><body><div style="padding:2rem;font-family:sans-serif;">Forbidden</div></body></html>';
        exit;
    }
}

// Handle reset votes
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['reset']) && $_POST['reset'] === '1') {
    ensure_admin_page();
    $confirm = trim($_POST['confirm'] ?? '');
    if (strtoupper($confirm) !== 'RESET') {
        $error_msg = 'Type RESET to confirm.';
    } else {
        try {
            $pdo->beginTransaction();
            // Delete children first
            $pdo->exec('DELETE FROM vote_items');
            $pdo->exec('DELETE FROM vote_results');
            $pdo->exec('DELETE FROM votes');
            $pdo->commit();
            $success_msg = 'All votes have been reset.';
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) { $pdo->rollBack(); }
            $error_msg = 'Failed to reset votes.';
        }
    }
}

// Handle reset notifications
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['reset_notifications']) && $_POST['reset_notifications'] === '1') {
    ensure_admin_page();
    $confirmN = trim($_POST['confirm_notifications'] ?? '');
    if (strtoupper($confirmN) !== 'CLEAR') {
        $error_msg = 'Type CLEAR to confirm notifications reset.';
    } else {
        try {
            $pdo->exec('DELETE FROM user_notifications');
            $success_msg = 'All notifications have been cleared.';
        } catch (Throwable $e) {
            $error_msg = 'Failed to clear notifications.';
        }
    }
}

// Fetch current counts
$votes_count = 0; $vote_items_count = 0; $notif_count = 0;
try {
    $votes_count = (int)$pdo->query('SELECT COUNT(*) FROM votes')->fetchColumn();
} catch (Throwable $e) { $votes_count = 0; }
try {
    $vote_items_count = (int)$pdo->query('SELECT COUNT(*) FROM vote_items')->fetchColumn();
} catch (Throwable $e) { $vote_items_count = 0; }
try {
    $notif_count = (int)$pdo->query('SELECT COUNT(*) FROM user_notifications')->fetchColumn();
} catch (Throwable $e) { $notif_count = 0; }
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Votes - ELECOM</title>
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
                <li class="nav-item"><a class="nav-link" href="elecom_election_date.php"><i class="bi bi-calendar-event"></i><span>Set Election Dates</span></a></li>
                <li class="nav-item"><a class="nav-link" href="elecom_candidates.php"><i class="bi bi-people"></i><span>Candidates</span></a></li>
                <li class="nav-item"><a class="nav-link" href="elecom_results.php"><i class="bi bi-graph-up"></i><span>Results</span></a></li>
                <li class="nav-item"><a class="nav-link active" href="elecom_reset.php"><i class="bi bi-arrow-counterclockwise"></i><span>Reset Votes</span></a>
                <li class="nav-item">
                    <a class="nav-link" href="elecom_reports.php">
                        <i class="bi bi-file-earmark-bar-graph"></i>
                        <span>Generate Reports</span>
                    </a>
                </li>
                </li><a class="nav-link" href="../../../dashboard.php"><i class="bi bi-speedometer2"></i><span>SocieTree Dashboard</span></a>
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

        <div class="content-area">
            <div class="card border-0 shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="mb-0">Reset Votes</h5>
                    </div>

                    <?php if ($success_msg): ?>
                        <div class="alert alert-success" role="alert"><?= htmlspecialchars($success_msg) ?></div>
                    <?php endif; ?>
                    <?php if ($error_msg): ?>
                        <div class="alert alert-danger" role="alert"><?= htmlspecialchars($error_msg) ?></div>
                    <?php endif; ?>

                    <div class="row g-3 mb-3">
                        <div class="col-md-4">
                            <div class="p-3 border rounded bg-light">
                                <div class="d-flex justify-content-between">
                                    <span class="fw-semibold">Total Votes</span>
                                    <span class="badge text-bg-secondary"><?= (int)$votes_count ?></span>
                                </div>
                                <div class="small text-muted">Rows in votes table</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 border rounded bg-light">
                                <div class="d-flex justify-content-between">
                                    <span class="fw-semibold">Total Vote Items</span>
                                    <span class="badge text-bg-secondary"><?= (int)$vote_items_count ?></span>
                                </div>
                                <div class="small text-muted">Rows in vote_items table</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 border rounded bg-light">
                                <div class="d-flex justify-content-between">
                                    <span class="fw-semibold">Total Notifications</span>
                                    <span class="badge text-bg-secondary"><?= (int)$notif_count ?></span>
                                </div>
                                <div class="small text-muted">Rows in user_notifications table</div>
                            </div>
                        </div>
                    </div>

                    <?php if ($role === 'admin'): ?>
                    <form method="post" class="mb-4" onsubmit="return confirm('This will permanently delete all votes. Continue?');">
                        <input type="hidden" name="reset" value="1">
                        <div class="mb-3">
                            <label class="form-label">Type RESET to confirm</label>
                            <input type="text" name="confirm" class="form-control" required>
                        </div>
                        <button type="submit" class="btn btn-danger">
                            <i class="bi bi-exclamation-triangle"></i> Reset All Votes
                        </button>
                    </form>
                    <form method="post" onsubmit="return confirm('This will permanently delete all notifications in user_notifications. Continue?');">
                        <input type="hidden" name="reset_notifications" value="1">
                        <div class="mb-3">
                            <label class="form-label">Type CLEAR to confirm</label>
                            <input type="text" name="confirm_notifications" class="form-control" required>
                        </div>
                        <button type="submit" class="btn btn-outline-danger">
                            <i class="bi bi-bell-slash"></i> Clear All Notifications
                        </button>
                    </form>
                    <?php else: ?>
                        <div class="alert alert-warning mb-0">Only admins can reset votes.</div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
    <script>
    document.addEventListener('DOMContentLoaded', function(){
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const closeSidebar = document.getElementById('closeSidebar');
        menuToggle.addEventListener('click', function(){ sidebar.classList.add('active'); sidebarOverlay.classList.add('active'); });
        closeSidebar.addEventListener('click', function(){ sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); });
        sidebarOverlay.addEventListener('click', function(){ sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); });
        window.addEventListener('resize', function(){ if (window.innerWidth > 992) { sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); } });
    });
    </script>
</body>
</html>

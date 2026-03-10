<?php
require_once '../../../db_connection.php';
if (session_status() === PHP_SESSION_NONE) { session_start(); }
$role = isset($_SESSION['role']) ? strtolower((string)$_SESSION['role']) : '';
$full_name = trim($_SESSION['full_name'] ?? '');
$student_id = $_SESSION['student_id'] ?? '';
$display_name = $full_name !== '' ? $full_name : ($student_id !== '' ? $student_id : ($role !== '' ? ucfirst($role) : 'User'));
$display_role = $role !== '' ? ucfirst($role) : 'User';
$icon_class = ($role === 'admin') ? 'bi bi-person-gear' : 'bi bi-person-circle';

// Fetch candidates with vote counts (fallback to 0 if no rows)
$sql = "SELECT c.id, c.student_id, c.first_name, c.middle_name, c.last_name,
               c.organization, c.position, c.program, c.year_section,
               c.party_name, c.candidate_type, c.photo_url, c.party_logo_url,
               COALESCE(vv.cnt, 0) AS votes
        FROM candidates_registration c
        LEFT JOIN (
           SELECT vi.candidate_id AS cid, COUNT(*) AS cnt
           FROM vote_items vi
           GROUP BY vi.candidate_id
        ) vv ON vv.cid = c.id
        ORDER BY c.party_name, c.organization, c.position, c.last_name, c.first_name";

$candidates = [];
try {
    $stmt = $pdo->query($sql);
    $candidates = $stmt ? $stmt->fetchAll() : [];
} catch (Throwable $e) { $candidates = []; }

// Position orders (must be defined before using position_order_index)
$USG_ORDER = ['President','Vice President','General Secretary','Associate Secretary','Treasurer','Auditor','Public Information Officer','P.I.O','IT Representative','BSIT Representative','BTLED Representative','BFPT Representative'];
$ORG_ORDER = ['President','Vice President','General Secretary','Associate Secretary','Treasurer','Auditor','Public Information Officer','P.I.O'];
function position_order_index($org, $pos){
    global $USG_ORDER, $ORG_ORDER;
    $orgKey = strtoupper((string)$org);
    $list = in_array($orgKey, ['SITE','PAFE','AFPROTECHS']) ? $ORG_ORDER : $USG_ORDER;
    $i = -1;
    foreach ($list as $k => $label) { if (stripos((string)$pos, $label) !== false) { $i = $k; break; } }
    return $i === -1 ? 999 : $i;
}

// Aggregations for charts
$org_totals = [];
$position_totals = [];
foreach ($candidates as $c) {
    $orgKey = strtoupper((string)($c['organization'] ?? 'USG'));
    $posKey = (string)($c['position'] ?? 'Unspecified');
    $votes = (int)($c['votes'] ?? 0);
    if (!isset($org_totals[$orgKey])) $org_totals[$orgKey] = 0;
    $org_totals[$orgKey] += $votes;
    if (!isset($position_totals[$posKey])) $position_totals[$posKey] = 0;
    $position_totals[$posKey] += $votes;
}
// Sort positions using USG order as baseline
uksort($position_totals, function($a,$b){
    $ia = position_order_index('USG',$a); $ib = position_order_index('USG',$b);
    if ($ia !== $ib) return $ia - $ib; return strcmp($a,$b);
});
function h($s){ return htmlspecialchars((string)$s); }

// Grouping Party -> Organization -> Position
$grouped = [];
foreach ($candidates as $c) {
    $party = strtoupper($c['party_name'] ?? 'Independent');
    $org = strtoupper($c['organization'] ?? 'USG');
    $pos = $c['position'] ?? 'Unspecified';
    if(!isset($grouped[$party])) $grouped[$party] = [];
    if(!isset($grouped[$party][$org])) $grouped[$party][$org] = [];
    if(!isset($grouped[$party][$org][$pos])) $grouped[$party][$org][$pos] = [];
    $grouped[$party][$org][$pos][] = $c;
}

// Sort parties (Independent last), orgs (USG,SITE,PAFE,AFPROTECHS, others), positions by order list
$party_keys = array_keys($grouped);
usort($party_keys, function($a,$b){
    $ia = ($a === 'INDEPENDENT') ? 1 : 0; $ib = ($b === 'INDEPENDENT') ? 1 : 0;
    if ($ia !== $ib) return $ia - $ib;
    return strcmp($a,$b);
});

$ORG_PRIORITY = ['USG'=>0,'SITE'=>1,'PAFE'=>2,'AFPROTECHS'=>3];
function org_cmp($a,$b){
    global $ORG_PRIORITY;
    $aa = $ORG_PRIORITY[$a] ?? 999; $bb = $ORG_PRIORITY[$b] ?? 999;
    if ($aa !== $bb) return $aa - $bb; return strcmp($a,$b);
}

?><!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Results - ELECOM</title>
  <link rel="icon" href="../../../assets/logo/elecom_2.png" type="image/png">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="../../../assets/css/app.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
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
        <li class="nav-item"><a class="nav-link active" href="elecom_results.php"><i class="bi bi-graph-up"></i><span>Results</span></a></li>
        <li class="nav-item"><a class="nav-link" href="elecom_reset.php"><i class="bi bi-arrow-counterclockwise"></i><span>Reset Votes</span></a></li>
        <li class="nav-item">
                    <a class="nav-link" href="elecom_reports.php">
                        <i class="bi bi-file-earmark-bar-graph"></i>
                        <span>Generate Reports</span>
                    </a>
                </li>
        <li class="nav-item"><a class="nav-link" href="../../../dashboard.php"><i class="bi bi-speedometer2"></i><span>SocieTree Dashboard</span></a></li>
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
          <h3 class="mb-4 text-center">Election Results</h3>
          <?php if (!empty($candidates)) { ?>
            <div class="row g-3 mb-4">
              <div class="col-12 col-lg-6">
                <div class="card border-0 shadow-sm h-100">
                  <div class="card-body">
                    <h6 class="text-muted mb-3">Overall Vote Distribution</h6>
                    <div style="height:280px"><canvas id="orgPie"></canvas></div>
                  </div>
                </div>
              </div>
              <div class="col-12 col-lg-6">
                <div class="card border-0 shadow-sm h-100">
                  <div class="card-body">
                    <h6 class="text-muted mb-3">Votes by Position</h6>
                    <div style="height:280px"><canvas id="posBar"></canvas></div>
                  </div>
                </div>
              </div>
            </div>
          <?php } ?>
          <?php if (empty($candidates)) { ?>
            <div class="text-muted">No candidates or votes data.</div>
          <?php } else { ?>
            <?php foreach ($party_keys as $party) { ?>
              <?php
                // party logo from any candidate
                $logo = '';
                foreach ($grouped[$party] as $org => $posMap) {
                  foreach ($posMap as $pos => $arr) {
                    foreach ($arr as $x) { if (!empty($x['party_logo_url']) && strpos($x['party_logo_url'],'http')===0) { $logo = $x['party_logo_url']; break 3; } }
                  }
                }
                $totalParty = 0;
                foreach ($grouped[$party] as $org => $posMap) { foreach ($posMap as $pos => $arr) { foreach ($arr as $x) { $totalParty += (int)$x['votes']; } } }
              ?>
              <div class="p-2 px-3 bg-light border rounded d-flex align-items-center justify-content-between mt-3">
                <div class="d-flex align-items-center gap-2">
                  <?php if ($logo): ?>
                    <img src="<?= h($logo) ?>" class="rounded-circle border" style="width:28px;height:28px;object-fit:cover;" alt="">
                  <?php else: ?>
                    <div class="rounded-circle border d-flex align-items-center justify-content-center bg-light" style="width:28px;height:28px;"><i class="bi bi-flag text-danger"></i></div>
                  <?php endif; ?>
                  <span class="fw-semibold"><?= h($party) ?></span>
                </div>
                <span class="badge text-bg-secondary"><?= (int)$totalParty ?> votes</span>
              </div>
              <?php
                $orgKeys = array_keys($grouped[$party]);
                usort($orgKeys, 'org_cmp');
                foreach ($orgKeys as $org) {
                  $positions = array_keys($grouped[$party][$org]);
                  usort($positions, function($a,$b) use ($org){
                    $ia = position_order_index($org,$a); $ib = position_order_index($org,$b);
                    if ($ia !== $ib) return $ia - $ib; return strcmp($a,$b);
                  });
              ?>
                <div class="ps-2 pt-3 pb-2 d-flex align-items-center gap-2"><i class="bi bi-building text-info"></i><span class="fw-semibold fs-5 text-primary"><?= h($org) ?></span></div>
                <?php foreach ($positions as $pos) { ?>
                  <div class="ps-4 pt-2 pb-1 small text-muted fw-semibold fs-6 text-primary"><?= h($pos) ?></div>
                  <div class="vstack gap-2 ps-3">
                    <?php
                      // sort candidates in position by votes desc, then name
                      usort($grouped[$party][$org][$pos], function($x,$y){
                        $dx = (int)$y['votes'] <=> (int)$x['votes'];
                        if ($dx !== 0) return $dx;
                        $nx = trim(($x['last_name'] ?? '').' '.($x['first_name'] ?? ''));
                        $ny = trim(($y['last_name'] ?? '').' '.($y['first_name'] ?? ''));
                        return strcmp($nx,$ny);
                      });
                      // total votes for this position
                      $totalPosVotes = 0; foreach ($grouped[$party][$org][$pos] as $tmp) { $totalPosVotes += (int)($tmp['votes'] ?? 0); }
                      foreach ($grouped[$party][$org][$pos] as $it) {
                        $name = trim(($it['first_name'] ?? '').' '.($it['middle_name'] ?? '').' '.($it['last_name'] ?? ''));
                        $photo = (!empty($it['photo_url']) && strpos($it['photo_url'],'http')===0) ? $it['photo_url'] : '';
                        $votes = (int)($it['votes'] ?? 0);
                        $pct = $totalPosVotes > 0 ? round(($votes / $totalPosVotes) * 100, 1) : 0;
                      ?>
                      <div class="p-3 border rounded d-flex align-items-center gap-3 bg-white shadow-sm">
                        <?php if ($photo): ?>
                          <img src="<?= h($photo) ?>" class="rounded-circle border" style="width:40px;height:40px;object-fit:cover;" alt="">
                        <?php else: ?>
                          <div class="rounded-circle border d-flex align-items-center justify-content-center bg-light" style="width:40px;height:40px;"><i class="bi bi-person text-secondary"></i></div>
                        <?php endif; ?>
                        <div class="flex-grow-1">
                          <div class="fw-semibold"><?= h($name ?: $it['student_id']) ?></div>
                          <div class="small text-muted"><?= h($it['program'] ?? '') ?> <?= h($it['year_section'] ?? '') ?></div>
                          <div class="progress mt-2" style="height:6px;">
                            <div class="progress-bar bg-primary" role="progressbar" style="width: <?= $pct ?>%;" aria-valuenow="<?= $pct ?>" aria-valuemin="0" aria-valuemax="100"></div>
                          </div>
                        </div>
                        <div class="text-end" style="min-width:100px;">
                          <div class="fw-semibold text-primary"><?= $votes ?> vote<?= $votes===1?'':'s' ?></div>
                          <div class="small text-muted"><?= number_format($pct,1) ?>%</div>
                        </div>
                      </div>
                    <?php } ?>
                  </div>
                <?php } ?>
              <?php } ?>
            <?php } ?>
          <?php } ?>
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

    // Charts: build datasets from PHP
    const orgData = <?= json_encode($org_totals, JSON_UNESCAPED_SLASHES) ?>;
    const posData = <?= json_encode($position_totals, JSON_UNESCAPED_SLASHES) ?>;

    const orgLabels = Object.keys(orgData || {});
    const orgValues = Object.values(orgData || {});
    const posLabels = Object.keys(posData || {});
    const posValues = Object.values(posData || {});

    const palette = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#84cc16','#a855f7','#22c55e','#eab308'];

    const orgCanvas = document.getElementById('orgPie');
    if (orgCanvas && orgValues.length) {
      const orgColorMap = {
        'SITE': '#800000',          // maroon
        'PAFE': '#2563eb',          // blue
        'AFPROTECHS': '#ec4899'     // pink
      };
      const orgBg = orgLabels.map((label, i) => orgColorMap[label.toUpperCase()] || palette[i % palette.length]);
      new Chart(orgCanvas, {
        type: 'pie',
        data: {
          labels: orgLabels,
          datasets: [{ data: orgValues, backgroundColor: orgBg }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }

    const posCanvas = document.getElementById('posBar');
    if (posCanvas && posValues.length) {
      new Chart(posCanvas, {
        type: 'bar',
        data: {
          labels: posLabels,
          datasets: [{ label: 'Votes', data: posValues, backgroundColor: '#3b82f6' }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { maxRotation: 45, autoSkip: false } },
            y: { beginAtZero: true, precision: 0 }
          },
          plugins: { legend: { display: false } }
        }
      });
    }
  });
  </script>
</body>
</html>

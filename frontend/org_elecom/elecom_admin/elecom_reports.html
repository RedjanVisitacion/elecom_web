<?php
require_once '../../../db_connection.php';
if (session_status() === PHP_SESSION_NONE) { session_start(); }

function fetch_all_rows($pdo, $sql, $params = []) {
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        return [];
    }
}

function csv_string_from_rows($rows) {
    $fh = fopen('php://temp', 'r+');
    if (!empty($rows)) {
        $headers = array_keys($rows[0]);
        fputcsv($fh, $headers);
        foreach ($rows as $row) {
            $line = [];
            foreach ($headers as $h) {
                $v = $row[$h] ?? '';
                if (is_array($v) || is_object($v)) { $v = json_encode($v, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); }
                $line[] = (string)$v;
            }
            fputcsv($fh, $line);
        }
    } else {
        fputcsv($fh, ['No data']);
    }
    rewind($fh);
    $csv = stream_get_contents($fh);
    fclose($fh);
    return $csv;
}

$candidates = fetch_all_rows($pdo, "SELECT c.*, COALESCE(vv.cnt,0) AS total_votes
    FROM candidates_registration c
    LEFT JOIN (
        SELECT vi.candidate_id AS cid, COUNT(*) AS cnt
        FROM vote_items vi
        GROUP BY vi.candidate_id
    ) vv ON vv.cid = c.id
    ORDER BY c.organization, c.position, c.last_name, c.first_name");

$votes = fetch_all_rows($pdo, "SELECT * FROM votes");
$vote_items = fetch_all_rows($pdo, "SELECT * FROM vote_items");
$students = fetch_all_rows($pdo, "SELECT * FROM users WHERE role = :role", [':role' => 'student']);
$windows = fetch_all_rows($pdo, "SELECT * FROM vote_windows ORDER BY id DESC LIMIT 1");

$defaultStart = '';
$defaultEnd = '';
if (!empty($windows) && isset($windows[0]['start_at'])) { $defaultStart = date('Y-m-d', strtotime($windows[0]['start_at'])); }
if (!empty($windows) && isset($windows[0]['end_at'])) { $defaultEnd = date('Y-m-d', strtotime($windows[0]['end_at'])); }

$posTotals = [];
foreach ($candidates as $c) {
    $org = strtoupper($c['organization'] ?? 'USG');
    $pos = $c['position'] ?? 'Unspecified';
    $key = $org.'|'.$pos;
    if (!isset($posTotals[$key])) $posTotals[$key] = 0;
    $posTotals[$key] += (int)($c['total_votes'] ?? 0);
}

$summaryCandidate = [];
foreach ($candidates as $c) {
    $org = strtoupper($c['organization'] ?? 'USG');
    $pos = $c['position'] ?? 'Unspecified';
    $key = $org.'|'.$pos;
    $votesCnt = (int)($c['total_votes'] ?? 0);
    $summaryCandidate[] = [
        'candidate_id' => $c['id'] ?? null,
        'student_id' => $c['student_id'] ?? '',
        'candidate_name' => trim(($c['first_name'] ?? '').' '.($c['middle_name'] ?? '').' '.($c['last_name'] ?? '')),
        'organization' => $org,
        'position' => $pos,
        'party_name' => $c['party_name'] ?? '',
        'votes' => $votesCnt,
        'percent_in_position' => ($posTotals[$key] ?? 0) > 0 ? round($votesCnt / $posTotals[$key] * 100, 4) : 0.0,
    ];
}

$summaryPosition = [];
foreach ($posTotals as $key => $tv) {
    $parts = explode('|', $key, 2);
    $org = $parts[0] ?? '';
    $pos = $parts[1] ?? '';
    $countCandidates = 0;
    foreach ($candidates as $c) {
        if (strtoupper($c['organization'] ?? 'USG') === $org && ($c['position'] ?? 'Unspecified') === $pos) {
            $countCandidates++;
        }
    }
    $summaryPosition[] = [
        'organization' => $org,
        'position' => $pos,
        'total_votes' => $tv,
        'candidates' => $countCandidates,
    ];
}

$votedIdsMap = [];
foreach ([
    "SELECT DISTINCT student_id AS id FROM votes",
    "SELECT DISTINCT voter_id AS id FROM votes",
    "SELECT DISTINCT user_id AS id FROM votes",
    "SELECT DISTINCT voter_id AS id FROM vote_items",
] as $q) {
    try {
        $rows = fetch_all_rows($pdo, $q);
        foreach ($rows as $r) { $id = trim((string)($r['id'] ?? '')); if ($id !== '') { $votedIdsMap[$id] = true; } }
    } catch (Throwable $e) {}
}
$votedIdentifiers = [];
foreach (array_keys($votedIdsMap) as $id) { $votedIdentifiers[] = ['identifier' => $id]; }

if (isset($_GET['action']) && $_GET['action'] === 'summary') {
    $start = trim($_GET['start'] ?? '');
    $end = trim($_GET['end'] ?? '');
    $startDt = $start !== '' ? date('Y-m-d 00:00:00', strtotime($start)) : null;
    $endDtPlus = $end !== '' ? date('Y-m-d 00:00:00', strtotime($end.' +1 day')) : null;

    $cond = '';
    $p = [];
    if ($startDt) { $cond .= ' AND vi.created_at >= :start'; $p[':start'] = $startDt; }
    if ($endDtPlus) { $cond .= ' AND vi.created_at < :end'; $p[':end'] = $endDtPlus; }

    $sql = "SELECT c.id, c.student_id, c.first_name, c.middle_name, c.last_name, c.organization, c.position, c.party_name,
                    COUNT(vi.id) AS votes
            FROM candidates_registration c
            LEFT JOIN vote_items vi ON vi.candidate_id = c.id $cond
            GROUP BY c.id, c.student_id, c.first_name, c.middle_name, c.last_name, c.organization, c.position, c.party_name
            ORDER BY c.organization, c.position, c.last_name, c.first_name";
    $rows = fetch_all_rows($pdo, $sql, $p);

    $orgTotals = [];
    $posTotals = [];
    $totalVotes = 0;
    foreach ($rows as $r) {
        $org = strtoupper($r['organization'] ?? 'USG');
        $pos = $r['position'] ?? 'Unspecified';
        $v = (int)($r['votes'] ?? 0);
        if (!isset($orgTotals[$org])) $orgTotals[$org] = 0;
        if (!isset($posTotals[$pos])) $posTotals[$pos] = 0;
        $orgTotals[$org] += $v; $posTotals[$pos] += $v; $totalVotes += $v;
    }

    $votersSql = 'SELECT COUNT(DISTINCT vi.voter_id) AS total FROM vote_items vi WHERE 1=1';
    $pv = [];
    if ($startDt) { $votersSql .= ' AND vi.created_at >= :start'; $pv[':start'] = $startDt; }
    if ($endDtPlus) { $votersSql .= ' AND vi.created_at < :end'; $pv[':end'] = $endDtPlus; }
    $voters = 0; $tmp = fetch_all_rows($pdo, $votersSql, $pv); if ($tmp && isset($tmp[0]['total'])) $voters = (int)$tmp[0]['total'];

    header('Content-Type: application/json');
    echo json_encode([
        'range' => ['start' => $start, 'end' => $end],
        'totals' => [
            'total_votes' => $totalVotes,
            'distinct_voters' => $voters,
            'total_candidates' => count($rows)
        ],
        'by_org' => $orgTotals,
        'by_pos' => $posTotals,
        'candidates' => $rows
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Per-file CSV download fallback (does not require ZipArchive)
if (isset($_GET['csv'])) {
    $type = strtolower((string)$_GET['csv']);
    $datasets = [
        'candidates' => $candidates,
        'summary_by_candidate' => $summaryCandidate,
        'summary_by_position' => $summaryPosition,
        'votes' => $votes,
        'vote_items' => $vote_items,
        'students' => $students,
        'voted_identifiers' => $votedIdentifiers,
        'election_window' => $windows,
    ];
    if (!array_key_exists($type, $datasets)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Unknown dataset';
        exit;
    }
    $fname = $type . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $fname . '"');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    echo csv_string_from_rows($datasets[$type]);
    exit;
}

if (isset($_GET['download']) && strtolower((string)$_GET['download']) === 'zip') {
    if (!class_exists('ZipArchive')) {
        header('Location: elecom_reports.php?zip=missing');
        exit;
    }
    $zip = new ZipArchive();
    $tmp = tempnam(sys_get_temp_dir(), 'elecom_reports_');
    $zip->open($tmp, ZipArchive::OVERWRITE);

    $zip->addFromString('candidates.csv', csv_string_from_rows($candidates));
    $zip->addFromString('summary_by_candidate.csv', csv_string_from_rows($summaryCandidate));
    $zip->addFromString('summary_by_position.csv', csv_string_from_rows($summaryPosition));
    $zip->addFromString('votes.csv', csv_string_from_rows($votes));
    $zip->addFromString('vote_items.csv', csv_string_from_rows($vote_items));
    $zip->addFromString('students.csv', csv_string_from_rows($students));
    $zip->addFromString('voted_identifiers.csv', csv_string_from_rows($votedIdentifiers));
    $zip->addFromString('election_window.csv', csv_string_from_rows($windows));
    $zip->addFromString('generated_at.txt', date('c'));

    $zip->close();

    $fname = 'elecom_reports_'.date('Ymd_His').'.zip';
    header('Content-Type: application/zip');
    header('Content-Length: '.filesize($tmp));
    header('Content-Disposition: attachment; filename="'.$fname.'"');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    readfile($tmp);
    unlink($tmp);
    exit;
}

$zipEnabled = class_exists('ZipArchive');

$role = isset($_SESSION['role']) ? strtolower((string)$_SESSION['role']) : '';
$full_name = trim($_SESSION['full_name'] ?? '');
$student_id = $_SESSION['student_id'] ?? '';
$display_name = $full_name !== '' ? $full_name : ($student_id !== '' ? $student_id : ($role !== '' ? ucfirst($role) : 'User'));
$display_role = $role !== '' ? ucfirst($role) : 'User';
$icon_class = ($role === 'admin') ? 'bi bi-person-gear' : 'bi bi-person-circle';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generate Reports - ELECOM</title>
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
        <li class="nav-item"><a class="nav-link" href="elecom_reset.php"><i class="bi bi-arrow-counterclockwise"></i><span>Reset Votes</span></a></li>
        <li class="nav-item"><a class="nav-link active" href="elecom_reports.php"><i class="bi bi-file-earmark-bar-graph"></i><span>Generate Reports</span></a></li>
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
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-body">
          <h4 class="mb-3">Generate Election Report</h4>
          <div id="alertBox" class="alert alert-danger d-none mb-3"></div>
          <div class="p-3 rounded" style="background:#f6f7fb;">
            <div class="row g-3 align-items-end">
              <div class="col-12 col-md-6">
                <label class="form-label">Start Date</label>
                <input type="date" class="form-control" id="repStart" value="<?= htmlspecialchars($defaultStart) ?>" min="<?= htmlspecialchars($defaultStart) ?>" max="<?= htmlspecialchars($defaultEnd) ?>">
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label">End Date</label>
                <input type="date" class="form-control" id="repEnd" value="<?= htmlspecialchars($defaultEnd) ?>" min="<?= htmlspecialchars($defaultStart) ?>" max="<?= htmlspecialchars($defaultEnd) ?>">
              </div>
            </div>
            <div class="mt-2 d-flex gap-2">
              <button type="button" class="btn btn-sm btn-outline-secondary" id="clearDates">Clear</button>
              <?php if ($defaultStart || $defaultEnd): ?>
              <button type="button" class="btn btn-sm btn-outline-primary" id="applyWindow">Use election dates</button>
              <?php endif; ?>
            </div>
          </div>
          <div class="mt-4">
            <div class="mb-2 fw-semibold">Select Report Format</div>
            <div class="row g-3">
              <div class="col-12 col-md-6">
                <button type="button" id="fmt_text" data-format="text" class="w-100 btn btn-light text-start border format-card" style="height:100px;">
                  <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle d-flex align-items-center justify-content-center" style="width:48px;height:48px;background:#eef2ff;"><i class="bi bi-file-text fs-4 text-primary"></i></div>
                    <div>
                      <div class="fw-semibold">Text Format</div>
                      <div class="text-muted small">Human-readable report as .txt</div>
                    </div>
                  </div>
                </button>
              </div>
              <div class="col-12 col-md-6">
                <button type="button" id="fmt_pdf" data-format="pdf" class="w-100 btn btn-outline-primary text-start border-2 format-card active" style="height:100px;">
                  <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle d-flex align-items-center justify-content-center" style="width:48px;height:48px;background:#ecfeff;"><i class="bi bi-filetype-pdf fs-4 text-primary"></i></div>
                    <div>
                      <div class="fw-semibold">PDF Format</div>
                      <div class="text-muted small">Printable document with layout</div>
                    </div>
                  </div>
                </button>
              </div>
              <div class="col-12 col-md-6">
                <button type="button" id="fmt_csv" data-format="csv" class="w-100 btn btn-light text-start border format-card" style="height:100px;">
                  <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle d-flex align-items-center justify-content-center" style="width:48px;height:48px;background:#f0fdf4;"><i class="bi bi-filetype-csv fs-4 text-success"></i></div>
                    <div>
                      <div class="fw-semibold">CSV Format</div>
                      <div class="text-muted small">Summary as .csv</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
          <div class="mt-4 d-flex gap-2">
            <button class="btn btn-primary" id="genReportBtn"><i class="bi bi-magic"></i> Generate Report</button>
            <button class="btn btn-outline-secondary" id="previewBtn" type="button">Preview</button>
          </div>
        </div>
      </div>

      <div class="card border-0 shadow-sm mb-4 d-none" id="reportPreviewCard">
        <div class="card-body">
          <div id="reportPreview"></div>
        </div>
      </div>

      <!-- <div class="card border-0 shadow-sm">
        <div class="card-body">
          <h4 class="mb-3">Generate Reports</h4>
          <p class="text-muted">Download all reports at once or individually as CSV.</p>
          <?php if ($zipEnabled): ?>
            <a class="btn btn-primary" href="elecom_reports.php?download=zip"><i class="bi bi-download"></i> Download All Reports (.zip)</a>
          <?php else: ?>
            <div class="alert alert-warning mb-3">ZIP extension is not enabled on this server. You can still download each CSV below. To enable ZIP in XAMPP: open php.ini, enable <code>extension=zip</code>, then restart Apache.</div>
            <a class="btn btn-secondary disabled" href="#" tabindex="-1" aria-disabled="true"><i class="bi bi-download"></i> Download All Reports (.zip)</a>
          <?php endif; ?>
          <div class="mt-4">
            <h6>Download individual CSVs</h6>
            <div class="list-group">
              <a class="list-group-item list-group-item-action" href="elecom_reports.php?csv=candidates">candidates.csv</a>
              <a class="list-group-item list-group-item-action" href="elecom_reports.php?csv=summary_by_candidate">summary_by_candidate.csv</a>
              <a class="list-group-item list-group-item-action" href="elecom_reports.php?csv=summary_by_position">summary_by_position.csv</a>
              <a class="list-group-item list-group-item-action" href="elecom_reports.php?csv=votes">votes.csv</a>
              <a class="list-group-item list-group-item-action" href="elecom_reports.php?csv=vote_items">vote_items.csv</a>
              <a class="list-group-item list-group-item-action" href="elecom_reports.php?csv=students">students.csv</a>
              <a class="list-group-item list-group-item-action" href="elecom_reports.php?csv=voted_identifiers">voted_identifiers.csv</a>
              <a class="list-group-item list-group-item-action" href="elecom_reports.php?csv=election_window">election_window.csv</a>
            </div>
          </div>
        </div>
      </div> -->
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
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

    const startEl = document.getElementById('repStart');
    const endEl = document.getElementById('repEnd');
    const clearBtn = document.getElementById('clearDates');
    const applyWinBtn = document.getElementById('applyWindow');
    const alertBox = document.getElementById('alertBox');
    const fmtCards = Array.from(document.querySelectorAll('.format-card'));
    let selectedFormat = 'pdf';
    const defaultStart = startEl.getAttribute('value') || '';
    const defaultEnd = endEl.getAttribute('value') || '';
    fmtCards.forEach(btn => {
      btn.addEventListener('click', () => {
        fmtCards.forEach(b=> b.classList.remove('btn-outline-primary','border-2','active'));
        fmtCards.forEach(b=> b.classList.add('btn-light'));
        btn.classList.remove('btn-light');
        btn.classList.add('btn-outline-primary','border-2','active');
        selectedFormat = btn.getAttribute('data-format') || 'pdf';
      });
    });

    function formatDate(d){
      try { return new Date(d).toLocaleDateString(); } catch(e){ return d || 'All time'; }
    }

    function showAlert(msg, type='danger'){
      if (!alertBox) return;
      if (!msg) { alertBox.classList.add('d-none'); alertBox.textContent=''; return; }
      alertBox.className = 'alert alert-'+type;
      alertBox.textContent = msg;
      alertBox.classList.remove('d-none');
    }

    function validateDates(){
      const s = startEl.value; const e = endEl.value;
      if (s && e && e < s) { showAlert('End date must be on or after Start date.'); return false; }
      showAlert('');
      return true;
    }

    if (clearBtn){ clearBtn.addEventListener('click', ()=>{ startEl.value=''; endEl.value=''; validateDates(); }); }
    if (applyWinBtn){ applyWinBtn.addEventListener('click', ()=>{ if (defaultStart) startEl.value = defaultStart; if (defaultEnd) endEl.value = defaultEnd; validateDates(); }); }
    startEl.addEventListener('change', validateDates);
    endEl.addEventListener('change', validateDates);

    function buildReportHTML(data){
      const range = data?.range || {}; const totals = data?.totals || {};
      const byOrg = data?.by_org || {}; const byPos = data?.by_pos || {}; const cand = data?.candidates || [];
      const rowsOrg = Object.keys(byOrg).map(k=>`<tr><td>${k}</td><td class=\"text-end\">${byOrg[k]}</td></tr>`).join('');
      const rowsPos = Object.keys(byPos).map(k=>`<tr><td>${k}</td><td class=\"text-end\">${byPos[k]}</td></tr>`).join('');
      const rowsCand = cand.map(c=>`<tr><td>${c.organization||'USG'}</td><td>${c.position||''}</td><td>${[c.last_name,c.first_name].filter(Boolean).join(', ')}</td><td class=\"text-end\">${c.votes||0}</td></tr>`).join('');
      return `
        <div>
          <h3 class=\"mb-1\">Election Report</h3>
          <div class=\"text-muted mb-3\">Range: ${range.start?formatDate(range.start):'All time'} ${range.end?('– '+formatDate(range.end)) : ''}</div>
          <div class=\"row g-3 mb-3\">
            <div class=\"col-12 col-md-4\"><div class=\"p-3 border rounded\"><div class=\"text-muted small\">Total Votes</div><div class=\"h4 mb-0\">${totals.total_votes||0}</div></div></div>
            <div class=\"col-12 col-md-4\"><div class=\"p-3 border rounded\"><div class=\"text-muted small\">Distinct Voters</div><div class=\"h4 mb-0\">${totals.distinct_voters||0}</div></div></div>
            <div class=\"col-12 col-md-4\"><div class=\"p-3 border rounded\"><div class=\"text-muted small\">Candidates</div><div class=\"h4 mb-0\">${totals.total_candidates||0}</div></div></div>
          </div>
          <div class=\"row g-3\">
            <div class=\"col-12 col-md-6\">
              <div class=\"border rounded\">
                <div class=\"p-2 border-bottom fw-semibold\">Votes by Organization</div>
                <div class=\"p-2\">
                  <table class=\"table table-sm mb-0\"><tbody>${rowsOrg||'<tr><td class=\"text-muted\">No data</td></tr>'}</tbody></table>
                </div>
              </div>
            </div>
            <div class=\"col-12 col-md-6\">
              <div class=\"border rounded\">
                <div class=\"p-2 border-bottom fw-semibold\">Votes by Position</div>
                <div class=\"p-2\">
                  <table class=\"table table-sm mb-0\"><tbody>${rowsPos||'<tr><td class=\"text-muted\">No data</td></tr>'}</tbody></table>
                </div>
              </div>
            </div>
          </div>
          <div class=\"mt-3\">
            <div class=\"p-2 border rounded mb-1 fw-semibold\">Candidates</div>
            <div class=\"p-2\">
              <table class=\"table table-sm\"><thead><tr><th>Org</th><th>Position</th><th>Name</th><th class=\"text-end\">Votes</th></tr></thead><tbody>${rowsCand||'<tr><td colspan=4 class=\"text-muted\">No candidates</td></tr>'}</tbody></table>
            </div>
          </div>
        </div>`;
    }

    function buildReportText(data){
      const range = data?.range || {}; const totals = data?.totals || {}; const byOrg = data?.by_org || {}; const byPos = data?.by_pos || {}; const cand = data?.candidates || [];
      let out = '';
      out += 'Election Report\n';
      out += 'Range: ' + (range.start||'All time') + (range.end?(' - '+range.end):'') + '\n\n';
      out += 'Totals\n';
      out += '- Total Votes: ' + (totals.total_votes||0) + '\n';
      out += '- Distinct Voters: ' + (totals.distinct_voters||0) + '\n';
      out += '- Candidates: ' + (totals.total_candidates||0) + '\n\n';
      out += 'Votes by Organization\n';
      for (const k in byOrg) out += '  * ' + k + ': ' + byOrg[k] + '\n';
      out += '\nVotes by Position\n';
      for (const k in byPos) out += '  * ' + k + ': ' + byPos[k] + '\n';
      out += '\nCandidates\n';
      cand.forEach(c=>{ out += `  * ${c.organization||'USG'} | ${c.position||''} | ${[c.last_name,c.first_name].filter(Boolean).join(', ')} | votes: ${c.votes||0}\n`; });
      return out;
    }

    function buildReportCSV(data){
      const range = data?.range || {}; const totals = data?.totals || {}; const byOrg = data?.by_org || {}; const byPos = data?.by_pos || {}; const cand = data?.candidates || [];
      const rows = [];
      rows.push(['Section','Key','Value','Org','Position','Name','Votes']);
      rows.push(['Overview','total_votes', String(totals.total_votes||0),'','','','']);
      rows.push(['Overview','distinct_voters', String(totals.distinct_voters||0),'','','','']);
      rows.push(['Overview','total_candidates', String(totals.total_candidates||0),'','','','']);
      Object.keys(byOrg).forEach(k=>{ rows.push(['By Organization',k,String(byOrg[k]||0),'','','','']); });
      Object.keys(byPos).forEach(k=>{ rows.push(['By Position',k,String(byPos[k]||0),'','','','']); });
      cand.forEach(c=>{ rows.push(['Candidates','','',''+(c.organization||'USG'),''+(c.position||''),[c.last_name,c.first_name].filter(Boolean).join(', '), String(c.votes||0)]); });
      const esc = v => '"'+String(v).replaceAll('"','""')+'"';
      return rows.map(r=>r.map(esc).join(',')).join('\n');
    }

    async function getSummary(){
      const s = startEl.value || ''; const e = endEl.value || '';
      if (!validateDates()) { throw new Error('invalid_date'); }
      const url = new URL(location.href);
      url.search = '';
      url.searchParams.set('action','summary');
      if (s) url.searchParams.set('start', s);
      if (e) url.searchParams.set('end', e);
      const res = await fetch(url.pathname + '?' + url.searchParams.toString());
      return await res.json();
    }

    const previewCard = document.getElementById('reportPreviewCard');
    const previewEl = document.getElementById('reportPreview');
    function setLoading(b){
      fmtCards.forEach(bn=> bn.disabled = b);
      startEl.disabled = b; endEl.disabled = b;
      const genBtn = document.getElementById('genReportBtn');
      const prevBtn = document.getElementById('previewBtn');
      genBtn.disabled = b; prevBtn.disabled = b;
      if (b){ if (!genBtn.dataset.orig) genBtn.dataset.orig = genBtn.innerHTML; genBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...'; }
      else { if (genBtn.dataset.orig) { genBtn.innerHTML = genBtn.dataset.orig; delete genBtn.dataset.orig; } }
    }

    async function refreshPreview(){
      setLoading(true);
      try{
        const data = await getSummary();
        previewEl.innerHTML = buildReportHTML(data);
        previewCard.classList.remove('d-none');
        return data;
      } finally { setLoading(false); }
    }

    document.getElementById('previewBtn').addEventListener('click', refreshPreview);

    document.getElementById('genReportBtn').addEventListener('click', async ()=>{
      try{
        const data = await refreshPreview();
        if (selectedFormat === 'pdf'){
          const opt = { margin: 8, filename: 'election_report_'+ new Date().toISOString().replaceAll(':','-').slice(0,19) + '.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
          await html2pdf().from(previewEl).set(opt).save();
        } else if (selectedFormat === 'csv') {
          const csv = buildReportCSV(data);
          const blob = new Blob([csv], {type:'text/csv'});
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'election_report_'+ new Date().toISOString().slice(0,10) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
        } else {
          const text = buildReportText(data);
          const blob = new Blob([text], {type:'text/plain'});
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'election_report_'+ new Date().toISOString().slice(0,10) + '.txt'; document.body.appendChild(a); a.click(); a.remove();
        }
      } catch(e){ if (String(e&&e.message) === 'invalid_date'){ showAlert('Please fix the date range before generating.'); } else { showAlert('Failed to generate report.','danger'); } }
    });
  });
  </script>
</body>
</html>

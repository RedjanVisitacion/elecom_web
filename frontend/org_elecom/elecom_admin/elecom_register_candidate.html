<?php
require_once '../../../db_connection.php';
$__session_started = (session_status() === PHP_SESSION_ACTIVE);
if (!$__session_started) { session_start(); }
$__role = isset($_SESSION['role']) ? strtolower((string)$_SESSION['role']) : '';
$__student_id = $_SESSION['student_id'] ?? '';
$__full_name = trim($_SESSION['full_name'] ?? '');
$__display_name = $__full_name !== '' ? $__full_name : ($__student_id !== '' ? $__student_id : ($__role !== '' ? ucfirst($__role) : 'User'));
$__display_role = $__role !== '' ? ucfirst($__role) : 'User';
$__icon_class = ($__role === 'admin') ? 'bi bi-person-gear' : 'bi bi-person-circle';
$CLOUDINARY_CLOUD = 'dhhzkqmso';
$CLOUDINARY_KEY = '871914741883427';
$CLOUDINARY_SECRET = 'ihwwUCjI92s8tBpm24Vqj2CIWJk';

function cloudinary_upload_local($filePath, $folder, $publicId = '') {
    global $CLOUDINARY_CLOUD, $CLOUDINARY_KEY, $CLOUDINARY_SECRET;
    if (!is_file($filePath) || !$CLOUDINARY_CLOUD || !$CLOUDINARY_KEY || !$CLOUDINARY_SECRET) {
        return [false, null, 'missing'];
    }
    $url = 'https://api.cloudinary.com/v1_1/' . $CLOUDINARY_CLOUD . '/image/upload';
    $timestamp = time();
    $params = ['folder' => $folder, 'timestamp' => $timestamp];
    if ($publicId !== '') { $params['public_id'] = $publicId; }
    ksort($params);
    $toSign = '';
    foreach ($params as $k => $v) { if ($toSign !== '') { $toSign .= '&'; } $toSign .= $k . '=' . $v; }
    $signature = sha1($toSign . $CLOUDINARY_SECRET);
    $post = [
        'api_key' => $CLOUDINARY_KEY,
        'timestamp' => $timestamp,
        'signature' => $signature,
        'folder' => $folder,
    ];
    if ($publicId !== '') { $post['public_id'] = $publicId; }
    if (function_exists('curl_file_create')) {
        $post['file'] = curl_file_create($filePath);
    } else {
        $post['file'] = '@' . $filePath;
    }
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $res = curl_exec($ch);
    if ($res === false) { $err = curl_error($ch); curl_close($ch); return [false, null, $err ?: 'curl']; }
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($res, true);
    if ($code >= 200 && $code < 300 && isset($data['secure_url'])) { return [true, $data['secure_url'], null]; }
    return [false, null, isset($data['error']['message']) ? $data['error']['message'] : 'upload'];
}

$success = null;
$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $student_id = trim($_POST['student_id'] ?? '');
    $first_name = trim($_POST['first_name'] ?? '');
    $middle_name = trim($_POST['middle_name'] ?? '');
    $last_name = trim($_POST['last_name'] ?? '');
    $organization = trim($_POST['organization'] ?? '');
    $position = trim($_POST['position'] ?? '');
    $program = trim($_POST['program'] ?? '');
    $year_section = trim($_POST['year_section'] ?? '');
    $platform = trim($_POST['platform'] ?? '');
    $candidate_type = $_POST['candidate_type'] ?? 'Independent';
    $party_name = $candidate_type === 'Political Party' ? trim($_POST['party_name'] ?? '') : null;
    $photo_url = trim($_POST['photo_url'] ?? '');
    $party_logo_url = trim($_POST['party_logo_url'] ?? '');

    $photo_blob = null; $photo_mime = null; $party_logo_blob = null; $party_logo_mime = null;
    if (isset($_FILES['photo_file']) && is_uploaded_file($_FILES['photo_file']['tmp_name'])) {
        try {
            [$ok, $u, $e] = cloudinary_upload_local($_FILES['photo_file']['tmp_name'], 'elecom/candidates');
            if ($ok && $u) {
                $photo_url = $u;
            } else {
                $photo_blob = file_get_contents($_FILES['photo_file']['tmp_name']);
                $photo_mime = mime_content_type($_FILES['photo_file']['tmp_name']);
            }
        } catch (Throwable $ex) {
            $photo_blob = file_get_contents($_FILES['photo_file']['tmp_name']);
            $photo_mime = mime_content_type($_FILES['photo_file']['tmp_name']);
        }
    }
    if (isset($_FILES['party_logo_file']) && is_uploaded_file($_FILES['party_logo_file']['tmp_name'])) {
        try {
            [$ok2, $u2, $e2] = cloudinary_upload_local($_FILES['party_logo_file']['tmp_name'], 'elecom/parties');
            if ($ok2 && $u2) {
                $party_logo_url = $u2;
            } else {
                $party_logo_blob = file_get_contents($_FILES['party_logo_file']['tmp_name']);
                $party_logo_mime = mime_content_type($_FILES['party_logo_file']['tmp_name']);
            }
        } catch (Throwable $ex2) {
            $party_logo_blob = file_get_contents($_FILES['party_logo_file']['tmp_name']);
            $party_logo_mime = mime_content_type($_FILES['party_logo_file']['tmp_name']);
        }
    }

    if ($student_id === '' || $first_name === '' || $last_name === '' || $organization === '' || $position === '' || $program === '' || $year_section === '' || $platform === '') {
        $error = 'Please complete all required fields.';
    } elseif ($candidate_type === 'Political Party' && $party_name === '') {
        $error = 'Please provide a party name for Political Party type.';
    } elseif (strtolower($organization) !== 'usg' && stripos($position, 'Representative') !== false) {
        $error = 'Only USG organization may have Representative positions.';
    } elseif ($candidate_type === 'Political Party' && 
        ($party_logo_url === '' && !isset($_FILES['party_logo_file']) ) ) {
        // Require at least one party logo source when Political Party
        $error = 'Please provide a party logo (upload a file or a URL) for Political Party type.';
    } else {
        try {
            $stmt = $pdo->prepare("INSERT INTO candidates_registration (student_id, first_name, middle_name, last_name, organization, position, program, year_section, platform, created_at, candidate_type, party_name, photo_url, party_logo_url, photo_blob, photo_mime, party_logo_blob, party_logo_mime, votes) VALUES (:student_id, :first_name, :middle_name, :last_name, :organization, :position, :program, :year_section, :platform, NOW(), :candidate_type, :party_name, :photo_url, :party_logo_url, :photo_blob, :photo_mime, :party_logo_blob, :party_logo_mime, 0)");
            $stmt->execute([
                ':student_id' => $student_id,
                ':first_name' => $first_name,
                ':middle_name' => $middle_name !== '' ? $middle_name : null,
                ':last_name' => $last_name,
                ':organization' => $organization,
                ':position' => $position,
                ':program' => $program,
                ':year_section' => $year_section,
                ':platform' => $platform,
                ':candidate_type' => $candidate_type,
                ':party_name' => $party_name,
                ':photo_url' => $photo_url !== '' ? $photo_url : null,
                ':party_logo_url' => $party_logo_url !== '' ? $party_logo_url : null,
                ':photo_blob' => $photo_blob,
                ':photo_mime' => $photo_mime,
                ':party_logo_blob' => $party_logo_blob,
                ':party_logo_mime' => $party_logo_mime,
            ]);
            $success = 'Candidate registered successfully.';
        } catch (Throwable $e) {
            $error = 'Failed to register candidate.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register Candidate - ELECOM</title>
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
                    <a class="nav-link" href="elecom_dashboard.php">
                        <i class="bi bi-house-door"></i>
                        <span>Home</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link active" href="elecom_register_candidate.php">
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

    <!-- Main Content -->
    <div class="main-content">
        <!-- Top Navbar -->
        <nav class="top-navbar">
            <button class="menu-toggle" id="menuToggle">
                <i class="bi bi-list"></i>
            </button>
            <div class="user-info">
                <div class="user-avatar">
                    <i class="<?php echo $__icon_class; ?>"></i>
                </div>
                <div class="user-details">
                    <div class="user-name"><?php echo htmlspecialchars($__display_name); ?></div>
                    <div class="user-role"><?php echo htmlspecialchars($__display_role); ?></div>
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

        <!-- Content Area -->
        <div class="content-area">
            
            <?php if ($success): ?>
                <div class="alert alert-success" role="alert"><?php echo htmlspecialchars($success); ?></div>
            <?php endif; ?>
            <?php if ($error): ?>
                <div class="alert alert-danger" role="alert"><?php echo htmlspecialchars($error); ?></div>
            <?php endif; ?>

            <form method="post" enctype="multipart/form-data" class="card p-3 shadow-sm border-0">
                <div class="row g-3">
                    <div class="col-12">
                        <label class="form-label">Candidate Type</label>
                        <div class="d-flex gap-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="candidate_type" id="type_ind" value="Independent">
                                <label class="form-check-label" for="type_ind">Independent</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="candidate_type" id="type_party" value="Political Party" checked>
                                <label class="form-check-label" for="type_party">Political Party</label>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">Candidate student ID</label>
                        <input type="text" name="student_id" class="form-control" required>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Organization</label>
                        <select name="organization" class="form-select" required>
                            <option value="" selected disabled>Select organization</option>
                            <option>USG</option>
                            <option>SITE</option>
                            <option>PAFE</option>
                            <option>AFPROTECHS</option>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">First name</label>
                        <input type="text" name="first_name" class="form-control" required>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Middle name (N/A if nothing)</label>
                        <input type="text" name="middle_name" class="form-control">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Last name</label>
                        <input type="text" name="last_name" class="form-control" required>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Position</label>
                        <select name="position" class="form-select" required>
                            <option value="" selected disabled>Select position</option>
                            <option>President</option>
                            <option>Vice President</option>
                            <option>General Secretary</option>
                            <option>Associate Secretary</option>
                            <option>Treasurer</option>
                            <option>Auditor</option>
                            <option>Public Information Officer</option>
                            <option>BSIT Representative</option>
                            <option>BTLED Representative</option>
                            <option>BFPT Representative</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Program</label>
                        <select id="programSelect" name="program" class="form-select" required>
                            <option value="" selected disabled>Select program</option>
                            <option value="BSIT">BSIT</option>
                            <option value="BTLED">BTLED</option>
                            <option value="BFPT">BFPT</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Year/Section</label>
                        <select id="yearSectionSelect" name="year_section" class="form-select" required>
                            <option value="" selected disabled>Select year/section</option>
                        </select>
                    </div>
                    <div class="col-12">
                        <label class="form-label">Platform</label>
                        <textarea name="platform" class="form-control" rows="3" required></textarea>
                    </div>

                    <div class="col-12"><hr class="my-2"></div>
                    <div class="col-md-6">
                        <label class="form-label">Upload Candidate Photo (optional)</label>
                        <input type="file" name="photo_file" class="form-control" accept="image/*">
                        <div class="form-text">Or provide a URL below</div>
                        <input type="url" name="photo_url" class="form-control mt-2" placeholder="https://...">
                    </div>

                    <div class="col-12 party-fields d-none"><hr class="my-2"></div>
                    <div class="col-md-6 party-fields d-none">
                        <label class="form-label">Party name</label>
                        <input type="text" name="party_name" class="form-control">
                    </div>
                    <div class="col-md-6 party-fields d-none">
                        <label class="form-label">Upload Party Logo (optional)</label>
                        <input type="file" name="party_logo_file" class="form-control" accept="image/*">
                        <div class="form-text">Or provide a URL below</div>
                        <input type="url" name="party_logo_url" class="form-control mt-2" placeholder="https://...">
                    </div>

                    <div class="col-12 d-flex justify-content-end">
                        <button type="submit" class="btn btn-primary">Submit</button>
                    </div>
                </div>
            </form>
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

            // Toggle party fields
            const typeRadios = document.querySelectorAll('input[name="candidate_type"]');
            const partyFields = document.querySelectorAll('.party-fields');
            function updateParty() {
                const isParty = document.getElementById('type_party').checked;
                partyFields.forEach(el => el.classList.toggle('d-none', !isParty));
            }
            typeRadios.forEach(r => r.addEventListener('change', updateParty));
            updateParty();

            // Program -> Year/Section cascading dropdown
            const programSelect = document.getElementById('programSelect');
            const yearSelect = document.getElementById('yearSectionSelect');
            const orgSelect = document.querySelector('select[name="organization"]');
            const positionSelect = document.querySelector('select[name="position"]');
            const optionsByProgram = {
                BSIT: [
                    'BSIT-1A','BSIT-1B','BSIT-1C','BSIT-1D',
                    'BSIT-2A','BSIT-2B','BSIT-2C','BSIT-2D',
                    'BSIT-3A','BSIT-3B','BSIT-3C','BSIT-3D',
                    'BSIT-4A','BSIT-4B','BSIT-4C','BSIT-4D','BSIT-4E','BSIT-4F'
                ],
                BTLED: [
                    'BTLED-ICT-1A','BTLED-ICT-2A','BTLED-ICT-3A','BTLED-ICT-4A',
                    'BTLED-IA-1A','BTLED-IA-2A','BTLED-IA-3A','BTLED-IA-4A',
                    'BTLED-HE-1A','BTLED-HE-2A','BTLED-HE-3A','BTLED-HE-4A'
                ],
                BFPT: [
                    'BFPT-1A','BFPT-1B','BFPT-1C','BFPT-1D',
                    'BFPT-2A','BFPT-2B','BFPT-2C',
                    'BFPT-3A','BFPT-3B','BFPT-3C',
                    'BFPT-4A','BFPT-4B'
                ]
            };
            function populateYearSections() {
                const prog = programSelect.value;
                yearSelect.innerHTML = '<option value="" selected disabled>Select year/section</option>';
                if (!prog || !optionsByProgram[prog]) return;
                optionsByProgram[prog].forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v; opt.textContent = v; yearSelect.appendChild(opt);
                });
            }
            programSelect.addEventListener('change', populateYearSections);
            populateYearSections();

            // Organization -> Position rule: only USG can select Representative
            function filterPositionsByOrg() {
                const isUSG = (orgSelect.value || '').toUpperCase() === 'USG';
                Array.from(positionSelect.options).forEach(opt => {
                    if (/Representative/i.test(opt.textContent)) {
                        opt.disabled = !isUSG;
                        if (!isUSG && positionSelect.value === opt.value) {
                            positionSelect.value = '';
                        }
                    }
                });
            }
            orgSelect.addEventListener('change', filterPositionsByOrg);
            filterPositionsByOrg();

            // Candidate Search Logic (same behavior as dashboard)
            const csInput = document.getElementById('candidateSearch');
            const csBtn = document.getElementById('candidateSearchBtn');
            const csResults = document.getElementById('searchResults');
            let csDebounce = null;

            function csHide() { csResults.style.display = 'none'; csResults.innerHTML = ''; }
            function csShow(items) {
                if (!items || items.length === 0) { csHide(); return; }
                const placeholder = 'https://via.placeholder.com/40x40?text=%20';
                csResults.innerHTML = items.map(item => {
                    const name = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(' ');
                    const photo = item.photo_url && item.photo_url.startsWith('http') ? item.photo_url : placeholder;
                    return `\n<a href="#" class="list-group-item list-group-item-action" data-id="${item.id}">\n  <div class="d-flex align-items-center gap-2">\n    <img src="${photo}" alt="" class="rounded-circle border" style="width:40px;height:40px;object-fit:cover;">\n    <div class="flex-grow-1">\n      <div class="d-flex w-100 justify-content-between">\n        <strong>${name}</strong>\n        <small>${item.student_id || ''}</small>\n      </div>\n      <div class="small text-muted">${item.position || ''}${item.organization ? ' • ' + item.organization : ''}</div>\n    </div>\n  </div>\n</a>`;
                }).join('');
                csResults.style.display = 'block';
            }
            async function csSearch() {
                const q = csInput.value.trim();
                if (!q || q.length < 2) { csHide(); return; }
                try {
                    const res = await fetch(`elecom_candidates_api.php?action=search&q=${encodeURIComponent(q)}`);
                    const data = await res.json();
                    csShow(data);
                } catch (_) { csHide(); }
            }
            csInput && csInput.addEventListener('input', () => { clearTimeout(csDebounce); csDebounce = setTimeout(csSearch, 250); });
            csBtn && csBtn.addEventListener('click', (e) => { e.preventDefault(); csSearch(); });
            document.addEventListener('click', (e) => { if (!csResults.contains(e.target) && e.target !== csInput) { csHide(); } });
            csResults.addEventListener('click', async (e) => {
                const link = e.target.closest('a[data-id]');
                if (!link) return;
                e.preventDefault();
                const id = link.getAttribute('data-id');
                csHide();
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
                        if (d.photo_url && d.photo_url.startsWith('http')) { img.src = d.photo_url; img.style.display = 'block'; } else { img.style.display = 'none'; }
                        const modal = new bootstrap.Modal(document.getElementById('candidateModal'));
                        modal.show();
                    }
                } catch (_) {}
            });
        });
    </script>
</body>
</html>

<?php
require_once '../../../db_connection.php';
if (session_status() === PHP_SESSION_NONE) { session_start(); }
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
    <title>Candidates - ELECOM</title>
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
                <li class="nav-item"><a class="nav-link active" href="elecom_candidates.php"><i class="bi bi-people"></i><span>Candidates</span></a></li>
                <li class="nav-item"><a class="nav-link" href="elecom_results.php"><i class="bi bi-graph-up"></i><span>Results</span></a></li>
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
            <div class="search-box position-relative" style="min-width:320px; flex:1 1 auto; max-width: 760px;">
                <div class="input-group input-group-lg">
                    <input id="listSearch" type="text" class="form-control" placeholder="Search name, ID, party, position..." autocomplete="off">
                    <button class="btn btn-outline-secondary" type="button" id="listSearchBtn"><i class="bi bi-search"></i></button>
                </div>
            </div>
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
                    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                        <div class="d-flex align-items-center gap-3">
                            <h5 class="mb-0">Candidates</h5>
                            <div class="form-check m-0">
                                <input class="form-check-input" type="checkbox" id="selectAll">
                                <label class="form-check-label" for="selectAll">Select all</label>
                            </div>
                            <button class="btn btn-outline-danger btn-sm" id="bulkDeleteBtn" disabled>
                                <i class="bi bi-person-dash"></i> Unregister Selected
                            </button>
                        </div>
                        <div class="text-muted small" id="listCount"></div>
                    </div>
                    <div id="candidatesList" class="vstack gap-2"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Edit Modal -->
    <div class="modal fade" id="editModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit Candidate</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="editForm" class="row g-3">
              <input type="hidden" name="id" id="ed_id">
              <div class="col-md-4">
                <label class="form-label">First name</label>
                <input type="text" class="form-control" name="first_name" id="ed_first_name" required>
              </div>
              <div class="col-md-4">
                <label class="form-label">Middle name</label>
                <input type="text" class="form-control" name="middle_name" id="ed_middle_name">
              </div>
              <div class="col-md-4">
                <label class="form-label">Last name</label>
                <input type="text" class="form-control" name="last_name" id="ed_last_name" required>
              </div>
              <div class="col-md-4">
                <label class="form-label">Organization</label>
                <input type="text" class="form-control" name="organization" id="ed_org" required>
              </div>
              <div class="col-md-4">
                <label class="form-label">Position</label>
                <input type="text" class="form-control" name="position" id="ed_position" required>
              </div>
              <div class="col-md-4">
                <label class="form-label">Program</label>
                <input type="text" class="form-control" name="program" id="ed_program" required>
              </div>
              <div class="col-md-4">
                <label class="form-label">Year/Section</label>
                <input type="text" class="form-control" name="year_section" id="ed_year" required>
              </div>
              <div class="col-md-8">
                <label class="form-label">Platform</label>
                <textarea class="form-control" rows="3" name="platform" id="ed_platform"></textarea>
              </div>
              <div class="col-md-6">
                <label class="form-label">Photo URL</label>
                <input type="url" class="form-control" name="photo_url" id="ed_photo_url">
              </div>
              <div class="col-md-6">
                <label class="form-label">Party Logo URL</label>
                <input type="url" class="form-control" name="party_logo_url" id="ed_party_logo_url">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" id="saveEditBtn">Save changes</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div class="modal fade" id="deleteModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Unregister Candidate</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p class="mb-0">Are you sure you want to unregister <strong id="delName"></strong>?</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Unregister</button>
          </div>
        </div>
      </div>
    </div>

    <!-- View Details Modal (body root) -->
    <div class="modal fade" id="viewModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Candidate Details</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="d-flex gap-3 align-items-start">
                <img id="vd_photo" src="" alt="" class="rounded border" style="width:140px;height:140px;object-fit:cover;display:none;">
                <div class="flex-grow-1">
                    <div class="h5 mb-1" id="vd_name"></div>
                    <div class="text-muted small">Student ID: <span id="vd_student_id"></span></div>
                    <div class="mt-2 row g-2">
                        <div class="col-md-6"><strong>Organization:</strong> <span id="vd_org"></span></div>
                        <div class="col-md-6"><strong>Position:</strong> <span id="vd_position"></span></div>
                        <div class="col-md-6"><strong>Program:</strong> <span id="vd_program"></span></div>
                        <div class="col-md-6"><strong>Year/Section:</strong> <span id="vd_year"></span></div>
                        <div class="col-md-12 d-flex align-items-center gap-2"><strong>Party:</strong> <img id="vd_party_logo" src="" alt="" class="rounded-circle border" style="width:24px;height:24px;object-fit:cover;display:none;"> <span id="vd_party"></span></div>
                    </div>
                </div>
            </div>
            <hr>
            <div>
                <strong>Platform</strong>
                <div id="vd_platform" class="mt-1" style="white-space:pre-wrap"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
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

        const listEl = document.getElementById('candidatesList');
        const listCount = document.getElementById('listCount');
        const searchInput = document.getElementById('listSearch');
        const searchBtn = document.getElementById('listSearchBtn');

        function cardTemplate(item){
            const name = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(' ');
            const hasPhoto = !!(item.photo_url && item.photo_url.startsWith('http'));
            const avatarHtml = hasPhoto
                ? `<img src="${item.photo_url}" class="rounded-circle border" style="width:48px;height:48px;object-fit:cover;" alt="">`
                : `<div class="rounded-circle border d-flex align-items-center justify-content-center bg-light" style="width:48px;height:48px;"><i class="bi bi-person fs-4 text-secondary"></i></div>`;
            return `
            <div class="p-3 border rounded d-flex align-items-center gap-3 candidate-card" data-id="${item.id}" style="cursor:pointer;">
                <div class="form-check">
                    <input class="form-check-input row-check" type="checkbox" value="${item.id}">
                </div>
                ${avatarHtml}
                <div class="flex-grow-1">
                    <div class="fw-semibold">${name || item.student_id}</div>
                    <div class="small text-muted">Position: ${item.position || ''}</div>
                    <div class="small text-muted">Program: ${item.program || ''}</div>
                    <div class="small text-muted">Section: ${item.year_section || ''}</div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-outline-primary btn-sm" data-action="edit" data-id="${item.id}"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-outline-danger btn-sm" data-action="delete" data-id="${item.id}" data-name="${name || item.student_id}"><i class="bi bi-person-dash"></i></button>
                </div>
            </div>`;
        }

        function groupAndRender(list){
            if(!list || list.length===0){ listEl.innerHTML='<div class="text-muted">No candidates found.</div>'; listCount.textContent='0 candidate(s)'; return; }
            // Define position order per org
            const USG_ORDER = ['President','Vice President','General Secretary','Associate Secretary','Treasurer','Auditor','Public Information Officer','P.I.O','IT Representative','BSIT Representative','BTLED Representative','BFPT Representative'];
            const ORG_ORDER = ['President','Vice President','General Secretary','Associate Secretary','Treasurer','Auditor','Public Information Officer','P.I.O'];
            const getOrder = (org)=> (['SITE','PAFE','AFPROTECHS'].includes(org.toUpperCase()) ? ORG_ORDER : USG_ORDER);

            // Build nested groups: party -> organization -> position
            const byParty = {};
            list.forEach(it=>{
                const party = (it.party_name || 'Independent').toUpperCase();
                const org = (it.organization || 'USG').toUpperCase();
                const pos = it.position || 'Unspecified';
                if(!byParty[party]) byParty[party] = {};
                if(!byParty[party][org]) byParty[party][org] = {};
                if(!byParty[party][org][pos]) byParty[party][org][pos] = [];
                byParty[party][org][pos].push(it);
            });

            let html = '';
            const partyKeys = Object.keys(byParty).sort((a,b)=>{
                const ia = a.toUpperCase()==='INDEPENDENT' ? 1 : 0;
                const ib = b.toUpperCase()==='INDEPENDENT' ? 1 : 0;
                if (ia!==ib) return ia-ib; // Non-independent first, Independent last
                return a.localeCompare(b);
            });
            partyKeys.forEach(party=>{
                const totalInParty = Object.values(byParty[party]).reduce((sum, orgMap)=> sum + Object.values(orgMap).reduce((a,arr)=> a + arr.length, 0), 0);
                // Find party logo from any candidate in this party
                let partyLogo = '';
                Object.keys(byParty[party]).some(org => {
                    return Object.keys(byParty[party][org]).some(pos => {
                        const found = byParty[party][org][pos].find(x => x.party_logo_url && x.party_logo_url.startsWith('http'));
                        if (found) { partyLogo = found.party_logo_url; return true; }
                        return false;
                    });
                });
                const partyAvatar = partyLogo
                    ? `<img src="${partyLogo}" class="rounded-circle border" style="width:28px;height:28px;object-fit:cover;" alt="">`
                    : `<div class="rounded-circle border d-flex align-items-center justify-content-center bg-light" style="width:28px;height:28px;"><i class="bi bi-flag text-danger"></i></div>`;
                // Party header
                html += `
                <div class="p-2 px-3 bg-light border rounded d-flex align-items-center justify-content-between mt-2">
                    <div class="d-flex align-items-center gap-2">${partyAvatar}<span class="fw-semibold">${party}</span></div>
                    <span class="badge text-bg-secondary">${totalInParty}</span>
                </div>`;
                const orgKeys = Object.keys(byParty[party]).sort((a,b)=>{
                    const ORDER = ['USG','SITE','PAFE','AFPROTECHS'];
                    const ia = ORDER.indexOf(a.toUpperCase());
                    const ib = ORDER.indexOf(b.toUpperCase());
                    const aa = ia===-1 ? 999 : ia; const bb = ib===-1 ? 999 : ib;
                    if (aa!==bb) return aa-bb;
                    return a.localeCompare(b);
                });
                orgKeys.forEach(org=>{
                    const totalInOrg = Object.values(byParty[party][org]).reduce((a,arr)=> a + arr.length, 0);
                    html += `
                    <div class="ps-2 pt-2 pb-1 d-flex align-items-center gap-2"><i class="bi bi-building text-info"></i><span class="fw-semibold">${org}</span><span class="badge text-bg-light">${totalInOrg}</span></div>`;
                    const order = getOrder(org);
                    const positions = Object.keys(byParty[party][org]).sort((a,b)=>{
                        const ia = order.findIndex(x=> a.toLowerCase().includes(x.toLowerCase()));
                        const ib = order.findIndex(x=> b.toLowerCase().includes(x.toLowerCase()));
                        const aa = ia === -1 ? 999 : ia; const bb = ib === -1 ? 999 : ib;
                        if (aa!==bb) return aa-bb; return a.localeCompare(b);
                    });
                    positions.forEach(pos=>{
                        html += `
                        <div class="ps-4 pt-2 pb-1 small text-muted">${pos}</div>`;
                        byParty[party][org][pos].forEach(item=>{ html += cardTemplate(item); });
                    });
                });
            });
            listEl.innerHTML = html;
            listCount.textContent = `${list.length} candidate(s)`;
        }

        async function loadList(){
            const q = searchInput.value.trim();
            const res = await fetch(`elecom_candidates_api.php?action=list&q=${encodeURIComponent(q)}`);
            const data = await res.json();
            groupAndRender(data || []);
            // reset selects
            document.getElementById('selectAll').checked = false;
            updateBulkState();
        }

        let searchDebounce = null;
        searchInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){ loadList(); } });
        searchInput.addEventListener('input', ()=>{ clearTimeout(searchDebounce); searchDebounce = setTimeout(loadList, 300); });
        searchBtn.addEventListener('click', loadList);
        loadList();

        // Bulk select/delete
        function updateBulkState(){
            const checks = Array.from(document.querySelectorAll('.row-check'));
            const any = checks.some(c=>c.checked);
            document.getElementById('bulkDeleteBtn').disabled = !any;
        }
        document.addEventListener('change', (e)=>{
            if(e.target && e.target.classList.contains('row-check')){ updateBulkState(); }
        });
        document.getElementById('selectAll').addEventListener('change', (e)=>{
            const on = e.target.checked;
            document.querySelectorAll('.row-check').forEach(cb=>{ cb.checked = on; });
            updateBulkState();
        });
        document.getElementById('bulkDeleteBtn').addEventListener('click', async ()=>{
            const ids = Array.from(document.querySelectorAll('.row-check:checked')).map(cb=>parseInt(cb.value,10)).filter(Boolean);
            if(ids.length===0) return;
            if(!confirm(`Unregister ${ids.length} selected candidate(s)?`)) return;
            const fd = new FormData();
            fd.append('ids', JSON.stringify(ids));
            const res = await fetch('elecom_candidates_api.php?action=bulk_delete', { method:'POST', body: fd });
            const d = await res.json();
            if(d && d.ok){ loadList(); }
            else { alert(d && d.error ? d.error : 'Failed to unregister selected'); }
        });

        // Card click -> view details (ignore clicks on edit/delete buttons)
        const viewModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('viewModal'));
        document.getElementById('viewModal').addEventListener('hidden.bs.modal', ()=>{
            document.body.classList.remove('modal-open');
            document.querySelectorAll('.modal-backdrop').forEach(b=>b.remove());
        });
        document.addEventListener('click', async (e)=>{
            const btn = e.target.closest('button[data-action]');
            if (btn) return; // handled below in edit/delete flow
            const card = e.target.closest('.candidate-card');
            if(!card) return;
            const id = card.getAttribute('data-id');
            try {
                const res = await fetch(`elecom_candidates_api.php?action=detail&id=${encodeURIComponent(id)}`);
                const d = await res.json();
                if (d && !d.error) {
                    const name = [d.first_name, d.middle_name, d.last_name].filter(Boolean).join(' ');
                    document.getElementById('vd_name').textContent = name || '';
                    document.getElementById('vd_student_id').textContent = d.student_id || '';
                    document.getElementById('vd_org').textContent = d.organization || '';
                    document.getElementById('vd_position').textContent = d.position || '';
                    document.getElementById('vd_program').textContent = d.program || '';
                    document.getElementById('vd_year').textContent = d.year_section || '';
                    document.getElementById('vd_party').textContent = d.party_name || 'Independent';
                    const img = document.getElementById('vd_photo');
                    if (d.photo_url && d.photo_url.startsWith('http')) { img.src = d.photo_url; img.style.display = 'block'; }
                    else { img.style.display = 'none'; }
                    const logo = document.getElementById('vd_party_logo');
                    if (d.party_logo_url && d.party_logo_url.startsWith('http')) { logo.src = d.party_logo_url; logo.style.display = 'inline-block'; }
                    else { logo.style.display = 'none'; }
                    document.getElementById('vd_platform').textContent = d.platform || '';
                    viewModal.show();
                }
            } catch(_) {}
        });

        // Edit flow
        const editModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('editModal'));
        document.getElementById('editModal').addEventListener('hidden.bs.modal', ()=>{
            document.body.classList.remove('modal-open');
            document.querySelectorAll('.modal-backdrop').forEach(b=>b.remove());
        });
        const edForm = document.getElementById('editForm');
        document.addEventListener('click', async (e)=>{
            const btn = e.target.closest('button[data-action]');
            if(!btn) return;
            const id = btn.getAttribute('data-id');
            if(btn.getAttribute('data-action')==='edit'){
                const res = await fetch(`elecom_candidates_api.php?action=detail&id=${encodeURIComponent(id)}`);
                const d = await res.json();
                if(d && !d.error){
                    document.getElementById('ed_id').value = d.id;
                    document.getElementById('ed_first_name').value = d.first_name || '';
                    document.getElementById('ed_middle_name').value = d.middle_name || '';
                    document.getElementById('ed_last_name').value = d.last_name || '';
                    document.getElementById('ed_org').value = d.organization || '';
                    document.getElementById('ed_position').value = d.position || '';
                    document.getElementById('ed_program').value = d.program || '';
                    document.getElementById('ed_year').value = d.year_section || '';
                    document.getElementById('ed_platform').value = d.platform || '';
                    document.getElementById('ed_photo_url').value = d.photo_url || '';
                    document.getElementById('ed_party_logo_url').value = d.party_logo_url || '';
                    editModal.show();
                }
            }
            if(btn.getAttribute('data-action')==='delete'){
                document.getElementById('delName').textContent = btn.getAttribute('data-name') || '';
                document.getElementById('confirmDeleteBtn').setAttribute('data-id', id);
                new bootstrap.Modal(document.getElementById('deleteModal')).show();
            }
        });
        document.getElementById('saveEditBtn').addEventListener('click', async function(){
            const formData = new FormData(edForm);
            const res = await fetch('elecom_candidates_api.php?action=update', { method:'POST', body: formData });
            const d = await res.json();
            if(d && d.ok){ editModal.hide(); loadList(); }
            else { alert(d && d.error ? d.error : 'Failed to save changes'); }
        });
        document.getElementById('confirmDeleteBtn').addEventListener('click', async function(){
            const id = this.getAttribute('data-id');
            const fd = new FormData(); fd.append('id', id);
            const res = await fetch('elecom_candidates_api.php?action=delete', { method:'POST', body: fd });
            const d = await res.json();
            if(d && d.ok){ bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide(); loadList(); }
            else { alert(d && d.error ? d.error : 'Failed to unregister'); }
        });
    });
    </script>
</body>
</html>

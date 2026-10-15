document.addEventListener("DOMContentLoaded", function () {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const closeSidebar = document.getElementById("closeSidebar");

  if (menuToggle && sidebar && sidebarOverlay) {
    menuToggle.addEventListener("click", function () {
      sidebar.classList.add("active");
      sidebarOverlay.classList.add("active");
    });
  }
  if (closeSidebar && sidebar && sidebarOverlay) {
    closeSidebar.addEventListener("click", function () {
      sidebar.classList.remove("active");
      sidebarOverlay.classList.remove("active");
    });
  }
  if (sidebarOverlay && sidebar) {
    sidebarOverlay.addEventListener("click", function () {
      sidebar.classList.remove("active");
      sidebarOverlay.classList.remove("active");
    });
  }
  window.addEventListener("resize", function () {
    if (window.innerWidth > 992 && sidebar && sidebarOverlay) {
      sidebar.classList.remove("active");
      sidebarOverlay.classList.remove("active");
    }
  });

  const els = {
    ledgerStatus: document.getElementById("ledgerStatus"),
    lastVerified: document.getElementById("lastVerified"),
    totalBlocks: document.getElementById("totalBlocks"),
    ledgerRows: document.getElementById("ledgerRows"),
    ledgerEmpty: document.getElementById("ledgerEmpty"),
    ledgerTableWrap: document.getElementById("ledgerTableWrap"),
    statusCard: document.querySelector(".status-card"),
    refreshBtn: document.getElementById("refreshLedgerBtn"),
    verifyBtn: document.getElementById("verifyLedgerBtn"),
    pagination: document.getElementById("ledgerPagination"),
    previous: document.getElementById("ledgerPrevious"),
    next: document.getElementById("ledgerNext"),
    pageStatus: document.getElementById("ledgerPageStatus"),
    hashInput: document.getElementById("hashLookupInput"),
    inspectBtn: document.getElementById("btnVerifyHash"),
    detailsModal: document.getElementById("blockDetailsModal"),
    matchSelect: document.getElementById("hashMatchSelect"),
  };

  const PAGE_SIZE = 10;
  let ledgerBlocks = [];
  let ledgerPage = 1;
  const copyTooltips = new Map();
  let inspectionMatches = [];

  function lookupQuery() {
    return String(els.hashInput?.value || "").trim().toLowerCase();
  }

  function matchesHash(value) {
    const query = lookupQuery();
    return Boolean(query && String(value || "").toLowerCase().includes(query));
  }

  function matchingBlocks() {
    if (!lookupQuery()) return ledgerBlocks;
    return ledgerBlocks.filter(block => [
      block.block_hash_full, block.hash_full, block.vote_hash_full, block.previous_hash_full,
      block.block_hash, block.hash, block.vote_hash, block.previous_hash,
    ].some(matchesHash));
  }

  function showBlockDetails(index = 0) {
    const block = inspectionMatches[index];
    const details = document.getElementById("hashInspectionDetails");
    details.hidden = !block;
    if (!block) return;
    text(document.getElementById("inspectedBlockNumber"), `#${block.block_number || block.id || "-"}`);
    text(document.getElementById("inspectedBlockHash"), block.block_hash_full || block.hash_full || "Not supplied");
    text(document.getElementById("inspectedVoteHash"), block.vote_hash_full || "Not supplied");
    text(document.getElementById("inspectedPreviousHash"), block.previous_hash_full || "None (genesis block)");
    text(document.getElementById("inspectedBlockStatus"), block.block_status || block.status || "Pending");
    text(document.getElementById("inspectedVoteIntegrity"), block.vote_rows_missing
      ? "Warning: vote rows are missing"
      : block.vote_changed ? "Warning: recorded vote data has changed"
        : "No vote changes reported by the ledger API");
    // The current API returns no Merkle root or inclusion proof.
    text(document.getElementById("inspectedMerkleStatus"), "Not available — no Merkle proof supplied");
  }

  function inspectHash() {
    inspectionMatches = lookupQuery() ? matchingBlocks() : [];
    const message = !lookupQuery() ? "Paste a hash to inspect a block."
      : inspectionMatches.length ? `${inspectionMatches.length} matching block(s) found. A hash match locates a record; it does not prove cryptographic integrity.`
        : "No matching hash in the loaded ledger blocks. This lookup does not search older blocks outside the loaded list.";
    text(document.getElementById("hashInspectionMessage"), message);
    document.getElementById("hashMatchPicker").hidden = inspectionMatches.length < 2;
    els.matchSelect.innerHTML = inspectionMatches.map((block, index) =>
      `<option value="${index}">Block #${escapeHtml(block.block_number || block.id || "-")}</option>`).join("");
    els.matchSelect.value = "0";
    showBlockDetails();
    bootstrap.Modal.getOrCreateInstance(els.detailsModal).show();
  }

  function showLedgerToast(message, isError = false) {
    const element = document.getElementById("ledgerToast");
    text(document.getElementById("ledgerToastMessage"), message);
    element.classList.toggle("text-bg-danger", isError);
    element.classList.toggle("text-bg-success", !isError);
    element.setAttribute("role", isError ? "alert" : "status");
    bootstrap.Toast.getOrCreateInstance(element, { delay: 5000 }).show();
  }

  function disposeCopyTooltips() {
    copyTooltips.forEach(({ tooltip, timer }) => {
      clearTimeout(timer);
      tooltip.dispose();
    });
    copyTooltips.clear();
  }

  function hashBadge(display, fullHash) {
    if (!fullHash) return '<span class="ledger-hash">' + escapeHtml(display || "-") + '</span>';
    return `<button type="button" class="ledger-hash ${matchesHash(fullHash) || matchesHash(display) ? "hash-highlight" : ""}" data-copy-hash="${escapeHtml(fullHash)}"
      aria-label="Copy full hash">${escapeHtml(display || fullHash)}</button>`;
  }

  async function copyHash(event) {
    const button = event.target.closest("[data-copy-hash]");
    if (!button || !els.ledgerRows.contains(button)) return;
    try {
      await navigator.clipboard.writeText(button.dataset.copyHash);
      if (!button.isConnected) return;
      const previous = copyTooltips.get(button);
      if (previous) { clearTimeout(previous.timer); previous.tooltip.dispose(); }
      const tooltip = new bootstrap.Tooltip(button, {
        title: "Hash copied to clipboard!", trigger: "manual", container: "body",
      });
      tooltip.show();
      const timer = setTimeout(() => {
        tooltip.dispose();
        copyTooltips.delete(button);
      }, 2000);
      copyTooltips.set(button, { tooltip, timer });
    } catch (_) {
      showLedgerToast("Unable to copy hash. Please allow clipboard access and try again.", true);
    }
  }

  function renderPage() {
    const filtered = matchingBlocks();
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    ledgerPage = Math.max(1, Math.min(ledgerPage, pages));
    const start = (ledgerPage - 1) * PAGE_SIZE;
    renderRows(filtered.slice(start, start + PAGE_SIZE));
    els.pagination.hidden = ledgerBlocks.length === 0;
    els.previous.disabled = ledgerPage === 1;
    els.next.disabled = ledgerPage === pages;
    text(els.pageStatus, lookupQuery()
      ? `${filtered.length} matching record(s) found`
      : filtered.length
        ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length} loaded blocks (page ${ledgerPage} of ${pages})`
        : "0 blocks");
  }

  function text(el, value) {
    if (el) el.textContent = value;
  }

  function statusState(value) {
    const normalized = String(value || "").toLowerCase();
    if (normalized.includes("modified")) return "critical";
    if (normalized.includes("critical")) return "critical";
    if (normalized.includes("warning")) return "warning";
    if (normalized === "valid" || normalized === "accepted") return "valid";
    return "warning";
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })} PHT`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderRows(blocks) {
    if (!els.ledgerRows) return;
    disposeCopyTooltips();
    if (!blocks.length && lookupQuery() && ledgerBlocks.length) {
      if (els.ledgerEmpty) els.ledgerEmpty.hidden = true;
      if (els.ledgerTableWrap) els.ledgerTableWrap.hidden = false;
      els.ledgerRows.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No matching hash in the loaded blocks.</td></tr>';
      return;
    }
    if (!blocks.length) {
      if (els.ledgerEmpty) els.ledgerEmpty.hidden = false;
      if (els.ledgerTableWrap) els.ledgerTableWrap.hidden = true;
      els.ledgerRows.innerHTML = "";
      return;
    }

    if (els.ledgerEmpty) els.ledgerEmpty.hidden = true;
    if (els.ledgerTableWrap) els.ledgerTableWrap.hidden = false;

    els.ledgerRows.innerHTML = blocks
      .map((block) => {
        const status = String(block.block_status || block.status || "pending").toLowerCase();
        const voteChanged = Boolean(block.vote_changed || block.vote_rows_missing);
        const tamperReason = block.vote_rows_missing
          ? "Vote rows are missing for this block."
          : block.vote_changed
            ? "Vote rows were changed after this block was recorded."
            : "";
        const changedAt = block.vote_changed_at ? formatDate(block.vote_changed_at) : "";
        const reasonText = tamperReason
          ? `${tamperReason}${changedAt ? ` Changed at ${changedAt}.` : ""}`
          : "";
        return `
          <tr class="${voteChanged ? "ledger-row-warning" : ""} ${lookupQuery() ? "ledger-row-match" : ""}">
            <td data-label="Block">#${escapeHtml(block.block_number || block.id || "-")}</td>
            <td data-label="Block Hash">${hashBadge(block.block_hash || block.hash, block.block_hash_full || block.hash_full)}</td>
            <td data-label="Vote Hash">${hashBadge(block.vote_hash, block.vote_hash_full)}</td>
            <td data-label="Previous Hash">${hashBadge(block.previous_hash, block.previous_hash_full)}</td>
            <td data-label="Status">
              <span class="ledger-status ${escapeHtml(status)}"><i class="bi bi-shield-check"></i>${escapeHtml(status)}</span>
              ${reasonText ? `<div class="ledger-reason">${escapeHtml(reasonText)}</div>` : ""}
            </td>
            <td data-label="Submitted">${escapeHtml(formatDate(block.submitted_at))}</td>
          </tr>
        `;
      })
      .join("");
  }

  function setLoading(isLoading) {
    [els.refreshBtn, els.verifyBtn].forEach((button) => {
      if (button) button.disabled = isLoading;
    });
  }

  async function loadLedger() {
    setLoading(true);
    try {
      const response = await fetch("/api/vote/ledger/", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load vote ledger.");
      }

      const summary = data.summary || {};
      const blocks = data.public_block_list || data.blocks || [];
      const state = statusState(summary.ledger_status);

      text(els.ledgerStatus, summary.ledger_status || "Warning");
      text(els.lastVerified, `Last checked ${formatDate(summary.last_verified)}`);
      text(els.totalBlocks, String(summary.total_vote_blocks || blocks.length || 0));
      if (els.statusCard) els.statusCard.dataset.state = state;
      ledgerBlocks = Array.isArray(blocks) ? blocks : [];
      renderPage();
    } catch (error) {
      ledgerBlocks = [];
      renderPage();
      if (els.ledgerEmpty) els.ledgerEmpty.hidden = true;
      if (els.ledgerTableWrap) els.ledgerTableWrap.hidden = false;
      text(els.ledgerStatus, "Unavailable");
      text(els.lastVerified, error.message || "Failed to load ledger.");
      if (els.statusCard) els.statusCard.dataset.state = "critical";
      if (els.ledgerRows) {
        els.ledgerRows.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">${escapeHtml(error.message || "Failed to load ledger.")}</td></tr>`;
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyLedger() {
    setLoading(true);
    try {
      const response = await fetch("/api/vote/ledger/verify/", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to verify ledger.");
      }

      const state = statusState(data.ledger_status);
      text(els.ledgerStatus, data.ledger_status || "Warning");
      text(els.lastVerified, `Verified ${formatDate(data.last_verified)}`);
      text(els.totalBlocks, String(data.total_vote_blocks || 0));
      if (els.statusCard) els.statusCard.dataset.state = state;
      await loadLedger();
      const verified = state === "valid" &&
        Array.isArray(data.issues) && data.issues.length === 0 &&
        !data.vote_tampering_detected &&
        !data.changed_vote_count && !data.missing_vote_rows_count;
      showLedgerToast(verified
        ? "Chain Integrity Verified: All blocks valid"
        : "Chain verification found issues. Review the ledger status and flagged blocks.", !verified);
    } catch (error) {
      showLedgerToast(error.message || "Failed to verify ledger.", true);
      text(els.ledgerStatus, "Unavailable");
      text(els.lastVerified, error.message || "Failed to verify ledger.");
      if (els.statusCard) els.statusCard.dataset.state = "critical";
    } finally {
      setLoading(false);
    }
  }

  if (els.refreshBtn) els.refreshBtn.addEventListener("click", loadLedger);
  if (els.verifyBtn) els.verifyBtn.addEventListener("click", verifyLedger);

  els.hashInput?.addEventListener("input", () => { ledgerPage = 1; renderPage(); });
  els.hashInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); inspectHash(); }
  });
  els.inspectBtn?.addEventListener("click", inspectHash);
  els.matchSelect?.addEventListener("change", () => showBlockDetails(Number(els.matchSelect.value)));
  els.previous?.addEventListener("click", () => { ledgerPage--; renderPage(); });
  els.next?.addEventListener("click", () => { ledgerPage++; renderPage(); });
  els.ledgerRows?.addEventListener("click", copyHash);
  window.addEventListener("pagehide", disposeCopyTooltips);

  loadLedger();
});

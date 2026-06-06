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
    latestHash: document.getElementById("latestHash"),
    ledgerRows: document.getElementById("ledgerRows"),
    ledgerEmpty: document.getElementById("ledgerEmpty"),
    ledgerTableWrap: document.getElementById("ledgerTableWrap"),
    statusCard: document.querySelector(".status-card"),
    refreshBtn: document.getElementById("refreshLedgerBtn"),
    verifyBtn: document.getElementById("verifyLedgerBtn"),
    verificationSummary: document.getElementById("verificationSummary"),
    verificationPill: document.getElementById("verificationPill"),
    verificationList: document.getElementById("verificationList"),
  };

  function text(el, value) {
    if (el) el.textContent = value;
  }

  function statusState(value) {
    const normalized = String(value || "").toLowerCase();
    if (normalized.includes("modified")) return "critical";
    if (normalized.includes("critical")) return "critical";
    if (normalized.includes("warning")) return "warning";
    if (normalized.includes("valid") || normalized.includes("accepted")) return "valid";
    return "warning";
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
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
        const voteStatus = block.vote_rows_missing ? "Missing" : voteChanged ? "Modified" : "Match";
        const voteStatusClass = block.vote_rows_missing ? "rejected" : voteChanged ? "warning" : "valid";
        const liveVoteHash = block.vote_rows_missing ? "Missing rows" : (block.live_vote_hash || "-");
        return `
          <tr class="${voteChanged ? "ledger-row-warning" : ""}">
            <td>#${escapeHtml(block.block_number || block.id || "-")}</td>
            <td><span class="ledger-hash" title="${escapeHtml(block.block_hash_full || block.hash_full || "")}">${escapeHtml(block.block_hash || block.hash || "-")}</span></td>
            <td><span class="ledger-hash" title="${escapeHtml(block.vote_hash_full || "")}">${escapeHtml(block.vote_hash || "-")}</span></td>
            <td>
              <span class="ledger-hash" title="${escapeHtml(block.live_vote_hash_full || "")}">${escapeHtml(liveVoteHash)}</span>
              <span class="ledger-status vote-integrity ${escapeHtml(voteStatusClass)}">${escapeHtml(voteStatus)}</span>
            </td>
            <td><span class="ledger-hash" title="${escapeHtml(block.previous_hash_full || "")}">${escapeHtml(block.previous_hash || "-")}</span></td>
            <td><span class="ledger-status ${escapeHtml(status)}"><i class="bi bi-shield-check"></i>${escapeHtml(status)}</span></td>
            <td>${escapeHtml(formatDate(block.submitted_at))}</td>
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
      text(els.latestHash, summary.latest_hash || "-");
      if (els.statusCard) els.statusCard.dataset.state = state;
      renderRows(blocks);
      if (summary.vote_tampering_detected) {
        const changed = Number(summary.changed_vote_count || 0);
        const missing = Number(summary.missing_vote_rows_count || 0);
        text(els.verificationPill, "Modified");
        if (els.verificationPill) els.verificationPill.className = "verification-pill critical";
        text(
          els.verificationSummary,
          `${changed} changed vote(s), ${missing} missing vote row set(s) detected.`
        );
        if (els.verificationList) {
          els.verificationList.innerHTML = [
            changed ? `<li>${changed} block(s) have vote hashes that no longer match database vote rows.</li>` : "",
            missing ? `<li>${missing} block(s) reference vote rows that are missing from the database.</li>` : "",
          ].filter(Boolean).join("");
        }
      }
    } catch (error) {
      text(els.ledgerStatus, "Unavailable");
      text(els.lastVerified, error.message || "Failed to load ledger.");
      if (els.statusCard) els.statusCard.dataset.state = "critical";
      if (els.ledgerRows) {
        els.ledgerRows.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">${escapeHtml(error.message || "Failed to load ledger.")}</td></tr>`;
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyLedger() {
    if (els.verifyBtn) els.verifyBtn.disabled = true;
    try {
      const response = await fetch("/api/vote/ledger/verify/", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to verify ledger.");
      }

      const state = statusState(data.ledger_status);
      text(els.verificationPill, data.ledger_status || "Warning");
      if (els.verificationPill) {
        els.verificationPill.className = `verification-pill ${state}`;
      }
      text(
        els.verificationSummary,
        `${data.total_vote_blocks || 0} block(s) checked. ${data.changed_vote_count || 0} changed vote(s), ${data.missing_vote_rows_count || 0} missing vote row set(s). Last verified ${formatDate(data.last_verified)}.`
      );
      const issues = data.issues || [];
      if (els.verificationList) {
        els.verificationList.innerHTML = issues.length
          ? issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")
          : "<li>No issues found. Hash chain and database vote rows are valid.</li>";
      }
    } catch (error) {
      text(els.verificationPill, "Failed");
      if (els.verificationPill) els.verificationPill.className = "verification-pill critical";
      text(els.verificationSummary, error.message || "Failed to verify ledger.");
      if (els.verificationList) {
        els.verificationList.innerHTML = `<li>${escapeHtml(error.message || "Failed to verify ledger.")}</li>`;
      }
    } finally {
      if (els.verifyBtn) els.verifyBtn.disabled = false;
    }
  }

  if (els.refreshBtn) els.refreshBtn.addEventListener("click", loadLedger);
  if (els.verifyBtn) els.verifyBtn.addEventListener("click", verifyLedger);

  loadLedger();
});

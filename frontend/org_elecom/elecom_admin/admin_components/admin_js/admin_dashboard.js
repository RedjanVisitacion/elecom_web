document.addEventListener("DOMContentLoaded", function () {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const closeSidebar = document.getElementById("closeSidebar");
  const logoutLink = document.getElementById("logoutLink");
  const displayName = document.getElementById("displayName");
  const displayRole = document.getElementById("displayRole");

  const kpiCandidates = document.getElementById("kpiCandidates");
  const kpiVoters = document.getElementById("kpiVoters");
  const kpiCastVotes = document.getElementById("kpiCastVotes");
  const kpiNotVoted = document.getElementById("kpiNotVoted");
  const electionStatus = document.getElementById("electionStatus");
  const electionHelperText = document.getElementById("electionHelperText");
  const electionNoteText = document.getElementById("electionNoteText");
  const electionDateRangeText = document.getElementById("electionDateRangeText");
  const electionCalendar = document.getElementById("electionCalendar");
  const electionLegend = document.getElementById("electionLegend");
  const electionWindowInfo = document.getElementById("electionWindowInfo");
  const electionStartText = document.getElementById("electionStartText");
  const electionEndText = document.getElementById("electionEndText");
  const electionWindowStatusText = document.getElementById("electionWindowStatusText");
  const vwInfo = document.getElementById("vwInfo");
  const vwStartText = document.getElementById("vwStartText");
  const vwEndText = document.getElementById("vwEndText");
  const vwStatusText = document.getElementById("vwStatusText");
  const ecDays = document.getElementById("ec_days");
  const ecHours = document.getElementById("ec_hours");
  const ecMins = document.getElementById("ec_mins");
  const ecSecs = document.getElementById("ec_secs");
  const recentVotesEmpty = document.getElementById("recentVotesEmpty");
  const recentVotesScroll = document.getElementById("recentVotesScroll");
  const recentVotesList = document.getElementById("recentVotesList");

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

  document.querySelectorAll(".sidebar .nav-link").forEach((link) => {
    link.addEventListener("click", function () {
      if (window.innerWidth <= 992 && sidebar && sidebarOverlay) {
        sidebar.classList.remove("active");
        sidebarOverlay.classList.remove("active");
      }
    });
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 992 && sidebar && sidebarOverlay) {
      sidebar.classList.remove("active");
      sidebarOverlay.classList.remove("active");
    }
  });

  const toLogin = () => {
    try {
      sessionStorage.removeItem("elecom_role");
      sessionStorage.removeItem("elecom_user");
    } catch (e) {
      // ignore
    }
    const base = window.location.origin;
    window.location.href = `${base}/login/`;
  };

  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      toLogin();
    });
  }

  try {
    const role = sessionStorage.getItem("elecom_role") || "admin";
    const user = sessionStorage.getItem("elecom_user") || "";
    if (displayName) displayName.textContent = user || "Admin";
    if (displayRole) displayRole.textContent = role;
  } catch (e) {
    // ignore
  }

  const setText = (el, value) => {
    if (!el) return;
    el.textContent = value;
  };

  const setElectionBadge = (status, statusClass) => {
    if (!electionStatus) return;
    const cls = statusClass || "secondary";
    electionStatus.className = `badge bg-${cls}`;
    electionStatus.textContent = status || "No schedule";
  };

  const setElectionTexts = (election) => {
    if (!electionHelperText && !electionNoteText) return;
    const hasSchedule = !!(election && election.start_at && election.end_at);
    const status = (election && election.status) ? String(election.status) : "No schedule";

    if (!hasSchedule) {
      if (electionHelperText) electionHelperText.textContent = "Set the election schedule in Set Election Dates.";
      if (electionNoteText) electionNoteText.textContent = "No schedule set. Go to Set Election Dates to configure.";
      return;
    }

    if (status === "Upcoming") {
      if (electionHelperText) electionHelperText.textContent = "Election is upcoming. Countdown shows time until voting starts.";
      if (electionNoteText) electionNoteText.textContent = "Voting has not started yet.";
      return;
    }

    if (status === "Active") {
      if (electionHelperText) electionHelperText.textContent = "Election is active. Countdown shows time until voting ends.";
      if (electionNoteText) electionNoteText.textContent = "Voting is currently open.";
      return;
    }

    if (status === "Closed") {
      if (electionHelperText) electionHelperText.textContent = "Election is closed.";
      if (electionNoteText) electionNoteText.textContent = "Voting window ended.";
      return;
    }

    if (electionHelperText) electionHelperText.textContent = "Election schedule is set.";
    if (electionNoteText) electionNoteText.textContent = "";
  };

  const fmtDt = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const datePart = d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
    const timePart = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart} — ${timePart}`;
  };

  const dateOnlyKey = (d) => {
    if (!d || !Number.isFinite(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const legendDot = (color) =>
    `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;flex:0 0 auto;"></span>`;

  const renderElectionLegend = () => {
    if (!electionLegend) return;
    const BLUE = "#2F80ED";
    const PURPLE = "#9B51E0";
    const RED = "#EB5757";
    const GRAY = "#E0E0E0";

    electionLegend.innerHTML = `
<div class="small text-muted mb-2">Legend</div>
<div class="d-flex flex-wrap gap-3">
  <div class="d-flex align-items-center">${legendDot(BLUE)}<span class="small">Today’s Date</span></div>
  <div class="d-flex align-items-center">${legendDot(PURPLE)}<span class="small">Election Event Date</span></div>
  <div class="d-flex align-items-center">${legendDot(RED)}<span class="small">Voting Closed / End Date</span></div>
  <div class="d-flex align-items-center">${legendDot(GRAY)}<span class="small">Normal Dates</span></div>
</div>`;
    electionLegend.style.display = "block";
  };

  const renderElectionCalendar = (startIso, endIso) => {
    if (!electionCalendar) return;
    const start = startIso ? new Date(startIso) : null;
    const end = endIso ? new Date(endIso) : null;
    if (!start || !end || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      electionCalendar.style.display = "none";
      electionCalendar.innerHTML = "";
      return;
    }

    const BLUE = "#2F80ED";
    const PURPLE = "#9B51E0";
    const RED = "#EB5757";
    const GRAY = "#E0E0E0";

    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const firstDow = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();

    const startKey = dateOnlyKey(start);
    const endKey = dateOnlyKey(end);
    const todayKey = dateOnlyKey(new Date());

    const inRange = (y, m, day) => {
      const k = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return k >= startKey && k <= endKey;
    };

    const monthLabel = monthStart.toLocaleString(undefined, { month: "long", year: "numeric" });

    let html = "";
    html += `<div class="d-flex align-items-center justify-content-between mb-1">`;
    html += `<div class="fw-semibold small">${monthLabel}</div>`;
    html += `</div>`;
    html += `<table class="table table-sm mb-0" style="table-layout: fixed;">`;
    html += `<thead><tr>`;
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach((w) => {
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
        const k = `${y}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        const isStart = k === startKey;
        const isEnd = k === endKey;
        const isToday = k === todayKey;

        let bg = GRAY;
        let fg = "#111";
        if (isToday) {
          bg = BLUE;
          fg = "#fff";
        }
        if (isStart) {
          bg = PURPLE;
          fg = "#fff";
        }
        if (isEnd) {
          bg = RED;
          fg = "#fff";
        }

        const ring = isToday ? `box-shadow:0 0 0 2px ${BLUE}55;` : "";
        const style = `background:${bg};color:${fg};border-radius:999px;width:30px;height:30px;line-height:30px;display:inline-block;${ring}`;
        html += `<td class="text-center" style="border:0;">`;
        html += `<div style="${style}">${dayNum}</div>`;
        html += `</td>`;
        dayNum++;
      }
      html += `</tr>`;
      if (dayNum > daysInMonth) break;
    }

    html += `</tbody></table>`;
    electionCalendar.innerHTML = html;
    electionCalendar.style.display = "block";
  };

  const setElectionScheduleDetails = (election) => {
    const hasSchedule = !!(election && election.start_at && election.end_at);
    const status = (election && election.status) ? String(election.status) : "No schedule";
    const windowStatus = status === "Active" ? "Open" : status === "Upcoming" ? "Closed" : status === "Closed" ? "Closed" : status;
    const statusMsg =
      status === "Active"
        ? "Voting is currently open."
        : status === "Upcoming"
          ? "Voting has not started yet."
          : status === "Closed"
            ? "Voting window ended."
            : "";

    if (electionWindowInfo) {
      if (!hasSchedule) {
        electionWindowInfo.style.display = "none";
      } else {
        electionWindowInfo.style.display = "block";
      }
    }

    if (electionStartText) electionStartText.textContent = hasSchedule ? fmtDt(election.start_at) : "";
    if (electionEndText) electionEndText.textContent = hasSchedule ? fmtDt(election.end_at) : "";
    if (electionWindowStatusText) electionWindowStatusText.textContent = hasSchedule ? windowStatus : "";

    if (vwInfo) vwInfo.style.display = hasSchedule ? "block" : "none";
    if (vwStartText) vwStartText.textContent = hasSchedule ? fmtDt(election.start_at) : "";
    if (vwEndText) vwEndText.textContent = hasSchedule ? fmtDt(election.end_at) : "";
    if (vwStatusText) vwStatusText.textContent = hasSchedule ? windowStatus : "";

    if (electionDateRangeText) {
      if (!hasSchedule) {
        electionDateRangeText.style.display = "none";
        electionDateRangeText.textContent = "";
      } else {
        const startText = fmtDt(election.start_at);
        const endText = fmtDt(election.end_at);
        electionDateRangeText.textContent = `Start: ${startText} | End: ${endText}`;
        electionDateRangeText.style.display = "block";
      }
    }

    if (!hasSchedule) {
      if (electionCalendar) {
        electionCalendar.style.display = "none";
        electionCalendar.innerHTML = "";
      }
      return;
    }

    renderElectionCalendar(election.start_at, election.end_at);
  };

  const pad2 = (n) => String(Math.max(0, Math.floor(Number(n) || 0))).padStart(2, "0");

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

  const fmt = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return "0";
    return num.toLocaleString();
  };

  const renderRecentVotes = (items) => {
    if (!recentVotesList || !recentVotesScroll || !recentVotesEmpty) return;
    const list = Array.isArray(items) ? items : [];

    if (list.length === 0) {
      recentVotesEmpty.style.display = "block";
      recentVotesScroll.style.display = "none";
      recentVotesList.innerHTML = "";
      return;
    }

    recentVotesEmpty.style.display = "none";
    recentVotesScroll.style.display = "block";
    recentVotesList.innerHTML = list
      .map((rv) => {
        const name = rv.name || rv.student_id || "";
        const sid = rv.student_id || "";
        const dt = rv.voted_at ? new Date(rv.voted_at).toLocaleString() : "";
        return `
<li class="list-group-item d-flex justify-content-between align-items-center">
  <div class="d-flex align-items-center gap-2">
    <i class="bi bi-person-check text-success"></i>
    <div>
      <div class="fw-semibold">${name}</div>
      <div class="small text-muted">${sid}</div>
    </div>
  </div>
  <div class="small text-muted">${dt}</div>
</li>`;
      })
      .join("");
  };

  const loadDashboard = async () => {
    try {
      const res = await fetch("/api/admin/dashboard/", {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return;

      const m = data.metrics || {};
      setText(kpiCandidates, fmt(m.total_candidates));
      setText(kpiVoters, fmt(m.total_voters));
      setText(kpiCastVotes, fmt(m.total_cast_votes));
      setText(kpiNotVoted, fmt(m.total_not_voted));

      const e = data.election || {};
      setElectionBadge(e.status, e.status_class);
      setElectionTexts(e);
      setElectionScheduleDetails(e);
      startCountdown({ start_at: e.start_at, end_at: e.end_at });
      renderRecentVotes(data.recent_votes);
    } catch (e) {
      // ignore
    }
  };

  void loadDashboard();

  const input = document.getElementById("candidateSearch");
  const btn = document.getElementById("candidateSearchBtn");
  const results = document.getElementById("searchResults");
  let debounceTimer = null;

  function hideResults() {
    if (!results) return;
    results.style.display = "none";
    results.innerHTML = "";
  }

  function showResults(items) {
    if (!results) return;
    if (!items || items.length === 0) {
      hideResults();
      return;
    }

    const placeholder = "https://via.placeholder.com/40x40?text=%20";
    results.innerHTML = items
      .map((item) => {
        const name = [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(" ");
        const photo = item.photo_url && item.photo_url.startsWith("http") ? item.photo_url : placeholder;
        return `\n<a href="#" class="list-group-item list-group-item-action" data-id="${item.id}">\n  <div class="d-flex align-items-center gap-2">\n    <img src="${photo}" alt="" class="rounded-circle border" style="width:40px;height:40px;object-fit:cover;">\n    <div class="flex-grow-1">\n      <div class="d-flex w-100 justify-content-between">\n        <strong>${name}</strong>\n        <small>${item.student_id || ""}</small>\n      </div>\n      <div class="small text-muted">${item.position || ""}${item.organization ? " • " + item.organization : ""}</div>\n    </div>\n  </div>\n</a>`;
      })
      .join("");

    results.style.display = "block";
  }

  async function doSearch() {
    if (!input) return;
    const q = input.value.trim();
    if (!q || q.length < 2) {
      hideResults();
      return;
    }

    hideResults();
  }

  if (input) {
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, 250);
    });
  }

  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      doSearch();
    });
  }

  document.addEventListener("click", (e) => {
    if (!results || !input) return;
    if (!results.contains(e.target) && e.target !== input) {
      hideResults();
    }
  });

  if (results) {
    results.addEventListener("click", (e) => {
      const link = e.target.closest("a[data-id]");
      if (!link) return;
      e.preventDefault();
      hideResults();
    });
  }

  // keep unused function so you can easily re-enable later
  void showResults;
});

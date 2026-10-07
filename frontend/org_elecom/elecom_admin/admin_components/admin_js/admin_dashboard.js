document.addEventListener("DOMContentLoaded", function () {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const closeSidebar = document.getElementById("closeSidebar");

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
  const totalVotersCard = document.getElementById("totalVotersCard");
  const votersAccessModalEl = document.getElementById("votersAccessModal");
  const votersAccessPassword = document.getElementById("votersAccessPassword");
  const votersAccessError = document.getElementById("votersAccessError");
  const votersAccessConfirmBtn = document.getElementById("votersAccessConfirmBtn");
  const votersAccessModal = votersAccessModalEl && window.bootstrap
    ? window.bootstrap.Modal.getOrCreateInstance(votersAccessModalEl)
    : null;

  const showVotersAccessError = (message) => {
    if (!votersAccessError) return;
    votersAccessError.textContent = message || "";
    votersAccessError.style.setProperty("display", message ? "block" : "none", "important");
  };

  const setVotersAccessLoading = (loading) => {
    if (!votersAccessConfirmBtn) return;
    votersAccessConfirmBtn.disabled = !!loading;
    if (loading) {
      votersAccessConfirmBtn.dataset.originalHtml = votersAccessConfirmBtn.dataset.originalHtml || votersAccessConfirmBtn.innerHTML;
      votersAccessConfirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Checking...';
    } else {
      votersAccessConfirmBtn.innerHTML = votersAccessConfirmBtn.dataset.originalHtml || '<i class="bi bi-shield-lock"></i> Continue';
    }
  };

  const verifyVotersAccess = async () => {
    const password = votersAccessPassword ? votersAccessPassword.value.trim() : "";
    if (!password) {
      showVotersAccessError("Enter your admin password.");
      if (votersAccessPassword) votersAccessPassword.focus();
      return;
    }

    setVotersAccessLoading(true);
    showVotersAccessError("");
    try {
      const res = await fetch("/api/admin/verify-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        showVotersAccessError(data.error || "Incorrect admin password.");
        if (votersAccessPassword) {
          votersAccessPassword.select();
          votersAccessPassword.focus();
        }
        return;
      }
      const votersUrl = "/static/org_elecom/elecom_admin/elecom_voters.html";
      window.location.href = window.ElecomAdminSecureUrlAsync
        ? await window.ElecomAdminSecureUrlAsync(votersUrl)
        : (window.ElecomAdminSecureUrl ? window.ElecomAdminSecureUrl(votersUrl) : votersUrl);
    } catch (err) {
      showVotersAccessError("Could not verify password. Please try again.");
    } finally {
      setVotersAccessLoading(false);
    }
  };

  if (totalVotersCard) {
    const openVoters = () => {
      showVotersAccessError("");
      if (votersAccessPassword) votersAccessPassword.value = "";
      if (votersAccessModal) {
        votersAccessModal.show();
        setTimeout(() => votersAccessPassword && votersAccessPassword.focus(), 250);
      }
    };
    totalVotersCard.addEventListener("click", openVoters);
    totalVotersCard.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openVoters();
      }
    });
  }

  if (votersAccessConfirmBtn) {
    votersAccessConfirmBtn.addEventListener("click", verifyVotersAccess);
  }

  if (votersAccessPassword) {
    votersAccessPassword.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        verifyVotersAccess();
      }
    });
  }

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
      if (electionHelperText) electionHelperText.textContent = "Create or update the election schedule in Election Management.";
      if (electionNoteText) electionNoteText.textContent = "No schedule set. Go to Election Management to configure.";
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
    return `${datePart} / ${timePart}`;
  };

  const dateOnlyKey = (d) => {
    if (!d || !Number.isFinite(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getElectionResultIso = (election) => {
    const iso = election && (election.result_at || election.result_date || election.results_at);
    if (iso) {
      const d = new Date(iso);
      if (Number.isFinite(d.getTime())) return iso;
    }

    const endIso = election && election.end_at;
    if (!endIso) return "";
    const end = new Date(endIso);
    if (!Number.isFinite(end.getTime())) return "";

    const r = new Date(end);
    r.setDate(r.getDate() + 1);
    return r.toISOString();
  };

  const legendDot = (color) => {
    const c = String(color || "").trim().toLowerCase();
    const border = c === "#ffffff" ? "border:2px solid #000000;" : "box-shadow:0 0 0 1px rgba(0,0,0,0.28);";
    return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};${border}flex:0 0 auto;"></span>`;
  };

  const renderElectionLegend = () => {
    if (!electionLegend) return;
    const WHITE = "#ffffff";
    const BLUE = "#1D4ED8";
    const YELLOW = "#FACC15";
    const RED = "#DC2626";
    const GRAY = "#E0E0E0";
    const PIE2 = `conic-gradient(${BLUE} 0deg 180deg, ${YELLOW} 180deg 360deg)`;
    const PIE2_END_RESULT = `conic-gradient(${YELLOW} 0deg 180deg, ${RED} 180deg 360deg)`;
    const PIE3 = `conic-gradient(${BLUE} 0deg 120deg, ${YELLOW} 120deg 240deg, ${RED} 240deg 360deg)`;

    electionLegend.innerHTML = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:11px;line-height:1.1;">
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px 12px;align-items:center;width:100%;">
    <div style="display:inline-flex;align-items:center;gap:6px;min-width:0;">${legendDot(WHITE)}<span style="white-space:nowrap;">Today</span></div>
    <div style="display:inline-flex;align-items:center;gap:6px;min-width:0;">${legendDot(BLUE)}<span style="white-space:nowrap;">Election</span></div>
    <div style="display:inline-flex;align-items:center;gap:6px;min-width:0;">${legendDot(YELLOW)}<span style="white-space:nowrap;">End</span></div>
    <div style="display:inline-flex;align-items:center;gap:6px;min-width:0;">${legendDot(RED)}<span style="white-space:nowrap;">Result</span></div>

    <div style="display:inline-flex;align-items:center;gap:6px;min-width:0;">${legendDot(GRAY)}<span style="white-space:nowrap;">Normal</span></div>
    <div style="display:inline-flex;align-items:center;gap:6px;min-width:0;">${legendDot(PIE2)}<span style="white-space:nowrap;">Same E+End</span></div>
    <div style="display:inline-flex;align-items:center;gap:6px;min-width:0;">${legendDot(PIE2_END_RESULT)}<span style="white-space:nowrap;">Same End+R</span></div>
    <div style="display:inline-flex;align-items:center;gap:6px;min-width:0;">${legendDot(PIE3)}<span style="white-space:nowrap;">Same E+End+R</span></div>
  </div>
</div>`;
    electionLegend.style.display = "block";
  };

  const renderElectionCalendar = (startIso, endIso, resultIso) => {
    if (!electionCalendar) return;
    const start = startIso ? new Date(startIso) : null;
    const end = endIso ? new Date(endIso) : null;
    if (!start || !end || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      electionCalendar.style.display = "none";
      electionCalendar.innerHTML = "";
      return;
    }

    const WHITE = "#ffffff";
    const BLUE = "#1D4ED8";
    const YELLOW = "#FACC15";
    const RED = "#DC2626";
    const GRAY = "#E0E0E0";

    const result = resultIso ? new Date(resultIso) : null;
    const resultKey = result && Number.isFinite(result.getTime()) ? dateOnlyKey(result) : "";

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
        const isResult = !!(resultKey && k === resultKey);
        const isTripleSame = isStart && isEnd && isResult;
        const isEndResultSame = !isTripleSame && isEnd && isResult;

        let bg = GRAY;
        let fg = "#111";
        let extra = "";
        if (isToday) {
          bg = WHITE;
          fg = "#111";
        }
        if (isTripleSame) {
          bg = `conic-gradient(${BLUE} 0deg 120deg, ${YELLOW} 120deg 240deg, ${RED} 240deg 360deg)`;
          fg = "#fff";
          extra = "text-shadow:0 1px 1px rgba(0,0,0,0.35);";
        } else if (isEndResultSame) {
          bg = `conic-gradient(${YELLOW} 0deg 180deg, ${RED} 180deg 360deg)`;
          fg = "#fff";
          extra = "text-shadow:0 1px 1px rgba(0,0,0,0.35);";
        } else if (isStart && isEnd) {
          bg = `conic-gradient(${BLUE} 0deg 180deg, ${YELLOW} 180deg 360deg)`;
          fg = "#fff";
          extra = "text-shadow:0 1px 1px rgba(0,0,0,0.35);";
        } else {
          if (isStart) {
            bg = BLUE;
            fg = "#fff";
          }
          if (isEnd) {
            bg = YELLOW;
            fg = "#111";
          }
        }

        if (isResult && !isTripleSame && !isEndResultSame) {
          bg = RED;
          fg = "#fff";
        }

        const outline = isToday ? "box-shadow:0 0 0 2px #000000;" : "";
        const style = `background:${bg};color:${fg};border-radius:999px;width:30px;height:30px;line-height:30px;display:inline-block;${outline}${extra}`;
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

    renderElectionLegend();
    renderElectionCalendar(
      election.start_at,
      election.end_at,
      getElectionResultIso(election)
    );
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

  const turnoutDate = (iso, includeDate = true) => {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila", ...(includeDate ? { month: "short", day: "numeric" } : {}),
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(date);
  };

  let turnoutChartInstance = null;
  const renderTurnout = (turnout, metrics) => {
    const total = Number(metrics.total_voters) || 0;
    const cast = Number(metrics.total_cast_votes) || 0;
    const percent = total ? Math.min(100, Math.max(0, cast / total * 100)) : 0;
    setText(document.getElementById("turnoutPercent"), `${percent.toFixed(1)}%`);
    setText(document.getElementById("turnoutSummary"), `${fmt(cast)} ballots cast / ${fmt(total)} registered voters`);
    const progress = document.getElementById("turnoutProgress");
    progress?.setAttribute("aria-valuenow", percent.toFixed(1));
    const fill = document.getElementById("turnoutProgressFill");
    if (fill) fill.style.width = `${percent}%`;

    const canvas = document.getElementById("turnoutCanvas");
    const message = document.getElementById("turnoutChartEmpty");
    const table = document.getElementById("turnoutTableBody");
    if (!canvas || !message || !table) return;
    table.replaceChildren();
    const hourly = Array.isArray(turnout?.hourly) ? turnout.hourly.slice(-24) : [];
    // Keep withheld buckets as null: never connect or fill across privacy gaps.
    const values = hourly.map((item) => {
      if (item.withheld || item.count === null) return null;
      const count = Number(item.count);
      return Number.isInteger(count) && (count === 0 || count >= 5) ? count : null;
    });
    hourly.forEach((item, i) => {
      const row = document.createElement("tr");
      const hour = document.createElement("th");
      hour.scope = "row"; hour.textContent = turnoutDate(item.hour);
      const count = document.createElement("td");
      count.textContent = values[i] === null ? "Withheld" : fmt(values[i]);
      row.append(hour, count); table.append(row);
    });
    if (!hourly.length || typeof window.Chart !== "function") {
      turnoutChartInstance?.destroy();
      turnoutChartInstance = null;
      canvas.hidden = true;
      message.hidden = false;
      message.textContent = hourly.length
        ? "Chart unavailable. Open View hourly totals to see the data."
        : "Hourly turnout is temporarily unavailable.";
      return;
    }
    canvas.hidden = false;
    const hasPublishedVotes = values.some((value) => value !== null && value > 0);
    message.hidden = hasPublishedVotes;
    message.textContent = "Published hourly turnout will appear here as voting progresses.";
    const labels = hourly.map((item) => turnoutDate(item.hour, false));
    if (turnoutChartInstance) {
      turnoutChartInstance.data.labels = labels;
      turnoutChartInstance.data.datasets[0].data = values;
      turnoutChartInstance.update("none");
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    turnoutChartInstance = new window.Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Votes cast", data: values,
          borderColor: "#0d1b3e", borderWidth: 2.5,
          tension: 0.4, fill: "origin", spanGaps: false,
          backgroundColor: ({ chart }) => {
            const area = chart.chartArea;
            if (!area) return "rgba(13, 27, 62, 0.05)";
            const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
            gradient.addColorStop(0, "rgba(13, 27, 62, 0.20)");
            gradient.addColorStop(1, "rgba(13, 27, 62, 0)");
            return gradient;
          },
          pointRadius: (context) => context.raw > 0 ? 2.5 : 0,
          pointBackgroundColor: "#fff", pointBorderColor: "#0d1b3e", pointBorderWidth: 2,
          pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHitRadius: 14,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, resizeDelay: 50,
        animation: reducedMotion ? false : { duration: 300 },
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 12, right: 10, bottom: 4 } },
        font: { family: "Inter, system-ui, sans-serif", size: 11 },
        onResize: (chart, size) => {
          chart.options.scales.x.ticks.maxTicksLimit = size.width < 300 ? 2 : size.width < 500 ? 4 : 6;
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0d1b3e", titleColor: "#fff", bodyColor: "#fff",
            padding: 12, cornerRadius: 10, displayColors: false, caretPadding: 8,
            titleFont: { family: "Inter, system-ui, sans-serif", size: 11, weight: "600" },
            bodyFont: { family: "Inter, system-ui, sans-serif", size: 12 },
            filter: (item) => item.raw !== null,
            callbacks: {
              title: (items) => items.length ? items[0].label + " / Completed hour" : "",
              label: (item) => `${item.label}: ${fmt(item.parsed.y)} votes cast`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false }, border: { display: false },
            ticks: { color: "#4a5568", font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
          },
          y: {
            beginAtZero: true, min: 0, suggestedMax: 8,
            grid: { color: "#e9edf4", drawTicks: false }, border: { display: false },
            ticks: { color: "#4a5568", font: { size: 10 }, padding: 8, precision: 0, maxTicksLimit: 5 },
          },
        },
      },
    });
  };

  let dashboardLoading = false;
  const loadDashboard = async () => {
    if (dashboardLoading || document.hidden) return;
    dashboardLoading = true;
    try {
      const res = await fetch("/api/admin/dashboard/", {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("Dashboard unavailable");

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
      renderTurnout(data.turnout, m);
      const status = document.getElementById("turnoutChartStatus");
      if (status) status.hidden = true;
    } catch (e) {
      const status = document.getElementById("turnoutChartStatus");
      if (status) {
        status.textContent = "Refresh unavailable. Previously loaded totals may be out of date.";
        status.hidden = false;
      }
    } finally {
      dashboardLoading = false;
    }
  };

  // Read header geometry without changing its layout or controls.
  const topNav = document.querySelector(".top-navbar");
  const syncHeaderHeight = () => {
    if (topNav) document.body.style.setProperty("--dashboard-header-height", `${topNav.getBoundingClientRect().height}px`);
  };
  syncHeaderHeight();
  if (typeof ResizeObserver !== "undefined" && topNav) {
    new ResizeObserver(syncHeaderHeight).observe(topNav);
  }

  void loadDashboard();
  setInterval(loadDashboard, 15000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void loadDashboard(); });

  const input = document.getElementById("candidateSearch");
  const btn = document.getElementById("candidateSearchBtn");
  const results = document.getElementById("searchResults");
  let debounceTimer = null;

  let redirectedToSearch = false;

  function goToSearchPage() {
    if (redirectedToSearch) return;
    redirectedToSearch = true;
    const q = input ? input.value.trim() : "";
    const url = new URL(
      "/static/org_elecom/elecom_admin/search_results.html",
      window.location.origin
    );
    url.searchParams.set("focus", "1");
    if (q) url.searchParams.set("q", q);
    window.location.href = window.ElecomAdminSecureUrl ? window.ElecomAdminSecureUrl(url.toString()) : url.toString();
  }

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
        return `\n<a href="#" class="list-group-item list-group-item-action" data-id="${item.id}">\n  <div class="d-flex align-items-center gap-2">\n    <img src="${photo}" alt="" class="rounded-circle border" style="width:40px;height:40px;object-fit:cover;">\n    <div class="flex-grow-1">\n      <div class="d-flex w-100 justify-content-between">\n        <strong>${name}</strong>\n        <small>${item.student_id || ""}</small>\n      </div>\n      <div class="small text-muted">${item.position || ""}${item.organization ? " â€¢ " + item.organization : ""}</div>\n    </div>\n  </div>\n</a>`;
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

    try {
      const url = new URL("/api/admin/candidates/list/", window.location.origin);
      url.searchParams.set("q", q);
      const res = await fetch(url.toString(), { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      const rows = data && data.ok ? data.candidates || [] : [];
      showResults(rows.slice(0, 8));
    } catch (e) {
      hideResults();
    }
  }

  if (input) {
    input.addEventListener("focus", () => {
      goToSearchPage();
    });
    input.addEventListener("click", () => {
      goToSearchPage();
    });
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, 250);
    });
  }

  if (btn) {
    btn.addEventListener("click", () => {
      goToSearchPage();
    });
  }

  document.addEventListener("click", (e) => {
    if (!results || !input) return;
    if (!results.contains(e.target) && e.target !== input) {
      hideResults();
    }
  });

  if (results) {
    results.addEventListener("click", async (e) => {
      const link = e.target.closest("a[data-id]");
      if (!link) return;
      e.preventDefault();
      hideResults();
      const id = link.getAttribute("data-id");
      if (!id) return;

      try {
        const res = await fetch(
          `/api/admin/candidates/detail/?id=${encodeURIComponent(id)}`,
          { credentials: "same-origin" }
        );
        const d = await res.json().catch(() => ({}));
        if (!d || !d.ok || !d.candidate) return;

        const c = d.candidate;
        const name = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ");

        const cdName = document.getElementById("cd_name");
        const cdStudentId = document.getElementById("cd_student_id");
        const cdPosition = document.getElementById("cd_position");
        const cdOrg = document.getElementById("cd_org");
        const cdProgram = document.getElementById("cd_program");
        const cdYear = document.getElementById("cd_year");
        const cdPlatform = document.getElementById("cd_platform");
        const cdPhoto = document.getElementById("cd_photo");

        if (cdName) cdName.value = name || "";
        if (cdStudentId) cdStudentId.value = c.student_id || "";
        if (cdPosition) cdPosition.value = c.position || "";
        if (cdOrg) cdOrg.value = c.organization || "";
        if (cdProgram) cdProgram.value = c.program || "";
        if (cdYear) cdYear.value = c.year_section || "";
        if (cdPlatform) cdPlatform.textContent = c.platform || "";

        if (cdPhoto) {
          if (c.photo_url && String(c.photo_url).startsWith("http")) {
            cdPhoto.src = c.photo_url;
            cdPhoto.style.display = "block";
          } else {
            cdPhoto.style.display = "none";
          }
        }

        const modalEl = document.getElementById("candidateModal");
        if (modalEl && window.bootstrap && window.bootstrap.Modal) {
          window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
      } catch (e2) {
        // ignore
      }
    });
  }

  // keep unused function so you can easily re-enable later
  void showResults;
});

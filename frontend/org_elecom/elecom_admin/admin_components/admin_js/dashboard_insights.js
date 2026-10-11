/* Chart.js configuration and real dashboard activity rendering. */
(() => {
  let chart = null;
  const clock = (iso) => new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
  const timestamp = (iso) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const relative = (iso) => {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };
  const render = (data) => {
    const canvas = document.getElementById("turnoutLineChart");
    const caption = document.getElementById("turnoutLineCaption");
    const turnout = data.turnout;
    const start = Date.parse(data.election?.start_at);
    const end = Date.parse(data.election?.end_at);
    const hourly = (turnout?.hourly || []).filter((item) => {
      const hour = Date.parse(item.hour);
      return (!Number.isFinite(start) || hour + 3600000 > start) && (!Number.isFinite(end) || hour < end);
    });
    const labels = hourly.map((item) => clock(item.hour));
    if (canvas && window.Chart) {
      if (!chart) chart = new Chart(canvas, {
        type: "line",
        data: { labels: [], datasets: [{ label: "Votes cast per hour", data: [], borderColor: "#2563eb", borderWidth: 3, backgroundColor: "#2563eb", fill: false, cubicInterpolationMode: "monotone", tension: 0.35, pointRadius: 2, pointHoverRadius: 5, pointHitRadius: 12, spanGaps: false }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 350 },
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0d1b3e", padding: 12, callbacks: {
            title: (items) => timestamp(chart.$hourly[items[0].dataIndex].hour),
            label: (item) => `${item.parsed.y.toLocaleString()} votes cast in this hour`,
          } } },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 8, color: "#64748b", font: { size: 10 } }, title: { display: true, text: "Election hours ? Philippine time", color: "#64748b" } },
            y: { beginAtZero: true, suggestedMax: 10, grid: { color: "#eef2f6" }, ticks: { precision: 0, color: "#64748b", font: { size: 10 } }, title: { display: true, text: "Votes cast per hour", color: "#64748b" } },
          },
        },
      });
      chart.$hourly = hourly;
      chart.data.labels = labels;
      chart.data.datasets[0].data = hourly.map((item) => item.count);
      chart.update("none");
    }
    if (caption) caption.textContent = !turnout ? "Hourly turnout is unavailable." : !hourly.length ? "No completed election hours in the latest 24-hour window." : `Completed hourly intervals through ${timestamp(turnout.through)}. Small counts are withheld; gaps are not zero votes.`;
    if (canvas && !window.Chart && caption) caption.textContent = "Chart could not load. Hourly totals are available below.";
    const tableWrap = document.getElementById("turnoutDataTable");
    if (tableWrap) {
      tableWrap.replaceChildren();
      const table = document.createElement("table");
      const head = table.createTHead().insertRow();
      for (const label of ["Hour (PH time)", "Votes cast"]) { const th = document.createElement("th"); th.scope = "col"; th.textContent = label; head.appendChild(th); }
      const body = table.createTBody();
      hourly.forEach((item) => { const row = body.insertRow(); row.insertCell().textContent = timestamp(item.hour); row.insertCell().textContent = item.withheld ? "Withheld" : String(item.count); });
      tableWrap.appendChild(table);
    }
    const list = document.getElementById("activityFeedList");
    const state = document.getElementById("activityFeedState");
    if (!list) return;
    const events = data.activity?.events || [];
    const signature = JSON.stringify(events);
    if (list.dataset.signature !== signature) {
      list.dataset.signature = signature;
      const position = list.scrollTop;
      list.replaceChildren();
      events.forEach((event) => {
        const li = document.createElement("li");
        const icon = document.createElement("span");
        const kind = ["vote", "biometric", "network"].includes(event.kind) ? event.kind : "vote";
        icon.className = `activity-status-icon ${kind}`;
        icon.setAttribute("aria-hidden", "true");
        const glyph = document.createElement("i"); glyph.className = `bi ${kind === "biometric" ? "bi-person-check" : kind === "network" ? "bi-wifi" : "bi-check2-circle"}`; icon.appendChild(glyph);
        const body = document.createElement("div");
        const title = document.createElement("strong"); title.textContent = event.title;
        const detail = document.createElement("span"); detail.textContent = event.detail;
        const time = document.createElement("small"); time.dataset.timestamp = event.timestamp; time.title = timestamp(event.timestamp); time.textContent = relative(event.timestamp);
        body.append(title, detail, time); li.append(icon, body); list.appendChild(li);
      });
      if (!events.length) { const li = document.createElement("li"); li.textContent = "No recorded activity yet."; list.appendChild(li); }
      list.scrollTop = position;
    }
    list.querySelectorAll("[data-timestamp]").forEach((el) => { el.textContent = relative(el.dataset.timestamp); });
    if (state) state.textContent = data.activity?.complete ? "Live ? 5s" : "Partial data";
  };
  window.addEventListener("elecom:dashboard", (event) => render(event.detail));
  window.addEventListener("elecom:dashboard-error", () => {
    const state = document.getElementById("activityFeedState"); if (state) state.textContent = "Refresh unavailable";
  });
})();

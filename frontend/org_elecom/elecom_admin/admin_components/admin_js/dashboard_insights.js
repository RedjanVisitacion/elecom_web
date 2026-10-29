/* Chart.js configuration and real dashboard activity rendering. */
(() => {
  let chart = null;
  const clock = (iso) => new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
  const timestamp = (iso) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
    const historical = turnout?.scope === "historical";
    const labels = hourly.map((item) => historical ? timestamp(item.hour) : clock(item.hour));
    if (canvas && window.Chart) {
      if (!chart) chart = new Chart(canvas, {
        type: "line",
        data: { labels: [], datasets: [{ label: "Votes cast per hour", data: [], borderColor: "#0A2463", borderWidth: 2, backgroundColor: (context) => {
          const area = context.chart.chartArea;
          if (!area) return "rgba(10,36,99,0)";
          const fade = context.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
          fade.addColorStop(0, "rgba(10,36,99,0.08)");
          fade.addColorStop(1, "rgba(10,36,99,0)");
          return fade;
        }, fill: true, cubicInterpolationMode: "monotone", tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 12, spanGaps: false }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 350 },
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0F172A", cornerRadius: 4, titleFont: { family: "JetBrains Mono" }, bodyFont: { family: "JetBrains Mono" }, padding: 8, callbacks: {
            title: (items) => timestamp(chart.$hourly[items[0].dataIndex].hour),
            label: (item) => `${item.parsed.y.toLocaleString()} votes cast in this hour`,
          } } },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 5, minRotation: 0, maxRotation: 0, color: "#64748b", font: { family: "JetBrains Mono", size: 10 } }, title: { display: true, text: "Election hours - Philippine time", color: "#64748b", font: { family: "JetBrains Mono", size: 10 } } },
            y: { beginAtZero: true, min: 0, suggestedMax: 100, grid: { display: false }, ticks: { precision: 0, color: "#64748b", font: { family: "JetBrains Mono", size: 10 } }, title: { display: true, text: "Votes cast per hour", color: "#64748b", font: { family: "JetBrains Mono", size: 10 } } },
          },
        },
      });
      chart.$hourly = hourly;
      chart.data.labels = labels;
      chart.data.datasets[0].data = hourly.map((item) => item.count);
      chart.update("none");
    }
    if (caption) caption.textContent = !turnout ? "Hourly turnout is unavailable." : historical ? "Showing historical data for completed election. Small counts are withheld; gaps are not zero votes." : !hourly.length ? "No completed election hours in the latest 24-hour window." : `Completed hourly intervals through ${timestamp(turnout.through)}. Small counts are withheld; gaps are not zero votes.`;
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
  };
  window.addEventListener("elecom:dashboard", (event) => render(event.detail));
})();

(function () {
  "use strict";
  const REPO = "https://github.com/yobslob/Quantum-Swarm/blob/main/";
  const ORDER = ["PSO", "DE", "GWO", "QPSO", "QS (ungated)", "Quantum Swarm"];
  const COLORS = { "Quantum Swarm": "#1f6fd1", "QPSO": "#e8692c", "GWO": "#14a37f",
                   "DE": "#c9970c", "PSO": "#c75b9b", "QS (ungated)": "#7d7d86" };
  const $ = s => document.querySelector(s);

  function fmt(v) {
    if (v === null || v === undefined || Number.isNaN(v)) return "–";
    if (v === 0) return "0";
    const a = Math.abs(v);
    if (a < 1e-3 || a >= 1e5) return v.toExponential(2).replace("e+", "e");
    if (a >= 100) return v.toFixed(1);
    return Number(v.toPrecision(4)).toString();
  }

  Chart.defaults.font.family = '"Source Sans 3", system-ui, sans-serif';
  Chart.defaults.font.size = 13;
  Chart.defaults.color = "#5c5c66";
  const GRID = { color: "#ececf0", drawTicks: false };
  const logY = {
    type: "logarithmic", grid: GRID, border: { display: false },
    ticks: { padding: 6, callback: v => { const e = Math.log10(v); return Math.abs(e - Math.round(e)) < 1e-9 ? "1e" + Math.round(e) : ""; } },
  };
  const tooltip = { backgroundColor: "#fff", titleColor: "#1d1d1f", bodyColor: "#1d1d1f", borderColor: "#d8d8de", borderWidth: 1, padding: 10 };

  // ---------------- results ----------------
  let R = null, conv = null;

  function findings() {
    const d30 = R.settings.classical_d30, sh = R.settings.shifted_d30, n = d30.functions.length;
    const shRank = Object.entries(sh.ranks).sort((a, b) => a[1] - b[1]).map(r => r[0]);
    const clRank = Object.entries(d30.ranks).sort((a, b) => a[1] - b[1]).map(r => r[0]);
    const q = d30.wtl.QPSO;
    const items = [
      `Better than PSO on <b>${d30.wtl.PSO[0]} of ${n}</b> functions and DE on <b>${d30.wtl.DE[0]} of ${n}</b> (D = 30). Against standard QPSO: ${q[0]} wins, ${q[1]} ties, ${q[2]} losses.`,
      `With the optimum moved away from the centre (shifted functions), Quantum Swarm ranked <b>#${shRank.indexOf("Quantum Swarm") + 1} of 6</b>. GWO went from #${clRank.indexOf("GWO") + 1} to #${shRank.indexOf("GWO") + 1}.`,
      `Without the stagnation gate the algorithm was worse on <b>${d30.wtl["QS (ungated)"][0]} of ${n}</b> functions, so the gate is needed.`,
    ];
    $("#findings").innerHTML = items.map(t => `<li>${t}</li>`).join("");
  }

  function fillFunctions() {
    const S = R.settings[$("#setting").value], cur = $("#func").value;
    $("#func").innerHTML = S.functions.map(f => `<option${f === cur ? " selected" : ""}>${f}</option>`).join("");
    if (!S.functions.includes(cur)) $("#func").value = S.functions.includes("Rastrigin") ? "Rastrigin" : S.functions[0];
  }

  function drawChart() {
    const S = R.settings[$("#setting").value], f = $("#func").value, block = S.data[f];
    const step = R.meta.curve_step, xs = block["Quantum Swarm"].curve.map((_, i) => i * step);
    const pos = ORDER.flatMap(a => block[a].curve).filter(v => v > 0), floor = Math.min(...pos) / 10;
    $("#conv-label").textContent = `Convergence on ${S.shifted ? "shifted " : ""}${f}, D = ${S.dim} (median of 30 runs)`;
    if (conv) conv.destroy();
    conv = new Chart($("#c-conv"), {
      type: "line",
      data: { labels: xs, datasets: ORDER.map(a => ({
        label: a === "QS (ungated)" ? "QS (no gate)" : a, key: a, data: block[a].curve.map(v => v > 0 ? v : floor),
        borderColor: COLORS[a], backgroundColor: COLORS[a],
        borderWidth: a === "Quantum Swarm" ? 3 : 1.6, pointRadius: 0, order: a === "Quantum Swarm" ? 0 : 1,
      })) },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", align: "start", labels: { boxWidth: 14, boxHeight: 3, padding: 14 } },
          tooltip: Object.assign({}, tooltip, { callbacks: {
            title: c => "Iteration " + c[0].label,
            label: c => ` ${c.dataset.label}: ${fmt(block[c.dataset.key].curve[c.dataIndex])}` } }),
        },
        scales: {
          x: { type: "linear", max: R.meta.T, grid: GRID, border: { display: false }, title: { display: true, text: "Iteration" } },
          y: Object.assign({}, logY, { title: { display: true, text: "Best value (log scale)" } }),
        },
      },
    });
  }

  function drawTable() {
    const S = R.settings[$("#setting").value];
    const name = a => a === "QS (ungated)" ? "QS (no gate)" : a;
    const head = `<tr><th>Function</th>${ORDER.map(a => `<th class="${a === "Quantum Swarm" ? "qs" : ""}">${name(a)}</th>`).join("")}</tr>`;
    const body = S.functions.map(f => {
      const b = S.data[f], best = Math.min(...ORDER.map(a => b[a].mean));
      return `<tr><td>${f}</td>` + ORDER.map(a => {
        const s = b[a], sg = s.sign ? `<span class="sg">${s.sign === "-" ? "−" : s.sign}</span>` : "";
        return `<td class="${s.mean === best ? "best" : ""}${a === "Quantum Swarm" ? " qs" : ""}">${fmt(s.mean)}${sg}</td>`;
      }).join("") + "</tr>";
    }).join("");
    const rank = `<tr class="rank"><td>Average rank</td>${ORDER.map(a => `<td class="${a === "Quantum Swarm" ? "qs" : ""}">${S.ranks[a].toFixed(2)}</td>`).join("")}</tr>`;
    $("#t-results").innerHTML = `<thead>${head}</thead><tbody>${body}${rank}</tbody>`;
  }

  function files() {
    const F = [
      ["quantum_swarm/quantum_swarm.py", "Quantum Swarm and standard QPSO"],
      ["quantum_swarm/baselines.py", "PSO, Differential Evolution, Grey Wolf Optimizer"],
      ["quantum_swarm/benchmarks.py", "The six test functions and their shifted versions"],
      ["quantum_swarm/stats.py", "Wilcoxon and Friedman tests"],
      ["experiments/run_experiments.py", "Runs all experiments and saves the results"],
      ["experiments/make_figures.py", "Draws the figures"],
      ["demo.py", "Single demonstration run"],
    ];
    $("#files").innerHTML = F.map(([p, d]) => `<li><a href="${REPO}${p}">${p}</a><span>${d}</span></li>`).join("");
  }

  // ---------------- demo ----------------
  const D = window.QSDemo;
  let S = null, demoChart = null, running = false, acc = 0, last = 0;
  const SPEED = 20; // iterations per second

  function demoReset() {
    S = D.init($("#d-func").value, $("#d-alg").value, 7);
    demoUpdate();
  }
  function demoUpdate() {
    D.draw($("#field"), S);
    $("#r-it").textContent = `${S.t} / ${D.P.T}`;
    $("#r-best").textContent = fmt(S.gf);
    $("#r-sdi").textContent = S.sdi.toFixed(4);
    $("#r-alpha").textContent = Number.isNaN(S.alpha) ? (S.alg === "PSO" ? "not used" : "–") : S.alpha.toFixed(3);
    if (demoChart) { demoChart.data.datasets[0].data = S.hist.map(v => Math.max(v, 1e-12)); demoChart.update("none"); }
  }
  function setRunning(on) {
    running = on;
    $("#d-run").textContent = on ? "Pause" : (S.t >= D.P.T ? "Run again" : "Run");
    if (on) { last = performance.now(); acc = 0; requestAnimationFrame(loop); }
  }
  function loop(now) {
    if (!running) return;
    acc += (now - last) / 1000 * SPEED; last = now;
    let moved = false;
    while (acc >= 1) { acc -= 1; if (!D.step(S)) { setRunning(false); break; } moved = true; }
    if (moved) demoUpdate();
    if (running) requestAnimationFrame(loop);
  }
  function demoInit() {
    demoChart = new Chart($("#c-demo"), {
      type: "line",
      data: { labels: Array.from({ length: D.P.T + 1 }, (_, i) => i),
              datasets: [{ data: [], borderColor: COLORS["Quantum Swarm"], borderWidth: 2, pointRadius: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { type: "linear", min: 0, max: D.P.T, grid: GRID, border: { display: false }, ticks: { maxTicksLimit: 5 } },
                  y: Object.assign({}, logY, { ticks: Object.assign({}, logY.ticks, { maxTicksLimit: 4 }) }) } },
    });
    $("#d-run").onclick = () => {
      if (running) return setRunning(false);
      if (S.t >= D.P.T) demoReset();
      setRunning(true);
    };
    $("#d-reset").onclick = () => { setRunning(false); demoReset(); setRunning(false); };
    $("#d-func").onchange = $("#d-alg").onchange = () => { setRunning(false); demoReset(); setRunning(false); };
    demoReset();
  }

  document.addEventListener("DOMContentLoaded", () => {
    files();
    demoInit();
    fetch("data/results.json").then(r => r.json()).then(data => {
      R = data;
      findings();
      fillFunctions();
      drawChart();
      drawTable();
      $("#setting").onchange = () => { fillFunctions(); drawChart(); drawTable(); };
      $("#func").onchange = drawChart;
    });
  });
})();

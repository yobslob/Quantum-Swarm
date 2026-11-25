/* Dashboard: reads data/results.json (written by experiments/run_experiments.py) and draws
 * the results, plus drives the live demo from demo.js. */
(function () {
  "use strict";
  const REPO = "https://github.com/yobslob/Quantum-Swarm/blob/main/";
  const ORDER = ["PSO", "DE", "GWO", "QPSO", "QS (ungated)", "Quantum Swarm"];
  const SLOT = { "Quantum Swarm": "--s1", "QPSO": "--s2", "GWO": "--s3", "DE": "--s4", "PSO": "--s5", "QS (ungated)": "--s6",
                 "Without stagnation handling": "--s3", "Without diversity boost": "--s4" };
  const SETTING_LABEL = { classical_d30: "classical functions, D = 30", classical_d10: "classical functions, D = 10",
                          shifted_d30: "shifted functions, D = 30" };
  const $ = s => document.querySelector(s);
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const color = a => css(SLOT[a] || "--text-3");

  function fmt(v) {
    if (v === null || v === undefined || Number.isNaN(v)) return "–";
    if (v === 0) return "0";
    const a = Math.abs(v);
    if (a < 1e-3 || a >= 1e5) return v.toExponential(2).replace("e", "E").replace("E+", "E");
    if (a >= 100) return v.toFixed(1);
    return Number(v.toPrecision(4)).toString();
  }
  const charts = {};
  function chart(id, cfg) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), cfg);
    return charts[id];
  }
  function baseOpts(extra) {
    const grid = css("--grid"), text = css("--text-2");
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = text;
    return Object.assign({
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { boxWidth: 12, boxHeight: 3, padding: 12 } },
        tooltip: { backgroundColor: css("--surface"), titleColor: css("--text"), bodyColor: css("--text"),
                   borderColor: css("--border"), borderWidth: 1, padding: 10, boxPadding: 4,
                   callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.raw && c.raw.y !== undefined ? c.raw.orig ?? c.raw.y : c.raw)}` } },
      },
      scales: {
        x: { grid: { color: grid, drawTicks: false }, border: { display: false }, ticks: { padding: 6 } },
        y: { grid: { color: grid, drawTicks: false }, border: { display: false }, ticks: { padding: 6 } },
      },
    }, extra || {});
  }
  const logAxis = (title) => ({
    type: "logarithmic", title: { display: !!title, text: title },
    grid: { color: css("--grid"), drawTicks: false }, border: { display: false },
    ticks: { padding: 6, maxTicksLimit: 7, callback: v => { const e = Math.log10(v); return Math.abs(e - Math.round(e)) < 1e-9 ? "1E" + Math.round(e) : ""; } },
  });

  let R = null, setting = "classical_d30", func = null;

  // ================= hero tiles =================
  function tiles() {
    const d30 = R.settings.classical_d30, sh = R.settings.shifted_d30;
    const rk = Object.entries(sh.ranks).sort((a, b) => a[1] - b[1]);
    const pos = rk.findIndex(r => r[0] === "Quantum Swarm") + 1;
    const q = d30.wtl.QPSO, n = d30.functions.length;
    const items = [
      [R.meta.total_runs.toLocaleString(), "independent runs (6 algorithms, 11 functions, 30 runs each + ablation and sensitivity)"],
      [`#${pos} of ${rk.length}`, `Friedman rank on shifted functions (avg. rank ${sh.ranks["Quantum Swarm"].toFixed(2)})`],
      [`${d30.wtl.PSO[0]}/${n} · ${d30.wtl.DE[0]}/${n}`, "functions where it is significantly better than PSO · DE (D = 30)"],
      [`${q[0]} / ${q[1]} / ${q[2]}`, "wins / ties / losses against standard QPSO (D = 30)"],
    ];
    $("#tiles").innerHTML = items.map(([v, l]) => `<div class="tile"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
  }

  // ================= results =================
  function floorOf(values) {
    const pos = values.filter(v => v > 0);
    return pos.length ? Math.min(...pos) / 10 : 1e-300;
  }
  function renderResults() {
    const S = R.settings[setting];
    if (!S.functions.includes(func)) func = S.functions[0];
    $("#func-chips").innerHTML = S.functions.map(f => `<button class="${f === func ? "on" : ""}" data-f="${f}">${f}</button>`).join("");
    const block = S.data[func];
    const label = (S.shifted ? "Shifted " : "") + func + ", D = " + S.dim;

    // convergence
    const step = R.meta.curve_step, xs = block["Quantum Swarm"].curve.map((_, i) => i * step);
    const allC = ORDER.flatMap(a => block[a].curve), fl = floorOf(allC);
    $("#conv-title").textContent = "Convergence · " + label;
    chart("c-conv", {
      type: "line",
      data: { labels: xs, datasets: ORDER.map(a => ({
        label: a, data: block[a].curve.map(v => v > 0 ? v : fl), borderColor: color(a), backgroundColor: color(a),
        borderWidth: a === "Quantum Swarm" ? 3 : 2, pointRadius: 0, pointHoverRadius: 4, tension: 0,
        order: a === "Quantum Swarm" ? 0 : 1 })) },
      options: baseOpts({
        scales: { x: { type: "linear", title: { display: true, text: "iteration" }, grid: { color: css("--grid"), drawTicks: false }, border: { display: false }, max: R.meta.T },
                  y: logAxis("best fitness") },
        plugins: Object.assign(baseOpts().plugins, { tooltip: Object.assign(baseOpts().plugins.tooltip, {
          callbacks: { title: c => "iteration " + c[0].label, label: c => ` ${c.dataset.label}: ${fmt(block[c.dataset.label].curve[c.dataIndex])}` } }) }),
      }),
    });

    // strip plot of final values
    const allF = ORDER.flatMap(a => block[a].finals), ff = floorOf(allF);
    $("#strip-title").textContent = "Final fitness · " + label;
    const jitter = i => ((i * 7919) % 31) / 31 * 0.5 - 0.25;
    const ds = ORDER.map((a, k) => ({
      label: a, data: block[a].finals.map((v, i) => ({ x: k + jitter(i), y: v > 0 ? v : ff, orig: v })),
      backgroundColor: color(a) + "cc", borderColor: css("--surface"), borderWidth: 1, pointRadius: 4.5, pointHoverRadius: 6,
    }));
    ds.push({ label: "median", data: ORDER.map((a, k) => ({ x: k, y: block[a].median > 0 ? block[a].median : ff, orig: block[a].median })),
      pointStyle: "line", pointRadius: 16, pointHoverRadius: 16, borderWidth: 3, borderColor: css("--text"), backgroundColor: css("--text") });
    chart("c-strip", {
      type: "scatter", data: { datasets: ds },
      options: baseOpts({
        interaction: { mode: "nearest", intersect: true },
        plugins: { legend: { display: false }, tooltip: Object.assign(baseOpts().plugins.tooltip, {
          callbacks: { title: c => ORDER[Math.round(c[0].raw.x)], label: c => ` ${c.dataset.label === "median" ? "median" : "run"}: ${fmt(c.raw.orig)}` } }) },
        scales: { x: { type: "linear", min: -0.6, max: ORDER.length - 0.4, grid: { display: false }, border: { display: false },
                       ticks: { stepSize: 1, autoSkip: false, maxRotation: 0, callback: v => Number.isInteger(v) ? ORDER[v].replace("QS (ungated)", "QS-u").replace("Quantum Swarm", "QS") : "" } },
                  y: logAxis("final fitness") },
      }),
    });

    // table of means
    const head = `<tr><th>Function</th>${ORDER.map(a => `<th class="${a === "Quantum Swarm" ? "qs" : ""}"><span class="swatch" style="background:${color(a)}"></span>${a}</th>`).join("")}</tr>`;
    const rows = S.functions.map(f => {
      const b = S.data[f], best = Math.min(...ORDER.map(a => b[a].mean));
      return `<tr><td>${S.shifted ? "Shifted " : ""}${f}</td>` + ORDER.map(a => {
        const s = b[a], sg = s.sign ? `<span class="sg ${s.sign === "+" ? "plus" : s.sign === "-" ? "minus" : "eq"}">${s.sign === "-" ? "−" : s.sign}</span>` : `<span class="sg"></span>`;
        return `<td class="${s.mean === best ? "best" : ""} ${a === "Quantum Swarm" ? "qs" : ""}"><span class="m">${fmt(s.mean)}</span><span class="sd">(${fmt(s.std)})</span>${sg}</td>`;
      }).join("") + "</tr>";
    }).join("");
    $("#t-results").innerHTML = `<thead>${head}</thead><tbody>${rows}</tbody>`;

    // Friedman ranks
    const rk = Object.entries(S.ranks).sort((a, b) => a[1] - b[1]);
    $("#friedman-p").innerHTML = `${SETTING_LABEL[setting]} · Friedman test p = ${fmt(S.friedman_p)} ${S.friedman_p < 0.05 ? "(significant)" : "(not significant)"}`;
    chart("c-ranks", {
      type: "bar",
      data: { labels: rk.map(r => r[0]), datasets: [{ label: "average rank", data: rk.map(r => r[1]),
        backgroundColor: rk.map(r => color(r[0])), borderRadius: 4, borderSkipped: "start", barPercentage: 0.7 }] },
      options: baseOpts({ indexAxis: "y", plugins: { legend: { display: false }, tooltip: Object.assign(baseOpts().plugins.tooltip, {
        callbacks: { label: c => ` average rank ${c.raw.toFixed(2)}` } }) },
        scales: { x: { min: 0, max: 6, grid: { color: css("--grid"), drawTicks: false }, border: { display: false } },
                  y: { grid: { display: false }, border: { display: false } } } }),
    });

    // wins/ties/losses
    $("#t-wtl").innerHTML = `<thead><tr><th>Quantum Swarm vs</th><th>wins</th><th>ties</th><th>losses</th></tr></thead><tbody>` +
      Object.entries(S.wtl).map(([a, w]) => `<tr><td><span class="swatch" style="background:${color(a)}"></span>${a}</td><td class="w">${w[0]}</td><td>${w[1]}</td><td class="l">${w[2]}</td></tr>`).join("") + "</tbody>";
  }

  // ================= findings =================
  function renderFindings() {
    const tr = R.traces.runs, T = tr.Gated.alpha.length, xs = Array.from({ length: T }, (_, i) => i + 1);
    const base = xs.map((_, t) => 1 - 0.5 * t / (T - 1));
    chart("c-alpha", {
      type: "line",
      data: { labels: xs, datasets: [
        { label: "Ungated", data: tr.Ungated.alpha, borderColor: color("QS (ungated)"), backgroundColor: color("QS (ungated)"), borderWidth: 1.5, pointRadius: 0 },
        { label: "Gated (Quantum Swarm)", data: tr.Gated.alpha, borderColor: color("Quantum Swarm"), backgroundColor: color("Quantum Swarm"), borderWidth: 2, pointRadius: 0 },
        { label: "base schedule", data: base, borderColor: css("--text-3"), backgroundColor: css("--text-3"), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: baseOpts({ scales: { x: { type: "linear", min: 1, max: T, grid: { color: css("--grid"), drawTicks: false }, border: { display: false } },
                                     y: { min: 0.4, grid: { color: css("--grid"), drawTicks: false }, border: { display: false } } },
        plugins: Object.assign(baseOpts().plugins, { tooltip: Object.assign(baseOpts().plugins.tooltip, { callbacks: { title: c => "iteration " + c[0].label, label: c => ` ${c.dataset.label}: ${c.raw.toFixed(3)}` } }) }) }),
    });
    chart("c-sdi", {
      type: "line",
      data: { labels: xs, datasets: [
        { label: "Ungated", data: tr.Ungated.sdi, borderColor: color("QS (ungated)"), backgroundColor: color("QS (ungated)"), borderWidth: 1.5, pointRadius: 0 },
        { label: "Gated", data: tr.Gated.sdi, borderColor: color("Quantum Swarm"), backgroundColor: color("Quantum Swarm"), borderWidth: 2, pointRadius: 0 },
        { label: "δ = 0.05", data: xs.map(() => 0.05), borderColor: css("--text-3"), backgroundColor: css("--text-3"), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: baseOpts({ plugins: Object.assign(baseOpts().plugins, { legend: { display: false },
        tooltip: Object.assign(baseOpts().plugins.tooltip, { callbacks: { title: c => "iteration " + c[0].label, label: c => ` ${c.dataset.label}: ${c.raw.toFixed(4)}` } }) }),
        scales: { x: { type: "linear", min: 1, max: T, grid: { color: css("--grid"), drawTicks: false }, border: { display: false } },
                  y: { min: 0, grid: { color: css("--grid"), drawTicks: false }, border: { display: false } } } }),
    });
    const u = R.settings.classical_d30.wtl["QS (ungated)"], n = R.settings.classical_d30.functions.length;
    $("#gate-note").innerHTML = `In this run the gated controller finished at <b>${fmt(tr.Gated.best[T - 1])}</b> and the ungated one at <b>${fmt(tr.Ungated.best[T - 1])}</b>. Over 30 runs at D = 30, the gated version was significantly better on <b>${u[0]} of ${n}</b> functions.`;

    // rank shift table
    const c30 = R.settings.classical_d30.ranks, sh = R.settings.shifted_d30.ranks;
    const algs = Object.keys(c30).sort((a, b) => c30[a] - c30[b]);
    const bar = (v, a) => `<span class="bar" style="width:${(v / 6 * 70).toFixed(0)}px;background:${color(a)}"></span>${v.toFixed(2)}`;
    $("#t-shift").innerHTML = `<thead><tr><th>Algorithm</th><th style="text-align:left">Classical (6 fns)</th><th style="text-align:left">Shifted (5 fns)</th></tr></thead><tbody>` +
      algs.map(a => `<tr><td><span class="swatch" style="background:${color(a)}"></span>${a}</td><td class="r">${bar(c30[a], a)}</td><td class="r">${bar(sh[a], a)}</td></tr>`).join("") + "</tbody>";

    // ablation
    const A = R.ablation, cols = A.algorithms;
    $("#t-abl").innerHTML = `<thead><tr><th>Function</th>${cols.map(a => `<th class="${a === "Quantum Swarm" ? "qs" : ""}">${({ "Quantum Swarm": "Full QS", "Without stagnation handling": "No stagnation module", "Without diversity boost": "No diversity boost" })[a] || a}</th>`).join("")}</tr></thead><tbody>` +
      A.functions.map(f => `<tr><td>${f}</td>` + cols.map(a => {
        const s = A.data[f][a], sg = s.sign ? `<span class="sg ${s.sign === "+" ? "plus" : s.sign === "-" ? "minus" : "eq"}">${s.sign === "-" ? "−" : s.sign}</span>` : "";
        return `<td class="${a === "Quantum Swarm" ? "qs" : ""}"><span class="m">${fmt(s.mean)}</span>${sg}</td>`;
      }).join("") + "</tr>").join("") + "</tbody>";
    const nonTie = Object.values(A.wtl).reduce((k, w) => k + w[0] + w[2], 0);
    const sch = A.data.Schwefel;
    $("#abl-note").innerHTML = (nonTie === 0
      ? "No reduced version differs significantly from the full algorithm on any function: with a 30,000-evaluation budget the effect of each component is within run-to-run noise, so the algorithm behaves much like QPSO."
      : `${nonTie} significant difference(s) in total across the reduced versions.`) +
      ` The largest gap is on the deceptive Schwefel function, where removing stagnation handling moves the mean from ${fmt(sch["Quantum Swarm"].mean)} to ${fmt(sch["Without stagnation handling"].mean)}: resetting particles too often interrupts slow progress.`;
  }

  // ================= code =================
  function modules() {
    const M = [
      ["quantum_swarm/quantum_swarm.py", "Quantum Swarm + QPSO", "Monitoring (SDI, IR), gated α controller, quantum position update, stagnation handling. Algorithm 5.1."],
      ["quantum_swarm/baselines.py", "Baseline algorithms", "PSO with decreasing inertia, DE/rand/1/bin and the Grey Wolf Optimizer, same interface."],
      ["quantum_swarm/benchmarks.py", "Benchmark functions", "Sphere, Rosenbrock, Rastrigin, Ackley, Griewank, Schwefel, vectorised, plus the shift wrapper."],
      ["quantum_swarm/stats.py", "Statistics", "Mean / std / median, Wilcoxon rank-sum signs, Friedman ranks and p-value."],
      ["experiments/run_experiments.py", "Experiment runner", "All 3,825 runs in parallel with seeds 1000 + r; writes results/results.json."],
      ["experiments/make_figures.py", "Visualisation", "Convergence curves, box plots, SDI/α traces and particle snapshots with Matplotlib."],
    ];
    $("#modules").innerHTML = M.map(([p, t, d]) => `<a class="module" href="${REPO}${p}" target="_blank" rel="noopener"><div class="path">${p}</div><div class="t">${t}</div><div class="d">${d}</div></a>`).join("");
  }

  // ================= live demo =================
  const D = window.QSDemo;
  let S = null, prev = null, running = false, acc = 0, last = 0;
  function demoCharts() {
    const T = D.P.T, xs = Array.from({ length: T + 1 }, (_, i) => i);
    chart("c-demo-best", {
      type: "line",
      data: { labels: xs, datasets: [
        { label: "current", data: [], borderColor: color("Quantum Swarm"), backgroundColor: color("Quantum Swarm"), borderWidth: 2, pointRadius: 0 },
        { label: "previous", data: [], borderColor: css("--text-3"), backgroundColor: css("--text-3"), borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: baseOpts({ plugins: Object.assign(baseOpts().plugins, { legend: { display: false },
        tooltip: Object.assign(baseOpts().plugins.tooltip, { callbacks: { title: c => "iteration " + c[0].label, label: c => ` ${c.dataset.label}: ${fmt(c.raw)}` } }) }),
        scales: { x: { type: "linear", min: 0, max: T, grid: { color: css("--grid"), drawTicks: false }, border: { display: false }, ticks: { maxTicksLimit: 5 } },
                  y: Object.assign(logAxis(), { ticks: Object.assign(logAxis().ticks, { maxTicksLimit: 4 }) }) } }),
    });
    chart("c-demo-alpha", {
      type: "line",
      data: { labels: xs, datasets: [
        { label: "α", data: [], borderColor: color("Quantum Swarm"), backgroundColor: color("Quantum Swarm"), borderWidth: 2, pointRadius: 0, stepped: true },
        { label: "base schedule", data: xs.slice(0, T).map(t => 1 - 0.5 * t / (T - 1)), borderColor: css("--text-3"), backgroundColor: css("--text-3"), borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: baseOpts({ plugins: Object.assign(baseOpts().plugins, { legend: { display: false },
        tooltip: Object.assign(baseOpts().plugins.tooltip, { callbacks: { title: c => "iteration " + c[0].label, label: c => ` ${c.dataset.label}: ${c.raw == null ? "–" : c.raw.toFixed(3)}` } }) }),
        scales: { x: { type: "linear", min: 0, max: T, grid: { color: css("--grid"), drawTicks: false }, border: { display: false }, ticks: { maxTicksLimit: 5 } },
                  y: { min: 0.4, max: 1.6, grid: { color: css("--grid"), drawTicks: false }, border: { display: false }, ticks: { maxTicksLimit: 4 } } } }),
    });
  }
  function demoReset(keepPrev) {
    if (keepPrev && S && S.t > 0) prev = { hist: S.hist.slice(), label: `${S.alg} (seed ${$("#d-seed").value})`, fname: S.fname };
    S = D.init($("#d-func").value, $("#d-alg").value, parseInt($("#d-seed").value, 10) || 0);
    demoUpdate();
  }
  function demoUpdate() {
    D.draw($("#field"), S);
    $("#r-it").textContent = `${S.t}/${D.P.T}`;
    $("#r-best").textContent = fmt(S.gf);
    $("#r-sdi").textContent = Number.isNaN(S.sdi) ? "–" : S.sdi.toFixed(4);
    $("#r-alpha").textContent = Number.isNaN(S.alpha) ? (S.alg === "PSO" ? "n/a" : "–") : S.alpha.toFixed(3);
    $("#r-stuck").textContent = S.alg === "PSO" ? "n/a" : S.stuck;
    $("#r-br").textContent = S.alg === "Quantum Swarm" ? `${S.boosts} · ${S.resets}` : "n/a";
    const cb = charts["c-demo-best"], ca = charts["c-demo-alpha"];
    if (cb) {
      const fl = 1e-12;
      cb.data.datasets[0].data = S.hist.map(v => Math.max(v, fl));
      cb.data.datasets[0].label = S.alg;
      const showPrev = prev && prev.fname === S.fname;
      cb.data.datasets[1].data = showPrev ? prev.hist.map(v => Math.max(v, fl)) : [];
      cb.data.datasets[1].label = showPrev ? prev.label : "previous";
      cb.update("none");
      ca.data.datasets[0].data = S.alphas.map(v => Number.isNaN(v) ? null : v);
      ca.update("none");
    }
  }
  function setRunning(on) {
    running = on;
    $("#d-run").textContent = on ? "❚❚ Pause" : (S && S.t >= D.P.T ? "↻ Run again" : "▶ Run");
    if (on) { last = performance.now(); acc = 0; requestAnimationFrame(loop); }
  }
  function loop(now) {
    if (!running) return;
    acc += (now - last) / 1000 * parseInt($("#d-speed").value, 10);
    last = now;
    let moved = false;
    while (acc >= 1) { acc -= 1; if (!D.step(S)) { setRunning(false); break; } moved = true; }
    if (moved) demoUpdate();
    if (running) requestAnimationFrame(loop);
  }
  function demoBind() {
    $("#d-run").onclick = () => {
      if (running) return setRunning(false);
      if (S.t >= D.P.T) demoReset(true);
      setRunning(true);
    };
    $("#d-step").onclick = () => { setRunning(false); D.step(S); demoUpdate(); };
    $("#d-reset").onclick = () => { setRunning(false); demoReset(true); };
    $("#d-new").onclick = () => { setRunning(false); $("#d-seed").value = Math.floor(Math.random() * 10000); demoReset(true); };
    ["#d-func", "#d-alg", "#d-seed"].forEach(s => $(s).addEventListener("change", () => { setRunning(false); demoReset(true); }));
  }

  // ================= boot =================
  function renderAll() {
    renderResults();
    renderFindings();
    demoCharts();
    demoUpdate();
  }
  document.addEventListener("DOMContentLoaded", () => {
    modules();
    demoBind();
    demoReset(false);
    $("#setting-seg").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      setting = b.dataset.k;
      document.querySelectorAll("#setting-seg button").forEach(x => x.classList.toggle("on", x === b));
      renderResults();
    });
    $("#func-chips").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      func = b.dataset.f; renderResults();
    });
    fetch("data/results.json").then(r => r.json()).then(data => {
      R = data;
      func = R.settings[setting].functions[2];   // start on Rastrigin
      $("#results-sub").innerHTML = `${ORDER.length} algorithms, ${R.meta.runs} independent runs each (seeds ${R.meta.seeds}), N = ${R.meta.N}, T = ${R.meta.T} iterations, so ${(R.meta.N * R.meta.T).toLocaleString()} function evaluations per run. Every number here is read from <code>results/results.json</code>, written by <code>experiments/run_experiments.py</code> (${R.meta.total_runs.toLocaleString()} runs in ${Math.round(R.meta.elapsed_s)} s).`;
      tiles();
      renderAll();
    }).catch(err => { $("#results-sub").textContent = "Could not load data/results.json: " + err; demoCharts(); demoUpdate(); });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (R) renderAll(); });
  });
})();

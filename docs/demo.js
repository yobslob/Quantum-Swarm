/* Live 2-D demo: a JavaScript port of quantum_swarm/quantum_swarm.py and the PSO baseline.
 * Same update rules and parameters as the Python code (Table 5.4), run on D = 2 so the
 * swarm can be drawn. */
(function () {
  "use strict";

  // ---------- benchmark functions (Table 5.1) ----------
  const F = {
    Sphere:     { lo: -100, hi: 100, opt: [0, 0], f: x => x[0] * x[0] + x[1] * x[1] },
    Rosenbrock: { lo: -30, hi: 30, opt: [1, 1], f: x => 100 * (x[1] - x[0] * x[0]) ** 2 + (1 - x[0]) ** 2 },
    Rastrigin:  { lo: -5.12, hi: 5.12, opt: [0, 0],
                  f: x => 20 + x[0] * x[0] - 10 * Math.cos(2 * Math.PI * x[0]) + x[1] * x[1] - 10 * Math.cos(2 * Math.PI * x[1]) },
    Ackley:     { lo: -32, hi: 32, opt: [0, 0],
                  f: x => -20 * Math.exp(-0.2 * Math.sqrt((x[0] * x[0] + x[1] * x[1]) / 2))
                          - Math.exp((Math.cos(2 * Math.PI * x[0]) + Math.cos(2 * Math.PI * x[1])) / 2) + 20 + Math.E },
    Griewank:   { lo: -600, hi: 600, opt: [0, 0],
                  f: x => 1 + (x[0] * x[0] + x[1] * x[1]) / 4000 - Math.cos(x[0]) * Math.cos(x[1] / Math.SQRT2) },
    Schwefel:   { lo: -500, hi: 500, opt: [420.9687, 420.9687],
                  f: x => 418.9829 * 2 - x[0] * Math.sin(Math.sqrt(Math.abs(x[0]))) - x[1] * Math.sin(Math.sqrt(Math.abs(x[1]))) },
  };

  // ---------- parameters (Table 5.4) ----------
  const P = { N: 30, T: 200, D: 2, aMax: 1.0, aMin: 0.5, aCap: 1.5, aTunnel: 1.5,
              delta: 0.05, kd: 0.5, eta: 1e-6, W: 20, rho: 0.2, eps: 1e-12 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const reflect = (v, lo, hi) => {
    if (v > hi) v = 2 * hi - v;
    if (v < lo) v = 2 * lo - v;
    return Math.min(hi, Math.max(lo, v));
  };

  // ---------- optimiser state machine ----------
  function init(fname, alg, seed) {
    const fn = F[fname], rnd = mulberry32(seed * 2654435761 + 12345);
    const S = { fname, alg, fn, rnd, t: 0, X: [], V: [], fx: [], pb: [], pf: [], gb: null, gf: Infinity,
                hist: [], alphas: [], sdi: NaN, alpha: NaN, stuck: 0, boosts: 0, resets: 0, boosted: new Set() };
    for (let i = 0; i < P.N; i++) {
      const x = [0, 1].map(() => fn.lo + rnd() * (fn.hi - fn.lo));
      S.X.push(x); S.V.push([0, 0]); const v = fn.f(x); S.fx.push(v);
      S.pb.push(x.slice()); S.pf.push(v);
      if (v < S.gf) { S.gf = v; S.gb = x.slice(); }
    }
    S.hist.push(S.gf);
    S.sdi = sdiOf(S);
    return S;
  }

  function sdiOf(S) {
    const c = [0, 0];
    S.X.forEach(x => { c[0] += x[0] / P.N; c[1] += x[1] / P.N; });
    const diag = Math.hypot(S.fn.hi - S.fn.lo, S.fn.hi - S.fn.lo);
    let m = 0;
    S.X.forEach(x => { m += Math.hypot(x[0] - c[0], x[1] - c[1]) / P.N; });
    return m / diag;
  }

  function worstIdx(S, k) {
    return S.fx.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, k).map(p => p[1]);
  }

  function step(S) {
    if (S.t >= P.T) return false;
    const { fn, rnd } = S, t = S.t;
    S.boosted = new Set();
    if (S.alg === "PSO") {
      const w = 0.9 - 0.5 * t / (P.T - 1), vmax = 0.2 * (fn.hi - fn.lo);
      for (let i = 0; i < P.N; i++) for (let j = 0; j < 2; j++) {
        let v = w * S.V[i][j] + 2 * rnd() * (S.pb[i][j] - S.X[i][j]) + 2 * rnd() * (S.gb[j] - S.X[i][j]);
        v = Math.max(-vmax, Math.min(vmax, v));
        S.V[i][j] = v; S.X[i][j] = reflect(S.X[i][j] + v, fn.lo, fn.hi);
      }
      S.alpha = NaN;
    } else {
      const qs = S.alg === "Quantum Swarm";
      const mb = [0, 0];
      S.pb.forEach(p => { mb[0] += p[0] / P.N; mb[1] += p[1] / P.N; });
      // monitoring module
      S.sdi = sdiOf(S);
      const old = S.hist[Math.max(0, t - P.W)], ir = (old - S.hist[t]) / (Math.abs(old) + P.eps);
      S.stuck = ir < P.eta ? S.stuck + 1 : 0;
      // adaptive alpha controller (gated)
      let a = P.aMax - (P.aMax - P.aMin) * t / (P.T - 1);
      if (qs) {
        const g = S.stuck >= P.W / 2 ? 1 : 0;
        a = Math.min(P.aCap, a + g * P.kd * Math.max(0, (P.delta - S.sdi) / P.delta));
      }
      S.alpha = a;
      const ai = new Array(P.N).fill(a);
      const k = Math.max(1, Math.round(P.rho * P.N));
      if (qs && S.stuck >= P.W) {               // tunnelling boost
        worstIdx(S, k).forEach(i => { ai[i] = P.aTunnel; S.boosted.add(i); });
        S.boosts++;
      }
      for (let i = 0; i < P.N; i++) for (let j = 0; j < 2; j++) {
        const phi = rnd(), u = 1 - rnd();
        const p = phi * S.pb[i][j] + (1 - phi) * S.gb[j];
        const stepLen = ai[i] * Math.abs(mb[j] - S.X[i][j]) * Math.log(1 / u);
        S.X[i][j] = reflect(rnd() < 0.5 ? p - stepLen : p + stepLen, fn.lo, fn.hi);
      }
      if (qs && S.stuck >= 2 * P.W) {          // partial re-initialisation
        worstIdx(S, k).forEach(i => { S.X[i] = [0, 1].map(() => fn.lo + rnd() * (fn.hi - fn.lo)); });
        S.stuck = 0; S.resets++;
      }
    }
    for (let i = 0; i < P.N; i++) {
      const v = fn.f(S.X[i]); S.fx[i] = v;
      if (v < S.pf[i]) { S.pf[i] = v; S.pb[i] = S.X[i].slice(); }
      if (v < S.gf) { S.gf = v; S.gb = S.X[i].slice(); }
    }
    S.t++;
    S.hist.push(S.gf);
    S.alphas.push(S.alpha);
    if (S.alg === "PSO") S.sdi = sdiOf(S);
    return true;
  }

  // ---------- drawing ----------
  const RAMP = ["#ffffff", "#f0f5fc", "#e1ebf8", "#d0e0f3", "#bcd2ec", "#a6c2e4", "#8eb0da"]
    .map(h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)));
  function rampColor(v) {
    const x = Math.max(0, Math.min(1, v)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i;
    return RAMP[i].map((c, k) => Math.round(c + (RAMP[i + 1][k] - c) * f));
  }
  const bgCache = {};
  function background(fname, size) {
    const key = fname + size;
    if (bgCache[key]) return bgCache[key];
    const fn = F[fname], c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d"), img = ctx.createImageData(size, size), vals = new Float64Array(size * size);
    let mn = Infinity, mx = -Infinity;
    for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
      const x = fn.lo + (px + 0.5) / size * (fn.hi - fn.lo), y = fn.hi - (py + 0.5) / size * (fn.hi - fn.lo);
      const v = Math.log10(fn.f([x, y]) + 1);
      vals[py * size + px] = v; mn = Math.min(mn, v); mx = Math.max(mx, v);
    }
    for (let i = 0; i < vals.length; i++) {
      const col = rampColor((vals[i] - mn) / (mx - mn || 1));
      img.data[4 * i] = col[0]; img.data[4 * i + 1] = col[1]; img.data[4 * i + 2] = col[2]; img.data[4 * i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return (bgCache[key] = c);
  }

  function draw(canvas, S) {
    const ctx = canvas.getContext("2d"), W = canvas.width, fn = S.fn;
    ctx.drawImage(background(S.fname, W), 0, 0);
    const tx = v => (v - fn.lo) / (fn.hi - fn.lo) * W, ty = v => W - (v - fn.lo) / (fn.hi - fn.lo) * W;
    // particles
    S.X.forEach(x => {
      ctx.beginPath(); ctx.arc(tx(x[0]), ty(x[1]), 6, 0, 2 * Math.PI);
      ctx.fillStyle = "#e8692c"; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "#ffffff"; ctx.stroke();
    });
    // optimum
    ctx.font = "30px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 3; ctx.strokeStyle = "#ffffff"; ctx.strokeText("★", tx(fn.opt[0]), ty(fn.opt[1]));
    ctx.fillStyle = "#191919"; ctx.fillText("★", tx(fn.opt[0]), ty(fn.opt[1]));
  }

  window.QSDemo = { F, P, init, step, draw };
})();

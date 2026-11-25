"""Experiment runner (Section 4.8, Table 5.2).

Runs every combination of algorithm x function x dimension x run in
parallel, computes the statistics and writes ``results/results.json``,
which the figures and the web dashboard are built from.

    python experiments/run_experiments.py            # full study (3,825 runs)
    python experiments/run_experiments.py --runs 5   # quick check
"""
import argparse
import json
import os
import shutil
import sys
import time
from multiprocessing import Pool

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from quantum_swarm import ALGORITHMS, BENCHMARKS, SHIFTABLE, QSParams, get, quantum_swarm  # noqa: E402
from quantum_swarm import stats as st  # noqa: E402

N, T = 30, 1000
SEED0 = 1000
CURVE_STEP = 10          # store the median convergence curve every 10 iterations
ROOT = os.path.join(os.path.dirname(__file__), "..")

VARIANTS = {
    "Without stagnation handling": QSParams(stagnation=False),
    "Without diversity boost": QSParams(diversity_boost=False),
}


def run_job(job):
    alg, fname, dim, shift, run, params = job
    bench = get(fname, dim, shift)
    lo, hi = bench.bounds(dim)
    seed = SEED0 + run
    t0 = time.perf_counter()
    if params is not None:
        res = quantum_swarm(bench, lo, hi, N, T, seed, QSParams(**params))
    else:
        res = ALGORITHMS[alg](bench, lo, hi, N, T, seed)
    return job[:5], res.best_f, res.history[::CURVE_STEP].copy(), time.perf_counter() - t0


def sig(x, digits=4):
    return float(f"{x:.{digits}g}")


def collect(results, setting, algs, funcs, dim, shift, runs):
    """Group finished jobs into per-function, per-algorithm blocks with statistics."""
    out = {"dim": dim, "shifted": shift, "algorithms": algs, "functions": funcs, "data": {}}
    means = {a: [] for a in algs}
    for f in funcs:
        block = {}
        finals = {a: np.array([results[(a, f, dim, shift, r)][0] for r in range(runs)]) for a in algs}
        for a in algs:
            hists = np.array([results[(a, f, dim, shift, r)][1] for r in range(runs)])
            times = [results[(a, f, dim, shift, r)][2] for r in range(runs)]
            s = st.summary(finals[a])
            s["finals"] = [sig(v) for v in finals[a]]
            s["curve"] = [sig(v) for v in np.median(hists, axis=0)]
            s["time"] = float(np.mean(times))
            if a != "Quantum Swarm" and "Quantum Swarm" in algs:
                s["sign"], s["p"] = st.wilcoxon_sign(finals["Quantum Swarm"], finals[a])
            block[a] = s
            means[a].append(s["mean"])
        out["data"][f] = block
    if len(funcs) > 2:
        out["ranks"], out["friedman_p"] = st.friedman(means)
    wtl = {}
    for a in algs:
        if a == "Quantum Swarm":
            continue
        signs = [out["data"][f][a]["sign"] for f in funcs]
        wtl[a] = [signs.count("+"), signs.count("="), signs.count("-")]
    out["wtl"] = wtl
    print(f"  {setting}: done")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=30)
    ap.add_argument("--sens-runs", type=int, default=15)
    ap.add_argument("--workers", type=int, default=os.cpu_count())
    a = ap.parse_args()
    R, RS = a.runs, a.sens_runs
    algs = list(ALGORITHMS)
    funcs = list(BENCHMARKS)

    jobs = []
    for d in (10, 30):
        jobs += [(al, f, d, False, r, None) for al in algs for f in funcs for r in range(R)]
    for name, p in VARIANTS.items():
        jobs += [(name, f, 30, False, r, p.__dict__) for f in funcs for r in range(R)]
    n_main = len(jobs)
    jobs += [(al, f, 30, True, r, None) for al in algs for f in SHIFTABLE for r in range(R)]
    sens = [(w, rho) for w in (10, 20, 50) for rho in (0.1, 0.2, 0.3)]
    for w, rho in sens:
        p = QSParams(window=w, rho=rho).__dict__
        jobs += [(f"W={w}, rho={rho}", f, 30, False, r, p) for f in ("Rastrigin", "Schwefel", "Griewank")
                 for r in range(RS)]
    print(f"{len(jobs)} runs ({n_main} main + ablation, {len(jobs) - n_main} shifted + sensitivity) "
          f"on {a.workers} workers")

    t0 = time.perf_counter()
    with Pool(a.workers) as pool:
        out = pool.map(run_job, jobs, chunksize=4)
    elapsed = time.perf_counter() - t0
    results = {k: (bf, h, dt) for k, bf, h, dt in out}
    print(f"finished in {elapsed:.1f} s")

    report = {
        "meta": {"N": N, "T": T, "runs": R, "sens_runs": RS, "seeds": f"{SEED0} + r",
                 "total_runs": len(jobs), "elapsed_s": round(elapsed, 1), "curve_step": CURVE_STEP,
                 "workers": a.workers},
        "settings": {
            "classical_d10": collect(results, "classical_d10", algs, funcs, 10, False, R),
            "classical_d30": collect(results, "classical_d30", algs, funcs, 30, False, R),
            "shifted_d30": collect(results, "shifted_d30", algs, SHIFTABLE, 30, True, R),
        },
    }
    abl = ["Quantum Swarm", *VARIANTS, "QPSO"]
    report["ablation"] = collect(results, "ablation", abl, funcs, 30, False, R)
    report["sensitivity"] = {
        f: {f"W={w}, rho={rho}": st.summary([results[(f"W={w}, rho={rho}", f, 30, False, r)][0]
                                             for r in range(RS)])["mean"] for w, rho in sens}
        for f in ("Rastrigin", "Schwefel", "Griewank")}

    # SDI / alpha traces of one run on Rastrigin, D = 30 (gated vs ungated controller)
    b = BENCHMARKS["Rastrigin"]
    lo, hi = b.bounds(30)
    traces = {}
    for label, p in (("Gated", QSParams()), ("Ungated", QSParams(gate=False))):
        res = quantum_swarm(b, lo, hi, N, T, 7, p, record=True)
        traces[label] = {"sdi": [sig(v) for v in res.trace["sdi"]],
                         "alpha": [sig(v) for v in res.trace["alpha"]],
                         "best": [sig(v) for v in res.history[1:]],
                         "boosts": res.trace["boosts"], "resets": res.trace["resets"]}
    report["traces"] = {"function": "Rastrigin", "dim": 30, "seed": 7, "runs": traces}

    os.makedirs(os.path.join(ROOT, "results"), exist_ok=True)
    path = os.path.join(ROOT, "results", "results.json")
    with open(path, "w") as fh:
        json.dump(report, fh, separators=(",", ":"))
    print(f"wrote {os.path.relpath(path)} ({os.path.getsize(path) / 1024:.0f} KB)")
    # the GitHub Pages dashboard (docs/) reads the same file
    os.makedirs(os.path.join(ROOT, "docs", "data"), exist_ok=True)
    shutil.copy(path, os.path.join(ROOT, "docs", "data", "results.json"))


if __name__ == "__main__":
    main()

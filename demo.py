"""Demonstration run of Quantum Swarm (Figure 6.1 of the report).

    python demo.py [--function Rastrigin] [--dim 30] [--seed 7]
"""
import argparse
import time

from quantum_swarm import BENCHMARKS, qpso, quantum_swarm


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--function", default="Rastrigin", choices=list(BENCHMARKS))
    ap.add_argument("--dim", type=int, default=30)
    ap.add_argument("--n", type=int, default=30)
    ap.add_argument("--iters", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()

    b = BENCHMARKS[a.function]
    lo, hi = b.bounds(a.dim)
    print(f"Quantum Swarm demo | function = {b.name} | D = {a.dim} | N = {a.n} | T = {a.iters} | seed = {a.seed}")
    t0 = time.perf_counter()
    res = quantum_swarm(b, lo, hi, a.n, a.iters, a.seed, record=True)
    dt = time.perf_counter() - t0

    print(f"{'iter':>5} {'best f(x)':>12} {'SDI':>9} {'alpha':>7}")
    for t in list(range(0, a.iters, 100)) + [a.iters - 1]:
        print(f"{t + 1:>5} {res.history[t + 1]:>12.4f} {res.trace['sdi'][t]:>9.5f} {res.trace['alpha'][t]:>7.3f}")
    print(f"tunnelling boosts: {res.trace['boosts']} | partial re-initialisations: {res.trace['resets']}")
    print(f"final best = {res.best_f:.4f} | run time = {dt:.2f} s")
    q = qpso(b, lo, hi, a.n, a.iters, a.seed)
    print(f"QPSO with the same seed: final best = {q.best_f:.4f}")


if __name__ == "__main__":
    main()

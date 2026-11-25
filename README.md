# Quantum Swarm

**An adaptive quantum-inspired swarm optimisation algorithm.**
Minor Project (ARP 455), B.Tech Artificial Intelligence and Data Science,
University School of Automation and Robotics, GGSIPU.
Yogesh and Archit, supervised by Dr. Mahvish Khurshid Bijli.

**Live dashboard:** https://yobslob.github.io/Quantum-Swarm/

Quantum Swarm builds on Quantum-behaved Particle Swarm Optimization (QPSO). In every
iteration it measures its swarm with a **Swarm Diversity Index (SDI)** and an
**Improvement Rate (IR)**. A gated controller raises the contraction-expansion
coefficient α only when the swarm has low diversity *and* has stopped improving,
and a stagnation module gives the worst particles a tunnelling boost or new
positions when the swarm stays stuck.

## Repository layout

| Path | Module (report Chapter 4) |
|---|---|
| `quantum_swarm/quantum_swarm.py` | Monitoring, adaptive α controller, quantum position update, stagnation handling (Algorithm 5.1); standard QPSO |
| `quantum_swarm/baselines.py` | Baselines: PSO, DE/rand/1/bin, Grey Wolf Optimizer |
| `quantum_swarm/benchmarks.py` | Sphere, Rosenbrock, Rastrigin, Ackley, Griewank, Schwefel and shifted versions |
| `quantum_swarm/stats.py` | Summary statistics, Wilcoxon rank-sum test, Friedman ranks |
| `experiments/run_experiments.py` | Experiment runner: all 3,825 runs, writes `results/results.json` |
| `experiments/make_figures.py` | Figures in `results/figures/` |
| `demo.py` | One demonstration run (Figure 6.1) |
| `docs/` | The GitHub Pages dashboard (live in-browser demo and results) |

## Usage

```bash
pip install -r requirements.txt

python demo.py --function Rastrigin --dim 30 --seed 7   # one run, prints best f(x), SDI and alpha
python experiments/run_experiments.py                   # full study (about 2-3 minutes on 4 cores)
python experiments/make_figures.py                      # figures -> results/figures/
```

Use it on your own problem:

```python
import numpy as np
from quantum_swarm import quantum_swarm

f = lambda X: np.sum((X - 3.0) ** 2, axis=1)   # vectorised: X has shape (N, D)
res = quantum_swarm(f, lower=np.full(10, -10.0), upper=np.full(10, 10.0), n=30, iters=1000, seed=0)
print(res.best_f, res.best_x)
```

## Experimental setup (Table 5.2)

* Algorithms: PSO, DE, GWO, QPSO, Quantum Swarm (ungated), Quantum Swarm
* Six classical functions at D = 10 and 30; five shifted functions at D = 30
* N = 30, T = 1000 iterations (30,000 evaluations per run), 30 runs, seeds 1000 + r
* Wilcoxon rank-sum test (p < 0.05) and Friedman average ranks
* Ablation study and sensitivity study of W and ρ (15 runs per setting)

## Quantum Swarm parameters (Table 5.4)

| α_max, α_min | α_cap | α_tunnel | δ | k_d | η | W | ρ |
|---|---|---|---|---|---|---|---|
| 1.0, 0.5 | 1.5 | 1.5 | 0.05 | 0.5 | 1e-6 | 20 | 0.2 |

## Dashboard

`docs/` is a static site with no build step. It reads `docs/data/results.json`
(a copy of `results/results.json` that `run_experiments.py` writes) and includes a
JavaScript port of the algorithm that runs live on 2-D versions of the benchmarks.
To publish it: **Settings → Pages → Build and deployment → Deploy from a branch →
`main` / `/docs`**.

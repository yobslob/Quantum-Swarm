"""Quantum Swarm (Algorithm 5.1) and standard QPSO.

Modules implemented here:
  * Monitoring module            - Swarm Diversity Index (Eq. 4.1), Improvement Rate (Eq. 4.2)
  * Adaptive alpha controller    - base schedule (Eq. 4.3) + gated correction (Eq. 4.4, 4.5)
  * Quantum position update      - QPSO update (Eq. 1.4 - 1.6) with reflection at the bounds
  * Stagnation handling module   - tunnelling boost and partial re-initialisation

Standard QPSO is the same procedure with the controller correction and the
stagnation module switched off, so both share one implementation.
"""
from dataclasses import dataclass

import numpy as np

from .common import Result, initialise, reflect


@dataclass
class QSParams:
    alpha_max: float = 1.0      # start of the base schedule
    alpha_min: float = 0.5      # end of the base schedule
    alpha_cap: float = 1.5      # upper limit on alpha (< 1.781, Sun et al. 2012)
    alpha_tunnel: float = 1.5   # coefficient used in a tunnelling boost
    delta: float = 0.05         # diversity threshold
    k_d: float = 0.5            # diversity gain
    eta: float = 1e-6           # improvement threshold
    window: int = 20            # W, window length in iterations
    rho: float = 0.2            # fraction of particles boosted / reset
    eps: float = 1e-12          # avoids division by zero in IR
    gate: bool = True           # stagnation gate g(t); False gives the ungated first design
    diversity_boost: bool = True
    stagnation: bool = True


def swarm_diversity_index(X, diag):
    """Eq. (4.1): mean distance of the particles from the swarm centre / box diagonal."""
    centre = X.mean(axis=0)
    return float(np.mean(np.linalg.norm(X - centre, axis=1)) / diag)


def improvement_rate(history, t, window, eps):
    """Eq. (4.2): relative improvement of the best fitness over the last W iterations."""
    old = history[max(0, t - window)]
    return float((old - history[t]) / (abs(old) + eps))


def quantum_swarm(f, lower, upper, n=30, iters=1000, seed=None, params=None, record=False):
    """Minimise f over the box [lower, upper] with Quantum Swarm."""
    p = params or QSParams()
    rng = np.random.default_rng(seed)
    lower = np.asarray(lower, float)
    upper = np.asarray(upper, float)
    diag = float(np.linalg.norm(upper - lower))
    n_worst = max(1, int(round(p.rho * n)))

    # Initialisation module
    X = initialise(rng, n, lower, upper)
    fx = f(X)
    pbest, pbest_f = X.copy(), fx.copy()
    g = int(np.argmin(pbest_f))
    gbest, gbest_f = pbest[g].copy(), float(pbest_f[g])

    hist = np.empty(iters + 1)
    hist[0] = gbest_f
    stuck = 0
    boosts = resets = 0
    tr_sdi, tr_alpha = (np.empty(iters), np.empty(iters)) if record else (None, None)

    for t in range(iters):
        mbest = pbest.mean(axis=0)

        # Monitoring module
        sdi = swarm_diversity_index(X, diag)
        ir = improvement_rate(hist, t, p.window, p.eps)
        stuck = stuck + 1 if ir < p.eta else 0

        # Adaptive alpha controller
        alpha = p.alpha_max - (p.alpha_max - p.alpha_min) * t / max(1, iters - 1)
        if p.diversity_boost:
            gate = 1.0 if (not p.gate or stuck >= p.window // 2) else 0.0
            alpha = min(p.alpha_cap, alpha + gate * p.k_d * max(0.0, (p.delta - sdi) / p.delta))
        a = np.full((n, 1), alpha)

        # Stagnation handling: tunnelling boost for the worst particles
        if p.stagnation and stuck >= p.window:
            worst = np.argsort(fx)[-n_worst:]
            a[worst] = p.alpha_tunnel
            boosts += 1

        # Quantum position update (vectorised over particles and dimensions)
        phi = rng.random((n, lower.size))
        u = 1.0 - rng.random((n, lower.size))           # u in (0, 1]
        attractor = phi * pbest + (1.0 - phi) * gbest
        step = a * np.abs(mbest - X) * np.log(1.0 / u)
        sign = np.where(rng.random((n, lower.size)) < 0.5, -1.0, 1.0)
        X = reflect(attractor + sign * step, lower, upper)

        # Stagnation handling: partial re-initialisation (personal bests are kept)
        if p.stagnation and stuck >= 2 * p.window:
            worst = np.argsort(fx)[-n_worst:]
            X[worst] = initialise(rng, n_worst, lower, upper)
            stuck = 0
            resets += 1

        # Evaluation and memory update
        fx = f(X)
        better = fx < pbest_f
        pbest[better], pbest_f[better] = X[better], fx[better]
        g = int(np.argmin(pbest_f))
        if pbest_f[g] < gbest_f:
            gbest, gbest_f = pbest[g].copy(), float(pbest_f[g])
        hist[t + 1] = gbest_f

        if record:
            tr_sdi[t], tr_alpha[t] = sdi, alpha

    trace = {"boosts": boosts, "resets": resets}
    if record:
        trace.update(sdi=tr_sdi, alpha=tr_alpha)
    return Result(gbest, gbest_f, hist, trace)


def qpso(f, lower, upper, n=30, iters=1000, seed=None, record=False):
    """Standard QPSO: linear alpha from 1.0 to 0.5, no controller, no stagnation module."""
    params = QSParams(diversity_boost=False, stagnation=False)
    return quantum_swarm(f, lower, upper, n, iters, seed, params, record)


def quantum_swarm_ungated(f, lower, upper, n=30, iters=1000, seed=None, record=False):
    """First design: the diversity correction is applied whenever SDI < delta."""
    return quantum_swarm(f, lower, upper, n, iters, seed, QSParams(gate=False), record)

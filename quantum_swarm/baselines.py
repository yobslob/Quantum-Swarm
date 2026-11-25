"""Baseline Algorithms Module (Section 4.7).

PSO with a decreasing inertia weight, DE/rand/1/bin and the Grey Wolf
Optimizer. All share the interface of ``quantum_swarm``: same population
size, iterations, bounds handling (reflection) and seeds.
"""
import numpy as np

from .common import Result, initialise, reflect


def pso(f, lower, upper, n=30, iters=1000, seed=None, w_max=0.9, w_min=0.4, c1=2.0, c2=2.0):
    """PSO (Kennedy & Eberhart 1995) with w falling linearly from 0.9 to 0.4 (Shi & Eberhart 1998)."""
    rng = np.random.default_rng(seed)
    lower, upper = np.asarray(lower, float), np.asarray(upper, float)
    vmax = 0.2 * (upper - lower)
    X = initialise(rng, n, lower, upper)
    V = np.zeros_like(X)
    fx = f(X)
    pbest, pbest_f = X.copy(), fx.copy()
    g = int(np.argmin(pbest_f))
    gbest, gbest_f = pbest[g].copy(), float(pbest_f[g])
    hist = np.empty(iters + 1)
    hist[0] = gbest_f
    for t in range(iters):
        w = w_max - (w_max - w_min) * t / max(1, iters - 1)
        r1, r2 = rng.random(X.shape), rng.random(X.shape)
        V = w * V + c1 * r1 * (pbest - X) + c2 * r2 * (gbest - X)
        V = np.clip(V, -vmax, vmax)
        X = reflect(X + V, lower, upper)
        fx = f(X)
        better = fx < pbest_f
        pbest[better], pbest_f[better] = X[better], fx[better]
        g = int(np.argmin(pbest_f))
        if pbest_f[g] < gbest_f:
            gbest, gbest_f = pbest[g].copy(), float(pbest_f[g])
        hist[t + 1] = gbest_f
    return Result(gbest, gbest_f, hist)


def de(f, lower, upper, n=30, iters=1000, seed=None, F=0.5, CR=0.9):
    """Differential Evolution, DE/rand/1/bin (Storn & Price 1997)."""
    rng = np.random.default_rng(seed)
    lower, upper = np.asarray(lower, float), np.asarray(upper, float)
    D = lower.size
    X = initialise(rng, n, lower, upper)
    fx = f(X)
    hist = np.empty(iters + 1)
    hist[0] = fx.min()
    idx = np.arange(n)
    for t in range(iters):
        # three distinct partners r1, r2, r3, all different from i
        r = np.empty((n, 3), int)
        for i in range(n):
            r[i] = rng.choice(np.delete(idx, i), 3, replace=False)
        mutant = X[r[:, 0]] + F * (X[r[:, 1]] - X[r[:, 2]])
        cross = rng.random((n, D)) < CR
        cross[idx, rng.integers(0, D, n)] = True       # at least one gene from the mutant
        trial = reflect(np.where(cross, mutant, X), lower, upper)
        ft = f(trial)
        better = ft <= fx
        X[better], fx[better] = trial[better], ft[better]
        hist[t + 1] = fx.min()
    b = int(np.argmin(fx))
    return Result(X[b].copy(), float(fx[b]), hist)


def gwo(f, lower, upper, n=30, iters=1000, seed=None):
    """Grey Wolf Optimizer (Mirjalili et al. 2014)."""
    rng = np.random.default_rng(seed)
    lower, upper = np.asarray(lower, float), np.asarray(upper, float)
    X = initialise(rng, n, lower, upper)
    fx = f(X)
    order = np.argsort(fx)[:3]
    leaders, leaders_f = X[order].copy(), fx[order].copy()
    hist = np.empty(iters + 1)
    hist[0] = leaders_f[0]
    for t in range(iters):
        a = 2.0 - 2.0 * t / max(1, iters - 1)
        new = np.zeros_like(X)
        for k in range(3):
            A = 2.0 * a * rng.random(X.shape) - a
            C = 2.0 * rng.random(X.shape)
            new += leaders[k] - A * np.abs(C * leaders[k] - X)
        X = reflect(new / 3.0, lower, upper)
        fx = f(X)
        # alpha, beta, delta = three best wolves found so far
        pool = np.vstack([leaders, X])
        pool_f = np.concatenate([leaders_f, fx])
        order = np.argsort(pool_f, kind="stable")[:3]
        leaders, leaders_f = pool[order].copy(), pool_f[order].copy()
        hist[t + 1] = leaders_f[0]
    return Result(leaders[0].copy(), float(leaders_f[0]), hist)

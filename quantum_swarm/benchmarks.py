"""Benchmark Function Module (Section 4.1, Table 5.1).

All functions are vectorised: ``f(X)`` takes an array of shape (N, D) and
returns N fitness values, so the whole swarm is evaluated in one call.
Every function has its global minimum value f(x*) = 0.
"""
from dataclasses import dataclass
from typing import Callable

import numpy as np


def sphere(X):
    return np.sum(X ** 2, axis=1)


def rosenbrock(X):
    return np.sum(100.0 * (X[:, 1:] - X[:, :-1] ** 2) ** 2 + (1.0 - X[:, :-1]) ** 2, axis=1)


def rastrigin(X):
    D = X.shape[1]
    return 10.0 * D + np.sum(X ** 2 - 10.0 * np.cos(2.0 * np.pi * X), axis=1)


def ackley(X):
    D = X.shape[1]
    a = -20.0 * np.exp(-0.2 * np.sqrt(np.sum(X ** 2, axis=1) / D))
    b = -np.exp(np.sum(np.cos(2.0 * np.pi * X), axis=1) / D)
    return a + b + 20.0 + np.e


def griewank(X):
    i = np.arange(1, X.shape[1] + 1)
    return 1.0 + np.sum(X ** 2, axis=1) / 4000.0 - np.prod(np.cos(X / np.sqrt(i)), axis=1)


def schwefel(X):
    D = X.shape[1]
    return 418.9829 * D - np.sum(X * np.sin(np.sqrt(np.abs(X))), axis=1)


@dataclass(frozen=True)
class Benchmark:
    name: str
    func: Callable
    lower: float
    upper: float
    kind: str

    def __call__(self, X):
        return self.func(X)

    def bounds(self, dim):
        return np.full(dim, self.lower), np.full(dim, self.upper)


BENCHMARKS = {
    "Sphere": Benchmark("Sphere", sphere, -100.0, 100.0, "Unimodal"),
    "Rosenbrock": Benchmark("Rosenbrock", rosenbrock, -30.0, 30.0, "Unimodal, narrow valley"),
    "Rastrigin": Benchmark("Rastrigin", rastrigin, -5.12, 5.12, "Multimodal"),
    "Ackley": Benchmark("Ackley", ackley, -32.0, 32.0, "Multimodal"),
    "Griewank": Benchmark("Griewank", griewank, -600.0, 600.0, "Multimodal"),
    "Schwefel": Benchmark("Schwefel", schwefel, -500.0, 500.0, "Multimodal, deceptive"),
}

# Functions whose optimum lies at (or near) the centre of the box; these are
# also tested in shifted form (Section 5.2.1, Equation 5.1).
SHIFTABLE = ["Sphere", "Rosenbrock", "Rastrigin", "Ackley", "Griewank"]


def shift_vector(name, dim, seed=2026):
    """Shift vector o drawn once, uniformly from the central 40 % of the range."""
    b = BENCHMARKS[name]
    half = 0.4 * (b.upper - b.lower) / 2.0
    rng = np.random.default_rng(seed + dim)
    return rng.uniform(-half, half, size=dim)


def shifted(name, dim, seed=2026):
    """Return f_shifted(x) = f(x - o) with the same bounds as the original."""
    b = BENCHMARKS[name]
    o = shift_vector(name, dim, seed)

    def f(X):
        return b.func(X - o)

    return Benchmark("Shifted " + name, f, b.lower, b.upper, b.kind)


def get(name, dim=None, shift=False):
    return shifted(name, dim) if shift else BENCHMARKS[name]

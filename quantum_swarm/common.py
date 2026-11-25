"""Shared helpers: initialisation (Section 4.2), bounds handling and the result record."""
from dataclasses import dataclass, field

import numpy as np


@dataclass
class Result:
    best_x: np.ndarray
    best_f: float
    history: np.ndarray                       # best fitness after every iteration
    trace: dict = field(default_factory=dict)  # optional SDI / alpha / counters


def initialise(rng, n, lower, upper):
    """Place n particles uniformly at random in the box [lower, upper]."""
    return lower + rng.random((n, lower.size)) * (upper - lower)


def reflect(X, lower, upper):
    """Reflect positions that left the box back inside (a ball bouncing off a wall)."""
    X = np.where(X > upper, 2.0 * upper - X, X)
    X = np.where(X < lower, 2.0 * lower - X, X)
    return np.clip(X, lower, upper)  # guards against jumps longer than the box

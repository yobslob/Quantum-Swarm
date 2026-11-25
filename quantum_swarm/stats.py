"""Statistics part of the Experiment Runner module (Section 5.6)."""
import numpy as np
from scipy import stats


def summary(values):
    v = np.asarray(values, float)
    return {"mean": float(v.mean()), "std": float(v.std(ddof=1)) if v.size > 1 else 0.0,
            "median": float(np.median(v)), "min": float(v.min()), "max": float(v.max())}


def wilcoxon_sign(ref, other, alpha=0.05):
    """Wilcoxon rank-sum test of `ref` (Quantum Swarm) against `other`.

    Returns '+' if ref is significantly better (lower), '-' if significantly
    worse and '=' otherwise, together with the p-value.
    """
    ref, other = np.asarray(ref, float), np.asarray(other, float)
    if np.allclose(ref, other):
        return "=", 1.0
    res = stats.ranksums(ref, other)
    p = float(res.pvalue)
    if p >= alpha:
        return "=", p
    return ("+" if res.statistic < 0 else "-"), p


def friedman(mean_table):
    """mean_table: dict algorithm -> list of mean fitness, one per function.

    Algorithms are ranked by mean fitness on each function (rank 1 is best,
    ties share the average rank); returns the average ranks and the p-value.
    """
    algs = list(mean_table)
    M = np.array([mean_table[a] for a in algs])          # (algorithms, functions)
    ranks = np.apply_along_axis(stats.rankdata, 0, M)
    p = float(stats.friedmanchisquare(*M).pvalue)
    return {a: float(r) for a, r in zip(algs, ranks.mean(axis=1))}, p

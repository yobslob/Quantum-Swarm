"""Visualisation module: draws the report figures from results/results.json.

    python experiments/make_figures.py
"""
import json
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from quantum_swarm import BENCHMARKS, quantum_swarm  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "results", "figures")
COLORS = {"Quantum Swarm": "#257de0", "QPSO": "#f47230", "GWO": "#00b894",
          "DE": "#f2a600", "PSO": "#ee7fac", "QS (ungated)": "#008a17"}
ORDER = ["PSO", "DE", "GWO", "QPSO", "QS (ungated)", "Quantum Swarm"]


def convergence(R, key, name):
    s = R["settings"][key]
    fig, axes = plt.subplots(2, 3, figsize=(13, 7.5))
    x = np.arange(0, R["meta"]["T"] + 1, R["meta"]["curve_step"])
    for ax, f in zip(axes.flat, s["functions"]):
        for a in ORDER:
            y = np.maximum(np.array(s["data"][f][a]["curve"]), 1e-300)
            ax.plot(x, y, color=COLORS[a], lw=2 if a == "Quantum Swarm" else 1.3, label=a)
        ax.set_yscale("log")
        ax.set_title(f)
        ax.set_xlabel("iteration")
        ax.grid(alpha=0.3)
    for ax in list(axes.flat)[len(s["functions"]):]:
        ax.axis("off")
    axes.flat[0].set_ylabel("median best fitness")
    axes.flat[0].legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, name), dpi=130)
    plt.close(fig)


def boxplots(R, key, name):
    s = R["settings"][key]
    fig, axes = plt.subplots(2, 3, figsize=(13, 7.5))
    for ax, f in zip(axes.flat, s["functions"]):
        data = [np.maximum(s["data"][f][a]["finals"], 1e-300) for a in ORDER]
        bp = ax.boxplot(data, patch_artist=True, tick_labels=["PSO", "DE", "GWO", "QPSO", "QS-u", "QS"])
        for patch, a in zip(bp["boxes"], ORDER):
            patch.set_facecolor(COLORS[a])
            patch.set_alpha(0.6)
        ax.set_yscale("log")
        ax.set_title(f)
        ax.grid(alpha=0.3)
    for ax in list(axes.flat)[len(s["functions"]):]:
        ax.axis("off")
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, name), dpi=130)
    plt.close(fig)


def traces(R):
    tr = R["traces"]["runs"]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4))
    for label, c in (("Ungated", COLORS["QS (ungated)"]), ("Gated", COLORS["Quantum Swarm"])):
        a1.plot(tr[label]["sdi"], color=c, label=label)
        a2.plot(tr[label]["alpha"], color=c, label=label, lw=1)
    a1.axhline(0.05, ls="--", color="gray", lw=1)
    a1.set_title("Swarm Diversity Index")
    a2.set_title("alpha")
    for ax in (a1, a2):
        ax.set_xlabel("iteration")
        ax.grid(alpha=0.3)
        ax.legend()
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "sdi_alpha_trace.png"), dpi=130)
    plt.close(fig)


def snapshots():
    b = BENCHMARKS["Rastrigin"]
    lo, hi = b.bounds(2)
    g = np.linspace(-5.12, 5.12, 300)
    XX, YY = np.meshgrid(g, g)
    Z = b(np.c_[XX.ravel(), YY.ravel()]).reshape(XX.shape)
    fig, axes = plt.subplots(1, 4, figsize=(16, 4.2))
    positions = {}

    def capture(f):
        # wrap f so we can see every evaluated swarm (positions after each update)
        def wrapped(X):
            positions[len(positions)] = X.copy()
            return f(X)
        return wrapped

    quantum_swarm(capture(b), lo, hi, 30, 200, seed=3)
    for ax, it in zip(axes, (0, 10, 40, 150)):
        ax.contourf(XX, YY, Z, levels=30, cmap="Blues_r")
        P = positions[it]
        ax.plot(0, 0, marker="*", ms=16, color="black", zorder=2)
        ax.scatter(P[:, 0], P[:, 1], s=18, c="#f47230", edgecolors="white", linewidths=0.6, zorder=3)
        ax.set_title(f"iteration {it}")
        ax.set_xlim(-5.12, 5.12)
        ax.set_ylim(-5.12, 5.12)
        ax.set_aspect("equal")
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "particles_rastrigin_2d.png"), dpi=130)
    plt.close(fig)


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(ROOT, "results", "results.json")) as fh:
        R = json.load(fh)
    convergence(R, "classical_d30", "convergence_d30.png")
    convergence(R, "shifted_d30", "convergence_shifted_d30.png")
    boxplots(R, "classical_d30", "boxplots_d30.png")
    traces(R)
    snapshots()
    print("figures written to", os.path.relpath(OUT))


if __name__ == "__main__":
    main()

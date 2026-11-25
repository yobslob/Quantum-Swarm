"""Quantum Swarm: an adaptive quantum-inspired swarm optimisation algorithm."""
from .baselines import de, gwo, pso
from .benchmarks import BENCHMARKS, SHIFTABLE, get
from .quantum_swarm import QSParams, qpso, quantum_swarm, quantum_swarm_ungated

ALGORITHMS = {
    "PSO": pso,
    "DE": de,
    "GWO": gwo,
    "QPSO": qpso,
    "QS (ungated)": quantum_swarm_ungated,
    "Quantum Swarm": quantum_swarm,
}

__all__ = ["ALGORITHMS", "BENCHMARKS", "SHIFTABLE", "QSParams", "get",
           "pso", "de", "gwo", "qpso", "quantum_swarm", "quantum_swarm_ungated"]

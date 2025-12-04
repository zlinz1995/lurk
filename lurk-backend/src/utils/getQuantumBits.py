from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
import sys

# Number of bits requested from Node
n = int(sys.argv[1])

# Build a quantum circuit with n qubits
qc = QuantumCircuit(n, n)
qc.h(range(n))     # Put every qubit into superposition
qc.measure(range(n), range(n))

# Run on Aer simulator
sim = AerSimulator()
result = sim.run(qc).result()

# Qiskit returns a dict like {"010110...": 1}
bitstring = list(result.get_counts().keys())[0]

# Return ONLY the bitstring so Node can parse it
print(bitstring)

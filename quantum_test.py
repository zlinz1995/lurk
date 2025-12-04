from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator

# Create simulator backend
sim = AerSimulator()

# Build a simple quantum circuit
qc = QuantumCircuit(1, 1)
qc.h(0)
qc.measure(0, 0)

# Run the circuit
result = sim.run(qc, shots=1000).result()

print(result.get_counts())
input("Press Enter to exit...")

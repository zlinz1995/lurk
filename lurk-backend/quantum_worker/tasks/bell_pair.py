from qiskit import QuantumCircuit

def build_circuit():
    qc = QuantumCircuit(2, 2)

    # Create Bell state (entangled qubits)
    qc.h(0)
    qc.cx(0, 1)

    # Measure
    qc.measure([0, 1], [0, 1])

    return qc

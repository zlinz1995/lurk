from qiskit import QuantumCircuit

def build_circuit():
    qc = QuantumCircuit(1, 1)

    # Put the qubit into superposition
    qc.h(0)

    # Measure it
    qc.measure(0, 0)

    return qc

from qiskit_aer import Aer
from qiskit import transpile

class QuantumWorker:
    def __init__(self, backend_name="aer_simulator", shots=1024):
        self.backend = Aer.get_backend(backend_name)
        self.shots = shots

    def run(self, circuit):
        """Execute a QuantumCircuit and return measurement counts."""

        # Compile the circuit for the simulator
        compiled = transpile(circuit, self.backend)

        # Run it
        job = self.backend.run(compiled, shots=self.shots)
        result = job.result()

        return result.get_counts()

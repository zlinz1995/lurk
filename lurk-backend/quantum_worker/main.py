from worker import QuantumWorker
from tasks.random_bit import build_circuit

def main():
    worker = QuantumWorker(shots=1000)

    circuit = build_circuit()
    results = worker.run(circuit)

    print("Random quantum bit:", results)

if __name__ == "__main__":
    main()

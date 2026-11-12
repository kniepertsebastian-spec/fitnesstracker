import { freeExerciseDbAdapter } from "./freeExerciseDb.adapter.js";
// Add new adapters here as they're built — this list is the single place that wires a new
// source into the import endpoint.
const adapters = [freeExerciseDbAdapter];
export function getSourceAdapter(name) {
    return adapters.find((adapter) => adapter.name === name);
}
export function listSourceNames() {
    return adapters.map((adapter) => adapter.name);
}
//# sourceMappingURL=index.js.map
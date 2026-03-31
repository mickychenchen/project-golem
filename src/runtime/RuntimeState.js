'use strict';

let managedProcessRegistry = null;
let runtimeController = null;
let memoryPressureGuard = null;

function setManagedProcessRegistry(registry) {
    managedProcessRegistry = registry || null;
}

function getManagedProcessRegistry() {
    return managedProcessRegistry;
}

function setRuntimeController(controller) {
    runtimeController = controller || null;
}

function getRuntimeController() {
    return runtimeController;
}

function setMemoryPressureGuard(guard) {
    memoryPressureGuard = guard || null;
}

function getMemoryPressureGuard() {
    return memoryPressureGuard;
}

module.exports = {
    setManagedProcessRegistry,
    getManagedProcessRegistry,
    setRuntimeController,
    getRuntimeController,
    setMemoryPressureGuard,
    getMemoryPressureGuard,
};

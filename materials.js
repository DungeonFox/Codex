let t = THREE;

export function createSubCubeMaterial() {
    return new t.MeshBasicMaterial({ wireframe: true, vertexColors: true });
}

export function createCubeMaterial(color) {
    return new t.MeshBasicMaterial({ color, wireframe: true });
}

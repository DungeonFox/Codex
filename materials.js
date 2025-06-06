let t = THREE;

export function createSubCubeMaterial() {
    // Use vertex colors per instance so each sub-cube can be uniquely tinted
    return new t.MeshBasicMaterial({ vertexColors: true });
}

export function createCubeMaterial(color) {
    return new t.MeshBasicMaterial({ color, wireframe: true });
}

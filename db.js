export async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('CubeDB', 2);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('cubes')) {
                const cubeStore = db.createObjectStore('cubes', { keyPath: 'id' });
                cubeStore.createIndex('windowUID', 'windowUID', { unique: false });
            }
            if (!db.objectStoreNames.contains('subcubes')) {
                const subStore = db.createObjectStore('subcubes', { keyPath: 'id' });
                subStore.createIndex('cubeId', 'cubeId', { unique: false });
                subStore.createIndex('windowUID', 'windowUID', { unique: false });
            }
            if (!db.objectStoreNames.contains('vertices')) {
                const vertStore = db.createObjectStore('vertices', { keyPath: 'id' });
                vertStore.createIndex('subCubeId', 'subCubeId', { unique: false });
                vertStore.createIndex('cubeId', 'cubeId', { unique: false });
                vertStore.createIndex('windowUID', 'windowUID', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveCube(db, windowUID, cubeId, center, subIds, vertexEntries) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('cubes', 'readwrite');
        const store = tx.objectStore('cubes');
        const value = [center, subIds, vertexEntries];
        store.put({ id: cubeId, windowUID, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadCubes(db, windowUID) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('cubes', 'readonly');
        const store = tx.objectStore('cubes');
        const index = store.index('windowUID');
        const req = index.getAll(IDBKeyRange.only(windowUID));
        req.onsuccess = () => resolve(req.result.map(r => ({
            id: r.id,
            windowUID: r.windowUID,
            center: r.value ? r.value[0] : null,
            subIds: r.value ? r.value[1] : [],
            vertexEntries: r.value ? r.value[2] : []
        })));
        req.onerror = () => reject(req.error);
    });
}

export async function saveSubCube(db, windowUID, cubeId, subId, center, blendId, vertexIds) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('subcubes', 'readwrite');
        const store = tx.objectStore('subcubes');
        store.put({
            id: subId,
            windowUID,
            cubeId,
            center,
            originID: cubeId,
            blendingLogicId: blendId,
            vertexIds
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadSubCubes(db, windowUID, cubeId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('subcubes', 'readonly');
        const store = tx.objectStore('subcubes');
        const index = store.index('cubeId');
        const req = index.getAll(IDBKeyRange.only(cubeId));
        req.onsuccess = () => resolve(req.result
            .filter(r => r.windowUID === windowUID)
            .map(r => ({
                id: r.id,
                cubeId: r.cubeId,
                windowUID: r.windowUID,
                center: r.center,
                originID: r.originID,
                blendingLogicId: r.blendingLogicId,
                vertexIds: r.vertexIds || []
            }))
        );
        req.onerror = () => reject(req.error);
    });
}

export async function saveVertex(db, windowUID, cubeId, subId, index, color, position, blendId, weight) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('vertices', 'readwrite');
        const store = tx.objectStore('vertices');
        const id = `${subId}_${index}`;
        const value = [color, position, blendId, weight];
        store.put({ id, windowUID, cubeId, subCubeId: subId, index, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadVertices(db, windowUID, cubeId, subId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('vertices', 'readonly');
        const store = tx.objectStore('vertices');
        const index = store.index('subCubeId');
        const req = index.getAll(IDBKeyRange.only(subId));
        req.onsuccess = () => resolve(req.result.filter(r => r.windowUID === windowUID && r.cubeId === cubeId).map(r => ({
            id: r.id,
            index: r.index,
            subCubeId: r.subCubeId,
            cubeId: r.cubeId,
            windowUID: r.windowUID,
            color: r.value ? r.value[0] : null,
            position: r.value ? r.value[1] : null,
            blendingLogicId: r.value ? r.value[2] : null,
            weight: r.value ? r.value[3] : null
        })));
        req.onerror = () => reject(req.error);
    });
}


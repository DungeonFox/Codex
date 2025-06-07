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

export async function saveCube(db, windowUID, cubeId, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('cubes', 'readwrite');
        const store = tx.objectStore('cubes');
        store.put({ id: cubeId, windowUID, data });
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
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveSubCube(db, windowUID, cubeId, row, col, layer, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('subcubes', 'readwrite');
        const store = tx.objectStore('subcubes');
        const id = `${cubeId}_${row}_${col}_${layer}`;
        store.put({ id, windowUID, cubeId, row, col, layer, data });
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
        req.onsuccess = () => resolve(req.result.filter(r => r.windowUID === windowUID));
        req.onerror = () => reject(req.error);
    });
}

export async function saveVertex(db, windowUID, cubeId, subId, index, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('vertices', 'readwrite');
        const store = tx.objectStore('vertices');
        const id = `${subId}_${index}`;
        store.put({ id, windowUID, cubeId, subCubeId: subId, index, data });
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
        req.onsuccess = () => resolve(req.result.filter(r => r.windowUID === windowUID && r.cubeId === cubeId));
        req.onerror = () => reject(req.error);
    });
}


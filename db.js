export async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('CubeDB', 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('cubes')) {
                const cubeStore = db.createObjectStore('cubes', { keyPath: ['windowUID','id'] });
                cubeStore.createIndex('windowUID', 'windowUID', { unique: false });
            }
            if (!db.objectStoreNames.contains('subcubes')) {
                const subStore = db.createObjectStore('subcubes', { keyPath: ['windowUID','cubeId','row','col','layer'] });
                subStore.createIndex('windowUID', 'windowUID', { unique: false });
            }
            if (!db.objectStoreNames.contains('vertices')) {
                const vertStore = db.createObjectStore('vertices', { keyPath: ['windowUID','cubeId','subId','index'] });
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
        store.put({ windowUID, id: cubeId, ...data });
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
        store.put({ windowUID, cubeId, row, col, layer, ...data });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadSubCubes(db, windowUID, cubeId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('subcubes', 'readonly');
        const store = tx.objectStore('subcubes');
        const keyRange = IDBKeyRange.bound([windowUID,cubeId,0,0,0], [windowUID,cubeId,Infinity,Infinity,Infinity]);
        const req = store.getAll(keyRange);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveVertex(db, windowUID, cubeId, subId, index, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('vertices', 'readwrite');
        const store = tx.objectStore('vertices');
        store.put({ windowUID, cubeId, subId, index, ...data });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadVertices(db, windowUID, cubeId, subId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('vertices', 'readonly');
        const store = tx.objectStore('vertices');
        const keyRange = IDBKeyRange.bound([windowUID,cubeId,subId,0], [windowUID,cubeId,subId,Infinity]);
        const req = store.getAll(keyRange);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}


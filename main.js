import WindowManager from './WindowManager.js'
import GPUComputationRenderer from './GPUComputationRenderer.js'
import { createColorShader } from './computeShader.js'
import { createSubCubeMaterial, createCubeMaterial } from './materials.js'



let t = THREE;
let camera, scene, renderer, world;
let near, far;
let pixR = window.devicePixelRatio ? window.devicePixelRatio : 1;
let cubes = [];
let gui;
let thisWindowId;
let gpu;
let colorVar;
let colorTexSize = {x: 1, y: 1};
let colorTexture;
let cubeControls = {
    width: 150,
    height: 150,
    depth: 150,
    subDepth: 2,
    rows: 2,
    columns: 2,
    posX: 0,
    posY: 0,
    velocityX: 0,
    velocityY: 0,
    color: '#ff0000',
    subColor: '#ff0000',
    matchDepth: false,
    animate: true,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    selRow: 0,
    selCol: 0,
    selLayer: 0,
    selColor: '#ff0000'
};

let globalSettings = {
    animate: cubeControls.animate,
    rotX: cubeControls.rotX,
    rotY: cubeControls.rotY,
    rotZ: cubeControls.rotZ
};

function indexToCoord(index, count) {
    let half = (count - 1) / 2;
    return index - half;
}

function coordToIndex(coord, count) {
    let half = (count - 1) / 2;
    let idx = Math.round(coord + half);
    return Math.min(count - 1, Math.max(0, idx));
}

function createLineCubeGeometry(w, h, d) {
    let hw = w / 2;
    let hh = h / 2;
    let hd = d / 2;
    let corners = [
        new t.Vector3(-hw, -hh, -hd),
        new t.Vector3(hw, -hh, -hd),
        new t.Vector3(hw, hh, -hd),
        new t.Vector3(-hw, hh, -hd),
        new t.Vector3(-hw, -hh, hd),
        new t.Vector3(hw, -hh, hd),
        new t.Vector3(hw, hh, hd),
        new t.Vector3(-hw, hh, hd)
    ];
    let edges = [
        [0,1],[1,2],[2,3],[3,0],
        [4,5],[5,6],[6,7],[7,4],
        [0,4],[1,5],[2,6],[3,7]
    ];
    let path = new t.CurvePath();
    let lineVerts = [];
    for (let i = 0; i < edges.length; i++) {
        let a = edges[i][0];
        let b = edges[i][1];
        path.add(new t.LineCurve3(corners[a], corners[b]));
        lineVerts.push(corners[a].x, corners[a].y, corners[a].z);
        lineVerts.push(corners[b].x, corners[b].y, corners[b].z);
    }
    let pointVerts = [];
    for (let i = 0; i < corners.length; i++) {
        pointVerts.push(corners[i].x, corners[i].y, corners[i].z);
    }
    let lineGeom = new t.BufferGeometry();
    lineGeom.setAttribute('position', new t.Float32BufferAttribute(lineVerts, 3));
    let pointGeom = new t.BufferGeometry();
    pointGeom.setAttribute('position', new t.Float32BufferAttribute(pointVerts, 3));
    return { lineGeom, pointGeom, path };
}

let sceneOffsetTarget = {x: 0, y: 0};
let sceneOffset = {x: 0, y: 0};

let today = new Date();
today.setHours(0);
today.setMinutes(0);
today.setSeconds(0);
today.setMilliseconds(0);
today = today.getTime();

let internalTime = getTime();
let windowManager;
let initialized = false;

function loadGlobalSettings() {
    let stored = localStorage.getItem(`settings_${thisWindowId}`);
    if (stored) {
        try {
            let obj = JSON.parse(stored);
            if (typeof obj.animate === 'boolean') globalSettings.animate = obj.animate;
            if (typeof obj.rotX === 'number') globalSettings.rotX = obj.rotX;
            if (typeof obj.rotY === 'number') globalSettings.rotY = obj.rotY;
            if (typeof obj.rotZ === 'number') globalSettings.rotZ = obj.rotZ;
        } catch(e) {}
    }
    cubeControls.animate = globalSettings.animate;
    cubeControls.rotX = globalSettings.rotX;
    cubeControls.rotY = globalSettings.rotY;
    cubeControls.rotZ = globalSettings.rotZ;
}

function saveGlobalSettings() {
    globalSettings.animate = cubeControls.animate;
    globalSettings.rotX = cubeControls.rotX;
    globalSettings.rotY = cubeControls.rotY;
    globalSettings.rotZ = cubeControls.rotZ;
    localStorage.setItem(`settings_${thisWindowId}`, JSON.stringify(globalSettings));
}

// get time in seconds since beginning of the day (so that all windows use the same time)
function getTime ()
{
	return (new Date().getTime() - today) / 1000.0;
}


if (new URLSearchParams(window.location.search).get("clear"))
{
	localStorage.clear();
}
else
{
        // this code is essential to circumvent that some browsers preload the content of some pages before you actually hit the url
        document.addEventListener("visibilitychange", () =>
        {
                if (document.visibilityState != 'hidden' && !initialized)
                {
                        init();
                }
        });

        window.addEventListener('storage', (e) => {
                if (e.key === `settings_${thisWindowId}` && e.newValue) {
                        try {
                                let obj = JSON.parse(e.newValue);
                                globalSettings = Object.assign(globalSettings, obj);
                                cubeControls.animate = globalSettings.animate;
                                cubeControls.rotX = globalSettings.rotX;
                                cubeControls.rotY = globalSettings.rotY;
                                cubeControls.rotZ = globalSettings.rotZ;
                                updateAnimButton();
                        } catch(_) {}
                }
        });

	window.onload = () => {
		if (document.visibilityState != 'hidden')
		{
			init();
		}
	};

        function init ()
        {
                initialized = true;

                // add a short timeout because window.offsetX reports wrong values before a short period
                setTimeout(() => {
                        setupWindowManager();
                        loadGlobalSettings();
                        updateAnimButton();
                        windowManager.getThisWindowData().metaData.animate = cubeControls.animate;
                        windowManager.getThisWindowData().metaData.rotX = cubeControls.rotX;
                        windowManager.getThisWindowData().metaData.rotY = cubeControls.rotY;
                        windowManager.getThisWindowData().metaData.rotZ = cubeControls.rotZ;
                        windowManager.updateWindowsLocalStorage();
                        setupScene();
                        setupGUI();
                        setupControls();
                        windowsUpdated();
                        resize();
                        updateWindowShape(false);
                        render();
                        window.addEventListener('resize', resize);
                }, 500)
        }

        function setupScene ()
        {
                camera = new t.OrthographicCamera(0, 0, window.innerWidth, window.innerHeight, -10000, 10000);
		
		camera.position.z = 2.5;
		near = camera.position.z - .5;
		far = camera.position.z + 0.5;

		scene = new t.Scene();
		scene.background = new t.Color(0.0);
		scene.add( camera );

		renderer = new t.WebGLRenderer({antialias: true, depthBuffer: true});
		renderer.setPixelRatio(pixR);
	    
	  	world = new t.Object3D();
		scene.add(world);

                renderer.domElement.setAttribute("id", "scene");
                document.body.appendChild( renderer.domElement );
        }

        function initGPU(count) {
                let needed = Math.ceil(Math.sqrt(count));

                if (gpu && gpu.sizeX >= needed && gpu.sizeY >= needed) {
                        // Existing GPU renderer is large enough; just update tex size reference
                        colorTexSize = { x: gpu.sizeX, y: gpu.sizeY };
                        return;
                }

                colorTexSize = { x: needed, y: needed };
                gpu = new GPUComputationRenderer(needed, needed, renderer);
                colorTexture = gpu.createTexture();
                colorVar = gpu.addVariable('colorTex', createColorShader(), colorTexture);
                colorVar.material.uniforms.time = { value: 0 };
                let err = gpu.init();
                if (err) console.error(err);
        }

        let selRowCtrl, selColCtrl, selLayerCtrl;

        function setupGUI ()
        {
                gui = new dat.GUI();
                gui.add(cubeControls, 'width', 50, 300, 10).onChange(updateCubeSize);
                gui.add(cubeControls, 'height', 50, 300, 10).onChange(updateCubeSize);
                gui.add(cubeControls, 'depth', 50, 300, 10).onChange(updateCubeSize);
                gui.add(cubeControls, 'rows', 1, 10, 1).onChange(() => { updateSubCubeLayout(); refreshSelectionControllers(); });
                gui.add(cubeControls, 'columns', 1, 10, 1).onChange(() => { updateSubCubeLayout(); refreshSelectionControllers(); });
                gui.add(cubeControls, 'subDepth', 1, 10, 1).onChange(() => { updateCubeSize(); updateSubCubeLayout(); refreshSelectionControllers(); });
                gui.add(cubeControls, 'posX', -300, 300, 1);
                gui.add(cubeControls, 'posY', -300, 300, 1);
                gui.add(cubeControls, 'velocityX', -10, 10, 0.1);
                gui.add(cubeControls, 'velocityY', -10, 10, 0.1);
                gui.addColor(cubeControls, 'color').onChange(updateCubeColor);
                gui.addColor(cubeControls, 'subColor').onChange(updateSubCubeColor);
                gui.add(cubeControls, 'matchDepth').onChange(updateCubeSize);
                gui.add(cubeControls, 'animate').onChange(() => { updateAnimButton(); saveGlobalSettings(); });
                gui.add(cubeControls, 'rotX', 0, Math.PI * 2, 0.1).onChange(updateRotation);
                gui.add(cubeControls, 'rotY', 0, Math.PI * 2, 0.1).onChange(updateRotation);
                gui.add(cubeControls, 'rotZ', 0, Math.PI * 2, 0.1).onChange(updateRotation);
                selRowCtrl = gui.add(cubeControls, 'selRow', indexToCoord(0, cubeControls.rows), indexToCoord(cubeControls.rows - 1, cubeControls.rows), 1).onChange(updateSelectedSubCubeColor);
                selColCtrl = gui.add(cubeControls, 'selCol', indexToCoord(0, cubeControls.columns), indexToCoord(cubeControls.columns - 1, cubeControls.columns), 1).onChange(updateSelectedSubCubeColor);
                selLayerCtrl = gui.add(cubeControls, 'selLayer', indexToCoord(0, cubeControls.subDepth), indexToCoord(cubeControls.subDepth - 1, cubeControls.subDepth), 1).onChange(updateSelectedSubCubeColor);
                gui.addColor(cubeControls, 'selColor').onChange(updateSelectedSubCubeColor);
        }

        function setupControls() {
                let fileInput = document.getElementById('colorFile');
                let toggleBtn = document.getElementById('toggleGUI');
                let animBtn = document.getElementById('toggleAnim');
                if (fileInput) {
                        fileInput.addEventListener('input', async (e) => {
                                let f = e.target.files[0];
                                if (!f) return;
                                let text = await f.text();
                                try {
                                        let data = JSON.parse(text);
                                        applyColorData(data);
                                } catch(err) {
                                        console.error('invalid color file');
                                }
                        });
                }

                if (toggleBtn) {
                        toggleBtn.addEventListener('click', toggleGUI);
                }

                if (animBtn) {
                        animBtn.addEventListener('click', toggleAnimation);
                        updateAnimButton();
                }

                window.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') toggleGUI();
                        if (e.key === 'p') toggleAnimation();
                });
        }

        function toggleGUI() {
                if (gui && gui.domElement) {
                        let d = gui.domElement.style.display === 'none' ? 'block' : 'none';
                        gui.domElement.style.display = d;
                }
        }

        function toggleAnimation() {
                cubeControls.animate = !cubeControls.animate;
                updateAnimButton();
                saveGlobalSettings();
                let wins = windowManager ? windowManager.getWindows() : [];
                cubes.forEach((cube, idx) => {
                        if (cube.userData.winId === thisWindowId && wins[idx] && wins[idx].metaData) {
                                wins[idx].metaData.animate = cubeControls.animate;
                                cube.userData.metaData = wins[idx].metaData;
                        }
                });
                if (windowManager) windowManager.updateWindowsLocalStorage();
        }

        function updateAnimButton() {
                let btn = document.getElementById('toggleAnim');
                if (btn) btn.textContent = cubeControls.animate ? 'Pause Anim' : 'Resume Anim';
        }

        function refreshSelectionControllers ()
        {
                if (selRowCtrl) {
                        selRowCtrl.min(indexToCoord(0, cubeControls.rows));
                        selRowCtrl.max(indexToCoord(cubeControls.rows - 1, cubeControls.rows));
                        if (cubeControls.selRow < indexToCoord(0, cubeControls.rows) || cubeControls.selRow > indexToCoord(cubeControls.rows - 1, cubeControls.rows)) {
                                cubeControls.selRow = 0;
                                selRowCtrl.updateDisplay();
                        }
                }
                if (selColCtrl) {
                        selColCtrl.min(indexToCoord(0, cubeControls.columns));
                        selColCtrl.max(indexToCoord(cubeControls.columns - 1, cubeControls.columns));
                        if (cubeControls.selCol < indexToCoord(0, cubeControls.columns) || cubeControls.selCol > indexToCoord(cubeControls.columns - 1, cubeControls.columns)) {
                                cubeControls.selCol = 0;
                                selColCtrl.updateDisplay();
                        }
                }
                if (selLayerCtrl) {
                        selLayerCtrl.min(indexToCoord(0, cubeControls.subDepth));
                        selLayerCtrl.max(indexToCoord(cubeControls.subDepth - 1, cubeControls.subDepth));
                        if (cubeControls.selLayer < indexToCoord(0, cubeControls.subDepth) || cubeControls.selLayer > indexToCoord(cubeControls.subDepth - 1, cubeControls.subDepth)) {
                                cubeControls.selLayer = 0;
                                selLayerCtrl.updateDisplay();
                        }
                }
        }

	function setupWindowManager ()
	{
                windowManager = new WindowManager();
                windowManager.setWinShapeChangeCallback(updateWindowShape);
                windowManager.setWinChangeCallback(windowsUpdated);

                // add custom metadata so each window can store its own colour and sub-cube colours
                let metaData = {
                        color: cubeControls.color,
                        subColors: {},
                        animate: cubeControls.animate,
                        rotX: cubeControls.rotX,
                        rotY: cubeControls.rotY,
                        rotZ: cubeControls.rotZ
                };

                // initialise window manager and register this window
                windowManager.init(metaData);

                // expose id and colour on the DOM for persistence
                thisWindowId = windowManager.getThisWindowID();
                document.body.dataset.idWindow = thisWindowId;
                document.body.dataset.idColor = metaData.color;

                // first update happens after loading stored settings
	}

	function windowsUpdated ()
	{
		updateNumberOfCubes();
	}

        function updateNumberOfCubes ()
        {
                let wins = windowManager.getWindows();

                // keep DOM data attributes in sync with this window's metadata
                let selfData = windowManager.getThisWindowData();
                if (selfData && selfData.metaData) {
                        document.body.dataset.idColor = selfData.metaData.color;
                }

		// remove all cubes
		cubes.forEach((c) => {
			world.remove(c);
		})

		cubes = [];

                // add new cubes based on the current window setup
                for (let i = 0; i < wins.length; i++)
                {
                        let win = wins[i];

                        let baseDepth = cubeControls.depth;
                        if (cubeControls.matchDepth) baseDepth = (cubeControls.width / cubeControls.columns) * cubeControls.subDepth;
                        let color = cubeControls.color;
                        if (win.metaData && win.metaData.color) color = win.metaData.color;
                        let cube = new t.Mesh(
                                new t.BoxBufferGeometry(cubeControls.width, cubeControls.height, baseDepth),
                                createCubeMaterial(color)
                        );
                        cube.userData.winId = win.id;
                        cube.userData.metaData = win.metaData || {
                                color: color,
                                subColors: {},
                                animate: cubeControls.animate,
                                rotX: cubeControls.rotX,
                                rotY: cubeControls.rotY,
                                rotZ: cubeControls.rotZ
                        };
                        cube.position.x = win.shape.x + (win.shape.w * .5);
                        cube.position.y = win.shape.y + (win.shape.h * .5);

                        createSubCubeGrid(cube, baseDepth);

                        world.add(cube);
                        cubes.push(cube);
                }
        }

        function updateCubeSize ()
        {
                cubes.forEach((cube) => {
                        cube.geometry.dispose();
                        let baseDepth = cubeControls.depth;
                        if (cubeControls.matchDepth) baseDepth = (cubeControls.width / cubeControls.columns) * cubeControls.subDepth;
                        cube.geometry = new t.BoxBufferGeometry(cubeControls.width, cubeControls.height, baseDepth);
                        cube.material.color.set(cubeControls.color);
                        cube.material.needsUpdate = true;
                        createSubCubeGrid(cube, baseDepth);
                });
                updateSubCubeColor();
                updateSelectedSubCubeColor();
                windowManager.updateWindowsLocalStorage();
        }

       function updateCubeColor ()
       {
                let wins = windowManager.getWindows();
                cubes.forEach((cube, idx) => {
                        if (cube.userData.winId === thisWindowId) {
                                cube.material.color.set(cubeControls.color);
                                let win = wins[idx];
                                if (win && win.metaData) {
                                        win.metaData.color = cubeControls.color;
                                        cube.userData.metaData = win.metaData;
                                }
                                document.body.dataset.idColor = cubeControls.color;
                        }
                });
                windowManager.updateWindowsLocalStorage();
       }

       function updateSubCubeColor ()
       {
               cubes.forEach((cube) => {
                       if (cube.userData.winId === thisWindowId && cube.userData.subGroup) {
                               let color = new t.Color(cubeControls.subColor);
                               let idx = 0;
                               cube.userData.subGroup.children.forEach(g => {
                                       g.children.forEach(obj => { obj.material.color.copy(color); });
                                       if (cube.userData.colorBuffer && cube.userData.colorBuffer.length > idx * 3 + 2) {
                                               cube.userData.colorBuffer[idx * 3] = color.r;
                                               cube.userData.colorBuffer[idx * 3 + 1] = color.g;
                                               cube.userData.colorBuffer[idx * 3 + 2] = color.b;
                                       }
                                       idx++;
                               });

                               if (!cube.userData.metaData.subColors) cube.userData.metaData.subColors = {};
                               let rows = Math.max(1, cubeControls.rows | 0);
                               let cols = Math.max(1, cubeControls.columns | 0);
                               let layers = Math.max(1, cubeControls.subDepth | 0);
                               for (let d = 0; d < layers; d++) {
                                       for (let r = 0; r < rows; r++) {
                                               for (let c = 0; c < cols; c++) {
                                                       let key = `${r}_${c}_${d}`;
                                                       cube.userData.metaData.subColors[key] = cubeControls.subColor;
                                               }
                                       }
                               }
                       }
               });
               windowManager.updateWindowsLocalStorage();
       }

       function updateRotation() {
                cubes.forEach((cube) => {
                        if (cube.userData.winId === thisWindowId) {
                                let md = cube.userData.metaData || {};
                                md.rotX = cubeControls.rotX;
                                md.rotY = cubeControls.rotY;
                                md.rotZ = cubeControls.rotZ;
                                cube.userData.metaData = md;
                        }
                });
                saveGlobalSettings();
                windowManager.updateWindowsLocalStorage();
       }

       function updateSelectedSubCubeColor () {
               // color the currently selected sub-cube given row, column and layer
               setSubCubeColor(
                       cubeControls.selRow,
                       cubeControls.selCol,
                       cubeControls.selLayer,
                       cubeControls.selColor
               );
       }

       // Set the colour of a particular sub-cube addressed by row, column and layer.
       // Coordinates are centered so that 0 is the middle row/column/layer.
       function setSubCubeColor(row, col, layer, colorStr) {
               cubes.forEach((cube) => {
                       if (cube.userData.winId === thisWindowId && cube.userData.subGroup) {
                               applyColorToSubCube(cube, row, col, layer, colorStr);
                       }
               });
               windowManager.updateWindowsLocalStorage();
       }

       // expose helper for external scripts or console
       window.setSubCubeColor = setSubCubeColor;

       function applyColorToSubCube(cube, row, col, layer, colorStr) {
               let m = cube.userData.subMatrix;
               let layers = m.length;
               let rows = m[0].length;
               let cols = m[0][0].length;
               let d = coordToIndex(layer, layers);
               let r = coordToIndex(row, rows);
               let c = coordToIndex(col, cols);
               if (m && m[d] && m[d][r] && m[d][r][c]) {
                       let group = m[d][r][c];
                       let color = new t.Color(colorStr);
                       group.children.forEach(obj => obj.material.color.copy(color));
                       let bufferIndex = d * rows * cols + r * cols + c;
                       if (cube.userData.colorBuffer && cube.userData.colorBuffer.length > bufferIndex * 3 + 2) {
                               cube.userData.colorBuffer[bufferIndex * 3] = color.r;
                               cube.userData.colorBuffer[bufferIndex * 3 + 1] = color.g;
                               cube.userData.colorBuffer[bufferIndex * 3 + 2] = color.b;
                       }
                       if (!cube.userData.metaData.subColors) cube.userData.metaData.subColors = {};
                       let key = `${r}_${c}_${d}`;
                       cube.userData.metaData.subColors[key] = colorStr;
               }
       }

       function applyColorData(arr) {
               cubes.forEach((cube) => {
                       if (cube.userData.subGroup) {
                               for (let i = 0; i < Math.min(cube.userData.subGroup.children.length, arr.length); i++) {
                                       let cval = arr[i];
                                       if (Array.isArray(cval) && cval.length >= 3) {
                                               let g = cube.userData.subGroup.children[i];
                                               g.children.forEach(obj => obj.material.color.setRGB(cval[0], cval[1], cval[2]));
                                               if (cube.userData.colorBuffer && cube.userData.colorBuffer.length > i * 3 + 2) {
                                                        cube.userData.colorBuffer[i * 3] = cval[0];
                                                        cube.userData.colorBuffer[i * 3 + 1] = cval[1];
                                                        cube.userData.colorBuffer[i * 3 + 2] = cval[2];
                                               }
                                       }
                               }
                       }
               });
       }

        function createSubCubeGrid (cube, baseDepth = cubeControls.depth)
        {
        if (cube.userData.subGroup) {
                cube.remove(cube.userData.subGroup);
                cube.userData.subGroup.children.forEach(ch => {
                        ch.traverse(obj => {
                                if (obj.geometry) obj.geometry.dispose();
                                if (obj.material) obj.material.dispose();
                        });
                });
        }

        cube.userData.subMatrix = [];
        cube.userData.subGroup = new t.Group();

        let rows = Math.max(1, cubeControls.rows | 0);
        let cols = Math.max(1, cubeControls.columns | 0);
        let layers = Math.max(1, cubeControls.subDepth | 0);

        let subW = cubeControls.width / cols;
        let subH = cubeControls.height / rows;
        let subD = baseDepth / layers;

        let count = rows * cols * layers;
        if (!gpu || (gpu.sizeX * gpu.sizeY) < count) {
                initGPU(count);
        } else {
                colorTexSize = { x: gpu.sizeX, y: gpu.sizeY };
        }

        let existingBuffer = cube.userData.colorBuffer && cube.userData.colorBuffer.length === count * 3;
        if (!existingBuffer) {
                cube.userData.colorBuffer = new Float32Array(count * 3);
        }

        let colors = cube.userData.colorBuffer;

        for (let d = 0; d < layers; d++) {
                cube.userData.subMatrix[d] = [];
                for (let r = 0; r < rows; r++) {
                        cube.userData.subMatrix[d][r] = [];
                        for (let c = 0; c < cols; c++) {
                                let idx = d * rows * cols + r * cols + c;
                                let colorSet = false;
                                if (cube.userData.metaData && cube.userData.metaData.subColors) {
                                        let key = `${r}_${c}_${d}`;
                                        if (cube.userData.metaData.subColors[key]) {
                                                let cval = new t.Color(cube.userData.metaData.subColors[key]);
                                                colors[idx * 3] = cval.r;
                                                colors[idx * 3 + 1] = cval.g;
                                                colors[idx * 3 + 2] = cval.b;
                                                colorSet = true;
                                        }
                                }
                                if (!colorSet && !existingBuffer) {
                                        let colObj = new t.Color(cubeControls.subColor);
                                        colors[idx * 3] = colObj.r;
                                        colors[idx * 3 + 1] = colObj.g;
                                        colors[idx * 3 + 2] = colObj.b;
                                }

                                let { lineGeom, pointGeom } = createLineCubeGeometry(subW, subH, subD);
                                let mat = new t.LineBasicMaterial({
                                        transparent: true,
                                        blending: t.AdditiveBlending,
                                        depthWrite: false
                                });
                                mat.color.fromArray(colors, idx * 3);
                                let line = new t.LineSegments(lineGeom, mat);
                                let pMat = new t.PointsMaterial({
                                        size: 4,
                                        sizeAttenuation: false,
                                        transparent: true,
                                        blending: t.AdditiveBlending,
                                        depthWrite: false
                                });
                                pMat.color.fromArray(colors, idx * 3);
                                let points = new t.Points(pointGeom, pMat);
                                let container = new t.Group();
                                container.add(line);
                                container.add(points);
                                container.position.set(
                                        -cubeControls.width / 2 + subW * (c + 0.5),
                                        -cubeControls.height / 2 + subH * (r + 0.5),
                                        -baseDepth / 2 + subD * (d + 0.5)
                                );
                                cube.userData.subGroup.add(container);

                                cube.userData.subMatrix[d][r][c] = container;
                        }
                }
        }

        if (gpu && colorVar && (!cube.userData.metaData || !cube.userData.metaData.subColors || Object.keys(cube.userData.metaData.subColors).length === 0)) {
                colorVar.material.uniforms.time.value = internalTime;
                gpu.compute();
                let read = new Float32Array(colorTexSize.x * colorTexSize.y * 4);
                renderer.readRenderTargetPixels(gpu.getCurrentRenderTarget(colorVar), 0, 0, colorTexSize.x, colorTexSize.y, read);
                let idx = 0;
                cube.userData.subGroup.children.forEach(g => {
                        g.children.forEach(obj => obj.material.color.setRGB(read[idx], read[idx + 1], read[idx + 2]));
                        colors[(idx/4)*3] = read[idx];
                        colors[(idx/4)*3+1] = read[idx+1];
                        colors[(idx/4)*3+2] = read[idx+2];
                        idx += 4;
                });
        }

        cube.add(cube.userData.subGroup);
        }

        function updateSubCubeLayout ()
        {
                cubes.forEach((cube) => {
                        let baseDepth = cubeControls.depth;
                        if (cubeControls.matchDepth) baseDepth = (cubeControls.width / cubeControls.columns) * cubeControls.subDepth;
                        createSubCubeGrid(cube, baseDepth);
                });
                updateSubCubeColor();
                updateSelectedSubCubeColor();
                windowManager.updateWindowsLocalStorage();
        }

	function updateWindowShape (easing = true)
	{
		// storing the actual offset in a proxy that we update against in the render function
		sceneOffsetTarget = {x: -window.screenX, y: -window.screenY};
		if (!easing) sceneOffset = sceneOffsetTarget;
	}


        function render ()
        {
                let now = getTime();
                let deltaTime = now - internalTime;
                internalTime = now;

		windowManager.update();


		// calculate the new position based on the delta between current offset and new offset times a falloff value (to create the nice smoothing effect)
		let falloff = .05;
		sceneOffset.x = sceneOffset.x + ((sceneOffsetTarget.x - sceneOffset.x) * falloff);
		sceneOffset.y = sceneOffset.y + ((sceneOffsetTarget.y - sceneOffset.y) * falloff);

		// set the world position to the offset
		world.position.x = sceneOffset.x;
		world.position.y = sceneOffset.y;

                let wins = windowManager.getWindows();


                // loop through all our cubes and update their positions based on current window positions
                for (let i = 0; i < cubes.length; i++)
                {
                        let cube = cubes[i];
                        let win = wins[i];
                        let _t = internalTime;

                        let posTarget = {
                                x: win.shape.x + (win.shape.w * .5) + cubeControls.posX,
                                y: win.shape.y + (win.shape.h * .5) + cubeControls.posY
                        };

                        cube.position.x = cube.position.x + (posTarget.x - cube.position.x) * falloff;
                        cube.position.y = cube.position.y + (posTarget.y - cube.position.y) * falloff;

                        let md = cube.userData.metaData || {};
                        let animate = md.animate !== undefined ? md.animate : cubeControls.animate;
                        let rotX = md.rotX !== undefined ? md.rotX : cubeControls.rotX;
                        let rotY = md.rotY !== undefined ? md.rotY : cubeControls.rotY;
                        let rotZ = md.rotZ !== undefined ? md.rotZ : cubeControls.rotZ;

                        let cubeDt = animate ? deltaTime : 0;
                        cube.position.x += cubeControls.velocityX * cubeDt;
                        cube.position.y += cubeControls.velocityY * cubeDt;
                        cube.rotation.x = rotX + (animate ? _t * .5 : 0);
                        cube.rotation.y = rotY + (animate ? _t * .3 : 0);
                        cube.rotation.z = rotZ;
                }

                if (gpu && colorVar) {
                        colorVar.material.uniforms.time.value = internalTime;
                        gpu.compute();
                        let read = new Float32Array(colorTexSize.x * colorTexSize.y * 4);
                        renderer.readRenderTargetPixels(
                                gpu.getCurrentRenderTarget(colorVar),
                                0,
                                0,
                                colorTexSize.x,
                                colorTexSize.y,
                                read
                        );
                        cubes.forEach((cube) => {
                                if (
                                        cube.userData.subGroup &&
                                        (!cube.userData.metaData ||
                                                !cube.userData.metaData.subColors ||
                                                Object.keys(cube.userData.metaData.subColors).length === 0)
                                ) {
                                        let idx = 0;
                                        cube.userData.subGroup.children.forEach(g => {
                                                g.children.forEach(obj => obj.material.color.setRGB(read[idx], read[idx + 1], read[idx + 2]));
                                                if (cube.userData.colorBuffer && cube.userData.colorBuffer.length > (idx/4)*3 + 2) {
                                                        cube.userData.colorBuffer[(idx/4)*3] = read[idx];
                                                        cube.userData.colorBuffer[(idx/4)*3 + 1] = read[idx + 1];
                                                        cube.userData.colorBuffer[(idx/4)*3 + 2] = read[idx + 2];
                                                }
                                                idx += 4;
                                        });
                                }
                        });
                }

		renderer.render(scene, camera);
		requestAnimationFrame(render);
	}


	// resize the renderer to fit the window size
       function resize ()
       {
               let width = window.innerWidth;
               let height = window.innerHeight

               camera = new t.OrthographicCamera(0, width, 0, height, -10000, 10000);
               camera.updateProjectionMatrix();
               renderer.setSize( width, height );
       }
}

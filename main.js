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
    subDepth: 1,
    rows: 1,
    columns: 1,
    posX: 0,
    posY: 0,
    velocityX: 0,
    velocityY: 0,
    color: '#ff0000',
    subColor: '#ff0000',
    matchDepth: false,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    selRow: 0,
    selCol: 0,
    selLayer: 0,
    selColor: '#ff0000'
};

function indexToCoord (index, count) {
    return index - Math.floor(count / 2);
}

function coordToIndex (coord, count) {
    return coord + Math.floor(count / 2);
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
                        setupScene();
                        setupGUI();
                        setupControls();
                        setupWindowManager();
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
                let n = Math.ceil(Math.sqrt(count));
                colorTexSize = {x: n, y: n};
                gpu = new GPUComputationRenderer(n, n, renderer);
                colorTexture = gpu.createTexture();
                colorVar = gpu.addVariable('colorTex', createColorShader(), colorTexture);
                colorVar.material.uniforms.time = {value: 0};
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
                gui.add(cubeControls, 'rotX', 0, Math.PI * 2, 0.1);
                gui.add(cubeControls, 'rotY', 0, Math.PI * 2, 0.1);
                gui.add(cubeControls, 'rotZ', 0, Math.PI * 2, 0.1);
                selRowCtrl = gui.add(cubeControls, 'selRow', indexToCoord(0, cubeControls.rows), indexToCoord(cubeControls.rows - 1, cubeControls.rows), 1).onChange(updateSelectedSubCubeColor);
                selColCtrl = gui.add(cubeControls, 'selCol', indexToCoord(0, cubeControls.columns), indexToCoord(cubeControls.columns - 1, cubeControls.columns), 1).onChange(updateSelectedSubCubeColor);
                selLayerCtrl = gui.add(cubeControls, 'selLayer', indexToCoord(0, cubeControls.subDepth), indexToCoord(cubeControls.subDepth - 1, cubeControls.subDepth), 1).onChange(updateSelectedSubCubeColor);
                gui.addColor(cubeControls, 'selColor').onChange(updateSelectedSubCubeColor);
        }

        function setupControls() {
                let fileInput = document.getElementById('colorFile');
                let toggleBtn = document.getElementById('toggleGUI');
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

                window.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') toggleGUI();
                });
        }

        function toggleGUI() {
                if (gui && gui.domElement) {
                        let d = gui.domElement.style.display === 'none' ? 'block' : 'none';
                        gui.domElement.style.display = d;
                }
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
                let metaData = {color: cubeControls.color, subColors: {}};

                // initialise window manager and register this window
                windowManager.init(metaData);

                // expose id and colour on the DOM for persistence
                thisWindowId = windowManager.getThisWindowID();
                document.body.dataset.idWindow = thisWindowId;
                document.body.dataset.idColor = metaData.color;

                // call update windows initially (it will later be called by the win change callback)
                windowsUpdated();
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
                        cube.userData.metaData = win.metaData || {color: color, subColors: {}};
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
                        if (cube.userData.winId === thisWindowId && cube.userData.subMesh) {
                                let count = cube.userData.subMesh.count;
                                let color = new t.Color(cubeControls.subColor);
                                for (let i = 0; i < count; i++) {
                                        cube.userData.subMesh.setColorAt(i, color);
                                }
                                cube.userData.subMesh.instanceColor.needsUpdate = true;

                                if (!cube.userData.metaData.subColors) cube.userData.metaData.subColors = {};
                                let rows = Math.max(1, cubeControls.rows | 0);
                                let cols = Math.max(1, cubeControls.columns | 0);
                                let layers = Math.max(1, cubeControls.subDepth | 0);
                                for (let d = 0; d < layers; d++) {
                                        for (let r = 0; r < rows; r++) {
                                                for (let c = 0; c < cols; c++) {
                                                        let coord = {
                                                                x: indexToCoord(c, cols),
                                                                y: indexToCoord(r, rows),
                                                                z: indexToCoord(d, layers)
                                                        };
                                                        let key = `${coord.x}_${coord.y}_${coord.z}`;
                                                        cube.userData.metaData.subColors[key] = cubeControls.subColor;
                                                }
                                        }
                                }
                        }
                });
                windowManager.updateWindowsLocalStorage();
       }

       function updateSelectedSubCubeColor ()
       {
                cubes.forEach((cube) => {
                        if (cube.userData.winId === thisWindowId && cube.userData.subMesh) {
                                let m = cube.userData.subMatrix;
                                let d = coordToIndex(cubeControls.selLayer, cubeControls.subDepth);
                                let r = coordToIndex(cubeControls.selRow, cubeControls.rows);
                                let c = coordToIndex(cubeControls.selCol, cubeControls.columns);
                                if (m && m[d] && m[d][r] && m[d][r][c] !== undefined) {
                                        let idx = m[d][r][c];
                                        let color = new t.Color(cubeControls.selColor);
                                        cube.userData.subMesh.setColorAt(idx, color);
                                        cube.userData.subMesh.instanceColor.needsUpdate = true;
                                        if (!cube.userData.metaData.subColors) cube.userData.metaData.subColors = {};
                                        let key = `${cubeControls.selCol}_${cubeControls.selRow}_${cubeControls.selLayer}`;
                                        cube.userData.metaData.subColors[key] = cubeControls.selColor;
                                }
                        }
                });
               windowManager.updateWindowsLocalStorage();
       }

        function applyColorData(arr) {
                cubes.forEach((cube) => {
                        if (cube.userData.subMesh) {
                                let count = cube.userData.subMesh.count;
                                for (let i = 0; i < Math.min(count, arr.length); i++) {
                                        let cval = arr[i];
                                        if (Array.isArray(cval) && cval.length >= 3) {
                                                cube.userData.subMesh.instanceColor.array[i * 3] = cval[0];
                                                cube.userData.subMesh.instanceColor.array[i * 3 + 1] = cval[1];
                                                cube.userData.subMesh.instanceColor.array[i * 3 + 2] = cval[2];
                                        }
                                }
                                cube.userData.subMesh.instanceColor.needsUpdate = true;
                        }
                });
        }

        function createSubCubeGrid (cube, baseDepth = cubeControls.depth)
        {
                if (cube.userData.subMesh) {
                        cube.remove(cube.userData.subMesh);
                        cube.userData.subMesh.geometry.dispose();
                        cube.userData.subMesh.material.dispose();
                }

                cube.userData.subMatrix = [];

                let rows = Math.max(1, cubeControls.rows | 0);
                let cols = Math.max(1, cubeControls.columns | 0);
                let layers = Math.max(1, cubeControls.subDepth | 0);

                let subW = cubeControls.width / cols;
                let subH = cubeControls.height / rows;
                let subD = baseDepth / layers;

                let count = rows * cols * layers;
                if (!gpu) initGPU(count);
                let geometry = new t.BoxBufferGeometry(subW, subH, subD);
                let material = createSubCubeMaterial();
                let mesh = new t.InstancedMesh(geometry, material, count);
                mesh.instanceMatrix.setUsage(t.DynamicDrawUsage);

                let colors = new Float32Array(count * 3);
                let index = 0;

                for (let d = 0; d < layers; d++) {
                        cube.userData.subMatrix[d] = [];
                        for (let r = 0; r < rows; r++) {
                                cube.userData.subMatrix[d][r] = [];
                                for (let c = 0; c < cols; c++) {
                                        let coord = {
                                                x: indexToCoord(c, cols),
                                                y: indexToCoord(r, rows),
                                                z: indexToCoord(d, layers)
                                        };
                                        let color = cubeControls.subColor;
                                        if (cube.userData.metaData && cube.userData.metaData.subColors) {
                                                let key = `${coord.x}_${coord.y}_${coord.z}`;
                                                if (cube.userData.metaData.subColors[key]) color = cube.userData.metaData.subColors[key];
                                        }

                                        let colObj = new t.Color(color);
                                        colors[index * 3] = colObj.r;
                                        colors[index * 3 + 1] = colObj.g;
                                        colors[index * 3 + 2] = colObj.b;

                                        let matrix = new t.Matrix4();
                                        matrix.makeTranslation(
                                                -cubeControls.width / 2 + subW * (c + 0.5),
                                                -cubeControls.height / 2 + subH * (r + 0.5),
                                                -baseDepth / 2 + subD * (d + 0.5)
                                        );
                                        mesh.setMatrixAt(index, matrix);

                                        cube.userData.subMatrix[d][r][c] = index;
                                        index++;
                                }
                        }
                }

                mesh.instanceColor = new t.InstancedBufferAttribute(colors, 3);
                mesh.geometry.setAttribute('instanceColor', mesh.instanceColor);
                mesh.instanceColor.needsUpdate = true;
                if (gpu && colorVar) {
                        colorVar.material.uniforms.time.value = internalTime;
                        gpu.compute();
                        let read = new Float32Array(colorTexSize.x * colorTexSize.y * 4);
                        renderer.readRenderTargetPixels(gpu.getCurrentRenderTarget(colorVar), 0, 0, colorTexSize.x, colorTexSize.y, read);
                        for (let i = 0; i < count; i++) {
                                let idx = i * 4;
                                mesh.instanceColor.array[i * 3] = read[idx];
                                mesh.instanceColor.array[i * 3 + 1] = read[idx + 1];
                                mesh.instanceColor.array[i * 3 + 2] = read[idx + 2];
                        }
                        mesh.instanceColor.needsUpdate = true;
                }
                mesh.instanceMatrix.needsUpdate = true;

                cube.userData.subMesh = mesh;
                cube.add(mesh);
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
                let time = getTime();
                let dt = time - internalTime;
                internalTime = time;

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
                            let _t = time;// + i * .2;

                            let posTarget = {
                                    x: win.shape.x + (win.shape.w * .5) + cubeControls.posX,
                                    y: win.shape.y + (win.shape.h * .5) + cubeControls.posY
                            };

                            cube.position.x = cube.position.x + (posTarget.x - cube.position.x) * falloff;
                            cube.position.y = cube.position.y + (posTarget.y - cube.position.y) * falloff;
                            cube.position.x += cubeControls.velocityX * dt;
                            cube.position.y += cubeControls.velocityY * dt;
                            cube.rotation.x = cubeControls.rotX + _t * .5;
                    cube.rotation.y = cubeControls.rotY + _t * .3;
                    cube.rotation.z = cubeControls.rotZ;
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
                                        cube.userData.subMesh &&
                                        (!cube.userData.metaData ||
                                                !cube.userData.metaData.subColors ||
                                                Object.keys(cube.userData.metaData.subColors).length === 0)
                                ) {
                                        let count = cube.userData.subMesh.count;
                                        for (let i = 0; i < count; i++) {
                                                let idx = i * 4;
                                                cube.userData.subMesh.instanceColor.array[i * 3] = read[idx];
                                                cube.userData.subMesh.instanceColor.array[i * 3 + 1] = read[idx + 1];
                                                cube.userData.subMesh.instanceColor.array[i * 3 + 2] = read[idx + 2];
                                        }
                                        cube.userData.subMesh.instanceColor.needsUpdate = true;
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

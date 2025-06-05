import WindowManager from './WindowManager.js'



const t = THREE;
let camera, scene, renderer, world;
let near, far;
let pixR = window.devicePixelRatio ? window.devicePixelRatio : 1;
let cubes = [];
let gui;
let cubeControls = {
    width: 150,
    height: 150,
    subDepth: 150,
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
    rotZ: 0
};
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

        function setupGUI ()
        {
                gui = new dat.GUI();
                gui.add(cubeControls, 'width', 50, 300, 10).onChange(updateCubeSize);
                gui.add(cubeControls, 'height', 50, 300, 10).onChange(updateCubeSize);
                gui.add(cubeControls, 'rows', 1, 10, 1).onChange(updateSubCubeLayout);
                gui.add(cubeControls, 'columns', 1, 10, 1).onChange(updateSubCubeLayout);
                gui.add(cubeControls, 'subDepth', 10, 300, 10).onChange(() => { updateCubeSize(); updateSubCubeLayout(); });
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
        }

	function setupWindowManager ()
	{
		windowManager = new WindowManager();
		windowManager.setWinShapeChangeCallback(updateWindowShape);
		windowManager.setWinChangeCallback(windowsUpdated);

		// here you can add your custom metadata to each windows instance
		let metaData = {foo: "bar"};

		// this will init the windowmanager and add this window to the centralised pool of windows
		windowManager.init(metaData);

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

		// remove all cubes
		cubes.forEach((c) => {
			world.remove(c);
		})

		cubes = [];

                // add new cubes based on the current window setup
                for (let i = 0; i < wins.length; i++)
                {
                        let win = wins[i];

                        let depth = cubeControls.matchDepth ? cubeControls.subDepth : cubeControls.width;
                        let cube = new t.Mesh(
                                new t.BoxGeometry(cubeControls.width, cubeControls.height, depth),
                                new t.MeshBasicMaterial({color: cubeControls.color, wireframe: true})
                        );
                        cube.position.x = win.shape.x + (win.shape.w * .5);
                        cube.position.y = win.shape.y + (win.shape.h * .5);

                        createSubCubeGrid(cube);

                        world.add(cube);
                        cubes.push(cube);
                }
        }

       function updateCubeSize ()
       {
               cubes.forEach((cube) => {
                       cube.geometry.dispose();
                        let depth = cubeControls.matchDepth ? cubeControls.subDepth : cubeControls.width;
                        cube.geometry = new t.BoxGeometry(cubeControls.width, cubeControls.height, depth);
                        createSubCubeGrid(cube);
               });
       }

        function updateCubeColor ()
        {
                cubes.forEach((cube) => {
                        cube.material.color.set(cubeControls.color);
                });
        }

        function updateSubCubeColor ()
        {
                cubes.forEach((cube) => {
                        if (cube.userData.subCubes) {
                                cube.userData.subCubes.forEach((sc) => {
                                        sc.material.color.set(cubeControls.subColor);
                                });
                        }
                });
        }

        function createSubCubeGrid (cube)
        {
                if (!cube.userData.subCubes) cube.userData.subCubes = [];

                cube.userData.subCubes.forEach((sc) => {
                        cube.remove(sc);
                        sc.geometry.dispose();
                        sc.material.dispose();
                });
                cube.userData.subCubes = [];

                let rows = Math.max(1, cubeControls.rows | 0);
                let cols = Math.max(1, cubeControls.columns | 0);

                let subW = cubeControls.width / cols;
                let subH = cubeControls.height / rows;
                let subD = cubeControls.subDepth;

                for (let r = 0; r < rows; r++)
                {
                        for (let c = 0; c < cols; c++)
                        {
                                let sc = new t.Mesh(
                                        new t.BoxGeometry(subW, subH, subD),
                                        new t.MeshBasicMaterial({color: cubeControls.subColor, wireframe: true})
                                );
                                sc.position.x = -cubeControls.width / 2 + subW * (c + 0.5);
                                sc.position.y = -cubeControls.height / 2 + subH * (r + 0.5);
                                cube.add(sc);
                                cube.userData.subCubes.push(sc);
                        }
                }
        }

        function updateSubCubeLayout ()
        {
                cubes.forEach((cube) => {
                        createSubCubeGrid(cube);
                });
                updateSubCubeColor();
        }

	function updateWindowShape (easing = true)
	{
		// storing the actual offset in a proxy that we update against in the render function
		sceneOffsetTarget = {x: -window.screenX, y: -window.screenY};
		if (!easing) sceneOffset = sceneOffsetTarget;
	}


        function render ()
        {
                let t = getTime();
                let dt = t - internalTime;
                internalTime = t;

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
			let _t = t;// + i * .2;

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
                };

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
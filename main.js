import WindowManager from './WindowManager.js';

/* -------------------------------------------------- scene globals */
let t = THREE;                     // short-hand alias to THREE
let camera, scene, renderer, world;
let near, far;
const pixR   = window.devicePixelRatio || 1;
let cubes    = [];

/* ---------------------------- real-time, GUI-exposed parameters */
const cubeControls = {
  /* geometry */
  width:      150,
  height:     150,
  subDepth:   150,
  matchDepth: false,      // if true → cube.depth = subDepth

  /* sub-grid */
  rows:       1,
  columns:    1,

  /* base transform offsets / velocities */
  posX:       0,
  posY:       0,
  velocityX:  0,
  velocityY:  0,

  /* colours */
  color:      '#ff0000',
  subColor:   '#ff0000',

  /* global rotation */
  rotX:       0,
  rotY:       0,
  rotZ:       0,
};

/* ---------------------------- window & timing helpers */
let sceneOffsetTarget = { x: 0, y: 0 };
let sceneOffset       = { x: 0, y: 0 };

const midnight = new Date().setHours(0, 0, 0, 0);      // epoch for daily clock
let internalTime = getTimeSeconds();                    // seconds since midnight

function getTimeSeconds () { return (Date.now() - midnight) / 1000; }

/* ---------------------------- WindowManager */
let windowManager;
let initialized = false;

/* ================================================================ */
/* ▀▀  Entry points & bootstrap                                    ▀▀ */
if (new URLSearchParams(window.location.search).get('clear')) {
  localStorage.clear();
} else {
  /* many browsers pre-render hidden tabs – defer initialisation     */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' && !initialized) init();
  });

  window.onload = () => {
    if (document.visibilityState !== 'hidden') init();
  };
}

/* ================================================================ */
/* ███  INITIALISATION                                             ███ */
function init () {
  initialized = true;
  /* give the browser ~½ s to finish reporting correct window coords */
  setTimeout(() => {
    setupScene();
    setupGUI();
    setupWindowManager();
    resize();                       // initial sizing
    updateWindowShape(false);       // set initial scene offset
    render();                       // start the RAF loop
    window.addEventListener('resize', resize);
  }, 500);
}

/* ------------------------------------------------ scene creation */
function setupScene () {
  camera = new t.OrthographicCamera(
    0,             // left
    window.innerWidth,
    0,             // top
    window.innerHeight,
    -10_000,
    10_000
  );
  camera.position.z = 2.5;
  near = camera.position.z - 0.5;
  far  = camera.position.z + 0.5;

  scene = new t.Scene();
  scene.background = new t.Color(0x000000);
  scene.add(camera);

  renderer = new t.WebGLRenderer({ antialias: true, depthBuffer: true });
  renderer.setPixelRatio(pixR);
  renderer.domElement.id = 'scene';
  document.body.appendChild(renderer.domElement);

  world = new t.Object3D();
  scene.add(world);
}

/* ------------------------------------------------ dat.GUI */
function setupGUI () {
  gui = new dat.GUI();

  gui.add(cubeControls, 'width',      50, 300, 10).onChange(() => { updateCubeSize(); updateSubCubeLayout(); });
  gui.add(cubeControls, 'height',     50, 300, 10).onChange(() => { updateCubeSize(); updateSubCubeLayout(); });
  gui.add(cubeControls, 'subDepth',   10, 300, 10).onChange(updateCubeSize);

  gui.add(cubeControls, 'rows',       1,  10,  1).onChange(updateSubCubeLayout);
  gui.add(cubeControls, 'columns',    1,  10,  1).onChange(updateSubCubeLayout);
  gui.add(cubeControls, 'matchDepth').onChange(updateCubeSize);

  gui.add(cubeControls, 'posX',     -300, 300, 1);
  gui.add(cubeControls, 'posY',     -300, 300, 1);
  gui.add(cubeControls, 'velocityX', -10,  10, 0.1);
  gui.add(cubeControls, 'velocityY', -10,  10, 0.1);

  gui.addColor(cubeControls, 'color').onChange(updateCubeColor);
  gui.addColor(cubeControls, 'subColor').onChange(updateSubCubeColor);

  gui.add(cubeControls, 'rotX', 0, Math.PI * 2, 0.1);
  gui.add(cubeControls, 'rotY', 0, Math.PI * 2, 0.1);
  gui.add(cubeControls, 'rotZ', 0, Math.PI * 2, 0.1);
}

/* ------------------------------------------------ WindowManager */
function setupWindowManager () {
  windowManager = new WindowManager();
  windowManager.setWinShapeChangeCallback(updateWindowShape);
  windowManager.setWinChangeCallback      (windowsUpdated);

  /* attach any custom metadata per window */
  const metaData = { foo: 'bar' };
  windowManager.init(metaData);       // registers this tab

  windowsUpdated();                   // build first batch of cubes
}

/* ================================================================ */
/* ███  CUBE HANDLERS                                              ███ */

/* -------- rebuild cube list when number of windows changes */
function windowsUpdated () {
  updateNumberOfCubes();
}

function updateNumberOfCubes () {
  const wins = windowManager.getWindows();

  /* purge old meshes */
  cubes.forEach(c => world.remove(c));
  cubes = [];

  /* create one cube per window */
  for (const win of wins) {
    const depth = cubeControls.matchDepth ? cubeControls.subDepth
                                          : cubeControls.width;

    const cube = new t.Mesh(
      new t.BoxGeometry(cubeControls.width, cubeControls.height, depth),
      new t.MeshBasicMaterial({ color: cubeControls.color, wireframe: true })
    );

    cube.position.set(
      win.shape.x + win.shape.w * 0.5,
      win.shape.y + win.shape.h * 0.5,
      0
    );

    createSubCubeGrid(cube);
    world.add(cube);
    cubes.push(cube);
  }
}

/* -------- geometry & colour mutations (called by GUI) */
function updateCubeSize () {
  for (const cube of cubes) {
    /* swap geometry */
    cube.geometry.dispose();
    const depth = cubeControls.matchDepth ? cubeControls.subDepth
                                          : cubeControls.width;
    cube.geometry = new t.BoxGeometry(cubeControls.width,
                                      cubeControls.height,
                                      depth);
    createSubCubeGrid(cube);          // regenerate sub-grid
  }
}

function updateCubeColor () {
  for (const cube of cubes)
    cube.material.color.set(cubeControls.color);
}

function updateSubCubeColor () {
  for (const cube of cubes)
    if (cube.userData.subCubes)
      cube.userData.subCubes.forEach(sc => sc.material.color.set(cubeControls.subColor));
}

function createSubCubeGrid (cube) {
  /* dispose of any previous sub-cubes */
  if (!cube.userData.subCubes) cube.userData.subCubes = [];
  cube.userData.subCubes.forEach(sc => {
    cube.remove(sc);
    sc.geometry.dispose();
    sc.material.dispose();
  });
  cube.userData.subCubes = [];

  const rows = Math.max(1, cubeControls.rows | 0);
  const cols = Math.max(1, cubeControls.columns | 0);

  const subW = cubeControls.width  / cols;
  const subH = cubeControls.height / rows;
  const subD = cubeControls.subDepth;

  for (let r = 0; r < rows; ++r) {
    for (let c = 0; c < cols; ++c) {
      const sc = new t.Mesh(
        new t.BoxGeometry(subW, subH, subD),
        new t.MeshBasicMaterial({ color: cubeControls.subColor, wireframe: true })
      );
      sc.position.x = -cubeControls.width  / 2 + subW * (c + 0.5);
      sc.position.y = -cubeControls.height / 2 + subH * (r + 0.5);
      cube.add(sc);
      cube.userData.subCubes.push(sc);
    }
  }
}

function updateSubCubeLayout () {
  cubes.forEach(createSubCubeGrid);
  updateSubCubeColor();        // ensure colours remain in sync
}

/* ================================================================ */
/* ███  RENDER LOOP                                                ███ */
function updateWindowShape (easing = true) {
  sceneOffsetTarget = { x: -window.screenX, y: -window.screenY };
  if (!easing) sceneOffset = { ...sceneOffsetTarget };
}

function render () {
  /* ------- clock */
  const now = getTimeSeconds();
  const dt  = now - internalTime;
  internalTime = now;

  /* ------- WindowManager heartbeat */
  windowManager.update();

  /* ------- smooth scene pan to follow multi-window layout */
  const k = 0.05;                                        // easing factor
  sceneOffset.x += (sceneOffsetTarget.x - sceneOffset.x) * k;
  sceneOffset.y += (sceneOffsetTarget.y - sceneOffset.y) * k;
  world.position.set(sceneOffset.x, sceneOffset.y, 0);

  /* ------- per-cube transforms */
  const wins = windowManager.getWindows();
  for (let i = 0; i < cubes.length; ++i) {
    const cube = cubes[i];
    const win  = wins[i];

    const target = {
      x: win.shape.x + win.shape.w * 0.5 + cubeControls.posX,
      y: win.shape.y + win.shape.h * 0.5 + cubeControls.posY,
    };

    cube.position.x += (target.x - cube.position.x) * k;
    cube.position.y += (target.y - cube.position.y) * k;

    cube.position.x += cubeControls.velocityX * dt;
    cube.position.y += cubeControls.velocityY * dt;

    cube.rotation.set(
      cubeControls.rotX + now * 0.5,
      cubeControls.rotY + now * 0.3,
      cubeControls.rotZ
    );
  }

  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

/* ================================================================ */
/* ███  RESIZE HANDLER                                             ███ */
function resize () {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.left   = 0;
  camera.right  = w;
  camera.top    = 0;
  camera.bottom = h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
}
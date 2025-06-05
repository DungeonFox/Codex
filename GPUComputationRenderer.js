// Minimal GPUComputationRenderer adapted from NIfTI project
// THREE is loaded globally via a script tag in index.html
// Access THREE from the global scope so the module works when the library is
// included via a script tag.
const THREE = globalThis.THREE;

class GPUComputationRenderer {
    constructor(sizeX, sizeY, renderer) {
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.renderer = renderer;
        this.variables = [];
        this.currentTextureIndex = 0;
        this.scene = new THREE.Scene();
        this.camera = new THREE.Camera();
        this.camera.position.z = 1;
        this.passThruUniforms = { passThruTexture: { value: null } };
        this.passThruShader = this.createShaderMaterial(this.getPassThroughFragmentShader(), this.passThruUniforms);
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.passThruShader);
        this.scene.add(this.mesh);
    }

    createShaderMaterial(fragmentShader, uniforms = {}) {
        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: 'void main(){ gl_Position = vec4(position,1.0); }',
            fragmentShader
        });
        material.defines = { resolution: `vec2(${this.sizeX.toFixed(1)}, ${this.sizeY.toFixed(1)})` };
        return material;
    }

    addVariable(name, fragmentShader, initialValueTexture) {
        const material = this.createShaderMaterial(fragmentShader);
        const variable = {
            name,
            initialValueTexture,
            material,
            dependencies: null,
            renderTargets: [this.createRenderTarget(), this.createRenderTarget()]
        };
        this.renderTexture(initialValueTexture, variable.renderTargets[0]);
        this.renderTexture(initialValueTexture, variable.renderTargets[1]);
        this.variables.push(variable);
        return variable;
    }

    setVariableDependencies(variable, dependencies) {
        variable.dependencies = dependencies;
        dependencies.forEach(dep => {
            variable.material.uniforms[dep.name] = { value: null };
            variable.material.fragmentShader = `uniform sampler2D ${dep.name};\n` + variable.material.fragmentShader;
        });
    }

    createRenderTarget() {
        return new THREE.WebGLRenderTarget(this.sizeX, this.sizeY, {
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false
        });
    }

    createTexture() {
        const data = new Float32Array(this.sizeX * this.sizeY * 4);
        return new THREE.DataTexture(data, this.sizeX, this.sizeY, THREE.RGBAFormat, THREE.FloatType);
    }

    getPassThroughFragmentShader() {
        return 'uniform sampler2D passThruTexture;\n' +
               'void main(){ vec2 uv = gl_FragCoord.xy / resolution; gl_FragColor = texture2D(passThruTexture, uv); }';
    }

    renderTexture(input, output) {
        const currentRenderTarget = this.renderer.getRenderTarget();
        this.passThruUniforms.passThruTexture.value = input;
        this.renderer.setRenderTarget(output);
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(currentRenderTarget);
        this.passThruUniforms.passThruTexture.value = null;
    }

    init() {
        if (!this.renderer.capabilities.isWebGL2 && !this.renderer.extensions.has('OES_texture_float')) {
            return 'No float texture support';
        }
        return null;
    }

    compute() {
        const nextIndex = this.currentTextureIndex === 0 ? 1 : 0;
        for (let variable of this.variables) {
            if (variable.dependencies) {
                variable.dependencies.forEach(dep => {
                    variable.material.uniforms[dep.name].value = dep.renderTargets[this.currentTextureIndex].texture;
                });
            }
            const current = this.renderer.getRenderTarget();
            this.mesh.material = variable.material;
            this.renderer.setRenderTarget(variable.renderTargets[nextIndex]);
            this.renderer.render(this.scene, this.camera);
            this.renderer.setRenderTarget(current);
            this.mesh.material = this.passThruShader;
        }
        this.currentTextureIndex = nextIndex;
    }

    getCurrentRenderTarget(variable) {
        return variable.renderTargets[this.currentTextureIndex];
    }
}

export default GPUComputationRenderer;


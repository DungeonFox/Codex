export function createColorShader() {
    return `
        uniform float time;
        void main() {
            vec2 uv = gl_FragCoord.xy / resolution;
            float i = uv.y * resolution.x + uv.x;
            vec3 col = vec3(
                0.5 + 0.5 * sin(time + i * 0.1),
                0.5 + 0.5 * sin(time * 0.5 + i * 0.2),
                0.5 + 0.5 * sin(time * 0.8 + i * 0.3)
            );
            gl_FragColor = vec4(col, 1.0);
        }
    `;
}

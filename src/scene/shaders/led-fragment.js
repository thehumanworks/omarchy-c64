/** A single additive LED: hot core, soft halo. */
export const LED_FRAGMENT = /* glsl */ `
uniform float uOn; uniform vec3 uCol; varying vec2 vUv;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float core = smoothstep(0.30, 0.0, d), halo = smoothstep(1.0, 0.05, d);
  gl_FragColor = vec4(uCol * (core * 1.7 + halo * 0.5) * uOn, 1.0);
}
`;

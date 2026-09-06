/** The black tube surround behind the glass, so the bezel never shows the room. */
export const TUBE_FRAGMENT = /* glsl */ `
uniform vec3 uGlow; uniform float uAmount; varying vec2 vUv;
void main(){
  vec2 c = vUv * 2.0 - 1.0;
  float e = max(abs(c.x), abs(c.y));
  vec3 col = vec3(0.017, 0.018, 0.024);
  col += uGlow * uAmount * 0.085 * (1.0 - smoothstep(0.70, 1.0, e));
  gl_FragColor = vec4(col, 1.0);
}
`;

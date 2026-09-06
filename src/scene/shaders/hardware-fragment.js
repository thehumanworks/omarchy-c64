/** Photographed hardware, lit by a warm ambient plus the CRT's coloured bounce. */
export const HARDWARE_FRAGMENT = /* glsl */ `
uniform sampler2D map; uniform float uAmbient, uAmount, uFall, uTop;
uniform vec3 uGlow, uCenter; varying vec2 vUv; varying vec3 vW;
void main(){
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.004) discard;
  float d = length(vW - uCenter);
  float g = uAmount / (1.0 + uFall * d * d * 2.2);
  vec3 warm = vec3(1.0, 0.94, 0.83) * (uAmbient + uTop * vUv.y);
  gl_FragColor = vec4(t.rgb * (warm + uGlow * g * 1.42), t.a);
}
`;

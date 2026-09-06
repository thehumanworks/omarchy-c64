/** Photographed hardware, lit by a warm ambient plus the CRT's coloured bounce. */
export const HARDWARE_FRAGMENT = /* glsl */ `
uniform sampler2D map; uniform float uAmbient, uAmount, uFall, uTop;
uniform sampler2D navigationMap; uniform float uNavigation;
uniform vec3 uGlow, uCenter; varying vec2 vUv; varying vec3 vW;
void main(){
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.004) discard;
  // Generated controls occupy only the lower panel. Keep the original tube,
  // outer edges and alpha silhouette, including outside the generated image.
  float panel = step(vUv.y, 0.15) * step(0.025, vUv.y)
    * smoothstep(0.025, 0.04, vUv.x) * (1.0 - smoothstep(0.96, 0.975, vUv.x));
  t.rgb = mix(t.rgb, texture2D(navigationMap, vUv).rgb, panel * uNavigation);
  float d = length(vW - uCenter);
  float g = uAmount / (1.0 + uFall * d * d * 2.2);
  vec3 warm = vec3(1.0, 0.94, 0.83) * (uAmbient + uTop * vUv.y);
  gl_FragColor = vec4(t.rgb * (warm + uGlow * g * 1.42), t.a);
}
`;

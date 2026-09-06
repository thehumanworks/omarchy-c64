/**
 * The plaster wall behind the monitor: a dark study at night, lit almost
 * entirely by the tube. The literal `-0.370` is the old desk plane, kept
 * because the contact shading at the foot of the wall reads from it; the desk
 * itself is gone (see "Removed on purpose" in docs/ARCHITECTURE.md).
 */
export const WALL_FRAGMENT = /* glsl */ `
uniform vec3 uGlow; uniform float uAmount, uTime; varying vec2 vUv; varying vec3 vW;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = vec2(vW.x, vW.y - 0.10);
  float mott = vn(vW.xy * 1.7) * 0.6 + vn(vW.xy * 4.6) * 0.3 + vn(vW.xy * 11.0) * 0.1;
  float r = length(p * vec2(0.62, 0.80));
  /* base plaster, warm-neutral, almost black away from the tube */
  vec3 base = vec3(0.108, 0.100, 0.099);
  float key  = exp(-r * 0.62) * 0.92;                       /* CRT keylight   */
  float amb  = 0.055 + 0.045 * smoothstep(-2.4, 2.6, vW.y);  /* faint sky fill */
  vec3 col = base * (0.80 + mott * 0.42) * (amb + key * 0.50);
  col += vec3(0.030, 0.020, 0.012) * exp(-length(vW.xy - vec2(-3.4, 2.4)) * 0.40);
  col += uGlow * uAmount * 0.215 * exp(-r * 1.10);
  col += uGlow * uAmount * 0.055 * exp(-r * 0.42);
  /* contact shading where the wall meets the desk */
  col *= 1.0 - 0.55 * exp(-max(0.0, vW.y - (-0.370)) * 3.4);
  /* soft shadow cast by the canvas print */
  vec2 f = (vW.xy - vec2(-1.30, 0.63)) / vec2(0.95, 0.60);
  col *= 1.0 - 0.30 * exp(-pow(max(0.0, length(max(abs(f) - 0.86, 0.0))), 1.5) * 5.5);
  col += (h(vUv * 1100.0 + fract(uTime)) - 0.5) * 0.0075;   /* paint tooth   */
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

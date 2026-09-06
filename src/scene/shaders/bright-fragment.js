/** Bloom prepass: keep only what is brighter than the threshold. */
export const BRIGHT_FRAGMENT = /* glsl */ `
uniform sampler2D uTex; uniform float uThresh; varying vec2 vUv;
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  gl_FragColor = vec4(c * (max(0.0, l - uThresh) / max(l, 0.0001)), 1.0);
}
`;

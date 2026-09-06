/** Phosphor persistence: the new frame maxed against a decayed previous one. */
export const PERSIST_FRAGMENT = /* glsl */ `
uniform sampler2D uNew, uPrev; uniform float uDecay; varying vec2 vUv;
void main(){
  vec3 n = texture2D(uNew,vUv).rgb;
  vec3 p = texture2D(uPrev,vUv).rgb * uDecay;
  gl_FragColor = vec4(max(n,p),1.0);
}
`;

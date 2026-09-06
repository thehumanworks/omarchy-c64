/** Separable five-tap Gaussian, run once per axis. */
export const BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D uTex; uniform vec2 uDir, uTexel; varying vec2 vUv;
void main(){
  vec2 d = uDir * uTexel;
  vec3 s = texture2D(uTex, vUv).rgb * 0.227027;
  s += (texture2D(uTex, vUv + d*1.3846).rgb + texture2D(uTex, vUv - d*1.3846).rgb) * 0.316216;
  s += (texture2D(uTex, vUv + d*3.2308).rgb + texture2D(uTex, vUv - d*3.2308).rgb) * 0.070270;
  gl_FragColor = vec4(s, 1.0);
}
`;

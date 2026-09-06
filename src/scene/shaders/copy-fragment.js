/** Straight copy between render targets. */
export const COPY_FRAGMENT = /* glsl */ `
uniform sampler2D uTex; varying vec2 vUv;
void main(){ gl_FragColor = vec4(texture2D(uTex,vUv).rgb,1.0); }
`;

/** Vertex shader for anything lit by the tube: also hands on world position. */
export const WORLD_VERTEX = /* glsl */ `
varying vec2 vUv; varying vec3 vW;
void main(){
  vUv = uv;
  vec4 w = modelMatrix * vec4(position,1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

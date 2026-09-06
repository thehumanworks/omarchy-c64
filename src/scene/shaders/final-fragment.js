/** The lens: distortion, aberration, the two bloom levels, tone map and grain. */
export const FINAL_FRAGMENT = /* glsl */ `
    precision highp float;
    uniform sampler2D uTex, uB1, uB2; uniform float uTime, uFade; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 c = vUv * 2.0 - 1.0;
      vec2 uv = vUv + c * dot(c, c) * 0.0070;
      float ab = 0.0013 * dot(c, c);
      vec3 col;
      col.r = texture2D(uTex, uv + c * ab).r;
      col.g = texture2D(uTex, uv).g;
      col.b = texture2D(uTex, uv - c * ab).b;
      col += texture2D(uB1, uv).rgb * 0.23;
      col += texture2D(uB2, uv).rgb * 0.47;
      col *= 0.94;
      col = col / (col + 0.76) * 1.46;
      float l = dot(col, vec3(0.2126,0.7152,0.0722));
      col = mix(vec3(l), col, 1.14);
      col *= 1.0 - 0.44 * dot(c * 0.74, c * 0.74);
      col += (h(vUv * uRes + fract(uTime) * 137.0) - 0.5) * 0.028;
      gl_FragColor = vec4(clamp(col * uFade, 0.0, 1.0), 1.0);
    }
`;

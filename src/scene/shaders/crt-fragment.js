/**
 * The tube itself: barrel distortion, the switch-on wipe, chromatic
 * aberration, bloom taps, scanlines, the aperture-grille mask, glass sheen and
 * grain. Every constant here is part of the look — do not tune them casually.
 */
export const CRT_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex; uniform vec2 uRes;
  uniform float uTime, uOn, uBright, uContrast, uDpr, uFlash, uGlow;
  uniform vec2 uFit;
  varying vec2 vUv;
  vec3 samp(vec2 uv){
    vec2 p = uv * uRes; vec2 i = floor(p) + 0.5;
    vec2 f = clamp((p - i) * 3.2, -0.5, 0.5);
    return texture2D(uTex, (i + f) / uRes).rgb;
  }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    vec2 c = uv * 2.0 - 1.0;
    vec2 o = abs(c.yx) / vec2(17.0, 14.0);
    c += c * o * o;
    float openY = smoothstep(0.0, 0.62, uOn);
    float openX = smoothstep(0.0, 0.20, uOn);
    c.y /= max(openY, 0.0008);
    c.x /= max(openX, 0.0008);
    vec2 s = c * 0.5 + 0.5;
    float inside = step(0.0, s.x) * step(s.x, 1.0) * step(0.0, s.y) * step(s.y, 1.0);
    /* the 40x25 block keeps its shape; the C64 border spills out to the glass
       edge on its own because the canvas clamps to its border-coloured rim. */
    s = 0.5 + (s - 0.5) * uFit;
    vec2 sc = clamp(s, 0.0, 1.0);
    float ca = 0.0006 + 0.0019 * dot(c, c);
    vec3 col;
    col.r = samp(clamp(s + vec2(ca, 0.0), 0.0, 1.0)).r;
    col.g = samp(sc).g;
    col.b = samp(clamp(s - vec2(ca, 0.0), 0.0, 1.0)).b;
    col *= inside;
    vec3 gl = vec3(0.0);
    gl += samp(clamp(s + vec2( 0.0060, 0.0), 0.0, 1.0));
    gl += samp(clamp(s + vec2(-0.0060, 0.0), 0.0, 1.0));
    gl += samp(clamp(s + vec2(0.0,  0.0090), 0.0, 1.0));
    gl += samp(clamp(s + vec2(0.0, -0.0090), 0.0, 1.0));
    gl += samp(clamp(s + vec2( 0.0140, 0.0190), 0.0, 1.0));
    gl += samp(clamp(s + vec2(-0.0140,-0.0190), 0.0, 1.0));
    gl += samp(clamp(s + vec2( 0.0260,-0.0330), 0.0, 1.0));
    gl += samp(clamp(s + vec2(-0.0260, 0.0330), 0.0, 1.0));
    gl *= 0.125 * inside;
    float sl = sin(s.y * uRes.y * 3.14159265);
    float scan = 1.0 - 0.17 * sl * sl;
    float m = mod(gl_FragCoord.x / max(uDpr * 0.62, 1.0), 3.0);
    vec3 mask = (m < 1.0) ? vec3(1.12, 0.80, 0.88)
              : (m < 2.0) ? vec3(0.80, 1.12, 0.88)
                          : vec3(0.88, 0.80, 1.12);
    col = col * scan * mask * 0.94;
    col += gl * uGlow;
    col += col * col * 0.11;
    col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 4.0) * uBright;
    col *= 1.0 + 0.030 * smoothstep(0.86, 1.0, sin(s.y * 3.2 - uTime * 0.55));
    col *= 1.0 + 0.013 * sin(uTime * 96.0);
    col *= clamp(1.0 - 0.30 * dot(c * 0.80, c * 0.80), 0.0, 1.0);
    float sheen = smoothstep(0.55, -0.35, uv.x + uv.y * 0.75) * 0.022;
    sheen += pow(max(0.0, 1.0 - length((uv - vec2(0.20, 0.84)) * vec2(1.45, 2.7))), 3.0) * 0.040;
    col += vec3(0.62, 0.72, 1.0) * sheen * (0.30 + 0.70 * uOn);
    col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.020;
    col += vec3(0.78, 0.86, 1.0) * uFlash;
    col += vec3(0.013, 0.014, 0.021) * (1.0 - uOn);
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

// Debug aid (?fp16=1): make a desktop GPU behave like a phone running the water fragment shader at MEDIUMP. Pure string transform, no THREE.
//
// Why it exists: a phone showed the sea covered in hard-edged square blocks with the weather on and normal with ?weather=0, and the desktop never did. mediump floats are
// 16-bit (10 mantissa bits): a number near 4000 can only change in steps of 2, so a world coordinate like z = 8100 (steps of 4 m) collapses fract()/floor() noise into
// flat squares. A desktop GPU runs mediump as full 32-bit, so the bug is invisible there. This rounds the shader's INPUTS to 16-bit precision (the varying world position
// and the rect/drift uniforms), which is a conservative emulation: a real mediump GPU also rounds every intermediate result, so it is at least this bad.
export const Q16_GLSL = `
float q16(float x) { float a = abs(x); if (a < 0.00006104) return x; float e = floor(log2(a)); float s = exp2(e - 10.0); return sign(x) * floor(a / s + 0.5) * s; }
vec2 q16(vec2 v) { return vec2(q16(v.x), q16(v.y)); }
vec3 q16(vec3 v) { return vec3(q16(v.x), q16(v.y), q16(v.z)); }
vec4 q16(vec4 v) { return vec4(q16(v.x), q16(v.y), q16(v.z), q16(v.w)); }
`;

// The same rounding in JS, for tests: a 16-bit float's nearest value (10 mantissa bits).
export function q16(x) {
  const a = Math.abs(x);
  if (a < 0.00006104) return x;
  const s = 2 ** (Math.floor(Math.log2(a)) - 10);
  return Math.sign(x) * Math.floor(a / s + 0.5) * s;
}

// fragmentShader: the water's fragment source (patched or not). Returns it with every use of the varying vWorld inside main() and the world-sized uniforms read through q16().
export function emulateMediumpFragment(src) {
  const m = src.indexOf('void main() {');
  if (m < 0) throw new Error('shader-fp16: no main() found');
  let head = src.slice(0, m);
  let body = src.slice(m);
  const local = src.includes('varying vec2 vLocal;'); // only the weather-patched shader has the camera-local position
  body = body.replace('void main() {', `void main() {\n  vec3 vWQ = q16(vWorld);${local ? '\n  vec2 vLQ = q16(vLocal);' : ''}`);
  body = body.split('vWorld').join('vWQ').replace('vec3 vWQ = q16(vWQ);', 'vec3 vWQ = q16(vWorld);');
  if (local) body = body.split('vLocal').join('vLQ').replace('vec2 vLQ = q16(vLQ);', 'vec2 vLQ = q16(vLocal);'); // the weather's camera-local position, read at 16 bits too
  for (const [name, swz] of [['uWindRect', 'xy'], ['uWindRect', 'zw'], ['uWindRectL', 'xy'], ['uWindRectL', 'zw'], ['uDepthRect', 'xy'], ['uDepthRect', 'zw'], ['uDepthL', 'xy'], ['uDepthL', 'zw'], ['uWindDrift', ''], ['uMarkOffset', ''], ['uRip', ''], ['uCrest', '']]) {
    const use = swz ? `${name}.${swz}` : name;
    body = body.split(use).join(`q16(${use})`);
  }
  return Q16_GLSL + head + body;
}

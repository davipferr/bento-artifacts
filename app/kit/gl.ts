/**
 * Small WebGL2 helpers for full-screen shader artifacts: compile a program, draw one
 * triangle that covers the viewport, and make float render targets for simulations.
 */

/** Vertex shader for full-screen passes; `vUv` runs 0–1 across the viewport. */
export const FULLSCREEN_VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile failed: ${log}`)
  }
  return shader
}

export interface Program {
  program: WebGLProgram
  /** Uniform locations by name (looked up once). */
  u: Record<string, WebGLUniformLocation | null>
}

export function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string, uniforms: string[]): Program {
  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.bindAttribLocation(program, 0, 'aPos')
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`)
  }
  return { program, u: Object.fromEntries(uniforms.map((name) => [name, gl.getUniformLocation(program, name)])) }
}

/** A VAO with one oversized triangle covering clip space; call the result to draw it. */
export function fullscreenTriangle(gl: WebGL2RenderingContext): () => void {
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)
  return () => {
    gl.bindVertexArray(vao)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
  }
}

export interface Target {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
}

/**
 * An RGBA16F texture you can render into (needs EXT_color_buffer_float), wrapping at the
 * edges so simulations live on a torus. `data` is optional RGBA float initial content.
 */
export function floatTarget(gl: WebGL2RenderingContext, width: number, height: number, data: Float32Array | null = null): Target {
  const texture = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, data)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
  const framebuffer = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { texture, framebuffer }
}

/** Resize a canvas's backing store to its CSS size × device pixel ratio (capped). */
export function fitCanvas(canvas: HTMLCanvasElement, maxDpr = 2): { width: number; height: number; dpr: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
  const width = Math.max(1, Math.round(canvas.clientWidth * dpr))
  const height = Math.max(1, Math.round(canvas.clientHeight * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  return { width, height, dpr }
}

/** "#rrggbb" → [r, g, b] in 0–1, for colour uniforms. */
export function rgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

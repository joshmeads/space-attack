export const RENDER_FEATURES = Object.freeze({ webgpu: false });

export function getRendererPreference(): 'webgl' {
  if (RENDER_FEATURES.webgpu) {
    throw new Error('WebGPU is not available in this build');
  }
  return 'webgl';
}

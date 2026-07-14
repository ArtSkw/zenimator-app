const MAX_DIMENSION = 800;

/**
 * Render an SVG string to a PNG data URL, fitting within MAX_DIMENSION on
 * the longer side. Used as the vision input to the LLM Grouper.
 */
export async function rasterizeSvg(svgText: string): Promise<string> {
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(svgUrl);
    const { width, height } = fitWithin(
      img.naturalWidth || 400,
      img.naturalHeight || 400,
      MAX_DIMENSION,
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    // White background — matches the ZEN portal canvas; also makes
    // transparent-background SVGs legible to the LLM.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to rasterize SVG'));
    img.src = src;
  });
}

function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const scale = max / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

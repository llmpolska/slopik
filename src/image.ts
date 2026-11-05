// Jev rejects images with either side below 280 px, including small pasted icons.
export function attachmentBounds(width: number, height: number) {
  const scale = Math.min(1, 1280 / Math.max(width, height));
  const imageWidth = Math.max(1, Math.round(width * scale));
  const imageHeight = Math.max(1, Math.round(height * scale));
  const canvasWidth = Math.max(280, imageWidth);
  const canvasHeight = Math.max(280, imageHeight);
  return {
    imageWidth,
    imageHeight,
    canvasWidth,
    canvasHeight,
    x: (canvasWidth - imageWidth) / 2,
    y: (canvasHeight - imageHeight) / 2,
  };
}

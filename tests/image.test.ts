import { expect, it } from "vitest";
import { attachmentBounds } from "../src/image";
it.each([
  [192, 192],
  [3000, 1000],
  [2000, 100],
  [100, 2000],
  [1, 1],
])("fits %dx%d inside Jev image limits without cropping", (width, height) => {
  const result = attachmentBounds(width, height);
  expect(result.canvasWidth).toBeGreaterThanOrEqual(280);
  expect(result.canvasHeight).toBeGreaterThanOrEqual(280);
  expect(result.canvasWidth).toBeLessThanOrEqual(1280);
  expect(result.canvasHeight).toBeLessThanOrEqual(1280);
  expect(result.x).toBeGreaterThanOrEqual(0);
  expect(result.y).toBeGreaterThanOrEqual(0);
  expect(result.imageWidth + result.x * 2).toBe(result.canvasWidth);
  expect(result.imageHeight + result.y * 2).toBe(result.canvasHeight);
});

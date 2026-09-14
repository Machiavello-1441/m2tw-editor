/**
 * Build the two-sheet atlas a M2TW battle model expects.
 *
 * A `.mesh` addresses TWO textures glued side by side, and our decoder hands
 * UVs out in the community convention (main sheet 0..1, attachment sheet
 * 1..2). So the pair is drawn into one canvas — main on the left, attachment on
 * the right — and the material is given `repeat.x = 0.5`, which folds the 0..2
 * range back onto the single image. When there is no attachment sheet the main
 * one is drawn twice, so attachment geometry shows its own art rather than
 * black.
 */
import { loadTextureBuffer } from './textureLoader';

async function decode(file) {
  if (!file) return null;
  const ext = file.name.split('.').pop().toLowerCase();
  const result = loadTextureBuffer(await file.arrayBuffer(), ext);
  if (!result?.imageData) return null;
  const c = document.createElement('canvas');
  c.width = result.width;
  c.height = result.height;
  c.getContext('2d').putImageData(result.imageData, 0, 0);
  return c;
}

/**
 * @returns {Promise<HTMLCanvasElement|null>} a canvas twice as wide as the
 *   sheets, or null if the main sheet could not be decoded.
 */
export async function buildSheetAtlas(mainFile, attachFile) {
  const main = await decode(mainFile);
  if (!main) return null;
  const attach = (await decode(attachFile)) || main;

  const w = Math.max(main.width, attach.width);
  const h = Math.max(main.height, attach.height);
  const atlas = document.createElement('canvas');
  atlas.width = w * 2;
  atlas.height = h;
  const ctx = atlas.getContext('2d');
  ctx.drawImage(main, 0, 0, w, h);
  ctx.drawImage(attach, w, 0, w, h);
  return atlas;
}
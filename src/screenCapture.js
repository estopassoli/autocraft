import screenshot from 'screenshot-desktop';
import Jimp from 'jimp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.AUTOCRAFT_DATA_DIR || path.join(process.cwd(), 'autocraft-data');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'logs', 'screenshots');
const DEBUG_ENABLED = process.env.AUTOCRAFT_DEBUG === '1';

// Garantir que o diretório existe
if (DEBUG_ENABLED && !fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Captura uma região específica da tela
 * @param {Object} region - {x, y, width, height}
 * @returns {Promise<Buffer>} - Buffer da imagem
 */
export async function captureRegion(region) {
  try {
    // Captura a tela inteira
    const imgBuffer = await screenshot({ format: 'png' });

    // Carrega com Jimp para cortar a região
    const image = await Jimp.read(imgBuffer);

    // Corta a região específica
    image.crop(region.x, region.y, region.width, region.height);
    const scale = 2;
    image
      .resize(region.width * scale, region.height * scale, Jimp.RESIZE_BICUBIC)
      .greyscale()
      .contrast(0.55)
      .normalize()
      .brightness(0.03)
      .invert();

    // Threshold simples para binarizar
    const threshold = 200;
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
      const r = image.bitmap.data[idx];
      const g = image.bitmap.data[idx + 1];
      const b = image.bitmap.data[idx + 2];
      const v = (r + g + b) / 3;
      const c = v > threshold ? 255 : 0;
      image.bitmap.data[idx] = c;
      image.bitmap.data[idx + 1] = c;
      image.bitmap.data[idx + 2] = c;
    });


    // Retorna o buffer
    return await image.getBufferAsync(Jimp.MIME_PNG);
  } catch (error) {
    console.error('Erro ao capturar região:', error);
    throw error;
  }
}

/**
 * Captura a tela inteira
 * @returns {Promise<Buffer>}
 */
export async function captureFullScreen() {
  try {
    return await screenshot({ format: 'png' });
  } catch (error) {
    console.error('Erro ao capturar tela:', error);
    throw error;
  }
}

/**
 * Salva uma captura para debug
 * @param {Buffer} buffer - Buffer da imagem
 * @param {string} filename - Nome do arquivo
 */
export async function saveCapture(buffer, filename) {
  if (!DEBUG_ENABLED) return;
  const image = await Jimp.read(buffer);
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await image.writeAsync(filepath);
  console.log(`Captura salva: ${filepath}`);
}

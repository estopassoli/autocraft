import { mouse, Button, Point } from '@nut-tree-fork/nut-js';
import { captureFullScreen, saveCapture } from './screenCapture.js';
import { delay } from './mouseController.js';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

/**
 * Ferramenta de calibração para encontrar as posições corretas
 */
export async function runCalibration() {
  console.log('='.repeat(50));
  console.log('   CALIBRAÇÃO DO AUTO CRAFTER');
  console.log('='.repeat(50));
  console.log('');
  console.log('Este processo vai ajudar a configurar as posições');
  console.log('corretas do mouse para o seu layout do PoE2.');
  console.log('');

  // Garante que a pasta debug existe
  const dataDir = process.env.AUTOCRAFT_DATA_DIR || path.join(process.cwd(), 'autocraft-data');
  const debugDir = path.join(dataDir, 'debug');
  if (process.env.AUTOCRAFT_DEBUG === '1' && !fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }

  const config = {
    chaosOrbPosition: { x: 0, y: 0 },
    targetItemPosition: { x: 0, y: 0 },
    modifierRegion: { x: 0, y: 0, width: 0, height: 0 }
  };

  // Captura tela completa para referência
  console.log('Capturando tela de referência...');
  await delay(1000);
  const fullScreen = await captureFullScreen();
  await saveCapture(fullScreen, 'calibration_fullscreen.png');
  console.log(`Tela salva em: ${debugDir}${path.sep}calibration_fullscreen.png`);
  console.log('');

  // Posição do Chaos Orb
  console.log('PASSO 1: Posição do Chaos Orb');
  console.log('Posicione o mouse sobre o Chaos Orb no stash e pressione ENTER...');
  await question('');
  const chaosPos = await mouse.getPosition();
  config.chaosOrbPosition = { x: chaosPos.x, y: chaosPos.y };
  console.log(`Chaos Orb: x=${chaosPos.x}, y=${chaosPos.y}`);
  console.log('');

  // Posição do item alvo
  console.log('PASSO 2: Posição do Item Alvo');
  console.log('Posicione o mouse sobre o item onde aplicar o Chaos e pressione ENTER...');
  await question('');
  const itemPos = await mouse.getPosition();
  config.targetItemPosition = { x: itemPos.x, y: itemPos.y };
  console.log(`Item: x=${itemPos.x}, y=${itemPos.y}`);
  console.log('');

  // Região do tooltip
  console.log('PASSO 3: Região do Tooltip (onde aparecem os mods)');
  console.log('Posicione o mouse no canto SUPERIOR ESQUERDO do tooltip e pressione ENTER...');
  await question('');
  const topLeft = await mouse.getPosition();
  
  console.log('Agora posicione no canto INFERIOR DIREITO do tooltip e pressione ENTER...');
  await question('');
  const bottomRight = await mouse.getPosition();
  
  config.modifierRegion = {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y
  };
  console.log(`Região: x=${config.modifierRegion.x}, y=${config.modifierRegion.y}, width=${config.modifierRegion.width}, height=${config.modifierRegion.height}`);
  console.log('');

  // Mostra configuração final
  console.log('='.repeat(50));
  console.log('   CONFIGURAÇÃO GERADA');
  console.log('='.repeat(50));
  console.log('');
  console.log('Copie isso para o arquivo src/config.js:');
  console.log('');
  console.log(`  chaosOrbPosition: {`);
  console.log(`    x: ${config.chaosOrbPosition.x},`);
  console.log(`    y: ${config.chaosOrbPosition.y}`);
  console.log(`  },`);
  console.log('');
  console.log(`  targetItemPosition: {`);
  console.log(`    x: ${config.targetItemPosition.x},`);
  console.log(`    y: ${config.targetItemPosition.y}`);
  console.log(`  },`);
  console.log('');
  console.log(`  modifierRegion: {`);
  console.log(`    x: ${config.modifierRegion.x},`);
  console.log(`    y: ${config.modifierRegion.y},`);
  console.log(`    width: ${config.modifierRegion.width},`);
  console.log(`    height: ${config.modifierRegion.height}`);
  console.log(`  },`);
  console.log('');

  // Salva em arquivo
  const configJson = JSON.stringify(config, null, 2);
  fs.writeFileSync('./debug/calibration_config.json', configJson);
  console.log('Configuração salva em: ./debug/calibration_config.json');

  rl.close();
}

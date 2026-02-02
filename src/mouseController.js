import { mouse, Button, Point, keyboard, Key } from '@nut-tree-fork/nut-js';
import { config } from './config.js';

// Configura a velocidade do mouse
mouse.config.mouseSpeed = 2000;

/**
 * Move o mouse para uma posição
 * @param {number} x 
 * @param {number} y 
 */
export async function moveTo(x, y) {
  await mouse.move([new Point(x, y)]);
}

/**
 * Clica com o botão direito
 * @param {number} x 
 * @param {number} y 
 */
export async function rightClick(x, y) {
  await moveTo(x, y);
  await mouse.click(Button.RIGHT);
}

/**
 * Clica com o botão esquerdo
 * @param {number} x 
 * @param {number} y 
 */
export async function leftClick(x, y) {
  await moveTo(x, y);
  await mouse.click(Button.LEFT);
}

/**
 * Clica com Shift pressionado (para aplicar currency repetidamente)
 * @param {number} x 
 * @param {number} y 
 */
export async function shiftClick(x, y) {
  await keyboard.pressKey(Key.LeftShift);
  await leftClick(x, y);
  await keyboard.releaseKey(Key.LeftShift);
}

/**
 * Aplica um Chaos Orb no item alvo
 * Processo:
 * 1. Clica com botão direito no Chaos Orb (para pegar)
 * 2. Clica com botão esquerdo no item alvo (para aplicar)
 */
export async function applyChaosOrb() {
  const { chaosOrbPosition, targetItemPosition, delays } = config;
  
  // Clica com botão direito no Chaos Orb para "pegar"
  await rightClick(chaosOrbPosition.x, chaosOrbPosition.y);
  await delay(delays.afterClick);
  
  // Clica no item alvo para aplicar
  await leftClick(targetItemPosition.x, targetItemPosition.y);
  await delay(delays.afterChaosApply);
}

/**
 * Aplica Chaos Orb usando Shift+Click (modo rápido)
 * Primeiro seleciona o Chaos, depois usa Shift+Click no item
 */
export async function applyChaosOrbFast() {
  const { chaosOrbPosition, targetItemPosition, delays } = config;
  
  // Primeiro clique: seleciona o Chaos Orb
  await rightClick(chaosOrbPosition.x, chaosOrbPosition.y);
  await delay(delays.afterClick);
  
  // Shift + Click no item para aplicar rapidamente
  await shiftClick(targetItemPosition.x, targetItemPosition.y);
  await delay(delays.afterChaosApply);
}

/**
 * Hover sobre o item para mostrar tooltip
 */
export async function hoverItem() {
  const { targetItemPosition, delays } = config;
  await moveTo(targetItemPosition.x, targetItemPosition.y);
  await delay(delays.hoverForTooltip);
}

/**
 * Delay helper
 * @param {number} ms 
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verifica se uma tecla foi pressionada (para parar)
 */
export async function checkForPauseKey() {
  // Esta função pode ser expandida para detectar teclas
  // Por enquanto, retorna false
  return false;
}

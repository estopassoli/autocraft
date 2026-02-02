import Tesseract from 'tesseract.js';
import { config } from './config.js';

let worker = null;

/**
 * Inicializa o worker do Tesseract
 */
export async function initOCR() {
  console.log('Inicializando OCR...');
  worker = await Tesseract.createWorker(config.ocr.language);
  console.log('OCR inicializado!');
}

/**
 * Finaliza o worker do Tesseract
 */
export async function terminateOCR() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

/**
 * Extrai texto de uma imagem
 * @param {Buffer} imageBuffer - Buffer da imagem
 * @returns {Promise<string>} - Texto extraído
 */
export async function extractText(imageBuffer) {
  if (!worker) {
    await initOCR();
  }

  try {
    const { data } = await worker.recognize(imageBuffer);
    return data.text;
  } catch (error) {
    console.error('Erro no OCR:', error);
    return '';
  }
}

/**
 * Verifica se o texto contém o modificador desejado
 * @param {string} text - Texto extraído via OCR
 * @returns {boolean}
 */
export function hasDesiredModifier(text) {
  const normalizedText = text.toLowerCase().replace(/\s+/g, ' ');
  
  // Verifica o modificador principal
  if (normalizedText.includes(config.desiredModifier.toLowerCase())) {
    return true;
  }
  
  // Verifica alternativas
  for (const alt of config.alternativeModifiers) {
    if (normalizedText.includes(alt.toLowerCase())) {
      return true;
    }
  }
  
  // Busca por padrões comuns
  // Procura por "+6" próximo de "spell" e "skill"
  const hasPlus6 = /\+\s*6/.test(text);
  const hasSpell = /spell/i.test(text);
  const hasSkill = /skill/i.test(text);
  const hasAll = /all/i.test(text);
  
  if (hasPlus6 && hasSpell && hasSkill && hasAll) {
    console.log('Padrão detectado: +6 All Spell Skills');
    return true;
  }
  
  return false;
}

/**
 * Analisa o texto e retorna informações sobre modificadores encontrados
 * @param {string} text - Texto do OCR
 * @returns {Object} - Informações dos modificadores
 */
export function analyzeModifiers(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const modifiers = [];
  
  for (const line of lines) {
    // Procura por padrões de modificadores do PoE
    if (/[+\-]\d+/.test(line) || /%/.test(line) || /increased|reduced|more|less/i.test(line)) {
      modifiers.push(line.trim());
    }
  }
  
  return {
    rawText: text,
    modifiers,
    hasTarget: hasDesiredModifier(text)
  };
}

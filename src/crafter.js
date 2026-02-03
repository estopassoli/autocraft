import { config } from './config.js';
import { captureRegion, saveCapture } from './screenCapture.js';
import { extractText, hasDesiredModifier, analyzeModifiers, initOCR, terminateOCR } from './ocr.js';
import { aiAnalyzer } from './aiAnalyzer.js';
import { applyChaosOrb, hoverItem, delay } from './mouseController.js';
import fs from 'fs';
import path from 'path';

// Garante que a pasta debug existe
const DATA_DIR = process.env.AUTOCRAFT_DATA_DIR || path.join(process.cwd(), 'autocraft-data');
const DEBUG_DIR = path.join(DATA_DIR, 'debug');
if (process.env.AUTOCRAFT_DEBUG === '1' && !fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

/**
 * Classe principal do Auto Crafter
 */
export class AutoCrafter {
  constructor() {
    this.attempts = 0;
    this.isRunning = false;
    this.startTime = null;
    this.found = false;
  }

  /**
   * Inicia o processo de crafting automático
   */
  async start() {
    console.log('='.repeat(50));
    console.log('   AUTO CRAFTER - PoE2');
    console.log('='.repeat(50));
    console.log(`Procurando: ${config.desiredModifier}`);
    console.log(`Máximo de tentativas: ${config.safety.maxAttempts}`);
    console.log('');
    
    // Inicializa OCR
    await initOCR();
    
    // Inicializa IA se configurada
    await aiAnalyzer.initialize();
    const aiStatus = aiAnalyzer.getStatus();
    if (aiStatus.enabled) {
      console.log(`✅ Usando análise com IA (${aiStatus.config.model})`);
    } else if (aiStatus.useAI) {
      console.log('✅ Usando Ollama como método principal');
    } else {
      console.log('📊 Usando OCR como método de análise');
    }
    
    this.isRunning = true;
    this.startTime = Date.now();
    this.attempts = 0;
    this.found = false;

    console.log('Iniciando em 3 segundos... Posicione o mouse no PoE2!');
    await delay(3000);

    try {
      while (this.isRunning && this.attempts < config.safety.maxAttempts) {
        this.attempts++;
        
        // Log do progresso
        if (this.attempts % 10 === 0) {
          const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
          console.log(`Tentativa ${this.attempts} | Tempo: ${elapsed}s`);
        }

        // 1. Hover no item para aparecer o tooltip
        await hoverItem();
        
        // 2. Captura a região do tooltip
        const imageBuffer = await captureRegion(config.modifierRegion);
        
        // 3. Analisa com IA ou OCR conforme configurado
        const analysis = await aiAnalyzer.analyzeImage(imageBuffer);
        
        // Debug: salva algumas capturas
        if (this.attempts <= 5 || this.attempts % 50 === 0) {
          await saveCapture(imageBuffer, `attempt_${this.attempts}.png`);
          const method = analysis.method || 'desconhecido';
          console.log(`[${method.toUpperCase()}] Attempt ${this.attempts}:`, analysis.text?.substring(0, 100) || 'Sem texto');
        }
        
        // 5. Verifica se encontrou o mod desejado
        if (analysis.hasTarget) {
          this.found = true;
          this.isRunning = false;
          
          // Salva a captura do sucesso
          await saveCapture(imageBuffer, `SUCCESS_${this.attempts}.png`);
          
          console.log('\n' + '='.repeat(50));
          console.log('   ✅ MODIFICADOR ENCONTRADO!');
          console.log('='.repeat(50));
          console.log(`Tentativas: ${this.attempts}`);
          console.log(`Tempo total: ${Math.floor((Date.now() - this.startTime) / 1000)}s`);
          console.log(`Método: ${(analysis.method || 'desconhecido').toUpperCase()}`);
          console.log(`Confiança: ${analysis.confidence || 'N/A'}%`);
          console.log(`Texto detectado: ${analysis.text}`);
          
          // Toca um beep de alerta
          process.stdout.write('\x07'); // Beep
          
          break;
        }
        
        // 6. Aplica outro Chaos Orb
        await applyChaosOrb();
        
        // Delay entre tentativas
        await delay(config.delays.betweenAttempts);
      }
      
      if (!this.found) {
        console.log('\n' + '='.repeat(50));
        console.log('   ❌ LIMITE DE TENTATIVAS ATINGIDO');
        console.log('='.repeat(50));
        console.log(`Tentativas: ${this.attempts}`);
        console.log('Modificador não encontrado.');
      }
      
    } catch (error) {
      console.error('Erro durante o crafting:', error);
    } finally {
      await terminateOCR();
      this.isRunning = false;
    }
    
    return {
      found: this.found,
      attempts: this.attempts,
      duration: Date.now() - this.startTime
    };
  }

  /**
   * Para o processo de crafting
   */
  stop() {
    console.log('Parando o crafter...');
    this.isRunning = false;
  }

  /**
   * Executa um teste de captura (sem aplicar Chaos)
   */
  async testCapture() {
    console.log('Modo de teste - Capturando região...');
    console.log('Posicione o mouse sobre o item no PoE2');
    await delay(3000);
    
    await initOCR();
    
    // Hover no item
    await hoverItem();
    
    // Captura
    const imageBuffer = await captureRegion(config.modifierRegion);
    await saveCapture(imageBuffer, 'test_capture.png');
    
    // OCR
    const text = await extractText(imageBuffer);
    console.log('\nTexto detectado:');
    console.log('-'.repeat(40));
    console.log(text);
    console.log('-'.repeat(40));
    
    const analysis = analyzeModifiers(text);
    console.log('\nModificadores encontrados:');
    analysis.modifiers.forEach(m => console.log(`  - ${m}`));
    console.log(`\nTem modificador alvo: ${analysis.hasTarget ? 'SIM!' : 'Não'}`);
    
    await terminateOCR();
  }
}

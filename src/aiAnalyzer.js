import { OllamaClient } from './ollama.js';
import { extractText, analyzeModifiers, hasDesiredModifier } from './ocr.js';
import { aiConfigManager } from './aiConfigManager.js';
import { config } from './config.js';

/**
 * Módulo de análise de modificadores com IA (Ollama) e fallback OCR
 */

class AIAnalyzer {
  constructor() {
    this.ollama = null;
    this.useAI = false;
    this.ollamaConfig = {};
    this.loadSavedConfig();
  }

  /**
   * Carrega configuração salva do arquivo
   */
  loadSavedConfig() {
    try {
      const saved = aiConfigManager.load();
      this.ollamaConfig = saved || {};
      console.log('Configuração de IA carregada:', this.ollamaConfig);
    } catch (error) {
      console.warn('Erro ao carregar configuração de IA:', error);
      this.ollamaConfig = {};
    }
  }

  /**
   * Inicializa o analisador com configurações
   */
  async initialize() {
    // Recarrega configuração antes de inicializar
    this.loadSavedConfig();

    if (!this.ollamaConfig.enabled) {
      console.log('IA desabilitada, usando OCR padrão');
      this.useAI = false;
      return;
    }

    if (!this.ollamaConfig.host || !this.ollamaConfig.model) {
      console.log('Ollama não configurado, usando OCR como fallback');
      this.useAI = false;
      return;
    }

    try {
      this.ollama = new OllamaClient(this.ollamaConfig);
      const connected = await this.ollama.testConnection();

      if (connected) {
        console.log(
          `✅ Conectado ao Ollama (${this.ollamaConfig.model}) em ${this.ollamaConfig.host}:${this.ollamaConfig.port}`
        );
        this.useAI = true;
      } else {
        console.warn('⚠️ Não foi possível conectar ao Ollama, usando OCR');
        this.useAI = false;
      }
    } catch (error) {
      console.error('Erro ao inicializar IA:', error);
      this.useAI = false;
    }
  }

  /**
   * Analisa uma imagem de modificadores
   * @param {Buffer} imageBuffer - Buffer da imagem
   * @returns {Promise<Object>} - Análise com estrutura consistente
   */
  async analyzeImage(imageBuffer) {
    if (!this.useAI || !this.ollama) {
      return this._fallbackToOCR(imageBuffer);
    }

    try {
      // Cria um prompt específico para PoE modificadores
      const prompt = `Você é um especialista em Path of Exile 2. Analise esta imagem de tooltip de item e extraia TODOS os modificadores visíveis.

Responda em JSON com a seguinte estrutura:
{
  "text": "Texto completo dos modificadores encontrados",
  "modifiers": ["mod1", "mod2", ...],
  "hasTarget": true/false,
  "confidence": 0-100
}

O modificador alvo é: "${config.desiredModifier}"

Se encontrar o modificador alvo, defina hasTarget como true.`;

      const response = await this.ollama.analyzeImage(imageBuffer, prompt);

      // Tenta parsear a resposta JSON
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          result.method = 'ollama';
          return result;
        }
      } catch (e) {
        // Se falhar em parsear, cai para OCR
        console.warn('Erro ao parsear resposta da IA, usando OCR como fallback');
      }

      return this._fallbackToOCR(imageBuffer);
    } catch (error) {
      console.error('Erro ao analisar com IA:', error);
      return this._fallbackToOCR(imageBuffer);
    }
  }

  /**
   * Fallback para OCR
   * @private
   */
  async _fallbackToOCR(imageBuffer) {
    const text = await extractText(imageBuffer);
    const analysis = analyzeModifiers(text);

    return {
      text: text,
      modifiers: analysis.modifiers,
      hasTarget: analysis.hasTarget,
      confidence: 60, // OCR default confidence
      method: 'ocr',
    };
  }

  /**
   * Configura as credenciais do Ollama
   */
  updateConfig(newConfig) {
    this.ollamaConfig = {
      ...this.ollamaConfig,
      ...newConfig,
    };

    // Salva a configuração no arquivo
    aiConfigManager.save(this.ollamaConfig);

    // Reset do cliente para reconectar com novas credenciais
    this.ollama = null;
    this.useAI = false;
  }

  /**
   * Retorna status atual
   */
  getStatus() {
    return {
      enabled: this.ollamaConfig.enabled || false,
      useAI: this.useAI,
      method: this.useAI ? 'ollama' : 'ocr',
      config: this.ollamaConfig,
    };
  }

  /**
   * Desabilita IA (volta para OCR)
   */
  disableAI() {
    this.useAI = false;
    this.ollamaConfig.enabled = false;
    aiConfigManager.save(this.ollamaConfig);
  }
}

// Instância global
const aiAnalyzer = new AIAnalyzer();

export { aiAnalyzer, AIAnalyzer };

import http from 'http';
import https from 'https';
import fs from 'fs';

/**
 * Módulo para integração com Ollama (LLM Local)
 */

class OllamaClient {
  constructor(config = {}) {
    this.host = config.host || 'localhost';
    this.port = config.port || 11434;
    this.model = config.model || 'llava';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Testa a conexão com Ollama
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      const response = await this._request('/api/tags');
      return response.models && Array.isArray(response.models);
    } catch (error) {
      console.error('Erro ao conectar com Ollama:', error.message);
      return false;
    }
  }

  /**
   * Lista os modelos disponíveis no Ollama
   * @returns {Promise<Array>}
   */
  async listModels() {
    try {
      const response = await this._request('/api/tags');
      return response.models || [];
    } catch (error) {
      console.error('Erro ao listar modelos:', error);
      return [];
    }
  }

  /**
   * Analisa uma imagem usando o modelo Vision do Ollama
   * @param {Buffer|string} imageData - Buffer ou caminho da imagem
   * @param {string} prompt - Prompt para análise
   * @returns {Promise<string>} - Resposta do modelo
   */
  async analyzeImage(imageData, prompt) {
    try {
      // Se for um caminho, lê o arquivo
      let base64Image;
      if (typeof imageData === 'string') {
        const imageBuffer = fs.readFileSync(imageData);
        base64Image = imageBuffer.toString('base64');
      } else {
        base64Image = imageData.toString('base64');
      }

      const response = await this._request('/api/generate', {
        model: this.model,
        prompt: prompt,
        images: [base64Image],
        stream: false,
        temperature: 0.3, // Mais determinístico para leitura de mods
      });

      return response.response || '';
    } catch (error) {
      console.error('Erro ao analisar imagem com Ollama:', error);
      throw error;
    }
  }

  /**
   * Análise simples de texto (sem imagem)
   * @param {string} prompt - Prompt
   * @returns {Promise<string>}
   */
  async generate(prompt) {
    try {
      const response = await this._request('/api/generate', {
        model: this.model,
        prompt: prompt,
        stream: false,
        temperature: 0.3,
      });

      return response.response || '';
    } catch (error) {
      console.error('Erro ao gerar resposta:', error);
      throw error;
    }
  }

  /**
   * Requisição HTTP para Ollama
   * @private
   */
  async _request(path, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.host,
        port: this.port,
        path: path,
        timeout: this.timeout,
      };

      if (data) {
        options.method = 'POST';
        options.headers = {
          'Content-Type': 'application/json',
        };
      } else {
        options.method = 'GET';
      }

      const req = http.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode === 200) {
              resolve(json);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${json.error || body}`));
            }
          } catch (e) {
            reject(new Error(`Erro ao parsear resposta: ${body}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout conectando com Ollama'));
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }
}

export { OllamaClient };

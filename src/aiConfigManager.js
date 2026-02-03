import fs from 'fs';
import path from 'path';

/**
 * Módulo para persistência de configuração de IA
 */

const configDir = process.env.AUTOCRAFT_DATA_DIR || path.join(process.cwd(), 'autocraft-data');
const configFile = path.join(configDir, 'ai-config.json');

const defaultConfig = {
  enabled: false,
  host: 'localhost',
  port: 11434,
  model: 'llava'
};

export function loadAIConfig() {
  try {
    if (fs.existsSync(configFile)) {
      const content = fs.readFileSync(configFile, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Erro ao carregar configuração de IA:', error);
  }
  return { ...defaultConfig };
}

export function saveAIConfig(config) {
  try {
    // Garante que o diretório existe
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');
    console.log('Configuração de IA salva:', config);
  } catch (error) {
    console.error('Erro ao salvar configuração de IA:', error);
  }
}

export const aiConfigManager = {
  load: loadAIConfig,
  save: saveAIConfig
};

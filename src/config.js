// Configuração do AutoCraft para PoE2
const config = {
  // Posição do Chaos Orb no stash (ajuste conforme seu layout)
  chaosOrbPosition: {
    x: 65,  // Posição X do Chaos Orb no stash
    y: 137  // Posição Y do Chaos Orb no stash
  },

  // Posição do item alvo (o item no meio onde aplicar o Chaos)
  targetItemPosition: {
    x: 237,  // Posição X do item alvo
    y: 310   // Posição Y do item alvo
  },

  // Região da tela onde os modificadores do item aparecem (para OCR)
  // Ajuste esses valores baseado na resolução da sua tela
  modifierRegion: {
    x: 90,      // X inicial da região do tooltip
    y: 130,     // Y inicial da região do tooltip
    width: 350, // Largura da região
    height: 150 // Altura da região
  },

  // Modificador desejado (o que você está procurando)
  desiredModifier: "+6 to All Spell Skills",

  // Alternativas de texto que também são aceitas
  // Será populado dinamicamente com todos os mods do data/mods.json (grupo explicit)
  alternativeModifiers: [],

  // Delays em milissegundos
  delays: {
    afterClick: 100,        // Delay após cada clique
    afterChaosApply: 300,   // Delay após aplicar o Chaos Orb
    beforeOCR: 200,         // Delay antes de fazer OCR
    betweenAttempts: 500,   // Delay entre tentativas
    hoverForTooltip: 400    // Tempo para aparecer o tooltip
  },

  // Configurações de segurança
  safety: {
    maxAttempts: 1000,      // Número máximo de tentativas
    pauseKey: "escape",     // Tecla para pausar/parar
    confirmStart: true      // Pedir confirmação antes de começar
  },

  // Configurações de OCR
  ocr: {
    language: "eng",
    confidence: 60          // Confiança mínima do OCR (0-100)
  },

  // Configurações de IA (Ollama/LLM Local)
  ai: {
    enabled: false,         // Se deve usar IA em vez de OCR
    ollama: {
      host: 'localhost',    // Host do Ollama
      port: 11434,          // Porta do Ollama
      model: 'llava',       // Modelo a usar (llava, llava:13b, etc)
      timeout: 30000        // Timeout em ms
    }
  }
};

// Carrega todos os mods "explicit" da API do PoE
async function loadValidMods() {
  try {
    const https = require('https');
    const zlib = require('zlib');
    
    console.log('🌐 Carregando mods da API do PoE...');
    
    const options = {
      hostname: 'www.pathofexile.com',
      path: '/api/trade2/data/stats',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      }
    };
    
    const data = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks = [];
        
        // Descomprime se necessário
        let stream = res;
        if (res.headers['content-encoding'] === 'gzip') {
          stream = res.pipe(zlib.createGunzip());
        } else if (res.headers['content-encoding'] === 'deflate') {
          stream = res.pipe(zlib.createInflate());
        } else if (res.headers['content-encoding'] === 'br') {
          stream = res.pipe(zlib.createBrotliDecompress());
        }
        
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
          if (res.statusCode === 200) {
            resolve(Buffer.concat(chunks).toString('utf8'));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
        stream.on('error', reject);
      });
      
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Timeout ao carregar mods'));
      });
      req.end();
    });
    
    const parsed = JSON.parse(data);
    
    // Extrai apenas os mods do grupo "explicit"
    const groups = Array.isArray(parsed.result) ? parsed.result : [];
    const explicitGroup = groups.find(g => g.id === 'explicit');
    const entries = Array.isArray(explicitGroup?.entries) ? explicitGroup.entries : [];
    
    const mods = Array.from(
      new Set(entries.map(entry => entry.text).filter(Boolean).map(text => text.trim()))
    );
    
    // Atualiza a config com todos os mods
    config.alternativeModifiers = mods;
    
    console.log(`✅ Carregados ${mods.length} mods 'explicit' da API do PoE`);
    return mods;
  } catch (err) {
    console.error('❌ Erro ao carregar mods da API:', err.message);
    return [];
  }
}

module.exports = { config, loadValidMods };

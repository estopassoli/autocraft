const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Diretórios para salvar logs/debug fora do app.asar (somente em dev)
const IS_DEV = !app.isPackaged;
const APP_DATA_DIR = path.join(app.getPath('userData'), 'autocraft');
const LOGS_DIR = path.join(APP_DATA_DIR, 'logs');
const SCREENSHOTS_DIR = path.join(LOGS_DIR, 'screenshots');
const DEBUG_DIR = path.join(APP_DATA_DIR, 'debug');

// Expor para processos renderer
process.env.AUTOCRAFT_DATA_DIR = APP_DATA_DIR;
process.env.AUTOCRAFT_DEBUG = IS_DEV ? '1' : '0';

// Garantir que os diretórios existem apenas em dev
if (IS_DEV) {
  [APP_DATA_DIR, LOGS_DIR, SCREENSHOTS_DIR, DEBUG_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Função para salvar screenshots
async function saveScreenshot(imageBuffer, filename) {
  if (!IS_DEV) return;
  try {
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    await Jimp.read(imageBuffer).then(image => image.writeAsync(filepath));
    console.log(`[saveScreenshot] Captura salva: ${filepath}`);
  } catch (error) {
    console.error(`[saveScreenshot] Erro ao salvar: ${error.message}`);
  }
}

// Importações dinâmicas para os módulos ES
let Tesseract;
let Jimp;
let screenshot;
let nutjs;

async function loadModules() {
  Tesseract = (await import('tesseract.js')).default;
  Jimp = (await import('jimp')).default;
  screenshot = (await import('screenshot-desktop')).default;
  nutjs = await import('@nut-tree-fork/nut-js');
}

let mainWindow;
let historyWindow;
let keyMonitorProcess = null;

// Arquivo de sinal para parada (funciona entre processos)
const STOP_SIGNAL_FILE = path.join(app.getPath('temp'), 'autocraft-stop-signal.txt');

let crafterState = {
  isRunning: false,
  stopRequested: false,
  attempts: 0,
  startTime: null,
  worker: null
};

const CONFIG_PATH = path.join(app.getPath('userData'), 'autocraft-config.json');

// ==================== SISTEMA DE RESOLUÇÃO ADAPTATIVA ====================

/**
 * Obtém resolução da tela principal
 */
function getScreenResolution() {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    return { width, height };
  } catch (error) {
    console.error('[getScreenResolution] Erro:', error);
    // Fallback para resolução padrão (1920x1080)
    return { width: 1920, height: 1080 };
  }
}

/**
 * Converte coordenadas relativas (porcentagem) para absolutas (pixels)
 * Suporta ambos os formatos:
 * - Relativo: { x, y, relativeX, relativeY } → converte relativeX/Y para pixels
 * - Absoluto: { x, y } → usa x/y diretamente
 */
function convertToAbsoluteCoordinates(position) {
  if (!position) return null;
  
  // Validação rígida: ambos x e y precisam ser números válidos
  const x = position.x;
  const y = position.y;
  
  if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
    console.error(`[convertToAbsolute] Coordenadas inválidas:`, position);
    return null;
  }
  
  const absoluteX = Math.round(x);
  const absoluteY = Math.round(y);
  
  console.log(`[convertToAbsolute] Usando coords: ${absoluteX}px, ${absoluteY}px`);
  
  return {
    x: absoluteX,
    y: absoluteY
  };
}

/**
 * Converte região relativa para absoluta
 */
function convertRegionToAbsolute(region) {
  if (!region) return null;

  // Validação rígida: todos os valores precisam ser números válidos
  const x = region.x;
  const y = region.y;
  const width = region.width;
  const height = region.height;
  
  if (typeof x !== 'number' || typeof y !== 'number' || 
      typeof width !== 'number' || typeof height !== 'number' ||
      isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
    console.error('[convertRegionToAbsolute] Região inválida - valores não são números:', region);
    return null;
  }
  
  // Usar valores absolutos arredondados
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  };
}

// Verifica se o arquivo de sinal existe
function checkStopSignal() {
  try {
    if (fs.existsSync(STOP_SIGNAL_FILE)) {
      fs.unlinkSync(STOP_SIGNAL_FILE); // Remove o arquivo
      return true;
    }
  } catch (e) {}
  return false;
}

// Cria o arquivo de sinal
function createStopSignal() {
  try {
    fs.writeFileSync(STOP_SIGNAL_FILE, Date.now().toString());
  } catch (e) {}
}

// Remove o arquivo de sinal
function clearStopSignal() {
  try {
    if (fs.existsSync(STOP_SIGNAL_FILE)) {
      fs.unlinkSync(STOP_SIGNAL_FILE);
    }
  } catch (e) {}
}

// PowerShell script para monitorar teclas globalmente
const PS_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KeyboardHook {
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
}
"@

$signalFile = "${STOP_SIGNAL_FILE.replace(/\\/g, '\\\\')}"
$VK_F6 = 0x75

$lastState = @{}

while ($true) {
    Start-Sleep -Milliseconds 50
    
    $keys = @($VK_F6)
    
    foreach ($key in $keys) {
        $state = [KeyboardHook]::GetAsyncKeyState($key)
        $pressed = ($state -band 0x8000) -ne 0
        
        if ($pressed -and -not $lastState[$key]) {
            "STOP" | Out-File -FilePath $signalFile -Force -NoNewline
            Write-Host "KEY_PRESSED"
        }
        $lastState[$key] = $pressed
    }
}
`;

// Inicia o monitor de teclado via PowerShell
function startKeyMonitor() {
  try {
    // Mata qualquer processo anterior
    if (keyMonitorProcess) {
      keyMonitorProcess.kill();
    }
    
    keyMonitorProcess = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command', PS_SCRIPT
    ], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    });
    
    keyMonitorProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output === 'KEY_PRESSED') {
        console.log('>>> PowerShell detectou tecla! <<<');
        forceStopCrafting('Hotkey Global');
      }
    });
    
    keyMonitorProcess.on('error', (err) => {
      console.error('Erro no monitor de teclado:', err);
    });
    
    keyMonitorProcess.on('exit', (code) => {
      console.log('Monitor de teclado encerrado:', code);
    });
    
    console.log('✅ Monitor de teclado PowerShell iniciado!');
    return true;
  } catch (error) {
    console.error('Erro ao iniciar monitor:', error);
    return false;
  }
}

// Para o monitor de teclado
function stopKeyMonitor() {
  if (keyMonitorProcess) {
    keyMonitorProcess.kill();
    keyMonitorProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 850,
    height: 900,
    minWidth: 700,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'AutoCraft - PoE2',
    backgroundColor: '#1a1a2e'
  });

  // Remove a barra de menu completamente
  mainWindow.setMenu(null);

  // Abre maximizado
  mainWindow.maximize();

  console.log('[MAIN] Carregando ui/index.html');
  mainWindow.loadFile('ui/index.html');
  
  // Listeners para erros e eventos
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[MAIN] did-finish-load - Carregando config');
    loadConfig();
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('[MAIN] Renderer process crashed!');
  });

  mainWindow.webContents.on('destroyed', () => {
    console.log('[MAIN] Renderer process destroyed');
  });

  mainWindow.on('closed', () => {
    console.log('[MAIN] Main window closed');
    mainWindow = null;
  });

  // Dev tools desativados
  // setTimeout(() => {
  //   if (mainWindow && !mainWindow.isDestroyed()) {
  //     console.log('[MAIN] Abrindo DevTools');
  //     mainWindow.webContents.openDevTools();
  //   }
  // }, 1500);
  
  // Hotkeys para abrir DevTools
  globalShortcut.register('F12', () => {
    console.log('[MAIN] F12 pressionado');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });
  
  globalShortcut.register('Ctrl+Shift+I', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

// Criar janela de histórico de crafting
function createHistoryWindow() {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  
  // Tamanho da janela
  const windowWidth = 500;
  const windowHeight = 600;
  
  // Centralizar
  const x = Math.round(screenWidth / 2 - windowWidth / 2);
  const y = Math.round(screenHeight / 2 - windowHeight / 2);

  historyWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: null
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  historyWindow.loadFile(path.join(__dirname, 'ui', 'crafting-history.html'));
  
  // Força o nível mais alto de always on top (acima de fullscreen games)
  historyWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  
  // Mantém sempre no topo mesmo quando perde foco
  historyWindow.on('blur', () => {
    if (historyWindow && !historyWindow.isDestroyed()) {
      historyWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
  });

  historyWindow.on('closed', () => {
    historyWindow = null;
  });
}

// Função para forçar parada
function forceStopCrafting(source = 'hotkey') {
  console.log(`>>> FORÇANDO PARADA (${source}) - isRunning: ${crafterState.isRunning} <<<`);
  
  crafterState.isRunning = false;
  crafterState.stopRequested = true;
  
  if (source !== 'silent') {
    sendLog(`⏹️ PARANDO! (${source})`, 'warning');
  }
  
  // Libera o Shift
  if (nutjs && nutjs.keyboard) {
    nutjs.keyboard.releaseKey(nutjs.Key.LeftShift).catch(() => {});
  }
  
  // Pausar histórico
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.webContents.send('crafting-paused');
  }
  
  // Atualiza UI
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('crafting-complete', {
      found: false,
      attempts: crafterState.attempts,
      duration: crafterState.startTime ? Date.now() - crafterState.startTime : 0
    });
  }
}

app.whenReady().then(async () => {
  await loadModules();
  
  // Carrega lista de mods válidos da API do PoE
  console.log('[MAIN] Iniciando carregamento de mods...');
  const { loadValidMods } = require('./src/config.js');
  global.validMods = await loadValidMods();
  console.log(`[MAIN] ${global.validMods.length} mods carregados e disponíveis`);
  
  createWindow();
  
  // Limpa qualquer sinal antigo
  clearStopSignal();
  
  // Registra hotkeys via globalShortcut
  // Usa teclas menos comuns para evitar conflitos
  const hotkeys = ['F6'];
  
  const registeredKeys = [];
  hotkeys.forEach(key => {
    try {
      const ok = globalShortcut.register(key, () => {
        console.log(`${key} pressionado via globalShortcut!`);
        forceStopCrafting(key);
      });
      if (ok) {
        registeredKeys.push(key);
      }
      console.log(`Hotkey ${key}: ${ok ? 'OK' : 'FALHOU'}`);
    } catch (e) {
      console.log(`Erro ao registrar ${key}:`, e.message);
    }
  });
  
  // Inicia o monitor de teclado PowerShell (funciona globalmente no Windows)
  const psStarted = startKeyMonitor();
  
  if (psStarted) {
    sendLog('🎮 Hotkey GLOBAL ativa: F6', 'success');
  } else if (registeredKeys.length > 0) {
    sendLog(`🎮 Hotkeys: ${registeredKeys.slice(0, 4).join(', ')}`, 'info');
  } else {
    sendLog('⚠️ Use o botão Parar para interromper.', 'warning');
  }
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  stopKeyMonitor();
  clearStopSignal();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Funções auxiliares
function sendLog(message, type = 'info') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log', { message, type });
  }
}

function updateStatus(attempts, startTime) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    mainWindow.webContents.send('update-status', {
      attempts,
      elapsed: `${minutes}:${seconds}`
    });
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      mainWindow.webContents.send('load-config', config);
    }
  } catch (error) {
    console.error('Erro ao carregar config:', error);
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Erro ao salvar config:', error);
  }
}

// Captura e pré-processa região para OCR (duas variantes)
async function captureRegionForOCR(region, options = {}) {
  try {
    // Validar região antes de capturar
    if (!region || typeof region !== 'object') {
      console.error('[captureRegion] Região inválida:', region);
      throw new Error('Região inválida ou não definida');
    }
    
    const { x, y, width, height } = region;
    
    if (x === undefined || y === undefined || width === undefined || height === undefined) {
      console.error('[captureRegion] Propriedades da região faltando:', region);
      throw new Error(`Região incompleta: x=${x}, y=${y}, width=${width}, height=${height}`);
    }
    
    if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
      console.error('[captureRegion] Valores NaN detectados:', region);
      throw new Error(`Região com valores NaN: x=${x}, y=${y}, width=${width}, height=${height}`);
    }
    
    if (width <= 0 || height <= 0) {
      console.error('[captureRegion] Dimensões inválidas:', region);
      throw new Error(`Dimensões inválidas: width=${width}, height=${height}`);
    }
    
    console.log(`[captureRegion] Capturando: x=${x}, y=${y}, w=${width}, h=${height}`);
    
    const imgBuffer = await screenshot({ format: 'png' });
    const baseImage = await Jimp.read(imgBuffer);
    
    baseImage.crop(x, y, width, height);

    // Remover ícones à esquerda que confundem o OCR
    const leftTrim = Math.floor(width * 0.12);
    if (width - leftTrim > 30) {
      baseImage.crop(leftTrim, 0, width - leftTrim, height);
    }

    const scale = 2;

    const imageA = baseImage.clone();
    imageA
      .resize(Math.max(1, imageA.bitmap.width * scale), Math.max(1, imageA.bitmap.height * scale), Jimp.RESIZE_BICUBIC)
      .greyscale()
      .contrast(0.35)
      .normalize()
      .brightness(0.05);

    const imageB = baseImage.clone();
    imageB
      .resize(Math.max(1, imageB.bitmap.width * scale), Math.max(1, imageB.bitmap.height * scale), Jimp.RESIZE_BICUBIC)
      .greyscale()
      .contrast(0.55)
      .normalize()
      .brightness(0.03)
      .invert();

    if (typeof imageB.convolute === 'function') {
      imageB.convolute([
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0]
      ]);
    }

    const threshold = 200;
    imageB.scan(0, 0, imageB.bitmap.width, imageB.bitmap.height, (x, y, idx) => {
      const r = imageB.bitmap.data[idx];
      const g = imageB.bitmap.data[idx + 1];
      const b = imageB.bitmap.data[idx + 2];
      const v = (r + g + b) / 3;
      const c = v > threshold ? 255 : 0;
      imageB.bitmap.data[idx] = c;
      imageB.bitmap.data[idx + 1] = c;
      imageB.bitmap.data[idx + 2] = c;
    });

    const buffers = [
      await imageA.getBufferAsync(Jimp.MIME_PNG),
      await imageB.getBufferAsync(Jimp.MIME_PNG)
    ];

    if (options.saveDebug && process.env.AUTOCRAFT_DEBUG === '1' && typeof saveScreenshot === 'function') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      await saveScreenshot(buffers[0], `${options.prefix || 'ocr'}-a-${timestamp}.png`);
      await saveScreenshot(buffers[1], `${options.prefix || 'ocr'}-b-${timestamp}.png`);
    }
    
    return buffers;
  } catch (error) {
    console.error('Erro na captura:', error);
    throw error;
  }
}

// OCR
async function initOCR() {
  if (!crafterState.worker) {
    crafterState.worker = await Tesseract.createWorker('eng');
    try {
      await crafterState.worker.setParameters({
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
        tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ%+-.(),/ ',
        tessedit_pageseg_mode: '6',
        tessedit_ocr_engine_mode: '1'
      });
    } catch (e) {
      console.warn('[OCR] Falha ao aplicar parâmetros avançados:', e.message);
    }
  }
  return crafterState.worker;
}

async function extractText(imageBuffer) {
  const worker = await initOCR();
  const { data } = await worker.recognize(imageBuffer);
  return data.text || '';
}

async function extractTextWithDetails(buffers) {
  const worker = await initOCR();
  const collected = [];

  for (const buffer of buffers) {
    const { data } = await worker.recognize(buffer);
    if (Array.isArray(data.lines) && data.lines.length > 0) {
      for (const line of data.lines) {
        collected.push({
          text: (line.text || '').trim(),
          confidence: typeof line.confidence === 'number' ? line.confidence : (data.confidence || 0)
        });
      }
    } else if (data.text) {
      const rawLines = data.text.split('\n');
      rawLines.forEach(t => {
        collected.push({ text: t.trim(), confidence: data.confidence || 0 });
      });
    }
  }

  // Padrões válidos de mods em PoE2 - começa com +, número, ou palavras válidas
  const validModPatterns = [
    /^[\+\-]/,                                          // Começa com + ou -
    /^\d+/,                                              // Começa com número
    /^to\s+/i,                                           // "to X"
    /^(increased|reduced|more|less|grants|adds)\s+/i,  // Verbos comuns
    /^(all|spell|attack|cold|fire|lightning|physical|chaos|elemental|spirit|strength|dexterity|intelligence)\s+/i,  // Atributos comuns
    /^(life|mana|energy|damage|armor|evasion|resistance|spirit)\b/i,  // Stat types
    /^(\d+%|\+\d+)\s+(to\s+)?/i                         // "%X to Y" ou "+X to Y"
  ];

  const isValidModStart = (text) => {
    return validModPatterns.some(pattern => pattern.test(text));
  };

  // Carrega função de validação de mods
  const { isValidMod } = require('./src/config.js');
  const validMods = global.validMods || new Set();

  const map = new Map();
  for (const item of collected) {
    if (!item.text || item.text.length < 4) continue;
    const normalized = normalizeModText(item.text);
    if (!normalized || normalized.length < 4) continue;

    // Rejeita se não começa com padrão válido de mod
    if (!isValidModStart(item.text)) continue;

    const alnumCount = (normalized.match(/[a-z0-9]/g) || []).length;
    const ratio = normalized.length > 0 ? alnumCount / normalized.length : 0;
    if (ratio < 0.45) continue;

    const hasSignal = /[+%\-\d]/.test(normalized) || /\b(increased|reduced|more|less|to|all|spell|attack|grants|adds)\b/.test(normalized);
    if (!hasSignal) continue;

    // Verifica se é um mod válido (de acordo com a lista do PoE2)
    // Usar isValidMod com validMods index para validação inteligente
    if (validMods.size > 0 && !isValidMod(item.text, validMods)) continue;

    const prev = map.get(normalized);
    if (!prev || item.confidence > prev.confidence || (item.confidence === prev.confidence && item.text.length > prev.text.length)) {
      map.set(normalized, { text: item.text, normalized, confidence: item.confidence });
    }
  }

  const lines = Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
  const text = lines.map(l => l.text).join('\n');
  return { text, lines };
}

/**
 * Normaliza texto para comparação, removendo variações comuns do PoE2
 * Exemplos:
 * - "Spell Skill Gems" -> "spell skills"
 * - "All Spell Skills" -> "all spell skills"
 * - "to Level of all" -> "to level of all"
 */
function normalizeModText(text) {
  return text
    .toLowerCase()
    // Normaliza caracteres comuns de OCR
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u00d7]/g, 'x')
    .replace(/[\[\]\(\)]/g, '')
    .replace(/[:;]+/g, ' ')
    .replace(/\s*\|\s*/g, ' ')
    // Remove "gems" quando vem depois de "skill" (Spell Skill Gems -> Spell Skills)
    .replace(/skill\s+gems?\b/gi, 'skills')
    // Normaliza "of all" para "of all"
    .replace(/\bof\s+all\b/gi, 'of all')
    // Remove caracteres estranhos mantendo sinais e %
    .replace(/[^a-z0-9%+\-\.\s]/gi, ' ')
    // Remove espaços múltiplos
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

function checkModifier(text, modifierConfig) {
  const normalizedText = normalizeModText(text);

  // Se for lista, faz match com QUALQUER item
  if (Array.isArray(modifierConfig)) {
    return modifierConfig.some(mod => checkModifier(normalizedText, mod));
  }
  
  // Normaliza config para objeto
  const mod = typeof modifierConfig === 'object'
    ? { pattern: modifierConfig.pattern || modifierConfig.text || '', minValue: modifierConfig.minValue ?? null, maxValue: modifierConfig.maxValue ?? null, useRange: modifierConfig.useRange || modifierConfig.hasRange || false }
    : { pattern: modifierConfig, minValue: null, maxValue: null, useRange: false };

  // Se é um objeto com configuração de range
  if (mod.useRange) {
    return checkModifierWithRange(normalizedText, mod);
  }
  
  // Modo legado: string simples
  const normalizedTarget = normalizeModText(mod.pattern || '');
  
  if (!normalizedTarget) return false;
  
  // Verifica se o texto contém exatamente o modificador alvo
  if (normalizedText.includes(normalizedTarget)) {
    console.log(`✓ Match exato: "${normalizedTarget}"`);
    return true;
  }
  
  // Extrai o padrão: número + palavras-chave principais
  const excludeWords = ['fire', 'cold', 'lightning', 'chaos', 'physical', 'minion', 'melee', 'bow', 'wand'];
  
  // Se o alvo tem "all" mas o texto tem uma palavra de exclusão, não é match
  if (normalizedTarget.includes('all')) {
    for (const exclude of excludeWords) {
      if (normalizedText.includes(exclude) && normalizedText.includes('spell')) {
        console.log(`✗ Rejeitado: encontrou "${exclude}" quando procurava "all"`);
        return false;
      }
    }
  }
  
  // Verifica se TODAS as palavras do alvo estão presentes
  const targetWords = normalizedTarget.match(/\w+/g) || [];
  
  for (const word of targetWords) {
    if (word.length <= 2) continue;
    if (!normalizedText.includes(word)) {
      console.log(`✗ Palavra ausente: "${word}"`);
      return false;
    }
  }
  
  // Verifica números
  const targetNumbers = normalizedTarget.match(/\d+/g) || [];
  for (const num of targetNumbers) {
    if (!normalizedText.includes(num)) {
      console.log(`✗ Número ausente: "${num}"`);
      return false;
    }
  }
  
  console.log(`✓ Match por palavras-chave`);
  return true;
}

function findMatchingModifier(text, modifiers) {
  const list = Array.isArray(modifiers) ? modifiers : [modifiers];
  for (const mod of list) {
    if (!mod) continue;
    if (checkModifier(text, mod)) {
      return mod;
    }
  }
  return null;
}

// Nova função para verificar modificador com range de valores
function checkModifierWithRange(normalizedText, config) {
  const { pattern, minValue, maxValue } = config;
  
  // Normaliza o pattern também
  const normalizedPattern = normalizeModText(pattern);
  
  // Converte o padrão para regex
  // "+# to Level of all Spell Skills" -> "+(\d+) to level of all spell skills"
  let regexPattern = normalizedPattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escapa caracteres especiais
    .replace(/#/g, '(\\d+)'); // Substitui # por captura de número
  
  const regex = new RegExp(regexPattern, 'i');
  const match = normalizedText.match(regex);
  
  if (match && match[1]) {
    // Encontrou match exato com número
    const value = parseInt(match[1]);
    const inRange = (minValue === null || value >= minValue) && (maxValue === null || value <= maxValue);
    console.log(`${inRange ? '✓' : '✗'} Match com range: valor ${value}, range [${minValue || '-∞'}, ${maxValue || '+∞'}]`);
    return inRange;
  }
  
  // Tenta uma busca mais flexível pelas palavras-chave
  const keywords = normalizedPattern
    .replace(/#/g, '')
    .replace(/[+%]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  // Verifica exclusões se procurando por "all"
  const excludeWords = ['fire', 'cold', 'lightning', 'chaos', 'physical', 'minion', 'melee', 'bow', 'wand'];
  if (normalizedPattern.includes('all')) {
    for (const exclude of excludeWords) {
      if (normalizedText.includes(exclude)) {
        console.log(`✗ Rejeitado por exclusão: encontrou "${exclude}"`);
        return false;
      }
    }
  }
  
  // Verifica se todas as palavras-chave estão presentes
  const hasAllKeywords = keywords.every(kw => normalizedText.includes(kw));
  if (!hasAllKeywords) {
    const missing = keywords.filter(kw => !normalizedText.includes(kw));
    console.log(`✗ Palavras ausentes: ${missing.join(', ')}`);
    return false;
  }
  
  // Busca por números no texto
  const numbers = normalizedText.match(/\d+/g);
  if (!numbers) {
    console.log(`✗ Nenhum número encontrado no texto`);
    return false;
  }
  
  // Verifica se algum número está no range
  for (const numStr of numbers) {
    const num = parseInt(numStr);
    if (minValue !== null && num >= minValue) {
      if (maxValue === null || num <= maxValue) {
        console.log(`✓ Match com range flexível! Valor ${num} está no range [${minValue}, ${maxValue || '+∞'}]`);
        return true;
      }
    }
  }
    
  return false;
}

// ==================== MÓDULO DE MOVIMENTO DO MOUSE ====================

class MouseController {
  constructor() {
    this.lastX = 0;
    this.lastY = 0;
    this.isMoving = false;
  }

  /**
   * Move o mouse para uma posição com validação
   * @param {number} x - Coordenada X
   * @param {number} y - Coordenada Y
   * @param {number} speed - Velocidade em px/s (opcional)
   */
  async moveTo(x, y, speed = 5000) {
    if (shouldStop()) {
      console.log('[MouseController.moveTo] Abortado: Stop signal detectado');
      return false;
    }

    // Valida coordenadas
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      console.error(`[MouseController.moveTo] ❌ Coordenadas inválidas: X=${x}, Y=${y}`);
      throw new Error(`Coordenadas inválidas: X=${x}, Y=${y}`);
    }

    if (x < 0 || y < 0) {
      console.error(`[MouseController.moveTo] ❌ Coordenadas negativas: X=${x}, Y=${y}`);
      throw new Error(`Coordenadas negativas: X=${x}, Y=${y}`);
    }

    try {
      this.isMoving = true;
      const oldX = this.lastX;
      const oldY = this.lastY;
      
      console.log(`[MouseController.moveTo] 🖱️  Movendo de (${oldX},${oldY}) para (${x},${y})`);

      // Configura velocidade do mouse
      nutjs.mouse.config.mouseSpeed = speed;

      // Move o mouse
      const point = new nutjs.Point(x, y);
      await nutjs.mouse.move([point]);

      // Aguarda um pouco para garantir que chegou
      await new Promise(resolve => setTimeout(resolve, 50));

      this.lastX = x;
      this.lastY = y;
      
      console.log(`[MouseController.moveTo] ✅ Mouse em (${x},${y})`);
      return true;

    } catch (error) {
      console.error(`[MouseController.moveTo] ❌ Erro:`, error.message);
      throw error;
    } finally {
      this.isMoving = false;
    }
  }

  /**
   * Clica com botão esquerdo na posição
   * @param {number} x - Coordenada X
   * @param {number} y - Coordenada Y
   */
  async leftClick(x, y) {
    if (shouldStop()) {
      console.log('[MouseController.leftClick] Abortado: Stop signal');
      return false;
    }

    try {
      console.log(`[MouseController.leftClick] 🖱️  Clique esquerdo em (${x},${y})`);
      
      // Move para posição
      await this.moveTo(x, y);
      
      // Aguarda antes de clicar
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Clica
      await nutjs.mouse.click(nutjs.Button.LEFT);
      
      console.log(`[MouseController.leftClick] ✅ Clique completo`);
      return true;

    } catch (error) {
      console.error(`[MouseController.leftClick] ❌ Erro:`, error.message);
      throw error;
    }
  }

  /**
   * Clica com botão direito na posição
   * @param {number} x - Coordenada X
   * @param {number} y - Coordenada Y
   */
  async rightClick(x, y) {
    if (shouldStop()) {
      console.log('[MouseController.rightClick] Abortado: Stop signal');
      return false;
    }

    try {
      console.log(`[MouseController.rightClick] 🖱️  Clique direito em (${x},${y})`);
      
      // Move para posição
      await this.moveTo(x, y);
      
      // Aguarda antes de clicar
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Clica
      await nutjs.mouse.click(nutjs.Button.RIGHT);
      
      console.log(`[MouseController.rightClick] ✅ Clique completo`);
      return true;

    } catch (error) {
      console.error(`[MouseController.rightClick] ❌ Erro:`, error.message);
      throw error;
    }
  }

  /**
   * Obtém a posição atual do mouse
   */
  async getPosition() {
    try {
      const pos = await nutjs.mouse.getPosition();
      return { x: pos.x, y: pos.y };
    } catch (error) {
      console.error(`[MouseController.getPosition] ❌ Erro:`, error.message);
      return { x: this.lastX, y: this.lastY };
    }
  }
}

// Instância global do controller
const mouseController = new MouseController();

// ==================== FUNÇÕES LEGADAS (para compatibilidade) ====================

async function moveTo(x, y) {
  return await mouseController.moveTo(x, y, 5000);
}

async function rightClick(x, y) {
  return await mouseController.rightClick(x, y);
}

async function leftClick(x, y) {
  return await mouseController.leftClick(x, y);
}

async function shiftLeftClick(x, y) {
  return await mouseController.leftClick(x, y);
}

function delay(ms) {
  return new Promise((resolve, reject) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    
    const checkInterval = 30; // Verifica a cada 30ms
    let elapsed = 0;
    
    const check = () => {
      // Só interrompe se for > 5 segundos (delay muito longo) e houver stop signal
      if (elapsed > 5000 && (crafterState.stopRequested || checkStopSignal())) {
        crafterState.stopRequested = true;
        resolve();
        return;
      }
      
      elapsed += checkInterval;
      if (elapsed >= ms) {
        resolve();
      } else {
        setTimeout(check, Math.min(checkInterval, ms - elapsed));
      }
    };
    
    setTimeout(check, Math.min(checkInterval, ms));
  });
}

// Função auxiliar para verificar se deve parar
function shouldStop() {
  // Verifica também o arquivo de sinal
  if (checkStopSignal()) {
    crafterState.stopRequested = true;
    crafterState.isRunning = false;
  }
  return !crafterState.isRunning || crafterState.stopRequested;
}

// Loop principal de crafting
async function runCrafting(config) {
  // Criar janela de histórico
  createHistoryWindow();
  
  crafterState.isRunning = true;
  crafterState.stopRequested = false;
  crafterState.attempts = 0;
  crafterState.startTime = Date.now();
  
  // Configuração de velocidade do mouse - 5000 px/s é mais controlável
  nutjs.mouse.config.mouseSpeed = 5000;
  nutjs.mouse.config.autoDelayMs = 100; // Adiciona delay automático entre ações
  
  sendLog('Iniciando em 2 segundos... Minimize esta janela!', 'warning');
  await delay(2000);
  
  if (shouldStop()) {
    sendLog('Parado antes de iniciar', 'warning');
    return;
  }
  
  const modifierList = Array.isArray(config.modifiers) && config.modifiers.length > 0
    ? config.modifiers
    : (config.modifier ? [config.modifier] : []);
  
  const modDescriptions = modifierList.length === 0
    ? 'N/A'
    : modifierList.map(mod => {
        const pattern = typeof mod === 'object' ? (mod.pattern || mod.text || '') : mod;
        const minVal = mod?.minValue;
        const maxVal = mod?.maxValue;
        const rangeText = mod?.useRange || mod?.hasRange ? ` (${minVal}${maxVal ? '-' + maxVal : '+'})` : '';
        return `${pattern}${rangeText}`.trim();
      }).join(' | ');
  
  const useFlowGraph = config.flowGraph && config.flowGraph.nodes && config.flowGraph.edges;
  const useCustomSteps = Array.isArray(config.steps) && config.steps.length > 0;
  const useNewMode = useFlowGraph || useCustomSteps;
  
  console.log('[startCrafting] config.flowGraph:', config.flowGraph ? 'EXISTS' : 'NULL');
  console.log('[startCrafting] config.flowGraph.nodes:', config.flowGraph?.nodes ? `${config.flowGraph.nodes.length} nodes` : 'NULL');
  console.log('[startCrafting] config.flowGraph.edges:', config.flowGraph?.edges ? `${config.flowGraph.edges.length} edges` : 'NULL');
  console.log('[startCrafting] useFlowGraph:', useFlowGraph);
  console.log('[startCrafting] useCustomSteps:', useCustomSteps);
  console.log('[startCrafting] useNewMode:', useNewMode);
  
  sendLog(`🎯 Procurando: ${modDescriptions}`, 'info');
  sendLog(`📊 Rodando fluxo visual com ${config.flowGraph.nodes.length} nós`, 'info');
  
  try {
    // MODO ÚNICO: Apenas fluxograma visual avançado
    if (!config.flowGraph || !config.flowGraph.nodes || !config.flowGraph.nodes.length) {
      sendLog('❌ ERRO: Nenhum fluxograma configurado. Defina seu flow no editor visual.', 'error');
      mainWindow.webContents.send('crafting-complete', {
        found: false,
        attempts: 0,
        duration: 0
      });
      return;
    }
    
    {
      // Modo fluxograma visual (ÚNICO MODO ATIVO)
      let shiftPressed = false;
      try {
        while (!shouldStop() && crafterState.attempts < config.maxAttempts) {
          crafterState.attempts++;
          updateStatus(crafterState.attempts, crafterState.startTime);
          
          // Executar o fluxograma visual
          const result = await runFlowGraph(config.flowGraph.nodes, config.flowGraph.edges, config, modifierList, { 
            shiftPressed: () => shiftPressed, 
            setShiftPressed: (val) => { shiftPressed = val; } 
          });
          
          if (result?.found) {
            sendLog(`✅ ENCONTRADO! ${result.detected || ''}`.trim(), 'success');
            const matchedPattern = typeof result.matchedMod === 'object'
              ? (result.matchedMod.pattern || result.matchedMod.text || '')
              : result.matchedMod;
            const minVal = result.matchedMod?.minValue;
            const maxVal = result.matchedMod?.maxValue;
            const rangeText = result.matchedMod?.useRange || result.matchedMod?.hasRange ? ` (${minVal}${maxVal ? '-' + maxVal : '+'})` : '';
            sendLog(`🎯 Match com: ${matchedPattern}${rangeText}`, 'success');
            
            mainWindow.webContents.send('crafting-complete', {
              found: true,
              attempts: crafterState.attempts,
              duration: Date.now() - crafterState.startTime
            });
            
            // Parar o timer no histórico quando encontrar
            if (historyWindow && !historyWindow.isDestroyed()) {
              historyWindow.webContents.send('crafting-found');
            }
            
            return;
          }
        }
      } finally {
        if (shiftPressed) {
          await nutjs.keyboard.releaseKey(nutjs.Key.LeftShift).catch(() => {});
          sendLog('Shift liberado', 'info');
        }
      }
    }
    
    if (shouldStop()) {
      sendLog('⏹️ Craft interrompido pelo usuário!', 'warning');
    } else if (crafterState.attempts >= config.maxAttempts) {
      mainWindow.webContents.send('crafting-complete', {
        found: false,
        attempts: crafterState.attempts,
        duration: Date.now() - crafterState.startTime
      });
    }
    
  } catch (error) {
    console.error('[Main] Erro no crafting:', error);
    sendLog(`Erro: ${error.message}`, 'error');
    sendLog(`Stack: ${error.stack}`, 'error');
    await nutjs.keyboard.releaseKey(nutjs.Key.LeftShift).catch(() => {});
    stopCrafting();
    
    mainWindow.webContents.send('crafting-complete', {
      found: false,
      attempts: crafterState.attempts || 0,
      duration: Date.now() - crafterState.startTime
    });
  } finally {
    crafterState.isRunning = false;
    crafterState.stopRequested = false;
  }
}

async function runFlowGraph(nodes, edges, config, modifierList, shiftState) {
  // Enviar sinal de execução para a janela de histórico
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.webContents.send('crafting-execution');
  }
  
  // Converter nodes para um mapa para acesso rápido
  const nodeMap = {};
  nodes.forEach(node => {
    nodeMap[node.id] = node;
  });
  
  let currentNodeId = 'start';
  
  while (currentNodeId && currentNodeId !== 'end') {
    if (shouldStop()) break;
    
    const currentNode = nodeMap[currentNodeId];
    if (!currentNode || currentNode.data.type === 'start') {
      // Ir para o próximo nó
      const nextEdge = edges.find(e => e.source === currentNodeId && !e.sourceHandle);
      currentNodeId = nextEdge ? nextEdge.target : null;
      continue;
    }
    
    if (currentNode.data.type === 'end') {
      break;
    }
    
    // Converter node para step
    const step = {
      id: currentNode.id,
      type: currentNode.data.type
    };
    
    // Copiar propriedades do data
    Object.keys(currentNode.data).forEach(key => {
      if (key !== 'label' && key !== 'type') {
        step[key] = currentNode.data[key];
      }
    });
    
    console.log('[Flow] Executando nó:', step.customName || step.type);
    
    // Executar o step
    const result = await executeStep(step, config, modifierList, 1, 1, shiftState);
    
    // Determinar qual edge seguir baseado no resultado
    let nextEdge = null;
    
    if (step.type === 'checkRegion' || step.type === 'checkTooltip') {
      // checkRegion/checkTooltip tem branching true/false
      if (result?.found) {
        // Seguir a edge com sourceHandle="true"
        nextEdge = edges.find(e => e.source === currentNodeId && e.sourceHandle === 'true');
        
        // Se a próxima edge leva ao END, retornar o resultado imediatamente
        if (nextEdge && nextEdge.target === 'end') {
          return result;
        }
      } else {
        // Seguir a edge com sourceHandle="false"
        nextEdge = edges.find(e => e.source === currentNodeId && e.sourceHandle === 'false');
      }
    } else {
      // Outros steps seguem a edge normal (sem sourceHandle)
      nextEdge = edges.find(e => e.source === currentNodeId && !e.sourceHandle);
    }
    
    currentNodeId = nextEdge ? nextEdge.target : null;
  }
  
  return { found: false };
}

async function executeStep(step, config, modifierList, index, total, shiftState) {
  console.log('[executeStep] Recebido:', JSON.stringify(step, null, 2));
  const displayName = step.customName || step.type;
  sendLog(`🔵 ${displayName}`, 'info');
  
  const type = step?.type || 'unknown';
  switch (type) {
    case 'leftClick': {
      const pos = step.position;
      if (!pos) {
        sendLog(`❌ Erro: "${displayName}" sem posição válida. Capture a posição no editor visual.`, 'error');
        return { found: false };
      }
      
      // Converter coordenadas relativas → absolutas
      const absolutePos = convertToAbsoluteCoordinates(pos);
      if (!absolutePos || typeof absolutePos.x !== 'number' || typeof absolutePos.y !== 'number') {
        sendLog(`❌ Erro: "${displayName}" conversão de coordenadas falhou.`, 'error');
        return { found: false };
      }
      
      // Se useShift está marcado e Shift ainda não foi pressionado, pressionar agora
      if (step.useShift && shiftState && !shiftState.shiftPressed()) {
        await nutjs.keyboard.pressKey(nutjs.Key.LeftShift);
        shiftState.setShiftPressed(true);
        sendLog('⬆️ Shift pressionado', 'success');
        await delay(50);
      }
      
      // Se Shift não deve ser usado mas está pressionado, liberar
      if (!step.useShift && shiftState && shiftState.shiftPressed()) {
        await nutjs.keyboard.releaseKey(nutjs.Key.LeftShift);
        shiftState.setShiftPressed(false);
        sendLog('⬇️ Shift liberado', 'info');
        await delay(50);
      }
      
      // Usar o novo controller de mouse com coordenadas absolutas
      try {
        await mouseController.leftClick(absolutePos.x, absolutePos.y);
      } catch (error) {
        sendLog(`❌ Erro ao clicar: ${error.message}`, 'error');
        return { found: false };
      }
      
      // Delay após o clique
      const postClickDelay = step.delayMs || 50;
      await delay(postClickDelay);
      
      return { found: false };
    }
    
    case 'rightClick': {
      const pos = step.position;
      if (!pos) {
        sendLog(`❌ Erro: "${displayName}" sem posição válida. Capture a posição no editor visual.`, 'error');
        return { found: false };
      }
      
      // Converter coordenadas relativas → absolutas
      const absolutePos = convertToAbsoluteCoordinates(pos);
      if (!absolutePos || typeof absolutePos.x !== 'number' || typeof absolutePos.y !== 'number') {
        sendLog(`❌ Erro: "${displayName}" conversão de coordenadas falhou.`, 'error');
        return { found: false };
      }
      
      // Usar o novo controller de mouse com coordenadas absolutas
      try {
        await mouseController.rightClick(absolutePos.x, absolutePos.y);
      } catch (error) {
        sendLog(`❌ Erro ao clicar: ${error.message}`, 'error');
        return { found: false };
      }
      
      const postClickDelay = step.delayMs || 100;
      await delay(postClickDelay);
      
      return { found: false };
    }
    
    case 'checkRegion': {
      const region = step.region || config.tooltipRegion;
      if (!region) {
        sendLog(`❌ Erro: "${displayName}" sem região definida.`, 'error');
        return { found: false };
      }
      
      console.log(`[executeStep checkRegion] Região original:`, JSON.stringify(region, null, 2));
      
      // Converter região relativa → absoluta
      const absoluteRegion = convertRegionToAbsolute(region);
      
      console.log(`[executeStep checkRegion] Região convertida:`, JSON.stringify(absoluteRegion, null, 2));
      
      if (!absoluteRegion) {
        sendLog(`❌ Erro: "${displayName}" conversão de região falhou.`, 'error');
        sendLog(`Região recebida: ${JSON.stringify(region)}`, 'error');
        return { found: false };
      }
      
      const buffers = await captureRegionForOCR(absoluteRegion, { saveDebug: true, prefix: 'checkRegion' });
      const { text, lines } = await extractTextWithDetails(buffers);
      
      const detectedMods = lines
        .map(l => l.text.trim())
        .filter(l => l.length > 5)
        .slice(0, 2)
        .join(' | ');
      
      sendLog(`Detectado: ${detectedMods || text.substring(0, 60).replace(/\n/g, ' ')}`, 'debug');
      
      // Enviar mods detectados para o histórico
      if (historyWindow && !historyWindow.isDestroyed()) {
        const modsArray = lines
          .map(l => l.text.trim())
          .filter(l => l.length > 5);
        modsArray.forEach(mod => {
          historyWindow.webContents.send('crafting-modifier-found', { text: mod });
        });
      }
      
      // Se o nó tem modificadores específicos configurados, usar eles
      let targetModifierList = modifierList;
      if (Array.isArray(step.modifierList) && step.modifierList.length > 0) {
        targetModifierList = step.modifierList.map(mod => ({
          pattern: mod.pattern || mod.text || '',
          text: mod.text || mod.pattern || '',
          minValue: mod.minValue ?? null,
          maxValue: mod.maxValue ?? null,
          useRange: mod.useRange || mod.hasRange || (mod.minValue !== null && mod.minValue !== undefined) || (mod.maxValue !== null && mod.maxValue !== undefined)
        }));
        const summary = step.modifierList.map(m => m.text || m.pattern).filter(Boolean).join(' | ');
        sendLog(`🎯 Procurando por (nó): ${summary}`, 'debug');
      } else if (step.modifierText && step.modifierText.trim()) {
        targetModifierList = [{ pattern: step.modifierText.trim(), useRange: false }];
        sendLog(`🎯 Procurando por (nó legado): ${step.modifierText}`, 'debug');
      }
      
      const matchedMod = targetModifierList && targetModifierList.length > 0
        ? findMatchingModifier(text, targetModifierList)
        : null;
      
      if (matchedMod) {
        // Enviar para janela de histórico
        if (historyWindow && !historyWindow.isDestroyed()) {
          historyWindow.webContents.send('crafting-modifier-found', matchedMod);
        }
        return { found: true, matchedMod, detected: detectedMods };
      }
      
      return { found: false };
    }
    
    case 'delay': {
      const ms = step.delayMs || 0;
      sendLog(`⏱️ Aguardando ${ms}ms...`, 'debug');
      await delay(ms);
      return { found: false };
    }
    
    default:
      sendLog(`⚠️ Tipo de nó desconhecido: ${type}`, 'warning');
      return { found: false };
  }
}

async function stopCrafting() {
  crafterState.isRunning = false;
  crafterState.stopRequested = true;
  
  try {
    await nutjs.keyboard.releaseKey(nutjs.Key.LeftShift);
  } catch (e) {
  }
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('crafting-complete', {
      found: false,
      attempts: crafterState.attempts,
      duration: crafterState.startTime ? Date.now() - crafterState.startTime : 0
    });
  }
}

// IPC Handlers
ipcMain.on('reset-crafting-history', () => {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.webContents.send('crafting-reset');
  }
});

ipcMain.on('pause-crafting-history', () => {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.webContents.send('crafting-paused');
  }
});

ipcMain.on('start-crafting', async (event, config) => {
  if (crafterState.isRunning) return;
  crafterState.stopRequested = false;
  clearStopSignal();
  runCrafting(config);
});

ipcMain.on('stop-crafting', () => {
  createStopSignal(); // Cria o sinal de parada
  forceStopCrafting('Botão Parar');
});

ipcMain.on('set-always-on-top', (event, value) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(value);
  }
});

ipcMain.on('test-ocr', async (event, { tooltipRegion }) => {
  try {
    sendLog('Capturando região em 2 segundos...', 'info');
    await delay(2000);
    
    const buffers = await captureRegionForOCR(tooltipRegion, { saveDebug: true, prefix: 'checkTooltip' });
    const { text } = await extractTextWithDetails(buffers);
    
    mainWindow.webContents.send('ocr-result', {
      text: text,
      hasModifier: false
    });
    
    // Salva imagem de debug (apenas em dev)
    if (process.env.AUTOCRAFT_DEBUG === '1') {
      const debugPath = DEBUG_DIR;
      if (!fs.existsSync(debugPath)) {
        fs.mkdirSync(debugPath, { recursive: true });
      }
      const image = await Jimp.read(imageBuffer);
      await image.writeAsync(path.join(debugPath, 'ocr_test.png'));
      sendLog('Imagem salva em debug/ocr_test.png', 'info');
    }
    
  } catch (error) {
    sendLog(`Erro no OCR: ${error.message}`, 'error');
  }
});

let selectionWindow = null;
let currentSelectionMode = null;
let wasMaximizedBeforeSelection = false;

function createSelectionWindow(payload) {
  const mode = typeof payload === 'object' ? payload.mode : payload;
  currentSelectionMode = payload;
  
  // Salva o estado anterior
  wasMaximizedBeforeSelection = mainWindow.isMaximized();
  
  console.log('[DEBUG] createSelectionWindow:', { payload, mode, currentSelectionMode });
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  selectionWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  const modeText = {
    'chaos': 'Clique na posição do CHAOS ORB',
    'item': 'Clique na posição do ITEM ALVO', 
    'tooltip': 'Clique no canto SUPERIOR ESQUERDO do tooltip',
    'tooltip-end': 'Clique no canto INFERIOR DIREITO do tooltip',
    'custom-step': 'Clique na posição para esta etapa',
    'position': 'Clique na posição desejada'
  };
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; }
        body {
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.3);
          cursor: crosshair;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-top: 50px;
          font-family: 'Segoe UI', sans-serif;
        }
        .instruction {
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 20px 40px;
          border-radius: 10px;
          text-align: center;
          border: 2px solid #e94560;
        }
        .instruction h2 {
          color: #e94560;
          margin-bottom: 10px;
          font-size: 24px;
        }
        .instruction p {
          color: #aaa;
          font-size: 14px;
        }
        .crosshair {
          position: fixed;
          pointer-events: none;
        }
        .crosshair-h {
          width: 40px;
          height: 2px;
          background: #e94560;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        .crosshair-v {
          width: 2px;
          height: 40px;
          background: #e94560;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
      </style>
    </head>
    <body>
      <div class="instruction">
        <h2>${modeText[mode] || 'Clique para capturar a posição'}</h2>
        <p>Pressione ESC para cancelar</p>
      </div>
      <div class="crosshair" id="crosshair">
        <div class="crosshair-h"></div>
        <div class="crosshair-v"></div>
      </div>
      <script>
        const { ipcRenderer } = require('electron');
        const crosshair = document.getElementById('crosshair');
        
        console.log('[SELECTION WINDOW] Inicializado');
        
        document.addEventListener('mousemove', (e) => {
          crosshair.style.left = e.clientX + 'px';
          crosshair.style.top = e.clientY + 'px';
        });
        
        document.addEventListener('click', (e) => {
          console.log('[SELECTION WINDOW] Click em:', { x: e.screenX, y: e.screenY });
          ipcRenderer.send('selection-clicked', { x: e.screenX, y: e.screenY });
        });
        
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            console.log('[SELECTION WINDOW] ESC pressionado');
            ipcRenderer.send('selection-cancelled');
          }
        });
      </script>
    </body>
    </html>
  `;
  
  selectionWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  selectionWindow.setFullScreen(true);
}

ipcMain.on('selection-clicked', (event, position) => {
  const payload = currentSelectionMode;
  const mode = typeof payload === 'object' ? payload.mode : payload;
  const context = typeof payload === 'object' ? payload.context : null;
  const stepTarget = typeof payload === 'object' ? payload.stepTarget : null;
  const nodeId = typeof payload === 'object' ? payload.nodeId : null;
  
  console.log('[DEBUG] selection-clicked:', { payload, mode, context, stepTarget, position });
  
  if (selectionWindow) {
    selectionWindow.close();
    selectionWindow = null;
  }
  
  // Restaura o estado anterior (maximizado ou não)
  if (wasMaximizedBeforeSelection) {
    mainWindow.maximize();
  }
  mainWindow.focus();
  
  const messageToSend = {
    mode: mode === 'tooltip' ? 'tooltip-start' : mode,
    position: position,
    context: context,
    stepTarget,
    nodeId
  };
  console.log('[DEBUG] Enviando position-selected:', messageToSend);
  mainWindow.webContents.send('position-selected', messageToSend);
});

ipcMain.on('selection-cancelled', () => {
  if (selectionWindow) {
    selectionWindow.close();
    selectionWindow = null;
  }
  // Restaura o estado anterior
  if (wasMaximizedBeforeSelection) {
    mainWindow.maximize();
  }
  mainWindow.focus();
  sendLog('Seleção cancelada', 'warning');
});

ipcMain.on('start-selection', async (event, payload) => {
  createSelectionWindow(payload);
});

ipcMain.on('cancel-selection', () => {
  if (mainWindow) {
    // Restaura o estado anterior
    if (wasMaximizedBeforeSelection) {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('save-config', (event, config) => {
  saveConfig(config);
});

ipcMain.on('request-config', () => {
  loadConfig();
});

ipcMain.on('get-mods', (event) => {
  // Retorna os mods carregados globalmente
  event.returnValue = global.validMods || [];
});

// === Handlers para React Flow ===

ipcMain.on('sync-flow-to-simple', (event, { nodeId, data }) => {
  // Sincronizar de React Flow para a lista simples
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync-flow-to-simple', { nodeId, data });
  }
});

ipcMain.on('delete-flow-node', (event, nodeId) => {
  // Deletar nó e sincronizar
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('delete-flow-node', nodeId);
  }
});

ipcMain.on('sync-simple-to-flow', (event, { nodeId, data }) => {
  // Sincronizar de simples para React Flow
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync-simple-to-flow', { nodeId, data });
  }
});

ipcMain.on('save-flow', (event, flowData) => {
  saveConfig(flowData);
  sendLog('Fluxo salvo com sucesso', 'success');
  
  // Enviar de volta para o renderer atualizar o state
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('flow-saved', flowData);
  }
});

// Exportar flow para arquivo JSON
ipcMain.on('export-flow', async (event, flowData) => {
  try {
    const { dialog } = require('electron');
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Flow',
      defaultPath: `autocraft-flow-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [
        { name: 'AutoCraft Flow', extensions: ['json'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(flowData, null, 2), 'utf-8');
      sendLog(`Flow exportado para: ${path.basename(result.filePath)}`, 'success');
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('show-notification', {
          type: 'success',
          message: `✅ Flow exportado com sucesso!\n\n${flowData.nodes.length} nós e ${flowData.edges.length} conexões`
        });
      }
    }
  } catch (error) {
    console.error('[Export Flow] Erro:', error);
    sendLog(`Erro ao exportar flow: ${error.message}`, 'error');
  }
});

// Importar flow de arquivo JSON
ipcMain.on('import-flow-request', async (event) => {
  try {
    const { dialog } = require('electron');
    
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar Flow',
      filters: [
        { name: 'AutoCraft Flow', extensions: ['json'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const flowData = JSON.parse(fileContent);
      
      // Validar estrutura do flow
      if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
        throw new Error('Arquivo inválido: faltam os nodes');
      }
      
      if (!flowData.edges || !Array.isArray(flowData.edges)) {
        throw new Error('Arquivo inválido: faltam as edges');
      }
      
      // Verificar se tem os nodes start e end
      const hasStart = flowData.nodes.some(n => n.id === 'start');
      const hasEnd = flowData.nodes.some(n => n.id === 'end');
      
      if (!hasStart || !hasEnd) {
        throw new Error('Arquivo inválido: flow precisa ter nodes "start" e "end"');
      }
      
      sendLog(`Flow importado: ${path.basename(filePath)} (${flowData.nodes.length} nós, ${flowData.edges.length} conexões)`, 'success');
      
      // Enviar para o renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('flow-imported', flowData);
      }
    }
  } catch (error) {
    console.error('[Import Flow] Erro:', error);
    sendLog(`Erro ao importar flow: ${error.message}`, 'error');
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('show-notification', {
        type: 'error',
        message: `❌ Erro ao importar flow:\n\n${error.message}`
      });
    }
  }
});

// === Fim dos Handlers ===


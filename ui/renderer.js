const { ipcRenderer } = require('electron');

console.log('[RENDERER INIT] Renderer process iniciado!');

// Captura erros não tratados
window.addEventListener('error', (e) => {
  console.error('[RENDERER ERROR]', e.error);
});

process.on('uncaughtException', (error) => {
  console.error('[RENDERER UNCAUGHT]', error);
});

// Estado da aplicação - MODO APENAS FLUXOGRAMA
const state = {
  tooltipRegion: null,
  isRunning: false,
  modifierList: [],
  flowSteps: null,
  flowNodes: null,
  flowEdges: null
};

// Elementos DOM - APENAS FLUXOGRAMA
const elements = {
  maxAttempts: document.getElementById('maxAttempts'),
  delayBetween: document.getElementById('delayBetween'),
  delayAfterChaos: document.getElementById('delayAfterChaos'),
  btnStart: document.getElementById('btnStart'),
  btnStop: document.getElementById('btnStop'),
  btnTest: document.getElementById('btnTest'),
  statusText: document.getElementById('statusText'),
  attemptCount: document.getElementById('attemptCount'),
  elapsedTime: document.getElementById('elapsedTime'),
  logOutput: document.getElementById('logOutput'),
  logSearchInput: document.getElementById('logSearchInput'),
  btnClearSearch: document.getElementById('btnClearSearch')
};

// ==================== REMOVA A SEÇÃO DE TABS ====================
// (Não há mais seleção de modo - apenas fluxograma)

// ==================== APENAS FLUXOGRAMA ====================
// Toda a lógica da aba simples foi removida
// O sistema agora funciona 100% com o editor visual de fluxograma

// Função para abrir modal de tutorial com gif
function openTooltipTutorial(gifPath) {
  elements.tooltipGif.src = gifPath;
  elements.tooltipModal.classList.remove('hidden');
}

function openEditStepDialog(index) {
  const step = state.steps[index];
  if (!step || !elements.editStepModal) return;
  state.editingStepIndex = index;
  elements.editStepType.value = step.type || 'selectCurrency';
  elements.editStepPosX.value = step.position ? step.position.x : '';
  elements.editStepPosY.value = step.position ? step.position.y : '';
  elements.editStepUseItemPos.checked = step.useItemPosition !== undefined ? step.useItemPosition : true;
  elements.editStepUseShift.checked = !!step.useShift;
  elements.editStepDelay.value = step.delayMs ? step.delayMs : '';
  state.editTooltipRegion = step.tooltipRegion ? { ...step.tooltipRegion } : null;
  if (state.editTooltipRegion) {
    elements.editStepTooltipRegion.textContent =
      `X: ${state.editTooltipRegion.x}, Y: ${state.editTooltipRegion.y}, ` +
      `W: ${state.editTooltipRegion.width}, H: ${state.editTooltipRegion.height}`;
  } else {
    elements.editStepTooltipRegion.textContent = 'Não configurado';
  }
  updateEditStepFieldsVisibility();
  elements.editStepModal.classList.remove('hidden');
}

function closeEditStepDialog() {
  if (!elements.editStepModal) return;
  elements.editStepModal.classList.add('hidden');
  state.editingStepIndex = null;
  state.editTooltipRegion = null;
  state.editTooltipStartPoint = null;
}

if (elements.btnCloseEditModal) {
  elements.btnCloseEditModal.addEventListener('click', closeEditStepDialog);
}

if (elements.btnCancelEdit) {
  elements.btnCancelEdit.addEventListener('click', closeEditStepDialog);
}

if (elements.editStepModal) {
  elements.editStepModal.addEventListener('click', (e) => {
    if (e.target === elements.editStepModal) {
      closeEditStepDialog();
    }
  });
}

if (elements.editStepType) {
  elements.editStepType.addEventListener('change', updateEditStepFieldsVisibility);
}

if (elements.btnCaptureEditPos) {
  elements.btnCaptureEditPos.addEventListener('click', () => {
    state.pendingStepTarget = 'edit';
    log('Capturando posição para editar a etapa...', 'info');
    ipcRenderer.send('start-selection', { mode: 'custom-step', stepTarget: 'edit' });
  });
}

if (elements.btnCaptureEditTooltip) {
  elements.btnCaptureEditTooltip.addEventListener('click', () => {
    state.pendingTooltipTarget = 'edit';
    state.editTooltipStartPoint = null;
    log('Capturando região do tooltip (edição)...', 'info');
    ipcRenderer.send('start-selection', { mode: 'tooltip', stepTarget: 'edit' });
  });
}

if (elements.btnSaveEdit) {
  elements.btnSaveEdit.addEventListener('click', () => {
    const idx = state.editingStepIndex;
    if (idx === null || idx === undefined) return;
    const updatedStep = buildStepFromEditForm(idx);
    if (!updatedStep) return;
    state.steps[idx] = updatedStep;
    renderStepList();
    closeEditStepDialog();
    log('Etapa atualizada.', 'success');
  });
}

// ==================== APENAS FLUXOGRAMA ====================
// renderStepList e funções de etapas foram removidas
// O sistema agora usa apenas o editor visual de fluxograma

// ==================== LOGS ====================

const MAX_LOG_LINES = 200; // Limita linhas para performance
let logSearchTerm = '';

function log(message, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line log-${type}`;
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  line.textContent = `[${time}] ${message}`;
  line.title = message; // Tooltip com mensagem completa
  line.setAttribute('data-message', message.toLowerCase()); // Para busca
  
  // Aplicar filtro de busca se houver
  if (logSearchTerm && !message.toLowerCase().includes(logSearchTerm)) {
    line.style.display = 'none';
  }
  
  elements.logOutput.appendChild(line);
  
  // Limita número de linhas para melhor performance
  while (elements.logOutput.children.length > MAX_LOG_LINES) {
    elements.logOutput.removeChild(elements.logOutput.firstChild);
  }
  
  // Auto-scroll para a última mensagem
  requestAnimationFrame(() => {
    elements.logOutput.scrollTop = elements.logOutput.scrollHeight;
  });
}

function filterLogs() {
  const searchTerm = elements.logSearchInput.value.toLowerCase().trim();
  logSearchTerm = searchTerm;
  
  const logLines = elements.logOutput.querySelectorAll('.log-line');
  let visibleCount = 0;
  
  logLines.forEach(line => {
    const message = line.getAttribute('data-message') || line.textContent.toLowerCase();
    if (!searchTerm || message.includes(searchTerm)) {
      line.style.display = '';
      visibleCount++;
    } else {
      line.style.display = 'none';
    }
  });
  
  // Mostrar quantos resultados foram encontrados
  if (searchTerm) {
    console.log(`Busca: "${searchTerm}" - ${visibleCount} resultado(s) encontrado(s)`);
  }
}

function clearLog() {
  elements.logOutput.innerHTML = '';
}

// Atualiza displays de posição
function updatePositionDisplays() {
  if (state.chaosPosition) {
    elements.chaosPos.textContent = `X: ${state.chaosPosition.x}, Y: ${state.chaosPosition.y}`;
  }
  if (state.itemPosition) {
    elements.itemPos.textContent = `X: ${state.itemPosition.x}, Y: ${state.itemPosition.y}`;
  }
  if (state.tooltipRegion) {
    elements.stepTooltipRegion.textContent = 
      `X: ${state.tooltipRegion.x}, Y: ${state.tooltipRegion.y}, ` +
      `W: ${state.tooltipRegion.width}, H: ${state.tooltipRegion.height}`;
  }
}

// Inicia modo de seleção
function startSelection(mode) {
  state.selectionMode = mode;
  state.tooltipStartPoint = null;
  
  const messages = {
    chaos: 'Clique na posição do Chaos Orb',
    item: 'Clique na posição do Item Alvo',
    tooltip: 'Clique no canto SUPERIOR ESQUERDO do tooltip'
  };
  
  log(`${messages[mode]} - Janela será minimizada em 1 segundo...`, 'warning');
  
  // Minimiza a janela e inicia captura global
  setTimeout(() => {
    ipcRenderer.send('start-selection', mode);
  }, 1000);
}

// Cancela seleção (não mais necessário, mas mantemos para ESC)
function cancelSelection() {
  state.selectionMode = null;
  state.tooltipStartPoint = null;
}

// Recebe posição capturada globalmente do main process
ipcRenderer.on('position-selected', (event, { mode, position, stepTarget, context, nodeId }) => {
  console.log('[DEBUG position-selected]', { mode, position, stepTarget, context, nodeId });
  
  // Se é contexto do flow editor, repassa para o componente React
  if (context === 'flow-editor-node') {
    if (mode === 'tooltip-start') {
      state.flowEditorTooltipStartPoint = position;
      log(`Tooltip (flow-editor): canto superior esquerdo X=${position.x}, Y=${position.y}`, 'warning');
      setTimeout(() => {
        ipcRenderer.send('start-selection', { mode: 'tooltip-end', context: 'flow-editor-node', nodeId });
      }, 1000);
      return;
    }
    if (mode === 'tooltip-end' && state.flowEditorTooltipStartPoint) {
      const startX = Math.min(state.flowEditorTooltipStartPoint.x, position.x);
      const startY = Math.min(state.flowEditorTooltipStartPoint.y, position.y);
      const width = Math.abs(position.x - state.flowEditorTooltipStartPoint.x);
      const height = Math.abs(position.y - state.flowEditorTooltipStartPoint.y);
      const region = { x: startX, y: startY, width, height };
      window.dispatchEvent(new CustomEvent('flowEditorTooltipRegionSelected', { detail: { region, nodeId } }));
      log(`Tooltip (flow-editor): X=${startX}, Y=${startY}, W=${width}, H=${height}`, 'success');
      state.flowEditorTooltipStartPoint = null;
      return;
    }
    console.log('[RENDERER] Captura de posição para flow-editor:', position);
    // Dispara evento customizado para o flow-editor escutar
    window.dispatchEvent(new CustomEvent('flowEditorPositionSelected', { detail: { position, nodeId } }));
    log('Posição capturada no flow-editor: X=' + position.x + ', Y=' + position.y, 'success');
    return;
  }

  if (mode === 'chaos') {
    state.chaosPosition = position;
    log(`Chaos Orb posicionado em: X=${position.x}, Y=${position.y}`, 'success');
  } else if (mode === 'item') {
    state.itemPosition = position;
    log(`Item posicionado em: X=${position.x}, Y=${position.y}`, 'success');
  } else if (mode === 'tooltip-start') {
    const target = stepTarget || state.pendingTooltipTarget || 'main';
    if (target === 'edit') {
      state.editTooltipStartPoint = position;
      log(`Canto superior esquerdo: X=${position.x}, Y=${position.y}. Agora clique no canto INFERIOR DIREITO.`, 'warning');
      setTimeout(() => {
        ipcRenderer.send('start-selection', { mode: 'tooltip-end', stepTarget: 'edit' });
      }, 1000);
      return;
    }
    state.tooltipStartPoint = position;
    log(`Canto superior esquerdo: X=${position.x}, Y=${position.y}. Agora clique no canto INFERIOR DIREITO.`, 'warning');
    setTimeout(() => {
      ipcRenderer.send('start-selection', { mode: 'tooltip-end', stepTarget: 'main' });
    }, 1000);
    return;
  } else if (mode === 'tooltip-end') {
    const target = stepTarget || state.pendingTooltipTarget || 'main';
    if (target === 'edit' && state.editTooltipStartPoint) {
      const startX = Math.min(state.editTooltipStartPoint.x, position.x);
      const startY = Math.min(state.editTooltipStartPoint.y, position.y);
      const width = Math.abs(position.x - state.editTooltipStartPoint.x);
      const height = Math.abs(position.y - state.editTooltipStartPoint.y);
      state.editTooltipRegion = { x: startX, y: startY, width, height };
      elements.editStepTooltipRegion.textContent =
        `X: ${startX}, Y: ${startY}, W: ${width}, H: ${height}`;
      log(`Região do tooltip (edição): X=${startX}, Y=${startY}, W=${width}, H=${height}`, 'success');
    } else if (state.tooltipStartPoint) {
      const startX = Math.min(state.tooltipStartPoint.x, position.x);
      const startY = Math.min(state.tooltipStartPoint.y, position.y);
      const width = Math.abs(position.x - state.tooltipStartPoint.x);
      const height = Math.abs(position.y - state.tooltipStartPoint.y);
      state.tooltipRegion = { x: startX, y: startY, width, height };
      log(`Região do tooltip: X=${startX}, Y=${startY}, W=${width}, H=${height}`, 'success');
    }
    state.pendingTooltipTarget = null;
  } else if (mode === 'custom-step') {
    console.log('[DEBUG] custom-step detectado. stepTarget:', stepTarget);
    if (stepTarget === 'draft') {
      console.log('[DEBUG] Preenchendo inputs com:', { x: position.x, y: position.y });
      
      // Garante que o tipo está configurado para mostrar posição
      if (elements.stepType.value !== 'selectCurrency' && elements.stepType.value !== 'applyOnItem') {
        console.log('[DEBUG] Alterando stepType de', elements.stepType.value, 'para selectCurrency');
        elements.stepType.value = 'selectCurrency';
        updateStepFieldsVisibility();
      }
      
      // Verifica visibilidade antes de atribuir
      const positionField = document.querySelector('.step-form [data-field="position"]');
      console.log('[DEBUG] Visibilidade antes:', positionField.style.display);
      
      elements.stepPosX.value = position.x;
      elements.stepPosY.value = position.y;
      console.log('[DEBUG] Inputs após atribuição:', { x: elements.stepPosX.value, y: elements.stepPosY.value });
      console.log('[DEBUG] Visibilidade após:', positionField.style.display);
      log(`✓ Posição capturada para etapa: X=${position.x}, Y=${position.y}`, 'success');
      // Trigger change event para sincronizar
      elements.stepPosX.dispatchEvent(new Event('change'));
      elements.stepPosY.dispatchEvent(new Event('change'));
    } else if (stepTarget === 'edit') {
      if (elements.editStepType.value !== 'selectCurrency' && elements.editStepType.value !== 'applyOnItem') {
        elements.editStepType.value = 'selectCurrency';
        updateEditStepFieldsVisibility();
      }
      elements.editStepPosX.value = position.x;
      elements.editStepPosY.value = position.y;
      log(`✓ Posição capturada para edição: X=${position.x}, Y=${position.y}`, 'success');
      elements.editStepPosX.dispatchEvent(new Event('change'));
      elements.editStepPosY.dispatchEvent(new Event('change'));
    } else {
      console.log('[DEBUG] custom-step recebido mas stepTarget não é draft:', stepTarget);
    }
  } else {
    console.log('[DEBUG] Nenhuma condição correspondeu. Mode:', mode, 'stepTarget:', stepTarget);
  }
  
  state.selectionMode = null;
  updatePositionDisplays();
});

// Tecla ESC para cancelar
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.selectionMode) {
      cancelSelection();
      log('Seleção cancelada', 'warning');
    } else if (state.isRunning) {
      stopCrafting();
    }
  }
});

// Validação antes de iniciar
function validateConfig() {
  // Apenas usando flow graph agora - validação mínima
  const advancedTab = document.getElementById('tab-advanced');
  const usingFlow = advancedTab && advancedTab.classList.contains('active') && state.flowNodes && state.flowEdges && state.flowNodes.length > 0;
  
  if (usingFlow) {
    log('✅ Usando Flow Graph', 'success');
    return true;
  }
  
  // Se não tiver flow, avisa
  if (!state.flowNodes || state.flowNodes.length === 0) {
    log('Erro: Crie um fluxo no editor antes de iniciar', 'error');
    return false;
  }
  
  return true;
}

// Iniciar crafting
elements.btnStart.addEventListener('click', () => {
  if (!validateConfig()) return;
  
  const modifiersToSend = Array.isArray(state.modifierList) ? [...state.modifierList] : [];

  // Verificar se está usando flow do editor avançado
  let stepsToUse = state.steps;
  let flowGraph = null;
  const advancedTab = document.getElementById('tab-advanced');
  
  console.log('[Renderer Debug] Tab ativa:', advancedTab ? advancedTab.classList.contains('active') : 'null');
  console.log('[Renderer Debug] flowNodes:', state.flowNodes);
  console.log('[Renderer Debug] flowEdges:', state.flowEdges);
  
  if (advancedTab && advancedTab.classList.contains('active') && state.flowNodes && state.flowEdges) {
    flowGraph = { nodes: state.flowNodes, edges: state.flowEdges };
    stepsToUse = null; // Não usar steps lineares quando tiver flow
    console.log('[Renderer Debug] Usando flowGraph!');
  } else {
    console.log('[Renderer Debug] Usando steps simples');
  }

  const config = {
    chaosPosition: state.chaosPosition,
    itemPosition: state.itemPosition,
    tooltipRegion: state.tooltipRegion,
    modifiers: modifiersToSend,
    steps: stepsToUse,
    flowGraph: flowGraph,
    maxAttempts: parseInt(elements.maxAttempts.value),
    delayBetween: parseInt(elements.delayBetween.value),
    delayAfterChaos: parseInt(elements.delayAfterChaos.value)
  };
  
  console.log('[Renderer Debug] Config enviado:', JSON.stringify(config, null, 2));
  state.isRunning = true;
  elements.btnStart.disabled = true;
  elements.btnStop.disabled = false;
  elements.statusText.textContent = 'Executando...';
  elements.statusText.classList.add('running');
  
  log('Iniciando crafting automático...', 'info');
  ipcRenderer.send('start-crafting', config);
  
  // Resetar histórico de modificadores
  ipcRenderer.send('reset-crafting-history');
});

// Parar crafting
function stopCrafting() {
  state.isRunning = false;
  elements.btnStart.disabled = false;
  elements.btnStop.disabled = true;
  elements.statusText.textContent = 'Parado';
  elements.statusText.classList.remove('running');
  
  ipcRenderer.send('stop-crafting');
  
  // Pausar histórico de modificadores
  ipcRenderer.send('pause-crafting-history');
  
  log('Crafting parado pelo usuário', 'warning');
}

elements.btnStop.addEventListener('click', stopCrafting);

// Testar OCR
elements.btnTest.addEventListener('click', () => {
  if (!state.tooltipRegion) {
    log('Erro: Selecione a região do Tooltip primeiro', 'error');
    return;
  }
  
  log('Testando OCR...', 'info');
  ipcRenderer.send('test-ocr', { tooltipRegion: state.tooltipRegion });
});

// Receber mensagens do main process
ipcRenderer.on('log', (event, { message, type }) => {
  log(message, type);
});

ipcRenderer.on('update-status', (event, { attempts, elapsed }) => {
  elements.attemptCount.textContent = attempts;
  elements.elapsedTime.textContent = elapsed;
});

ipcRenderer.on('crafting-complete', (event, { found, attempts, duration }) => {
  state.isRunning = false;
  elements.btnStart.disabled = false;
  elements.btnStop.disabled = true;
  elements.statusText.textContent = found ? '✅ Encontrado!' : 'Concluído';
  elements.statusText.classList.remove('running');
  
  if (found) {
    log(`🎉 MODIFICADOR ENCONTRADO após ${attempts} tentativas!`, 'success');
    // Alerta sonoro
    new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1sbJisjoyQjot9d3h2i5uNhIaGe3Jvb3qLmY6IjIyBeXZ2eYudjYaKi4B1dHR3jJ+OhYuLfnN0dHeOoI6EjIt8cXNzdJGhjYOMi3txc3N0k6KNg42LenBycnSVo42CjYt5cHJydJajjIKOinhwcXJ1l6SMgY6Kd3BxcnaYpYyBj4p2b3FydpmljICPindvcHJ3mqWMf5CJdm9wcniapYx/kIl1b3Byd5umjH6QiXVvcHJ3m6aMfpCJdG5wcXebpox+kIl0bnBxd5ymjH6QiXRucHF3nKaMfpCJdG5wcXecpox+kIl0bnBxd5ymjH6QiXRucHF3nKaMfpCJdG5wcXecpox+kIl0bnBxd5ymjH6QiXRucHF3nKaMfpGJdG5wcXebpox+kYl0bnFxd5uljH6RiXRucXF3m6WMfpGJdG5xcXeapYx+kYl0b3Fxd5qljH+RiXRvcXJ3mqWMf5GJdW9xcneapYx/kYl1b3Fyd5qljICRiXVwcXJ3mqWMgJGJdXBxcneapYyAkYl1cHFyd5qli4CRiXVwcXJ3mqWLgJGJdXBxcneapYuAkol2cHFyd5qli4CSiXZwcnJ4m6WLgJKJdnByc3ibpYuAkol2cHJzeJuli4CSiXZwcnN4m6WLgJKJdnByc3ibpYuAkol2cHNzeJyli4CTiXZxc3N4m6WLgJOJdnFzc3ibpYuAk4l2cXNzeJuli4CUiXZxc3N4nKWLgJSJdnFzc3icpYuAlIl2cXNzeJyli4CUiXZxc3N4nKWLgJSJdnFzc3icpYuAlIl2cXN0eJyli4CUindxc3R4nKWLgJSKd3F0dHicpYuAlIp3cXR0eJyli4CUindxdHR4nKWLgJSKd3F0dHicpYuAlIp3cXR0eJylioGUindydHR4nKWKgZSKd3J0dHicpYqBlIp3cnR0eJylioGUindydHV4nKWKgZSKd3J0dXmcpYqBlIp3cnR1eZylioGUi3dydHV5nKWKgZSLd3J0dXmcpYqBlIt4cnR1eZylioGVi3hydHV5nKWKgZWLeHJ0dXmcpYqBlYt4cnR1eZylioGVi3hydHV5nKSKgZWLeHJ1dXmco4qBlYt4cnV1eZyjioGVi3hydXV5nKOJgZWLeHJ1dXmco4mBlYt4cnV1eZyjiYGVi3hydXV5nKOJgZWLeHJ1dXmco4mBlYt4cnV1eZyjiYKVi3hydXV5nKOJgpWMeHJ1dnmco4mClYx4cnV2eZyjiYKVjHhydXZ5nKKJgpWMeHN1dnmcoYmClYx4c3V2eZyhiYKVjHhzdXZ5nKGJgpWMeHN1dnmcoYmClYx4c3V2eZyhiYOVjHhzdXZ5nKGJg5WNeHN1dnqcoYmDlY14c3V2epyhiYOVjXhzdXZ6nKGJg5WNeHN1dnqcoYmDlY14c3V2epyhiYOVjXhzdXZ6nKGJg5WNeHN1dnqcoYiDlY14c3V2epyhiIOVjXhzdXd6nKGIg5WNeHN1d3qcoIiDlY14c3V3epygiIOWjXhzdXd6nKCIg5aNeHN2d3qcoIiDlo14c3Z3epygiIOWjnhzdnd6nKCIg5aOeHR2d3qcoIiDlo54dHZ3ep2giIOWjnh0dnd6naCIg5aOeHR2d3qdoIiDlo54dHZ3ep2giIOWjnh0dnd6naCIg5aOeHR2d3qdoIiDlo54dHZ4ep2gh4OWjnh0dnh6naCHg5aOeHR2eHqdoIeDlo54dHZ4ep2gh4OWjnh0dnh6naCHg5aOeHR2eHqdoIeDlo54dHZ4ep2gh4OWjnh0dnh6naCHg5ePeHR2eHqdoIeDl494dHZ4ep2gh4OXj3h0dnh6naCHg5ePeHR2eHqdoIeDl494dXZ4ep2gh4OXj3h1dnh6naCHg5ePeHV2eHqdoIeDl494dXZ4ep2gh4OXj3h1dnh6naCHg5ePeHV2eHqdoIeDl494dXZ4ep2gh4OXj3h1dnh6naCHg5ePeHV2eHqdoIeDl494dXZ4ep2gh4SXj3h1dnh6naCHhJePeHV2eHqdoIeEl494dXZ4ep2gh4SXj3h1d3h6nZ+HhJePeHV3eHqdn4eEl494dXd4ep2fh4SXj3h1d3h6nZ+HhJePeHV3eHqdn4eEl494dXd4ep2fh4SXj3h1d3h6nZ+HhJePeHV3eHqdn4eEl494dXd4ep2fh4SXkHh1d3h7nZ+HhJeQeHV3eXudn4eEl5B4dXd5e52fh4SXkHh1d3l7nZ+HhJeQeHV3eXudn4eEl5B4dXd5e52fh4SXkHh1d3l7nZ+HhJeQeHV3eXudn4eEl5B4dXd5e52eh4SXkHh1d3l7nZ6HhJeQeHV3eXudn4eEl5B4dXd5e52eh4SXkHh2d3l7nZ6HhJeQeHZ3eXudn4eEl5B4dnd5e52eh4SXkHh2d3l7nZ6HhJeQeHZ3eXudn4eEl5B4dnd5e52eh4SXkHh2d3l7nZ6HhJeQeHZ4eXudn4eEl5B4dnh5e52eh4SXkHh2eHl7nZ6HhJeQeHZ4eXudn4eEl5B4dnh5e52eh4SXkHh2eHl7nZ6HhA==').play();
  } else {
    log(`Limite de ${attempts} tentativas atingido`, 'warning');
  }
});

ipcRenderer.on('ocr-result', (event, { text, hasModifier }) => {
  log(`OCR detectou: "${text.substring(0, 100)}..."`, 'info');
  log(`Modificador encontrado: ${hasModifier ? 'SIM' : 'Não'}`, hasModifier ? 'success' : 'warning');
});

// Carregar configuração salva
ipcRenderer.on('load-config', (event, config) => {
  if (config.chaosPosition) state.chaosPosition = config.chaosPosition;
  if (config.itemPosition) state.itemPosition = config.itemPosition;
  if (config.tooltipRegion) state.tooltipRegion = config.tooltipRegion;
  if (Array.isArray(config.modifiers)) {
    state.modifierList = config.modifiers;
  }
  if (Array.isArray(config.steps)) {
    state.steps = config.steps;
    renderStepList();
  }
  if (config.maxAttempts) elements.maxAttempts.value = config.maxAttempts;
  if (config.delayBetween) elements.delayBetween.value = config.delayBetween;
  if (config.delayAfterChaos) elements.delayAfterChaos.value = config.delayAfterChaos;
  
  updatePositionDisplays();
  log('Configuração anterior carregada', 'info');
});

// Salvar configuração ao fechar
window.addEventListener('beforeunload', () => {
  const config = {
    chaosPosition: state.chaosPosition,
    itemPosition: state.itemPosition,
    tooltipRegion: state.tooltipRegion,
    modifiers: state.modifierList,
    steps: state.steps,
    maxAttempts: elements.maxAttempts.value,
    delayBetween: elements.delayBetween.value,
    delayAfterChaos: elements.delayAfterChaos.value
  };
  ipcRenderer.send('save-config', config);
});

// === IPC Handlers para React Flow ===

// Receber mudanças do React Flow e atualizar o tab Simples
ipcRenderer.on('sync-flow-to-simple', (event, { nodeId, data }) => {
  const stepIndex = state.steps.findIndex(s => s.id === nodeId);
  if (stepIndex !== -1) {
    state.steps[stepIndex] = { ...state.steps[stepIndex], ...data };
    renderStepList();
    log(`Etapa ${nodeId} atualizada via React Flow`, 'info');
  }
});

// Deletar nó do React Flow
ipcRenderer.on('delete-flow-node', (event, nodeId) => {
  const stepIndex = state.steps.findIndex(s => s.id === nodeId);
  if (stepIndex !== -1) {
    state.steps.splice(stepIndex, 1);
    renderStepList();
    log(`Etapa ${nodeId} deletada`, 'info');
  }
});

// Enviar atualizações do tab Simples para o React Flow
function syncSimpleToFlow(stepId, data) {
  if (window.flowEditor) {
    ipcRenderer.send('sync-simple-to-flow', { nodeId: stepId, data });
  }
}

// Receber flow salvo do editor avançado
ipcRenderer.on('flow-saved', (event, flowData) => {
  if (flowData && flowData.nodes && flowData.edges) {
    state.flowNodes = flowData.nodes;
    state.flowEdges = flowData.edges;
    state.flowSteps = null; // Limpar o formato antigo
    log('Fluxo visual salvo com grafo de nós e conexões', 'success');
  }
});

// Mostrar notificações
ipcRenderer.on('show-notification', (event, notification) => {
  if (notification.type === 'success') {
    alert(notification.message);
  } else if (notification.type === 'error') {
    alert(notification.message);
  }
});

// === Fim dos Handlers ===

// Event listeners para busca nos logs
if (elements.logSearchInput) {
  // Filtrar enquanto digita
  elements.logSearchInput.addEventListener('input', filterLogs);
  
  // Filtrar ao pressionar Enter
  elements.logSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      filterLogs();
    }
  });
}

if (elements.btnClearSearch) {
  elements.btnClearSearch.addEventListener('click', () => {
    elements.logSearchInput.value = '';
    logSearchTerm = '';
    filterLogs();
  });
}

// Inicialização
renderStepList();
log('AutoCraft iniciado. Configure as posições e clique em Iniciar.', 'info');
ipcRenderer.send('request-config');

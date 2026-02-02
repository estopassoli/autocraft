import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const { ipcRenderer, screen } = window.require ? window.require('electron') : { ipcRenderer: null, screen: null };

// Função para buscar mods do main process
const getAllMods = () => {
  if (!ipcRenderer) {
    console.warn('⚠️ IPC não disponível, retornando array vazio');
    return [];
  }
  try {
    console.log('📞 Chamando get-mods via IPC...');
    const mods = ipcRenderer.sendSync('get-mods');
    console.log(`📦 Recebidos ${mods ? mods.length : 0} mods do main process`);
    if (mods && mods.length > 0) {
      console.log('Primeiros 3 mods:', mods.slice(0, 3));
    } else {
      console.error('❌ Array de mods está VAZIO ou undefined!');
    }
    return Array.isArray(mods) ? mods : [];
  } catch (e) {
    console.error('❌ Erro ao buscar mods via IPC:', e);
    return [];
  }
};

// Tenta carregar mods imediatamente
let modsArray = getAllMods();

// Se estiver vazio, tenta novamente após um delay
if (modsArray.length === 0) {
  console.warn('⏳ Mods vazios, tentando novamente em 500ms...');
  setTimeout(() => {
    modsArray = getAllMods();
    if (modsArray.length > 0) {
      console.log('✅ Mods carregados com sucesso após retry!');
      window.dispatchEvent(new Event('mods-ready'));
    }
  }, 500);
}

// Converte array de strings em objetos
const buildModifiers = (modsArray) => {
  return modsArray.map((modText, index) => ({
  id: `explicit_${index}`,
  text: modText,
  group: 'Explicit',
  type: 'explicit'
  }));
};

let MODIFIERS = buildModifiers(modsArray);
let EXPLICIT_MODIFIERS = MODIFIERS;

console.log(`✅ Total de ${MODIFIERS.length} mods EXPLICIT carregados no UI`);

// Atualiza quando os mods chegarem
window.addEventListener('mods-ready', () => {
  MODIFIERS = buildModifiers(modsArray);
  EXPLICIT_MODIFIERS = MODIFIERS;
  console.log(`🔄 Mods atualizados: ${MODIFIERS.length} disponíveis`);
});

const NODE_TYPES = {
  start: { label: '▶️ Início', color: '#51cf66', icon: '▶️' },
  end: { label: '⏹️ Fim', color: '#ff6b6b', icon: '⏹️' },
  leftClick: { label: '🖱️ Clique Esquerdo', color: '#6bd17c', icon: '🖱️' },
  rightClick: { label: '🖱️ Clique Direito', color: '#d4a351', icon: '🖱️' },
  checkRegion: { label: '🔍 Verificar Região', color: '#f0b45a', icon: '🔍' },
  delay: { label: '⏱️ Delay', color: '#8b7ba8', icon: '⏱️' },
};

// Nó individual
function Node({ data, id, isConnectable, onUpdate, onDelete, onEdit }) {
  const capturingRef = useRef(false);
  const capturingTooltipRef = useRef(false);

  const typeColor = NODE_TYPES[data.type]?.color || '#8b7ba8';
  const textColor = data.type === 'leftClick' ? '#0a1a0f' : '#1a1307';
  const isSystemNode = data.type === 'start' || data.type === 'end';
  const nodeStyle = isSystemNode
    ? {
        background: 'linear-gradient(135deg, rgba(28, 25, 34, 0.95), rgba(42, 42, 50, 0.9))',
        color: '#e8e8ea',
        border: '2px solid rgba(212, 163, 81, 0.4)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(212, 163, 81, 0.15) inset'
      }
    : {
        background: `linear-gradient(135deg, ${typeColor}dd, ${typeColor}aa)`,
        color: textColor,
        border: `2px solid ${typeColor}`,
        boxShadow: `0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 0 20px ${typeColor}33`
      };

  // Usar nome customizado se existir, senão usar label padrão
  const displayLabel = data.customName || data.label;

  return (
    <div style={{ ...nodeStyle, fontWeight: '600', borderRadius: '12px', padding: '12px 16px', minWidth: '300px', textAlign: 'center', fontSize: '0.88rem', position: 'relative', transition: 'all 0.2s ease', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility' }}>
      {data.type !== 'start' && <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ width: '14px', height: '14px', border: '2px solid rgba(0,0,0,0.3)', boxShadow: '0 0 10px rgba(212, 163, 81, 0.5)', background: '#d4a351' }} />}
      {displayLabel}
      {data.position && <div style={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.5)', marginTop: '2px' }}>{data.position.x},{data.position.y}</div>}
      {data.delayMs && <div style={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.5)' }}>+{data.delayMs}ms</div>}
      {data.useShift && <div style={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.5)' }}>⬆️ Shift</div>}
      {data.type === 'checkRegion' && data.region && <div style={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.5)', marginTop: '2px' }}>R: {data.region.x},{data.region.y}</div>}
      {data.type === 'checkRegion' && Array.isArray(data.modifierList) && data.modifierList.length > 0 && (
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', marginTop: '6px', background: 'rgba(0,0,0,0.25)', padding: '4px 8px', borderRadius: '6px', fontWeight: '500', border: '1px solid rgba(255,255,255,0.1)' }}>
          🔍 Mods: {data.modifierList.length} • {data.modifierList[0].text?.substring(0, 28) || data.modifierList[0].pattern?.substring(0, 28)}{(data.modifierList[0].text || data.modifierList[0].pattern || '').length > 28 ? '...' : ''}
        </div>
      )}
      {!isSystemNode && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'center' }}>
          <button onClick={() => onEdit(id, data)} style={{ padding: '4px 10px', fontSize: '0.7rem', background: 'rgba(212, 163, 81, 0.25)', border: '1px solid rgba(212, 163, 81, 0.4)', borderRadius: '6px', color: '#f6f1e4', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s ease' }}>✏️</button>
          <button onClick={() => onDelete(id)} style={{ padding: '4px 10px', fontSize: '0.7rem', background: 'rgba(255, 107, 107, 0.25)', border: '1px solid rgba(255, 107, 107, 0.4)', borderRadius: '6px', color: '#ffd4d4', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s ease' }}>✕</button>
        </div>
      )}

      {data.type === 'checkRegion' ? (
        <>
          <Handle id="false" type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ left: '30%', backgroundColor: '#ff6b6b', width: '14px', height: '14px', border: '2px solid rgba(0,0,0,0.3)', boxShadow: '0 0 10px rgba(255, 107, 107, 0.5)' }} />
          <Handle id="true" type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ left: '70%', backgroundColor: '#51cf66', width: '14px', height: '14px', border: '2px solid rgba(0,0,0,0.3)', boxShadow: '0 0 10px rgba(81, 207, 102, 0.5)' }} />
          <div style={{ position: 'absolute', bottom: '-20px', left: '22%', fontSize: '0.68rem', color: '#ff6b6b', fontWeight: '600', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>Não</div>
          <div style={{ position: 'absolute', bottom: '-20px', left: '64%', fontSize: '0.68rem', color: '#51cf66', fontWeight: '600', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>Sim</div>
        </>
      ) : data.type !== 'end' ? (
        <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ width: '14px', height: '14px', border: '2px solid rgba(0,0,0,0.3)', boxShadow: '0 0 10px rgba(212, 163, 81, 0.5)' }} />
      ) : null}
    </div>
  );
}

function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, onDelete, showDelete }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(id); }}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            border: '1px solid rgba(212, 163, 81, 0.6)',
            background: 'rgba(20, 17, 26, 0.95)',
            color: '#e7c889',
            fontSize: '12px',
            cursor: 'pointer',
            opacity: showDelete ? 1 : 0,
            pointerEvents: showDelete ? 'all' : 'none',
            transition: 'opacity 120ms ease-in-out',
          }}
          title="Remover conexão"
        >
          ×
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

// Dialog Global para Edição de Nodes (fora do ReactFlow)
function NodeEditDialog({ nodeData, nodeId, onSave, onClose }) {
  const [formData, setFormData] = useState(nodeData || {});
  const [modSearch, setModSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const capturingRef = useRef(false);
  const capturingTooltipRef = useRef(false);

  const filteredModifiers = useMemo(() => {
    const query = modSearch.trim().toLowerCase();
    
    // Usa EXPLICIT_MODIFIERS para "Checar Área", MODIFIERS para outros
    const modsToUse = nodeData.type === 'checkRegion' ? EXPLICIT_MODIFIERS : MODIFIERS;
    
    console.log(`🔎 Busca: "${query}"`);
    console.log(`📊 Total de mods disponíveis (${nodeData.type === 'checkRegion' ? 'EXPLICIT' : 'TODOS'}): ${modsToUse.length}`);
    
    // Sem busca: retorna primeiros 50 para não sobrecarregar
    if (!query) {
      const result = modsToUse.slice(0, 50);
      console.log(`  → Sem busca, retornando ${result.length} primeiros mods`);
      return result;
    }
    
    // Com busca: retorna TODOS os resultados que batem
    const results = modsToUse.filter(mod => {
      const textLower = mod.text.toLowerCase();
      const groupLower = mod.group.toLowerCase();
      
      // Busca em texto e grupo
      return textLower.includes(query) || groupLower.includes(query);
    });
    
    console.log(`  → Encontrados ${results.length} mods para "${query}"`);
    if (results.length > 0 && results.length <= 5) {
      console.log('  → Exemplos:', results.map(r => r.text));
    }
    
    // Limita a 200 resultados para performance
    return results.slice(0, 200);
  }, [modSearch, nodeData.type]);

  useEffect(() => {
    setFormData(nodeData || {});
  }, [nodeData]);

  useEffect(() => {
    const handleCapture = (event) => {
      if (!capturingRef.current || event.detail.nodeId !== nodeId) return;
      const { position, screenWidth, screenHeight } = event.detail;

      const relativeX = (position.x / screenWidth) * 100;
      const relativeY = (position.y / screenHeight) * 100;

      setFormData(prev => ({
        ...prev,
        position: {
          x: position.x,
          y: position.y,
          relativeX: relativeX,
          relativeY: relativeY
        }
      }));
      capturingRef.current = false;
    };

    const handleRegionCapture = (event) => {
      if (!capturingTooltipRef.current || event.detail.nodeId !== nodeId) return;
      const { region, screenWidth, screenHeight } = event.detail;

      const relativeX = (region.x / screenWidth) * 100;
      const relativeY = (region.y / screenHeight) * 100;
      const relativeWidth = (region.width / screenWidth) * 100;
      const relativeHeight = (region.height / screenHeight) * 100;

      setFormData(prev => ({
        ...prev,
        region: {
          ...region,
          relativeX: relativeX,
          relativeY: relativeY,
          relativeWidth: relativeWidth,
          relativeHeight: relativeHeight
        }
      }));
      capturingTooltipRef.current = false;
    };

    window.addEventListener('flowEditorPositionSelected', handleCapture);
    window.addEventListener('flowEditorTooltipRegionSelected', handleRegionCapture);
    return () => {
      window.removeEventListener('flowEditorPositionSelected', handleCapture);
      window.removeEventListener('flowEditorTooltipRegionSelected', handleRegionCapture);
    };
  }, [nodeId]);

  const addModifierToNode = (mod) => {
    setFormData(prev => {
      const current = Array.isArray(prev.modifierList) ? prev.modifierList : [];
      const exists = current.some(m => (m.id || m.text) === (mod.id || mod.text));
      if (exists) return prev;
      return {
        ...prev,
        modifierList: [
          ...current,
          {
            id: mod.id || mod.text,
            text: mod.text,
            pattern: mod.text,
            minValue: null,
            maxValue: null,
            useRange: false
          }
        ]
      };
    });
    setModSearch('');
    setIsDropdownOpen(false);
  };

  const updateModifierAt = (index, updates) => {
    setFormData(prev => {
      const current = Array.isArray(prev.modifierList) ? [...prev.modifierList] : [];
      const existing = current[index];
      if (!existing) return prev;
      const next = { ...existing, ...updates };
      next.useRange = next.minValue !== null && next.minValue !== undefined && next.minValue !== ''
        ? true
        : (next.maxValue !== null && next.maxValue !== undefined && next.maxValue !== '');
      current[index] = next;
      return { ...prev, modifierList: current };
    });
  };

  const removeModifierAt = (index) => {
    setFormData(prev => {
      const current = Array.isArray(prev.modifierList) ? [...prev.modifierList] : [];
      current.splice(index, 1);
      return { ...prev, modifierList: current };
    });
  };

  const handleSave = () => {
    onSave(nodeId, formData);
    onClose();
  };

  if (!nodeData) return null;

  const isSystemNode = nodeData.type === 'start' || nodeData.type === 'end';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }} onClick={onClose}>
      <div style={{ background: 'linear-gradient(135deg, rgba(20, 17, 26, 0.98), rgba(28, 25, 34, 0.95))', border: '2px solid rgba(212, 163, 81, 0.4)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto', color: '#f6f1e4', zIndex: 10001, boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(212, 163, 81, 0.1) inset' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: '15px', color: '#d4a351', fontSize: '1rem' }}>Editar Nó</h3>

        {!isSystemNode && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.8rem', color: '#b9a98a', display: 'block', marginBottom: '4px' }}>Nome do Nó</label>
            <input
              type="text"
              value={formData.customName || ''}
              onChange={(e) => setFormData({ ...formData, customName: e.target.value })}
              style={{ width: '100%', padding: '6px', background: 'rgba(28, 25, 34, 0.9)', border: '1px solid rgba(212, 163, 81, 0.35)', borderRadius: '4px', color: '#f6f1e4', fontSize: '0.8rem' }}
              placeholder={nodeData.label}
            />
          </div>
        )}

        {(nodeData.type === 'leftClick' || nodeData.type === 'rightClick') && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.8rem', color: '#b9a98a', display: 'block', marginBottom: '4px' }}>Posição do Clique</label>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input type="number" value={formData.position?.x || ''} onChange={(e) => {
                const x = parseInt(e.target.value) || 0;
                const bounds = screen ? screen.getPrimaryDisplay().bounds : { width: window.innerWidth, height: window.innerHeight };
                const screenWidth = bounds.width;
                const relativeX = (x / screenWidth) * 100;
                setFormData({
                  ...formData,
                  position: {
                    ...(formData.position || {}),
                    x: x,
                    relativeX: relativeX
                  }
                });
              }} style={{ width: '48%', maxWidth: '144px', padding: '6px', background: 'rgba(28, 25, 34, 0.9)', border: '1px solid rgba(212, 163, 81, 0.35)', borderRadius: '4px', color: '#f6f1e4', fontSize: '0.8rem' }} placeholder="X" />
              <input type="number" value={formData.position?.y || ''} onChange={(e) => {
                const y = parseInt(e.target.value) || 0;
                const bounds = screen ? screen.getPrimaryDisplay().bounds : { width: window.innerWidth, height: window.innerHeight };
                const screenHeight = bounds.height;
                const relativeY = (y / screenHeight) * 100;
                setFormData({
                  ...formData,
                  position: {
                    ...(formData.position || {}),
                    y: y,
                    relativeY: relativeY
                  }
                });
              }} style={{ width: '48%', maxWidth: '144px', padding: '6px', background: 'rgba(28, 25, 34, 0.9)', border: '1px solid rgba(212, 163, 81, 0.35)', borderRadius: '4px', color: '#f6f1e4', fontSize: '0.8rem' }} placeholder="Y" />
            </div>
            <button onClick={() => { capturingRef.current = true; ipcRenderer.send('start-selection', { mode: 'position', context: 'flow-editor-node', nodeId: nodeId }); }} style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg, #8b7ba8, #a090c0)', border: '1px solid rgba(139, 123, 168, 0.5)', borderRadius: '8px', color: '#f6f1e4', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', boxShadow: '0 4px 12px rgba(139, 123, 168, 0.3)', transition: 'all 0.2s ease' }}>📍 Capturar Posição</button>
          </div>
        )}

        {nodeData.type === 'checkRegion' && (
          <>
            <div style={{ marginBottom: '12px', position: 'relative' }}>
              <label style={{ fontSize: '0.8rem', color: '#b9a98a', display: 'block', marginBottom: '4px' }}>Buscar modificadores</label>
              <input
                type="text"
                value={modSearch}
                onChange={(e) => setModSearch(e.target.value)}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                placeholder="Digite para filtrar mods..."
                style={{ width: '100%', padding: '6px', background: 'rgba(28, 25, 34, 0.9)', border: '1px solid rgba(212, 163, 81, 0.35)', borderRadius: '4px', color: '#f6f1e4', fontSize: '0.8rem' }}
              />
              {isDropdownOpen && (
              <div style={{ position: 'absolute', zIndex: 1000, width: '100%', maxHeight: '200px', overflow: 'auto', marginTop: '4px', border: '1px solid rgba(212, 163, 81, 0.4)', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(20, 17, 26, 0.98), rgba(28, 25, 34, 0.95))', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                {filteredModifiers.length === 0 && (
                  <div style={{ padding: '8px', fontSize: '0.75rem', color: '#b9a98a' }}>Nenhum resultado</div>
                )}
                {filteredModifiers.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => addModifierToNode(mod)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', color: '#f6f1e4', cursor: 'pointer', fontSize: '0.78rem', borderBottom: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.15s ease' }}
                    title={mod.text}
                  >
                    <div style={{ color: '#e7c889', fontSize: '0.72rem' }}>{mod.group}</div>
                    <div>{mod.text}</div>
                  </button>
                ))}
              </div>
              )}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', color: '#b9a98a', display: 'block', marginBottom: '6px' }}>Modificadores selecionados</label>
              {Array.isArray(formData.modifierList) && formData.modifierList.length > 0 ? (
                formData.modifierList.map((mod, index) => (
                  <div key={`${mod.id}-${index}`} style={{ marginBottom: '10px', padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(28, 25, 34, 0.8), rgba(35, 30, 40, 0.7))', border: '1px solid rgba(212, 163, 81, 0.35)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#f6f1e4', marginBottom: '6px' }}>{mod.text || mod.pattern}</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="number"
                        value={mod.minValue ?? ''}
                        onChange={(e) => updateModifierAt(index, { minValue: e.target.value === '' ? null : parseInt(e.target.value) })}
                        placeholder="Min"
                        style={{ width: '48%', padding: '6px', background: 'rgba(20, 17, 26, 0.9)', border: '1px solid rgba(212, 163, 81, 0.2)', borderRadius: '4px', color: '#f6f1e4', fontSize: '0.75rem' }}
                      />
                      <input
                        type="number"
                        value={mod.maxValue ?? ''}
                        onChange={(e) => updateModifierAt(index, { maxValue: e.target.value === '' ? null : parseInt(e.target.value) })}
                        placeholder="Max"
                        style={{ width: '48%', padding: '6px', background: 'rgba(20, 17, 26, 0.9)', border: '1px solid rgba(212, 163, 81, 0.2)', borderRadius: '4px', color: '#f6f1e4', fontSize: '0.75rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#b9a98a' }}>{mod.useRange ? 'Com range' : 'Sem range'}</span>
                      <button onClick={() => removeModifierAt(index)} style={{ padding: '5px 10px', background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.3), rgba(200, 50, 50, 0.25))', border: '1px solid rgba(255, 107, 107, 0.4)', borderRadius: '6px', color: '#ffd4d4', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '500', transition: 'all 0.2s ease', boxShadow: '0 2px 6px rgba(255, 107, 107, 0.2)' }}>Remover</button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#b9a98a', padding: '6px', background: 'rgba(28, 25, 34, 0.5)', borderRadius: '4px' }}>Nenhum modificador selecionado</div>
              )}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', color: '#b9a98a', display: 'block', marginBottom: '4px' }}>Região para Verificar</label>
              <div style={{ fontSize: '0.75rem', color: '#f6f1e4', marginBottom: '8px', padding: '6px', background: 'rgba(28, 25, 34, 0.5)', borderRadius: '4px' }}>
                {formData.region
                  ? `X: ${formData.region.x}, Y: ${formData.region.y}, W: ${formData.region.width}, H: ${formData.region.height}`
                  : 'Não configurado'}
              </div>
              <button onClick={() => { capturingTooltipRef.current = true; ipcRenderer.send('start-selection', { mode: 'tooltip', context: 'flow-editor-node', nodeId: nodeId }); }} style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg, #8b7ba8, #a090c0)', border: '1px solid rgba(139, 123, 168, 0.5)', borderRadius: '8px', color: '#f6f1e4', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', boxShadow: '0 4px 12px rgba(139, 123, 168, 0.3)', transition: 'all 0.2s ease' }}>📸 Capturar Região</button>
            </div>
          </>
        )}

        {nodeData.type !== 'delay' && (nodeData.type === 'leftClick' || nodeData.type === 'rightClick' || nodeData.type === 'delay') && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.8rem', color: '#b9a98a', display: 'block', marginBottom: '4px' }}>Delay Após Ação (ms)</label>
            <input type="number" value={formData.delayMs || ''} onChange={(e) => setFormData({ ...formData, delayMs: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '6px', background: 'rgba(28, 25, 34, 0.9)', border: '1px solid rgba(212, 163, 81, 0.35)', borderRadius: '4px', color: '#f6f1e4', fontSize: '0.8rem' }} placeholder="0" />
          </div>
        )}

        {nodeData.type === 'delay' && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.8rem', color: '#b9a98a', display: 'block', marginBottom: '4px' }}>Tempo de Espera (ms)</label>
            <input type="number" value={formData.delayMs || ''} onChange={(e) => setFormData({ ...formData, delayMs: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '6px', background: 'rgba(28, 25, 34, 0.9)', border: '1px solid rgba(212, 163, 81, 0.35)', borderRadius: '4px', color: '#f6f1e4', fontSize: '0.8rem' }} placeholder="0" />
          </div>
        )}

        {nodeData.type === 'leftClick' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '12px', fontSize: '0.8rem' }}>
            <input type="checkbox" checked={formData.useShift || false} onChange={(e) => setFormData({ ...formData, useShift: e.target.checked })} />
            Segurar Shift ao clicar
          </label>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleSave} style={{ flex: 1, padding: '8px', background: 'linear-gradient(135deg, #e7c889, #d4a351)', border: '1px solid rgba(212, 163, 81, 0.5)', borderRadius: '8px', color: '#1a1307', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(212, 163, 81, 0.3)' }}>Salvar</button>
          <button onClick={onClose} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid rgba(212, 163, 81, 0.35)', borderRadius: '8px', color: '#b9a98a', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Toolbar Item Component (Drag Source)
function ToolbarItem({ type, label, icon, color, onAddNode }) {
  const onDragStart = (event) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => onAddNode(type)}
      style={{
        background: color,
        borderRadius: '8px',
        padding: '12px',
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        border: '2px solid rgba(0,0,0,0.2)',
        transition: 'all 0.2s ease',
        userSelect: 'none'
      }}
      onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
      onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
      title="Clique ou arraste para adicionar"
    >
      <div style={{ fontSize: '1.5rem' }}>{icon}</div>
      <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'rgba(0,0,0,0.8)', textAlign: 'center', lineHeight: '1.1' }}>
        {label}
      </div>
    </div>
  );
}

// Editor Principal
function FlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState([
    { id: 'start', type: 'node', data: { label: NODE_TYPES.start.label, type: 'start' }, position: { x: 250, y: 50 }, deletable: false },
    { id: 'end', type: 'node', data: { label: NODE_TYPES.end.label, type: 'end' }, position: { x: 250, y: 400 }, deletable: false },
  ]);

  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  
  // Estado global para dialog de edição
  const [editingNode, setEditingNode] = useState(null);

  const [selectedType, setSelectedType] = useState('leftClick');
  const [flowMetadata, setFlowMetadata] = useState(() => ({
    createdAt: new Date().toISOString(),
    screenResolution: screen ? {
      width: screen.getPrimaryDisplay().bounds.width,
      height: screen.getPrimaryDisplay().bounds.height
    } : null
  }));

  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const handleDeleteNode = (id) => {
    if (id === 'start' || id === 'end') return;
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
  };
  
  const handleEditNode = (id, data) => {
    setEditingNode({ id, data });
  };

  const nodeTypes = useMemo(() => ({
    node: (props) => <Node {...props} onUpdate={(id, data) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data } : n))} onDelete={handleDeleteNode} onEdit={handleEditNode} />
  }), [setNodes]);

  const edgeTypes = useMemo(() => ({
    deletable: (props) => (
      <DeletableEdge
        {...props}
        showDelete={hoveredEdgeId === props.id}
        onDelete={(edgeId) => setEdges(eds => eds.filter(e => e.id !== edgeId))}
      />
    )
  }), [setEdges, hoveredEdgeId]);

  const handleAddNode = (nodeType = null) => {
    const type = nodeType || selectedType;
    if (type === 'start' || type === 'end') return;
    const numericIds = nodes.map(n => parseInt(n.id)).filter(n => !isNaN(n));
    const newId = String(numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1);
    setNodes(nds => [...nds, {
      id: newId,
      type: 'node',
      data: {
        label: NODE_TYPES[type].label,
        type: type,
        position: null,
        customName: '' // Nome vazio por padrão
      },
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 150 },
    }]);
  };

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      if (!reactFlowInstance) return;

      const type = JSON.parse(event.dataTransfer.getData('application/reactflow'));

      if (!type || !type.type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const numericIds = nodes.map(n => parseInt(n.id)).filter(n => !isNaN(n));
      const newId = String(numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1);

      const newNode = {
        id: newId,
        type: 'node',
        position,
        data: {
          label: NODE_TYPES[type.type].label,
          type: type.type,
          position: null,
          customName: ''
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, nodes, setNodes]
  );

  const handleAutoLayout = () => {
    // Criar mapa de adjacências para encontrar a ordem dos nós
    const adjacencyMap = {};
    nodes.forEach(node => {
      adjacencyMap[node.id] = [];
    });
    edges.forEach(edge => {
      if (!adjacencyMap[edge.source]) adjacencyMap[edge.source] = [];
      adjacencyMap[edge.source].push(edge.target);
    });

    // BFS para encontrar níveis hierárquicos
    const levels = {};
    const visited = new Set();
    const queue = [{ id: 'start', level: 0 }];

    while (queue.length > 0) {
      const { id, level } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);

      if (!levels[level]) levels[level] = [];
      levels[level].push(id);

      const neighbors = adjacencyMap[id] || [];
      neighbors.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          queue.push({ id: neighborId, level: level + 1 });
        }
      });
    }

    // Adicionar nós não visitados (isolados) no final
    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const maxLevel = Math.max(...Object.keys(levels).map(k => parseInt(k)));
        const newLevel = maxLevel + 1;
        if (!levels[newLevel]) levels[newLevel] = [];
        levels[newLevel].push(node.id);
      }
    });

    // Posicionar nós
    const HORIZONTAL_SPACING = 350;
    const VERTICAL_SPACING = 150;
    const START_X = 250;
    const START_Y = 50;

    const newNodes = nodes.map(node => {
      // Encontrar nível do nó
      let nodeLevel = 0;
      let positionInLevel = 0;

      for (const [level, nodesInLevel] of Object.entries(levels)) {
        const index = nodesInLevel.indexOf(node.id);
        if (index !== -1) {
          nodeLevel = parseInt(level);
          positionInLevel = index;
          break;
        }
      }

      const nodesInCurrentLevel = levels[nodeLevel] || [];
      const totalNodesInLevel = nodesInCurrentLevel.length;

      // Centralizar nós no nível
      const levelWidth = (totalNodesInLevel - 1) * HORIZONTAL_SPACING;
      const startXForLevel = START_X - levelWidth / 2;

      return {
        ...node,
        position: {
          x: startXForLevel + positionInLevel * HORIZONTAL_SPACING,
          y: START_Y + nodeLevel * VERTICAL_SPACING
        }
      };
    });

    setNodes(newNodes);
  };

  const handleSave = () => {
    // Converter nodes para steps
    const steps = [];

    // Começar do node start e seguir as conexões
    let currentNodeId = 'start';
    const visitedNodes = new Set();

    while (currentNodeId && currentNodeId !== 'end') {
      if (visitedNodes.has(currentNodeId)) break;
      visitedNodes.add(currentNodeId);

      const currentNode = nodes.find(n => n.id === currentNodeId);
      if (!currentNode || currentNode.data.type === 'start') {
        // Procurar próximo node
        const nextEdge = edges.find(e => e.source === currentNodeId);
        currentNodeId = nextEdge ? nextEdge.target : null;
        continue;
      }

      // Converter node para step - copia todas as props do data
      const step = {
        id: currentNode.id,
        type: currentNode.data.type
      };

      // Copiar todas as propriedades do data para o step
      Object.keys(currentNode.data).forEach(key => {
        if (key !== 'label' && key !== 'type') {
          step[key] = currentNode.data[key];
        }
      });

      // Validações baseadas no novo tipo
      const displayName = step.customName || NODE_TYPES[step.type]?.label || step.type;

      if ((step.type === 'leftClick' || step.type === 'rightClick') && !step.position) {
        alert(`❌ Nó "${displayName}" (ID: ${step.id}) precisa ter uma posição capturada.\n\nClique em ✏️ e depois em "📍 Capturar Posição" para definir onde clicar.`);
        return;
      }

      if (step.type === 'checkRegion' && !step.region) {
        alert(`❌ Nó "${displayName}" (ID: ${step.id}) precisa ter uma região capturada.\n\nClique em ✏️ e depois em "📸 Capturar Região" para definir a área a verificar.`);
        return;
      }

      if (step.type === 'checkRegion' && (!Array.isArray(step.modifierList) || step.modifierList.length === 0)) {
        alert(`❌ Nó "${displayName}" (ID: ${step.id}) precisa ter ao menos 1 modificador.\n\nClique em ✏️, pesquise o mod e adicione à lista.`);
        return;
      }

      // Debug: log do step
      console.log(`[Flow Debug] Step ${step.id} (${step.type}):`, step);

      steps.push(step);

      // Procurar próximo node
      const nextEdge = edges.find(e => e.source === currentNodeId);
      currentNodeId = nextEdge ? nextEdge.target : null;
    }

    const flowData = { nodes, edges };
    flowData.metadata = {
      ...flowMetadata,
      nodeCount: nodes.length,
      edgeCount: edges.length
    };
    if (ipcRenderer) ipcRenderer.send('save-flow', flowData);
    alert('✅ Fluxo salvo com sucesso!');
  };

  const handleExportFlow = () => {
    const exportData = {
      version: '1.0',
      nodes,
      edges,
      metadata: {
        ...flowMetadata,
        createdAt: flowMetadata?.createdAt || new Date().toISOString(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      }
    };

    if (ipcRenderer) {
      ipcRenderer.send('export-flow', exportData);
    }
  };

  const handleImportFlow = () => {
    if (ipcRenderer) {
      ipcRenderer.send('import-flow-request');
    }
  };

  // Listener para quando o flow for importado
  useEffect(() => {
    if (!ipcRenderer) return;

    const handleFlowImported = (event, flowData) => {
      if (flowData && flowData.nodes && flowData.edges) {
        console.log('[Flow Import] Importando flow:', flowData);
        setNodes(flowData.nodes);
        setEdges(flowData.edges);
        if (flowData.metadata) {
          setFlowMetadata(flowData.metadata);
        }
        alert(`✅ Flow importado com sucesso!\n\n${flowData.nodes.length} nós e ${flowData.edges.length} conexões carregados.`);
      }
    };

    ipcRenderer.on('flow-imported', handleFlowImported);

    return () => {
      ipcRenderer.removeListener('flow-imported', handleFlowImported);
    };
  }, [setNodes, setEdges]);

  const onConnect = useCallback((params) => {
    setEdges((eds) => {
      if (params.source === 'start' && eds.some(e => e.source === 'start')) return eds;
      return addEdge({
        ...params,
        type: 'deletable',
        animated: true,
        style: { stroke: '#d4a351', strokeWidth: 2.5, filter: 'drop-shadow(0 0 4px rgba(212, 163, 81, 0.5))' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#d4a351', width: 20, height: 20 },
        pathOptions: { borderRadius: 16 }
      }, eds);
    });
  }, [setEdges]);

  const handleClearAll = () => {
    if (confirm('⚠️ Deseja realmente apagar TODOS os nós e conexões?\n\nEsta ação não pode ser desfeita!')) {
      setNodes([
        { id: 'start', type: 'node', data: { label: NODE_TYPES.start.label, type: 'start' }, position: { x: 250, y: 50 }, deletable: false },
        { id: 'end', type: 'node', data: { label: NODE_TYPES.end.label, type: 'end' }, position: { x: 250, y: 400 }, deletable: false },
      ]);
      setEdges([]);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0b0a0f 0%, #12101a 50%, #0e0c14 100%)', borderRadius: '12px', border: '2px solid rgba(212, 163, 81, 0.4)', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(212, 163, 81, 0.1) inset' }}>
      <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, rgba(20, 17, 26, 0.95), rgba(28, 25, 34, 0.9))', borderBottom: '2px solid rgba(212, 163, 81, 0.4)', display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
        <button onClick={handleClearAll} style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #ff6b6b, #e85555)', border: '1px solid rgba(255, 107, 107, 0.5)', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '0.82rem', boxShadow: '0 4px 12px rgba(255, 107, 107, 0.3)', transition: 'all 0.2s ease' }}>🗑️ Limpar Tudo</button>
        <button onClick={handleAutoLayout} style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #8b7ba8, #9d8cbd)', border: '1px solid rgba(139, 123, 168, 0.5)', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '0.82rem', boxShadow: '0 4px 12px rgba(139, 123, 168, 0.3)', transition: 'all 0.2s ease' }}>🔄 Auto-organizar</button>
        <div style={{ flex: 1 }}></div>
        <button onClick={handleImportFlow} style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #5b9bd5, #4a8ac4)', border: '1px solid rgba(91, 155, 213, 0.5)', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '0.82rem', boxShadow: '0 4px 12px rgba(91, 155, 213, 0.3)', transition: 'all 0.2s ease' }}>📂 Importar</button>
        <button onClick={handleExportFlow} style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #e77c40, #d86f35)', border: '1px solid rgba(231, 124, 64, 0.5)', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '0.82rem', boxShadow: '0 4px 12px rgba(231, 124, 64, 0.3)', transition: 'all 0.2s ease' }}>📤 Exportar</button>
        <button onClick={handleSave} style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #6bd17c, #5bc46c)', border: '1px solid rgba(107, 209, 124, 0.5)', borderRadius: '8px', color: '#0a1a0f', fontWeight: '600', cursor: 'pointer', fontSize: '0.82rem', boxShadow: '0 4px 12px rgba(107, 209, 124, 0.4)', transition: 'all 0.2s ease' }}>💾 Salvar</button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
        {/* Toolbar Lateral */}
        <div style={{
          width: '150px',
          background: 'linear-gradient(180deg, rgba(20, 17, 26, 0.95), rgba(28, 25, 34, 0.92))',
          borderRight: '2px solid rgba(212, 163, 81, 0.4)',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flexShrink: 0,
          boxShadow: '2px 0 12px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#d4a351', fontWeight: 'bold', marginBottom: '4px', textAlign: 'center' }}>
            🎨 FERRAMENTAS
          </div>
          <ToolbarItem
            type="leftClick"
            label="Clique Esquerdo"
            icon="👆"
            color="#6bd17c"
            onAddNode={handleAddNode}
          />
          <ToolbarItem
            type="rightClick"
            label="Clique Direito"
            icon="👉"
            color="#d4a351"
            onAddNode={handleAddNode}
          />
          <ToolbarItem
            type="checkRegion"
            label="Checar Área"
            icon="🔍"
            color="#f0b45a"
            onAddNode={handleAddNode}
          />
          <ToolbarItem
            type="delay"
            label="Delay"
            icon="⏱️"
            color="#8b7ba8"
            onAddNode={handleAddNode}
          />
          <div style={{
            marginTop: 'auto',
            padding: '8px',
            background: 'rgba(212, 163, 81, 0.1)',
            borderRadius: '6px',
            fontSize: '0.65rem',
            color: '#b9a98a',
            lineHeight: '1.3',
            textAlign: 'center'
          }}>
            💡 Clique ou arraste para o canvas
          </div>
        </div>

        {/* Canvas do ReactFlow */}
        <div ref={reactFlowWrapper} style={{ flex: 1, overflow: 'hidden' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
            onEdgeMouseLeave={() => setHoveredEdgeId(null)}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            deleteKey={null}
            onKeyDown={(event) => {
              // Permitir que inputs recebam eventos de teclado
              if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
                return;
              }
            }}
          >
            <Controls style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              button: {
                background: 'rgba(28, 25, 34, 0.9)',
                border: '1px solid rgba(212, 163, 81, 0.35)',
                color: '#f6f1e4',
                transition: 'all 0.2s ease'
              }
            }} />
            <Background
              color="rgba(212, 163, 81, 0.25)"
              gap={20}
              size={1.5}
              style={{ opacity: 0.15 }}
            />
          </ReactFlow>
        </div>
      </div>

      <div style={{ padding: '10px 16px', background: 'linear-gradient(135deg, rgba(20, 17, 26, 0.95), rgba(28, 25, 34, 0.9))', borderTop: '2px solid rgba(212, 163, 81, 0.4)', fontSize: '0.75rem', color: '#b9a98a', flexShrink: 0, boxShadow: '0 -2px 12px rgba(0,0,0,0.3)', textAlign: 'center' }}>
        ✏️ Editar • 🖱️ Arrastar • ➡️ Conectar
      </div>
      
      {/* Dialog global para edição de nodes */}
      {editingNode && (
        <NodeEditDialog
          nodeId={editingNode.id}
          nodeData={editingNode.data}
          onSave={(id, data) => {
            setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
            setEditingNode(null);
          }}
          onClose={() => setEditingNode(null)}
        />
      )}
    </div>
  );
}

if (typeof window !== 'undefined') {
  window.initFlowEditor = function (containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      const root = createRoot(container);
      root.render(<FlowEditor />);
    }
  };
}

export default FlowEditor;

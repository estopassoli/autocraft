# 🎮 AutoCraft - Path of Exile 2

**Sistema de automação de crafting com editor visual de fluxo para Path of Exile 2**

Crie pipelines de automação visualmente, configure cliques e verificações OCR, e compartilhe configurações prontas com a comunidade!

---

## ✨ Features Principais

### 🎨 Editor Visual de Fluxo (React Flow)
- **Arraste e conecte**: Crie fluxos visualmente sem programar
- **4 tipos de nós**: Clique Esquerdo, Clique Direito, Verificar Região, Delay
- **Nomes customizáveis**: Renomeie cada nó como quiser (ex: "Click Chaos Orb")
- **Branching inteligente**: Nós de verificação têm saídas TRUE/FALSE
- **Auto-organizar**: Layout automático para fluxos complexos

### 📤 Exportar & Importar
- **Compartilhe flows**: Exporte configurações completas em JSON
- **Biblioteca pessoal**: Crie coleções de flows para diferentes crafts
- **Comunidade**: Use flows prontos de outros jogadores
- **Backup**: Salve seus flows testados

### 🎯 Multi-Modificador Inteligente
- **Múltiplos mods**: Procure por vários modificadores simultaneamente
- **Range de valores**: Configure min/max (ex: "Spell Damage 50-80%")
- **Matching rigoroso**: Sistema validado para evitar falsos positivos
- **OCR otimizado**: Tesseract.js para reconhecimento de texto

### 🔄 Automação Flexível
- **Loops customizados**: Crie loops em qualquer parte do fluxo
- **Shift automático**: Modo rápido com Shift mantido
- **Delays configuráveis**: Ajuste timing para cada ação
- **Execução exata**: Segue fielmente seu fluxo visual

### ⌨️ Controles Globais
- **F6**: Para execução (funciona com jogo em foco)
- **Hotkeys**: Sistema de controle completo
- **Logs em tempo real**: Acompanhe cada etapa

### 🎮 Interface Temática
- **Visual PoE2**: Interface inspirada no jogo
- **Duas abas**: Simples e Avançado
- **Responsiva**: Funciona em diferentes resoluções

---

## 📋 Tipos de Nós Disponíveis

### 👆 Clique Esquerdo (leftClick)
Clica com botão esquerdo do mouse em uma posição
- Captura de posição via interface
- Opção para segurar Shift
- Delay configurável após clique

### 👉 Clique Direito (rightClick)
Clica com botão direito (selecionar currency, etc)
- Captura de posição via interface
- Delay configurável após clique

### 🔍 Verificar Região (checkRegion)
Captura região da tela e verifica modificadores via OCR
- Saída **SIM** (verde): Modificador encontrado
- Saída **NÃO** (vermelha): Modificador não encontrado
- Captura de região via interface
- Compara com lista de modificadores configurados

### ⏱️ Delay
Aguarda um tempo específico antes de continuar
- Tempo configurável em milissegundos
- Útil para aguardar tooltips aparecerem

---

## 🚀 Instalação

```bash
# Instalar dependências
npm install

# Compilar editor visual
npm run build:flow
```

---

## 🎯 Como Usar

### 1️⃣ Inicie a Aplicação

```bash
npm start
```

### 2️⃣ Vá para a aba "Avançado"

### 3️⃣ Crie seu Fluxo Visual

**Exemplo: Chaos Spam básico**

```
Start
  ↓
Clique Direito → "Selecionar Chaos"
  ↓
Clique Esquerdo → "Aplicar no Item" (com Shift ✓)
  ↓
Verificar Região → "Checar Tooltip"
  ↓ SIM → End (Encontrou!)
  ↓ NÃO
  └─→ Volta para "Aplicar no Item"
```

**Passo a passo:**

1. **Adicionar nós**: Selecione tipo no dropdown → Clique "➕ Adicionar este nó"
2. **Configurar**: Clique ✏️ em cada nó e configure:
   - Nome personalizado
   - Posições (📍 Capturar)
   - Região OCR (📸 Capturar Região)
   - Delays, Shift, etc.
3. **Conectar**: Arraste do círculo inferior para o superior do próximo nó
4. **Organizar**: Use "🔄 Auto-organizar" ou arraste manualmente
5. **Salvar**: Clique "💾 Salvar"

### 4️⃣ Configure Modificadores (aba Simples)

```
Exemplo:
- #% increased Spell Damage (min: 50)
- +# to maximum Life (min: 60)
```

### 5️⃣ Inicie o Craft

- Clique "Iniciar Craft"
- Minimize a janela
- O bot executará seu fluxo automaticamente
- Pressione **F6** para parar

---

## 📤 Exportar & Importar Flows

### Exportar

1. Crie e configure seu flow completamente
2. Clique **📤 Exportar**
3. Escolha nome e local (ex: `chaos-helmet-life-res.json`)
4. Compartilhe o arquivo!

### Importar

1. Clique **📂 Importar**
2. Selecione arquivo `.json`
3. Flow carrega automaticamente
4. **⚠️ IMPORTANTE**: Recapture posições para seu PC!
5. Configure modificadores desejados
6. Salve e use

---

## 🎓 Documentação Adicional

- **[FLOW_GUIDE.md](FLOW_GUIDE.md)**: Guia completo do editor visual
- **[IMPORT_EXPORT_GUIDE.md](IMPORT_EXPORT_GUIDE.md)**: Tutorial de exportar/importar
- **example-chaos-spam-flow.json**: Flow exemplo para começar

---

## ⚙️ Configuração Avançada

### Matching de Modificadores

O sistema agora usa validação rigorosa:
- Mínimo 60% das palavras-chave principais
- Validação de números no range configurado
- Filtro de palavras comuns ("to", "the", "of")
- Logs detalhados para debug

### Estrutura de Projeto

```
autocraft/
├── main.js                    # Processo principal Electron
├── index.js                   # CLI (legado)
├── ui/
│   ├── index.html             # Interface principal
│   ├── renderer.js            # Lógica da UI
│   ├── flow-editor.jsx        # Editor React Flow
│   └── flow-editor-bundle.js  # Compilado
├── src/
│   ├── config.js              # Configurações
│   ├── crafter.js             # Lógica de crafting
│   ├── mouseController.js     # Controle de mouse
│   ├── ocr.js                 # OCR Tesseract
│   ├── screenCapture.js       # Captura de tela
│   ├── calibration.js         # Calibração
├── debug/                     # Capturas de debug
├── example-chaos-spam-flow.json
├── FLOW_GUIDE.md
├── IMPORT_EXPORT_GUIDE.md
└── package.json
```

---

## 🛠️ Comandos Disponíveis

```bash
npm start           # Inicia interface gráfica
npm run build:flow  # Compila editor React Flow
npm run build       # Build completo para distribuição
npm run cli         # Modo CLI (legado)
```

---

## 🔧 Troubleshooting

### Flow não funciona
1. ✅ Verificou se TODAS as posições foram capturadas?
2. ✅ Região do tooltip cobre TODO o texto?
3. ✅ Modificadores estão configurados na aba Simples?
4. ✅ Testou cada posição individualmente?

### OCR não detecta modificadores
1. Aumente delay antes de verificar tooltip
2. Recapture região do tooltip maior
3. Teste OCR na aba Simples primeiro
4. Verifique logs para ver o que está sendo lido

### Cliques errados
1. Recapture posições - podem ter mudado
2. Jogo em modo janela (não fullscreen)
3. Minimize AutoCraft antes de iniciar

---

## 💡 Dicas Pro

1. **Use nomes descritivos**: "Click Chaos Orb Slot 1" é melhor que "rightClick"
2. **Teste com item barato**: Sempre teste flows novos antes de usar em items valiosos
3. **Documente seus flows**: Ao exportar, anote para que serve
4. **Biblioteca organizada**: Crie pasta com flows por tipo de item/craft
5. **Ajuste delays**: Se tooltip não aparece, aumente delay entre ações
6. **Shift inteligente**: Marque Shift apenas no primeiro clique após selecionar currency
7. **Comunidade**: Compartilhe seus melhores flows!

---

## ⚠️ Avisos Importantes

### Uso por Sua Conta e Risco
Automação pode violar os Termos de Serviço de Path of Exile 2. Use com responsabilidade.

### Posições são Específicas
- Cada PC tem resolução/UI diferente
- **SEMPRE recapture** posições ao importar flows de outros
- Nunca confie cegamente em posições de flows baixados

### Não Garantimos Resultados
- RNG é RNG - o sistema não muda probabilidades
- Use delays adequados para evitar problemas
- Monitore execução inicial para validar funcionamento

---

## 🤝 Contribuindo

Contribuições são bem-vindas! 

- Compartilhe flows úteis
- Reporte bugs
- Sugira melhorias
- Melhore documentação

---

## 📜 Licença

ISC

---

## 🎮 Feito para a comunidade PoE2!

**Bom craft, exile!** 🔥

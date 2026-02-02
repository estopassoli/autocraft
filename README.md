# 🎮 AutoCraft - Path of Exile 2

**Seu assistente visual para automação de crafting em Path of Exile 2**

Crie pipelines de automação sem escrever código, use nosso editor visual intuitivo e compartilhe suas estratégias com a comunidade!

---

## 🚀 O que é AutoCraft?

AutoCraft é um bot de automação para PoE2 que deixa **você no controle** com uma interface visual amigável. Em vez de mexer em arquivos de configuração complexos, você **desenha seu fluxo de trabalho** e o AutoCraft executa.

### Use Cases Comuns
- **Chaos Spam**: Automatize múltiplas tentativas de chaos orb
- **Multicraft**: Aplique várias moedas em sequência
- **Verificação de Mods**: Procure por modificadores específicos automaticamente
- **Loops Inteligentes**: Repita ações até encontrar o resultado desejado

---

## ✨ O que torna AutoCraft especial?

### 🎨 **Editor Visual Intuitivo**
Ninguém precisa de código aqui. Você **arrasta, conecta e clica**. É como montar um fluxo de trabalho:

```
┌─────────────┐
│ Iniciar     │
└──────┬──────┘
       │
  ┌────▼──────────────────┐
  │ Clique Direito        │
  │ Selecionar Chaos      │
  └────┬──────────────────┘
       │
  ┌────▼──────────────────┐
  │ Clique Esquerdo       │
  │ Aplicar no Item       │
  └────┬──────────────────┘
       │
  ┌────▼──────────────────┐
  │ Verificar Região      │
  │ Checar Tooltip        │
  └────┬──────┬───────────┘
   SIM│       │NÃO
       │       │
    FIM      (volta ao início)
```

### 🎯 **Procure Exatamente o que Quer**
- Configure modificadores com ranges de valores
- Procure por vários mods ao mesmo tempo
- Sistema de matching inteligente que evita falsos positivos
- OCR otimizado para ler tooltips com precisão

### 📤 **Compartilhe suas Estratégias**
- Exporte seus flows em JSON
- Importe flows prontos de amigos ou comunidade
- Reconfigure para seu PC em segundos
- Crie sua biblioteca pessoal de automações

### ⌨️ **Controle Simples**
- **F6** para parar a qualquer momento
- Logs em tempo real para acompanhar tudo
- Interface responsiva que funciona bem
- Suporta Shift automático para ações rápidas

---

## � Instalação Rápida

### Pré-requisitos
- Node.js 16+ instalado
- Windows (primary support)
- Path of Exile 2 aberto em modo janela

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/estopassoli/autocraft.git
cd autocraft

# 2. Instale as dependências
npm install

# 3. Compile o editor visual
npm run build:flow

# 4. Inicie!
npm start
```

---

## �📋 Tipos de Nós Disponíveis

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

Você verá a janela principal do AutoCraft com 2 abas.

### 2️⃣ Vá para a aba "Avançado"

Aqui é onde acontece a magia! Você vai:
- Ver o editor visual de fluxos
- Adicionar nós (ações)
- Conectar eles juntos

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

## 📤 Exportar e Importar Flows

### Para Compartilhar seu Flow

1. Termine de configurar seu flow
2. Clique "📤 Exportar"
3. Escolha um nome descritivo como `chaos-helmet-res-vida.json`
4. Salve em algum lugar
5. Compartilhe no Discord ou comunidade!

### Para Usar um Flow de Alguém

1. Receba o arquivo `.json`
2. Clique "📂 Importar" na aba Avançado
3. Selecione o arquivo
4. **IMPORTANTE**: O flow carregará, mas as posições são do PC da pessoa que criou!
5. Edite cada nó e **recapture as posições** clicando em "📍 Capturar"
6. Configure os mods na aba Simples
7. Teste com item barato primeiro!

---

## 📰 Changelog

### 🎉 v1.0.2 (Atual)
**Quando**: Fevereiro, 2026

**O que melhorou**:
- ✅ **Histórico de Crafting Invertido**: Agora os mods mais recentes aparecem no topo da lista (DESC)
- 🔧 Correção de ordenação para mostrar cronologia correta
- 📊 Interface do histórico mais organizada

**Como usar**:
- O histórico está ao lado da aba principal
- Veja os últimos mods encontrados na ordem que foram descobertos

---

### 📋 Roadmap

**v1.0.3** (em planejamento)
- Melhorias na velocidade de OCR
- Interface de configuração de ranges mais visual
- Histórico salvo em arquivo (backup)

**v1.1.0** (em discussão)
- Suporte a múltiplos monitores
- Atalhos customizáveis pelo usuário
- Banco de flows compartilhado na comunidade

---

## 🎓 Como Começar

### 1. Abra a Interface

```bash
npm start
```

Você verá a janela principal do AutoCraft com 2 abas.

### 2. Vá para a Aba "Avançado"

Aqui é onde acontece a magia! Você vai:
- Ver o editor visual de fluxos
- Adicionar nós (ações)
- Conectar eles juntos

### 3. Construa seu Primeiro Fluxo

**Exemplo simples: Chaos Spam**

1. Clique em "➕ Adicionar este nó" com tipo "Clique Direito"
2. Clique em ✏️ para configurar
3. Defina um nome legal como "Selecionar Chaos"
4. Clique "📍 Capturar Posição" e clique no currency no seu jogo
5. Repita para os próximos passos:
   - Clique Esquerdo: "Aplicar no Item"
   - Verificar Região: "Checar Tooltip" (aqui você marca Shift ✓)
6. Conecte os nós arrastando do círculo inferior de um para o superior do próximo

### 4. Configure os Mods que Procura

Na aba "Simples", escreva os modificadores:
```
#% increased Spell Damage (min: 50)
+# to maximum Life (min: 60)
```

### 5. Execute!

- Clique "Iniciar Craft"
- Minimize a janela
- AutoCraft fará sua mágica
- Pressione **F6** para parar

---

## 🎮 Tipos de Nós Explicados

### 👆 **Clique Esquerdo**
Simples: clica com botão esquerdo onde você mandar.
- Use para: clicar em botões, aplicar itens, etc
- Captura: você indica onde clicar
- Opção: marque Shift se quiser clicar segurando Shift
- Delay: quantos milissegundos esperar depois

### 👉 **Clique Direito**
Clica com botão direito (menu contextual).
- Use para: selecionar currency, abrir menus
- Configuração: igual ao Clique Esquerdo

### 🔍 **Verificar Região**
Captura parte da tela, lê o texto e verifica se tem o mod que você quer.
- Use para: ler tooltips e decidir o que fazer
- Saída SIM (verde): encontrou o mod → vai para esse caminho
- Saída NÃO (vermelha): não encontrou → vai para outro caminho
- Captura: você marca a área do tooltip
- Conectar: use para fazer loops (volta para o começo se não achar)

### ⏱️ **Delay**
Apenas espera um tempo.
- Use para: aguardar tooltip aparecer, sincronizar ações
- Configuração: tempo em milissegundos (1000 = 1 segundo)

---

## ⚙️ Configuração Técnica

### Estrutura do Projeto

```
autocraft/
├── main.js                    # Núcleo Electron
├── ui/
│   ├── index.html             # Interface principal
│   ├── renderer.js            # Lógica da UI
│   ├── flow-editor.jsx        # Editor visual (React Flow)
│   └── crafting-history.html  # Histórico de crafts
├── src/
│   ├── config.js              # Configurações
│   ├── crafter.js             # Motor de execução
│   ├── mouseController.js     # Controle do mouse
│   ├── ocr.js                 # Leitura de texto
│   ├── screenCapture.js       # Captura de tela
│   └── calibration.js         # Calibração
├── data/
│   ├── items.json             # Banco de items
│   └── mods.json              # Banco de modificadores
└── logs/                      # Logs de execução
```

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

### Responsabilidade
Automação pode ir contra os Termos de Serviço de PoE2. Use com sabedoria e moderação.

### Posições são Pessoais
- Cada PC tem resolução diferente
- **SEMPRE recapture posições** ao importar flows
- Não confie cegamente em flows baixados

### RNG é RNG
- AutoCraft não muda probabilidades
- Só automatiza cliques
- Paciência e persistência são suas melhores amigas

---

## 🤝 Queremos Ouvir Você!

- 🐛 Encontrou bug? Abra uma issue!
- 💡 Tem ideia? Compartilhe uma sugestão
- 📖 Melhorou documentação? Faça um PR
- 🎯 Criou um flow legal? Compartilhe com a comunidade!

---

## 📜 Licença

ISC - Use à vontade!

---

## 🎮 Bom Craft, Exile! 🔥

Feito com ❤️ para a comunidade PoE2.

Dúvidas? Abra uma issue no GitHub!

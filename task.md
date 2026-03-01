# 📋 Plano de Tarefas - Sincronização Automática de Letras com GCP Speech-to-Text

## Contexto
> Desenvolver sistema automatizado que recebe arquivo de áudio de uma música, busca a última versão de suas letras e usa GCP Speech-to-Text para definir automaticamente os timestamps (start/end) de cada linha/frase. O sistema atual já possui estrutura de banco para timestamps e interface de sincronização manual - o objetivo é adicionar automação usando a API nativa do GCP que já está integrada ao projeto.

## Objetivos
- Automatizar o preenchimento de timestamps de letras usando áudio como entrada
- Integrar GCP Speech-to-Text API v2 para transcrição com timestamps por palavra
- Implementar algoritmo de reconstrução de frases baseado em acúmulo de palavras
- Criar interface para upload de áudio e processamento automático
- Manter compatibilidade com o sistema de sincronização manual existente

## Tarefas

### 🔴 Alta Prioridade

- [ ] **[TASK-001]** Configurar GCP Speech-to-Text API no projeto
  - **Contexto:** Projeto já usa GCP - precisa habilitar Speech-to-Text API e configurar credenciais
  - **Critérios de aceite:** 
    - API Speech-to-Text habilitada no projeto
    - Service account configurada para acesso
    - Biblioteca client instalada (`@google-cloud/speech`)
    - Teste básico de transcrição funcionando com word timestamps
  - **Complexidade:** Baixa
  - **Dependências:** Nenhuma

- [ ] **[TASK-002]** Implementar upload e processamento de arquivos de áudio
  - **Contexto:** Sistema precisa receber arquivos MP3/WAV via upload e armazenar no GCS temporariamente
  - **Critérios de aceite:**
    - Endpoint API para upload de áudio (/api/audio/upload)
    - Upload automático para Google Cloud Storage bucket temporário
    - Validação de tipos de arquivo (MP3, WAV, FLAC)
    - Cleanup automático de arquivos temporários após processamento
    - Suporte a arquivos de até 8 horas (limite do BatchRecognize)
  - **Complexidade:** Média
  - **Dependências:** TASK-001

- [ ] **[TASK-003]** Criar ação server para processamento com GCP Speech-to-Text
  - **Contexto:** Action que executa BatchRecognize na API do GCP e retorna words com timestamps
  - **Critérios de aceite:**
    - Action `processAudioWithSpeechToText(audioUri: string)` 
    - Configuração: `enableWordTimeOffsets: true`, `language_codes: ["ja-JP"]`, `model: "chirp_3"`
    - BatchRecognize assíncrono com polling de status
    - Parsing correto do resultado para extrair WordInfo[]
    - Tratamento de erros e timeouts (até 24h para dynamic batching)
  - **Complexidade:** Média
  - **Dependências:** TASK-001, TASK-002

### 🟡 Média Prioridade

- [ ] **[TASK-004]** Implementar algoritmo de reconstrução de frases
  - **Contexto:** Core do sistema - alinha palavras do GCP Speech-to-Text com frases existentes das letras
  - **Critérios de aceite:**
    - Função `alinharFrases(frases: string[], words: WordInfo[])` 
    - Normalização de texto japonês (remoção de pontuação e espaços)
    - Algoritmo de acúmulo de palavras até match com frase
    - Extração de start (primeira palavra) e end (última palavra) por frase
    - Handles para casos edge (frases não encontradas, múltiplos matches)
    - Score de confiança baseado em confidence média das palavras
  - **Complexidade:** Média
  - **Dependências:** TASK-003

- [ ] **[TASK-005]** Criar endpoint API para sincronização automática
  - **Contexto:** API que orquestra todo o processo: upload → GCS → Speech-to-Text → alinhamento → salvamento
  - **Critérios de aceite:**
    - Endpoint `/api/songs/[songId]/auto-sync` 
    - Recebe arquivo de áudio via FormData
    - Upload automático para GCS com nome único
    - Busca última versão de letras da música
    - Executa processamento Speech-to-Text + alinhamento
    - Salva timestamps no banco (reúsa `saveLyrics` existente)
    - Cleanup automático do arquivo temporário no GCS
    - Retorna resultado com estatísticas (linhas processadas, confiança média)
  - **Complexidade:** Média
  - **Dependências:** TASK-002, TASK-004

- [ ] **[TASK-006]** Adicionar componente de upload de áudio na interface
  - **Contexto:** Interface na página de sincronização para trigger do processo automático
  - **Critérios de aceite:**
    - Botão "Sincronização Automática com IA" na página `/songs/[songId]/sync`
    - Modal/área de drag-and-drop para upload de áudio
    - Indicador de progresso durante processamento assíncrono
    - Polling de status da operação BatchRecognize
    - Exibição de resultados (sucesso/falha, confiança por linha)
    - Integração harmoniosa com componente `LyricsSynchronization` existente
  - **Complexidade:** Média
  - **Dependências:** TASK-005

### 🟢 Baixa Prioridade

- [ ] **[TASK-007]** Implementar validações e tratamento de erros robustos
  - **Contexto:** Sistema precisa lidar graciosamente com falhas de processamento
  - **Critérios de aceite:**
    - Validação de formato/qualidade de áudio
    - Timeout para processos de Whisper longos (>5min)
    - Fallback quando alinhamento falha parcialmente
    - Logs detalhados para debugging
    - Mensagens de erro user-friendly na interface
  - **Complexidade:** Baixa
  - **Dependências:** TASK-005, TASK-006

- [ ] **[TASK-008]** Adicionar métricas de confiança do alinhamento
  - **Contexto:** Indicar ao usuário quais linhas podem precisar de revisão manual
  - **Critérios de aceite:**
    - Cálculo de score de confiança por linha (baseado em similaridade)
    - Flag visual na interface para linhas com baixa confiança
    - Opção de approval/rejeição por linha
    - Integração com sistema de revisão manual existente
  - **Complexidade:** Baixa
  - **Dependências:** TASK-006

- [ ] **[TASK-009]** Criar sistema de cache para processamentos
  - **Contexto:** Evitar reprocessamento do mesmo áudio se letras não mudaram
  - **Critérios de aceite:**
    - Hash de áudio + versão de letras como chave de cache
    - Armazenamento de resultados intermediários do Whisper
    - Limpeza periódica de cache antigo
    - Bypass de cache quando necessário
  - **Complexidade:** Baixa
  - **Dependências:** TASK-005

## ⚠️ Riscos e Bloqueios

- **Risco 1: Custo da API GCP Speech-to-Text**
  - **Mitigação:** Implementar dynamic batching para desconto, monitorar uso, considerar cache de resultados

- **Risco 2: Qualidade de alinhamento com música vs fala**
  - **Mitigação:** Usar modelo chirp_3 otimizado, implementar scores de confiança e manter sincronização manual como fallback

- **Risco 3: Latência do processamento assíncrono**
  - **Mitigação:** Usar BatchRecognize com feedback de progresso em tempo real via polling

- **Risco 4: Dependência de conectividade com GCP**
  - **Mitigação:** Tratamento robusto de erros de rede, retry logic e feedback claro ao usuário

## 📌 Notas

- **Vantagem estratégica:** GCP Speech-to-Text elimina complexidade de instalação/manutenção do Whisper local
- **Integração existing:** Projeto já usa GCP (@google-cloud/storage), facilita integração
- **Modelo state-of-the-art:** chirp_3 tem melhor precisão que Whisper para japonês
- **Escalabilidade:** API processa múltiplos arquivos em paralelo sem overhead no servidor
- **Formato nativo:** WordInfo já vem no formato ideal para o algoritmo de alinhamento
- **Legendas bonus:** API pode gerar SRT/VTT automaticamente se necessário no futuro
- **Formato de timestamps:** Converter Duration (1.2s) para formato existente "00:01:12.00"
- **Testing strategy:** Usar arquivos de teste pequenos primeiro para validar pipeline completo
- **Cleanup automático:** GCS lifecycle policies para remover arquivos temporários automaticamente
- **Ordem de implementação:** TASK-001 é pré-requisito para tudo, depois pode ser paralelizada

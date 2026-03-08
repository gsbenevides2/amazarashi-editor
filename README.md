# Amazarashi Editor

Editor de letras de música para a banda Amazarashi, com funcionalidades avançadas de sincronização de áudio, tradução automática e integração com serviços de IA.

## 🎵 Funcionalidades

### Gerenciamento de Conteúdo
- **Álbuns**: Criação e gerenciamento de álbuns com suporte multi-idiomas (Romaji, Hiragana, Inglês, Português)
- **Músicas**: Cadastro de músicas com metadados completos (YouTube, Spotify, duração, descrição)
- **Letras**: Editor avançado de letras com suporte a múltiplas versões e idiomas

### Editor de Letras
- **Múltiplas versões**: Suporte a várias versões de letras para a mesma música
- **Multi-idiomas**: Edição de letras em japonês, inglês e português simultaneamente
- **Sincronização temporal**: Ferramenta de sincronização de letras com áudio
- **Import flexível**: Importação de letras via texto livre ou JSON estruturado

### Integração com Serviços de IA
- **Google Gemini**: Processamento inteligente de alinhamento de letras
- **ElevenLabs**: Speech-to-text avançado para sincronização automática
- **Google Cloud Translate**: Tradução automática de letras
- **Google Cloud Speech**: Transcrição de áudio para texto

### Sincronização de Áudio
- **Integração YouTube**: Player integrado para sincronização manual
- **Upload de áudio**: Upload direto de arquivos de áudio para processamento
- **Processamento automático**: IA alinha automaticamente letras com timing de áudio
- **Editor temporal**: Interface visual para ajustar timing das linhas

## 🏗️ Estrutura do Projeto

```
amazarashi-editor/
├── app/                        # Aplicação Next.js
│   ├── _actions/              # Server Actions
│   │   ├── albums.ts          # Operações com álbuns
│   │   ├── lyrics.ts          # Operações com letras
│   │   ├── songs.ts           # Operações com músicas
│   │   ├── speech-to-text.ts  # Processamento de áudio
│   │   ├── translate.ts       # Tradução automática
│   │   └── upload.ts          # Upload de arquivos
│   ├── _components/           # Componentes React
│   │   ├── AlbumForm.tsx      # Formulário de álbum
│   │   ├── LyricsEditor.tsx   # Editor principal de letras
│   │   ├── LyricsSynchronization.tsx # Interface de sincronização
│   │   ├── NewSongForm.tsx    # Formulário de nova música
│   │   └── Modal.tsx          # Componentes modais
│   ├── _utils/                # Utilitários
│   │   ├── gemini.ts          # Integração Google Gemini
│   │   ├── elevenLabs.ts      # Integração ElevenLabs
│   │   ├── gcs.ts             # Google Cloud Storage
│   │   ├── gcp.ts             # Google Cloud Platform
│   │   └── time.ts            # Funções de tempo
│   ├── _prompts/              # Prompts para IA
│   │   └── alignment-system-prompt.md
│   ├── albums/                # Páginas de álbuns
│   ├── songs/                 # Páginas de músicas
│   ├── lyrics/                # Páginas de letras
│   └── api/                   # API Routes
├── db/                        # Banco de dados
│   ├── schema.ts              # Schema Drizzle ORM
│   ├── drizzle.config.ts      # Configuração do Drizzle
│   └── index.ts               # Conexão com banco
├── Dockerfile                 # Multi-stage build Docker
├── next.config.ts             # Configuração Next.js
└── package.json               # Dependências
```

## 🚀 Como Executar

### Pré-requisitos
- Node.js 20.x
- npm ou yarn
- Banco de dados SQLite

### Variáveis de Ambiente
Crie um arquivo `.env.local` com as seguintes variáveis:

```env
# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=path/to/gcp.json
GCP_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name

# APIs de IA
GEMINI_API_KEY=your-gemini-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# Banco de dados
TURSO_DATABASE_URL=libsql
TURSO_AUTH_TOKEN=ey

# Autenticação Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

ISG_INVALIDATION_TOKEN=sdasdasd
```

### Instalação e Configuração

1. **Clone o repositório**
```bash
git clone <repo-url>
cd amazarashi-editor
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o banco de dados**
```bash
npm run db:push
```

4. **Execute em modo desenvolvimento**
```bash
npm run dev
```

5. **Acesse a aplicação**
Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

## 📦 Scripts Disponíveis

- `npm run dev` - Executa em modo desenvolvimento
- `npm run build` - Build de produção
- `npm run start` - Executa build de produção
- `npm run lint` - Verifica código com ESLint
- `npm run db:push` - Aplica mudanças no schema do banco

## 🐳 Docker

O projeto inclui um Dockerfile otimizado com multi-stage build:

```bash
# Build da imagem
docker build -t amazarashi-editor .

# Execução
docker run -p 3000:3000 -e DATABASE_URL="file:/app/data/local.db" amazarashi-editor
```

## 🛠️ Tecnologias Utilizadas

### Frontend
- **Next.js 16** - Framework React com App Router
- **React 19** - Biblioteca de UI
- **TailwindCSS 4** - Estilização
- **TypeScript** - Tipagem estática

### Backend
- **Drizzle ORM** - ORM para SQLite
- **Server Actions** - API integrada do Next.js
- **SQLite** - Banco de dados local

### Integrações Externas
- **Google Cloud Platform**
  - Cloud Storage (armazenamento de arquivos)
  - Cloud Speech (transcrição de áudio)
  - Cloud Translate (tradução automática)
- **Google Gemini** - IA para processamento de texto
- **ElevenLabs** - Speech-to-text avançado
- **YouTube API** - Integração com player de vídeo

### DevOps
- **Docker** - Containerização
- **ESLint** - Linting de código
- **Multi-stage builds** - Otimização de imagem Docker

## 📝 Uso da Aplicação

### 1. Gerenciar Álbuns
- Acesse `/albums` para ver todos os álbuns
- Crie novos álbuns em `/albums/new`
- Edite álbuns existentes clicando no álbum desejado

### 2. Gerenciar Músicas
- Acesse `/songs` para ver todas as músicas
- Adicione novas músicas em `/songs/new`
- Configure metadados como YouTube ID, Spotify ID, duração

### 3. Editar Letras
- Acesse uma música específica em `/songs/[songId]`
- Clique em "Lyrics" para abrir o editor de letras
- Crie múltiplas versões e adicione texto em diferentes idiomas
- Use o botão "Translate" para tradução automática

### 4. Sincronizar com Áudio
- No editor de letras, acesse a aba "Sync"
- Faça upload de um arquivo de áudio ou use YouTube ID
- Use as ferramentas de sincronização para alinhar texto com tempo
- O sistema pode processar automaticamente usando IA

## 🔧 Desenvolvimento

### Estrutura do Banco de Dados
O schema inclui tabelas para:
- `albuns` - Informações de álbuns
- `musics` - Metadados de músicas
- `lyrics` - Versões de letras
- `lyrics_lines` - Linhas individuais com timing
- `lyrics_lines_texts` - Texto por idioma
- `languages` - Idiomas suportados

### Adicionando Novos Idiomas
1. Insira na tabela `languages` via SQL
2. Atualize os componentes para suportar o novo idioma
3. Configure tradução automática se necessário

## 🤝 Contribuição

1. Faça fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob licença [MIT](LICENSE).

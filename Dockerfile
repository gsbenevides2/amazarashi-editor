# Multi-stage build para otimização
# Stage 1: Dependencies and build
FROM node:20-alpine AS deps

WORKDIR /app

# Copiar apenas arquivos de dependências primeiro (melhor cache)
COPY package.json package-lock.json* ./

# Instalar dependências completas (dev + prod) para build
RUN npm ci --only=production --omit=dev

# Stage 2: Build da aplicação
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar dependências do stage anterior
COPY --from=deps /app/node_modules ./node_modules

# Copiar código fonte
COPY . .

# Instalar dev dependencies para o build
RUN npm ci

# Build da aplicação Next.js
RUN npm run build

# Stage 3: Runtime (imagem final otimizada)
FROM node:20-alpine AS runner

WORKDIR /app

# Criar usuário non-root para segurança
RUN addgroup --system --gid 1001 nodegroup && \
    adduser --system --uid 1001 nodeuser

# Copiar apenas arquivos necessários para runtime
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Configurar permissões
RUN chown -R nodeuser:nodegroup /app
USER nodeuser

# Variáveis de ambiente para produção
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Usar node para iniciar
CMD ["node", "server.js"]
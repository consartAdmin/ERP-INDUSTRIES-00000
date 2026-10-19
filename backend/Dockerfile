# ---- deps: instala dependências de produção (com JDK para compilar postinstall) ----
FROM node:20-slim AS deps
WORKDIR /app

# Ferramentas para builds nativos + JDK para xsd-schema-validator
RUN apt-get update && apt-get install -y --no-install-recommends \
      openjdk-17-jdk-headless ca-certificates-java \
      python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH="${JAVA_HOME}/bin:${PATH}"
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV npm_config_loglevel=warn

# Copia manifests e instala só prod
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --fund=false

# ---- runner (runtime) ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# JRE suficiente em produção (o helper já foi compilado no deps)
RUN apt-get update && apt-get install -y --no-install-recommends \
      openjdk-17-jre-headless ca-certificates-java \
  && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# Copia node_modules prontos do deps
COPY --from=deps /app/node_modules ./node_modules

# Copia o app
COPY . .

# Porta padrão Cloud Run (ajuste se necessário)
EXPOSE 8080

# Start
CMD ["node", "server.js"]

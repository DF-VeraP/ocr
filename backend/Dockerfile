# Dockerfile para Backend SENA OCR (Node.js + PaddleOCR + Prisma + BullMQ)
FROM node:20-bookworm-slim

# Instalar dependencias esenciales del sistema para librerías nativas C++, OpenSSL y Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias de Node.js
COPY package*.json ./
RUN npm ci

# Copiar esquema de Prisma y generar cliente Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Copiar código fuente y compilar TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Crear directorio persistente para subidas de imágenes/recortes
RUN mkdir -p /app/uploads

# Copiar y dar permisos al script de entrada
COPY docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

# Convertir finales de línea de Windows (CRLF) a UNIX (LF) por seguridad
RUN sed -i 's/\r$//' ./docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/server.js"]

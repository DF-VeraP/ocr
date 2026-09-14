#!/bin/sh
set -e

echo "🚀 [ENTRYPOINT] Iniciando Backend SENA OCR..."

# Esperar a que la base de datos PostgreSQL esté lista
echo "⏳ [ENTRYPOINT] Verificando conexión a PostgreSQL..."
node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function waitDb(retries = 30) {
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$connect();
      console.log("✅ [ENTRYPOINT] Base de datos PostgreSQL lista y conectada.");
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      console.log(`   Reintentando conexión a PostgreSQL (${i}/${retries})...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error("❌ [ENTRYPOINT] No se pudo conectar a PostgreSQL tras varios intentos.");
  process.exit(1);
}
waitDb();
'

# Aplicar migraciones de base de datos
echo "📦 [ENTRYPOINT] Aplicando migraciones de Prisma..."
npx prisma migrate deploy || npx prisma db push

# Ejecutar seed para crear el administrador predeterminado si no existe
echo "🌱 [ENTRYPOINT] Verificando seed de usuario administrador..."
node dist/prisma/seed.js || echo "⚠️ Advertencia: Error en seed o ya creado previamente."

echo "🎯 [ENTRYPOINT] Iniciando servidor de producción..."
exec "$@"

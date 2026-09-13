import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@sena.edu.co';
  const defaultPassword = 'Admin2026*'; // Cumple: 1 mayúscula, 4 números, 1 símbolo
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      requiresPasswordChange: false,
    },
  });

  console.log('✅ Usuario Administrador inicial verificado/creado:');
  console.log(`   Email: ${admin.email}`);
  console.log(`   Rol: ${admin.role}`);
  console.log(`   Contraseña temporal inicial: ${defaultPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

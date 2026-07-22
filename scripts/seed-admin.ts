import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`[!] ADMIN_PASSWORD env var not provided. Generated random admin password: ${adminPassword}`)
  }
  const passwordHash = await hash(adminPassword, 12)

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash,
      isAdmin: true,
    },
    create: {
      username: 'admin',
      passwordHash,
      isAdmin: true,
    },
  })

  console.log(`[+] Admin user initialized: ${admin.username} (isAdmin: ${admin.isAdmin})`)
}

main()
  .catch((e) => {
    console.error('[-] Error seeding admin user:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

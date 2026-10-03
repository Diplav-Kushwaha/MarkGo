import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set in your .env file before seeding."
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`Superadmin already exists for email: ${email}. Skipping seed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const superAdmin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "SUPERADMIN",
      isEmailVerified: true,
      companyId: null,
    },
  });

  console.log(`Superadmin created successfully: ${superAdmin.email} (id: ${superAdmin.id})`);
}

main()
  .catch((err) => {
    console.error("Seed script failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import "dotenv/config";
import { prisma } from "./db";
import { hashPassword } from "./utils/hash";

async function main() {
  const login = process.env.SEED_ADMIN_LOGIN || "admin";
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD не задан в .env — укажите стартовый пароль администратора");
  }

  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) {
    console.log(`Пользователь с логином "${login}" уже существует, пропускаю создание.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      fullName: "Администратор системы",
      login,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Создан первый администратор: логин "${login}".`);
  console.log("Обязательно смените пароль после первого входа — значение из .env хранить в системе нельзя.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

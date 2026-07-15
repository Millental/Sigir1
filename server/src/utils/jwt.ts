import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  // Фейлимся быстро и явно, а не тихо работаем с небезопасным секретом по умолчанию.
  throw new Error("JWT_SECRET не задан в переменных окружения (см. .env.example)");
}

export interface JwtPayload {
  userId: string;
  role: "ADMIN" | "SPEAKER";
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET as string, { expiresIn: "10h" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET as string) as JwtPayload;
}

import { WeeklyCycle } from "@prisma/client";
import { JwtPayload } from "./jwt";

export class PresentationAccessError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function assertPresentationReadAccess(weeklyCycle: WeeklyCycle, user: JwtPayload): void {
  if (user.role === "SPEAKER" && weeklyCycle.status === "ARCHIVED") {
    throw new PresentationAccessError(403, "Презентация архивирована и недоступна");
  }
}

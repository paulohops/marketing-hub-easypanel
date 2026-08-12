import bcrypt from "bcryptjs";
import { z } from "zod";

export const localPasswordInput = z.string().min(12, "A senha precisa ter pelo menos 12 caracteres.").max(128, "A senha pode ter no máximo 128 caracteres.")
  .regex(/[a-z]/, "Inclua ao menos uma letra minúscula.")
  .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula.")
  .regex(/[0-9]/, "Inclua ao menos um número.");

const BCRYPT_COST = 12;

export async function hashLocalPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyLocalPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

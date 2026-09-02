import crypto from "crypto";

/** e.g. "TXN-PRF-1B2C3D4E5F60" — short, unique, and readable in logs/dashboards. */
export function generateTransactionId(purposeCode: string): string {
  return `TXN-${purposeCode}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

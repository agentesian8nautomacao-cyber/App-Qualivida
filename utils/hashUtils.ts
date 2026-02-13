/**
 * Utilitários para cálculo de hashes e verificação de integridade
 */

/**
 * Calcula o hash SHA-256 de um ArrayBuffer
 */
export async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calcula o hash SHA-256 de um File
 */
export async function calculateFileSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return calculateSHA256(buffer);
}

/**
 * Verifica se o hash do arquivo corresponde ao hash esperado
 */
export async function verifyFileIntegrity(file: File, expectedHash: string): Promise<boolean> {
  const actualHash = await calculateFileSHA256(file);
  return actualHash === expectedHash;
}

/**
 * Calcula hash SHA-256 de uma string
 */
export async function calculateStringSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return calculateSHA256(data);
}
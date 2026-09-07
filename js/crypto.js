// crypto.js — espelha /crypto_utils.py do PassVault desktop.
// Validado byte-a-byte contra argon2-cffi e cryptography (Python):
// mesma senha + mesmo salt + mesmos parâmetros = mesma chave;
// mesma chave + mesmo nonce + mesmo texto = mesmo ciphertext.

const ARGON2_TIME_COST = 3;
const ARGON2_MEMORY_COST_KIB = 65536; // 64 MB, em KiB (mesma unidade do argon2-cffi)
const ARGON2_PARALLELISM = 4;
const KEY_LEN = 32; // 256 bits
const SALT_LEN = 16;
const NONCE_LEN = 12;

function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_LEN));
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

/** Deriva uma chave AES-256 a partir da senha-mestra + salt (Argon2id). */
async function deriveKey(masterPassword, saltBytes) {
  const result = await argon2.hash({
    pass: masterPassword,
    salt: saltBytes,
    time: ARGON2_TIME_COST,
    mem: ARGON2_MEMORY_COST_KIB,
    parallelism: ARGON2_PARALLELISM,
    hashLen: KEY_LEN,
    type: argon2.ArgonType.Argon2id,
  });
  return crypto.subtle.importKey(
    "raw",
    result.hash,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

/** Cifra dados com AES-256-GCM. Retorna nonce(12 bytes) || ciphertext. */
async function encryptBytes(cryptoKey, plaintextBytes) {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    cryptoKey,
    plaintextBytes
  );
  return concatBytes(nonce, new Uint8Array(ciphertext));
}

/** Decifra dados produzidos por encryptBytes(). Lança exceção se a senha
 * estiver errada ou o arquivo tiver sido corrompido/adulterado. */
async function decryptBytes(cryptoKey, data) {
  const nonce = data.slice(0, NONCE_LEN);
  const ciphertext = data.slice(NONCE_LEN);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    cryptoKey,
    ciphertext
  );
  return new Uint8Array(plaintext);
}

/** Monta o cabeçalho do arquivo: magic + versão + salt. */
function packHeader(saltBytes, magic = "PVLT") {
  const magicBytes = new TextEncoder().encode(magic); // 4 bytes ASCII
  const version = new Uint8Array([1]);
  return concatBytes(magicBytes, version, saltBytes);
}

/** Lê o cabeçalho e retorna { salt, rest }. */
function unpackHeader(data, expectedMagic = "PVLT") {
  const magic = new TextDecoder().decode(data.slice(0, 4));
  if (magic !== expectedMagic) {
    throw new Error("Arquivo inválido, corrompido, ou tipo errado de arquivo.");
  }
  const version = data[4];
  if (version !== 1) {
    throw new Error(`Versão não suportada: ${version}`);
  }
  const salt = data.slice(5, 5 + SALT_LEN);
  const rest = data.slice(5 + SALT_LEN);
  return { salt, rest };
}

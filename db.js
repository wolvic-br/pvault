// db.js — guarda o blob cifrado do cofre (bytes crus: cabeçalho + AES-GCM)
// no IndexedDB do dispositivo. É o equivalente ao arquivo vault.db no
// desktop, só que vivendo dentro do navegador.
//
// AVISO IMPORTANTE (documentado no README): o Safari no iOS pode, em
// teoria, limpar dados de sites/PWAs não usados por muito tempo. Por isso
// o app sempre oferece "Baixar cofre" para backup manual — trate isso
// como você trataria um HD: útil, mas não é o único lugar onde os dados
// deveriam existir.

const DB_NAME = "passvault";
const DB_VERSION = 1;
const STORE_NAME = "vault_blob";
const BLOB_KEY = "current";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStoredBlob() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(BLOB_KEY);
    req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null);
    req.onerror = () => reject(req.error);
  });
}

async function setStoredBlob(bytes) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(bytes, BLOB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearStoredBlob() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(BLOB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// vault.js — espelha /vault.py do PassVault desktop.
// O payload JSON gerado aqui (version/categories/entries) é byte-a-byte
// compatível em formato com o que o app Python grava — testado e
// confirmado que a mesma senha-mestra produz a mesma chave (Argon2id) e
// a mesma cifra (AES-256-GCM) nos dois lados.

class VaultError extends Error {}

function nowEpochSeconds() {
  // Equivalente ao time.time() do Python: segundos desde epoch, com casas
  // decimais — para os timestamps ficarem no mesmo formato/unidade.
  return Date.now() / 1000;
}

class Vault {
  constructor() {
    this.entries = [];
    this._key = null;
    this._salt = null;
  }

  static async existsStored() {
    const blob = await getStoredBlob();
    return blob !== null;
  }

  static async createNew(masterPassword) {
    if (await Vault.existsStored()) {
      throw new VaultError("Já existe um cofre neste dispositivo.");
    }
    const v = new Vault();
    v._salt = generateSalt();
    v._key = await deriveKey(masterPassword, v._salt);
    v.entries = [];
    await v.save();
    return v;
  }

  static async _fromBytes(bytes, masterPassword, expectedMagic = "PVLT") {
    let salt, rest;
    try {
      ({ salt, rest } = unpackHeader(bytes, expectedMagic));
    } catch (e) {
      throw new VaultError(e.message);
    }
    const key = await deriveKey(masterPassword, salt);
    let plaintext;
    try {
      plaintext = await decryptBytes(key, rest);
    } catch (e) {
      throw new VaultError("Senha incorreta ou arquivo corrompido.");
    }
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(plaintext));
    } catch (e) {
      throw new VaultError("Conteúdo do cofre corrompido (JSON inválido).");
    }
    const v = new Vault();
    v._salt = salt;
    v._key = key;
    v.entries = (payload.entries || []).map((e) => ({
      id: e.id,
      category: e.category,
      fields: e.fields || {},
      created_at: e.created_at,
      updated_at: e.updated_at,
    }));
    return v;
  }

  /** Carrega o cofre salvo neste dispositivo (IndexedDB). */
  static async loadStored(masterPassword) {
    const blob = await getStoredBlob();
    if (!blob) {
      throw new VaultError("Nenhum cofre encontrado neste dispositivo.");
    }
    return Vault._fromBytes(blob, masterPassword, "PVLT");
  }

  /** Carrega um cofre a partir de um arquivo importado (vault.db ou
   * .pvault) — detecta o magic automaticamente. */
  static async loadFromFile(bytes, password) {
    const magic = new TextDecoder().decode(bytes.slice(0, 4));
    if (magic !== "PVLT" && magic !== "PVXP") {
      throw new VaultError(
        "Esse arquivo não parece ser um cofre (.db) nem uma exportação " +
          "(.pvault) válida do PassVault."
      );
    }
    return Vault._fromBytes(bytes, password, magic);
  }

  async _toBytes(magic = "PVLT") {
    const payload = {
      version: 2,
      categories: CATEGORIES,
      entries: this.entries,
    };
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    const encrypted = await encryptBytes(this._key, plaintext);
    const header = packHeader(this._salt, magic);
    return concatBytes(header, encrypted);
  }

  /** Salva no armazenamento local do dispositivo (IndexedDB). */
  async save() {
    if (!this._key || !this._salt) {
      throw new VaultError("Cofre bloqueado, não é possível salvar.");
    }
    const bytes = await this._toBytes("PVLT");
    await setStoredBlob(bytes);
  }

  /** Gera os bytes de um backup para download (mesmo formato do vault.db). */
  async exportBytes() {
    return this._toBytes("PVLT");
  }

  lock() {
    this._key = null;
    this._salt = null;
    this.entries = [];
  }

  get isUnlocked() {
    return this._key !== null;
  }

  // ---------- CRUD ----------

  addEntry(category, fields) {
    const clean = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v) clean[k] = v; // só guarda campos com valor, igual ao gui.py
    }
    const entry = {
      id: crypto.randomUUID(),
      category,
      fields: clean,
      created_at: nowEpochSeconds(),
      updated_at: nowEpochSeconds(),
    };
    this.entries.push(entry);
    return entry;
  }

  updateEntry(entryId, fields) {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) throw new VaultError("Entrada não encontrada.");
    const clean = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v) clean[k] = v;
    }
    entry.fields = clean;
    entry.updated_at = nowEpochSeconds();
    return entry;
  }

  deleteEntry(entryId) {
    this.entries = this.entries.filter((e) => e.id !== entryId);
  }

  getField(entry, name) {
    return (entry.fields && entry.fields[name]) || "";
  }

  displayTitle(entry) {
    return getDisplayTitle(entry.category, entry.fields);
  }

  search(text, category = null) {
    const t = (text || "").toLowerCase().trim();
    let results = this.entries;
    if (category) {
      results = results.filter((e) => e.category === category);
    }
    if (t) {
      results = results.filter((e) =>
        Object.values(e.fields).some((v) => String(v).toLowerCase().includes(t))
      );
    }
    return [...results].sort((a, b) =>
      this.displayTitle(a).toLowerCase().localeCompare(this.displayTitle(b).toLowerCase())
    );
  }
}

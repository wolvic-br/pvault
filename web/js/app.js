// app.js — liga a UI ao Vault. Espelha o comportamento de gui.py.

const CLIPBOARD_CLEAR_SECONDS = 20;

let vault = null;
let creatingVault = false;
let currentCategory = null;
let selectedEntryId = null;
let showSensitiveDetail = false;
let entryFieldWidgets = {}; // name -> input/textarea element
let editingEntryId = null;
let clipboardTimer = null;
let toastTimer = null;

// ---------------------------------------------------------------- utilitários

function $(id) { return document.getElementById(id); }

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  $(id).classList.add("active");
}

function showToast(msg, ms = 2500) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

function generatePassword(length = 20) {
  const pool =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}?";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => pool[b % pool.length]).join("");
}

async function copyToClipboard(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    showToast("Não foi possível copiar (permissão negada).");
    return;
  }
  showToast(`Copiado. Área de transferência será limpa em ${CLIPBOARD_CLEAR_SECONDS}s.`);
  clearTimeout(clipboardTimer);
  clipboardTimer = setTimeout(() => {
    navigator.clipboard.writeText("").catch(() => {});
  }, CLIPBOARD_CLEAR_SECONDS * 1000);
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------------------------------------------------------- login / criação

async function initLoginScreen() {
  creatingVault = !(await Vault.existsStored());
  $("login-title").textContent = creatingVault ? "Criar cofre" : "Desbloquear cofre";
  $("login-hint").textContent = creatingVault
    ? "Escolha uma senha-mestra forte. Ela não fica salva em lugar nenhum — se você esquecer, não há como recuperar os dados."
    : "Digite sua senha-mestra.";
  $("login-pw2").style.display = creatingVault ? "block" : "none";
  $("login-submit").textContent = creatingVault ? "Criar cofre" : "Desbloquear";
  $("login-error").textContent = "";
  $("login-pw1").value = "";
  $("login-pw2").value = "";
}

$("login-submit").addEventListener("click", async () => {
  const pw = $("login-pw1").value;
  $("login-error").textContent = "";
  if (!pw) {
    $("login-error").textContent = "Digite uma senha.";
    return;
  }
  try {
    if (creatingVault) {
      if (pw.length < 8) {
        $("login-error").textContent = "Use pelo menos 8 caracteres.";
        return;
      }
      if (pw !== $("login-pw2").value) {
        $("login-error").textContent = "As senhas não coincidem.";
        return;
      }
      vault = await Vault.createNew(pw);
    } else {
      vault = await Vault.loadStored(pw);
    }
  } catch (e) {
    $("login-error").textContent = e.message || String(e);
    return;
  }
  goHome();
});

$("btn-lock").addEventListener("click", async () => {
  if (vault) vault.lock();
  vault = null;
  await initLoginScreen();
  showScreen("screen-login");
});

// ---------------------------------------------------------------- home / categorias

function goHome() {
  currentCategory = null;
  selectedEntryId = null;
  $("search-input").value = "";
  renderCategoryGrid();
  showScreen("screen-home");
}

function renderCategoryGrid() {
  const grid = $("category-grid");
  grid.innerHTML = "";
  for (const cat of CATEGORIES) {
    const btn = document.createElement("button");
    btn.className = "category-btn";
    btn.innerHTML = `<span class="badge">${badgeSvg(cat, 40)}</span><span>${cat}</span>`;
    btn.addEventListener("click", () => openCategory(cat));
    grid.appendChild(btn);
  }
}

function openCategory(cat) {
  currentCategory = cat;
  $("list-title").textContent = cat;
  renderList(vault.search("", cat));
  showScreen("screen-list");
}

$("search-input").addEventListener("input", (e) => {
  const text = e.target.value.trim();
  if (!text) {
    if (document.getElementById("screen-list").classList.contains("active") && !currentCategory) {
      goHome();
    }
    return;
  }
  currentCategory = null;
  $("list-title").textContent = `Busca: "${text}"`;
  renderList(vault.search(text));
  showScreen("screen-list");
});

$("btn-back").addEventListener("click", goHome);

// ---------------------------------------------------------------- lista + detalhes

function renderList(entries) {
  selectedEntryId = null;
  const listEl = $("entry-list");
  const detailEl = $("detail-panel");
  detailEl.innerHTML = "";
  $("btn-edit").disabled = true;
  $("btn-delete").disabled = true;

  listEl.innerHTML = "";
  if (entries.length === 0) {
    listEl.innerHTML = '<div class="empty-hint">Nenhuma entrada aqui ainda.</div>';
    return;
  }
  for (const entry of entries) {
    const item = document.createElement("div");
    item.className = "entry-item";
    item.dataset.id = entry.id;
    item.innerHTML = `
      <span class="badge" style="width:32px;height:32px">${badgeSvg(entry.category, 32)}</span>
      <span class="info">
        <div class="title">${escapeHtml(vault.displayTitle(entry))}</div>
        <div class="subtitle">${escapeHtml(entry.category)}</div>
      </span>`;
    item.addEventListener("click", () => selectEntry(entry.id, entries));
    listEl.appendChild(item);
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

function selectEntry(id, entries) {
  selectedEntryId = id;
  document.querySelectorAll(".entry-item").forEach((el) => {
    el.classList.toggle("selected", el.dataset.id === id);
  });
  const entry = entries.find((e) => e.id === id) || vault.entries.find((e) => e.id === id);
  $("btn-edit").disabled = false;
  $("btn-delete").disabled = false;
  renderDetail(entry);
}

function renderDetail(entry) {
  const detailEl = $("detail-panel");
  detailEl.innerHTML = "";
  const schema = getSchema(entry.category);
  for (const fdef of schema) {
    const value = vault.getField(entry, fdef.name);
    if (!value) continue; // regra: esconde se vazio

    const row = document.createElement("div");
    row.className = "detail-row";

    const content = document.createElement("div");
    content.className = "field-content";
    const label = document.createElement("div");
    label.className = "field-name";
    label.textContent = fdef.name;
    const valEl = document.createElement("div");
    valEl.className = "field-value" + (isMasked(fdef) ? " masked" : "");
    valEl.textContent = isMasked(fdef) && !showSensitiveDetail ? "••••••••" : value;
    content.appendChild(label);
    content.appendChild(valEl);

    const copyBtn = document.createElement("button");
    copyBtn.className = "icon-btn";
    copyBtn.title = "Copiar";
    copyBtn.innerHTML = plainIconSvg("copiar", "#1F3A56", 18);
    copyBtn.addEventListener("click", () => copyToClipboard(value));

    row.appendChild(content);
    row.appendChild(copyBtn);
    detailEl.appendChild(row);
  }
}

$("btn-toggle-visible").addEventListener("click", () => {
  showSensitiveDetail = !showSensitiveDetail;
  if (selectedEntryId) {
    const entry = vault.entries.find((e) => e.id === selectedEntryId);
    if (entry) renderDetail(entry);
  }
});

$("btn-delete").addEventListener("click", async () => {
  if (!selectedEntryId) return;
  const entry = vault.entries.find((e) => e.id === selectedEntryId);
  if (!entry) return;
  if (!confirm(`Excluir "${vault.displayTitle(entry)}" permanentemente?`)) return;
  vault.deleteEntry(selectedEntryId);
  await vault.save();
  refreshCurrentList();
});

function refreshCurrentList() {
  if (currentCategory) {
    renderList(vault.search("", currentCategory));
  } else {
    const text = $("search-input").value.trim();
    renderList(text ? vault.search(text) : []);
  }
}

// ---------------------------------------------------------------- modal de entrada

function openEntryModal(category, entry = null) {
  editingEntryId = entry ? entry.id : null;
  $("entry-modal-title").textContent = entry ? "Editar entrada" : "Nova entrada";
  $("entry-form-error").textContent = "";
  $("entry-show-sensitive").checked = false;
  entryFieldWidgets = {};

  const container = $("entry-form-fields");
  container.innerHTML = "";
  const schema = getSchema(category);
  container.dataset.category = category;

  for (const fdef of schema) {
    const label = document.createElement("label");
    label.className = "field-label";
    label.textContent = fdef.name;
    container.appendChild(label);

    let widget;
    if (isMultiline(fdef)) {
      widget = document.createElement("textarea");
      widget.rows = 3;
    } else {
      widget = document.createElement("input");
      widget.type = isMasked(fdef) ? "password" : "text";
      if (fdef.format === "mm/aa") {
        widget.placeholder = "mm/aa";
        widget.maxLength = 5;
        widget.addEventListener("input", () => formatMmAa(widget));
      }
      if (fdef.maxLength) widget.maxLength = fdef.maxLength;
      if (fdef.validator) {
        widget.addEventListener("input", () => {
          widget.value = widget.value
            .split("")
            .filter((_, i) => fdef.validator.test(widget.value.slice(0, i + 1)))
            .join("");
        });
      }
    }
    if (entry) {
      const val = vault.getField(entry, fdef.name);
      if (widget.tagName === "TEXTAREA") widget.value = val;
      else widget.value = val;
    }
    entryFieldWidgets[fdef.name] = widget;
    container.appendChild(widget);
  }

  $("modal-entry").classList.remove("hidden");
}

function formatMmAa(widget) {
  const digits = widget.value.replace(/\D/g, "").slice(0, 4);
  const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  if (formatted !== widget.value) widget.value = formatted;
}

function closeEntryModal() {
  $("modal-entry").classList.add("hidden");
  editingEntryId = null;
}

$("entry-modal-close").addEventListener("click", closeEntryModal);
$("entry-cancel").addEventListener("click", closeEntryModal);

$("entry-show-sensitive").addEventListener("change", (e) => {
  const show = e.target.checked;
  const category = $("entry-form-fields").dataset.category;
  for (const fdef of getSchema(category)) {
    if (isMasked(fdef)) {
      const w = entryFieldWidgets[fdef.name];
      if (w && w.tagName === "INPUT") w.type = show ? "text" : "password";
    }
  }
});

$("entry-gen-password").addEventListener("click", () => {
  const category = $("entry-form-fields").dataset.category;
  const schema = getSchema(category);
  let target = schema.find((f) => isMasked(f) && f.name.toLowerCase().includes("senha"));
  if (!target) target = schema.find((f) => isMasked(f));
  if (!target) return;
  const w = entryFieldWidgets[target.name];
  w.value = generatePassword();
  w.type = "text";
});

$("btn-new").addEventListener("click", () => {
  openEntryModal(currentCategory || "Senhas");
});

$("btn-edit").addEventListener("click", () => {
  if (!selectedEntryId) return;
  const entry = vault.entries.find((e) => e.id === selectedEntryId);
  if (entry) openEntryModal(entry.category, entry);
});

$("entry-save").addEventListener("click", async () => {
  const category = $("entry-form-fields").dataset.category;
  const schema = getSchema(category);
  const titleField = getTitleField(category);

  const titleWidget = entryFieldWidgets[titleField];
  const titleVal = (titleWidget.value || "").trim();
  if (!titleVal) {
    $("entry-form-error").textContent = `Preencha o campo '${titleField}'.`;
    return;
  }

  for (const fdef of schema) {
    const w = entryFieldWidgets[fdef.name];
    const val = (w.value || "").trim();
    if (fdef.format === "mm/aa" && val && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(val)) {
      $("entry-form-error").textContent = `${fdef.name} deve estar no formato mm/aa (ex.: 08/29).`;
      return;
    }
    if (fdef.maxLength && fdef.validator && val && val.length < 3) {
      $("entry-form-error").textContent = `${fdef.name} deve ter pelo menos 3 dígitos.`;
      return;
    }
  }

  const fields = {};
  for (const fdef of schema) {
    const val = (entryFieldWidgets[fdef.name].value || "").trim();
    if (val) fields[fdef.name] = val;
  }

  if (editingEntryId) {
    vault.updateEntry(editingEntryId, fields);
  } else {
    vault.addEntry(category, fields);
  }
  await vault.save();
  closeEntryModal();

  if (currentCategory) {
    renderList(vault.search("", currentCategory));
  } else {
    goHome();
  }
});

// ---------------------------------------------------------------- exportar / importar

$("btn-export").addEventListener("click", async () => {
  const bytes = await vault.exportBytes();
  downloadBytes(bytes, "vault.db");
  showToast("Backup baixado.");
});

function openImportModal() {
  $("import-error").textContent = "";
  $("import-file-input").value = "";
  $("import-password").value = "";
  $("modal-import").classList.remove("hidden");
}
function closeImportModal() {
  $("modal-import").classList.add("hidden");
}

$("btn-import-2").addEventListener("click", openImportModal);
$("login-import").addEventListener("click", openImportModal);
$("import-modal-close").addEventListener("click", closeImportModal);
$("import-cancel").addEventListener("click", closeImportModal);

$("import-confirm").addEventListener("click", async () => {
  const fileInput = $("import-file-input");
  const password = $("import-password").value;
  $("import-error").textContent = "";

  if (!fileInput.files || fileInput.files.length === 0) {
    $("import-error").textContent = "Escolha um arquivo.";
    return;
  }
  if (!password) {
    $("import-error").textContent = "Digite a senha.";
    return;
  }
  try {
    const buf = await fileInput.files[0].arrayBuffer();
    const bytes = new Uint8Array(buf);
    const imported = await Vault.loadFromFile(bytes, password);
    await imported.save(); // persiste como o cofre deste dispositivo
    vault = imported;
  } catch (e) {
    $("import-error").textContent = e.message || String(e);
    return;
  }
  closeImportModal();
  showToast(`Importado: ${vault.entries.length} entrada(s).`);
  goHome();
});

// ---------------------------------------------------------------- inicialização

(async function init() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  await initLoginScreen();
})();

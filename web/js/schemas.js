// schemas.js — espelha exatamente /schemas.py do PassVault desktop.
// Qualquer mudança no schemas.py precisa ser replicada aqui manualmente.

const CATEGORY_SCHEMAS = {
  "Bancos": [
    { name: "Banco" },
    { name: "País" },
    { name: "Agência" },
    { name: "Conta" },
    { name: "Titular" },
    { name: "TIN" },
    { name: "Usuário" },
    { name: "Login internet banking" },
    { name: "Login" },
    { name: "Senha internet banking", masked: true },
    { name: "Senha cartão", masked: true },
    { name: "Senha Letras", masked: true },
    { name: "Senha App de Celular", masked: true },
    { name: "IBAN" },
    { name: "SWIFT" },
    { name: "Sigla" },
    { name: "Gerente" },
    { name: "Endereço" },
    { name: "URL" },
    { name: "Notas", multiline: true },
  ],
  "Cartões": [
    { name: "Banco" },
    { name: "País" },
    { name: "Titular" },
    { name: "Bandeira" },
    { name: "Número", masked: true },
    { name: "Validade", format: "mm/aa" },
    { name: "CVV", masked: true, maxLength: 4, validator: /^\d{0,4}$/ },
    { name: "PIN", masked: true },
    { name: "Moeda" },
    { name: "Senha", masked: true },
    { name: "Notas", multiline: true },
  ],
  "e-mails": [
    { name: "E-mail" },
    { name: "Provedor" },
    { name: "Titular" },
    { name: "Login" },
    { name: "Senha", masked: true },
    { name: "URL" },
    { name: "Notas", multiline: true },
  ],
  "Entidades": [
    { name: "Entidade" },
    { name: "Tipo" },
    { name: "Imóvel" },
    { name: "Login" },
    { name: "Senha", masked: true },
    { name: "Cliente" },
    { name: "Número" },
    { name: "Acesso" },
    { name: "Expiração" },
    { name: "Notas", multiline: true },
    { name: "IBAN/SWIFT/BIC" },
    { name: "e-mail" },
    { name: "Telefone" },
  ],
  "Finanças": [
    { name: "Serviço" },
    { name: "Titular" },
    { name: "Login" },
    { name: "Senha", masked: true },
    { name: "URL" },
    { name: "Notas", multiline: true },
  ],
  "Identidades": [
    { name: "Tipo de Documento" },
    { name: "Titular" },
    { name: "País" },
    { name: "Número de Identidade" },
    { name: "Senha", masked: true },
    { name: "TIN" },
    { name: "Notas", multiline: true },
  ],
  "Milhagem": [
    { name: "Cia. Aérea" },
    { name: "Titular" },
    { name: "Número" },
    { name: "Login" },
    { name: "Senha", masked: true },
    { name: "Acesso" },
    { name: "Senha 2", masked: true },
    { name: "Notas", multiline: true },
  ],
  "Portas": [
    { name: "Endereço" },
    { name: "Porta 1", masked: true },
    { name: "Porta 2", masked: true },
    { name: "Notas", multiline: true },
  ],
  "Senhas": [
    { name: "Serviço" },
    { name: "Titular" },
    { name: "Login" },
    { name: "Acesso" },
    { name: "Senha", masked: true },
    { name: "Número" },
    { name: "Expiração" },
    { name: "Notas", multiline: true },
  ],
  "Senhas exterior": [
    { name: "Serviço" },
    { name: "Titular" },
    { name: "Login" },
    { name: "Senha", masked: true },
    { name: "Notas", multiline: true },
  ],
  "Trabalho": [
    { name: "Serviço" },
    { name: "Titular" },
    { name: "Login" },
    { name: "Senha", masked: true },
    { name: "Notas", multiline: true },
  ],
};

const CATEGORIES = Object.keys(CATEGORY_SCHEMAS);

function getSchema(category) {
  return CATEGORY_SCHEMAS[category] || CATEGORY_SCHEMAS["Senhas"];
}

function getTitleField(category) {
  return getSchema(category)[0].name;
}

function getDisplayTitle(category, fields) {
  const titleField = getTitleField(category);
  return (fields && fields[titleField]) || "(sem título)";
}

function isMasked(fieldDef) {
  return !!fieldDef.masked;
}

function isMultiline(fieldDef) {
  return !!fieldDef.multiline;
}

// Mesma paleta rotativa de azuis do theme.py — cor determinística por nome
// de categoria (soma dos códigos de caractere, módulo o tamanho da paleta).
const CATEGORY_PALETTE = [
  "#2F6FED", "#1F4E8C", "#3AA0C9", "#5B7FDE",
  "#2AA8A0", "#4062BB", "#6FA8DC", "#274472",
];

function categoryColor(category) {
  let sum = 0;
  for (const ch of category) sum += ch.charCodeAt(0);
  return CATEGORY_PALETTE[sum % CATEGORY_PALETTE.length];
}

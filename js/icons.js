// icons.js — espelha /icons.py (mesmos paths de 24x24, estilo linha fina).

const ICON_PATHS = {
  banco: '<path d="M3 10 L12 4 L21 10 M5 10 V19 M19 10 V19 M9 10 V19 M15 10 V19 M3 19 H21" />',
  cartao: '<rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10 H21" /><path d="M6 15 H10" />',
  email: '<rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 6 L12 13 L21 6" />',
  carteira: '<rect x="3" y="7" width="18" height="12" rx="2" /><path d="M3 10 H21" /><circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" stroke="none" />',
  identidade: '<rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16 C6 13.5 12 13.5 12 16" /><path d="M14.5 10 H18" /><path d="M14.5 13.5 H18" />',
  aviao: '<path d="M3 13 L21 6 L15 13 L21 21 L13 15 L9 21 L8 15 L3 13 Z" />',
  porta: '<rect x="5" y="3" width="14" height="18" rx="1" /><circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none" />',
  escudo: '<path d="M12 3 L20 6 V12 C20 17 16.5 20 12 21 C7.5 20 4 17 4 12 V6 Z" /><path d="M9 12 L11 14 L15.5 9" />',
  globo: '<circle cx="12" cy="12" r="9" /><path d="M3 12 H21" /><path d="M12 3 C15 6.5 15 17.5 12 21 C9 17.5 9 6.5 12 3 Z" />',
  mala: '<rect x="3" y="8" width="18" height="12" rx="2" /><path d="M9 8 V5.5 C9 4.7 9.7 4 10.5 4 H13.5 C14.3 4 15 4.7 15 5.5 V8" /><path d="M3 13 H21" />',
  pasta: '<path d="M3 7 C3 6 4 5 5 5 H9 L11 7 H19 C20 7 21 8 21 9 V17 C21 18 20 19 19 19 H5 C4 19 3 18 3 17 Z" />',
  copiar: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.8" /><path d="M15 8.5 V6.3 C15 5 14 4 12.7 4 H6.3 C5 4 4 5 4 6.3 V12.7 C4 14 5 15 6.3 15 H8.5" />',
};

const CATEGORY_ICON_MAP = [
  ["banco", "banco"],
  ["cart", "cartao"],
  ["mail", "email"],
  ["e-mail", "email"],
  ["finan", "carteira"],
  ["identidade", "identidade"],
  ["entidade", "pasta"],
  ["milhagem", "aviao"],
  ["porta", "porta"],
  ["senha exterior", "globo"],
  ["senhas exterior", "globo"],
  ["senha", "escudo"],
  ["trabalho", "mala"],
];

function iconKeyForCategory(category) {
  const name = category.trim().toLowerCase();
  for (const [needle, key] of CATEGORY_ICON_MAP) {
    if (name.includes(needle)) return key;
  }
  return "pasta";
}

function badgeSvg(category, size = 40) {
  const key = iconKeyForCategory(category);
  const color = categoryColor(category);
  const path = ICON_PATHS[key] || ICON_PATHS.pasta;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="${color}" fill-opacity="0.15" />
      <g transform="translate(4,4) scale(0.667)" fill="none" stroke="${color}"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        ${path}
      </g>
    </svg>`;
}

function plainIconSvg(key, color, size = 18) {
  const path = ICON_PATHS[key] || ICON_PATHS.pasta;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24">
      <g fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        ${path}
      </g>
    </svg>`;
}

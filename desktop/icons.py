"""
icons.py

Ícones de linha (estilo minimalista, 24x24, stroke) desenhados à mão para
cada categoria do cofre, renderizados como um "selinho" circular colorido
— visual parecido com as tags do Notion/Things 3.
"""

from PySide6.QtCore import QSize, Qt
from PySide6.QtGui import QIcon, QPixmap, QPainter, QColor
from PySide6.QtSvg import QSvgRenderer

from theme import category_color

# Cada path é um ícone de 24x24 em estilo "line icon" (stroke, sem preenchimento).
_ICON_PATHS = {
    "banco": '<path d="M3 10 L12 4 L21 10 M5 10 V19 M19 10 V19 M9 10 V19 M15 10 V19 M3 19 H21" />',
    "cartao": '<rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10 H21" /><path d="M6 15 H10" />',
    "email": '<rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 6 L12 13 L21 6" />',
    "wifi": '<path d="M4 9 C9 4 15 4 20 9" /><path d="M7 12.5 C10 9.5 14 9.5 17 12.5" /><path d="M10.5 16 C11.5 15 12.5 15 13.5 16" /><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />',
    "carteira": '<rect x="3" y="7" width="18" height="12" rx="2" /><path d="M3 10 H21" /><circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" stroke="none" />',
    "identidade": '<rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16 C6 13.5 12 13.5 12 16" /><path d="M14.5 10 H18" /><path d="M14.5 13.5 H18" />',
    "celular": '<rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18 H13" />',
    "leilao": '<path d="M6 14 L14 6" /><path d="M9 17 L2 10" /><path d="M15 3 L21 9" /><path d="M17 7 L19 5" /><path d="M3 21 H10" />',
    "familia": '<circle cx="8" cy="8" r="2.5" /><circle cx="16" cy="8" r="2.5" /><path d="M3 19 C3 15 6 13.5 8 13.5 C10 13.5 13 15 13 19" /><path d="M12 19 C12 15.3 14.5 13.7 16.5 13.7 C18.5 13.7 21 15.3 21 19" />',
    "aviao": '<path d="M3 13 L21 6 L15 13 L21 21 L13 15 L9 21 L8 15 L3 13 Z" />',
    "chave": '<circle cx="8" cy="15" r="4" /><path d="M11.5 12 L21 2.5" /><path d="M17.5 6 L20 8.5" /><path d="M14.5 9 L17 11.5" />',
    "porta": '<rect x="5" y="3" width="14" height="18" rx="1" /><circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none" />',
    "escudo": '<path d="M12 3 L20 6 V12 C20 17 16.5 20 12 21 C7.5 20 4 17 4 12 V6 Z" /><path d="M9 12 L11 14 L15.5 9" />',
    "globo": '<circle cx="12" cy="12" r="9" /><path d="M3 12 H21" /><path d="M12 3 C15 6.5 15 17.5 12 21 C9 17.5 9 6.5 12 3 Z" />',
    "mala": '<rect x="3" y="8" width="18" height="12" rx="2" /><path d="M9 8 V5.5 C9 4.7 9.7 4 10.5 4 H13.5 C14.3 4 15 4.7 15 5.5 V8" /><path d="M3 13 H21" />',
    "casa": '<path d="M4 11 L12 4 L20 11" /><path d="M6 10 V20 H18 V10" /><rect x="10" y="14" width="4" height="6" />',
    "pasta": '<path d="M3 7 C3 6 4 5 5 5 H9 L11 7 H19 C20 7 21 8 21 9 V17 C21 18 20 19 19 19 H5 C4 19 3 18 3 17 Z" />',
}

# Mapeia (parte do nome da categoria, em minúsculas) -> ícone
_CATEGORY_ICON_MAP = [
    ("banco", "banco"),
    ("cart", "cartao"),
    ("mail", "email"),
    ("e-mail", "email"),
    ("finan", "carteira"),
    ("identidade", "identidade"),
    ("milhagem", "aviao"),
    ("porta", "porta"),
    ("senha exterior", "globo"),
    ("senhas exterior", "globo"),
    ("senha", "escudo"),
    ("trabalho", "mala"),
]


def icon_key_for_category(category: str) -> str:
    name = category.strip().lower()
    for needle, key in _CATEGORY_ICON_MAP:
        if needle in name:
            return key
    return "pasta"  # fallback genérico


def _render_badge_pixmap(icon_key: str, color_hex: str, size: int = 40) -> QPixmap:
    path = _ICON_PATHS.get(icon_key, _ICON_PATHS["pasta"])
    svg = f'''
    <svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="12" fill="{color_hex}" fill-opacity="0.15" />
        <g transform="translate(4,4) scale(0.667)" fill="none" stroke="{color_hex}"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            {path}
        </g>
    </svg>
    '''
    renderer = QSvgRenderer(svg.encode("utf-8"))
    pixmap = QPixmap(size, size)
    pixmap.fill(Qt.transparent)
    painter = QPainter(pixmap)
    renderer.render(painter)
    painter.end()
    return pixmap


_icon_cache: dict[str, QIcon] = {}


def category_icon(category: str, size: int = 40) -> QIcon:
    """Retorna um QIcon (selinho colorido) para a categoria informada,
    com cache para não re-renderizar SVG toda hora."""
    cache_key = f"{category}:{size}"
    if cache_key in _icon_cache:
        return _icon_cache[cache_key]
    key = icon_key_for_category(category)
    color = category_color(category)
    pixmap = _render_badge_pixmap(key, color, size)
    icon = QIcon(pixmap)
    _icon_cache[cache_key] = icon
    return icon

"""
schemas.py

Define os campos de cada categoria. Cada campo tem:
  - name: rótulo exibido no formulário
  - masked: se o valor deve ser exibido mascarado (••••) por padrão
  - multiline: se o campo é texto livre multilinha (só Notas, na prática)
  - format: formato especial (ex.: "mm/aa" para Validade)
  - max_length: limite de caracteres (ex.: 4 para CVV)
  - validator: regex opcional para validação de entrada

O primeiro campo de cada categoria é usado como "título" da entrada
para exibição em listas e buscas.
"""

CATEGORY_SCHEMAS: dict[str, list[dict]] = {
    "Bancos": [
        {"name": "Banco"},
        {"name": "País"},
        {"name": "Agência"},
        {"name": "Conta"},
        {"name": "Titular"},
        {"name": "TIN"},
        {"name": "Login internet banking"},
        {"name": "Senha internet banking", "masked": True},
        {"name": "URL"},
        {"name": "Senha App de Celular", "masked": True},
        {"name": "Notas", "multiline": True},
    ],
    "Cartões": [
        {"name": "Banco"},
        {"name": "País"},
        {"name": "Titular"},
        {"name": "Bandeira"},
        {"name": "Número", "masked": True},
        {"name": "Validade", "format": "mm/aa"},
        {"name": "CVV", "masked": True, "max_length": 4, "validator": r"\d{0,4}"},
        {"name": "Notas", "multiline": True},
    ],
    "e-mails": [
        {"name": "Provedor"},
        {"name": "Titular"},
        {"name": "Login"},
        {"name": "Senha", "masked": True},
        {"name": "URL"},
        {"name": "Notas", "multiline": True},
    ],
    "Finanças": [
        {"name": "Serviço"},
        {"name": "Titular"},
        {"name": "Login"},
        {"name": "Senha", "masked": True},
        {"name": "URL"},
        {"name": "Notas", "multiline": True},
    ],
    "Identidades": [
        {"name": "Titular"},
        {"name": "País"},
        {"name": "Tipo de Documento"},
        {"name": "Número de Identidade"},
        {"name": "TIN"},
        {"name": "Notas", "multiline": True},
    ],
    "Milhagem": [
        {"name": "Cia. Aérea"},
        {"name": "Titular"},
        {"name": "Número"},
        {"name": "Login"},
        {"name": "Senha", "masked": True},
        {"name": "Notas", "multiline": True},
    ],
    "Portas": [
        {"name": "Endereço"},
        {"name": "Porta 1", "masked": True},
        {"name": "Porta 2", "masked": True},
        {"name": "Notas", "multiline": True},
    ],
    "Senhas": [
        {"name": "Serviço"},
        {"name": "Titular"},
        {"name": "Login"},
        {"name": "Senha", "masked": True},
        {"name": "Notas", "multiline": True},
    ],
    "Senhas exterior": [
        {"name": "Serviço"},
        {"name": "Titular"},
        {"name": "Login"},
        {"name": "Senha", "masked": True},
        {"name": "Notas", "multiline": True},
    ],
    "Trabalho": [
        {"name": "Serviço"},
        {"name": "Titular"},
        {"name": "Login"},
        {"name": "Senha", "masked": True},
        {"name": "Notas", "multiline": True},
    ],
}

CATEGORIES = list(CATEGORY_SCHEMAS.keys())


def get_schema(category: str) -> list[dict]:
    return CATEGORY_SCHEMAS.get(category, CATEGORY_SCHEMAS["Senhas"])


def get_title_field(category: str) -> str:
    """Nome do campo que serve como 'título' da entrada (sempre o primeiro)."""
    return get_schema(category)[0]["name"]


def get_display_title(category: str, fields: dict) -> str:
    """Valor a exibir como título da entrada em listas."""
    title_field = get_title_field(category)
    return fields.get(title_field, "") or "(sem título)"


def is_masked(field_def: dict) -> bool:
    return field_def.get("masked", False)


def is_multiline(field_def: dict) -> bool:
    return field_def.get("multiline", False)


# Mapeamento para migração de entradas do formato antigo (v1) para o novo
_MIGRATION_MAP = {
    "Bancos": {"title": "Banco", "username": "Login internet banking",
               "password": "Senha internet banking", "url": "URL", "notes": "Notas"},
    "Cartões": {"title": "Banco", "notes": "Notas"},
    "e-mails": {"title": "Provedor", "username": "Login",
                "password": "Senha", "url": "URL", "notes": "Notas"},
    "Finanças": {"title": "Serviço", "username": "Login",
                 "password": "Senha", "url": "URL", "notes": "Notas"},
    "Identidades": {"title": "Titular", "notes": "Notas"},
    "Milhagem": {"title": "Cia. Aérea", "username": "Login",
                 "password": "Senha", "notes": "Notas"},
    "Portas": {"title": "Endereço", "notes": "Notas"},
    "Senhas": {"title": "Serviço", "username": "Login",
               "password": "Senha", "notes": "Notas"},
    "Senhas exterior": {"title": "Serviço", "username": "Login",
                        "password": "Senha", "notes": "Notas"},
    "Trabalho": {"title": "Serviço", "username": "Login",
                 "password": "Senha", "notes": "Notas"},
}

# Categorias antigas que foram removidas — migram para "Senhas"
_OLD_CATEGORY_MAP = {
    "Airbnb": "Senhas",
    "IMEIs": "Senhas",
    "Internet": "Senhas",
    "Leiloeiros": "Senhas",
    "PINs": "Senhas",
    "Outros": "Senhas",
    "Trabalho - Clientes": "Trabalho",
    "Trabalho - serviços": "Trabalho",
    "Meninos": "Senhas",
}


def migrate_entry_v1(entry_dict: dict) -> dict:
    """Converte uma entrada no formato antigo (v1: title/username/password/
    url/notes como campos separados) para o formato novo (tudo em 'fields').
    Retorna o dict atualizado. Não altera o original."""
    # Se já tem 'fields', é formato novo — retorna como está
    if "fields" in entry_dict:
        return entry_dict

    cat = entry_dict.get("category", "Senhas")
    # Migrar categoria antiga para nova, se necessário
    if cat in _OLD_CATEGORY_MAP:
        cat = _OLD_CATEGORY_MAP[cat]
        entry_dict["category"] = cat

    mapping = _MIGRATION_MAP.get(cat, _MIGRATION_MAP["Senhas"])
    fields = dict(entry_dict.get("extra", {}))  # copia extras existentes (ex.: campos de cartão v1)

    for old_key, new_key in mapping.items():
        old_val = entry_dict.get(old_key, "")
        if old_val and new_key not in fields:
            fields[new_key] = old_val

    # Campos de cartão v1 já estavam em extra com nomes diferentes
    if cat == "Cartões":
        cartao_map = {"titular": "Titular", "numero": "Número",
                      "expiracao": "Validade", "cvv": "CVV"}
        for old_k, new_k in cartao_map.items():
            if old_k in fields and new_k not in fields:
                fields[new_k] = fields.pop(old_k)

    entry_dict["fields"] = fields
    # Limpa campos antigos para não poluir
    for old_key in ("title", "username", "password", "url", "notes", "extra"):
        entry_dict.pop(old_key, None)

    return entry_dict

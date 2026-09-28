"""
category_guess.py

Heurística simples de adivinhação de categoria a partir de um texto
(geralmente o título/nome de uma entrada). Baseada em palavras-chave —
sem nenhuma IA, sem nada saindo do computador. Propositalmente simples e
"burra": funciona bem quando o título já indica claramente do que se
trata (ex.: "Banco Itaú", "Wifi de casa"), e admite abertamente quando
não faz ideia (categoria "Outros", confiança "baixa") em vez de arriscar
um chute ruim silenciosamente.
"""

# Cada item: (categoria, lista de palavras/trechos que, se aparecerem no
# texto em minúsculas, indicam essa categoria). Ordem importa: a primeira
# categoria que bater uma palavra-chave é a escolhida.
CATEGORY_KEYWORDS: list[tuple[str, list[str]]] = [
    ("Airbnb", ["airbnb"]),
    ("Cartões", ["cartao", "cartão", "visa", "mastercard", "elo ", "amex"]),
    ("Bancos", [
        "banco", "bradesco", "itau", "itaú", "santander", "caixa",
        "nubank", "inter ", "banco do brasil", " bb ", "sicredi", "sicoob",
    ]),
    ("e-mails", ["email", "e-mail", "gmail", "outlook", "hotmail", "yahoo"]),
    ("Finanças", [
        "financ", "investimento", "corretora", "xp investimentos",
        "clear ", "tesouro direto", "rico ", "btg",
    ]),
    ("Identidades", ["identidade", " rg ", "cpf", "passaporte", "cnh"]),
    ("IMEIs", ["imei", "celular", "smartphone"]),
    ("Internet", ["wifi", "wi-fi", "internet", "roteador", "provedor", "modem"]),
    ("Leiloeiros", ["leilao", "leilão", "leiloeiro"]),
    ("Milhagem", [
        "milha", "milhagem", "latam pass", "smiles", "tudoazul",
        "azul fidelidade", "livelo",
    ]),
    ("PINs", [" pin ", "pin do"]),
    ("Portas", ["porta", "cadeado", "fechadura", "alarme", "portao", "portão"]),
    ("Senhas exterior", ["exterior", "estrangeiro", "internacional"]),
    ("Trabalho - Clientes", ["cliente"]),
    ("Trabalho - serviços", ["trabalho", "servico", "serviço", "empresa"]),
    ("Senhas", ["senha", "login", "conta "]),
]


def guess_category(text: str) -> tuple[str, str]:
    """Retorna (categoria_sugerida, confianca), onde confianca é
    'alta' (bateu alguma palavra-chave) ou 'baixa' (caiu em 'Outros')."""
    lower = f" {text.strip().lower()} "
    for category, keywords in CATEGORY_KEYWORDS:
        for kw in keywords:
            if kw in lower:
                return category, "alta"
    return "Senhas", "baixa"

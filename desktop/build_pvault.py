"""
build_pvault.py

PASSO 2 do conversor Excel -> PassVault.

Lê a planilha já revisada (gerada e corrigida a partir de
guess_categories.py) e produz um arquivo .pvault criptografado, pronto
para ser aberto no PassVault com o botão "Importar e mesclar".

Como cada categoria agora tem seu próprio conjunto de campos (ver
schemas.py), este script faz um mapeamento best-effort: usa o primeiro
campo do esquema da categoria como título, procura um campo parecido com
"login" para o usuário, o primeiro campo mascarado para a senha, um
campo "URL" se existir, e o campo de notas (multilinha) se existir.
Isso cobre bem a maioria das categorias (Senhas, e-mails, Finanças,
Trabalho...), mas para categorias com estrutura bem diferente (ex.:
Bancos, Cartões, Identidades) o resultado pode cair em campos que não
são exatamente os ideais — revise e ajuste manualmente depois de
importar, se for o caso.

Uso:
    python build_pvault.py "C:\\caminho\\para\\senhas_revisar.xlsx"
"""

import getpass
import json
import os
import sys
import uuid

import openpyxl

from vault import Entry
from schemas import CATEGORIES, get_schema, get_title_field, is_masked, is_multiline
from export_import import export_raw_entries


def _pick_field(schema, predicate):
    for fdef in schema:
        if predicate(fdef):
            return fdef["name"]
    return None


def map_row_to_fields(category: str, title, username, password, url, notes) -> dict:
    schema = get_schema(category)
    fields = {}

    title_field = get_title_field(category)
    if title:
        fields[title_field] = title

    login_field = _pick_field(
        schema, lambda f: f["name"] != title_field and
        ("login" in f["name"].lower() or "usuário" in f["name"].lower() or "usuario" in f["name"].lower())
    )
    if username and login_field:
        fields[login_field] = username

    password_field = _pick_field(schema, lambda f: is_masked(f) and f["name"] not in fields)
    if password and password_field:
        fields[password_field] = password

    url_field = _pick_field(schema, lambda f: "url" in f["name"].lower())
    if url and url_field:
        fields[url_field] = url

    notes_field = _pick_field(schema, is_multiline)
    if notes and notes_field:
        fields[notes_field] = notes

    return fields


def main():
    if len(sys.argv) < 2:
        print("Uso: python build_pvault.py <planilha_revisar.xlsx>")
        sys.exit(1)

    in_path = sys.argv[1]
    if not os.path.isfile(in_path):
        print(f"Arquivo não encontrado: {in_path}")
        sys.exit(1)

    base, _ = os.path.splitext(in_path)
    candidates = [f"{base}.mapping.json"]
    if base.endswith("_revisar"):
        candidates.append(f"{base[:-len('_revisar')]}_revisar.mapping.json")

    mapping = None
    for c in candidates:
        if os.path.isfile(c):
            with open(c, encoding="utf-8") as f:
                mapping = json.load(f)
            print(f"Mapeamento de colunas carregado de: {c}")
            break

    if mapping is None:
        print("Não encontrei o arquivo de mapeamento de colunas gerado pelo")
        print("guess_categories.py. Vou perguntar manualmente.\n")
        wb_probe = openpyxl.load_workbook(in_path, data_only=True)
        ws_probe = wb_probe.active
        cols = [str(c.value) for c in ws_probe[1]]
        for i, c in enumerate(cols, 1):
            print(f"  {i}. {c}")

        def ask(prompt, allow_skip=True):
            suffix = " (Enter para pular)" if allow_skip else ""
            while True:
                choice = input(f"{prompt}{suffix}: ").strip()
                if not choice and allow_skip:
                    return None
                if choice.isdigit() and 1 <= int(choice) <= len(cols):
                    return cols[int(choice) - 1]
                print("  Opção inválida.")

        mapping = {
            "title_col": ask("Qual coluna é o TÍTULO/Nome", allow_skip=False),
            "user_col": ask("Qual coluna é o USUÁRIO"),
            "pass_col": ask("Qual coluna é a SENHA"),
            "url_col": ask("Qual coluna é a URL/Site"),
            "notes_col": ask("Qual coluna é NOTAS"),
            "category_col": ask("Qual coluna tem a CATEGORIA já revisada", allow_skip=False),
        }

    wb = openpyxl.load_workbook(in_path, data_only=True)
    ws = wb.active
    header = [str(c.value) if c.value is not None else "" for c in ws[1]]
    col_index = {name: idx + 1 for idx, name in enumerate(header)}

    def get(row, key):
        col_name = mapping.get(key)
        if not col_name or col_name not in col_index:
            return ""
        val = ws.cell(row=row, column=col_index[col_name]).value
        return str(val) if val is not None else ""

    entries = []
    categories_seen = set(CATEGORIES)
    for row in range(2, ws.max_row + 1):
        title = get(row, "title_col").strip()
        if not title:
            continue
        category = get(row, "category_col").strip() or "Senhas"
        if category not in CATEGORIES:
            # categoria desconhecida (ex.: planilha antiga com "Outros") -> cai no default
            category = "Senhas"
        categories_seen.add(category)

        fields = map_row_to_fields(
            category,
            title=title,
            username=get(row, "user_col").strip(),
            password=get(row, "pass_col"),
            url=get(row, "url_col").strip(),
            notes=get(row, "notes_col").strip(),
        )

        entries.append(Entry(id=str(uuid.uuid4()), category=category, fields=fields))

    if not entries:
        print("Nenhuma linha válida encontrada (título vazio em todas?). Nada a fazer.")
        sys.exit(1)

    print(f"\n{len(entries)} entrada(s) prontas para exportar.")
    by_cat = {}
    for e in entries:
        by_cat[e.category] = by_cat.get(e.category, 0) + 1
    for cat, count in sorted(by_cat.items()):
        print(f"  {cat}: {count}")

    out_default = f"{os.path.splitext(in_path)[0]}.pvault"
    out_path = input(f"\nNome do arquivo de saída [{out_default}]: ").strip() or out_default

    while True:
        pw1 = getpass.getpass("Crie uma senha de compartilhamento (mín. 8 caracteres): ")
        if len(pw1) < 8:
            print("Muito curta, tente de novo.")
            continue
        pw2 = getpass.getpass("Confirme a senha de compartilhamento: ")
        if pw1 != pw2:
            print("As senhas não coincidem, tente de novo.")
            continue
        break

    export_raw_entries(entries, sorted(categories_seen), out_path, pw1)
    print(f"\nPronto! Arquivo gerado: {out_path}")
    print("Abra o PassVault, clique em 'Importar e mesclar', escolha esse")
    print("arquivo e digite a mesma senha de compartilhamento que você criou agora.")


if __name__ == "__main__":
    main()

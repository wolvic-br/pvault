"""
export_import.py

Permite exportar um subconjunto (ou tudo) do cofre para um arquivo
`.pvault` protegido por uma SENHA DE COMPARTILHAMENTO — que é diferente
da senha-mestra pessoal de cada um. Esse arquivo pode ser mandado por
e-mail, pendrive, WhatsApp, etc., e importado/mesclado no cofre de outra
pessoa da família.

Regra de mesclagem:
- Cada entrada tem um ID único (UUID) criado na hora em que foi cadastrada.
- Se o ID já existe no cofre de destino, mantém a versão mais recente
  (compara `updated_at`) e descarta a mais antiga.
- Se o ID não existe, a entrada é adicionada.
- Entradas com IDs diferentes mas conteúdo muito parecido (mesmo título +
  usuário + categoria) são sinalizadas como "possíveis duplicatas" para
  você decidir manualmente o que fazer — o merge NUNCA apaga uma entrada
  sozinho nesse caso, só avisa.

Limitação importante: a comparação de "mais recente" usa o relógio de
cada computador. Se o relógio de alguém estiver muito errado, o merge
pode escolher a versão errada em caso de conflito real (a mesma entrada
editada em dois lugares). Para a maioria dos casos de uso (cada pessoa
cadastra as próprias senhas) isso não chega a ser um problema, já que
não há edição concorrente da mesma entrada.
"""

import json
import time
from dataclasses import asdict, dataclass, field

from crypto_utils import generate_salt, derive_key, encrypt, decrypt, pack_header, unpack_header
from vault import Entry, Vault

EXPORT_MAGIC = b"PVXP"  # diferente do magic do cofre pessoal (PVLT),
                        # assim o app percebe se você tentar "importar"
                        # um vault.db normal por engano.


class ExportImportError(Exception):
    pass


@dataclass
class MergeSummary:
    added: int = 0
    updated: int = 0
    skipped: int = 0
    possible_duplicates: list = field(default_factory=list)  # list of tuples (a: Entry, b: Entry)


# ---------------------------------------------------------------- exportar

def _pack_export(entries: list[Entry], categories: list[str], out_path: str,
                  share_passphrase: str) -> int:
    payload = {
        "exported_at": time.time(),
        "categories": categories,
        "entries": [asdict(e) for e in entries],
    }
    plaintext = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    salt = generate_salt()
    key = derive_key(share_passphrase, salt)
    blob = encrypt(key, plaintext)
    header = pack_header(salt, magic=EXPORT_MAGIC)

    with open(out_path, "wb") as f:
        f.write(header + blob)

    return len(entries)


def export_entries(vault: Vault, out_path: str, share_passphrase: str,
                    categories: list[str] | None = None) -> int:
    """Exporta entradas do cofre para um arquivo .pvault cifrado."""
    from schemas import CATEGORIES as ALL_CATS
    entries = vault.entries
    if categories is not None:
        entries = [e for e in entries if e.category in categories]
    return _pack_export(entries, ALL_CATS, out_path, share_passphrase)


def export_raw_entries(entries: list[Entry], categories: list[str], out_path: str,
                        share_passphrase: str) -> int:
    """Igual a export_entries, mas para quando as entradas não vêm de um
    Vault já aberto — usado por scripts de importação/conversão externos
    (ex.: conversor de planilha Excel) que montam entradas na mão."""
    return _pack_export(entries, categories, out_path, share_passphrase)


# ---------------------------------------------------------------- importar + mesclar

def _load_export_payload(in_path: str, share_passphrase: str) -> dict:
    with open(in_path, "rb") as f:
        raw = f.read()
    try:
        salt, rest = unpack_header(raw, expected_magic=EXPORT_MAGIC)
    except ValueError:
        raise ExportImportError(
            "Esse arquivo não parece ser um arquivo de exportação do "
            "PassVault (.pvault) válido."
        )
    key = derive_key(share_passphrase, salt)
    try:
        plaintext = decrypt(key, rest)
    except Exception:
        raise ExportImportError("Senha de compartilhamento incorreta.")
    return json.loads(plaintext.decode("utf-8"))


def _similarity_key(e: Entry) -> tuple:
    fields = e.fields if hasattr(e, 'fields') else {}
    title_val = ""
    for v in list(fields.values())[:1]:
        title_val = str(v).strip().lower()
    return (e.category.strip().lower(), title_val)


def preview_import(in_path: str, share_passphrase: str) -> dict:
    """Carrega o payload sem alterar nada, útil para mostrar prévia antes
    de confirmar o merge."""
    return _load_export_payload(in_path, share_passphrase)


def merge_into_vault(vault: Vault, payload: dict) -> MergeSummary:
    from schemas import migrate_entry_v1
    summary = MergeSummary()

    existing_by_id = {e.id: e for e in vault.entries}

    for ed in payload.get("entries", []):
        ed = migrate_entry_v1(dict(ed))
        known_fields = {f for f in Entry.__dataclass_fields__}
        clean = {k: v for k, v in ed.items() if k in known_fields}
        incoming = Entry(**clean)

        existing = existing_by_id.get(incoming.id)
        if existing is None:
            vault.entries.append(incoming)
            existing_by_id[incoming.id] = incoming
            summary.added += 1
        elif incoming.updated_at > existing.updated_at:
            idx = vault.entries.index(existing)
            vault.entries[idx] = incoming
            existing_by_id[incoming.id] = incoming
            summary.updated += 1
        else:
            summary.skipped += 1

    # heurística de possíveis duplicatas (IDs diferentes, conteúdo parecido)
    groups: dict[tuple, list[Entry]] = {}
    for e in vault.entries:
        groups.setdefault(_similarity_key(e), []).append(e)
    for key, group in groups.items():
        if len(group) > 1:
            ids = {e.id for e in group}
            if len(ids) > 1:
                summary.possible_duplicates.append(tuple(group))

    return summary

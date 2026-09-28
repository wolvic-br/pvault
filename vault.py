"""
vault.py — v2

Modelo de dados baseado em schemas por categoria. Cada entrada guarda
seus valores num dicionário 'fields', cujas chaves correspondem aos
nomes de campo definidos em schemas.py para a categoria da entrada.

Compatível com cofres v1: ao carregar, entradas no formato antigo
(title/username/password/url/notes) são migradas automaticamente.
"""

import json
import os
import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import Optional

from crypto_utils import (
    generate_salt, derive_key, encrypt, decrypt, pack_header, unpack_header,
)
from schemas import (
    CATEGORIES, get_schema, get_display_title, get_title_field,
    is_masked, migrate_entry_v1,
)


@dataclass
class Entry:
    id: str
    category: str
    fields: dict = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def touch(self):
        self.updated_at = time.time()

    @property
    def display_title(self) -> str:
        return get_display_title(self.category, self.fields)

    def get_field(self, name: str) -> str:
        return self.fields.get(name, "")

    def set_field(self, name: str, value: str):
        self.fields[name] = value


class VaultError(Exception):
    pass


class Vault:
    def __init__(self, path: str):
        self.path = path
        self._key: Optional[bytes] = None
        self._salt: Optional[bytes] = None
        self.entries: list[Entry] = []

    @staticmethod
    def exists(path: str) -> bool:
        return os.path.isfile(path)

    @classmethod
    def create_new(cls, path: str, master_password: str) -> "Vault":
        if os.path.isfile(path):
            raise VaultError("Já existe um cofre nesse caminho.")
        v = cls(path)
        v._salt = generate_salt()
        v._key = derive_key(master_password, v._salt)
        v.entries = []
        v.save()
        return v

    @classmethod
    def load(cls, path: str, master_password: str) -> "Vault":
        if not os.path.isfile(path):
            raise VaultError("Arquivo de cofre não encontrado.")
        with open(path, "rb") as f:
            raw = f.read()
        salt, rest = unpack_header(raw)
        key = derive_key(master_password, salt)
        try:
            plaintext = decrypt(key, rest)
        except Exception:
            raise VaultError("Senha-mestra incorreta ou arquivo corrompido.")
        payload = json.loads(plaintext.decode("utf-8"))
        v = cls(path)
        v._salt = salt
        v._key = key
        raw_entries = payload.get("entries", [])
        v.entries = []
        for ed in raw_entries:
            ed = migrate_entry_v1(ed)
            known = {f for f in Entry.__dataclass_fields__}
            clean = {k: v for k, v in ed.items() if k in known}
            v.entries.append(Entry(**clean))
        return v

    def save(self):
        if self._key is None or self._salt is None:
            raise VaultError("Cofre bloqueado, não é possível salvar.")
        payload = {
            "version": 2,
            "categories": CATEGORIES,
            "entries": [asdict(e) for e in self.entries],
        }
        plaintext = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        blob = encrypt(self._key, plaintext)
        header = pack_header(self._salt)
        tmp_path = self.path + ".tmp"
        with open(tmp_path, "wb") as f:
            f.write(header + blob)
        os.replace(tmp_path, self.path)

    def change_master_password(self, new_password: str):
        self._salt = generate_salt()
        self._key = derive_key(new_password, self._salt)
        self.save()

    def lock(self):
        self._key = None
        self.entries = []

    @property
    def is_unlocked(self) -> bool:
        return self._key is not None

    # ---------- CRUD ----------

    def add_entry(self, category: str, fields: dict) -> Entry:
        e = Entry(id=str(uuid.uuid4()), category=category, fields=dict(fields))
        self.entries.append(e)
        return e

    def update_entry(self, entry_id: str, **kwargs):
        for e in self.entries:
            if e.id == entry_id:
                for k, val in kwargs.items():
                    setattr(e, k, val)
                e.touch()
                return e
        raise VaultError("Entrada não encontrada.")

    def delete_entry(self, entry_id: str):
        self.entries = [e for e in self.entries if e.id != entry_id]

    def search(self, text: str, category: Optional[str] = None) -> list[Entry]:
        text = text.lower().strip()
        results = self.entries
        if category:
            results = [e for e in results if e.category == category]
        if text:
            results = [
                e for e in results
                if any(text in str(v).lower() for v in e.fields.values())
            ]
        return sorted(results, key=lambda e: e.display_title.lower())

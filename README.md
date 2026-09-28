# PassVault

Gerenciador de senhas pessoal e familiar, 100% local.

```
desktop/   versão para computador (Windows) — Python + PySide6
web/       versão para celular (PWA) — instalável no iPhone pelo Safari
```

Os dois lados usam o mesmo formato de cofre (Argon2id + AES-256-GCM):
um `vault.db` criado num abre no outro.

- Versão web: veja `web/README.md`.
- Versão desktop: `desktop/exemplos/vault-teste.db` é um cofre de teste,
  sem dados reais.

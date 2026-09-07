# PassVault Web (PWA)

Versão web instalável do PassVault, para rodar no iPhone (e em qualquer
navegador moderno) sem precisar de App Store, Mac ou Xcode.

## O que é isso, tecnicamente

- **Mesmo esquema de criptografia** do app desktop: Argon2id (time=3,
  memória=64MB, paralelismo=4) para derivar a chave a partir da
  senha-mestra, e AES-256-GCM para cifrar o cofre inteiro.
- **Testado e confirmado**: um `vault.db` criado por este app web abre
  normalmente no PassVault Python (`vault.py`), e vice-versa — mesma
  senha, mesmo resultado, byte a byte.
- Os dados ficam salvos no **IndexedDB do navegador**, no próprio
  iPhone/computador. Nada é enviado para nenhum servidor.
- Funciona **offline** depois de instalado (service worker cacheia tudo).

## Como publicar (pra poder instalar no iPhone)

O Safari só permite instalar um PWA (e só libera a Web Crypto API) em
sites servidos por **HTTPS**. Como você tem um Mac, o caminho mais
rápido, sem precisar configurar servidor nenhum:

### Opção mais rápida: Netlify Drop
1. Abra https://app.netlify.com/drop no navegador do Mac.
2. Arraste a pasta `site/` inteira (a que tem o `index.html` dentro)
   para a página.
3. Em alguns segundos, você recebe um link `https://algumnome.netlify.app`.
4. Abra esse link no Safari do iPhone.

Não precisa criar conta pra isso funcionar (embora criar uma conta grátis
deixe o link fixo, em vez de aleatório).

### Alternativa: GitHub Pages
Se preferir algo mais permanente e sob seu controle, suba a pasta `site/`
para um repositório no GitHub e ative o GitHub Pages nas configurações do
repositório (Settings → Pages). Também sai com HTTPS de graça.

## Como instalar no iPhone

1. Abra o link (https) no **Safari** (tem que ser Safari — Chrome no iOS
   não permite instalar PWAs).
2. Toque no ícone de compartilhar (o quadrado com a seta para cima).
3. Toque em **"Adicionar à Tela de Início"**.
4. Pronto — abre um ícone igual a qualquer outro app, em tela cheia, sem
   a barra de endereço do navegador.

## Limitações importantes (leia antes de confiar 100% nisso)

- **Persistência no Safari não é 100% garantida.** O iOS pode, em teoria,
  limpar dados de sites/apps não usados por muito tempo. Por isso:
  **use o botão "Baixar cofre (backup)" regularmente** e guarde o arquivo
  `vault.db` gerado em outro lugar (iCloud Drive, e-mail para si mesmo,
  etc.). Trate o armazenamento do navegador como conveniência, não como
  único backup.
- **Importar substitui tudo.** Ao contrário do "Importar e mesclar" do
  desktop (que combina entradas inteligentemente), a importação aqui
  troca o cofre inteiro do dispositivo pelo conteúdo do arquivo
  importado. Se quiser mesclar entradas de dois dispositivos, funde os
  dados no app desktop primeiro (que já tem essa lógica pronta) e depois
  importa o resultado aqui.
- **Sem sincronização automática entre dispositivos.** Cada instalação
  (seu iPhone, o computador da sua mãe, etc.) guarda seu próprio cofre.
  Para levar os mesmos dados de um lado para o outro, use
  "Baixar cofre" num dispositivo e "Importar" no outro.
- Testado no simulador de navegador durante o desenvolvimento; **teste
  numa entrada de teste primeiro** antes de confiar dados reais nele,
  igual você fez com o app desktop.

## Estrutura dos arquivos

```
site/
├── index.html          (tela principal)
├── manifest.webmanifest (metadados de instalação do PWA)
├── sw.js                (service worker — cache offline)
├── css/styles.css
├── js/
│   ├── schemas.js       (mesmas categorias/campos do schemas.py)
│   ├── crypto.js        (Argon2id + AES-256-GCM, espelha crypto_utils.py)
│   ├── db.js             (armazenamento local via IndexedDB)
│   ├── vault.js          (classe Vault, espelha vault.py)
│   ├── icons.js          (ícones de categoria, espelha icons.py)
│   └── app.js            (interface e eventos, espelha gui.py)
├── vendor/               (biblioteca Argon2 compilada para WebAssembly)
└── icons/                (ícones do app para a tela de início)
```

Se você mudar `schemas.py` no app desktop, replique a mudança em
`js/schemas.js` manualmente — não há sincronização automática entre eles.

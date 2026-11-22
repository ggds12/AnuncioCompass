# Compasso — página de vendas

Página de vendas do Compasso, um app de organização financeira para quem quer aprender a cuidar do próprio dinheiro.

HTML, CSS e JavaScript puros, sem etapa de build. O único código de terceiros é o three.js (MIT), guardado em `vendor/` e carregado só no fim da página.

- `index.html`: a página de vendas
- `ocean.js`: a cena 3D do fim da página (tartaruga em alto mar)
- `privacidade.html`: política de privacidade
- `fonte.html`: apresentação da fonte própria **Compasso Casco**
- `fonts/`: a fonte (woff2/ttf) e o script que a gera (`build-casco.py`, usa fontTools)
- `assets/`: logo e ícones dos bancos (`assets/banks/app/`)
- `vendor/three.min.js`: three.js r128

## Rodar localmente

```bash
python -m http.server 4399
```

Abra http://localhost:4399.

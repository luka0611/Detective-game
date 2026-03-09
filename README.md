# Casal Detetive LAN

Jogo cooperativo de suspense/detetive em português para **2 celulares Android** na mesma rede local, com host no PC.

## Requisitos
- Node.js 18+
- PC e 2 celulares na mesma rede Wi‑Fi

## Como rodar
```bash
npm install
npm start
```

O terminal mostrará algo como `http://192.168.x.x:8080`.

1. No PC, deixe o servidor rodando.
2. Nos dois celulares, abra o navegador e acesse o endereço mostrado.
3. Um jogador cria a sala, o outro entra com o código.
4. Iniciem e resolvam os 2 crimes em cooperação.

## Sistema de papéis (complementar)
- Jogador 1: **Investigador de Campo**.
- Jogador 2: **Analista Forense**.
- Cada fase tem uma pista exclusiva por papel.
- Só juntando as duas pistas dá para responder com segurança.

## Mecânica
- 2 crimes, cada um com 3 fases.
- Resposta correta: +10 pontos.
- Resposta errada: -10 pontos.
- Pedir dica: -5 pontos.
- Sincronização em tempo real entre os dois celulares via Socket.IO.

## Se aparecer conflito de merge
Se você viu mensagem de conflito nesses arquivos (`README.md`, `data/cases.json`, `public/app.js`, `public/index.html`, `public/styles.css` e `test/cases.test.js`), rode:

```bash
git status
npm run check:conflicts
```

### Fluxo rápido para resolver
1. Abra cada arquivo com conflito e remova os blocos com:
   - `<<<<<<<`
   - `=======`
   - `>>>>>>>`
2. Mantenha só a versão final correta do conteúdo.
3. Marque como resolvido:

```bash
git add README.md data/cases.json public/app.js public/index.html public/styles.css test/cases.test.js server.js
```

4. Finalize:

```bash
git commit -m "fix: resolver conflitos de merge"
```

> Observação: o nome certo do teste neste projeto é `test/cases.test.js` (não `server.cases.test.js`).

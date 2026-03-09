# Casal Detetive LAN

Jogo cooperativo de suspense/detetive em português para **2 celulares Android** na mesma rede local, com host no PC.

## Requisitos
- Node.js 18+
- PC e 2 celulares na mesma rede Wi‑Fi

## Como rodar (super simples)
```bash
npm install
npm start
```

O terminal mostrará algo como `http://192.168.x.x:8080`.

1. No PC, deixe o servidor rodando.
2. Nos dois celulares, abra o navegador e acesse o endereço mostrado.
3. Um jogador cria a sala, o outro entra com o código.
4. Cada pessoa recebe um papel diferente e pistas exclusivas.
5. Compartilhem informações para resolver os **2 crimes** com fases e charadas.

## Mecânica
- 2 crimes, cada um com 3 fases.
- Papéis fixos e complementares:
  - **Reconstituidor de Cena**: foca em horários e movimentação.
  - **Analista Forense**: foca em evidências físicas e padrões.
- Cada fase tem uma pista exclusiva por papel + enigma compartilhado.
- Resposta correta: +10 pontos.
- Resposta errada: -10 pontos.
- Pedir dica: -5 pontos.
- Sincronização em tempo real entre os dois celulares via Socket.IO.

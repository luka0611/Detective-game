#!/usr/bin/env bash
set -euo pipefail

FILES=(
  README.md
  data/cases.json
  public/app.js
  public/index.html
  public/styles.css
  test/cases.test.js
  server.js
)

found=0

# 1) Git index conflicts (unmerged entries)
if git ls-files -u | rg -n "." >/dev/null 2>&1; then
  echo "Existem conflitos de merge no índice do git (arquivos unmerged)."
  git ls-files -u
  found=1
fi

# 2) Conflict markers inside key files
for file in "${FILES[@]}"; do
  if rg -n "^(<<<<<<<|=======|>>>>>>>)" "$file" >/dev/null 2>&1; then
    echo "Conflito pendente em: $file"
    rg -n "^(<<<<<<<|=======|>>>>>>>)" "$file"
    found=1
  fi
done

if [[ $found -eq 1 ]]; then
  echo
  echo "Ainda existem conflitos para resolver."
  echo "Depois de corrigir os arquivos, rode:"
  echo "  git add <arquivos>"
  echo "  git commit -m 'fix: resolver conflitos de merge'"
  exit 1
fi

echo "Sem conflitos: índice limpo e sem marcadores nos arquivos principais."

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
for file in "${FILES[@]}"; do
  if rg -n "^(<<<<<<<|=======|>>>>>>>)" "$file" >/dev/null 2>&1; then
    echo "Conflito pendente em: $file"
    rg -n "^(<<<<<<<|=======|>>>>>>>)" "$file"
    found=1
  fi
done

if [[ $found -eq 1 ]]; then
  echo "\nAinda existem conflitos para resolver."
  exit 1
fi

echo "Sem marcadores de conflito nos arquivos principais."

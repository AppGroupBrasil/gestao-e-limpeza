# Deploy — Gestão e Limpeza (Hetzner)

## Caminho do projeto local
`c:\Users\HP\OneDrive\Área de Trabalho\PASTA APLICATIVOS\Gestão e Limpeza\`

## Regra geral
- **Nunca** envie `node_modules/`, `dist/`, `.git/` — o `docker compose build` roda `npm install` dentro do container.
- Envie apenas os arquivos que mudaram. Para mudanças amplas, use `rsync` com excludes (item 2).
- Rebuild só é necessário quando muda código de aplicação ou `package.json`.

## 1. Deploy mínimo (poucos arquivos alterados — caso comum)
```bash
key="$HOME/.ssh/hetzner_key"
src="/c/Users/HP/OneDrive/Área de Trabalho/PASTA APLICATIVOS/Gestão e Limpeza"
srv="root@46.225.191.114:/opt/gestao-app"

# Exemplo: backend alterado
scp -i "$key" "$src/server/src/services/mailer.ts" "$srv/server/src/services/"
scp -i "$key" "$src/server/src/index.ts" "$srv/server/src/"
scp -i "$key" "$src/server/package.json" "$src/server/package-lock.json" "$srv/server/"

# Rebuild + restart
ssh -i "$key" root@46.225.191.114 "cd /opt/gestao-app && docker compose build --no-cache && docker compose up -d"
```

## 2. Deploy amplo (rsync, recomendado para muitos arquivos)
```bash
key="$HOME/.ssh/hetzner_key"
src="/c/Users/HP/OneDrive/Área de Trabalho/PASTA APLICATIVOS/Gestão e Limpeza"

# Backend
rsync -avz --delete \
  --exclude=node_modules --exclude=dist --exclude=.git --exclude='*.log' \
  -e "ssh -i $key" \
  "$src/server/" root@46.225.191.114:/opt/gestao-app/server/

# Frontend (quando mudar)
rsync -avz --delete \
  --exclude=node_modules --exclude=dist --exclude=.git \
  -e "ssh -i $key" \
  "$src/src/" root@46.225.191.114:/opt/gestao-app/src/

# Rebuild
ssh -i "$key" root@46.225.191.114 "cd /opt/gestao-app && docker compose build --no-cache && docker compose up -d"
```

## 3. Quando rebuild **não** é necessário
- Mudou só `nginx.conf` → `docker compose restart gestao-app`
- Mudou só `.env` → `docker compose up -d` (sem `--no-cache`)

## 4. Conferir se está rodando
```bash
ssh -i ~/.ssh/hetzner_key root@46.225.191.114 "docker ps --filter name=gestao --format 'table {{.Names}}\t{{.Status}}'"
ssh -i ~/.ssh/hetzner_key root@46.225.191.114 "docker logs --tail 30 gestao-api"
```

> Antes de rebuild, confirme que `/opt/gestao-app/.env` define `JWT_SECRET` forte e exclusivo. O backend recusa segredos padrão em produção.

---

## Estrutura no Servidor

| Item | Caminho |
|------|---------|
| Projeto | `/opt/gestao-app/` |
| Dockerfile | `/opt/gestao-app/Dockerfile` |
| docker-compose | `/opt/gestao-app/docker-compose.yml` |
| Nginx config | `/opt/gestao-app/nginx.conf` |
| Código fonte | `/opt/gestao-app/src/` |
| Assets | `/opt/gestao-app/public/` |
| Variáveis | `/opt/gestao-app/.env` |

## Dados Importantes

- **Servidor:** 46.225.191.114 (Hetzner, Ubuntu 22.04, 2 vCPU, 4GB RAM)
- **SSH:** `ssh -i ~/.ssh/hetzner_key root@46.225.191.114`
- **Container:** `gestao-app` (nginx:alpine)
- **Rede Docker:** `coolify` (compartilhada com Traefik)
- **Domínio:** `gestaoelimpeza.com.br` (HTTPS via Traefik/LetsEncrypt)
- **Cloudflare NS:** `audrey.ns.cloudflare.com` / `weston.ns.cloudflare.com`

## Cenários de Atualização

### Mudou schema do banco (migrações)
Executar migrações ANTES do deploy:
```powershell
# Copiar arquivo de migração
scp -i ~/.ssh/hetzner_key "c:\Users\HP\OneDrive\Área de Trabalho\gestao-app\server\src\db\migrations\001_condominios_planos.sql" root@46.225.191.114:/tmp/

# Executar no container do banco
ssh -i ~/.ssh/hetzner_key root@46.225.191.114 "docker exec -i gestao-db psql -U gestao -d gestao < /tmp/001_condominios_planos.sql"
```

Observação: o backend local agora aplica automaticamente as migrations pendentes de [server/src/db/migrations](server/src/db/migrations) no startup e registra os arquivos executados na tabela `schema_migrations`. Em produção, continue executando as migrations antes do deploy para manter o rollout previsível.

Observação adicional: em produção, use um `JWT_SECRET` gerado especificamente para o ambiente, por exemplo com `openssl rand -hex 32`, e mantenha esse valor apenas no `.env` do servidor.

### Mudou só código (CSS/TSX, sem novas dependências)
Use o caminho 1 (mínimo) ou 2 (rsync) acima — só os arquivos alterados.

### Adicionou novas dependências (npm install)
Inclua `package.json` e `package-lock.json` no upload e rebuild com `--no-cache`.

### Mudou Dockerfile, nginx.conf ou docker-compose.yml
```bash
scp -i "$HOME/.ssh/hetzner_key" \
  "$src/Dockerfile" "$src/docker-compose.yml" "$src/nginx.conf" \
  root@46.225.191.114:/opt/gestao-app/
```
Depois rebuild (caminho 1, último comando).

## Outros Apps no Mesmo Servidor

| App | Domínio | Porta | Diretório |
|-----|---------|-------|-----------|
| app-correspondencia | appcorrespondencia.com.br | 3000 | /opt/app-correspondencia/ |
| portariax | portariax.com.br | 3001 | /opt/portariax/ |
| app-sindico | appsindico.com.br | 3000 | /opt/app-sindico/ |
| app-obras | appobras.com.br | 8080 | — |
| app-manutencao | appmanutencao.com.br | 8080 | — |
| app-reserva | appreserva.com.br | 3000 | /opt/app-reserva/ |

## Infra Atual

- **Banco e tabelas:** Supabase PostgreSQL
- **Aplicação:** frontend + backend próprios em Docker no Hetzner
- **E-mails transacionais:** Google SMTP
- **Firebase:** legado removido do produto principal; não faz mais parte do fluxo oficial

## Supabase Compartilhado No Hetzner

- O backend `gestao-api` já aceita `DATABASE_URL` + `DB_SSL`; no deploy via Docker Compose, priorize esses envs para apontar ao Postgres da stack Supabase compartilhada.
- Quando `DATABASE_URL` estiver definida, ela sobrepõe `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` automaticamente.
- Para containers na rede Docker `coolify`, a conexão recomendada é interna, por exemplo usando o host `supabase-db` e `DB_SSL=false`.
- Mantenha isolamento entre sistemas por banco ou schema próprio; não reutilize tabelas entre produtos.

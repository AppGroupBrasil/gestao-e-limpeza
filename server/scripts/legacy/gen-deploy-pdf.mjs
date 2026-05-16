import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'c:\\Users\\HP\\OneDrive\\Área de Trabalho\\Documentação Gestão e Limpeza';
const OUT_FILE = path.join(OUT_DIR, 'Deploy-Gestao-e-Limpeza.pdf');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 60, bottom: 60, left: 50, right: 50 },
  info: { Title: 'Deploy — Gestão e Limpeza', Author: 'AppGroupBrasil' },
});
const stream = fs.createWriteStream(OUT_FILE);
doc.pipe(stream);

const W = 595.28 - 100;
const C = { primary: '#1565c0', dark: '#0d47a1', accent: '#f57c00', text: '#1a1a2e', muted: '#6b7280', soft: '#9ca3af', border: '#e5e7eb', code: '#f3f4f6' };

const h1 = (t) => { doc.moveDown(0.4); doc.fillColor(C.primary).font('Helvetica-Bold').fontSize(16).text(t); doc.moveDown(0.3); doc.strokeColor(C.accent).lineWidth(1.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke(); doc.moveDown(0.4); };
const h2 = (t) => { doc.moveDown(0.4); doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(12).text(t); doc.moveDown(0.2); };
const p = (t) => { doc.fillColor(C.text).font('Helvetica').fontSize(10).text(t, { width: W, lineGap: 2 }); doc.moveDown(0.2); };
const kv = (rows) => { for (const [k, v] of rows) { doc.font('Helvetica-Bold').fontSize(9).fillColor(C.muted).text(k, { continued: true, width: W }); doc.font('Helvetica').fontSize(10).fillColor(C.text).text('  ' + v); } doc.moveDown(0.3); };
const code = (lines) => {
  const txt = lines.join('\n');
  const h = doc.heightOfString(txt, { width: W - 16, lineGap: 2 });
  doc.save().rect(50, doc.y, W, h + 16).fill(C.code).restore();
  doc.fillColor('#111').font('Courier').fontSize(8.5).text(txt, 58, doc.y + 8, { width: W - 16, lineGap: 2 });
  doc.y += 8;
  doc.moveDown(0.3);
  doc.font('Helvetica');
};

// CAPA
doc.fillColor(C.primary).font('Helvetica-Bold').fontSize(24).text('Deploy — Gestão e Limpeza');
doc.fillColor(C.muted).font('Helvetica').fontSize(11).text('Cheat-sheet de produção (Hetzner / Docker / SSH)');
doc.moveDown(0.5);
doc.strokeColor(C.accent).lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
doc.moveDown(0.6);

h1('Servidor (Hetzner)');
kv([
  ['IP', '46.225.191.114'],
  ['SO', 'Ubuntu 22.04 (2 vCPU, 4 GB RAM)'],
  ['SSH', 'ssh -i ~/.ssh/hetzner_key root@46.225.191.114'],
  ['Chave privada', 'C:\\Users\\HP\\.ssh\\hetzner_key'],
  ['Domínio', 'gestaoelimpeza.com.br (HTTPS via Traefik / Let\'s Encrypt)'],
  ['Cloudflare NS', 'audrey.ns.cloudflare.com / weston.ns.cloudflare.com'],
]);

h1('Estrutura no servidor');
kv([
  ['Projeto', '/opt/gestao-app/'],
  ['Frontend (código)', '/opt/gestao-app/src/'],
  ['Backend (código)', '/opt/gestao-app/server/'],
  ['Assets', '/opt/gestao-app/public/'],
  ['Dockerfile', '/opt/gestao-app/Dockerfile'],
  ['docker-compose', '/opt/gestao-app/docker-compose.yml'],
  ['Nginx', '/opt/gestao-app/nginx.conf'],
  ['Variáveis', '/opt/gestao-app/.env'],
]);

h1('Containers Docker');
kv([
  ['gestao-app', 'nginx servindo frontend'],
  ['gestao-api', 'backend Node/Express'],
  ['gestao-backup', 'rotina de backup'],
  ['Rede Docker', 'coolify (compartilhada com Traefik)'],
]);

h1('Projeto local');
kv([
  ['Path', 'c:\\Users\\HP\\OneDrive\\Área de Trabalho\\PASTA APLICATIVOS\\Gestão e Limpeza\\'],
  ['Stack', 'Vite + React (front), Node/Express (server/), PostgreSQL Supabase'],
]);

h1('SMTP (e-mails)');
p('Gmail appgroupbrasil@gmail.com com senha de app no .env do server (SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT, SMTP_FROM_EMAIL).');
p('Configurado em server/src/services/mailer.ts.');

h1('Banco de dados');
p('Supabase PostgreSQL (host externo). Backend aceita DATABASE_URL (sobrepõe DB_HOST/DB_PORT/etc).');
p('Migrations em server/src/db/migrations/ aplicadas automaticamente no startup do container.');

doc.addPage();

h1('Deploy — caminho mínimo (poucos arquivos)');
code([
  'key="$HOME/.ssh/hetzner_key"',
  'src="/c/Users/HP/OneDrive/Área de Trabalho/PASTA APLICATIVOS/Gestão e Limpeza"',
  'srv="root@46.225.191.114:/opt/gestao-app"',
  '',
  '# Exemplo: backend alterado',
  'scp -i "$key" "$src/server/src/services/mailer.ts" "$srv/server/src/services/"',
  'scp -i "$key" "$src/server/src/index.ts" "$srv/server/src/"',
  'scp -i "$key" "$src/server/package.json" \\',
  '              "$src/server/package-lock.json" "$srv/server/"',
  '',
  '# Rebuild + restart',
  'ssh -i "$key" root@46.225.191.114 \\',
  '  "cd /opt/gestao-app && docker compose build --no-cache && docker compose up -d"',
]);

h1('Deploy — caminho amplo (rsync)');
code([
  'key="$HOME/.ssh/hetzner_key"',
  'src="/c/Users/HP/OneDrive/Área de Trabalho/PASTA APLICATIVOS/Gestão e Limpeza"',
  '',
  '# Backend completo',
  'rsync -avz --delete \\',
  '  --exclude=node_modules --exclude=dist --exclude=.git --exclude="*.log" \\',
  '  -e "ssh -i $key" \\',
  '  "$src/server/" root@46.225.191.114:/opt/gestao-app/server/',
  '',
  '# Frontend',
  'rsync -avz --delete \\',
  '  --exclude=node_modules --exclude=dist --exclude=.git \\',
  '  -e "ssh -i $key" \\',
  '  "$src/src/" root@46.225.191.114:/opt/gestao-app/src/',
  '',
  '# Rebuild',
  'ssh -i "$key" root@46.225.191.114 \\',
  '  "cd /opt/gestao-app && docker compose build --no-cache && docker compose up -d"',
]);

h1('Quando NÃO precisa rebuild');
kv([
  ['Só nginx.conf', 'docker compose restart gestao-app'],
  ['Só .env', 'docker compose up -d (sem --no-cache)'],
  ['Schema do banco', 'aplicar migration antes; backend reaplica no startup'],
]);

h1('Conferir status no servidor');
code([
  'ssh -i ~/.ssh/hetzner_key root@46.225.191.114 \\',
  '  "docker ps --filter name=gestao --format \'table {{.Names}}\\t{{.Status}}\'"',
  '',
  'ssh -i ~/.ssh/hetzner_key root@46.225.191.114 \\',
  '  "docker logs --tail 30 gestao-api"',
]);

h1('Regras críticas');
p('• Nunca enviar node_modules/, dist/, .git/ — npm install roda dentro do container.');
p('• JWT_SECRET em /opt/gestao-app/.env deve ser forte e único (openssl rand -hex 32). Backend recusa segredos default em produção.');
p('• Migrations: em produção, opcionalmente execute antes do deploy:');
code([
  'scp -i ~/.ssh/hetzner_key \\',
  '  "$src/server/src/db/migrations/<arquivo>.sql" \\',
  '  root@46.225.191.114:/tmp/',
  '',
  'ssh -i ~/.ssh/hetzner_key root@46.225.191.114 \\',
  '  "docker exec -i gestao-db psql -U gestao -d gestao < /tmp/<arquivo>.sql"',
]);

h1('Outros apps no mesmo servidor');
kv([
  ['app-correspondencia', 'appcorrespondencia.com.br — /opt/app-correspondencia/'],
  ['portariax', 'portariax.com.br — /opt/portariax/'],
  ['app-sindico', 'appsindico.com.br — /opt/app-sindico/'],
  ['app-reserva', 'appreserva.com.br — /opt/app-reserva/'],
  ['app-obras', 'appobras.com.br'],
  ['app-manutencao', 'appmanutencao.com.br'],
]);

doc.end();
stream.on('finish', () => console.log('PDF gerado:', OUT_FILE));

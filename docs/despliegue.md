# Despliegue — Game Cartesiano Online

**Propósito/estado:** guía de despliegue para el estado actual del PRD; el entrypoint vigente del servidor es `server.js`.

## Visión General

El servidor de Game Cartesiano tiene dos responsabilidades:
1. **Servir archivos estáticos** (HTML, JS, CSS) — el cliente
2. **WebSocket server** en `/ws` — coordinar partidas online

```
Usuario → https://mi-dominio.com
           ├── HTTP  (archivos estáticos)
           └── WS    ws://mi-dominio.com/ws  (partidas online)
```

---

## Opciones de Hosting

### Opción 1: VPS propio (recomendado para desarrollo / producción pequeña)

**Proveedores:** DigitalOcean, Hetzner, Vultr, Linode, AWS EC2

```
$50–80 USD/mes → servidor con 2GB RAM, 1 CPU
SSH → git clone → npm install → node server.js
```

**Pros:** Control total, costo predecible
**Cons:**运维 (updates, monitoring, backup)

**Arquitectura mínima:**
- 1 VPS con Node.js 20+
- Nginx como reverse proxy (HTTP + WebSocket upgrade)
- Firewall: solo 80/443 abiertos (SSH solo a tu IP)

**Configuración Nginx:**
```nginx
server {
    listen 443 ssl;
    server_name game.midominio.com;

    root /var/www/game-cartesiano;
    index index.html;

    ssl_certificate     /etc/ssl/game.crt;
    ssl_certificate_key /etc/ssl/game.key;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

** systemd service:**
```ini
[Unit]
Description=Game Cartesiano Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/game-cartesiano
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=PORT=8080
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

---

### Opción 2: Platform-as-a-Service (más simple)

#### Render.com (recomendado)
- Free tier disponible
- Despliegue desde GitHub con `node server.js`
- WebSocket soportado en paid tiers ($7+/mes)

```
1. Conectar repo en GitHub
2. Render → New → Web Service
3. Build command: npm install
4. Start command: node server.js
5. Plan: Starter → $7/mes (WebSocket included)
```

#### Railway
- Pay-as-you-go
- WebSocket native
- Despliegue en 2 minutos

```
1. railway init
2. railway add
3. npm install → node server.js
```

#### Fly.io
- Free tier generoso (3 VMs)
- Ideal para Node.js

```
fly launch
fly scale count 1
fly secrets set PORT=8080
fly deploy
```

---

### Opción 3: Contenedores (Docker)

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

EXPOSE 8080
CMD ["node", "server.js"]
```

```bash
# docker-compose.yml
version: '3.8'
services:
  game:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/"]
      interval: 30s
      timeout: 10s
      retries: 3

# Desplegar:
docker compose up -d
docker compose logs -f
```

---

## Permisos y Seguridad

### DNS y Dominio
- Registrar dominio (Namecheap, Cloudflare, GoDaddy)
- Apuntar A record a la IP del VPS
- Considerar Cloudflare como proxy (protege contra DDoS, SSL automático)

### SSL/TLS (OBLIGATORIO)
- WebSocket sin SSL **no funciona** en navegadores modernos (WSS requerido)
- Let's Encrypt (gratuito):
```bash
certbot --nginx -d game.midominio.com
```

### Firewall
```bash
# VPS: UFW
ufw default deny incoming
ufw allow ssh from TU_IP only
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Rate Limiting
El servidor ya tiene validación de payloads. Para mitigar ataques:
```nginx
# En nginx.conf
limit_req_zone $binary_remote_addr zone=ws_limit:10m rate=10r/s;
limit_req zone=ws_limit burst=20;
```

---

## Configuración de Runtime

### Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `8080` | Puerto HTTP/WS |
| `NODE_ENV` | `development` | `production` activa logging y desactiva stack traces |
| `MAX_ROOMS` | `50` | Límite de salas activas (protección memoria) |
| `MAX_PLAYERS_PER_ROOM` | `8` | Máximo jugadores por sala |

```bash
PORT=8080 NODE_ENV=production node server.js
```

### Logging
El servidor actualmente no tiene logging estructurado. Para producción:
```javascript
// server.js — agregar antes de gateway
import pino from 'pino';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// En gateway.onMessage:
logger.info({ sessionId, eventType: event.type }, 'event received');
```

---

## Monitoreo

### Básica (gratuitо)
- **Uptime Kuma** — monitoring auto-hosteado
- **PM2** process manager (restarts automáticos):
```bash
npm install -g pm2
pm2 start server.js --name game-cartesiano
pm2 save
pm2 startup
```

### Salud del servidor
```bash
# Endpoint de health check
# Agregar en server.js:
if (req.url === '/health') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', rooms: gateway.roomEngine.rooms.size }));
}
```

---

## Escalabilidad (futuro v2)

### Problema actual
- Estado en memoria (`Map` en RoomEngine)
- Un solo proceso Node.js

### Solución v2
- Redis para estado compartido
- Múltiples instancias Node.js detrás de un load balancer
- **Sticky sessions** para WebSocket (el cliente siempre conecta al mismo nodo)

```
                    ┌── Node (1) ← ws-gateway
Cliente → Router ───┤── Node (2) ← ws-gateway
                    └── Node (3) ← ws-gateway
                         ↑
                      Redis
```

### Alternativa serverless
- **Cloudflare Durable Objects** — estado por sala, WebSocket nativo
- **AWS API Gateway WebSocket** + Lambda (caro para long sessions)

---

## Checklist antes de producción

- [ ] Dominio configurado con SSL
- [ ] WSS funcionando (`wss://`)
- [ ] Health check endpoint (`/health`)
- [ ] PM2 o systemd para restart automático
- [ ] Logs estructurados (pino)
- [ ] Firewall restrictivo
- [ ] Rate limiting en nginx
- [ ] Monitoring (Uptime Kuma)
- [ ] Backup automático del repo
- [ ] CI/CD: GitHub Actions → deploy automático

---

## Costos Estimados

| Solución | Costo/mes |
|----------|-----------|
| VPS propio (DigitalOcean $20) + dominio $12 | ~$35 |
| Render Starter | $7 |
| Railway pay-as-you-go | ~$5–15 |
| Fly.io Free | $0 (limitado) |
| VPS + Cloudflare Pro | ~$45 |

**Recomendación para empezar:** Render Starter ($7) o Fly.io Free
**Recomendación para producción real:** VPS propio + Cloudflare

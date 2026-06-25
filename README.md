# ExcaliDash API

> Programmatic diagram creation for [Excalidash](https://github.com/ZimengXiong/ExcaliDash) — turn GraphJSON into beautiful Excalidraw diagrams with dagre auto-layout.

## Features

- **GraphJSON input** — Simple node/edge definitions, AI-agent friendly
- **Dagre auto-layout** — Pure JS layout engine (no browser needed)
- **JWT authentication** — Secure session management with PostgreSQL persistence
- **OpenAPI 3.1 spec** — Machine-readable docs at `/docs/json`
- **Scalar UI** — Interactive API docs at `/docs`

## Quick Start

```bash
# Login
curl -X POST https://api.draw.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret"}'

# Create diagram
curl -X POST https://api.draw.example.com/drawing \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Diagram",
    "graph": {
      "nodes": [
        {"id": "a", "label": "Node A"},
        {"id": "b", "label": "Node B"}
      ],
      "edges": [
        {"from": "a", "to": "b", "label": "connects"}
      ]
    }
  }'
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | no | Health check |
| `POST` | `/auth/login` | no | Login → JWT token |
| `POST` | `/auth/refresh` | no | Refresh JWT token |
| `GET` | `/auth/me` | yes | Current user profile |
| `DELETE` | `/auth/logout` | yes | Logout |
| `POST` | `/drawing` | yes | Create diagram from GraphJSON |
| `GET` | `/drawings` | yes | List drawings |
| `GET` | `/drawing/:id` | yes | Get drawing |
| `PUT` | `/drawing/:id` | yes | Update drawing |
| `DELETE` | `/drawing/:id` | yes | Delete drawing |
| `POST` | `/drawing/:id/duplicate` | yes | Duplicate drawing |
| `POST` | `/drawing/:id/share` | yes | Share with user |
| `POST` | `/drawing/:id/share-link` | yes | Create public link |
| `GET` | `/drawing/:id/sharing` | yes | Get sharing status |

**Full OpenAPI spec:** `GET /docs/json`

## GraphJSON Format

```json
{
  "nodes": [
    {"id": "a", "label": "Node A", "width": 200, "height": 60},
    {"id": "b", "label": "Node B"}
  ],
  "edges": [
    {"from": "a", "to": "b", "label": "connects"}
  ],
  "direction": "TB",
  "spacing": {"node": 30, "edge": 10}
}
```

**Directions:** `TB` (Top→Bottom), `LR` (Left→Right), `BT` (Bottom→Top), `RL` (Right→Left)

## Deployment

### Docker Compose

```yaml
services:
  excalidash_api:
    build: .
    environment:
      - BACKEND_URL=excalidash_backend:8000
      - DATABASE_URL=postgresql://user:pass@db:5432/excalidash
      - JWT_SECRET=your-secret-here
      - API_JWT_EXPIRES_IN=1h
    ports:
      - "3000:3000"
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BACKEND_URL` | yes | Excalidash backend URL |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Secret for signing JWT tokens |
| `API_JWT_EXPIRES_IN` | no | JWT expiration (default: `1h`) |
| `API_REFRESH_EXPIRES_IN` | no | Refresh token expiration (default: `7d`) |
| `PORT` | no | Server port (default: `3000`) |

## Project Structure

```
├── src/
│   ├── app.ts                 # Express app setup
│   ├── config.ts              # Configuration
│   ├── config/openapi.ts      # OpenAPI spec
│   ├── index.ts               # Entry point
│   ├── clients/excalidash.ts  # Excalidash API client
│   ├── converters/            # GraphJSON → Excalidraw
│   ├── db/                    # PostgreSQL session store
│   ├── middleware/             # Auth + error handling
│   └── routes/                # API routes
├── Dockerfile
├── package.json
└── tsconfig.json
```

## Development

```bash
npm run build    # TypeScript build
npm start        # Run server
npm test         # Run tests
```

## License

MIT

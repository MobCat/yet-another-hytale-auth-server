# Hytale Auth Server

**Authentication server for custom Hytale F2P setup.**

This server handles authentication requests from both the game client (via the F2P launcher) and dedicated game servers. It implements the Hytale authentication protocol with Ed25519 JWT signing.

> **Warning**: This is an experimental project for educational purposes. Use at your own risk.

## Public Test Server

**You don't need to run your own auth server!** A public test server is available at `sanasol.ws` and is used by default in all related projects.

Simply use the [Hytale-F2P launcher](https://github.com/sanasol/Hytale-F2P/tree/patched-auth-server) and [hytale-server-docker](https://github.com/sanasol/hytale-server-docker) with default settings - they're pre-configured to use `sanasol.ws`.

> **Note**: The public server is for testing purposes. For production use or privacy, set up your own server using this repository.

## Related Projects

This is part of a complete Hytale F2P setup:

| Project | Description |
|---------|-------------|
| [hytale-auth-server](https://github.com/sanasol/hytale-auth-server) | Authentication server (this repo) |
| [Hytale-F2P](https://github.com/sanasol/Hytale-F2P/tree/patched-auth-server) | Game launcher with domain patching |
| [hytale-server-docker](https://github.com/sanasol/hytale-server-docker) | Dedicated server Docker image |

## Requirements (for running your own server)

> **Skip this section** if you're using the public `sanasol.ws` test server.

- Docker and Docker Compose
- A domain with exactly **10 characters** (same length as `hytale.com`)
  - Examples: `sanasol.ws`, `example.co`, `myserver.x`
- DNS records pointing to your server
- (Optional) `Assets.zip` from the game for cosmetics

## Quick Start (Own Server)

### 1. Clone the repository

```bash
git clone https://github.com/sanasol/hytale-auth-server.git
cd hytale-auth-server
```

### 2. Configure your domain

Edit `compose.yaml` and replace all occurrences of `sanasol.ws` with your 10-character domain:

```yaml
environment:
  DOMAIN: "yourdomain"  # Must be exactly 10 characters!
labels:
  - "traefik.http.routers.sessions.rule=Host(`sessions.yourdomain`)"
  - "traefik.http.routers.accountdata.rule=Host(`account-data.yourdomain`)"
  - "traefik.http.routers.telemetry.rule=Host(`telemetry.yourdomain`)"
```

### 3. Set up DNS records

Create the following DNS A records pointing to your server IP:

- `sessions.yourdomain`
- `account-data.yourdomain`
- `telemetry.yourdomain`

### 4. (Optional) Add Assets.zip for cosmetics

Copy `Assets.zip` from your Hytale game installation to enable all cosmetics:

```bash
cp /path/to/Hytale/Assets.zip ./assets/
```

The Assets.zip is typically found in:
- Windows: `%LOCALAPPDATA%\Hytale\release\package\game\latest\Client\Assets.zip`
- macOS: `~/Library/Application Support/Hytale/release/package/game/latest/Client/Assets.zip`

### 5. Start the server

```bash
docker compose up -d
```

### 6. Verify it's working

```bash
curl https://sessions.yourdomain/health
# Should return: {"status":"ok","server":"hytale-auth","domain":"yourdomain"}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `sanasol.ws` | Your 10-character domain |
| `PORT` | `3000` | Server port |
| `DATA_DIR` | `/app/data` | Directory for persistent data (keys, user data) |
| `ASSETS_PATH` | `/app/assets/Assets.zip` | Path to Assets.zip for cosmetics |

### Persistent Data

The server stores the following data in the `data/` directory:

- `jwt_keys.json` - Ed25519 key pair for JWT signing (auto-generated)
- `user_data.json` - User skin/cosmetic preferences

**Important**: Keep `jwt_keys.json` backed up! If you lose it, all existing tokens become invalid.

## Endpoints

The server implements the following Hytale authentication endpoints:

| Endpoint | Description |
|----------|-------------|
| `/.well-known/jwks.json` | JWKS for JWT signature verification |
| `/game-session/new` | Create new game session |
| `/game-session/child` | Create child session (used by launcher) |
| `/game-session/refresh` | Refresh session tokens |
| `/server-join/auth-grant` | Authorization grant for server connection |
| `/server-join/auth-token` | Token exchange with certificate binding |
| `/my-account/game-profile` | Get user profile |
| `/my-account/cosmetics` | Get unlocked cosmetics |
| `/my-account/skin` | Save user skin preferences |

## Local Development (without HTTPS)

For local testing, use the simple compose file:

```bash
docker compose -f compose.simple.yaml up -d
```

This exposes the server on `http://localhost:3000`.

## Complete Setup Guide

### Running Everything Together

1. **Start the auth server** (this repo):
   ```bash
   cd hytale-auth-server
   docker compose up -d
   ```

2. **Start a dedicated game server** ([hytale-server-docker](https://github.com/sanasol/hytale-server-docker)):
   ```bash
   cd hytale-server-docker
   # Edit compose.yaml to set HYTALE_AUTH_DOMAIN to your domain
   docker compose up -d
   ```

3. **Launch the game** ([Hytale-F2P](https://github.com/sanasol/Hytale-F2P/tree/patched-auth-server)):
   ```bash
   cd Hytale-F2P
   npm install
   # Set HYTALE_AUTH_DOMAIN environment variable or edit config
   npm start
   ```

The launcher will:
1. Patch the game client to use your domain instead of `hytale.com`
2. Fetch authentication tokens from your auth server
3. Launch the game with proper authentication

## Troubleshooting

### "Domain length mismatch"

Your domain must be exactly 10 characters. This is because the game binary is patched by replacing `hytale.com` (10 chars) with your domain byte-for-byte.

### "JWT signature verification failed"

Make sure the auth server's Ed25519 keys are persisted. If the keys change, existing tokens become invalid. Check that `data/jwt_keys.json` exists and is not being recreated on each restart.

### Cosmetics not loading

1. Check that `Assets.zip` is in the `assets/` directory
2. Check the server logs for cosmetics loading messages
3. Verify the zip file is valid: `unzip -l assets/Assets.zip | grep Cosmetics`

## License

MIT License - See [LICENSE](LICENSE)

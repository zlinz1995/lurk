# Scaling Lurk

This project can scale to thousands of concurrent sockets with a few targeted runtime and infrastructure changes. The backend now includes optional Redis-backed Socket.IO fanout, rate-limited chat events, debounced public-room broadcasts, and readiness checks.

## 1. Handle Thousands Of Concurrent Sockets
- Run multiple backend instances behind a load balancer that supports WebSockets.
- Enable the Socket.IO Redis adapter by installing dependencies in `lurk-backend`: `npm i redis @socket.io/redis-adapter`.
- Set `REDIS_URL` to point at your Redis instance.
- If Redis is mandatory for your deployment, set `REDIS_REQUIRED=true`.
- Use sticky sessions at the load balancer or keep `transports` WebSocket-only on the client.

## 2. Keep Latency Stable
- Chat events are rate-limited server-side with `SOCKET_CHAT_RATE_WINDOW_MS` (default 2000) and `SOCKET_CHAT_RATE_MAX` (default 8).
- Public room lists are debounced with `PUBLIC_ROOMS_BROADCAST_MS` (default 1000).
- Socket payload sizes are capped with `SOCKET_MAX_HTTP_BUFFER` (default 1000000).
- Tune ping/timeout settings with `SOCKET_PING_INTERVAL_MS` and `SOCKET_PING_TIMEOUT_MS`.
- Keep static assets on a CDN so real-time traffic stays isolated.

## 3. Survive Partial Failures
- `/ready` reports DB health and Redis status for load balancers.
- Graceful shutdown is enabled on `SIGTERM`/`SIGINT`.
- Redis is optional. If it fails, chat still works locally (cross-node fanout degrades). Set `REDIS_REQUIRED=true` to fail fast instead.
- The SQLite DB is local-only. For true multi-instance scaling, move threads/posts to Postgres and store uploads in object storage (S3/R2/GCS) so any instance can serve media.
- Avoid wiping the DB on boot unless you intend to: `RESET_DB_ON_BOOT=true` (default false).
- Use a persistent volume if you must keep SQLite: `DATA_DIR=/path/to/persistent/storage`.

## New/Updated Environment Variables
- `REDIS_URL`
- `REDIS_REQUIRED`
- `REDIS_CONNECT_TIMEOUT_MS`
- `REDIS_RECONNECT_BASE_MS`
- `REDIS_RECONNECT_MAX_MS`
- `SOCKET_MAX_HTTP_BUFFER`
- `SOCKET_PING_INTERVAL_MS`
- `SOCKET_PING_TIMEOUT_MS`
- `SOCKET_PER_MESSAGE_DEFLATE`
- `SOCKET_CHAT_RATE_WINDOW_MS`
- `SOCKET_CHAT_RATE_MAX`
- `PUBLIC_ROOMS_BROADCAST_MS`
- `CHAT_HISTORY_BACKEND` (`memory` or `redis`)
- `CHAT_HISTORY_TTL_SEC`
- `CHAT_HISTORY_KEY_PREFIX`
- `RESET_DB_ON_BOOT`
- `SERVER_KEEP_ALIVE_TIMEOUT_MS`
- `SERVER_HEADERS_TIMEOUT_MS`
- `SHUTDOWN_TIMEOUT_MS`

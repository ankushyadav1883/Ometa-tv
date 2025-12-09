# Feature plan — Random text & video chat website

Summary
- Users join anonymously (or with optional lightweight account), then can choose text-only or video chat with a random partner.
- Matching is 1:1. Optionally let users pick language or interests as soft filters.
- Real-time handled via WebSockets for signaling and messaging; video via WebRTC (P2P) using STUN/TURN. If moderation or recording required, use an SFU.

MVP Feature list (must-haves)
- Anonymous sessions (optional username)
- Text chat: real-time messages, typing indicator, basic emoji support
- Video chat: 1:1 WebRTC connection with camera/mic permission flow
- Matchmaking: “Start” button finds a random partner, “Stop/Skip” to find another
- Reporting: one-click report and blocking of the partner
- Moderation pipeline: automated text filters + optional human review queue
- Safety UI: prominent "End call" and "Report" buttons, terms and age-gating (18+)
- Basic rate-limits and anti-bot protections (CAPTCHA on entry, per-IP throttling)
- Privacy controls (ephemeral sessions; optional account for saved preferences)

Nice-to-haves (post-MVP)
- Interest-based matching
- Geolocation proximity filter (GDPR concerns — opt-in)
- Profile badges / moderation status / verified accounts
- Multi-party rooms
- Language translation / captioning
- Monetization (tips, premium filter features)

High-level architecture
- Client (browser)
  - UI: React (or Svelte/Vue) + Tailwind/CSS
  - Real-time: WebSocket (or Socket.IO) for signaling + text messages
  - Media: WebRTC for audio/video
- Signaling server (Node/Go)
  - Handles matchmaking, room management, and WebSocket signaling (offer/answer/ICE)
  - Optional message persistence for text (short TTL)
- TURN server (coturn)
  - Relay media when direct P2P fails; required for NAT/firewall traversal
- (Optional) SFU (Janus/Mediasoup)
  - Use for moderation (inspect streams), recording, or multi-party rooms
- Backend services
  - Auth service (optional)
  - Moderation microservice (AI + human review)
  - Reporting & admin dashboard
  - Database (Postgres) for users, reports, sessions, logs
  - Redis for matchmaking queue and presence
- Storage & infra
  - S3 for attachments / recordings (if allowed)
  - K8s or serverless for scaling
  - Observability: Prometheus + Grafana / Sentry

Tech stack recommendations
- Frontend: React + Vite, or Next.js if you want SSR later
- Realtime & Signaling: Node.js + Socket.IO (fast to prototype) or Fastify + ws
- TURN: coturn (self-host or managed)
- Database: PostgreSQL (primary), Redis (presence & queue)
- Moderation: Perspective API (text), Google Cloud Vision / AWS Rekognition / third-party (sightengine) for images; for video, either client-side face blur + client reporting or SFU-based sampling + AI
- Deployment: DigitalOcean / AWS / GCP; k8s for production
- CI/CD: GitHub Actions

Security, privacy & safety (critical)
- Age gating: require birth year and checkbox to confirm minimum age; consider verification for higher-trust features.
- Content moderation:
  - Text: run messages through automated classifiers (toxicity, sexual content, threats). Block or flag matches immediately.
  - Photos: disallow image uploads in MVP OR run images through a detection API.
  - Video: difficult to moderate with E2E encryption; options:
    - Encourage ephemeral video P2P + rely on reporting and rate-limits; OR
    - Use an SFU so server can sample/inspect streams for abuse (tradeoff: privacy).
- Reporting flow: user reports create ticket + immediate partner warning/ban if multiple reports or high-severity AI flag.
- Rate limiting & anti-abuse:
  - Per-IP and per-user limits on session starts and messages.
  - CAPTCHA on suspicious behavior.
  - Behavioral heuristics to detect bots (rapid connects/disconnects).
- Data retention & privacy:
  - Ephemeral chat by default (delete messages after 24 hours).
  - Keep minimal logs; encrypt PII at rest; publish Data Retention and Privacy Policy.
- Legal:
  - Terms of Service and Community Guidelines.
  - Age verification and COPPA/GDPR compliance depending on target audience and region.

Matchmaking algorithm (simple)
- Queue-based:
  - User requests match → server pushes to Redis queue keyed by filter (language / interest).
  - Pop two users and create room.
  - If timeout (e.g., 20s) and no match → offer option to retry or join “fallback” mode (accept any).
- Skipping:
  - Allow user to skip partner; skipping increments a "skips" count for matching prioritization.

Data model (simplified)
- users: id, display_name, created_at, last_seen, banned_until, is_verified, preferences (JSON)
- sessions: id, user_a_id, user_b_id, started_at, ended_at, metadata (client info)
- messages: id, session_id, sender_id, body, created_at (TTL index for auto-delete)
- reports: id, reporter_id, reported_user_id, session_id, reason, created_at, status
- moderation_logs: id, item_type, item_id, action, actor, reason, timestamp

API & realtime endpoints (sketch)
- REST:
  - POST /api/register (optional)
  - POST /api/login
  - POST /api/match/start {mode: "text"|"video", filters}
  - POST /api/match/stop
  - POST /api/report {session_id, reason}
  - GET /api/admin/reports (admin)
- WebSocket (or Socket.IO)
  - events: join_queue, leave_queue, match_found (roomId, peerInfo), signal (offer/answer/ice), chat_message, typing, end_session

WebRTC signaling flow (1:1)
1. Both clients connect to signaling server.
2. Client A creates RTCPeerConnection, gets local offer and sends to signaling server: signal {type: "offer", sdp}
3. Server relays to Client B; B sets remote desc, creates answer, sends back.
4. Exchange ICE candidates via signaling events.
5. Once connected, audio/video flows P2P (or via TURN if needed).

Moderation & trust model tradeoffs
- E2E WebRTC P2P:
  - Pros: better privacy; less server bandwidth.
  - Cons: can't inspect streams for abuse (rely on user reporting).
- SFU:
  - Pros: server can sample/record/inspect streams for moderation/analytics.
  - Cons: higher infra cost; privacy implications — must be declared in privacy policy.

UX / UI copy samples
- Onboarding: "Connect with someone new — anonymous, free, and safe. Please follow our Community Guidelines."
- Controls: "End Call", "Report", "Next" (skip)
- Report modal: "Why are you reporting this user?" [options: nudity, harassment, hate speech, spam, other] + optional comment.
- Post-report flow: "Thanks — the user has been reported. If they repeatedly break the rules, they will be removed."

Admin & moderation dashboard
- View queued reports, session replays (if recorded), user history, ban/unban controls.
- Metrics: active sessions, reports per hour, repeat offenders.

Deployment & infra notes
- Production considerations:
  - Dedicated TURN cluster (coturn) with autoscaling
  - Use Redis for matchmaking & presence, keep hot keys small
  - Autoscale signaling servers behind load balancer; use sticky sessions or route WebSocket to same instance (or use Redis adapter for Socket.IO)
  - Monitoring on latency, dropped calls, and error rates
- Cost drivers: bandwidth (video), TURN relay traffic, SFU CPU, moderation APIs

Rough timeline & roadmap
- Week 0–1: Project setup, basic UI, signaling server, text-match queue (no video)
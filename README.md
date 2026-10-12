# HT Rahasia (PTT E2E)
npm install && node server.js   # PORT=8787 default, buka http://localhost:8787
Butuh HTTPS untuk mikrofon di HP (kecuali localhost) -> deploy ke Render/Fly/Railway (Node, WebSocket) atau taruh di belakang tunnel HTTPS.
Frontend terpisah (mis. Vercel): buka ?relay=wss://host-relay
Tes: node test.js (server harus jalan)

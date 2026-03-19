# Aedra API — Operational Runbook

> Keep this open on the morning of every major event (first 100-agent onboard, month-end cycle, demo day).  
> Section 4 contains the exact phrases to send to agents if something goes wrong.

---

## 1. How to Detect Failure

### Health signals to check first

```bash
# Is the API responding?
curl -s http://localhost:3000/health | jq

# Is the dev server alive?
ps aux | grep "nest start"

# Recent error log (last 50 lines)
tail -50 /home/chris/aedra/api/api_debug.log | grep -i "error\|warn\|fatal"
```

### Key log prefixes and what they mean

| Prefix | Meaning |
|---|---|
| `[ToolManifest]` | Persona tool filter applied — shows allowed/total |
| `[StateValidator]` | History repair triggered — check what was repaired |
| `[ValidationService]` | Schema or financial cross-check violation |
| `[AiService]` | General AI processing issue |
| `[WhatsappService]` | WhatsApp delivery failure |
| `ExceptionHandler` | Module-level crash — restart required |

---

## 2. Component Failure Map

### Redis (Cache)
**Symptoms:** Log line `Redis connection refused` or `ECONNREFUSED 127.0.0.1:6379`  
**Impact:** In-memory fallback activates automatically. Performance degrades for Tier 1 cached responses.

```bash
# Check Redis status
redis-cli ping

# Restart Redis
sudo systemctl restart redis

# Verify
redis-cli ping   # Expected: PONG
```

---

### Groq API
**Symptoms:** Log line `Groq API error` or `429 Too Many Requests` in tool loop  
**Impact:** Text-only requests fail or fall back to Gemini (slower, higher cost).

```bash
# Check your Groq API key is set
grep GROQ_API_KEY /home/chris/aedra/api/.env

# Groq has a fallback — Gemini will take over automatically.
# If Gemini also fails, check the Gemini key:
grep GEMINI_API_KEY /home/chris/aedra/api/.env
```

**Recovery:** Usually self-resolves within 60 seconds (rate limit window). No restart needed.

---

### Gemini API
**Symptoms:** `GEMINI_API_KEY not found` or `GoogleGenerativeAIFetchError`  
**Impact:** All multimodal requests (images, PDFs) fail. Reports will not generate.

```bash
# Verify key
grep GEMINI_API_KEY /home/chris/aedra/api/.env

# Test a quick call (swap in your key)
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY" | jq '.models[0].name'
```

---

### PostgreSQL (Database)
**Symptoms:** `PrismaClientKnownRequestError` or `Can't reach database server`  
**Impact:** All data reads and writes fail. Complete service outage.

```bash
# Check DB connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Prisma can connect
cd /home/chris/aedra/api && npx prisma db pull 2>&1 | head -5

# Restart postgres if self-hosted
sudo systemctl restart postgresql
```

---

### WhatsApp Service
**Symptoms:** `sendTextMessage failed` or `WhatsApp webhook not receiving`  
**Impact:** All outbound messages fail. AI responses are generated but not delivered.

```bash
# Check WhatsApp provider status in logs
grep -i "whatsapp\|webhook" /home/chris/aedra/api/api_debug.log | tail -20

# Verify webhook URL is reachable (use ngrok if local)
curl -s http://localhost:3000/messaging/webhook | head -2
```

---

### Background Job Queue (BullMQ)
**Symptoms:** Reports take forever to deliver, or `Redis connection drops`.
**Impact:** AI chat works, but async tasks (PDF generation, bulk invoicing) halt or stall. The AI UI responds instantly but the expected WhatsApp delivery never arrives.

```bash
# Check if jobs are failing
grep -i "\[Queue\] Job" /home/chris/aedra/api/api_debug.log | tail -20

# If Queue processes are totally frozen due to a corrupted worker:
# Restart the NestJS instance. The queue will automatically resume paused/failed jobs on restart.
cd /home/chris/aedra/api && npm run start:dev
```

---

### Nest.js App Crash
**Symptoms:** `UndefinedModuleException` or app process exits  
**Impact:** Complete outage.

```bash
# Hard restart
cd /home/chris/aedra/api
npm run start:dev

# If circular dependency error, check recent changes to ai.module.ts
git log --oneline -5
git diff HEAD~1 src/ai/ai.module.ts
```

---

## 3. Exact Commands for Each Failure Type

| Scenario | Command |
|---|---|
| Full restart (cleanest) | `cd /home/chris/aedra/api && npm run start:dev` |
| Rebuild after code change | `npm run build && npm run start:dev` |
| Check DB schema is in sync | `npx prisma db pull && npx prisma generate` |
| Flush Redis cache | `redis-cli FLUSHDB` |
| Tail live logs | `tail -f /home/chris/aedra/api/api_debug.log` |
| Run smoke tests | `npm run smoke:crud` |

---

## 4. What to Tell Agents During Incidents

Use these exact messages. Short. No technical detail. Reassuring.

**Minor degradation (slow responses):**
> "Aedra is running slightly slower than usual right now. All your data is safe. We're on it. ✅"

**AI responses unavailable (< 10 min):**
> "The Aedra assistant is briefly offline for maintenance. Your data is untouched. We'll be back in 10 minutes. 🔧"

**Longer outage:**
> "We're aware of an issue and our team is fixing it now. Expected back at [TIME]. All portfolio data is safe and no action is needed from you. 🙏"

**WhatsApp delivery delayed:**
> "Messages may be slightly delayed right now. Reports and reminders will deliver automatically once resolved. No need to resend."

---

## 5. First Day of Month Checklist

Run these before 06:00 EAT on the 1st:

- [ ] Confirm PostgreSQL backup ran (check backup logs)
- [ ] Confirm Redis is responding (`redis-cli ping`)
- [ ] Tail logs for 2 min; look for any ERRORs
- [ ] Send one test WhatsApp message to confirm delivery
- [ ] Verify one tenant balance query returns correct data

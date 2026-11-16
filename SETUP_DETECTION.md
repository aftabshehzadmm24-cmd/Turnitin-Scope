# Detection Setup Guide

Complete setup for **AI Detection** (TruthScan) + **Plagiarism Detection** (Noplag Engine)

---

## 🤖 AI Detection: TruthScan

### Setup Steps:

1. **Sign up at TruthScan**
   - Visit: https://truthscan.com/
   - Create free account
   - Get API key from dashboard

2. **Add API Key to .env**
   ```bash
   TRUTHSCAN_API_KEY=your_actual_key_here
   ```

3. **Free Tier**
   - 25 scans/month (no credit card)
   - 1 credit per word
   - 99%+ accuracy
   - Multi-detector (GPTZero, OpenAI, Writer, etc.)

---

## 📚 Plagiarism Detection: Noplag Engine

### Prerequisites:

- **Docker Desktop** installed
  - Download: https://www.docker.com/products/docker-desktop/
  - Windows: Install and restart computer

### Setup Steps:

1. **Start Noplag Engine**
   ```powershell
   # Navigate to project directory
   cd "d:\Desktop\Desktop\Turnitin Scope"
   
   # Start Noplag (first time takes 2-3 minutes)
   docker compose -f docker-compose.noplag.yml up -d
   ```

2. **Verify Running**
   ```powershell
   # Check containers
   docker ps
   
   # Should see:
   # - noplag-engine (port 8000)
   # - noplag-postgres (port 5433)
   ```

3. **Test API**
   - Open: http://localhost:8000/docs
   - You should see OpenAPI documentation
   - Try the demo: http://localhost:8000/

4. **Index Sample Corpus** (Optional)
   ```powershell
   # Copy some documents to index
   mkdir noplag-corpus
   # Add .txt, .pdf, .docx files to this folder
   
   # Restart Noplag to index
   docker compose -f docker-compose.noplag.yml restart noplag-engine
   ```

---

## 🚀 Start Your App

1. **Start Noplag** (if not running)
   ```powershell
   docker compose -f docker-compose.noplag.yml up -d
   ```

2. **Start Your Server**
   ```powershell
   npm run dev
   ```

3. **Test Both APIs**
   - Upload a document
   - Check console for logs:
     - `🔍 Using TRUTHSCAN.COM provider for AI detection`
     - `📚 Using NOPLAG ENGINE for plagiarism detection`

---

## 🛠️ Management Commands

### Noplag Engine:

```powershell
# Start
docker compose -f docker-compose.noplag.yml up -d

# Stop
docker compose -f docker-compose.noplag.yml down

# View logs
docker compose -f docker-compose.noplag.yml logs -f noplag-engine

# Restart
docker compose -f docker-compose.noplag.yml restart

# Remove everything (including data)
docker compose -f docker-compose.noplag.yml down -v
```

---

## 💰 Cost Comparison

### AI Detection (TruthScan):
- **Free:** 25 scans/month
- **Starter:** $24/mo = 1,000 scans
- **Professional:** $83/mo = 5,000 scans

### Plagiarism Detection (Noplag):
- **FREE:** Unlimited scans ✅
- **Cost:** Server resources only (negligible)
- **Privacy:** 100% - documents never leave your server

---

## 🔧 Troubleshooting

### Noplag Not Starting:

1. **Check Docker is running**
   ```powershell
   docker --version
   ```

2. **Port conflict** (8000 already in use)
   ```powershell
   # Edit docker-compose.noplag.yml
   # Change: "8000:8000" to "8001:8000"
   # Update .env: NOPLAG_URL=http://localhost:8001
   ```

3. **View errors**
   ```powershell
   docker compose -f docker-compose.noplag.yml logs
   ```

### TruthScan Errors:

1. **Invalid API key**
   - Verify key in .env is correct
   - Check at: https://truthscan.com/

2. **Rate limit**
   - Free tier: 25 scans/month exceeded
   - Upgrade plan or wait for next month

3. **Credits exhausted**
   - Check remaining at: https://truthscan.com/dashboard

---

## 📊 Expected Logs

### Successful AI Detection:
```
🔍 Using TRUTHSCAN.COM provider for AI detection
   Text length: 2450 characters, ~450 words
   Cost: 450 credits (1 credit/word)
📤 DETECTION SUBMITTED: { "id": "...", "status": "pending" }
📊 TRUTHSCAN RESPONSE: { "result": 73.2, "label": "AI" }
✅ TRUTHSCAN AI SCORE: 73%
```

### Successful Plagiarism Detection:
```
📚 Using NOPLAG ENGINE for plagiarism detection
   Text length: 2450 characters, ~450 words
   Noplag URL: http://localhost:8000
📤 CHECK SUBMITTED: { "check_id": "...", "status": "pending" }
📊 NOPLAG REPORT: { "overall_similarity": 0.23, "sources": [...] }
✅ NOPLAG PLAGIARISM SCORE: 23%
   Sources found: 3
   Matches: 12
```

---

## 🎯 Production Deployment

### Noplag on Server:

1. **Install Docker** on your server
2. **Clone repository**
3. **Run Docker Compose**
4. **Configure firewall** (allow port 8000 internally only)
5. **Set NOPLAG_URL** to internal server IP

### Security:

- ⚠️ Noplag has **no authentication** by default
- Run on **private network** only
- Or add **reverse proxy with auth** (nginx, Caddy)

---

## 📞 Support

- **TruthScan:** https://truthscan.com/support
- **Noplag:** https://github.com/NoplagLabs/noplag-engine/issues
- **Your App:** Check logs with `npm run dev`

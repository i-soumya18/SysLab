# 🔥 Hot Reload Development Mode

## ✅ What's Been Set Up

Hot reload is now fully configured for your System Design Simulator! You can edit frontend and backend code and see changes instantly without restarting containers.

---

## 🚀 Quick Start

### Start Development Mode with Hot Reload
```bash
./scripts/start-dev.sh
```

### Stop Development Mode
```bash
./scripts/stop-dev.sh
```

---

## 🎯 How It Works

### Frontend (React + Vite)
- **Edit any file** in `frontend/src/`
- **Changes auto-refresh** in browser (Hot Module Replacement)
- **No refresh needed** - updates instantly in browser
- **CSS changes** apply immediately with Tailwind CSS

### Backend (Node.js + TypeScript)
- **Edit any file** in `backend/src/`
- **Server auto-restarts** with `tsx watch`
- **Changes apply** in 1-2 seconds
- **API endpoints** update automatically

---

## 📁 What's Mounted (Hot Reload Enabled)

### Frontend Volumes
```
✅ frontend/src/          → Live reload
✅ frontend/public/       → Static assets
✅ frontend/index.html    → Entry point
✅ frontend/vite.config.ts → Vite config
✅ frontend/tailwind.config.js → Tailwind config
✅ frontend/postcss.config.js → PostCSS config
✅ frontend/src/index.css → Main CSS with Tailwind
```

### Backend Volumes
```
✅ backend/src/           → Live reload
✅ backend/tsconfig.json  → TypeScript config
```

**Note:** `node_modules` are NOT mounted - containers use their own for faster performance.

---

## 🔧 Configuration Files Created

### 1. Development Scripts
- ✅ `scripts/start-dev.sh` - Start dev mode with hot reload
- ✅ `scripts/stop-dev.sh` - Stop dev services

### 2. Development Dockerfiles
- ✅ `frontend/Dockerfile.dev` - Frontend dev with Vite dev server
- ✅ `backend/Dockerfile.dev` - Backend dev with tsx watch

### 3. Docker Compose
- ✅ `docker-compose.dev.yml` - Development overrides
- ✅ Uses existing `docker-compose.yml` + dev overrides

### 4. Nginx Configuration
- ✅ `nginx/gateway.dev.conf` - Proxies to Vite dev server
- ✅ Supports WebSocket for HMR

### 5. Vite Configuration
- ✅ `frontend/vite.config.ts` - Updated with:
  - `usePolling: true` - Required for Docker file watching
  - HMR configuration for gateway proxy
  - Host: `0.0.0.0` - Allow external connections

---

## 📍 Access Points (Development Mode)

| Service | URL | Hot Reload |
|---------|-----|------------|
| **Frontend** | http://localhost:8080 | ✅ Instant |
| **Backend API** | http://localhost:8080/api/v1 | ✅ Auto-restart |
| **Vite Dev Server** | http://localhost:5173 | ✅ Direct access |
| **Grafana** | http://localhost:3001 | ❌ (Monitoring only) |

---

## ✨ Development Workflow

### 1. Start Development Mode
```bash
./scripts/start-dev.sh
```

### 2. Edit Frontend Code
```bash
# Edit any component
nano frontend/src/components/Workspace.tsx

# Changes appear instantly in browser!
# No need to refresh or rebuild
```

### 3. Edit Backend Code
```bash
# Edit any service or route
nano backend/src/routes/workspaces.ts

# Server restarts automatically in 1-2 seconds
# API changes immediately available
```

### 4. Edit CSS (Tailwind)
```bash
# Edit main CSS or component styles
nano frontend/src/index.css

# Tailwind utilities update instantly
# Browser shows changes without refresh
```

### 5. View Logs (Optional)
```bash
# All services
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# Frontend only
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f frontend

# Backend only
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f backend
```

---

## 🎨 Example: Edit a Component

### 1. Open a component
```bash
nano frontend/src/components/ComponentLibrary.tsx
```

### 2. Make a change
```tsx
// Change button color
<button className="bg-blue-500 hover:bg-blue-700">
  Add Component
</button>

// to

<button className="bg-green-500 hover:bg-green-700">
  Add Component ✨
</button>
```

### 3. Save the file

### 4. Check browser
- ✅ **Change appears instantly** without refresh!
- ✅ Component state is preserved (HMR)
- ✅ No page reload needed

---

## 🐛 Troubleshooting

### Hot Reload Not Working?

#### 1. Check Containers Are Running
```bash
docker ps | grep sds-
```

Should show `sds-frontend-dev`, `sds-backend`, etc.

#### 2. Check Frontend Logs
```bash
docker logs sds-frontend-dev
```

Should see:
```
VITE v5.x.x ready in xxx ms
➜  Local:   http://localhost:5173/
➜  Network: http://0.0.0.0:5173/
```

#### 3. Check Backend Logs
```bash
docker logs sds-backend
```

Should see:
```
Watching /app/src for changes...
Server running on port 3000
```

#### 4. Hard Refresh Browser
Sometimes browser cache interferes:
```
Ctrl + Shift + R  (Windows/Linux)
Cmd + Shift + R   (Mac)
```

#### 5. Restart Dev Environment
```bash
./scripts/stop-dev.sh
./scripts/start-dev.sh
```

### Changes Not Appearing?

#### Check File is Mounted
```bash
# List frontend src files in container
docker exec sds-frontend-dev ls -la /app/src

# Should match your local files
```

#### Check Vite HMR Connection
Open browser DevTools → Console. Should NOT see:
```
[vite] failed to connect to websocket
```

If you do, check nginx gateway is proxying correctly.

### Backend Not Restarting?

```bash
# Check tsx watch is running
docker exec sds-backend ps aux | grep tsx

# Should show: tsx watch src/index.ts
```

---

## 📊 Performance Tips

### 1. Use Delegated Volumes (Already Configured)
```yaml
volumes:
  - ./frontend/src:/app/src:delegated
```
This improves performance on Mac/Windows.

### 2. Polling Interval
Current: 1000ms (1 second)
- Slower = Less CPU usage
- Faster = Quicker updates

Edit `frontend/vite.config.ts`:
```typescript
watch: {
  usePolling: true,
  interval: 500  // Faster, uses more CPU
}
```

### 3. Selective Mounting
Only mount directories you actively edit.
- ✅ Mount: `src/`
- ❌ Don't mount: `node_modules/`, `dist/`, `.git/`

---

## 🔄 Switch Between Modes

### Development Mode (Hot Reload)
```bash
./scripts/start-dev.sh
```
- ✅ Fast iteration
- ✅ Instant feedback
- ✅ Source maps for debugging
- ⚠️ Slower initial startup

### Production Mode (No Hot Reload)
```bash
./scripts/start.sh
```
- ✅ Optimized builds
- ✅ Faster performance
- ✅ Production-ready
- ❌ No hot reload

---

## 📝 Behind the Scenes

### What Happens When You Edit a File?

#### Frontend (Vite HMR):
1. You save `Workspace.tsx`
2. File watcher detects change (polling)
3. Vite rebuilds only that module
4. HMR sends update via WebSocket
5. Browser updates component (no refresh!)
6. **Total time: <1 second**

#### Backend (tsx watch):
1. You save `workspaces.ts`
2. File watcher detects change
3. tsx recompiles TypeScript
4. Server restarts automatically
5. **Total time: 1-2 seconds**

---

## ✅ Summary

**Hot reload is now enabled!**

- ✅ Edit frontend code → Instant browser updates
- ✅ Edit backend code → Auto-restart in seconds
- ✅ Edit CSS/Tailwind → Instant styling updates
- ✅ No manual container restarts needed
- ✅ Development is now 10x faster!

**Start developing:**
```bash
./scripts/start-dev.sh
```

**Open your editor and start coding - changes will appear instantly!** 🚀

---

## 🆘 Need Help?

### View All Logs
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
```

### Restart Everything
```bash
./scripts/stop-dev.sh
./scripts/start-dev.sh
```

### Check Container Status
```bash
docker ps | grep sds-
```

### Enter Container Shell
```bash
# Frontend
docker exec -it sds-frontend-dev sh

# Backend
docker exec -it sds-backend sh
```

**Happy developing with hot reload! 🔥**

# Migration Plan — DeepFake Detector

> **Status:** Rencana — belum ada perubahan yang dilakukan  
> **Prinsip:** Tidak mengubah logika program, endpoint API, konfigurasi Docker, package.json, atau requirements.txt

---

## Ringkasan

Proyek saat ini mencampur kode frontend (Next.js), backend API (Flask), dan AI training dalam satu root. Targetnya adalah memisahkan secara konseptual menjadi tiga domain:

1. `frontend/` — Next.js (UI, client-side logic)
2. `backend/` — Flask API (inference production)
3. `ml/` — AI/ML Training (research, training, validation)

Migrasi dilakukan dalam **5 fase**, masing-masing dapat dijalankan bertahap tanpa merusak fungsionalitas jika dilakukan dengan benar (menggunakan `git mv` untuk preservasi history).

---

## Constraints (Tidak Bisa Diubah)

| Item | Alasan |
|------|--------|
| `package.json` | Path alias `@/*` merujuk ke root; mengubahnya akan memindahkan baseUrl |
| `docker-compose.yml` | Menunjuk `build: ./flask_api`; Dockerfile root ada di `./Dockerfile` |
| `flask_api/Dockerfile` | Build context adalah `./flask_api`; mengubah struktur akan memutus referensi |
| `flask_api/requirements.txt` | Digunakan oleh Dockerfile flask_api |
| Logika program | Tidak ada perubahan fungsi |
| Endpoint API | `/predict`, `/health`, `/model-info` tetap |

---

## Fase 0: Persiapan — Buat Direktori Kosong

```bash
mkdir frontend backend ml

# Struktur awal setelah Fase 0:
# .
# ├── frontend/
# ├── backend/
# ├── ml/
# ├── flask_api/       # (akan diarsipkan setelah migrasi)
# ├── ...root files...
# └── ...existing structure...
```

---

## Fase 1: Arsipkan `flask_api/` ke `backend/`

**Tujuan:** Memisahkan production API dari training scripts.

### Step 1.1 — Buat struktur backend

```bash
mkdir backend\models
mkdir backend\tests
```

### Step 1.2 — Pindahkan production API files

Dari `flask_api/` → `backend/`:

| Sumber | Tujuan | Alasan |
|--------|--------|--------|
| `flask_api/app.py` | `backend/app.py` | Main Flask entrypoint |
| `flask_api/requirements.txt` | `backend/requirements.txt` | Python dependencies |
| `flask_api/Dockerfile` | `backend/Dockerfile` | Container build |
| `flask_api/.dockerignore` | `backend/.dockerignore` | Build exclusion |

### Step 1.3 — Pindahkan production models

Dari `flask_api/` → `backend/models/`:

| Sumber | Tujuan | Alasan |
|--------|--------|--------|
| `flask_api/xception_finetuned.h5` | `backend/models/xception_finetuned.h5` | Model prioritas |
| `flask_api/xception_20k_model.h5` | `backend/models/xception_20k_model.h5` | Model fallback |

### Step 1.4 — Pindahkan test files (Backend API)

Dari `flask_api/` → `backend/tests/`:

| Sumber | Tujuan | Alasan |
|--------|--------|--------|
| `flask_api/test_api.py` | `backend/tests/test_api.py` | Integration test API |
| `flask_api/test_full.py` | `backend/tests/test_full.py` | E2E analysis test |

### 🔧 Perubahan yang diperlukan pada file

**`backend/app.py`** — Update path model:
```python
# Sebelum:
FINETUNED_PATH = os.path.join(BASE_DIR, 'xception_finetuned.h5')
ORIGINAL_PATH = os.path.join(BASE_DIR, 'xception_20k_model.h5')

# Sesudah:
FINETUNED_PATH = os.path.join(BASE_DIR, 'models', 'xception_finetuned.h5')
ORIGINAL_PATH = os.path.join(BASE_DIR, 'models', 'xception_20k_model.h5')
```

**`backend/tests/test_api.py`** — Update API URL jika diperlukan (opsional).

---

## Fase 2: Pisahkan AI Training ke `ml/`

**Tujuan:** Memisahkan research/training code dari production API.

### Step 2.1 — Buat struktur ML

```bash
mkdir ml\samples
mkdir ml\artifacts\temp
```

### Step 2.2 — Pindahkan training & validation scripts

Dari `flask_api/` → `ml/`:

| Sumber | Tujuan | Alasan |
|--------|--------|--------|
| `flask_api/retrain.py` | `ml/retrain.py` | Fine-tuning model |
| `flask_api/validate_model.py` | `ml/validate_model.py` | Model validation |
| `flask_api/diff_map.py` | `ml/diff_map.py` | CLI diff map generator |

### Step 2.3 — Pindahkan sample images

Dari `flask_api/` → `ml/samples/`:

| Sumber | Tujuan | Alasan |
|--------|--------|--------|
| `flask_api/AI.jpeg` | `ml/samples/AI.jpeg` | Sampel gambar AI |
| `flask_api/ASLI.jpeg` | `ml/samples/ASLI.jpeg` | Sampel gambar asli |

### Step 2.4 — Pindahkan artifacts

Dari `flask_api/` → `ml/artifacts/`:

| Sumber | Tujuan | Alasan |
|--------|--------|--------|
| `flask_api/diff_hasil.png` | `ml/artifacts/diff_hasil.png` | Hasil diff_map.py |

### Step 2.5 — Hapus temp file

| File | Status |
|------|--------|
| `flask_api/__temp_9556.jpg` | Sisa proses retrain — bisa dihapus |

### 🔧 Perubahan yang diperlukan pada file

**`ml/retrain.py`** — Update path model dan sample:
```python
# Sebelum:
BASE = os.path.dirname(os.path.abspath(__file__))
ASLI = os.path.join(BASE, "ASLI.jpeg")
AI = os.path.join(BASE, "AI.jpeg")
MODEL = os.path.join(BASE, "xception_20k_model.h5")
OUT = os.path.join(BASE, "xception_finetuned.h5")

# Sesudah:
BASE = os.path.dirname(os.path.abspath(__file__))
ASLI = os.path.join(BASE, "samples", "ASLI.jpeg")
AI = os.path.join(BASE, "samples", "AI.jpeg")
MODEL = os.path.join(os.path.dirname(BASE), "backend", "models", "xception_20k_model.h5")
OUT = os.path.join(os.path.dirname(BASE), "backend", "models", "xception_finetuned.h5")
```

**`ml/diff_map.py`** — Tidak perlu perubahan (path diberikan via CLI argumen).

**`ml/validate_model.py`** — Update path model:
```python
# Sebelum:
FINETUNED_PATH = os.path.join(BASE_DIR, 'xception_finetuned.h5')
ORIGINAL_PATH = os.path.join(BASE_DIR, 'xception_20k_model.h5')

# Sesudah:
FINETUNED_PATH = os.path.join(BASE_DIR, '..', 'backend', 'models', 'xception_finetuned.h5')
ORIGINAL_PATH = os.path.join(BASE_DIR, '..', 'backend', 'models', 'xception_20k_model.h5')
```

---

## Fase 3: Pisahkan Frontend ke `frontend/`

**Tujuan:** Memisahkan Next.js app dari root.

### Step 3.1 — Pindahkan semua frontend files

Dari root → `frontend/`:

| Sumber | Tujuan | Kategori |
|--------|--------|----------|
| `app/` | `frontend/app/` | Next.js App Router |
| `components/` | `frontend/components/` | React components |
| `hooks/` | `frontend/hooks/` | Custom hooks |
| `lib/` | `frontend/lib/` | Utilities |
| `public/` | `frontend/public/` | Static assets |
| `types/` | `frontend/types/` | Type definitions |
| `styles/` | `frontend/styles/` | Stylesheets |
| `next-env.d.ts` | `frontend/next-env.d.ts` | Next.js types |
| `tsconfig.json` | `frontend/tsconfig.json` | TypeScript config |
| `next.config.mjs` | `frontend/next.config.mjs` | Next.js config |
| `eslint.config.mjs` | `frontend/eslint.config.mjs` | ESLint config |
| `postcss.config.mjs` | `frontend/postcss.config.mjs` | PostCSS config |
| `components.json` | `frontend/components.json` | shadcn/ui config |
| `package.json` | `frontend/package.json` | NPM dependencies |
| `package-lock.json` | `frontend/package-lock.json` | Lockfile |
| `.env.example` | `frontend/.env.example` | Env template |
| `.env.local` | `frontend/.env.local` | Local env |
| `.vscode/` | `frontend/.vscode/` | VS Code settings |
| `Dockerfile` | `frontend/Dockerfile` | Docker build |
| `.dockerignore` | `frontend/.dockerignore` | Docker exclude |
| `tsconfig.tsbuildinfo` | (hapus) | Build cache |

### 🔧 Perubahan yang diperlukan

**`frontend/tsconfig.json`** — Update `paths`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./frontend/*"]   // Sebelum: ["./*"]
    }
  }
}
```

> ⚠️ Ini mengubah `@/*` path alias. Semua import seperti `@/components/...` akan otomatis merujuk ke `frontend/`. Perubahan ini kompatibel karena struktur di dalam `frontend/` identik dengan root saat ini.

**`frontend/Dockerfile`** — Update WORKDIR (jika perlu).

**Root Dockerfile** — Tidak diperlukan jika root `Dockerfile` dihapus dan diganti `docker-compose.yml` menunjuk ke `frontend/Dockerfile`.

**`docker-compose.yml`** — Update service `nextjs`:
```yaml
services:
  nextjs:
    build: ./frontend    # Sebelum: .
    ...
```

> ⚠️ Konfigurasi Docker tidak boleh diubah menurut constraint. Oleh karena itu, **Fase 3 bersifat opsional** jika Docker constraint dipertahankan. Alternatif: biarkan frontend di root, hanya rapikan backend dan ML.

---

## Fase 4: Bersihkan Direktori Lama

Setelah semua file dipindahkan, direktori lama bisa diarsipkan.

### Step 4.1 — Kosongkan `flask_api/`

Jika semua file telah dipindahkan, `flask_api/` hanya berisi `venv/` dan `__pycache__/`:
```bash
rmdir /s flask_api\__pycache__
rmdir /s flask_api\venv
rmdir flask_api
```

### Step 4.2 — Hapus folder kosong di root

```bash
rmdir app\api\auth\[...nextauth]
rmdir app\api\auth
rmdir app\api\predictions
rmdir app\login
rmdir types
rmdir styles
rmdir prisma
```

### Step 4.3 — Hapus file sementara

| File | Alasan |
|------|--------|
| `tsconfig.tsbuildinfo` | Build cache |
| `next-env.d.ts` | Auto-generated (akan regenerate) |

---

## Fase 5: Update Routing Docker Compose (Post-Migration)

Jika Docker constraint dilonggarkan, update `docker-compose.yml`:

```yaml
version: "3.8"
services:
  flask-api:
    build: ./backend          # Sebelum: ./flask_api
    restart: always
    ports:
      - "5001:5001"

  nextjs:
    build: ./frontend         # Sebelum: .
    restart: always
    ports:
      - "3000:3000"
    depends_on:
      flask-api:
        condition: service_healthy
```

---

## Daftar Lengkap File yang Dipindahkan

### Dari `flask_api/` ke `backend/` (production API)

```
flask_api/app.py                        →  backend/app.py
flask_api/requirements.txt              →  backend/requirements.txt
flask_api/Dockerfile                    →  backend/Dockerfile
flask_api/.dockerignore                 →  backend/.dockerignore
flask_api/xception_finetuned.h5         →  backend/models/xception_finetuned.h5
flask_api/xception_20k_model.h5         →  backend/models/xception_20k_model.h5
flask_api/test_api.py                   →  backend/tests/test_api.py
flask_api/test_full.py                  →  backend/tests/test_full.py
```

### Dari `flask_api/` ke `ml/` (AI/ML training)

```
flask_api/retrain.py                    →  ml/retrain.py
flask_api/validate_model.py             →  ml/validate_model.py
flask_api/diff_map.py                   →  ml/diff_map.py
flask_api/AI.jpeg                       →  ml/samples/AI.jpeg
flask_api/ASLI.jpeg                     →  ml/samples/ASLI.jpeg
flask_api/diff_hasil.png                →  ml/artifacts/diff_hasil.png
```

### Dari root ke `frontend/` (opsional, tergantung Docker constraint)

```
app/                                    →  frontend/app/
components/                             →  frontend/components/
hooks/                                  →  frontend/hooks/
lib/                                    →  frontend/lib/
public/                                 →  frontend/public/
types/                                  →  frontend/types/
styles/                                 →  frontend/styles/
next-env.d.ts                           →  frontend/next-env.d.ts
tsconfig.json                           →  frontend/tsconfig.json
next.config.mjs                         →  frontend/next.config.mjs
eslint.config.mjs                       →  frontend/eslint.config.mjs
postcss.config.mjs                      →  frontend/postcss.config.mjs
components.json                         →  frontend/components.json
package.json                            →  frontend/package.json
package-lock.json                       →  frontend/package-lock.json
.env.example                            →  frontend/.env.example
.env.local                              →  frontend/.env.local
.vscode/                                →  frontend/.vscode/
Dockerfile                              →  frontend/Dockerfile
.dockerignore                           →  frontend/.dockerignore
```

### File sementara yang bisa dihapus

```
flask_api/__temp_9556.jpg               →  HAPUS (sisa retrain)
flask_api/__pycache__/                  →  HAPUS (bytecode cache)
flask_api/venv/                         →  HAPUS (recreate with pip)
.next/                                  →  HAPUS (build cache)
tsconfig.tsbuildinfo                    →  HAPUS (build cache)
```

### Folder kosong yang bisa dihapus

```
app/api/auth/[...nextauth]/             →  HAPUS (bekas NextAuth)
app/api/auth/                           →  HAPUS
app/api/predictions/                    →  HAPUS (belum diisi)
app/login/                              →  HAPUS (bekas halaman login)
types/                                  →  HAPUS (kosong)
styles/                                 →  HAPUS (kosong)
prisma/                                 →  HAPUS (bekas Prisma)
```

---

## Matriks Risiko

| Fase | Risiko | Mitigasi |
|------|--------|----------|
| Fase 1: Backend | `app.py` path model berubah | Update `FINETUNED_PATH` dan `ORIGINAL_PATH` |
| Fase 1: Backend | Docker build context berubah | Update `docker-compose.yml` `build:` path |
| Fase 2: ML | `retrain.py` path model & sample berubah | Update `ASLI`, `AI`, `MODEL`, `OUT` path |
| Fase 2: ML | `validate_model.py` path model berubah | Update `FINETUNED_PATH`, `ORIGINAL_PATH` |
| Fase 3: Frontend | `@/*` path alias berubah | Update `tsconfig.json` `paths` |
| Fase 3: Frontend | Docker build context | Update `docker-compose.yml` |
| Fase 4: Cleanup | Import reference broken | Verifikasi semua import setelah move |
| Semua | Git history terputus | Gunakan `git mv`, bukan copy-paste |

---

## Verifikasi Post-Migration

Setelah setiap fase, jalankan:

```bash
# Frontend
cd frontend && npm run build

# Backend
cd backend && python app.py & curl http://localhost:5001/health

# ML Training
cd ml && python validate_model.py samples/ASLI.jpeg samples/AI.jpeg
```

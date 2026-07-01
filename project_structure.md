# Project Structure — DeepFake Detector

## Target Arsitektur

Pemisahan konseptual tiga domain: **Frontend** (Next.js), **Backend API** (Flask), dan **AI/ML Training** (Python scripts). Setiap domain berdiri sendiri dengan direktori, dependensi, dan pipeline masing-masing.

```
SKRIPSI/
│
├── frontend/                          # ◄── Next.js (UI + Client)
│   ├── .vscode/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/                       # Next.js API routes (opsional)
│   ├── components/
│   │   ├── header.tsx
│   │   ├── language-provider.tsx
│   │   ├── theme-provider.tsx
│   │   ├── upload-section.tsx
│   │   ├── viewer-container.tsx
│   │   ├── analysis-panel.tsx
│   │   ├── ui/                        # shadcn/ui components
│   │   └── viewers/
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   ├── use-mobile.ts
│   │   └── use-zoom-pan.ts
│   ├── lib/
│   │   ├── i18n.ts
│   │   ├── media.ts
│   │   └── utils.ts
│   ├── public/
│   │   ├── apple-icon.png
│   │   ├── icon-*.png
│   │   ├── icon.svg
│   │   └── placeholder-*
│   ├── types/                         # Type definitions (opsional)
│   ├── styles/                        # Global styles (opsional)
│   ├── next-env.d.ts
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── eslint.config.mjs
│   ├── postcss.config.mjs
│   ├── components.json
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example
│   ├── .env.local
│   ├── .gitignore
│   ├── .dockerignore
│   ├── Dockerfile                     # Next.js standalone build
│   └── node_modules/
│
├── backend/                           # ◄── Flask API (Production Inference)
│   ├── app.py                         # Flask entry point
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── models/                        # Model ML untuk produksi
│   │   ├── xception_finetuned.h5
│   │   └── xception_20k_model.h5
│   └── tests/                         # Test untuk API
│       ├── test_api.py
│       └── test_full.py
│
├── ml/                                # ◄── AI/ML Research & Training
│   ├── retrain.py                     # Fine-tuning model
│   ├── validate_model.py              # Validasi model
│   ├── diff_map.py                    # Pixel difference map (CLI)
│   ├── samples/                       # Sample images
│   │   ├── AI.jpeg
│   │   └── ASLI.jpeg
│   ├── artifacts/                     # Generated artifacts
│   │   ├── diff_hasil.png
│   │   └── temp/                      # Temporary files (gitignored)
│   └── notebooks/                     # Jupyter notebooks (future)
│
├── docker-compose.yml                 # Orkestrasi frontend + backend
├── CATATAN-PROGRES.md                 # Dokumentasi progres
└── README.md                          # Dokumentasi utama
```

---

## Domain Breakdown

### 1. Frontend (`frontend/`)

| Path | Fungsi |
|------|--------|
| `app/page.tsx` | Halaman utama — upload + viewer |
| `app/layout.tsx` | Root layout — font, theme, i18n, analytics |
| `app/globals.css` | Tailwind v4 + CSS variables |
| `app/api/` | Next.js API routes (opsional, endpoint belum diisi) |
| `components/header.tsx` | Navigation bar + language switcher |
| `components/language-provider.tsx` | React context i18n EN/ID |
| `components/theme-provider.tsx` | Light mode provider |
| `components/upload-section.tsx` | Drag-drop + URL upload |
| `components/viewer-container.tsx` | Orchestrator viewer + analysis |
| `components/analysis-panel.tsx` | ML result + file info + pixel diff |
| `components/ui/` | shadcn/ui reusable components |
| `components/viewers/` | Comparison viewers |
| `hooks/` | Custom React hooks |
| `lib/` | Utility functions |
| `public/` | Static assets |
| `.env.example` | Template environment variables |
| `.env.local` | Local environment (gitignored) |

### 2. Backend API (`backend/`)

| Path | Fungsi |
|------|--------|
| `app.py` | Flask app — endpoints `/predict`, `/health`, `/model-info` |
| `requirements.txt` | Python dependencies |
| `Dockerfile` | Container image untuk Flask API |
| `models/xception_finetuned.h5` | Model Xception fine-tuned (prioritas) |
| `models/xception_20k_model.h5` | Model Xception original (fallback) |
| `tests/test_api.py` | Integration test untuk API |
| `tests/test_full.py` | End-to-end analysis test |

### 3. AI/ML Training (`ml/`)

| Path | Fungsi |
|------|--------|
| `retrain.py` | Fine-tune XceptionNet dengan sample ASLI/AI |
| `validate_model.py` | Validasi output model |
| `diff_map.py` | CLI tool: generate pixel difference map |
| `samples/AI.jpeg` | Contoh gambar hasil AI untuk training |
| `samples/ASLI.jpeg` | Contoh gambar asli untuk training |
| `artifacts/diff_hasil.png` | Output generated dari diff_map.py |

---

## Perbandingan: Sekarang vs Target

| Aspek | Saat Ini | Target |
|-------|----------|--------|
| Frontend | Root (`/`) | `frontend/` |
| Backend | `flask_api/` | `backend/` |
| ML Training | Campur di `flask_api/` | `ml/` |
| Model ML | `flask_api/*.h5` | `backend/models/*.h5` |
| Sample Images | `flask_api/*.jpeg` | `ml/samples/*.jpeg` |
| Test Scripts | `flask_api/test_*.py` | `backend/tests/` + `ml/tests/` |
| CLI Tools | `flask_api/diff_map.py` | `ml/diff_map.py` |
| Docker Compose | Root | Root (tetap) |

---

## Prinsip Desain

1. **Separation of Concerns**: Setiap direktori memiliki tanggung jawab tunggal
2. **Production vs Research**: Model untuk produksi di `backend/models/`, training/eksperimen di `ml/`
3. **Minimal Cross-Domain Dependency**: Frontend hanya tahu URL API; Backend hanya tahu model path; ML training independen
4. **Preserve Git History**: File dipindahkan (`git mv`), bukan copy-paste, agar history tetap utuh
5. **No Logic Change**: Zero perubahan pada kode program, hanya restrukturisasi direktori

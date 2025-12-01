# AlphaScent Pipeline

Data ingestion pipeline for AlphaScent: arXiv OAI-PMH → local SQLite → Cloudflare D1/R2.

## Setup

```bash
# 1. Environment
python -m venv .venv && source .venv/bin/activate
pip install -r pipeline/requirements.txt

# 2. Credentials
cp env.example .env.local
# Fill in: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_API_TOKEN, D1_DATABASE_ID, CLOUDFLARE_R2_*
```

## Daily Workflow

The pipeline runs in 4 main stages:

### 1. Harvest Paper Metadata from OAI-PMH
Harvests raw metadata from arXiv for broad categories (cs, stat, math, etc.) into local SQLite databases.

```bash
python pipeline/harvest_category/bulk_harvest_oai.py \
  --category cs \
  --start-date 2024-01-01 \
  --end-date 2024-01-08
```
*Outputs: `pipeline/cs.db`, `pipeline/stat.db`, etc.*

### 2. Filter Subcategories
Filters papers for specific subcategories (e.g., `cs.CV`, `cs.HC`) from the raw harvested databases. Harvest all categories to capture all cross-listed papers.

```bash
python pipeline/db_util/filter_subcategory_papers.py --category cs.CV
```
*Outputs: `pipeline/filtered_cs_CV.db`*

### 3. Upload to D1
Uploads the filtered papers to the Cloudflare D1 database. Skips existing papers to minimize writes.

```bash
python pipeline/db_util/upload_to_d1.py \
  --db pipeline/filtered_cs_CV.db \
  --category cs.CV
```

### 4. Extract Figures
Queries D1 for papers without figures, downloads PDFs, extracts figures, uploads to R2, and updates D1. Don't exceed rate limit of no more than one request per every 3 seconds.

```bash
python pipeline/figure_extraction/extract_figures_batch.py \
  --category cs.CV \
  --max-count 100 \
  --workers 1
```

## Utility Scripts

| Script | Usage |
| :--- | :--- |
| `pipeline/generate_access_token.py` | Generate HC access tokens (`--name`, `--expires`) |
| `pipeline/db_util/clear_d1.py` | **Wipe** all data from D1 |
| `pipeline/figure_extraction/extract_figures.py` | Test figure extraction on a single paper ID |

## Troubleshooting

- **Missing Config:** Ensure `.env.local` exists.
- **D1/R2 Errors:** Check credentials in `.env.local` and token permissions.

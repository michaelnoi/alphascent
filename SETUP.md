# Setup Guide

## Initial Setup

### 1. Create Environment File

Create a file named `.env.local` in the project root with the following content:

```bash
# Timezone for arXiv scraping (arXiv uses Eastern Time)
TZ=America/New_York

# Base URL for the application
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

You can do this with:

```bash
cat > .env.local << 'EOF'
TZ=America/New_York
NEXT_PUBLIC_BASE_URL=http://localhost:3000
EOF
```

### 2. Install Dependencies

```bash
make setup
```

This will:
- Install npm packages
- Create Python virtual environment
- Install Python dependencies
- Create data directories

### 3. Scrape Papers

```bash
make scrape
```

This fetches today's cs.CV papers from arXiv and saves them to `public/data/papers-YYYY-MM-DD.json`.

### 4. Start Development Server

```bash
make dev
```

Open http://localhost:3000 in your browser.

## Troubleshooting

### "No papers available" error

Make sure you've run `make scrape` first to fetch the data.

### Python virtual environment issues

If you have issues with the Python venv:

```bash
# Remove existing venv
rm -rf .venv

# Recreate it manually
python3 -m venv .venv
source .venv/bin/activate
pip install -r worker/requirements.txt
```

### Node.js version issues

Make sure you're using Node.js 18 or later:

```bash
node --version  # Should be v18.x or higher
```

If using nvm:

```bash
nvm install --lts
nvm use --lts
```

## Manual Setup (without Make)

If you prefer not to use Make or are on Windows:

```bash
# 1. Create .env.local (see above)

# 2. Install npm dependencies
npm install

# 3. Create Python venv
python3 -m venv .venv

# On Unix/Mac:
source .venv/bin/activate

# On Windows:
.venv\Scripts\activate

# 4. Install Python dependencies
pip install -r worker/requirements.txt

# 5. Create data directories
mkdir -p public/data public/figures

# 6. Run scraper
python worker/scrape_arxiv.py

# 7. Start dev server
npm run dev
```

## Daily Workflow

1. **Morning**: Run `make scrape` to get today's papers
2. **Browse**: Open http://localhost:3000 to view papers
3. **Different date**: `python worker/scrape_arxiv.py --date 2025-10-18`

## Development

- `make dev` - Start dev server with hot reload
- `make lint` - Check code style
- `make typecheck` - Check TypeScript types
- `make build` - Test production build
- `make clean` - Remove build artifacts

## Data Location

- Papers JSON: `public/data/papers-YYYY-MM-DD.json`
- Each file contains all cs.CV papers for that date
- Files are served statically by Next.js


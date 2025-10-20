# AlphaScent

A foraging-first interface for computer vision research papers from arXiv, live at [alphascent.org](https://alphascent.org). Updates daily with the latest cs.CV papers, optimized for rapid understanding and decision-making in exploratory research tasks.

## Design Philosophy

AlphaScent prioritizes **information scent maximization** for foraging-heavy researcher tasks:

1. **Speed over features**: No LLM summaries, no loading states
2. **Visual hooks**: AI-extracted teaser and architecture figures shown inline
3. **Zero friction**: One-click expansion, keyboard-first navigation
4. **Progressive disclosure**: Essential info first, details on demand
5. **Daily updates**: Fresh papers every day, automatically scraped and processed


## Keyboard Shortcuts

### Search
| Key | Action |
|-----|--------|
| <kbd>⌘</kbd> <kbd>F</kbd> / <kbd>Ctrl</kbd> <kbd>F</kbd> | Focus search bar |
| <kbd>Enter</kbd> | Exit search (return to navigation) |

### Navigation
| Key | Action |
|-----|--------|
| <kbd>j</kbd> / <kbd>k</kbd> | Navigate to next/previous paper |
| <kbd>Space</kbd> | Expand/collapse current paper |

### Open Links
| Key | Action |
|-----|--------|
| <kbd>u</kbd> | Open abstract page |
| <kbd>i</kbd> | Open PDF |
| <kbd>o</kbd> | Open code repository (if available) |
| <kbd>p</kbd> | Open project page (if available) |
| <kbd>Shift</kbd> + above | Stay on current page (otherwise jumps to new tab) |



## Features

- **Visual-First Representation**: Automatically extracted teaser and architecture figures from PDFs
- **Smart Figure Extraction**: ML-powered classification using Gemini 2.5 Flash to identify the best teaser and architecture diagrams
- **Accordion Expansion**: Quick overview with inline detailed view showing full abstracts and high-resolution figures
- **Keyboard Navigation**: Power-user shortcuts for rapid browsing and link opening
- **Fast Performance**: No loading spinners, pre-rendered data, aggressive caching
- **Filtered Search**: Debounced text search across titles, abstracts, and authors
- **Link Detection**: Automatically extracts code repositories and project pages from paper metadata
- **Responsive Design**: Optimized for desktop research workflows


## Quick Start

### Prerequisites

- Node.js 18+ (with nvm recommended)
- Python 3.8+

### Setup

```bash
# 1. Install dependencies
make setup

# 2. Scrape today's papers
make scrape

# 3. Start development server
make dev

# 4. Open http://localhost:3000
```

### Manual Setup

If you prefer not to use Make:

```bash
# Install npm dependencies
npm install

# Create Python virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r worker/requirements.txt

# Create data directories
mkdir -p public/data public/figures

# Run scraper
python worker/scrape_arxiv.py

# Start dev server
npm run dev
```

## Usage

### Scraping Papers

Uses the official arXiv API for reliable data with full abstracts:

```bash
# Scrape today's papers
make scrape

# Or directly:
python worker/scrape_arxiv.py

# Scrape with options
python worker/scrape_arxiv.py --date 2025-10-19 --max-results 500

# Get all recent papers without date filtering
python worker/scrape_arxiv.py --no-date-filter

# Dry run (print to stdout without saving)
python worker/scrape_arxiv.py --dry-run
```

### Development Commands

```bash
make dev        # Start development server
make build      # Build for production
make lint       # Run ESLint
make typecheck  # Check TypeScript types
make clean      # Remove build artifacts
```

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Data Pipeline**: Python (arXiv API, PyMuPDF, Google Gemini 2.5 Flash)
- **Figure Processing**: Automated PDF extraction, ML classification, WebP conversion
- **Persistence**: JSON files (database-ready architecture)
- **Hosting**: Static export, CDN-ready

## Architecture

### Data Flow

1. Python worker fetches papers from arXiv API
2. For each paper:
   - Downloads PDF and extracts images
   - Uses Gemini 2.5 Flash to classify teaser and architecture figures
   - Downsamples and converts to WebP for efficient delivery
3. Generates JSON with paper metadata and figure URLs
4. Next.js app loads JSON from `public/data/`
5. Client-side filtering and keyboard navigation

### Figure Extraction Pipeline

The automated figure extraction process:

1. **PDF Download**: Fetches PDFs from arXiv using paper IDs
2. **Image Extraction**: Uses PyMuPDF to extract all images from PDFs with metadata
3. **Smart Downsampling**: Images are aggressively downsampled to 512px JPEG for VLM processing (saves ~95% bandwidth)
4. **ML Classification**: Gemini 2.5 Flash compares candidate images to select:
   - **Teaser figure**: Best overview/method diagram (typically Figure 1)
   - **Architecture figure**: Best technical architecture diagram (typically Figure 2)
5. **Optimization**: Converts selected figures to WebP format with full-size (800px) and thumbnail (200px) versions
6. **Caching**: Skips reprocessing for papers with existing figures, enabling fast daily updates

### Directory Structure

```
alphascent/
├── app/
│   ├── cv/page.tsx              # Main paper list view
│   ├── lib/
│   │   ├── schema.ts            # TypeScript types
│   │   └── loadData.ts          # Data access layer
│   └── components/
│       ├── PaperCard.tsx        # Accordion card with figure display
│       ├── Filters.tsx          # Search filter with keyboard shortcuts
│       └── useKeyboardNav.ts    # Keyboard navigation hook
├── public/
│   ├── data/                    # JSON paper data
│   └── figures/                 # Extracted paper figures (WebP)
└── worker/
    ├── scrape_arxiv.py          # arXiv API scraper with orchestration
    ├── extract_figures.py       # PDF download and image extraction
    ├── classify_figures.py      # ML-based figure classification
    └── process_figures.py       # Figure processing pipeline
```

### Future-Proofing

The codebase is designed for easy database migration:

- **Abstract data access**: All data fetching through `loadData.ts`
- **Strict typing**: TypeScript types in `schema.ts`
- **Data normalization**: Clean, validated data from scraper
- **Environment config**: `.env.local` for configuration
- **Independent worker**: Python scraper works standalone


## Acknowledgments

Data from [arXiv.org](https://arxiv.org). arXiv is a trademark of Cornell University.

## License

MIT

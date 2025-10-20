.PHONY: setup scrape scrape-no-figures dev build lint typecheck clean help

PYTHON := python3
VENV := .venv
VENV_BIN := $(VENV)/bin

help:
	@echo "AlphaScent Development Commands:"
	@echo "  make setup              - Install all dependencies (npm + Python)"
	@echo "  make scrape             - Fetch today's papers with figure extraction"
	@echo "  make scrape-no-figures  - Fetch today's papers (skip figures, faster)"
	@echo "  make dev                - Start Next.js development server"
	@echo "  make build              - Build for production"
	@echo "  make lint               - Run ESLint"
	@echo "  make typecheck          - Run TypeScript type checking"
	@echo "  make clean              - Remove build artifacts and venv"

setup:
	@echo "Installing npm dependencies..."
	npm install
	@echo "Creating Python virtual environment..."
	$(PYTHON) -m venv $(VENV)
	@echo "Installing Python dependencies..."
	$(VENV_BIN)/pip install -r worker/requirements.txt
	@echo "Creating data directories..."
	mkdir -p public/data public/figures
	@echo ""
	@echo "Setup complete! Next steps:"
	@echo "  1. Run 'make scrape' to fetch today's papers"
	@echo "  2. Run 'make dev' to start the development server"

scrape:
	@echo "Fetching arXiv cs.CV papers with figure extraction..."
	$(VENV_BIN)/python worker/scrape_arxiv.py

scrape-no-figures:
	@echo "Fetching arXiv cs.CV papers (skipping figures)..."
	$(VENV_BIN)/python worker/scrape_arxiv.py --no-figures

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

typecheck:
	npx tsc --noEmit

clean:
	rm -rf .next node_modules $(VENV) public/data/*.json
	@echo "Cleaned build artifacts"


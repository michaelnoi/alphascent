.PHONY: dev build lint typecheck clean help

help:
	@echo "AlphaScent Development Commands:"
	@echo "  make dev                - Start Next.js development server"
	@echo "  make build              - Build for production"
	@echo "  make lint               - Run ESLint"
	@echo "  make typecheck          - Run TypeScript type checking"
	@echo "  make clean              - Remove build artifacts"

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

typecheck:
	npx tsc --noEmit

clean:
	rm -rf .next node_modules
	@echo "Cleaned build artifacts"

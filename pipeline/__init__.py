"""
AlphaScent Pipeline: Direct arXiv → SQLite → Cloudflare D1/R2 ingestion system.

Architecture:
    arXiv API → Local SQLite for all categories → Filter by subcategory → Upload to D1 → Process Figures → Upload to R2
    Note: Figure extraction is done in a separate step to avoid blocking the main pipeline. Figures are only stored in online storage (R2).
"""

__version__ = "0.0.3"

# AlphaScent

A figure-first interface for computer science research papers from arXiv, live at [alphascent.org](https://alphascent.org). Automatically extracted figures from PDFs are shown inline, optimized for rapid understanding and decision-making in exploratory research tasks.

## About

AlphaScent displays arXiv papers with automatically extracted figures shown inline. All data comes from arXiv, and dates shown are **submitted dates** (not announcement dates).

**Important Disclaimer**: Papers displayed here may not be the most up-to-date versions. Always check the actual arXiv abstract/PDF view for the latest version. Note that many published papers don't update their arXiv submissions with camera-ready versions from conferences/journals, so always verify you're viewing the most current version.

### Categories

Currently, AlphaScent supports two categories:

- **Computer Vision ([alphascent.org/cv](https://alphascent.org/cv))**: Contains papers from this year (2025) only
- **Human-Computer Interaction ([alphascent.org/hc](https://alphascent.org/hc))**: Contains **all historical papers** submitted to arXiv in the cs.HC category. Currently access-controlled for a user study (requires authentication token).

## Design Philosophy

1. **Speed over features**: No LLM summaries, no loading states
2. **Visual hooks**: Automatically extracted figures shown inline (for now, we display first and second figures from each paper, eventually we will smartly select teaser/architecture/results/etc. figures)
3. **Zero friction**: One-click expansion, keyboard-first navigation
4. **Progressive disclosure**: Essential info first, details on demand

## Keyboard Shortcuts

### Navigation

| Key | Action |
|-----|--------|
| <kbd>j</kbd> | Navigate to next paper |
| <kbd>k</kbd> | Navigate to previous paper |
| <kbd>Space</kbd> | Expand/collapse paper details |

### Search

| Key | Action |
|-----|--------|
| <kbd>⌘</kbd> <kbd>F</kbd> / <kbd>Ctrl</kbd> <kbd>F</kbd> | Focus search bar |
| <kbd>Enter</kbd> | Execute search (disables text input) |
| <kbd>Esc</kbd> | Blur search bar |

### Open Links

| Key | Action |
|-----|--------|
| <kbd>u</kbd> | Open abstract page |
| <kbd>i</kbd> | Open PDF |
| <kbd>o</kbd> | Open code repository (if available) |
| <kbd>p</kbd> | Open project page (if available) |
| <kbd>Shift</kbd> + <kbd>u</kbd>/<kbd>i</kbd>/<kbd>o</kbd>/<kbd>p</kbd> | Open in new tab (otherwise navigates in same tab) |

### Content

| Key | Action |
|-----|--------|
| <kbd>Shift</kbd> + <kbd>M</kbd> | Load more papers |

### Help

| Key | Action |
|-----|--------|
| <kbd>?</kbd> | Show/hide keyboard shortcuts |
| <kbd>Esc</kbd> | Close shortcuts dialog |

## Features

- **Visual-First Representation**: Automatically extracted figures from PDFs
- **Simple Figure Selection**: First two valid figures from each paper
- **Expandable Details**: Quick overview with inline detailed view showing full abstracts and high-resolution figures
- **Keyboard Navigation**: Power-user shortcuts for rapid browsing and link opening
- **Fast Performance**: No loading spinners, Cloudflare-edge delivery
- **Full-Text Search**: full-text search across **titles, abstracts and authors**. Can be toggled to search either:
  - **All papers**: Search across all available historical papers for the category
  - **Current view**: Search only within the currently selected date or date range
- **Date Filtering**: Browse papers by single date or date range
- **Link Detection**: Automatically extracts code repositories and project pages from paper comments

For development setup, deployment, and technical details, see [SETUP.md](SETUP.md).

## TODO

### Category Views

- [x] HC views (all historical papers, access controlled)
- [x] CV views
  - [ ] Full history beyond this year

### Paper Updates

- [ ] Daily updates

### Figure Processing

- [ ] Better figure extraction
- [ ] Better figure selection

## Acknowledgments

Thank you to arXiv for use of its open access interoperability.

export function getCategoryTable(category: string): string {
  return `papers_${category.toLowerCase().replace('.', '_')}`;
}

export function getFTSTable(category: string): string {
  return `${getCategoryTable(category)}_fts`;
}

export const SUPPORTED_CATEGORIES = ['cs.CV', 'cs.HC'];

export function isValidCategory(category: string): boolean {
  return SUPPORTED_CATEGORIES.includes(category);
}


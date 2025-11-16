export interface CategoryConfig {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  tableName: string;
  protected: boolean;
}

export const CATEGORIES: Record<string, CategoryConfig> = {
  'CV': {
    id: 'cs.CV',
    slug: 'CV',
    displayName: 'Computer Vision',
    description: 'Computer Vision and Pattern Recognition',
    tableName: 'papers_cs_cv',
    protected: false
  },
  'HC': {
    id: 'cs.HC',
    slug: 'HC',
    displayName: 'Human-Computer Interaction',
    description: 'Human-Computer Interaction',
    tableName: 'papers_cs_hc',
    protected: true
  }
};

export function getCategoryBySlug(slug: string): CategoryConfig | undefined {
  return CATEGORIES[slug];
}

export function getAllCategories(): CategoryConfig[] {
  return Object.values(CATEGORIES);
}

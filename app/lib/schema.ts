export interface Paper {
  id: string;
  title: string;
  authors: string[];
  categories: string[];
  primary_category: string;
  abstract: string;
  links: {
    abs: string;
    pdf: string;
    code?: string;
    project_page?: string;
    figures?: {
      teaser?: {
        full: string;
        thumb: string;
      };
      architecture?: {
        full: string;
        thumb: string;
      };
    };
  };
  comments?: string;
  scraped_at: string;
}

export interface PapersData {
  date: string;
  source: string;
  papers: Paper[];
}


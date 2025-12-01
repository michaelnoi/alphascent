"""D1 HTTP API client for Cloudflare D1."""

from typing import Dict, List, Optional
import requests


class D1Client:
    def __init__(self, config: Dict):
        self.url = f"https://api.cloudflare.com/client/v4/accounts/{config['account_id']}/d1/database/{config['database_id']}/query"
        self.headers = {"Authorization": f"Bearer {config['api_token']}", "Content-Type": "application/json"}
    
    def _execute(self, sql: str) -> List[Dict]:
        """Execute SQL and return results"""
        try:
            response = requests.post(self.url, headers=self.headers, json={"sql": sql}, timeout=30)
            response.raise_for_status()
            result = response.json()
            
            if not result.get('success'):
                raise Exception(f"D1 error: {result.get('errors', [])}")
            
            return result.get('result', [{}])[0].get('results', [])
        except requests.exceptions.RequestException as e:
            raise Exception(f"D1 API failed: {e}")
    
    def query(self, sql: str) -> List[Dict]:
        """Execute query against D1"""
        return self._execute(sql)
    
    def get_papers_needing_figures(self, category: str, limit: Optional[int] = None) -> List[str]:
        """Get paper IDs without figures for a category"""
        table = f'papers_{category.lower().replace(".", "_")}'
        limit_sql = f"LIMIT {limit}" if limit else ""
        sql = f"SELECT p.id FROM {table} p LEFT JOIN figures f ON p.id = f.paper_id WHERE f.id IS NULL ORDER BY p.submitted_date DESC {limit_sql}"
        return [row['id'] for row in self.query(sql)]
    
    def insert_figure(self, paper_id: str, kind: str, r2_key: str, thumb_key: str, width: int, height: int):
        """Insert or update figure metadata in D1"""
        figure_id = f"{paper_id}-{kind}"
        thumb = f"'{thumb_key}'" if thumb_key else "NULL"
        sql = f"INSERT INTO figures (id, paper_id, kind, r2_key, thumb_key, width, height) VALUES ('{figure_id}', '{paper_id}', '{kind}', '{r2_key}', {thumb}, {width}, {height}) ON CONFLICT(id) DO UPDATE SET r2_key=excluded.r2_key, thumb_key=excluded.thumb_key, width=excluded.width, height=excluded.height"
        self._execute(sql)

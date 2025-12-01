#!/usr/bin/env python3
"""Clear all data from Cloudflare D1 (papers and figures)."""

import sys
import requests

try:
    import config
except (ImportError, FileNotFoundError, ValueError) as e:
    print(f"Error loading configuration: {e}", file=sys.stderr)
    print("Make sure .env.local exists with all required Cloudflare credentials.", file=sys.stderr)
    sys.exit(1)


def clear_d1() -> bool:
    url = f"https://api.cloudflare.com/client/v4/accounts/{config.CLOUDFLARE_ACCOUNT_ID}/d1/database/{config.D1_DATABASE_ID}/query"
    headers = {
        "Authorization": f"Bearer {config.D1_API_TOKEN}",
        "Content-Type": "application/json",
    }

    print("WARNING: This will delete ALL papers and figures from D1!", file=sys.stderr)
    if input("Type 'DELETE' to confirm: ") != "DELETE":
        print("Aborted.", file=sys.stderr)
        return False

    print("\nDeleting all data from D1...", file=sys.stderr)
    for name, sql in (("figures", "DELETE FROM figures"), ("papers", "DELETE FROM papers")):
        print(f"  Deleting {name}...", file=sys.stderr)
        try:
            resp = requests.post(url, headers=headers, json={"sql": sql}, timeout=30)
            resp.raise_for_status()
            result = resp.json()
            if not result.get("success"):
                print(f"  ✗ Failed to delete {name}: {result.get('errors', [])}", file=sys.stderr)
                return False
            print(f"  ✓ {name.capitalize()} deleted", file=sys.stderr)
        except Exception as e:
            print(f"  ✗ Error deleting {name}: {e}", file=sys.stderr)
            return False

    print("\n✓ Database cleared successfully", file=sys.stderr)
    return True


if __name__ == "__main__":
    sys.exit(0 if clear_d1() else 1)

"""
Generate access tokens for HC beta users.

Stores tokens in the access_keys table in D1.
"""

import sys
import secrets
import hashlib
import uuid
from datetime import datetime, timedelta, UTC
from pathlib import Path
from typing import Optional

import tyro

sys.path.insert(0, str(Path(__file__).parent))
from d1_client import D1Client
import config


def hash_token(token: str) -> str:
    """SHA256 hash of the token."""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_access_token(
    user_name: Optional[str] = None,
    user_email: Optional[str] = None,
    notes: Optional[str] = None,
    expires_days: int = 90,
):
    """Generate and store an access token for HC access."""
    token = secrets.token_hex(32)
    key_hash = hash_token(token)
    key_id = str(uuid.uuid4())

    expires_at = (datetime.now(UTC) + timedelta(days=expires_days)).isoformat().replace('+00:00', 'Z')
    accessible_dates = '["*"]'

    client = D1Client({
        'account_id': config.CLOUDFLARE_ACCOUNT_ID,
        'database_id': config.D1_DATABASE_ID,
        'api_token': config.D1_API_TOKEN
    })

    def esc(value: Optional[str]) -> str:
        if not value:
            return 'NULL'
        return f"'{value.replace("'", "''")}'"

    user_name_sql = esc(user_name)
    user_email_sql = esc(user_email)
    notes_sql = esc(notes)
    expires_at_sql = f"'{expires_at.replace("'", "''")}'"

    sql = f"""
    INSERT INTO access_keys (
        id, key_hash, user_name, user_email,
        accessible_dates, expires_at, notes
    ) VALUES (
        '{key_id}',
        '{key_hash}',
        {user_name_sql},
        {user_email_sql},
        '{accessible_dates}',
        {expires_at_sql},
        {notes_sql}
    )
    """

    try:
        client.query(sql)
        print("\n" + "=" * 70)
        print("✓ Access Token Created Successfully")
        print("=" * 70)
        print(f"\nToken ID:     {key_id}")
        if user_name:
            print(f"User Name:    {user_name}")
        if user_email:
            print(f"User Email:   {user_email}")
        print(f"Expires:      {expires_at[:10]} ({expires_days} days)")
        if notes:
            print(f"Notes:        {notes}")
        print("\n" + "=" * 70)
        print("TOKEN (share this with the user):")
        print("=" * 70)
        print(f"\n{token}\n")
        print("=" * 70)
        print("\nThe user can access the locked page(s) if applicable.")
        print("They will be prompted to enter this token.\n")

        return token
    except Exception as e:
        print(f"\n✗ Error creating token: {e}")
        sys.exit(1)


def main(
    name: Optional[str] = None,
    email: Optional[str] = None,
    notes: Optional[str] = None,
    expires: int = 90,
) -> None:
    """CLI wrapper for generating HC access tokens."""
    generate_access_token(
        user_name=name,
        user_email=email,
        notes=notes,
        expires_days=expires,
    )


if __name__ == "__main__":
    tyro.cli(main)

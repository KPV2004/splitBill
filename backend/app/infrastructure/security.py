"""Password hashing with the standard library's scrypt (memory-hard, per-user salt).
Stored as `scrypt$<n>$<r>$<p>$<salt>$<hash>` so parameters can be raised later."""

import asyncio
import base64
import hashlib
import hmac
import secrets

_N = 2**15
_R = 8
_P = 1
_DKLEN = 32
_MAXMEM = 64 * 1024 * 1024  # n=2**15, r=8 needs 32 MiB, above hashlib's default limit


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def _derive(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, maxmem=_MAXMEM, dklen=_DKLEN)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = _derive(password, salt, _N, _R, _P)
    return f"scrypt${_N}${_R}${_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest)
        actual = _derive(password, base64.b64decode(salt), int(n), int(r), int(p))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


class ScryptPasswordHasher:
    """Runs the CPU-heavy derivation off the event loop."""

    async def hash(self, password: str) -> str:
        return await asyncio.to_thread(hash_password, password)

    async def verify(self, password: str, password_hash: str) -> bool:
        return await asyncio.to_thread(verify_password, password, password_hash)

"""Manifest file parsing and glob matching."""

import fnmatch
import json
from pathlib import Path
from typing import List, Set


class Manifest:
    """Parses and queries .allhands-manifest.json."""

    def __init__(self, allhands_root: Path):
        self.allhands_root = allhands_root
        self.manifest_path = allhands_root / ".allhands-manifest.json"
        self._data = self._load()

    def _load(self) -> dict:
        if not self.manifest_path.exists():
            raise FileNotFoundError(f"Manifest not found: {self.manifest_path}")
        with open(self.manifest_path) as f:
            return json.load(f)

    @property
    def distribute_patterns(self) -> List[str]:
        return self._data.get("distribute", [])

    @property
    def internal_patterns(self) -> List[str]:
        return self._data.get("internal", [])

    @property
    def exclude_patterns(self) -> List[str]:
        return self._data.get("exclude", [])

    def is_excluded(self, path: str) -> bool:
        """Check if path matches any exclude pattern."""
        for pattern in self.exclude_patterns:
            if self._matches(path, pattern):
                return True
        return False

    def is_distributable(self, path: str) -> bool:
        """Check if path matches any distribute pattern."""
        for pattern in self.distribute_patterns:
            if self._matches(path, pattern):
                return True
        return False

    def is_internal(self, path: str) -> bool:
        """Check if path matches any internal pattern."""
        for pattern in self.internal_patterns:
            if self._matches(path, pattern):
                return True
        return False

    def _matches(self, path: str, pattern: str) -> bool:
        """Match path against glob pattern."""
        # Handle ** patterns
        if "**" in pattern:
            # Convert ** to recursive match
            parts = pattern.split("**")
            if len(parts) == 2:
                prefix, suffix = parts
                prefix = prefix.rstrip("/")
                suffix = suffix.lstrip("/")
                if path.startswith(prefix):
                    remaining = path[len(prefix):].lstrip("/")
                    if not suffix:
                        return True
                    return fnmatch.fnmatch(remaining, f"*{suffix}") or fnmatch.fnmatch(remaining, f"*/{suffix}")
        return fnmatch.fnmatch(path, pattern)

    def get_distributable_files(self) -> Set[Path]:
        """Get all files that should be distributed."""
        files = set()
        for pattern in self.distribute_patterns:
            if "**" in pattern:
                # Recursive glob
                base = pattern.split("**")[0].rstrip("/")
                base_path = self.allhands_root / base if base else self.allhands_root
                if base_path.exists():
                    for p in base_path.rglob("*"):
                        if p.is_file():
                            rel = p.relative_to(self.allhands_root)
                            str_rel = str(rel)
                            if self.is_distributable(str_rel) and not self.is_excluded(str_rel):
                                files.add(rel)
            else:
                # Direct file or simple glob
                for p in self.allhands_root.glob(pattern):
                    if p.is_file():
                        rel = p.relative_to(self.allhands_root)
                        if not self.is_excluded(str(rel)):
                            files.add(rel)
        return files


def load_ignore_patterns(target_root: Path) -> List[str]:
    """Load patterns from .allhandsignore file."""
    ignore_file = target_root / ".allhandsignore"
    if not ignore_file.exists():
        return []

    patterns = []
    with open(ignore_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                patterns.append(line)
    return patterns


def is_ignored(path: str, patterns: List[str]) -> bool:
    """Check if path matches any ignore pattern."""
    for pattern in patterns:
        if fnmatch.fnmatch(path, pattern):
            return True
        if "**" in pattern:
            parts = pattern.split("**", 1)
            if len(parts) == 2:
                prefix, suffix = parts
                prefix = prefix.rstrip("/")
                suffix = suffix.lstrip("/")
                if path.startswith(prefix) if prefix else True:
                    remaining = path[len(prefix):].lstrip("/") if prefix else path
                    if not suffix:
                        return True
                    if fnmatch.fnmatch(remaining, f"*{suffix}") or fnmatch.fnmatch(
                        remaining, f"*/{suffix}"
                    ):
                        return True
    return False

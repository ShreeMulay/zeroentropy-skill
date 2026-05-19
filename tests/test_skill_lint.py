#!/usr/bin/env python3
"""
Test suite for validating the ZeroEntropy skill structure and content.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).parent.parent
REQUIRED_SECTIONS = [
    "## Quick Routing",
    "## Setup",
    "## 1. Embedding",
    "## 2. Reranking",
    "## 3. Indexing & Search",
    "## 4. RAG Pipeline Recipe",
    "## 5. Pitfalls",
    "## Reference Tables",
]

REQUIRED_PITFALL_KEYWORDS = [
    "list:",
    "ConflictError",
    "429",
    "zembed-1",
    "zerank-2",
    "zsearch",
    "latency",
    "ZEROENTROPY_API_KEY",
]

def test_skill_md_exists():
    """SKILL.md must exist."""
    skill_md = SKILL_DIR / "SKILL.md"
    assert skill_md.exists(), "SKILL.md not found"
    print("✓ SKILL.md exists")

def test_skill_md_frontmatter():
    """SKILL.md must have valid YAML frontmatter."""
    skill_md = SKILL_DIR / "SKILL.md"
    content = skill_md.read_text()
    
    # Check frontmatter
    assert content.startswith("---"), "Missing frontmatter start"
    parts = content.split("---", 2)
    assert len(parts) >= 3, "Invalid frontmatter structure"
    
    # Parse YAML
    import yaml
    frontmatter = yaml.safe_load(parts[1])
    assert "name" in frontmatter, "Missing 'name' in frontmatter"
    assert "description" in frontmatter, "Missing 'description' in frontmatter"
    assert frontmatter["name"] == "zeroentropy", f"Wrong name: {frontmatter['name']}"
    print("✓ Frontmatter valid")

def test_required_sections():
    """SKILL.md must contain all required sections."""
    skill_md = SKILL_DIR / "SKILL.md"
    content = skill_md.read_text()
    
    for section in REQUIRED_SECTIONS:
        assert section in content, f"Missing section: {section}"
    print(f"✓ All {len(REQUIRED_SECTIONS)} required sections present")

def test_pitfall_keywords():
    """SKILL.md must contain critical pitfall keywords."""
    skill_md = SKILL_DIR / "SKILL.md"
    content = skill_md.read_text()
    
    missing = []
    for keyword in REQUIRED_PITFALL_KEYWORDS:
        if keyword not in content:
            missing.append(keyword)
    
    assert not missing, f"Missing pitfall keywords: {missing}"
    print(f"✓ All {len(REQUIRED_PITFALL_KEYWORDS)} pitfall keywords present")

def test_skill_json():
    """skill.json must be valid JSON with required fields."""
    skill_json = SKILL_DIR / "skill.json"
    assert skill_json.exists(), "skill.json not found"
    
    with open(skill_json) as f:
        data = json.load(f)
    
    assert "name" in data, "Missing 'name' in skill.json"
    assert "version" in data, "Missing 'version' in skill.json"
    assert "description" in data, "Missing 'description' in skill.json"
    print("✓ skill.json valid")

def test_recipes_exist():
    """All recipe files must exist."""
    recipes_dir = SKILL_DIR / "recipes"
    expected = [
        "01-embedding.md",
        "02-indexing.md",
        "03-searching.md",
        "04-reranking.md",
        "05-rag-pipeline.md",
    ]
    
    for recipe in expected:
        path = recipes_dir / recipe
        assert path.exists(), f"Missing recipe: {recipe}"
    print(f"✓ All {len(expected)} recipes exist")

def test_examples_exist():
    """Example files must exist for both languages."""
    examples_dir = SKILL_DIR / "examples"
    
    # Python examples
    python_dir = examples_dir / "python"
    for i in range(1, 6):
        path = python_dir / f"{i:02d}_{['embed', 'index', 'search', 'rerank', 'rag_pipeline'][i-1]}.py"
        assert path.exists(), f"Missing Python example: {path.name}"
    
    # TypeScript examples
    ts_dir = examples_dir / "typescript"
    for i in range(1, 6):
        path = ts_dir / f"{i:02d}_{['embed', 'index', 'search', 'rerank', 'rag_pipeline'][i-1]}.ts"
        assert path.exists(), f"Missing TypeScript example: {path.name}"
    
    print("✓ All examples exist")

def test_schemas_valid():
    """JSON schemas must be valid."""
    schemas_dir = SKILL_DIR / "schemas"
    
    for schema_file in schemas_dir.glob("*.json"):
        with open(schema_file) as f:
            json.load(f)
    print("✓ All schemas valid JSON")

def test_code_fences_have_languages():
    """All code fences in SKILL.md must specify a language."""
    skill_md = SKILL_DIR / "SKILL.md"
    content = skill_md.read_text()
    
    # Find code fences without language
    pattern = r'```\s*\n'
    matches = re.findall(pattern, content)
    
    # Allow frontmatter and specific exceptions
    assert len(matches) <= 1, f"Found {len(matches)} code fences without language"
    print("✓ Code fences have language tags")

def main():
    """Run all tests."""
    tests = [
        test_skill_md_exists,
        test_skill_md_frontmatter,
        test_required_sections,
        test_pitfall_keywords,
        test_skill_json,
        test_recipes_exist,
        test_examples_exist,
        test_schemas_valid,
        test_code_fences_have_languages,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"✗ {test.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {test.__name__}: Unexpected error: {e}")
            failed += 1
    
    print(f"\n{'='*50}")
    print(f"Results: {passed} passed, {failed} failed")
    
    if failed > 0:
        sys.exit(1)
    print("All tests passed!")

if __name__ == "__main__":
    main()

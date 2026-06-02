#!/usr/bin/env python3
"""Root validation tests for v1.1.4 review remediation.

These tests intentionally validate repository metadata, documentation, schemas,
and standalone examples from the repository root. They are expected to fail
until the v1.1.4 remediation changes are applied outside of tests.
"""

import json
import re
from pathlib import Path


ROOT = Path(__file__).parent.parent
TARGET_VERSION = "1.1.4"
COMPARISON_OPERATORS = ("$gt", "$gte", "$lt", "$lte")


def read_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def skill_frontmatter(content: str) -> str:
    assert content.startswith("---"), "SKILL.md must start with YAML frontmatter"
    parts = content.split("---", 2)
    assert len(parts) == 3, "SKILL.md frontmatter must be delimited by ---"
    return parts[1]


def skill_frontmatter_version(content: str) -> str:
    frontmatter = skill_frontmatter(content)
    match = re.search(r'^\s*version:\s*["\']?([^"\'\n]+)["\']?\s*$', frontmatter, re.MULTILINE)
    assert match, "SKILL.md frontmatter must declare metadata.version"
    return match.group(1)


def skill_header_version(content: str) -> str:
    match = re.search(r"ZeroEntropy Skill v(\d+\.\d+\.\d+)", content)
    assert match, "SKILL.md header must include 'ZeroEntropy Skill vX.Y.Z'"
    return match.group(1)


def test_all_version_sources_are_consistent_at_1_1_4():
    """All package and skill version sources must agree on v1.1.4."""
    root_package = read_json(ROOT / "package.json")
    plugin_package = read_json(ROOT / "plugin" / "package.json")
    skill_json = read_json(ROOT / "skill.json")
    package_lock = read_json(ROOT / "package-lock.json")
    skill_md = read_text(ROOT / "SKILL.md")

    versions = {
        "package.json": root_package.get("version"),
        "plugin/package.json": plugin_package.get("version"),
        "skill.json": skill_json.get("version"),
        "SKILL.md frontmatter metadata.version": skill_frontmatter_version(skill_md),
        "SKILL.md header": skill_header_version(skill_md),
        "package-lock.json top-level version": package_lock.get("version"),
        "package-lock.json root package version": package_lock.get("packages", {}).get("", {}).get("version"),
    }

    mismatches = {source: version for source, version in versions.items() if version != TARGET_VERSION}
    assert not mismatches, f"Expected every version source to be {TARGET_VERSION}; got {mismatches}"


def test_plugin_package_lock_exists_for_plugin_npm_ci():
    """The plugin must have its own lockfile so `npm ci` works in plugin/."""
    assert (ROOT / "plugin" / "package-lock.json").is_file(), "Missing plugin/package-lock.json"


def markdown_docs() -> list[Path]:
    return sorted(
        path
        for path in ROOT.rglob("*.md")
        if "node_modules" not in path.parts
        and ".beads" not in path.parts
        and ".pytest_cache" not in path.parts
    )


def test_docs_use_opencode_singular_plugin_config_key():
    """Docs must use OpenCode's singular `plugin` key, not `plugins` JSON examples."""
    docs = markdown_docs()
    combined_docs = "\n".join(read_text(path) for path in docs)
    plugins_examples = [
        f"{path.relative_to(ROOT)} contains a JSON `plugins` key"
        for path in docs
        if re.search(r'"plugins"\s*:', read_text(path))
    ]

    failures = []
    if '"plugin"' not in combined_docs:
        failures.append("Docs must show the singular OpenCode config key `plugin`")
    if plugins_examples:
        failures.append("Docs must not show OpenCode JSON config examples using `plugins`: " + "; ".join(plugins_examples))

    assert not failures, "; ".join(failures)


def test_readme_does_not_contain_fake_plugin_marketplace_command():
    """README must not document the fake `/plugin marketplace` command."""
    readme = read_text(ROOT / "README.md")
    assert "/plugin marketplace" not in readme, "README contains fake `/plugin marketplace` command"


def schema_type_allows_number(schema: dict) -> bool:
    schema_type = schema.get("type")
    if schema_type == "number" or (isinstance(schema_type, list) and "number" in schema_type):
        return True

    for keyword in ("oneOf", "anyOf", "allOf"):
        if any(schema_type_allows_number(item) for item in schema.get(keyword, [])):
            return True

    return False


def test_metadata_filter_schema_allows_numeric_comparison_values():
    """Numeric comparison operators must accept numbers, not only strings."""
    schema = read_json(ROOT / "schemas" / "metadata-filter.json")
    filter_object_schemas = [
        item
        for item in schema.get("additionalProperties", {}).get("oneOf", [])
        if item.get("type") == "object"
    ]
    assert filter_object_schemas, "metadata-filter schema must define an object filter variant"

    properties = filter_object_schemas[0].get("properties", {})
    disallowed = [
        operator
        for operator in COMPARISON_OPERATORS
        if not schema_type_allows_number(properties.get(operator, {}))
    ]

    assert not disallowed, f"Comparison operators must allow numeric values: {disallowed}"


def test_standalone_index_examples_do_not_claim_immediate_readiness_without_polling():
    """Standalone index examples must not imply documents are query-ready immediately after add."""
    examples = [
        ROOT / "examples" / "python" / "02_index.py",
        ROOT / "examples" / "typescript" / "02_index.ts",
    ]

    offenders = []
    for example in examples:
        content = read_text(example)
        lower = content.lower()
        claims_immediate_readiness = "ready for querying" in lower or "documents ready" in lower
        polls_for_indexing = any(
            token in lower
            for token in ("get_status", "get_info", "index_status", "num_indexing_documents", "poll")
        )
        if claims_immediate_readiness and not polls_for_indexing:
            offenders.append(str(example.relative_to(ROOT)))

    assert not offenders, "Examples claim documents are immediately ready without polling: " + ", ".join(offenders)

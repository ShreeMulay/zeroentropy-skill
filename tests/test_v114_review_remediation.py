#!/usr/bin/env python3
"""Root validation tests for review remediation.

These tests intentionally validate repository metadata, documentation, schemas,
and standalone examples from the repository root. They are expected to fail
until review remediation changes are applied outside of tests.
"""

import json
import re
from pathlib import Path


ROOT = Path(__file__).parent.parent
TARGET_VERSION = "1.1.5"
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


def test_all_version_sources_are_consistent_at_target_version():
    """All package and skill version sources must agree on the target version."""
    root_package = read_json(ROOT / "package.json")
    plugin_package = read_json(ROOT / "plugin" / "package.json")
    skill_json = read_json(ROOT / "skill.json")
    package_lock = read_json(ROOT / "package-lock.json")
    plugin_package_lock = read_json(ROOT / "plugin" / "package-lock.json")
    skill_md = read_text(ROOT / "SKILL.md")

    versions = {
        "package.json": root_package.get("version"),
        "plugin/package.json": plugin_package.get("version"),
        "skill.json": skill_json.get("version"),
        "SKILL.md frontmatter metadata.version": skill_frontmatter_version(skill_md),
        "SKILL.md header": skill_header_version(skill_md),
        "package-lock.json top-level version": package_lock.get("version"),
        "package-lock.json root package version": package_lock.get("packages", {}).get("", {}).get("version"),
        "plugin/package-lock.json top-level version": plugin_package_lock.get("version"),
        "plugin/package-lock.json root package version": plugin_package_lock.get("packages", {}).get("", {}).get("version"),
    }

    mismatches = {source: version for source, version in versions.items() if version != TARGET_VERSION}
    assert not mismatches, f"Expected every version source to be {TARGET_VERSION}; got {mismatches}"


def test_plugin_package_lock_exists_for_plugin_npm_ci():
    """The plugin must have its own lockfile so `npm ci` works in plugin/."""
    assert (ROOT / "plugin" / "package-lock.json").is_file(), "Missing plugin/package-lock.json"


def test_ci_runs_full_root_pytest_regression_suite():
    """CI must run all repository pytest tests, not only the skill lint smoke test."""
    workflows = {
        ".woodpecker.yml": read_text(ROOT / ".woodpecker.yml"),
        ".github/workflows/ci.yml": read_text(ROOT / ".github" / "workflows" / "ci.yml"),
    }

    missing = [
        name
        for name, content in workflows.items()
        if not re.search(r"(?:python(?:3)?\s+-m\s+pytest|pytest)\s+tests/?(?:\s|$|-)", content)
    ]

    assert not missing, "CI workflows must run full root pytest suite: " + ", ".join(missing)


def test_release_workflow_builds_and_packages_functional_plugin_artifact():
    """Release tarball must include a built plugin entrypoint and validate lockfile versions."""
    workflow = read_text(ROOT / ".github" / "workflows" / "release.yml")

    required_patterns = {
        "plugin npm ci": r"cd\s+plugin|working-directory:\s*\.?/?plugin",
        "plugin build": r"npm\s+run\s+build",
        "plugin dist packaged": r"plugin/dist",
        "plugin lock version checked": r"plugin/package-lock\.json",
    }
    missing = [label for label, pattern in required_patterns.items() if not re.search(pattern, workflow)]

    assert not missing, "Release workflow is missing: " + ", ".join(missing)


def test_release_workflow_grants_contents_write_permission_for_github_releases():
    """GitHub release creation requires GITHUB_TOKEN contents: write permission."""
    import yaml

    workflow = yaml.safe_load(read_text(ROOT / ".github" / "workflows" / "release.yml"))
    workflow_permissions = workflow.get("permissions") or {}
    release_job_permissions = workflow.get("jobs", {}).get("release", {}).get("permissions") or {}
    contents_permission = release_job_permissions.get("contents") or workflow_permissions.get("contents")

    assert contents_permission == "write", "Release workflow must grant GITHUB_TOKEN contents: write"


def test_readme_release_instructions_use_current_version_and_forgejo_first():
    """Release docs should not point at stale tags or GitHub-only pushes."""
    readme = read_text(ROOT / "README.md")
    release_section = readme.split("## Releases & Packages", 1)[-1]

    assert "v1.1.0" not in release_section, "README release instructions still use stale v1.1.0 tag"
    assert "git push forgejo" in release_section, "Release instructions must push Forgejo first"
    assert "git push origin" in release_section, "Release instructions should also push the GitHub mirror"


def test_changelog_has_unreleased_section_for_next_changes():
    """CONTRIBUTING.md tells users to add changes under [Unreleased]."""
    changelog = read_text(ROOT / "CHANGELOG.md")
    assert re.search(r"^## \[Unreleased\]", changelog, re.MULTILINE), "CHANGELOG.md is missing ## [Unreleased]"


def test_root_gitignore_covers_common_generated_and_secret_files():
    """Root ignore rules should protect generated caches and secrets from accidental commits."""
    gitignore = read_text(ROOT / ".gitignore")
    required = [".pytest_cache/", "*.pyc", ".env", "*.log", ".DS_Store", "coverage/"]
    missing = [pattern for pattern in required if pattern not in gitignore]

    assert not missing, "Root .gitignore missing patterns: " + ", ".join(missing)


def test_openspec_has_no_stale_active_markdown_changes():
    """Completed OpenSpec changes belong in openspec/changes/archive."""
    changes_dir = ROOT / "openspec" / "changes"
    active_markdown = sorted(
        path.relative_to(ROOT).as_posix()
        for path in changes_dir.glob("*.md")
    )

    assert not active_markdown, "Stale active OpenSpec markdown changes must be archived: " + ", ".join(active_markdown)


def test_project_spec_documents_forgejo_woodpecker_ci():
    """Project overview should reflect Forgejo/Woodpecker as the primary CI path."""
    project_md = read_text(ROOT / "openspec" / "project.md")
    assert "Woodpecker" in project_md, "openspec/project.md must mention Woodpecker CI"
    assert "Forgejo" in project_md, "openspec/project.md must mention Forgejo"


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

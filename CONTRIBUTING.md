# Contributing to ZeroEntropy Agent Skill

Thank you for your interest in contributing! This skill is designed to be used by AI agents across multiple platforms, so clarity and accuracy are paramount.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/zeroentropy-skill.git`
3. Install dependencies: `npm ci` and `pip install pyyaml pytest`
4. Run tests: `npm test` or `python tests/test_skill_lint.py`

## Types of Contributions

### Bug Fixes
- Fix incorrect API parameters or examples
- Correct pitfall documentation
- Update broken links

### New Recipes
- Add recipes for new ZeroEntropy features
- Follow the existing recipe structure (parameters, examples, best practices, pitfalls)
- Include both Python and TypeScript examples

### API Updates
- When ZeroEntropy releases new API versions or models
- Update SKILL.md version stamp
- Update examples and recipes
- Add changelog entry

### New Agent Support
- Add installation instructions for new agents
- Test compatibility

## Pull Request Process

1. **Create a branch**: `git checkout -b feat/your-feature-name`
2. **Make changes**: Edit relevant files
3. **Run validation**:
   ```bash
   python tests/test_skill_lint.py
   npm run lint
   ```
4. **Update CHANGELOG.md**: Add entry under `[Unreleased]`
5. **Commit**: Follow conventional commits format
   ```
   feat: add new recipe for advanced metadata filtering
   fix: correct list: prefix examples
   docs: update README with new agent support
   ```
6. **Push and create PR**: Include description of changes and testing done

## Review Criteria

Pull requests will be reviewed for:
- **Accuracy**: API parameters and examples must match ZeroEntropy documentation
- **Completeness**: Both Python and TypeScript examples where applicable
- **Pitfall coverage**: New features must include relevant pitfalls
- **Test coverage**: New code examples should be testable
- **Documentation**: README and recipes updated as needed

## Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes to recipes or API compatibility
- **MINOR**: New recipes, features, or non-breaking additions
- **PATCH**: Bug fixes, typo corrections, example updates

## Code of Conduct

- Be respectful and constructive
- Focus on agent usability — remember, AI agents are the primary consumers
- Prefer clarity over cleverness
- Document pitfalls prominently, not buried

## Questions?

- Open an issue for discussion
- Join the ZeroEntropy community: [Slack](https://go.zeroentropy.dev/slack) | [Discord](https://go.zeroentropy.dev/discord)

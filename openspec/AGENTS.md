# OpenSpec Conventions

## File Organization

- `project.md` — Project overview, scope, tech stack
- `changes/` — Active change proposals
- `changes/archive/` — Completed changes

## Change Proposal Format

Each change proposal is a markdown file with:

```markdown
# Change: <title>

## Status
[proposed | approved | in_progress | completed | rejected]

## Description
What is changing and why.

## Impact
Which files, recipes, or examples are affected.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

## Approval Process

1. Create proposal in `changes/`
2. Review for completeness and scope
3. Update status to `approved`
4. Implement changes
5. Update status to `completed`
6. Move to `changes/archive/`

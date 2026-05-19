# Issue Tracker

Issues and PRDs for this repo live in GitHub Issues for `dcatcherex/ai-sdk-rag`.

Use the `gh` CLI from inside the repo. It should infer the repository from `git remote -v`.

## Conventions

- Create an issue: `gh issue create --title "..." --body "..."`
- Read an issue: `gh issue view <number> --comments`
- List issues: `gh issue list --state open --json number,title,body,labels,comments`
- Comment on an issue: `gh issue comment <number> --body "..."`
- Apply labels: `gh issue edit <number> --add-label "..."`
- Close an issue: `gh issue close <number> --comment "..."`

When an agent skill says to publish to the issue tracker, create a GitHub issue.

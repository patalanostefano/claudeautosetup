---
name: claude-auto-setup
description: Auto-invoked when user says "setup claude for X", "configure session for", "install tools for", "I need a setup for", "configure my environment for". Sets up skills, MCPs, hooks, agents for a specific task using web search, then guides export back to main. Do NOT invoke for general questions.
user-invokable: true
---

# claude-auto-setup

You are setting up Claude Code for a specific task. Follow these phases **in order**. Never skip confirmation. Optimize for minimal token usage: run all searches in a single parallel turn, build the plan inline, confirm once, then execute.

---

## Phase 0 — Idempotency check

Before doing anything else, run:

```
Bash("ls .claude/skills/ .claude/agents/ 2>/dev/null")
```

If the output lists directories that match the user's intent (e.g. skill names containing keywords from the task), ask:

> "This project looks already configured for {matching items}. Re-run setup and overwrite? (yes/no)"

If the user says no, stop. If yes, proceed — existing files will be overwritten.

---

## Phase 1 — Understand the intent

Parse the user's request. Extract:
- **primary task** (e.g. "build a React app with Tailwind")
- **tech stack clues** (languages, frameworks, tools mentioned)
- **search keywords** (3-5 terms for web queries)
- **session name** (slugified, e.g. `react-tailwind-app`)

If the intent is ambiguous, ask ONE clarifying question before proceeding.

---

## Phase 2 — Search (ONE pass, all parallel)

Run ALL of the following in a **single turn** using WebSearch and WebFetch tools simultaneously. Do not run them sequentially.

**WebSearch queries:**
1. `claude code skill {primary_keywords} site:github.com`
2. `mcp server {primary_keywords} site:github.com`
3. `claude code plugin {tech_stack} site:github.com`

**WebFetch URLs:**
1. `https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json` — prompt: "List all plugin names and descriptions relevant to: {intent}"
2. `https://raw.githubusercontent.com/hesreallyhim/awesome-claude-code/main/README.md` — prompt: "Find skills, hooks, and agents relevant to: {intent}"
3. `https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md` — prompt: "Find MCP servers relevant to: {intent}, include install commands and required env vars"

**Extract from results:**
- candidate skills: name, repo URL, description
- candidate MCP servers: name, install command (`npx -y {package}` or `uvx {package}`), required env vars
- hook patterns that fit the workflow
- agent patterns that fit the workflow

**Fallback:** If any URL returns 404 or empty content, skip it silently. If no skill found for a component, mark it `needs-generation` — you will write it during Phase 5.

---

## Phase 3 — Build session plan (inline reasoning only)

Build this plan in your reasoning. Do **not** print raw JSON to the user.

```
SessionPlan {
  setupName: "{session-name}"
  skills: [
    { name, repoUrl, description, needsGeneration: bool }
  ]
  mcpServers: [
    { name, command, args[], envVarsRequired[] }
  ]
  hooks: [
    { event, matcher, description, script }
  ]
  agents: [
    { name, description, tools[], model }
  ]
  permissions: { allow[], deny[] }
  needsGeneration: [ "component — reason no existing skill found" ]
}
```

Keep the plan lean: prefer 1-2 high-quality skills over 5 mediocre ones. Only add MCPs that are genuinely useful and have active maintenance (check star count or last commit from search results). Only add hooks that automate something the user will actually want automated.

---

## Phase 4 — Confirm with user (MANDATORY — never skip)

Display the plan as a clear numbered list:

```
Setup plan for: "{intent}"

Isolation: git worktree worktree-{name} (your edits stay on a separate branch from main)

Skills to install:
  1. {skill-name} — {description} ({repo-url or "generate"})
  2. ...

MCP servers to add:
  1. {name} — {command} (needs env: {VARS})
  2. ...

Hooks:
  1. {event}/{matcher}: {description}

Agents:
  1. {name}: {description} (model: {model})

Permissions to add:
  1. {permission}

To generate (no existing skill found):
  1. {component} — will write SKILL.md inline

Proceed? (yes / edit N / abort)
```

Wait for user response.
- `yes` → proceed to Phase 5
- `edit 2` → ask what change to make to item 2, update plan, re-display
- `abort` → stop, print "Setup cancelled."
- No response or empty → ask again once, then abort

---

## Phase 5 — Execute (only after confirmation)

**First: register the session lock** (if `claudesetup` is installed):

```
Bash("which claudesetup > /dev/null 2>&1 && claudesetup setup '{intent}' 2>/dev/null && echo 'SESSION_REGISTERED' || echo 'NO_CLI'")
```

If the output is `SESSION_REGISTERED`, the session lock is created and all subsequent `_record-file` calls will track files for `export`/`erase`. If `NO_CLI`, continue without tracking — note this in Phase 7.

Save whether CLI is available: `CLI_AVAILABLE = (output === "SESSION_REGISTERED")`.

Work through each plan item. For each step, print a single line: `→ Installing: {name}...`

### Skills

For each skill:

**If `needsGeneration: false`** (found in search):
1. Try to fetch the SKILL.md by constructing candidate raw URLs from the repo URL:
   - `https://raw.githubusercontent.com/{owner}/{repo}/main/.claude/skills/{name}/SKILL.md`
   - `https://raw.githubusercontent.com/{owner}/{repo}/main/skills/{name}/SKILL.md`
   - `https://raw.githubusercontent.com/{owner}/{repo}/main/SKILL.md`
2. Use `WebFetch({url}, "Return the full SKILL.md content verbatim")` for the first candidate
3. If the response is empty, 404, or not a valid SKILL.md (no `---` frontmatter): fall through to generation

**If `needsGeneration: true` or fetch failed** — generate the SKILL.md (see generation rules below)

Then:
4. `Write` the content to `.claude/skills/{name}/SKILL.md`
5. If CLI available: `Bash("claudesetup _record-file '.claude/skills/{name}/SKILL.md' 2>/dev/null || true")`

**Generation rules:**
- Write a complete SKILL.md with proper frontmatter (`name`, `description`, `user-invokable: true`)
- `description` field **must** name the specific technology (e.g. "auto-invokes when working with dbt, running dbt commands, or building dbt models" — not generic phrases)
- Body: purpose, when to use, key commands/steps, 2-3 example prompts
- Keep under 200 lines; include only tools the skill actually needs in a comment, not in frontmatter

### MCP servers

For each MCP server:
1. `Bash("claude mcp add --transport stdio {name} -- npx -y {package}")`
   - Or for Python-based: `Bash("claude mcp add --transport stdio {name} -- uvx {package}")`
2. If env vars required: print `⚠ You need to set {VAR}=... in your shell before this MCP will work.`
3. If CLI available: `Bash("claudesetup _record-file '.mcp.json' 2>/dev/null || true")`

### Hooks

For each hook:
1. `Read(".claude/settings.json")` — use `{}` if missing
2. Add the hook entry under the appropriate event key (no duplicates)
3. If a shell script is needed, `Write` it to `.claude/hooks/{name}.sh`, then `Bash("chmod +x .claude/hooks/{name}.sh")`
4. `Write` updated settings.json back
5. If CLI available: `Bash("claudesetup _record-file '.claude/settings.json' 2>/dev/null || true")`

### Agents

For each agent, write `.claude/agents/{name}.md`:

```
---
name: {name}
description: {description}
tools: {comma-separated list}
model: {model}
---

{agent instructions}
```

If CLI available: `Bash("claudesetup _record-file '.claude/agents/{name}.md' 2>/dev/null || true")`

### Permissions

1. `Read(".claude/settings.json")`
2. Append to `permissions.allow` (no duplicates)
3. `Write` back

---

## Phase 6 — Verify

Run this single command:

```
Bash("echo '=== Skills ===' && ls .claude/skills/ 2>/dev/null || echo '(none)'; echo '=== Agents ===' && ls .claude/agents/ 2>/dev/null || echo '(none)'; echo '=== MCPs ===' && cat .mcp.json 2>/dev/null || echo '(no .mcp.json)'")
```

If anything expected is missing, re-execute that specific step only.

---

## Phase 7 — Session summary (always print this)

Print a clean summary after setup completes:

```
✓ Setup complete for: "{intent}"

What was configured:
  Skills:  {list} — trigger automatically when you work on {task}
  MCPs:    {list} — use with: "{example prompt using the MCP}"
  Hooks:   {list} — fires on {event}
  Agents:  {list} — invoke with: "use {agent-name} to..."

Your work is isolated in worktree: {worktreeName}
All edits go to branch: worktree-{name}

Note: .claude/settings.json and .mcp.json contain session config — they are safe to
      .gitignore at the project level, or claudesetup erase will clean them up for you.

Session commands:
  Resume later:    claudesetup resume {name}
  Export code:     claudesetup export {name}   ← only exports YOUR code, not .claude/ setup
  View session:    claudesetup status {name}
  Clean up:        claudesetup erase {name}
```

If `claudesetup` is **not** installed (CLI_AVAILABLE was false), append:

```
⚠ Session not tracked (claudesetup not installed).
  To enable resume/export/erase, install it and run:
    npm install -g claude-auto-setup
    claudesetup setup "{intent}"
  Then re-open Claude Code — setup files already written, only tracking will be added.
```

---

## Constraints

- Never run more than one web search pass (Phase 2 is the only search)
- Never call the Anthropic API from shell — Claude IS the AI layer
- Hooks must be pure shell — no API calls inside hook scripts
- Always confirm before writing any files (Phase 4 is mandatory)
- If the user is already in a worktree, skip worktree creation
- Prefer writing to `.claude/` (project scope) over `~/.claude/` (user scope) unless user asks otherwise

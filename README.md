# claude-auto-setup

Let Claude Code search the web and configure its own environment for your task — skills, MCPs, hooks, agents — then isolate all work in a git worktree and export only your code back to main.

---

## The idea

Setting up Claude Code properly for a non-trivial task is tedious. You need to know which skills exist, how to install MCP servers, which hooks make sense, which agents to wire up — and then configure all of it manually across multiple files before you can even start.

`claude-auto-setup` inverts that. You describe what you want to build. Claude Code searches the web itself (using its native `WebSearch` and `WebFetch` tools), finds the right skills, MCPs, hooks, and agents from GitHub and community registries, shows you a plan, and — after you confirm — configures everything automatically.

The result is an isolated, named session: a git worktree on its own branch with all the tooling installed. You work inside it, then export only your code changes back to main. The `.claude/` setup files never pollute your project.

The key insight is that **Claude is the search engine**. There's no vectorization, no external API, no hardcoded plugin catalog. Claude reads the raw search results and reasons over them — which means it finds things a keyword matcher would miss, handles new releases automatically, and falls back to generating a skill from scratch when nothing suitable exists.

---

## Install

```bash
npm install -g claude-auto-setup
```

The install automatically copies the skill to `~/.claude/skills/` so it's available in every project.

---

## Quick start

```bash
# 1. Create a session
claudesetup "build a production Elixir Phoenix backend for DICOM medical image processing"

# 2. Open Claude Code in the new worktree
claude --worktree elixir-phoenix-dicom

# 3. Trigger the skill inside Claude Code
/claude-auto-setup
# or: "setup claude for building a production Elixir Phoenix backend..."
# or: "configure session for..."

# Claude searches, shows you a plan, you confirm, it configures everything.

# 4. Work normally — all edits stay isolated on the worktree branch

# 5. Export only your code back to main when done
claudesetup export <session-id>
```

> **Important:** Typing `"build X"` alone will NOT trigger the skill — Claude Code will just start building.
> Always use `/claude-auto-setup` or a `"setup claude for..."` phrase to invoke it.

---

## How it works

The `SKILL.md` installed in `~/.claude/skills/claude-auto-setup/` is the brain. When triggered, it guides Claude through 7 phases in a single session — optimized to use the minimum possible tokens:

1. **Idempotency check** — skips setup if already configured for this task
2. **Understand intent** — extracts tech stack, keywords, session name
3. **Search** — one parallel pass: `WebSearch` for skills/MCPs on GitHub, `WebFetch` from curated lists (awesome-claude-code, awesome-mcp-servers, the official plugin marketplace). All in a single turn.
4. **Plan** — builds a `SessionPlan` inline from search results and displays it to you before touching anything
5. **Confirm** — mandatory gate; you can edit individual items or abort
6. **Execute** — writes SKILL.md files, installs MCPs via `claude mcp add`, merges hooks into `settings.json`, writes agent files. Generates skills from scratch when nothing suitable is found online.
7. **Summarize** — prints exactly what was installed and how to use each tool, plus session commands

The npm CLI handles what the skill can't do from inside a session: registering sessions before they start, persisting the lock file across Claude exits, managing the worktree lifecycle, and producing a setup-aware git diff on export.

---

## Worktree isolation

Every session lives in its own git worktree — a real branch with an independent working directory. All edits, including `.claude/` config, stay on that branch and never touch `main`.

This means:
- Your main branch is never polluted with session config
- You can run multiple sessions in parallel (different features, different contexts)
- `claudesetup export` knows exactly which files are setup vs. your code, because the session lock records every file written during configuration

```bash
claudesetup export my-session
# Shows: "12 source files changed, 0 config files included"
# Options: [m]erge / [s]quash / [c]ancel
```

If you close Claude Code and come back later, `claudesetup resume` recreates the worktree if needed and verifies the installed skills and MCPs are still intact before dropping you back in.

---

## Session commands

```bash
claudesetup list                    # all sessions with status
claudesetup status <session-id>     # full session details
claudesetup resume <session-id>     # resume (recreates worktree if needed, checks for drift)
claudesetup erase <session-id>      # clean up: delete files, restore settings, remove worktree
```

---

## CLI reference

```bash
claudesetup "intent"                # create session (shorthand)
claudesetup setup "intent"          # same, explicit subcommand
claudesetup list
claudesetup status <id>
claudesetup resume <id>
claudesetup export <id>
claudesetup erase <id>
```

Both `claudesetup` and `claude-auto-setup` are available as binary names.

---

## Integration with other packages

These packages are complementary, not competing. A `claude-auto-setup` session can install or reference any of them:

- **[coder-config](https://github.com/regression-io/coder-config)** — static MCP/rules configuration across multiple AI coding tools (Claude, Gemini, Codex); good as a base config layer
- **[@schuettc/claude-code-setup](https://www.npmjs.com/package/@schuettc/claude-code-setup)** — preset plugin installer for known domains (AWS, security, testing); useful fallback when search finds nothing
- **[claudekit](https://www.npmjs.com/package/claudekit)** — guardrails, checkpoints, and subagent workflows; can be installed as part of a session via the skill

---

> Not affiliated with Anthropic. Claude and Claude Code are trademarks of Anthropic.

## License

MIT

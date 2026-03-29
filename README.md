# claude-auto-setup

`claude-auto-setup` is shipped as package + claude skill.

One prompt more. That's all it costs to have Claude Code search the web, find the right skills, MCPs, hooks, and agents for your task, configure everything automatically, and put your work in an isolated environment you can resume, share, or discard cleanly.

 `claude-auto-setup` enables the creation of the best set of skills completely automatically without the need of manual setup and project engineering: those steps are crucial for a big project or enterprise repo but most of the times with the smaller tasks none of this is worht to be setted up. The package is seamlessy integrated with the skill and enable the creation of a whole set of configs, that can be coupled with one or more claude chats and remains completely isolated thanks to a dedicated worktree.

---

## 🚀 Installation

> Requires: Claude Code • Node.js 20+

```bash
npm install -g claude-auto-setup
# or: yarn global add claude-auto-setup
# or: pnpm add -g claude-auto-setup
```

The install automatically copies the skill to `~/.claude/skills/` so it's available in every project.

---

## ⚡ Quick start

```bash
# 1. Register a session
claudesetup "build a production Elixir Phoenix backend for DICOM medical image processing"

# 2. Open Claude Code in the isolated worktree
claude --worktree elixir-phoenix-dicom

# 3. Trigger the skill inside Claude Code
/claude-auto-setup
# or use a phrase: "setup claude for...", "configure session for...", "I need a setup for..."

# Claude searches GitHub and community registries, shows you a plan, you confirm, it installs everything.

# 4. Work normally — all edits stay on the worktree branch, never touching main

# 5. Export only your code when done
claudesetup export <session-id>
```

> **Note:** Typing `"build X"` alone will NOT trigger the skill — Claude will just start building.
> Use `/claude-auto-setup` or a `"setup claude for..."` phrase to invoke it explicitly.

---

## 🎯 What it does

```
Before: Need a dbt pipeline setup → Find skills manually, read docs, configure MCPs, write hooks, repeat
After:  One prompt → Claude searches live, shows plan, you confirm → everything installed in 2 minutes

Before: Setup files mixed into your project → .claude/ config committed to main, hard to clean up
After:  Worktree isolation → setup lives on its own branch, export strips it automatically

Before: Close Claude → lose context, have to reconfigure next session
After:  claudesetup resume → picks up the exact session, verifies config, drops you back in
```

---

## 🧠 How it works

The `SKILL.md` installed in `~/.claude/skills/claude-auto-setup/` is the brain. When triggered, it guides Claude through 7 phases — all in a single session, optimized for minimal token usage:

1. **Idempotency check** — skips setup if already configured for this task
2. **Understand intent** — extracts tech stack, keywords, session name from your description
3. **Search** — one parallel pass using Claude's native `WebSearch` and `WebFetch`: GitHub, awesome-claude-code, awesome-mcp-servers, the official plugin marketplace. All in a single turn.
4. **Plan** — builds a `SessionPlan` from results and displays it before touching anything
5. **Confirm** — mandatory gate; edit individual items or abort
6. **Execute** — writes SKILL.md files, installs MCPs via `claude mcp add`, merges hooks into `settings.json`, writes agent files. Falls back to generating a skill from scratch when nothing suitable is found.
7. **Summarize** — prints exactly what was installed, how to use each tool, and your session commands

The CLI handles what the skill can't do from inside a session: registering sessions, persisting the lock file across Claude exits, managing the worktree lifecycle, and producing a setup-aware diff on export.

---

## 🌿 Worktree isolation

Every session lives in its own git worktree — a real branch with an independent working directory. Your main branch is never touched.

```bash
claudesetup export my-session
# → 12 source files changed, 0 config files included
# → [m]erge / [s]quash / [c]ancel
```

The session lock records every file written during configuration. `export` uses that list to build the exclusion — so `.claude/` setup files are filtered out automatically, not by guesswork.

---

## 📦 Session commands

```bash
claudesetup list                    # all sessions with status
claudesetup status <session-id>     # full session details
claudesetup resume <session-id>     # resume (recreates worktree if needed, checks for drift)
claudesetup export <session-id>     # export code only, setup excluded
claudesetup erase <session-id>      # delete files, restore settings, remove worktree
```

---

## 📋 CLI reference

```bash
claudesetup "intent"                # create session (shorthand)
claudesetup setup "intent"          # same, explicit subcommand
claudesetup list
claudesetup status <id>
claudesetup resume <id>
claudesetup export <id>
claudesetup erase <id>
```

Both `claudesetup` and `claude-auto-setup` work as binary names.

---

## ❓ Getting help

```bash
claudesetup doctor                  # check installation and session state
```

**Skill not triggering?**
Use `/claude-auto-setup` explicitly rather than a phrase — slash commands are always reliable.

**Worktree missing after resume?**
`claudesetup resume` recreates it automatically from the lock file if the branch still exists.

**MCP not working after resume?**
Run `claudesetup status <id>` to see what was installed, then re-run `claude mcp add` for the specific server.

---

> Not affiliated with Anthropic. Claude and Claude Code are trademarks of Anthropic.

## License

MIT

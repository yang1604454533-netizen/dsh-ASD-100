# dsh-ste

Forces ASD-STE100 Simplified Technical English on every reply and every document.

## What it does

When the mode is on, the plugin adds an always-on section to the system prompt of
every request. The section holds the writing rules of simplified technical English:
20 words in a procedure sentence, 25 in a descriptive sentence, one instruction per
sentence, active voice, simple tenses, the condition before the command, one word
with one meaning, no semicolons, no em dashes, no contractions. A reply answers
first and uses prose only.

## Commands

- `/ste on` turns the mode on.
- `/ste off` turns the mode off.
- `/ste` reports the current state.

## State

The mode is one flag file: `~/.dsh/ste/.ste-active`. The plugin reads it on every
request, so all sessions share the state and a change takes effect at once. To turn
the mode off from outside the chat, delete the file.

## Where the rules come from

The plugin reads `~/.agents/skills/simple-english/SKILL.md` when that file exists, so
you can change the rules without a code change. When the file is absent, the plugin
uses a built-in rule set of nine lines. Both paths are in `lib/index.js`.

## Config

Two optional fields, set in the bundle patch that loads the plugin:

```yaml
- insert:
    - id: ste
      name: dsh-ste
      config:
        skillDir: /path/to/simple-english   # default: ~/.agents/skills/simple-english
        stateFile: /path/to/.ste-active     # default: ~/.dsh/ste/.ste-active
```

## Development

```sh
node --test test/ste.test.mjs
```

The plugin imports node builtins only. It has no dependencies.

## Files

- `lib/index.js` — the plugin: the prompt section, the command handler, the flag file.
- `cordis.patch.yml` — the bundle patch that loads it.
- `test/ste.test.mjs` — five tests.
- `awesome-dsh-plugin-entry.yml` — the list entry for the awesome-dsh-plugin PR.

## License

MIT

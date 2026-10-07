/**
 * dsh-ste — always-on ASD-STE100 simplified output for DSH.
 *
 * Two halves, one file:
 *  - a systemPrompt section that injects the simple-english skill body into every
 *    request when the mode is on;
 *  - a /ste command that flips the mode by creating or deleting one flag file.
 *
 * The flag file is the only state. Every prompt render re-reads it, so the mode is
 * shared by all sessions and takes effect without a restart.
 * ponytail: no UI panel, no per-skill toggles, no config schema. Add them when the
 * flag file stops being enough to drive the mode.
 */
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const name = 'ste';
export const inject = ['systemPrompt'];

const DEFAULT_SKILL_DIR = join(homedir(), '.agents', 'skills', 'simple-english');
const DEFAULT_STATE_FILE = join(homedir(), '.dsh', 'ste', '.ste-active');

const HEADER =
  'STE ACTIVE — write simplified English on the ASD-STE100 model in every reply and every document.';

const FALLBACK = [
  'Write plain English. Keep these rules.',
  '',
  '- A procedure sentence has 20 words at most. A descriptive sentence has 25 words at most.',
  '- One instruction per sentence. Use the imperative mood.',
  '- Use simple tenses and the active voice. Name the actor.',
  '- Put the condition before the command: "If the build fails, read the log."',
  '- Use can, will, and must only. Delete should, would, may, might, and could.',
  '- One word has one meaning in the whole document. Use "make sure that" for check, verify, confirm, ensure.',
  '- No semicolons, no em dashes, no contractions, no noun chains over three words.',
  '- State the fact. Delete words that carry no fact.',
  '- In replies: answer first, prose only. No headings, no bullets, no bold, no tables.',
].join('\n');

/** Drop a YAML frontmatter block. Returns the rule body only. */
export function stripFrontmatter(text) {
  return String(text ?? '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/** Rule body from the installed simple-english skill, or null when it is absent. */
export function readBody(skillDir) {
  try {
    const body = stripFrontmatter(readFileSync(join(skillDir, 'SKILL.md'), 'utf8')).trim();
    return body || null;
  } catch {
    return null;
  }
}

/** The always-on text. Empty string is not used here: the caller gates on isOn(). */
export function renderSection(skillDir) {
  return HEADER + '\n\n' + (readBody(skillDir) ?? FALLBACK);
}

export function isOn(stateFile = DEFAULT_STATE_FILE) {
  try {
    return readFileSync(stateFile, 'utf8').trim().toLowerCase() === 'on';
  } catch {
    return false;
  }
}

export function setOn(on, stateFile = DEFAULT_STATE_FILE) {
  if (on) {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, 'on', 'utf8');
  } else {
    try {
      unlinkSync(stateFile);
    } catch {
      // already off
    }
  }
}

/** '/ste' | '/ste on' | '/ste off' -> 'report' | 'on' | 'off'. Anything else -> null. */
export function parseCommand(text) {
  const match = String(text ?? '').trim().match(/^[/@$]ste(?:\s+(\S+))?$/i);
  if (!match) return null;
  const arg = (match[1] ?? '').toLowerCase();
  if (!arg) return 'report';
  return arg === 'on' || arg === 'off' ? arg : null;
}

export function extractContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((b) => typeof b?.text === 'string').map((b) => b.text).join('\n');
  }
  return '';
}

export function extractText(messages) {
  if (!Array.isArray(messages)) return '';
  return messages.map((m) => extractContent(m?.content)).filter(Boolean).join('\n').trim();
}

export function handleText(text, { stateFile = DEFAULT_STATE_FILE, logger } = {}) {
  const command = parseCommand(text);
  if (!command) return false;
  if (command === 'report') {
    logger?.info?.('[ste] 当前状态：' + (isOn(stateFile) ? 'on' : 'off'));
    return true;
  }
  setOn(command === 'on', stateFile);
  logger?.info?.('[ste] 已' + (command === 'on' ? '开启' : '关闭') + ' ASD-STE100 简化输出');
  return true;
}

export function apply(ctx, config = {}) {
  const skillDir = config.skillDir || DEFAULT_SKILL_DIR;
  const stateFile = config.stateFile || DEFAULT_STATE_FILE;
  const logger = ctx.logger ?? console;

  if (!ctx.systemPrompt || typeof ctx.systemPrompt.section !== 'function') {
    logger.warn('[ste] 宿主没有 systemPrompt 服务，插件未挂载');
    return;
  }

  // order 55: after persona (0) and ponytail (50).
  ctx.systemPrompt.section({
    name: 'ste',
    order: 55,
    text: () => (isOn(stateFile) ? renderSection(skillDir) : ''),
  });

  const anyCtx = ctx.any ?? ctx;
  const run = (text) => {
    try {
      handleText(text, { stateFile, logger });
    } catch (err) {
      logger.warn('[ste] 命令处理失败：' + String(err));
    }
  };

  anyCtx.on('agent/pre-step', async (...args) => {
    const [payload, next] = args;
    run(extractText(payload?.messages));
    return await next();
  });

  anyCtx.on('session/event', (...args) => {
    const [, event] = args;
    if (event?.type === 'user/message') run(extractContent(event.data?.content));
  });

  logger.info(
    '[ste] 已挂载 — ' + (isOn(stateFile) ? '当前 on' : '当前 off，用 /ste on 开启') + '（skillDir: ' + skillDir + '）',
  );
}

export default { name, inject, apply };

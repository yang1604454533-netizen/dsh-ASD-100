import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { apply, extractText, isOn, parseCommand, readBody, renderSection, resolveSkillDir, setOn, stripFrontmatter } from '../lib/index.js';

test('stripFrontmatter drops the YAML block', () => {
  assert.equal(stripFrontmatter('---\nname: x\n---\nbody\n'), 'body\n');
  assert.equal(stripFrontmatter('body only'), 'body only');
});

test('parseCommand reads the /asd100 forms and ignores the rest', () => {
  assert.equal(parseCommand('/asd100 on'), 'on');
  assert.equal(parseCommand('/ASD-100 OFF'), 'off');
  assert.equal(parseCommand('/asd100'), 'report');
  assert.equal(parseCommand('/asd100 maybe'), null);
  assert.equal(parseCommand('asd100 on'), null);
  assert.equal(parseCommand('/ste on'), null);
  assert.equal(parseCommand('/ponytail full'), null);
  assert.equal(parseCommand(''), null);
});

test('extractText joins the text blocks of a message list', () => {
  assert.equal(extractText([{ content: '/asd100 on' }, { content: [{ type: 'text', text: 'more' }] }]), '/asd100 on\nmore');
});

test('resolveSkillDir takes the first candidate that has a SKILL.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asd-100-skill-'));
  try {
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: x\n---\nrules\n');
    assert.equal(resolveSkillDir(dir), dir, 'the explicit dir wins');
    const fallback = resolveSkillDir(join(dir, 'missing'));
    assert.notEqual(fallback, join(dir, 'missing'), 'a missing dir is not returned');
    assert.ok(readBody(fallback), 'the fallback dir holds rules');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the packaged rules ship with the plugin', () => {
  const text = renderSection(resolveSkillDir(join(tmpdir(), 'asd-100-missing-skill')));
  assert.match(text, /The rules come from ASD-STE100/, 'the vendored SKILL.md must be found');
});

test('renderSection falls back to the built-in rules', () => {
  assert.match(renderSection(join(tmpdir(), 'asd-100-nowhere')), /20 words at most/);
});

test('the flag file gates the injected section', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asd-100-'));
  const stateFile = join(dir, 'nested', '.active');
  try {
    const sections = [];
    apply(
      {
        logger: { info() {}, warn() {}, debug() {} },
        systemPrompt: { section: (o) => sections.push(o) },
        on() {},
      },
      { stateFile, skillDir: join(dir, 'missing-skill') },
    );
    assert.equal(sections.length, 1);
    assert.equal(sections[0].text(), '', 'off by default');
    setOn(true, stateFile);
    assert.equal(isOn(stateFile), true);
    const on = sections[0].text();
    assert.match(on, /^STE ACTIVE/);
    assert.match(on, /The rules come from ASD-STE100/, 'the shipped rules are used when the configured dir is missing');
    setOn(false, stateFile);
    assert.equal(sections[0].text(), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

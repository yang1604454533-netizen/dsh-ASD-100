import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { apply, extractText, isOn, parseCommand, readBody, renderSection, setOn, stripFrontmatter } from '../lib/index.js';

test('stripFrontmatter drops the YAML block', () => {
  assert.equal(stripFrontmatter('---\nname: x\n---\nbody\n'), 'body\n');
  assert.equal(stripFrontmatter('body only'), 'body only');
});

test('parseCommand reads the three forms and ignores the rest', () => {
  assert.equal(parseCommand('/ste on'), 'on');
  assert.equal(parseCommand('/STE OFF'), 'off');
  assert.equal(parseCommand('/ste'), 'report');
  assert.equal(parseCommand('/ste maybe'), null);
  assert.equal(parseCommand('ste on'), null);
  assert.equal(parseCommand('/ponytail full'), null);
  assert.equal(parseCommand(''), null);
});

test('extractText joins the text blocks of a message list', () => {
  assert.equal(extractText([{ content: '/ste on' }, { content: [{ type: 'text', text: 'more' }] }]), '/ste on\nmore');
});

test('the flag file gates the injected section', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ste-'));
  const stateFile = join(dir, 'nested', '.ste-active');
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
    assert.match(on, /ASD-STE100|plain English/, 'falls back to the built-in rules when the skill is missing');
    setOn(false, stateFile);
    assert.equal(sections[0].text(), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readBody returns null for a missing skill dir', () => {
  assert.equal(readBody(join(tmpdir(), 'dsh-ste-nope')), null);
  assert.match(renderSection(join(tmpdir(), 'dsh-ste-nope')), /20 words at most/);
});

import { describe, it, expect } from 'vitest';
import {
  registerCodeLanguage,
  resolveCodeLanguage,
  tokenizeCode,
} from '../src/js/code-syntax.js';

// The text parts of a token list, concatenated, must reconstruct the source —
// the overlay relies on this to stay aligned with the textarea.
const rebuilt = (tokens) => tokens.map((t) => t.text).join('');
const toks = (tokens, tok) => tokens.filter((t) => t.tok === tok).map((t) => t.text);

describe('built-in grammars', () => {
  it('sql: keywords, strings, numbers, comments; reconstructs exactly', () => {
    const src = "SELECT id FROM members WHERE name = 'ann' -- note\nLIMIT 10";
    const tokens = tokenizeCode('sql', src);
    expect(rebuilt(tokens)).toBe(src);
    expect(toks(tokens, 'keyword')).toEqual(
      expect.arrayContaining(['SELECT', 'FROM', 'WHERE', 'LIMIT']),
    );
    expect(toks(tokens, 'string')).toContain("'ann'");
    expect(toks(tokens, 'number')).toContain('10');
    expect(toks(tokens, 'comment')).toContain('-- note');
  });

  it('sql: lower-case keywords are recognised (case-insensitive)', () => {
    const tokens = tokenizeCode('sql', 'select 1');
    expect(toks(tokens, 'keyword')).toContain('select');
  });

  it('json: object keys are `property`, values keep their type; reconstructs', () => {
    const src = '{"name": "ann", "age": 30, "ok": true}';
    const tokens = tokenizeCode('json', src);
    expect(rebuilt(tokens)).toBe(src);
    expect(toks(tokens, 'property')).toEqual(['"name"', '"age"', '"ok"']);
    expect(toks(tokens, 'string')).toContain('"ann"');
    expect(toks(tokens, 'number')).toContain('30');
    expect(toks(tokens, 'keyword')).toContain('true');
  });

  it('yaml: keys are `property`, comments and quoted scalars; reconstructs', () => {
    const src = 'name: ann\nage: 30 # years\ngreet: "hi"';
    const tokens = tokenizeCode('yaml', src);
    expect(rebuilt(tokens)).toBe(src);
    expect(toks(tokens, 'property')).toEqual(expect.arrayContaining(['name', 'age', 'greet']));
    expect(toks(tokens, 'comment')).toContain('# years');
    expect(toks(tokens, 'string')).toContain('"hi"');
  });

  it('html: tag/attribute/string classification; reconstructs', () => {
    const src = '<a href="/x" class=\'btn\'>go</a><!-- c -->';
    const tokens = tokenizeCode('html', src);
    expect(rebuilt(tokens)).toBe(src);
    expect(toks(tokens, 'tag')).toEqual(expect.arrayContaining(['<a', '>', '</a', '>']));
    expect(toks(tokens, 'attribute')).toEqual(expect.arrayContaining(['href', 'class']));
    expect(toks(tokens, 'string')).toEqual(expect.arrayContaining(['"/x"', "'btn'"]));
    expect(toks(tokens, 'comment')).toContain('<!-- c -->');
  });

  it('aliases yml/xml resolve to a grammar', () => {
    expect(resolveCodeLanguage('yml')).toBeTypeOf('function');
    expect(resolveCodeLanguage('xml')).toBeTypeOf('function');
  });
});

describe('tokenizeCode safety', () => {
  it('returns null for an unknown language', () => {
    expect(tokenizeCode('does-not-exist', 'x')).toBeNull();
    expect(tokenizeCode(undefined, 'x')).toBeNull();
  });

  it('declines a tokenizer whose tokens do not reconstruct the source', () => {
    const off = registerCodeLanguage('bad-recon', () => [{ tok: 'keyword', text: 'DIFFERENT' }]);
    expect(tokenizeCode('bad-recon', 'SELECT')).toBeNull();
    off();
  });

  it('declines a throwing or non-array tokenizer', () => {
    const offThrow = registerCodeLanguage('boom', () => {
      throw new Error('nope');
    });
    const offBad = registerCodeLanguage('not-array', () => ({}));
    expect(tokenizeCode('boom', 'x')).toBeNull();
    expect(tokenizeCode('not-array', 'x')).toBeNull();
    offThrow();
    offBad();
  });
});

describe('registerCodeLanguage', () => {
  it('registers a dialect tokenizer, resolved case-insensitively', () => {
    const off = registerCodeLanguage('TQL-SQL', (text) => [{ tok: 'meta', text }]);
    const tokens = tokenizeCode('tql-sql', '/*%if x */');
    expect(tokens).toEqual([{ tok: 'meta', text: '/*%if x */' }]);
    off();
    expect(resolveCodeLanguage('tql-sql')).toBeNull();
  });

  it('lets a registration override a built-in, and restores it on unregister', () => {
    const builtin = resolveCodeLanguage('sql');
    const off = registerCodeLanguage('sql', (text) => [{ tok: 'meta', text }]);
    expect(resolveCodeLanguage('sql')).not.toBe(builtin);
    off();
    expect(resolveCodeLanguage('sql')).toBe(builtin);
  });

  it('validates its arguments', () => {
    expect(() => registerCodeLanguage('', () => [])).toThrow(TypeError);
    expect(() => registerCodeLanguage('x', null)).toThrow(TypeError);
  });
});

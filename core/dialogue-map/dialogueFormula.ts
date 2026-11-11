import type { DialogueScalar, DialogueTextBinding, DialogueTextBindings } from './dialogueMap.types.ts';

const precedence: Readonly<Record<string, number>> = {
  '||': 1, '&&': 2, '==': 3, '!=': 3, '>': 4, '>=': 4, '<': 4, '<=': 4,
  '+': 5, '-': 5, '*': 6, '/': 6, '%': 6,
};
type ValueType = 'number' | 'string' | 'boolean' | 'null';
type Expression = { offset: number } & (
  | { kind: 'literal'; value: DialogueScalar }
  | { kind: 'variable'; name: string; binding: DialogueTextBinding }
  | { kind: 'unary'; op: string; operand: Expression }
  | { kind: 'binary'; op: string; left: Expression; right: Expression }
);
export type DialogueFormula = { expression: Expression; variables: string[] };
type Token = { text: string; offset: number };
const tokenPattern = /\s*(\{[\p{L}\p{N}_-]{1,64}\}|"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|true\b|false\b|null\b|&&|\|\||==|!=|>=|<=|[()+*/%<>!-])/uy;

function fail(offset: number, message: string): never {
  throw new Error(`第 ${offset + 1} 列：${message}`);
}

export function compileDialogueFormula(
  source: string,
  bindings: DialogueTextBindings = {},
  typeOfBinding?: (binding: DialogueTextBinding) => ValueType | undefined,
): DialogueFormula {
  if (source.length > 2048) fail(2048, '公式不能超过 2048 个字符。');
  const tokens: Token[] = [];
  const lexer = new RegExp(tokenPattern);
  let offset = 0;
  while (offset < source.length) {
    if (!source.slice(offset).trim()) break;
    lexer.lastIndex = offset;
    const match = lexer.exec(source);
    if (!match) fail(offset + (source.slice(offset).match(/^\s*/)?.[0].length ?? 0), '无法识别的符号。');
    tokens.push({ text: match[1], offset: lexer.lastIndex - match[1].length });
    if (tokens.length > 256) fail(offset, '公式包含过多运算项。');
    offset = lexer.lastIndex;
  }
  tokens.push({ text: '', offset: source.length });
  const variables = new Set<string>();
  let cursor = 0;
  const parse = (minimum: number, depth: number): Expression => {
    const token = tokens[cursor++];
    const { text, offset } = token;
    if (depth > 64) fail(offset, '公式嵌套过深。');
    let left: Expression;
    if (text === '(') {
      left = parse(1, depth + 1);
      if (tokens[cursor].text !== ')') fail(tokens[cursor].offset, '缺少右括号。');
      cursor++;
    } else if (text === '!' || text === '-' || text === '+') {
      left = { kind: 'unary', op: text, operand: parse(7, depth + 1), offset };
    } else if (text.startsWith('{')) {
      const name = text.slice(1, -1);
      if (!Object.hasOwn(bindings, name)) fail(offset, `变量「${name}」未声明。`);
      const binding = bindings[name];
      if (!binding.key.trim() || binding.path.some(part => !part.trim())) fail(offset, `变量「${name}」的共享内存绑定不完整。`);
      variables.add(name);
      left = { kind: 'variable', name, binding: structuredClone(binding), offset };
    } else if (text === 'true' || text === 'false' || text === 'null' || text.startsWith('"') || /^[.\d]/.test(text)) {
      const value: DialogueScalar = /^[.\d]/.test(text) ? Number(text) : JSON.parse(text);
      if (typeof value === 'number' && !Number.isFinite(value)) fail(offset, '数字超出范围。');
      left = { kind: 'literal', value, offset };
    } else {
      fail(offset, '需要变量、常量或左括号。');
    }
    for (let next = tokens[cursor]; (precedence[next.text] ?? 0) >= minimum; next = tokens[cursor]) {
      cursor++;
      left = { kind: 'binary', op: next.text, left, right: parse(precedence[next.text] + 1, depth + 1), offset: next.offset };
    }
    return left;
  };
  const expression = parse(1, 0);
  if (tokens[cursor].text) fail(tokens[cursor].offset, '这里需要运算符或公式结束。');
  const check = (item: Expression): ValueType | undefined => {
    if (item.kind === 'variable') return typeOfBinding?.(item.binding);
    if (item.kind === 'literal') return item.value === null ? 'null' : typeof item.value as ValueType;
    const required = item.op === '!' || item.op === '&&' || item.op === '||' ? 'boolean' : 'number';
    if (item.kind === 'unary') {
      const operand = check(item.operand);
      if (operand && operand !== required) fail(item.offset, `「${item.op}」需要${required === 'boolean' ? '布尔值' : '数字'}。`);
      return required;
    }
    const left = check(item.left), right = check(item.right);
    if (item.op === '==' || item.op === '!=') {
      if (left && right && left !== right) fail(item.offset, '比较两侧的类型必须相同。');
      return 'boolean';
    }
    if ([left, right].some(type => type && type !== required)) fail(item.offset, `「${item.op}」两侧需要${required === 'boolean' ? '布尔值' : '数字'}。`);
    return precedence[item.op] >= 5 ? 'number' : 'boolean';
  };
  const result = check(expression);
  if (result && result !== 'boolean') fail(expression.offset, '判断公式的结果必须是布尔值。');
  return { expression, variables: [...variables] };
}

export function evaluateDialogueFormula(formula: DialogueFormula, read: (binding: DialogueTextBinding, name: string) => DialogueScalar | undefined): boolean {
  const values = new Map<string, DialogueScalar>();
  const boolean = (value: DialogueScalar, offset: number) => typeof value === 'boolean' ? value : fail(offset, '需要布尔值。');
  const number = (value: DialogueScalar, offset: number) => typeof value === 'number' && Number.isFinite(value) ? value : fail(offset, '需要有限数字。');
  const evaluate = (item: Expression): DialogueScalar => {
    if (item.kind === 'literal') return item.value;
    if (item.kind === 'variable') {
      if (values.has(item.name)) return values.get(item.name)!;
      const value = read(item.binding, item.name);
      if (value === undefined) fail(item.offset, `变量「${item.name}」不可读。`);
      values.set(item.name, value);
      return value;
    }
    if (item.kind === 'unary') {
      const operand = evaluate(item.operand);
      return item.op === '!' ? !boolean(operand, item.offset) : (item.op === '-' ? -1 : 1) * number(operand, item.offset);
    }
    const left = evaluate(item.left);
    if (item.op === '&&') return boolean(left, item.offset) && boolean(evaluate(item.right), item.offset);
    if (item.op === '||') return boolean(left, item.offset) || boolean(evaluate(item.right), item.offset);
    const right = evaluate(item.right);
    if (item.op === '==' || item.op === '!=') return typeof left === typeof right && (item.op === '==' ? left === right : left !== right);
    const a = number(left, item.offset), b = number(right, item.offset);
    switch (item.op) {
      case '>': return a > b;
      case '>=': return a >= b;
      case '<': return a < b;
      case '<=': return a <= b;
      case '+': return number(a + b, item.offset);
      case '-': return number(a - b, item.offset);
      case '*': return number(a * b, item.offset);
      case '/': return number(a / b, item.offset);
      case '%': return number(a % b, item.offset);
      default: return fail(item.offset, '未知运算符。');
    }
  };
  return boolean(evaluate(formula.expression), formula.expression.offset);
}

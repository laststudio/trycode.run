import * as monaco from 'monaco-editor';

const pythonKeywords = [
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for',
  'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None',
  'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try',
  'while', 'with', 'yield', 'match', 'case', 'type', 'async', 'await',
];

const pythonBuiltins = [
  'abs', 'aiter', 'all', 'anext', 'all', 'any', 'ascii', 'bin', 'bool',
  'breakpoint', 'bytearray', 'bytes', 'callable', 'chr', 'classmethod',
  'compile', 'complex', 'delattr', 'dict', 'dir', 'divmod', 'enumerate',
  'eval', 'exec', 'filter', 'float', 'format', 'frozenset', 'getattr',
  'globals', 'hasattr', 'hash', 'help', 'hex', 'id', 'input', 'int',
  'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals', 'map',
  'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord',
  'pow', 'print', 'property', 'range', 'repr', 'reversed', 'round',
  'set', 'setattr', 'slice', 'sorted', 'staticmethod', 'str', 'sum',
  'super', 'tuple', 'type', 'vars', 'zip', '__import__', 'len', 'range',
  'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed', 'any', 'all',
  'sum', 'min', 'max', 'abs', 'round', 'sorted', 'reversed', 'enumerate',
  'zip', 'map', 'filter', 'iter', 'next', 'isinstance', 'issubclass',
  'hasattr', 'getattr', 'setattr', 'delattr', 'vars', 'dir', 'type',
  'isinstance', 'issubclass', 'callable', 'compile', 'exec', 'eval',
  'open', 'input', 'print', 'repr', 'ascii', 'chr', 'ord', 'bin', 'hex',
  'oct', 'hash', 'id', 'iter', 'slice', 'property', 'classmethod',
  'staticmethod', 'property', 'property', 'super', 'type', 'object',
];

const pythonStdlib = [
  'os', 'sys', 'json', 're', 'math', 'random', 'datetime', 'collections',
  'itertools', 'functools', 'pathlib', 'typing', 'asyncio', 'logging',
  'argparse', 'subprocess', 'threading', 'multiprocessing', 'socket',
  'http', 'urllib', 'json', 'csv', 'xml', 'html', 'email', 'base64',
  'hashlib', 'hmac', 'secrets', 'uuid', 'dataclasses', 'enum', 'typing',
  'decimal', 'fractions', 'statistics', 'string', 'textwrap', 'unicodedata',
  'inspect', 'ast', 'dis', 'pickle', 'shelve', 'sqlite3', 'csv',
  'configparser', 'tomllib', 'yaml', 'requests', 'flask', 'django', 'fastapi', 'pydantic',
  'numpy', 'pandas', 'matplotlib', 'sklearn', 'torch', 'tensorflow',
];

const pythonSnippets = [
  {
    label: 'def',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'def ${1:function_name}(${2:params}):\n\t${3:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Define a function',
  },
  {
    label: 'class',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'class ${1:ClassName}:\n\tdef __init__(self${2:, params}):\n\t\t${3:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Define a class',
  },
  {
    label: 'if',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'if ${1:condition}:\n\t${2:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'If statement',
  },
  {
    label: 'elif',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'elif ${1:condition}:\n\t${2:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Elif statement',
  },
  {
    label: 'else',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'else:\n\t${1:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Else statement',
  },
  {
    label: 'for',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'for ${1:item} in ${2:iterable}:\n\t${3:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'For loop',
  },
  {
    label: 'while',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'while ${1:condition}:\n\t${2:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'While loop',
  },
  {
    label: 'try',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${3:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Try-except block',
  },
  {
    label: 'with',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'with ${1:expr} as ${2:var}:\n\t${3:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'With statement',
  },
  {
    label: 'lambda',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'lambda ${1:args}: ${2:expr}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Lambda function',
  },
  {
    label: 'async def',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'async def ${1:function_name}(${2:params}):\n\t${3:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Async function',
  },
  {
    label: 'async for',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'async for ${1:item} in ${2:iterable}:\n\t${3:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Async for loop',
  },
  {
    label: 'async with',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'async with ${1:expr} as ${2:var}:\n\t${3:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Async with statement',
  },
  {
    label: 'match',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'match ${1:subject}:\n\tcase ${2:pattern}:\n\t\t${3:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Match statement (Python 3.10+)',
  },
  {
    label: 'dataclass',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '@dataclass\nclass ${1:ClassName}:\n\t${2:field}: ${3:type}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Dataclass decorator',
  },
  {
    label: 'property',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '@property\ndef ${1:property_name}(self) -> ${2:type}:\n\treturn self.${3:_property_name}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Property decorator',
  },
  {
    label: 'classmethod',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '@classmethod\ndef ${1:method_name}(cls${2:, params}) -> ${3:return_type}:\n\t${4:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Classmethod decorator',
  },
  {
    label: 'staticmethod',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '@staticmethod\ndef ${1:method_name}(${2:params}) -> ${3:return_type}:\n\t${4:pass}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Staticmethod decorator',
  },
  {
    label: 'if __name__',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'if __name__ == "__main__":\n\t${1:main()}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Main guard',
  },
];

export class PythonProviderFactory {
  static createCompletionProvider(monacoInstance: typeof monaco): monaco.languages.CompletionItemProvider {
    return {
      triggerCharacters: ['.', '(', '[', '"', "'", '@', '#', ' ', '\t'],
      provideCompletionItems: (model: monaco.editor.ITextModel, position: monaco.Position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: word.endColumn,
        };

        const suggestions: monaco.languages.CompletionItem[] = [];

        // 关键字
        for (const kw of pythonKeywords) {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
            sortText: '0_' + kw,
          });
        }

        // 内置函数
        for (const fn of pythonBuiltins) {
          suggestions.push({
            label: fn,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: fn + '(${1:args})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            sortText: '1_' + fn,
            detail: 'Built-in function',
          });
        }

        // 标准库模块
        for (const mod of pythonStdlib) {
          suggestions.push({
            label: mod,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: mod,
            range,
            sortText: '2_' + mod,
            detail: 'Standard library module',
          });
        }

        // 代码片段
        for (const snippet of pythonSnippets) {
          suggestions.push({
            ...snippet,
            range,
            sortText: '3_' + snippet.label,
          });
        }

        return { suggestions };
      },
      resolveCompletionItem: (item: monaco.languages.CompletionItem) => item,
    };
  }

  static createHoverProvider(monacoInstance: typeof monaco): monaco.languages.HoverProvider {
    return {
      provideHover: (model: monaco.editor.ITextModel, position: monaco.Position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return undefined;

        const wordText = word.word;

        // 关键字文档
        if (pythonKeywords.includes(wordText)) {
          return {
            range: new monaco.Range(
              position.lineNumber, word.startColumn,
              position.lineNumber, word.endColumn
            ),
            contents: [
              { value: `**Keyword**: \`${wordText}\`` },
              { value: getKeywordDoc(wordText) },
            ],
          };
        }

        // 内置函数文档
        if (pythonBuiltins.includes(wordText)) {
          return {
            range: new monaco.Range(
              position.lineNumber, word.startColumn,
              position.lineNumber, word.endColumn
            ),
            contents: [
              { value: `**Built-in**: \`${wordText}()\`` },
              { value: getBuiltinDoc(wordText) },
            ],
          };
        }

        // 模块文档
        if (pythonStdlib.includes(wordText)) {
          return {
            range: new monaco.Range(
              position.lineNumber, word.startColumn,
              position.lineNumber, word.endColumn
            ),
            contents: [
              { value: `**Module**: \`${wordText}\`` },
              { value: `Standard library module: \`${wordText}\`` },
            ],
          };
        }

        return undefined;
      },
    };
  }

  static createDefinitionProvider(monacoInstance: typeof monaco): monaco.languages.DefinitionProvider {
    return {
      provideDefinition: (model: monaco.editor.ITextModel, position: monaco.Position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return undefined;

        // 简单实现：查找定义
        const text = model.getValue();
        const wordText = word.word;

        // 查找函数/类定义
        const patterns = [
          new RegExp(`^\\s*def\\s+${wordText}\\s*\\(`, 'gm'),
          new RegExp(`^\\s*class\\s+${wordText}\\s*[\(:]`),
          new RegExp(`^\\s*${wordText}\\s*=`),
          new RegExp(`^\\s*(?:async\\s+)?def\\s+${wordText}\\s*\\(`),
        ];

        for (const pattern of patterns) {
          let match;
          while ((match = pattern.exec(text)) !== null) {
            const lineNumber = text.substring(0, match.index).split('\n').length;
            return [{
              uri: model.uri,
              range: new monaco.Range(lineNumber, 1, lineNumber, match[0].length + 1),
            }];
          }
        }

        return undefined;
      },
    };
  }

  static createSignatureHelpProvider(monacoInstance: typeof monaco): monaco.languages.SignatureHelpProvider {
    return {
      signatureHelpTriggerCharacters: ['(', ','],
      provideSignatureHelp: (model: monaco.editor.ITextModel, position: monaco.Position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return undefined;

        // 常用内置函数签名
        const signatureMap: Record<string, monaco.languages.SignatureInformation[]> = {
          'print': [{
            label: 'print(*objects, sep=" ", end="\\n", file=sys.stdout, flush=False)',
            documentation: 'Print objects to the text stream file.',
            parameters: [
              { label: '*objects', documentation: 'Objects to print' },
              { label: 'sep=" "', documentation: 'Separator between objects' },
              { label: 'end="\\n"', documentation: 'String appended after last value' },
              { label: 'file=sys.stdout', documentation: 'File-like object' },
              { label: 'flush=False', documentation: 'Whether to flush' },
            ],
          }],
          'range': [{
            label: 'range(stop)',
            documentation: 'Return a range object from 0 to stop-1.',
            parameters: [{ label: 'stop', documentation: 'End of range (exclusive)' }],
          }, {
            label: 'range(start, stop[, step])',
            documentation: 'Return a range object from start to stop-1.',
            parameters: [
              { label: 'start', documentation: 'Start of range (inclusive)' },
              { label: 'stop', documentation: 'End of range (exclusive)' },
              { label: 'step=1', documentation: 'Step size' },
            ],
          }],
          'len': [{
            label: 'len(obj)',
            documentation: 'Return the length of an object.',
            parameters: [{ label: 'obj', documentation: 'Sized object' }],
          }],
          'open': [{
            label: 'open(file, mode="r", buffering=-1, encoding=None, errors=None, newline=None, closefd=True, opener=None)',
            documentation: 'Open file and return a file object.',
            parameters: [
              { label: 'file', documentation: 'Path-like object' },
              { label: 'mode="r"', documentation: 'Mode (r, w, a, etc.)' },
              { label: 'buffering=-1', documentation: 'Buffering policy' },
              { label: 'encoding=None', documentation: 'Text encoding' },
              { label: 'errors=None', documentation: 'Error handling' },
            ],
          }],
          'isinstance': [{
            label: 'isinstance(obj, classinfo)',
            documentation: 'Return whether object is an instance of class.',
            parameters: [
              { label: 'obj', documentation: 'Object to check' },
              { label: 'classinfo', documentation: 'Class or tuple of classes' },
            ],
          }],
        };

        const sigs = signatureMap[word.word];
        if (sigs) {
          return {
            value: {
              activeSignature: 0,
              activeParameter: 0,
              signatures: sigs,
            },
            dispose: () => {},
          };
        }

        return undefined;
      },
    };
  }
}

function getKeywordDoc(keyword: string): string {
  const docs: Record<string, string> = {
    'def': 'Define a function.',
    'class': 'Define a class.',
    'if': 'Conditional statement.',
    'for': 'Iterate over a sequence.',
    'while': 'Loop while condition is true.',
    'try': 'Exception handling block.',
    'async': 'Define async function.',
    'await': 'Wait for coroutine.',
    'match': 'Pattern matching (Python 3.10+).',
    'yield': 'Generator function.',
    'lambda': 'Anonymous function.',
    'with': 'Context manager.',
    'as': 'Alias import or exception alias.',
    'import': 'Import module.',
    'from': 'Import from module.',
    'return': 'Return from function.',
    'raise': 'Raise exception.',
    'assert': 'Assert condition.',
    'break': 'Exit loop.',
    'continue': 'Skip to next iteration.',
    'pass': 'Null statement.',
    'global': 'Global variable declaration.',
    'nonlocal': 'Non-local variable declaration.',
    'del': 'Delete object.',
    'is': 'Identity test.',
    'in': 'Membership test.',
    'not': 'Logical NOT.',
    'and': 'Logical AND.',
    'or': 'Logical OR.',
  };
  return docs[keyword] || '';
}

function getBuiltinDoc(func: string): string {
  const docs: Record<string, string> = {
    'print': 'Print to stdout.',
    'len': 'Return length of object.',
    'range': 'Generate sequence of numbers.',
    'enumerate': 'Iterate with index.',
    'zip': 'Combine iterables.',
    'map': 'Apply function to iterable.',
    'filter': 'Filter iterable.',
    'sorted': 'Return sorted list.',
    'sum': 'Sum of iterable.',
    'max': 'Maximum value.',
    'min': 'Minimum value.',
    'abs': 'Absolute value.',
    'round': 'Round number.',
    'open': 'Open file.',
    'input': 'Read input.',
    'type': 'Get object type.',
    'isinstance': 'Check instance type.',
    'issubclass': 'Check subclass.',
    'hasattr': 'Check attribute.',
    'getattr': 'Get attribute.',
    'setattr': 'Set attribute.',
    'dir': 'List attributes.',
    'help': 'Show help.',
  };
  return docs[func] || `Built-in function: ${func}()`;
}

export const PythonProviderFactory = {
  completion: createPythonCompletionProvider,
  hover: createPythonHoverProvider,
  definition: createPythonDefinitionProvider,
  signatureHelp: createPythonSignatureHelpProvider,
};
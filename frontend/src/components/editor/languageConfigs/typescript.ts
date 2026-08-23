import * as monaco from 'monaco-editor';

// TypeScript/JavaScript 关键字
const tsKeywords = [
  'abstract', 'as', 'asserts', 'async', 'await', 'break', 'case', 'catch',
  'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'from',
  'function', 'get', 'if', 'implements', 'import', 'in', 'instanceof',
  'interface', 'let', 'new', 'null', 'of', 'package', 'private', 'protected',
  'public', 'readonly', 'return', 'set', 'static', 'super', 'switch',
  'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while',
  'with', 'yield', 'as', 'async', 'await', 'of', 'in', 'type', 'typeof',
  'infer', 'keyof', 'extends', 'never', 'unknown', 'any', 'void', 'never',
  'constructor', 'declare', 'module', 'namespace', 'require', 'global',
  'target', 'this', 'await', 'async', 'await'
];

// TypeScript 内置类型
const tsBuiltinTypes = [
  'string', 'number', 'boolean', 'object', 'symbol', 'bigint', 'undefined',
  'null', 'void', 'never', 'unknown', 'any', 'never', 'Array', 'Promise',
  'Date', 'RegExp', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Function',
  'Object', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Promise',
  'Record', 'Partial', 'Required', 'Pick', 'Omit', 'Exclude', 'Extract',
  'NonNullable', 'ReturnType', 'InstanceType', 'Parameters', 'ConstructorParameters',
  'ThisParameterType', 'OmitThisParameter', 'ThisType', 'Uppercase', 'Lowercase',
  'Capitalize', 'Uncapitalize'
];

// TypeScript 内置工具类型
const tsUtilityTypes = [
  'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract',
  'NonNullable', 'ReturnType', 'InstanceType', 'Parameters', 'ConstructorParameters',
  'ThisParameterType', 'OmitThisParameter', 'ThisType', 'Uppercase', 'Lowercase',
  'Capitalize', 'Uncapitalize', 'Parameters', 'ConstructorParameters',
  'ReturnType', 'InstanceType', 'ThisParameterType', 'OmitThisParameter',
  'ThisType', 'Uppercase', 'Lowercase', 'Capitalize', 'Uncapitalize'
];

// TypeScript 关键字
const tsStandardKeywords = [
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'default', 'break', 'continue', 'try', 'catch',
  'finally', 'throw', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of',
  'void', 'delete', 'typeof', 'instanceof', 'void', 'await', 'yield'
];

// TypeScript 代码片段
const tsSnippets = [
  {
    label: 'fn',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'function ${1:name}(${2:params}): ${3:returnType} {\n\t${4:// body}\n\treturn ${5:value};\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Function declaration',
  },
  {
    label: 'afn',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'async function ${1:name}(${2:params}): Promise<${3:returnType}> {\n\t${4:// body}\n\treturn ${5:value};\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Async function declaration',
  },
  {
    label: 'arrow',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'const ${1:name} = (${2:params}): ${3:returnType} => {\n\t${4:// body}\n\treturn ${5:value};\n};',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Arrow function',
  },
  {
    label: 'aarrow',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'const ${1:name} = async (${2:params}): Promise<${3:returnType}> => {\n\t${4:// body}\n\treturn ${5:value};\n};',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Async arrow function',
  },
  {
    label: 'class',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'class ${1:ClassName} {\n\tconstructor(${2:params}) {\n\t\t${3:this.${4:prop} = ${4:prop};}\n\t}\n\n\t${5:methodName}(${6:params}): ${7:returnType} {\n\t\t${8:// body}\n\t}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Class declaration',
  },
  {
    label: 'interface',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'interface ${1:InterfaceName} {\n\t${2:property}: ${3:type};\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Interface declaration',
  },
  {
    label: 'type',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'type ${1:TypeName} = ${2:type};',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Type alias',
  },
  {
    label: 'enum',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'enum ${1:EnumName} {\n\t${2:VALUE1} = ${3:value},\n\t${4:VALUE2} = ${5:value},\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Enum declaration',
  },
  {
    label: 'if',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'if (${1:condition}) {\n\t${2:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'If statement',
  },
  {
    label: 'ifelse',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'if (${1:condition}) {\n\t${2:// body}\n} else {\n\t${3:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'If-else statement',
  },
  {
    label: 'for',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'for (const ${1:item} of ${2:array}) {\n\t${3:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'For-of loop',
  },
  {
    label: 'fori',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n\t${3:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'For loop with index',
  },
  {
    label: 'while',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'while (${1:condition}) {\n\t${2:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'While loop',
  },
  {
    label: 'try',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'try {\n\t${1:// body}\n} catch (${2:error}) {\n\t${3:// handle error}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Try-catch block',
  },
  {
    label: 'tryf',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'try {\n\t${1:// body}\n} catch (${2:error}) {\n\t${3:// handle error}\n} finally {\n\t${4:// cleanup}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Try-catch-finally block',
  },
  {
    label: 'switch',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'switch (${1:expression}) {\n\tcase ${2:value}:\n\t\t${3:// body}\n\t\tbreak;\n\tdefault:\n\t\t${4:// default}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Switch statement',
  },
  {
    label: 'destructuring',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'const { ${1:prop1}, ${2:prop2} } = ${3:object};',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Object destructuring',
  },
  {
    label: 'array-destructure',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'const [${1:first}, ${2:second}] = ${3:array};',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Array destructuring',
  },
  {
    label: 'import',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'import { ${1:name} } from \'${2:module}\';',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Named import',
  },
  {
    label: 'import-default',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'import ${1:name} from \'${2:module}\';',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Default import',
  },
  {
    label: 'export',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'export const ${1:name} = ${2:value};',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Named export',
  },
  {
    label: 'export-default',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'export default ${1:name};',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Default export',
  },
  {
    label: 'react-fc',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'interface ${1:ComponentName}Props {\n\t${2:prop}: ${3:type};\n}\n\nconst ${1:ComponentName}: React.FC<${1:ComponentName}Props> = ({ ${2:prop} }) => {\n\treturn (\n\t\t${4:// JSX}\n\t);\n};\n\nexport default ${1:ComponentName};',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'React Functional Component',
  },
  {
    label: 'useState',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'const [${1:state}, set${2:State}] = useState<${3:Type}>(${4:initialValue});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'useState hook',
  },
  {
    label: 'useEffect',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'useEffect(() => {\n\t${1:// effect}\n\treturn () => {\n\t\t${2:// cleanup}\n\t};\n}, [${3:dependencies}]);',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'useEffect hook',
  },
  {
    label: 'async-function',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'async function ${1:name}(${2:params}): Promise<${3:returnType}> {\n\t${4:// body}\n\treturn ${5:value};\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Async function',
  },
  {
    label: 'promise',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'new Promise<${1:Type}>((resolve, reject) => {\n\t${2:// body}\n\t${3:resolve(value)};\n});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Promise constructor',
  },
  {
    label: 'map',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:array}.map((${2:item}) => {\n\treturn ${3:expression};\n});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Array map',
  },
  {
    label: 'filter',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:array}.filter((${2:item}) => ${3:condition});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Array filter',
  },
  {
    label: 'reduce',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:array}.reduce((acc, ${2:item}) => ${3:expression}, ${4:initial});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Array reduce',
  },
  {
    label: 'console.log',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'console.log(${1:message});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Console log',
  },
];

// TypeScript 关键字
const tsKeywordsList = [
  'abstract', 'as', 'asserts', 'async', 'await', 'break', 'case', 'catch',
  'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'from',
  'function', 'get', 'if', 'implements', 'import', 'in', 'instanceof',
  'interface', 'let', 'new', 'null', 'of', 'package', 'private', 'protected',
  'public', 'readonly', 'return', 'set', 'static', 'super', 'switch',
  'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while',
  'with', 'yield', 'as', 'async', 'await', 'of', 'in', 'type', 'typeof',
  'infer', 'keyof', 'extends', 'never', 'unknown', 'any', 'void', 'never',
  'constructor', 'declare', 'module', 'namespace', 'require', 'global',
  'target', 'this', 'await', 'async', 'await'
];

// TypeScript 内置类型
const tsBuiltinTypesList = [
  'string', 'number', 'boolean', 'object', 'symbol', 'bigint', 'undefined',
  'null', 'void', 'never', 'unknown', 'any', 'never', 'Array', 'Promise',
  'Date', 'RegExp', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Function',
  'Object', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Promise',
  'Record', 'Partial', 'Required', 'Pick', 'Omit', 'Exclude', 'Extract',
  'NonNullable', 'ReturnType', 'InstanceType', 'Parameters', 'ConstructorParameters',
  'ThisParameterType', 'OmitThisParameter', 'ThisType', 'Uppercase', 'Lowercase',
  'Capitalize', 'Uncapitalize'
];

// TypeScript 标准库
const tsStdlib = [
  'console', 'Promise', 'fetch', 'JSON', 'Math', 'Date', 'RegExp', 'Error',
  'Array', 'Object', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Function',
  'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Promise', 'Proxy',
  'Reflect', 'Intl', 'DataView', 'ArrayBuffer', 'SharedArrayBuffer',
  'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array',
  'Int32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array',
  'console.log', 'console.error', 'console.warn', 'console.info', 'console.debug',
  'console.table', 'console.time', 'console.timeEnd', 'console.trace',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'setImmediate', 'clearImmediate', 'requestAnimationFrame', 'cancelAnimationFrame',
  'queueMicrotask', 'localStorage', 'sessionStorage', 'indexedDB',
  'window', 'document', 'navigator', 'location', 'history', 'screen',
  'fetch', 'Request', 'Response', 'Headers', 'FormData', 'URL', 'URLSearchParams',
  'Blob', 'File', 'FileReader', 'FormData', 'XMLHttpRequest', 'WebSocket',
  'Event', 'EventTarget', 'addEventListener', 'removeEventListener',
  'dispatchEvent', 'customElements', 'HTMLElement', 'Element', 'Node',
  'document', 'querySelector', 'querySelectorAll', 'getElementById',
  'getElementsByClassName', 'getElementsByTagName', 'createElement',
  'appendChild', 'removeChild', 'insertBefore', 'replaceChild',
  'cloneNode', 'contains', 'closest', 'matches', 'scrollIntoView',
  'addEventListener', 'removeEventListener', 'dispatchEvent',
  'requestAnimationFrame', 'cancelAnimationFrame', 'performance',
  'crypto', 'crypto.getRandomValues', 'crypto.subtle',
  'atob', 'btoa', 'encodeURI', 'encodeURIComponent', 'decodeURI',
  'decodeURIComponent', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'Number', 'String', 'Boolean', 'Object', 'Array', 'Date', 'RegExp',
  'Promise', 'Promise.all', 'Promise.race', 'Promise.allSettled',
  'Promise.any', 'Promise.resolve', 'Promise.reject', 'async', 'await',
  'try', 'catch', 'finally', 'throw', 'throw new Error', 'Error',
  'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'URIError',
  'EvalError', 'AggregateError', 'Error.prototype.stack',
  'console.assert', 'console.clear', 'console.count', 'console.dir',
  'console.group', 'console.groupEnd', 'console.groupCollapsed',
  'console.trace', 'console.time', 'console.timeEnd', 'console.timeLog',
  'performance.now', 'performance.mark', 'performance.measure',
  'performance.getEntriesByType', 'performance.getEntriesByName',
  'crypto.getRandomValues', 'crypto.randomUUID', 'crypto.subtle',
  'TextEncoder', 'TextDecoder', 'Blob', 'File', 'FileReader',
  'URL', 'URLSearchParams', 'FormData', 'Headers', 'Request', 'Response',
  'ReadableStream', 'WritableStream', 'TransformStream', 'ByteLengthQueuingStrategy',
  'CountQueuingStrategy', 'ReadableStreamDefaultController',
  'ReadableStreamDefaultReader', 'WritableStreamDefaultController',
  'WritableStreamDefaultWriter', 'TransformStreamDefaultController',
  'AudioContext', 'AudioBuffer', 'AudioBufferSourceNode', 'AudioDestinationNode',
  'AudioListener', 'AudioNode', 'AudioParam', 'AudioProcessingEvent',
  'BaseAudioContext', 'BiquadFilterNode', 'ChannelMergerNode',
  'ChannelSplitterNode', 'ConstantSourceNode', 'ConvolverNode', 'DelayNode',
  'DynamicsCompressorNode', 'GainNode', 'IIRFilterNode', 'MediaElementAudioSourceNode',
  'MediaStreamAudioDestinationNode', 'MediaStreamAudioSourceNode',
  'MediaStreamTrackAudioSourceNode', 'OscillatorNode', 'PannerNode',
  'PeriodicWave', 'StereoPannerNode', 'WaveShaperNode', 'OfflineAudioContext',
  'AudioWorklet', 'AudioWorkletNode', 'AudioWorkletProcessor', 'AudioWorkletGlobalScope',
];

/**
 * 创建 TypeScript/JavaScript Monaco 补全提供者
 */
export function createTypeScriptCompletionProvider(monacoInstance: typeof monaco) {
  const allKeywords = [...tsKeywordsList, ...tsBuiltinTypesList];
  const allSnippets = tsSnippets;

  return {
    triggerCharacters: ['.', '(', '[', '"', "'", '`', '@', '#', '<', ':', '=', '|', '&', '?', ' ', '\t'],
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
      for (const kw of tsKeywordsList) {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
          sortText: '0_' + kw,
        });
      }

      // 内置类型
      for (const type of tsBuiltinTypesList) {
        suggestions.push({
          label: type,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: type,
          range,
          sortText: '1_' + type,
          detail: 'Built-in type',
        });
      }

      // 标准库
      for (const std of tsStandardLibrary) {
        suggestions.push({
          label: std,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: std,
          range,
          sortText: '2_' + std,
          detail: 'Standard library',
        });
      }

      // 代码片段
      for (const snippet of tsSnippets) {
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

const tsStandardLibrary = [
  'console', 'Promise', 'fetch', 'JSON', 'Math', 'Date', 'RegExp', 'Error',
  'Array', 'Object', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Function',
  'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Promise', 'Proxy',
  'Reflect', 'Intl', 'DataView', 'ArrayBuffer', 'SharedArrayBuffer',
  'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array',
  'Int32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array',
  'console.log', 'console.error', 'console.warn', 'console.info', 'console.debug',
  'console.table', 'console.time', 'console.timeEnd', 'console.trace',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'setImmediate', 'clearImmediate', 'requestAnimationFrame', 'cancelAnimationFrame',
  'queueMicrotask', 'localStorage', 'sessionStorage', 'indexedDB',
  'window', 'document', 'navigator', 'location', 'history', 'screen',
  'fetch', 'Request', 'Response', 'Headers', 'FormData', 'URL', 'URLSearchParams',
  'Blob', 'File', 'FileReader', 'FormData', 'XMLHttpRequest', 'WebSocket',
  'Event', 'EventTarget', 'addEventListener', 'removeEventListener',
  'dispatchEvent', 'customElements', 'HTMLElement', 'Element', 'Node',
  'document', 'querySelector', 'querySelectorAll', 'getElementById',
  'getElementsByClassName', 'getElementsByTagName', 'createElement',
  'appendChild', 'removeChild', 'insertBefore', 'replaceChild',
  'cloneNode', 'contains', 'closest', 'matches', 'scrollIntoView',
  'addEventListener', 'removeEventListener', 'dispatchEvent',
  'requestAnimationFrame', 'cancelAnimationFrame', 'performance',
  'crypto.getRandomValues', 'crypto.randomUUID', 'crypto.subtle',
  'TextEncoder', 'TextDecoder', 'Blob', 'File', 'FileReader',
  'URL', 'URLSearchParams', 'FormData', 'Headers', 'Request', 'Response',
];

/**
 * TypeScript/JavaScript 语言配置
 */
export const typescriptLanguageConfig = {
  id: 'typescript',
  name: 'typescript',
  displayName: 'TypeScript',
  version: '5.4',
  fileExtensions: ['.ts', '.tsx', '.mts', '.cts'],
  mimeTypes: ['application/typescript', 'text/typescript'],
  monacoLanguageId: 'typescript',
  wasmRuntime: 'quickjs',
  wasmPreload: true,
  resourceOverrides: {
    cpu_time_secs: 30,
    memory_mb: 256,
  },
};

export const javascriptLanguageConfig = {
  id: 'javascript',
  name: 'javascript',
  displayName: 'JavaScript',
  version: '20',
  fileExtensions: ['.js', '.jsx', '.mjs', '.cjs'],
  mimeTypes: ['application/javascript', 'text/javascript'],
  monacoLanguageId: 'javascript',
  wasmRuntime: 'quickjs',
  wasmPreload: true,
  resourceOverrides: {
    cpu_time_secs: 15,
    memory_mb: 128,
  },
};

export const typescriptProviders = {
  completion: createTypeScriptCompletionProvider,
};

export const javascriptProviders = {
  completion: createTypeScriptCompletionProvider, // 复用 TS 的补全
};

export default {
  typescript: { config: typescriptLanguageConfig, providers: typescriptProviders },
  javascript: { config: javascriptLanguageConfig, providers: javascriptProviders },
};
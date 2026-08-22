import * as monaco from 'monaco-editor';

// Rust 关键字
const rustKeywords = [
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn',
  'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in',
  'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
  'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'try',
  'type', 'union', 'unsafe', 'use', 'where', 'while', 'async', 'await',
  'dyn', 'move', 'ref', 'mut', 'const', 'static', 'pub', 'unsafe',
  'async', 'await', 'try', 'yield', 'macro_rules', 'macro', 'include',
  'include_str', 'include_bytes', 'concat', 'concat_idents', 'stringify',
  'module_path', 'file', 'line', 'column', 'cfg', 'cfg_attr', 'cfg',
  'test', 'bench', 'cfg_test', 'cfg_attr', 'derive', 'allow', 'deny',
  'warn', 'forbid', 'must_use', 'inline', 'no_inline', 'cold', 'inline',
  'no_mangle', 'link_section', 'export_name', 'no_link', 'repr',
  'align', 'packed', 'transparent', 'simd', 'target_feature', 'cfg',
  'cfg_attr', 'cfg', 'doc', 'doc_hidden', 'doc', 'must_use', 'deprecated',
  'deprecated', 'allow', 'warn', 'deny', 'forbid', 'must_use', 'inline',
  'no_inline', 'cold', 'inline', 'no_mangle', 'link_section', 'export_name',
  'no_link', 'repr', 'align', 'packed', 'transparent', 'simd', 'target_feature',
];

// Rust 内置类型
const rustBuiltinTypes = [
  'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
  'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
  'f32', 'f64', 'bool', 'char', 'str', 'String',
  'bool', 'char', 'String', 'Vec', 'HashMap', 'HashSet',
  'Option', 'Result', 'Box', 'Rc', 'Arc', 'RefCell',
  'Mutex', 'RwLock', 'Cell', 'RefCell', 'Atomic',
  'String', 'Vec', 'HashMap', 'HashSet', 'BTreeMap', 'BTreeSet',
  'Option', 'Result', 'Box', 'Rc', 'Arc', 'RefCell', 'Mutex', 'RwLock',
  'Cow', 'Path', 'PathBuf', 'OsString', 'OsStr', 'CString', 'CStr',
  'Duration', 'Instant', 'SystemTime', 'Path', 'PathBuf',
];

// Rust 标准库常用项
const rustStdlib = [
  'std', 'core', 'alloc', 'collections', 'io', 'fs', 'net', 'thread',
  'sync', 'time', 'fmt', 'io', 'mem', 'ptr', 'ops', 'cmp', 'hash',
  'marker', 'clone', 'copy', 'drop', 'borrow', 'borrow_mut', 'deref',
  'deref_mut', 'as_ref', 'as_mut', 'from', 'into', 'try_from', 'try_into',
  'default', 'clone', 'copy', 'partial_eq', 'eq', 'partial_ord', 'ord',
  'hash', 'debug', 'display', 'fmt', 'write', 'write_fmt', 'format',
  'panic', 'unreachable', 'unimplemented', 'todo', 'assert', 'assert_eq',
  'assert_ne', 'debug_assert', 'debug_assert_eq', 'debug_assert_ne',
  'cfg', 'compile_error', 'include', 'include_str', 'include_bytes',
  'concat', 'concat_idents', 'stringify', 'module_path', 'file', 'line',
  'column', 'env', 'option_env', 'cfg', 'cfg_attr', 'cfg', 'test',
  'bench', 'should_panic', 'ignore', 'serial', 'parallel', 'test_case',
  'async_trait', 'tokio', 'futures', 'async_std', 'tokio::spawn',
  'tokio::join', 'tokio::select', 'tokio::time', 'tokio::sync',
  'tokio::fs', 'tokio::net', 'tokio::io', 'tokio::task', 'tokio::time',
  'futures', 'futures::future', 'futures::stream', 'futures::sink',
  'futures::executor', 'futures::task', 'futures::pin_mut', 'futures::ready',
  'serde', 'serde_json', 'serde_derive', 'serde::Serialize', 'serde::Deserialize',
  'tokio::main', 'tokio::test', 'tokio::spawn', 'tokio::join', 'tokio::select',
  'tokio::time::sleep', 'tokio::time::timeout', 'tokio::time::interval',
  'tokio::sync::Mutex', 'tokio::sync::RwLock', 'tokio::sync::Semaphore',
  'tokio::sync::mpsc', 'tokio::sync::oneshot', 'tokio::sync::watch',
  'tokio::sync::broadcast', 'tokio::sync::Notify', 'tokio::sync::Barrier',
];

// Rust 代码片段
const rustSnippets = [
  {
    label: 'fn',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'fn ${1:name}(${2:params}) -> ${3:ReturnType} {\n\t${4:// body}\n\t${5:return}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Function definition',
  },
  {
    label: 'async fn',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'async fn ${1:name}(${2:params}) -> ${3:ReturnType} {\n\t${4:// body}\n\t${5:return}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Async function definition',
  },
  {
    label: 'struct',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'struct ${1:Name} {\n\t${2:field}: ${3:type},\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Struct definition',
  },
  {
    label: 'enum',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'enum ${1:Name} {\n\t${2:Variant}${3:(${4:type})},\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Enum definition',
  },
  {
    label: 'impl',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'impl ${1:Trait} for ${2:Type} {\n\tfn ${3:method}(${4:params}) -> ${5:ReturnType} {\n\t\t${6:// body}\n\t}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Impl block',
  },
  {
    label: 'trait',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'trait ${1:TraitName} {\n\tfn ${2:method}(${3:params}) -> ${3:ReturnType};\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Trait definition',
  },
  {
    label: 'match',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'match ${1:expr} {\n\t${2:pattern} => ${3:expr},\n\t_ => ${4:default},\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Match expression',
  },
  {
    label: 'if let',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'if let ${1:pattern} = ${2:expr} {\n\t${3:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'If let pattern',
  },
  {
    label: 'while let',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'while let ${1:pattern} = ${2:expr} {\n\t${3:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'While let pattern',
  },
  {
    label: 'for',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'for ${1:item} in ${2:iter} {\n\t${3:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'For loop',
  },
  {
    label: 'loop',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'loop {\n\t${1:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Infinite loop',
  },
  {
    label: 'while',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'while ${1:condition} {\n\t${2:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'While loop',
  },
  {
    label: 'if',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'if ${1:condition} {\n\t${2:// then}\n} else {\n\t${3:// else}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'If expression',
  },
  {
    label: 'let',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'let ${1:mut }${2:name}: ${3:type} = ${4:value};',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Let binding',
  },
  {
    label: 'mut',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'mut ${1:name}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Mutable binding',
  },
  {
    label: 'match',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'match ${1:expr} {\n\t${2:Pattern} => ${3:expr},\n\t_ => ${4:default},\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Match expression',
  },
  {
    label: 'Option',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'Option<${1:T}>',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Option type',
  },
  {
    label: 'Result',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'Result<${1:T}, ${2:E}>',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Result type',
  },
  {
    label: 'Vec',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'Vec<${1:T}>',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Vec type',
  },
  {
    label: 'HashMap',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'HashMap<${1:K}, ${2:V}>',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'HashMap type',
  },
  {
    label: 'HashSet',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'HashSet<${1:T}>',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'HashSet type',
  },
  {
    label: 'unwrap',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:expr}.unwrap()',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Unwrap Option/Result',
  },
  {
    label: 'expect',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:expr}.expect("${2:message}")',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Expect with message',
  },
  {
    label: '?',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:expr}?',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Try operator',
  },
  {
    label: 'await',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:expr}.await',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Await future',
  },
  {
    label: 'async',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'async ${1:block}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Async block',
  },
  {
    label: 'spawn',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'tokio::spawn(async {\n\t${1:// body}\n})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Spawn task',
  },
  {
    label: 'tokio::main',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '#[tokio::main]\nasync fn main() {\n\t${1:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Tokio main',
  },
  {
    label: 'println!',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'println!(${1:"${2:message}"});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Print line',
  },
  {
    label: 'eprintln!',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'eprintln!(${1:"${2:message}"});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Error print line',
  },
  {
    label: 'format!',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'format!(${1:"${2:format}"${3:, ${4:args}}})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Format string',
  },
  {
    label: 'format!',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'format!(${1:"${2:format}"${3:, ${4:args}}})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Format string',
  },
  {
    label: 'vec!',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'vec![${1:elem}${2:, ${3:elem}}*]',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Vec macro',
  },
  {
    label: 'hashmap!',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'HashMap::from([(${1:key}, ${2:value})${3:, (${4:key}, ${5:value})}*])',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'HashMap macro',
  },
];

/**
 * 创建 Rust Monaco 补全提供者
 */
export function createRustCompletionProvider(monaco: typeof monaco) {
  const allKeywords = rustKeywords;
  const allSnippets = rustSnippets;

  return {
    triggerCharacters: ['.', ':', '(', '[', '"', "'", ' ', '\t', ':', '?', '#', '[', '{'],
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
      for (const kw of rustKeywords) {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
          sortText: '0_' + kw,
        });
      }

      // 内置类型
      for (const type of rustBuiltinTypes) {
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
      for (const std of rustStdlib) {
        suggestions.push({
          label: std,
          kind: monaco.languages.CompletionItemKind.Module,
          insertText: std,
          range,
          sortText: '2_' + std,
          detail: 'Standard library',
        });
      }

      // 代码片段
      for (const snippet of rustSnippets) {
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

/**
 * Rust 语言配置
 */
export const rustLanguageConfig = {
  id: 'rust',
  name: 'rust',
  displayName: 'Rust',
  version: '1.80',
  fileExtensions: ['.rs'],
  mimeTypes: ['text/rust', 'text/x-rust'],
  monacoLanguageId: 'rust',
  wasmRuntime: 'wasmer',
  wasmPreload: false,
  resourceOverrides: {
    cpu_time_secs: 60,
    memory_mb: 512,
  },
};

export const rustProviders = {
  completion: createRustCompletionProvider,
};

export default {
  config: rustLanguageConfig,
  providers: rustProviders,
};
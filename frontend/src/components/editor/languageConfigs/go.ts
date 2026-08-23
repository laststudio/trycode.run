import * as monaco from 'monaco-editor';

// Go 关键字
const goKeywords = [
  'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
  'fallthrough', 'for', 'func', 'goto', 'if', 'import', 'interface', 'map',
  'package', 'range', 'return', 'select', 'struct', 'switch', 'type', 'var',
  'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
  'fallthrough', 'for', 'func', 'goto', 'if', 'import', 'interface', 'map',
  'package', 'range', 'return', 'select', 'struct', 'switch', 'type', 'var',
];

// Go 内置类型
const goBuiltinTypes = [
  'bool', 'byte', 'complex64', 'complex128', 'error', 'float32', 'float64',
  'int', 'int8', 'int16', 'int32', 'int64', 'rune', 'string', 'uint',
  'uint8', 'uint16', 'uint32', 'uint64', 'uintptr',
];

// Go 标准库常用包
const goStdlib = [
  'fmt', 'fmt.Printf', 'fmt.Println', 'fmt.Scanf', 'fmt.Sprintf',
  'os', 'os.Open', 'os.Create', 'os.ReadFile', 'os.WriteFile', 'os.Stdout', 'os.Stderr',
  'io', 'io.Reader', 'io.Writer', 'io.Copy', 'io.ReadAll', 'io.ReadFull',
  'bufio', 'bufio.NewReader', 'bufio.NewScanner', 'bufio.NewWriter',
  'bytes', 'bytes.Buffer', 'bytes.NewBuffer', 'bytes.Compare',
  'strings', 'strings.Contains', 'strings.Split', 'strings.Join', 'strings.TrimSpace',
  'strconv', 'strconv.Atoi', 'strconv.Itoa', 'strconv.ParseInt', 'strconv.FormatInt',
  'encoding/json', 'encoding/json.Marshal', 'encoding/json.Unmarshal',
  'encoding/xml', 'encoding/csv', 'encoding/base64', 'encoding/hex',
  'crypto', 'crypto/sha256', 'crypto/md5', 'crypto/rand', 'crypto/rsa',
  'crypto/tls', 'crypto/x509', 'crypto/ecdsa', 'crypto/ed25519',
  'net', 'net/http', 'net/http.Client', 'net/http.Request', 'net/http.Response',
  'net/url', 'net/url.URL', 'net/url.Parse', 'net/url.ParseRequestURI',
  'time', 'time.Now', 'time.Parse', 'time.Format', 'time.Duration', 'time.Sleep',
  'time.Time', 'time.Time.Unix', 'time.Time.Format', 'time.Sleep',
  'sync', 'sync.Mutex', 'sync.RWMutex', 'sync.WaitGroup', 'sync.Once', 'sync.Map',
  'sync/atomic', 'sync/atomic.AddInt64', 'sync/atomic.LoadInt64',
  'context', 'context.Background', 'context.TODO', 'context.WithTimeout',
  'context.WithCancel', 'context.WithValue', 'context.WithDeadline',
  'errors', 'errors.New', 'errors.Is', 'errors.As', 'errors.Unwrap',
  'fmt', 'os', 'io', 'bufio', 'bytes', 'strings', 'strconv', 'encoding/json',
  'encoding/xml', 'encoding/csv', 'crypto', 'net', 'net/http', 'net/url',
  'time', 'sync', 'sync/atomic', 'context', 'errors', 'log', 'log.Printf',
  'log.Println', 'log.Fatal', 'log.Panic', 'runtime', 'runtime.GOOS', 'runtime.GOARCH',
  'runtime.GOMAXPROCS', 'runtime.NumCPU', 'runtime.GC', 'runtime.ReadMemStats',
  'reflect', 'reflect.TypeOf', 'reflect.ValueOf', 'reflect.TypeOf', 'reflect.Kind',
  'unsafe', 'unsafe.Pointer', 'unsafe.Sizeof', 'unsafe.Offsetof', 'unsafe.Alignof',
  'math', 'math/rand', 'math/big', 'math/cmplx', 'math/bits', 'sort',
  'sort.Ints', 'sort.Strings', 'sort.Float64s', 'sort.Search', 'sort.SearchInts',
  'container/list', 'container/ring', 'container/heap', 'container/heap.Init',
  'container/heap.Push', 'container/heap.Pop', 'container/heap.Remove',
  'container/heap.Fix', 'container/list.List', 'container/ring', 'container/heap',
];

// Go 代码片段
const goSnippets = [
  {
    label: 'func',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'func ${1:name}(${2:params}) ${3:returnType} {\n\t${4:// body}\n\treturn ${5:result}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Function definition',
  },
  {
    label: 'main',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'package main\n\nimport (\n\t"fmt"\n)\n\nfunc main() {\n\t${1:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Main package',
  },
  {
    label: 'if',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'if ${1:condition} {\n\t${2:// then}\n} else {\n\t${3:// else}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'If statement',
  },
  {
    label: 'for',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'for ${1:init}; ${2:condition}; ${3:post} {\n\t${4:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'For loop',
  },
  {
    label: 'for-range',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'for ${1:key}, ${2:value} := range ${3:collection} {\n\t${4:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'For range loop',
  },
  {
    label: 'switch',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'switch ${1:expr} {\n\tcase ${2:value}:\n\t\t${3:// body}\n\tdefault:\n\t\t${4:// default}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Switch statement',
  },
  {
    label: 'defer',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'defer ${1:func}(${2:args})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Defer statement',
  },
  {
    label: 'go',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'go ${1:func}(${2:args})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Goroutine',
  },
  {
    label: 'go-func',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'go func() {\n\t${1:// body}\n}()',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Anonymous goroutine',
  },
  {
    label: 'defer',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'defer ${1:func}(${2:args})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Defer statement',
  },
  {
    label: 'select',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'select {\n\tcase ${1:msg} := <-${2:ch}:\n\t\t${3:// body}\n\tdefault:\n\t\t${4:// default}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Select statement',
  },
  {
    label: 'struct',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'type ${1:Name} struct {\n\t${2:Field} ${3:Type}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Struct definition',
  },
  {
    label: 'interface',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'type ${1:Name} interface {\n\t${2:Method}(${3:params}) ${4:returnType}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Interface definition',
  },
  {
    label: 'func',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'func ${1:name}(${2:params}) ${3:returnType} {\n\t${4:// body}\n\treturn ${5:result}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Function definition',
  },
  {
    label: 'method',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'func (${1:receiver} ${2:Type}) ${3:method}(${4:params}) ${5:returnType} {\n\t${6:// body}\n\treturn ${7:result}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Method definition',
  },
  {
    label: 'if',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'if ${1:condition} {\n\t${2:// then}\n} else {\n\t${3:// else}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'If statement',
  },
  {
    label: 'if-short',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'if ${1:val} := ${2:expr}; ${1:val} ${3:condition} {\n\t${4:// then}\n} else {\n\t${5:// else}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Short if statement',
  },
  {
    label: 'for',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'for ${1:init}; ${2:condition}; ${3:post} {\n\t${4:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'For loop',
  },
  {
    label: 'for-range',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'for ${1:key}, ${2:value} := range ${3:collection} {\n\t${4:// body}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'For range loop',
  },
  {
    label: 'switch',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'switch ${1:expr} {\n\tcase ${2:value}:\n\t\t${3:// body}\n\tdefault:\n\t\t${4:// default}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Switch statement',
  },
  {
    label: 'defer',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'defer ${1:func}(${2:args})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Defer statement',
  },
  {
    label: 'go',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'go ${1:func}(${2:args})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Goroutine',
  },
  {
    label: 'go-func',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'go func() {\n\t${1:// body}\n}()',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Anonymous goroutine',
  },
  {
    label: 'select',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'select {\n\tcase ${1:msg} := <-${2:ch}:\n\t\t${3:// body}\n\tdefault:\n\t\t${4:// default}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Select statement',
  },
  {
    label: 'struct',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'type ${1:Name} struct {\n\t${2:Field} ${3:Type}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Struct definition',
  },
  {
    label: 'interface',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'type ${1:Name} interface {\n\t${2:Method}(${3:params}) ${4:returnType}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Interface definition',
  },
  {
    label: 'make',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:var} := make(${2:type}${3:, ${4:capacity}})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Make slice/map/channel',
  },
  {
    label: 'new',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:var} := new(${2:type})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'New pointer',
  },
  {
    label: 'make-slice',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:var} := make([]${2:type}, ${3:length}${4:, ${5:capacity}})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Make slice',
  },
  {
    label: 'make-map',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:var} := make(map[${2:key}]${3:value})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Make map',
  },
  {
    label: 'make-chan',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:var} := make(chan ${2:type}${3:, ${3:buffer}})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Make channel',
  },
  {
    label: 'defer',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'defer ${1:func}(${2:args})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Defer statement',
  },
  {
    label: 'go',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'go ${1:func}(${2:args})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Goroutine',
  },
  {
    label: 'go-func',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'go func() {\n\t${1:// body}\n}()',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Anonymous goroutine',
  },
  {
    label: 'select',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'select {\n\tcase ${1:msg} := <-${2:ch}:\n\t\t${3:// body}\n\tdefault:\n\t\t${4:// default}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Select statement',
  },
  {
    label: 'mutex',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'var ${1:mu} sync.Mutex\n${2:mu}.Lock()\ndefer ${1:mu}.Unlock()\n${3:// critical section}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Mutex lock',
  },
  {
    label: 'rwmutex',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'var ${1:mu} sync.RWMutex\n${1:mu}.RLock()\ndefer ${1:mu}.RUnlock()\n${3:// read}\n${1:mu}.Lock()\ndefer ${1:mu}.Unlock()\n${4:// write}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'RWMutex read/write',
  },
  {
    label: 'waitgroup',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'var ${1:wg} sync.WaitGroup\n${1:wg}.Add(${2:1})\ngo func() {\n\tdefer ${1:wg}.Done()\n\t${3:// work}\n}()\n${1:wg}.Wait()',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'WaitGroup',
  },
  {
    label: 'channel',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:ch} := make(chan ${2:type})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Create channel',
  },
  {
    label: 'send',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:ch} <- ${2:value}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Send to channel',
  },
  {
    label: 'receive',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: '${1:val} := <-${2:ch}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Receive from channel',
  },
  {
    label: 'select-case',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: 'select {\n\tcase ${1:val} := <-${2:ch}:\n\t\t${3:// recv}\n\tcase ${4:ch} <- ${5:val}:\n\t\t${6:// send}\n\tdefault:\n\t\t${7:// default}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Select with cases',
  },
];

/**
 * 创建 Go Monaco 补全提供者
 */
export function createGoCompletionProvider(monacoInstance: typeof monaco) {
  const allKeywords = goKeywords;
  const allSnippets = goSnippets;

  return {
    triggerCharacters: ['.', '(', '[', '"', "'", ' ', '\t', ':'],
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
      for (const kw of goKeywords) {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
          sortText: '0_' + kw,
        });
      }

      // 内置类型
      for (const type of goBuiltinTypes) {
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
      for (const std of goStdlib) {
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
      for (const snippet of goSnippets) {
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
 * Go 语言配置
 */
export const goLanguageConfig = {
  id: 'go',
  name: 'go',
  displayName: 'Go',
  version: '1.22',
  fileExtensions: ['.go'],
  mimeTypes: ['text/x-go', 'application/x-go'],
  monacoLanguageId: 'go',
  wasmRuntime: 'native',
  wasmPreload: false,
  resourceOverrides: {
    cpu_time_secs: 45,
    memory_mb: 384,
  },
};

export const goProviders = {
  completion: createGoCompletionProvider,
};

export default {
  config: goLanguageConfig,
  providers: { completion: createGoCompletionProvider },
};
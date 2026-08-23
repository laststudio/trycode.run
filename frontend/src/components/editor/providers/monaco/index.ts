export * from './types';
export * from './BaseProviderFactory';
export * from './pythonProvider';
export * from './typescriptProvider';
export * from './rustProvider';
export * from './goProvider';

import { PythonProviderFactory } from './pythonProvider';
import { TypeScriptProviderFactory, JavaScriptProviderFactory } from './typescriptProvider';
import { RustProviderFactory } from './rustProvider';
import { GoProviderFactory } from './goProvider';

export const MonacoProviders = {
  python: PythonProviderFactory,
  typescript: TypeScriptProviderFactory,
  javascript: JavaScriptProviderFactory,
  rust: RustProviderFactory,
  go: GoProviderFactory,
};

export function registerMonacoProviders(monacoInstance: typeof import('monaco-editor')) {
  // Register completion providers for all languages
  Object.entries(MonacoProviders).forEach(([langId, factory]) => {
    if ('completion' in factory && typeof factory.completion === 'function') {
      const provider = factory.completion(monacoInstance);
      monacoInstance.languages.registerCompletionItemProvider(langId, provider);
    } else if (typeof (factory as any).createCompletionProvider === 'function') {
      const provider = (factory as any).createCompletionProvider(monacoInstance);
      monacoInstance.languages.registerCompletionItemProvider(langId, provider);
    }
  });
}

export function getMonacoLanguageId(languageId: string): string {
  const mapping: Record<string, string> = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
    rust: 'rust',
    go: 'go',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    csharp: 'csharp',
    php: 'php',
    ruby: 'ruby',
    swift: 'swift',
    kotlin: 'kotlin',
    scala: 'scala',
    r: 'r',
    lua: 'lua',
    perl: 'perl',
    dart: 'dart',
    zig: 'zig',
    julia: 'julia',
    haskell: 'haskell',
    fortran: 'fortran',
    objectivec: 'objective-c',
    vbnet: 'vb',
    fsharp: 'fsharp',
    groovy: 'groovy',
    html: 'html',
    css: 'css',
    sql: 'sql',
    bash: 'shell',
    powershell: 'powershell',
  };
  return mapping[languageId] || 'plaintext';
}
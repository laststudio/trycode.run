import * as monaco from 'monaco-editor';

export interface MonacoProviderConfig {
  languageId: string;
  monacoLanguageId: string;
  triggerCharacters?: string[];
  completionItemDefaults?: Partial<monaco.languages.CompletionItem>;
}

export interface LanguageIntelliSenseConfig {
  languageId: string;
  monacoLanguageId: string;
  completion?: monaco.languages.CompletionItemProvider;
  hover?: monaco.languages.HoverProvider;
  definition?: monaco.languages.DefinitionProvider;
  signatureHelp?: monaco.languages.SignatureHelpProvider;
  documentSymbol?: monaco.languages.DocumentSymbolProvider;
  codeAction?: monaco.languages.CodeActionProvider;
  references?: monaco.languages.ReferenceProvider;
  rename?: monaco.languages.RenameProvider;
  formatting?: monaco.languages.DocumentFormattingEditProvider;
  rangeFormatting?: monaco.languages.DocumentRangeFormattingEditProvider;
  onTypeFormatting?: monaco.languages.OnTypeFormattingEditProvider;
  foldingRange?: monaco.languages.FoldingRangeProvider;
  selectionRange?: monaco.languages.SelectionRangeProvider;
  linkedEditing?: monaco.languages.LinkedEditingRangeProvider;
  callHierarchy?: any;
  semanticTokens?: monaco.languages.DocumentSemanticTokensProvider;
  inlayHints?: monaco.languages.InlayHintsProvider;
}

export interface CompletionItemData {
  label: string;
  kind: monaco.languages.CompletionItemKind;
  detail?: string;
  documentation?: string | monaco.IMarkdownString;
  insertText?: string;
  filterText?: string;
  sortText?: string;
  preselect?: boolean;
  commitCharacters?: string[];
  command?: monaco.languages.Command;
  tags?: monaco.languages.CompletionItemTag[];
}

export interface HoverContent {
  contents: monaco.IMarkdownString[];
  range?: monaco.Range;
}

export interface SignatureHelpResult {
  signatures: monaco.languages.SignatureInformation[];
  activeSignature: number;
  activeParameter: number;
}

export interface DocumentSymbolData {
  name: string;
  detail: string;
  kind: monaco.languages.SymbolKind;
  range: monaco.Range;
  selectionRange: monaco.Range;
  children?: DocumentSymbolData[];
}
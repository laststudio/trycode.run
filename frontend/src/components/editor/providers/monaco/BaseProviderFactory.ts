import * as monaco from 'monaco-editor';
import type { LanguageIntelliSenseConfig } from './types';

export class BaseProviderFactory {
  protected monaco: typeof monaco;
  protected languageId: string;
  protected monacoLanguageId: string;

  constructor(monaco: typeof monaco, languageId: string, monacoLanguageId: string) {
    this.monaco = monaco;
    this.languageId = languageId;
    this.monacoLanguageId = monacoLanguageId;
  }

  createCompletionProvider(): monaco.languages.CompletionItemProvider {
    return {
      triggerCharacters: this.getTriggerCharacters(),
      provideCompletionItems: (model, position, context, token) => {
        return this.provideCompletionItems(model, position, context, token);
      },
      resolveCompletionItem: (item, token) => {
        return this.resolveCompletionItem(item, token);
      },
    };
  }

  createHoverProvider(): monaco.languages.HoverProvider {
    return {
      provideHover: (model, position, token) => {
        return this.provideHover(model, position, token);
      },
    };
  }

  createDefinitionProvider(): monaco.languages.DefinitionProvider {
    return {
      provideDefinition: (model, position, token) => {
        return this.provideDefinition(model, position, token);
      },
    };
  }

  createSignatureHelpProvider(): monaco.languages.SignatureHelpProvider {
    return {
      signatureHelpTriggerCharacters: this.getSignatureHelpTriggerCharacters(),
      provideSignatureHelp: (model, position, token, context) => {
        return this.provideSignatureHelp(model, position, token, context);
      },
    };
  }

  createDocumentSymbolProvider(): monaco.languages.DocumentSymbolProvider {
    return {
      provideDocumentSymbols: (model, token) => {
        return this.provideDocumentSymbols(model, token);
      },
    };
  }

  createCodeActionProvider(): monaco.languages.CodeActionProvider {
    return {
      provideCodeActions: (model, range, context, token) => {
        return this.provideCodeActions(model, range, context, token);
      },
    };
  }

  createReferencesProvider(): monaco.languages.ReferenceProvider {
    return {
      provideReferences: (model, position, context, token) => {
        return this.provideReferences(model, position, context, token);
      },
    };
  }

  createRenameProvider(): monaco.languages.RenameProvider {
    return {
      provideRenameEdits: (model, position, newName, token) => {
        return this.provideRenameEdits(model, position, newName, token);
      },
    };
  }

  createFormattingProvider(): monaco.languages.DocumentFormattingEditProvider {
    return {
      provideDocumentFormattingEdits: (model, options, token) => {
        return this.provideFormattingEdits(model, options, token);
      },
    };
  }

  protected getTriggerCharacters(): string[] {
    return ['.', '(', '[', '"', "'", '`', '@', '#', '<', ':', '=', '|', '&', '?', ' ', '\t'];
  }

  protected getSignatureHelpTriggerCharacters(): string[] {
    return ['(', ',', '<'];
  }

  protected provideCompletionItems(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.CompletionContext,
    token: monaco.CancellationToken
  ): monaco.languages.CompletionList | Promise<monaco.languages.CompletionList> {
    return { suggestions: [] };
  }

  protected resolveCompletionItem(
    item: monaco.languages.CompletionItem,
    token: monaco.CancellationToken
  ): monaco.languages.CompletionItem | Promise<monaco.languages.CompletionItem> {
    return item;
  }

  protected provideHover(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    token: monaco.CancellationToken
  ): monaco.languages.Hover | Promise<monaco.languages.Hover | null> {
    return null;
  }

  protected provideDefinition(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    token: monaco.CancellationToken
  ): monaco.languages.Definition | Promise<monaco.languages.Definition | null> {
    return null;
  }

  protected provideSignatureHelp(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    token: monaco.CancellationToken,
    context: monaco.languages.SignatureHelpContext
  ): monaco.languages.SignatureHelp | Promise<monaco.languages.SignatureHelp | null> {
    return null;
  }

  protected provideDocumentSymbols(
    model: monaco.editor.ITextModel,
    token: monaco.CancellationToken
  ): monaco.languages.DocumentSymbol[] | Promise<monaco.languages.DocumentSymbol[]> {
    return [];
  }

  protected provideCodeActions(
    model: monaco.editor.ITextModel,
    range: monaco.Range,
    context: monaco.languages.CodeActionContext,
    token: monaco.CancellationToken
  ): monaco.languages.CodeActionList | Promise<monaco.languages.CodeActionList> {
    return { actions: [], dispose: () => {} };
  }

  protected provideReferences(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.ReferenceContext,
    token: monaco.CancellationToken
  ): monaco.languages.Location[] | Promise<monaco.languages.Location[]> {
    return [];
  }

  protected provideRenameEdits(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    newName: string,
    token: monaco.CancellationToken
  ): monaco.languages.WorkspaceEdit | Promise<monaco.languages.WorkspaceEdit | null> {
    return null;
  }

  protected provideFormattingEdits(
    model: monaco.editor.ITextModel,
    options: monaco.languages.FormattingOptions,
    token: monaco.CancellationToken
  ): monaco.languages.TextEdit[] | Promise<monaco.languages.TextEdit[]> {
    return [];
  }
}
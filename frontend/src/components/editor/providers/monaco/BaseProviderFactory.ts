import type * as monaco from 'monaco-editor';

export class BaseProviderFactory {
  protected monacoInstance: typeof monaco;
  protected languageId: string;
  protected monacoLanguageId: string;

  constructor(monacoInstance: typeof monaco, languageId: string, monacoLanguageId: string) {
    this.monacoInstance = monacoInstance;
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
      provideSignatureHelp: async (model, position, token, context) => {
        const help = await Promise.resolve(
          this.provideSignatureHelp(model, position, token, context)
        );
        if (!help) return undefined;
        return { ...help, dispose: () => {} };
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
    _model: monaco.editor.ITextModel,
    _position: monaco.Position,
    _context: monaco.languages.CompletionContext,
    _token: monaco.CancellationToken
  ): monaco.languages.CompletionList | Promise<monaco.languages.CompletionList> {
    return { suggestions: [] };
  }

  protected resolveCompletionItem(
    item: monaco.languages.CompletionItem,
    _token: monaco.CancellationToken
  ): monaco.languages.CompletionItem | Promise<monaco.languages.CompletionItem> {
    return item;
  }

  protected provideHover(
    _model: monaco.editor.ITextModel,
    _position: monaco.Position,
    _token: monaco.CancellationToken
  ): monaco.languages.Hover | undefined | Promise<monaco.languages.Hover | undefined> {
    return undefined;
  }

  protected provideDefinition(
    _model: monaco.editor.ITextModel,
    _position: monaco.Position,
    _token: monaco.CancellationToken
  ): monaco.languages.Definition | undefined | Promise<monaco.languages.Definition | undefined> {
    return undefined;
  }

  protected provideSignatureHelp(
    _model: monaco.editor.ITextModel,
    _position: monaco.Position,
    _token: monaco.CancellationToken,
    _context: monaco.languages.SignatureHelpContext
  ): monaco.languages.SignatureHelp | undefined | Promise<monaco.languages.SignatureHelp | undefined> {
    return undefined;
  }

  protected provideDocumentSymbols(
    _model: monaco.editor.ITextModel,
    _token: monaco.CancellationToken
  ): monaco.languages.DocumentSymbol[] | Promise<monaco.languages.DocumentSymbol[]> {
    return [];
  }

  protected provideCodeActions(
    _model: monaco.editor.ITextModel,
    _range: monaco.Range,
    _context: monaco.languages.CodeActionContext,
    _token: monaco.CancellationToken
  ): monaco.languages.CodeActionList | Promise<monaco.languages.CodeActionList> {
    return { actions: [], dispose: () => {} };
  }

  protected provideReferences(
    _model: monaco.editor.ITextModel,
    _position: monaco.Position,
    _context: monaco.languages.ReferenceContext,
    _token: monaco.CancellationToken
  ): monaco.languages.Location[] | Promise<monaco.languages.Location[]> {
    return [];
  }

  protected provideRenameEdits(
    _model: monaco.editor.ITextModel,
    _position: monaco.Position,
    _newName: string,
    _token: monaco.CancellationToken
  ): monaco.languages.WorkspaceEdit | undefined | Promise<monaco.languages.WorkspaceEdit | undefined> {
    return undefined;
  }

  protected provideFormattingEdits(
    _model: monaco.editor.ITextModel,
    _options: monaco.languages.FormattingOptions,
    _token: monaco.CancellationToken
  ): monaco.languages.TextEdit[] | Promise<monaco.languages.TextEdit[]> {
    return [];
  }
}

import ts from 'typescript';

/** Resolve local bindings, so a map named `document` is not mistaken for the DOM. */
export function auditCoreBoundary(fileName: string, text: string): string[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const host = ts.createCompilerHost({ noLib: true, noResolve: true });
  host.getSourceFile = name => name === fileName ? source : undefined;
  const program = ts.createProgram([fileName], { noLib: true, noResolve: true }, host);
  const checker = program.getTypeChecker();
  const errors = new Set<string>();
  const inspectImport = (value: ts.Node | undefined) => {
    if (value && ts.isStringLiteralLike(value) && /(?:^|\/)labs\//.test(value.text.replaceAll('\\', '/'))) {
      errors.add('不得导入 Lab 页面、基础设施或 Lab Module');
    }
  };
  const inspectGlobal = (value: ts.Expression) => {
    if (ts.isIdentifier(value) && ['document', 'window'].includes(value.text)) {
      const symbol = checker.getSymbolAtLocation(value);
      if (!symbol?.declarations?.some(declaration => declaration.getSourceFile() === source)) {
        errors.add('不得直接操作 DOM 或浏览器生命周期');
      }
    }
    if ((ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value))
      && ts.isIdentifier(value.expression) && value.expression.text === 'globalThis') {
      const name = ts.isPropertyAccessExpression(value) ? value.name.text
        : value.argumentExpression && ts.isStringLiteralLike(value.argumentExpression) ? value.argumentExpression.text : '';
      if (['document', 'window'].includes(name)) errors.add('不得直接操作 DOM 或浏览器生命周期');
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) inspectImport(node.moduleSpecifier);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) inspectImport(node.arguments[0]);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) inspectImport(node.argument.literal);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      inspectGlobal(node.expression);
      inspectGlobal(node);
      const member = ts.isPropertyAccessExpression(node) ? node.name.text
        : node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : '';
      if (ts.isIdentifier(node.expression) && node.expression.text === 'context'
        && ['communication', 'services', 'ui', 'panels', 'viewport'].includes(member)) errors.add('不得访问 LabContext 服务');
    }
    if (ts.isIdentifier(node)) {
      if (['LabContext', 'LabModule', 'LabCommunication', 'LabServiceRegistry'].includes(node.text)) errors.add('不得声明或消费 Lab 契约');
      if (['LabState', 'registerReference', 'RuntimeDataStore', 'registerModule', 'createScope', 'releaseScope'].includes(node.text)) errors.add('业务 Core 不得注册 LabState 或旧 Runtime 内存');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...errors];
}

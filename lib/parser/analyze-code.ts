import { parse } from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import type {
  FunctionInfo,
  Operation,
  ParseResult,
  ParsedProgram,
} from "@/types/simulator";
import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  File,
  FunctionDeclaration,
  FunctionExpression,
  Statement,
} from "@babel/types";

const DEFAULT_PROGRAM: ParsedProgram = {
  functions: {},
  operations: [],
};

function valueFromExpression(
  expression: Expression | null | undefined,
  source: string,
): string {
  if (!expression) {
    return "undefined";
  }

  if (expression.start === null || expression.end === null) {
    return "unknown";
  }

  return source.slice(expression.start, expression.end).trim();
}

function getLine(path: NodePath): number {
  return path.node.loc?.start.line ?? 1;
}

function normalizeDeclarationKind(kind: string): "const" | "let" | "var" {
  if (kind === "let" || kind === "var") {
    return kind;
  }

  return "const";
}

function parseBlockStatements(statements: Statement[], source: string): Operation[] {
  const operations: Operation[] = [];

  for (const statement of statements) {
    const line = statement.loc?.start.line ?? 1;

    switch (statement.type) {
      case "VariableDeclaration": {
        for (const declaration of statement.declarations) {
          if (declaration.id.type !== "Identifier") {
            continue;
          }

          if (
            declaration.init?.type === "CallExpression" &&
            declaration.init.callee.type === "Identifier"
          ) {
            operations.push({
              type: "functionCall",
              name: declaration.init.callee.name,
              args: declaration.init.arguments.map((arg) => {
                if (arg.type === "SpreadElement") {
                  return "...";
                }
                return valueFromExpression(arg as Expression, source);
              }),
              assignTo: declaration.id.name,
              line,
            });
            continue;
          }

          operations.push({
            type: "variable",
            name: declaration.id.name,
            kind: normalizeDeclarationKind(statement.kind),
            value: valueFromExpression(declaration.init, source),
            line,
          });
        }
        break;
      }
      case "ExpressionStatement": {
        const expression = statement.expression;
        if (expression.type !== "CallExpression") {
          break;
        }

        const callOp = parseCallExpression(expression, source, line);
        if (callOp) {
          operations.push(callOp);
        }
        break;
      }
      case "ReturnStatement": {
        operations.push({
          type: "return",
          value: valueFromExpression(statement.argument, source),
          line,
        });
        break;
      }
      case "ForStatement": {
        const body =
          statement.body.type === "BlockStatement"
            ? parseBlockStatements(statement.body.body, source)
            : parseBlockStatements([statement.body], source);

        operations.push({
          type: "loop",
          kind: "for",
          iterations: estimateForIterations(statement, source),
          body,
          line,
        });
        break;
      }
      case "WhileStatement": {
        const body =
          statement.body.type === "BlockStatement"
            ? parseBlockStatements(statement.body.body, source)
            : parseBlockStatements([statement.body], source);

        operations.push({
          type: "loop",
          kind: "while",
          iterations: 2,
          body,
          line,
        });
        break;
      }
      case "DoWhileStatement": {
        const body =
          statement.body.type === "BlockStatement"
            ? parseBlockStatements(statement.body.body, source)
            : parseBlockStatements([statement.body], source);

        operations.push({
          type: "loop",
          kind: "do-while",
          iterations: 2,
          body,
          line,
        });
        break;
      }
      default:
        break;
    }
  }

  return operations;
}

function parseFunctionExpressionBody(
  fn: FunctionExpression | ArrowFunctionExpression,
  source: string,
): Operation[] {
  if (fn.body.type === "BlockStatement") {
    return parseBlockStatements(fn.body.body, source);
  }

  return [
    {
      type: "return",
      value: valueFromExpression(fn.body as Expression, source),
      line: fn.loc?.start.line ?? 1,
    },
  ];
}

function parseCallExpression(
  expression: CallExpression,
  source: string,
  line: number,
): Operation | null {
  if (
    expression.callee.type === "MemberExpression" &&
    expression.callee.object.type === "Identifier" &&
    expression.callee.object.name === "console" &&
    expression.callee.property.type === "Identifier" &&
    expression.callee.property.name === "log"
  ) {
    return {
      type: "consoleLog",
      args: expression.arguments.map((arg) => {
        if (arg.type === "SpreadElement") {
          return "...";
        }
        return valueFromExpression(arg as Expression, source);
      }),
      line,
    };
  }

  if (expression.callee.type === "Identifier" && expression.callee.name === "setTimeout") {
    const callback = expression.arguments[0];
    const callbackBody =
      callback &&
      (callback.type === "ArrowFunctionExpression" || callback.type === "FunctionExpression")
        ? parseFunctionExpressionBody(callback, source)
        : [];

    return {
      type: "asyncTask",
      queue: "macrotask",
      label: "setTimeout callback",
      body: callbackBody,
      line,
    };
  }

  if (expression.callee.type === "Identifier" && expression.callee.name === "fetch") {
    return {
      type: "asyncTask",
      queue: "macrotask",
      label: "fetch callback",
      body: [],
      line,
    };
  }

  if (
    expression.callee.type === "Identifier" &&
    expression.callee.name === "queueMicrotask"
  ) {
    const callback = expression.arguments[0];
    const callbackBody =
      callback &&
      (callback.type === "ArrowFunctionExpression" || callback.type === "FunctionExpression")
        ? parseFunctionExpressionBody(callback, source)
        : [];

    return {
      type: "asyncTask",
      queue: "microtask",
      label: "queueMicrotask callback",
      body: callbackBody,
      line,
    };
  }

  if (expression.callee.type === "Identifier") {
    return {
      type: "functionCall",
      name: expression.callee.name,
      args: expression.arguments.map((arg) => {
        if (arg.type === "SpreadElement") {
          return "...";
        }
        return valueFromExpression(arg as Expression, source);
      }),
      line,
    };
  }

  if (
    expression.callee.type === "MemberExpression" &&
    expression.callee.object.type === "Identifier" &&
    expression.callee.object.name === "document" &&
    expression.callee.property.type === "Identifier" &&
    expression.callee.property.name === "addEventListener"
  ) {
    const callback = expression.arguments[1];
    const callbackBody =
      callback &&
      (callback.type === "ArrowFunctionExpression" || callback.type === "FunctionExpression")
        ? parseFunctionExpressionBody(callback, source)
        : [];

    return {
      type: "asyncTask",
      queue: "macrotask",
      label: "DOM event callback",
      body: callbackBody,
      line,
    };
  }

  if (
    expression.callee.type === "MemberExpression" &&
    expression.callee.property.type === "Identifier" &&
    expression.callee.property.name === "then"
  ) {
    const callback = expression.arguments[0];
    const callbackBody =
      callback &&
      (callback.type === "ArrowFunctionExpression" || callback.type === "FunctionExpression")
        ? parseFunctionExpressionBody(callback, source)
        : [];

    return {
      type: "asyncTask",
      queue: "microtask",
      label: "Promise.then callback",
      body: callbackBody,
      line,
    };
  }

  return null;
}

function estimateForIterations(statement: Extract<Statement, { type: "ForStatement" }>, source: string): number {
  if (!statement.test) {
    return 3;
  }

  if (
    statement.test.type === "BinaryExpression" &&
    statement.test.right.type === "NumericLiteral"
  ) {
    const right = statement.test.right.value;
    if (Number.isFinite(right) && right >= 0) {
      return Math.min(Math.max(Math.floor(right), 1), 10);
    }
  }

  const text = valueFromExpression(statement.test, source);
  if (text.includes("<")) {
    return 3;
  }

  return 2;
}

export function parseJavaScript(source: string): ParseResult {
  try {
    const ast = parse(source, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      errorRecovery: false,
    }) as File;

    const functions: Record<string, FunctionInfo> = {};
    const operations: Operation[] = [];

    traverse(ast, {
      FunctionDeclaration(path: NodePath<FunctionDeclaration>) {
        if (!path.parentPath.isProgram()) {
          return;
        }

        const name = path.node.id?.name;
        if (!name) {
          return;
        }

        functions[name] = {
          name,
          params: path.node.params
            .map((param) => (param.type === "Identifier" ? param.name : "param"))
            .filter(Boolean),
          body: parseBlockStatements(path.node.body.body, source),
          line: getLine(path),
        };
      },
      Program(path) {
        operations.push(...parseBlockStatements(path.node.body, source));
      },
    });

    return {
      program: {
        functions,
        operations,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse JavaScript.";

    return {
      program: DEFAULT_PROGRAM,
      error: message,
    };
  }
}

const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "src");
const outputFile = path.join(sourceRoot, "app/admin/architecture/catalog.json");
const excludedDirectories = new Set(["node_modules", ".next", ".git", "coverage"]);

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) files.push(...walk(path.join(directory, entry.name)));
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function attribute(node, name) {
  return node.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.getText() === name
  );
}

function staticAttributeValue(node, name) {
  const found = attribute(node, name);
  if (!found || !found.initializer) return "";
  if (ts.isStringLiteral(found.initializer)) return found.initializer.text;
  if (ts.isJsxExpression(found.initializer) && found.initializer.expression) {
    const expression = found.initializer.expression;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  }
  return "";
}

function expressionAttribute(node, name, sourceFile) {
  const found = attribute(node, name);
  if (!found?.initializer || !ts.isJsxExpression(found.initializer) || !found.initializer.expression) return null;
  return found.initializer.expression;
}

function staticText(node) {
  const pieces = [];
  function visit(current) {
    if (ts.isJsxText(current)) {
      const text = current.text.replace(/\s+/g, " ").trim();
      if (text) pieces.push(text);
      return;
    }
    if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
      if (current.text.trim()) pieces.push(current.text.trim());
      return;
    }
    if (ts.isJsxExpression(current)) {
      if (!current.expression) return;
      function visitExpression(expression) {
        if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
          if (expression.text.trim()) pieces.push(expression.text.trim());
          return;
        }
        if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return;
        if (ts.isJsxElement(expression) || ts.isJsxFragment(expression)) {
          expression.children.forEach(visit);
          return;
        }
        ts.forEachChild(expression, visitExpression);
      }
      visitExpression(current.expression);
      return;
    }
    if (ts.isJsxElement(current) || ts.isJsxFragment(current)) {
      current.children.forEach(visit);
    }
  }
  (node.children || []).forEach(visit);
  return [...new Set(pieces)].join(" ").slice(0, 140);
}

function collectCallableDeclarations(sourceFile) {
  const declarations = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      declarations.set(node.name.text, node.initializer);
    }
    visitEach(node, visit);
  }
  visit(sourceFile);
  return declarations;
}

function visitEach(node, visit) {
  ts.forEachChild(node, visit);
}

function resolveExpression(expression, declarations, seen = new Set()) {
  if (!expression) return [];
  if (ts.isIdentifier(expression)) {
    if (seen.has(expression.text)) return [];
    const declaration = declarations.get(expression.text);
    if (!declaration) return [];
    const nextSeen = new Set(seen);
    nextSeen.add(expression.text);
    return [declaration, ...collectReferencedHandlers(declaration, declarations, nextSeen)];
  }
  return [expression, ...collectReferencedHandlers(expression, declarations, seen)];
}

function collectReferencedHandlers(node, declarations, seen) {
  const found = [];
  function visit(current) {
    if (ts.isCallExpression(current) && ts.isIdentifier(current.expression)) {
      const name = current.expression.text;
      const declaration = declarations.get(name);
      if (declaration && !seen.has(name)) {
        const nextSeen = new Set(seen);
        nextSeen.add(name);
        found.push(declaration, ...collectReferencedHandlers(declaration, declarations, nextSeen));
      }
    }
    visitEach(current, visit);
  }
  visit(node);
  return found;
}

function scanActionTargets(expressions, sourceFile, declarations) {
  const targets = new Set();
  const handlers = new Set();
  const visited = new Set();

  for (const expression of expressions) {
    if (ts.isIdentifier(expression)) handlers.add(expression.text);
    for (const resolved of resolveExpression(expression, declarations)) {
      if (visited.has(resolved)) continue;
      visited.add(resolved);
      function visit(node) {
        if (ts.isCallExpression(node)) {
          const call = node.expression;
          const callName = call.getText(sourceFile);
          const firstArg = node.arguments[0];
          const literalArg = firstArg && (
            ts.isStringLiteral(firstArg) ||
            ts.isNoSubstitutionTemplateLiteral(firstArg)
          ) ? firstArg.text : "";
              if (["fetch", "apiFetch", "router.push", "router.replace", "router.back"].includes(callName)) {
                const requestMethod = node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])
                  ? node.arguments[1].properties.find((property) =>
                      ts.isPropertyAssignment(property) && property.name.getText(sourceFile).replace(/["']/g, "") === "method"
                    )?.initializer
                  : null;
                const method = requestMethod && (ts.isStringLiteral(requestMethod) || ts.isNoSubstitutionTemplateLiteral(requestMethod))
                  ? `${requestMethod.text.toUpperCase()} `
                  : "";
                if (literalArg) targets.add(`${method}${callName}: ${literalArg}`);
            else if (callName.startsWith("router.")) targets.add(`${callName}()`);
            else targets.add(`${callName}() — مسار ديناميكي`);
          } else if (callName.endsWith(".push") && callName.includes("router")) {
            targets.add(`${callName}(${literalArg || "مسار ديناميكي"})`);
          }
        }
        visitEach(node, visit);
      }
      visit(resolved);
    }
  }

  return {
    handlers: [...handlers],
    targets: [...targets].slice(0, 12),
  };
}

function screenForFile(file) {
  const rel = relative(file);
  if (rel.startsWith("src/app/")) {
    if (rel.endsWith("/page.tsx")) {
      const withoutApp = rel.slice("src/app/".length);
      const pageIndex = withoutApp.lastIndexOf("/page.tsx");
      return pageIndex < 0
        ? "/"
        : `/${withoutApp.slice(0, pageIndex).replace(/\[([^\]]+)\]/g, ":$1")}`;
    }
  }
  return rel.replace(/^src\/components\//, "مكوّن / ");
}

function collectControls(sourceFile, sourceText, file) {
  if (!file.endsWith(".tsx") || file.endsWith("src/app/admin/architecture/page.tsx")) return [];
  const declarations = collectCallableDeclarations(sourceFile);
  const controls = [];
  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = opening.tagName.getText(sourceFile);
      const isLink = tag === "Link" || tag === "a";
      const isButton = tag === "button";
      const isForm = tag === "form";
      const isInput = tag === "input" &&
        ["button", "submit", "image"].includes(staticAttributeValue(opening, "type").toLowerCase());
      const clickExpression = expressionAttribute(opening, "onClick", sourceFile);
      const submitExpression = expressionAttribute(opening, "onSubmit", sourceFile);
      const changeExpression = expressionAttribute(opening, "onChange", sourceFile);
      const keyExpression = expressionAttribute(opening, "onKeyDown", sourceFile);
      const href = staticAttributeValue(opening, "href");
      const isInteractive = isLink || isButton || isInput || (isForm && Boolean(submitExpression)) ||
        Boolean(clickExpression) || Boolean(submitExpression) || Boolean(changeExpression) || Boolean(keyExpression);

      if (isInteractive) {
        const ariaLabel = staticAttributeValue(opening, "aria-label");
        const title = staticAttributeValue(opening, "title");
        const placeholder = staticAttributeValue(opening, "placeholder");
        const text = staticText(node);
        const kind = isLink ? "رابط" : isForm ? "إرسال نموذج" : isInput ? "زر نموذج" : "زر";
        const expressions = [clickExpression, submitExpression, changeExpression, keyExpression].filter(Boolean);
        const action = scanActionTargets(expressions, sourceFile, declarations);
        const destinations = [...action.targets];
        let dynamicHref = "";
        if (href) destinations.unshift(`href: ${href}`);
        else {
          const hrefExpression = expressionAttribute(opening, "href", sourceFile);
          if (hrefExpression) {
            dynamicHref = hrefExpression.getText(sourceFile).slice(0, 180);
            destinations.unshift(`href: ${dynamicHref}`);
          }
        }
        const line = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile)).line + 1;
        const fallbackLabel = action.handlers[0]
          ? `إجراء: ${action.handlers[0]}`
          : isLink && (href || dynamicHref)
            ? `رابط: ${href || dynamicHref}`
            : "عنصر تفاعلي بنص ديناميكي أو أيقونة";
        const label = (ariaLabel || title || placeholder || text || (isForm ? "نموذج إرسال" : isInput ? "إجراء نموذج" : fallbackLabel)).slice(0, 140);
        controls.push({
          id: `${relative(file)}:${line}:${controls.length}`,
          label,
          kind,
          screen: screenForFile(file),
          file: relative(file),
          line,
          handler: action.handlers.join(", "),
          destinations: [...new Set(destinations)].slice(0, 12),
          interaction: [
            clickExpression && "onClick",
            submitExpression && "onSubmit",
            changeExpression && "onChange",
            keyExpression && "onKeyDown",
          ].filter(Boolean).join(", "),
        });
      }
    }
    visitEach(node, visit);
  }
  visit(sourceFile);
  return controls;
}

function collectPageRoutes(files) {
  return files
    .filter((file) => file.endsWith("/page.tsx"))
    .filter((file) => !file.includes("/admin/architecture/"))
    .map((file) => {
      const rel = relative(file).replace(/^src\/app/, "").replace(/\/page\.tsx$/, "");
      const route = rel.replace(/\[([^\]]+)\]/g, ":$1") || "/";
      const source = fs.readFileSync(file, "utf8");
      const controls = controlsByFile.get(relative(file)) || [];
      return {
        route,
        file: relative(file),
        controls: controls.length,
        audience: route.startsWith("/admin")
          ? "مدير أو موظف"
          : route.startsWith("/dashboard")
            ? "معلن"
            : route.startsWith("/account")
              ? "مستخدم مسجل"
              : "زائر / مستخدم",
        summary: route.startsWith("/admin")
          ? "إدارة وتشغيل المنصة"
          : route.startsWith("/dashboard")
            ? "لوحة المعلن وإدارة عقاراته ومحادثاته"
            : route.startsWith("/account")
              ? "إعدادات وحساب المستخدم"
              : "واجهة عامة للزوار والمستخدمين",
        references: [...new Set([...source.matchAll(/(?:fetch|apiFetch)\(\s*["'`]([^"'`]+)["'`]/g)].map((match) => match[1]))].slice(0, 15),
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}

function collectApiRoutes(files) {
  return files
    .filter((file) => file.startsWith(path.join(sourceRoot, "app/api/")) && file.endsWith("/route.ts"))
    .map((file) => {
      const rel = relative(file);
      const route = rel.replace(/^src\/app/, "").replace(/\/route\.ts$/, "").replace(/\[([^\]]+)\]/g, ":$1");
      const text = fs.readFileSync(file, "utf8");
      const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const methods = [];
      for (const statement of sourceFile.statements) {
        const isExported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
        if (!isExported) continue;
        if (ts.isFunctionDeclaration(statement) && statement.name && /^(GET|POST|PUT|PATCH|DELETE)$/.test(statement.name.text)) {
          methods.push(statement.name.text);
        }
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name) && /^(GET|POST|PUT|PATCH|DELETE)$/.test(declaration.name.text)) {
              methods.push(declaration.name.text);
            }
          }
        }
      }
      const tables = [...new Set([...text.matchAll(/\.from\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1]))];
      const stores = [...new Set([...text.matchAll(/dbStore\.([A-Za-z_$][\w$]*)/g)].map((match) => match[1]))];
      const services = [...new Set([...text.matchAll(/from\s+["']@\/lib\/services\/([^"']+)["']/g)].map((match) => match[1]))];
      return { route, file: rel, methods, tables, stores, services };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}

const files = walk(sourceRoot);
const controlsByFile = new Map();
const controls = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const extracted = collectControls(sourceFile, text, file);
  if (extracted.length) controlsByFile.set(relative(file), extracted);
  controls.push(...extracted);
}

const catalog = {
  scope: "فهرس ثابت مستخرج من ملفات المصدر؛ لتحديثه شغّل npm run architecture:catalog. بعض الأزرار أو الوجهات الديناميكية الموروثة عبر مكونات وخدمات مساعدة تحتاج تتبعًا يدويًا.",
  counts: {
    screens: files.filter((file) => file.endsWith("/page.tsx") && !file.includes("/admin/architecture/")).length,
    apiRoutes: files.filter((file) => file.startsWith(path.join(sourceRoot, "app/api/")) && file.endsWith("/route.ts")).length,
    controls: controls.length,
    controlFiles: controlsByFile.size,
  },
  screens: collectPageRoutes(files),
  controls: controls.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
  apiRoutes: collectApiRoutes(files),
};

fs.writeFileSync(outputFile, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Generated ${catalog.counts.screens} screens, ${catalog.counts.controls} controls, and ${catalog.counts.apiRoutes} API routes.`);

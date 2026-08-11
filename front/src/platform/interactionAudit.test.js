import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    if (!/\.jsx?$/.test(entry.name) || entry.name.endsWith('.test.js') || entry.name.endsWith('.test.jsx')) return [];
    return [entryPath];
  });
}

function attribute(node, name) {
  return node.attributes.find((item) => item.type === 'JSXAttribute' && item.name.name === name);
}

describe('platform interaction audit', () => {
  test('interactive controls are explicit and have an action', () => {
    const platformRoot = path.resolve(__dirname);
    const violations = [];

    sourceFiles(platformRoot).forEach((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });

      traverse(ast, {
        JSXOpeningElement({ node }) {
          const elementName = node.name.type === 'JSXIdentifier' ? node.name.name : null;
          if (elementName !== 'button' && elementName !== 'PlatformButton') return;

          const type = attribute(node, 'type');
          const onClick = attribute(node, 'onClick');
          const disabled = attribute(node, 'disabled');
          const isSubmit = type?.value?.type === 'StringLiteral' && type.value.value === 'submit';

          if (elementName === 'button' && !type) {
            violations.push(`${path.relative(platformRoot, filePath)}:${node.loc.start.line} — button without explicit type`);
          }
          if (!onClick && !disabled && !isSubmit) {
            violations.push(`${path.relative(platformRoot, filePath)}:${node.loc.start.line} — ${elementName} without action`);
          }
        },
      });
    });

    expect(violations).toEqual([]);
  });
});

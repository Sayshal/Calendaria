import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    plugins: { jsdoc },
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        foundry: 'readonly',
        game: 'readonly',
        ui: 'readonly',
        Hooks: 'readonly',
        CONFIG: 'readonly',
        fromUuid: 'readonly',
        fromUuidSync: 'readonly',
        JournalEntry: 'readonly',
        Folder: 'readonly',
        CONST: 'readonly',
        ChatMessage: 'readonly',
        canvas: 'readonly',
        Macro: 'readonly',
        Handlebars: 'readonly',
        TextEditor: 'readonly',
        Roll: 'readonly',
        ...globals.browser,
        ...globals.jquery,
        ...globals.node
      },
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    settings: { jsdoc: { mode: 'jsdoc', preferredTypes: { '.<>': '<>', Object: 'object' }, tagNamePreference: { auguments: 'extends' } } },
    rules: {
      'no-eval': 'error',
      eqeqeq: ['warn', 'smart'],
      'no-var': 'warn',
      'prefer-object-spread': 'warn',
      'prefer-template': 'warn',
      'no-unused-vars': ['warn', { args: 'all', argsIgnorePattern: '^_' }],
      'no-case-declarations': 'off',
      'no-const-assign': 'error',
      'constructor-super': 'error',
      'no-this-before-super': 'error',
      'getter-return': ['warn', { allowImplicit: true }],
      'no-duplicate-imports': ['warn', { includeExports: true }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-unsafe-optional-chaining': ['warn', { disallowArithmeticOperators: true }],
      'jsdoc/require-jsdoc': [
        'warn',
        {
          require: { FunctionDeclaration: true, MethodDefinition: true, ClassDeclaration: true },
          contexts: [
            'ExportNamedDeclaration > FunctionDeclaration',
            'ExportDefaultDeclaration > FunctionDeclaration',
            'MethodDefinition[static=true]',
            'ClassDeclaration[id.name=/Manager$/] > ClassBody > MethodDefinition',
            'MethodDefinition[key.name=/^handle/]',
            'Property[key.name] > FunctionExpression'
          ],
          exemptEmptyFunctions: false,
          publicOnly: false,
          enableFixer: false
        }
      ],
      'jsdoc/require-param': ['warn', { exemptedBy: ['inheritdoc', 'override'] }],
      'jsdoc/require-param-description': ['warn', { contexts: ['FunctionDeclaration', 'MethodDefinition'] }],
      'jsdoc/require-param-name': 'warn',
      'jsdoc/require-property': 'warn',
      'jsdoc/require-property-name': 'warn',
      'jsdoc/require-returns': ['warn', { contexts: ['FunctionDeclaration', 'MethodDefinition'], exemptedBy: ['inheritdoc', 'override', 'constructor'] }],
      'jsdoc/require-returns-check': 'warn',
      'jsdoc/require-returns-description': ['warn', { contexts: ['FunctionDeclaration', 'MethodDefinition'] }],
      'jsdoc/require-yields': 'warn',
      'jsdoc/require-yields-check': 'warn'
    }
  },
  jsdoc.configs['flat/recommended'],
  { files: ['**/*.mjs'], rules: { 'no-undef': 'off' } },
  { ignores: ['**/node_modules/*', '**/coverage/*', '**/dev/__mocks__/*', 'foundry/**', 'dnd5e/**', 'dist/**'] }
];

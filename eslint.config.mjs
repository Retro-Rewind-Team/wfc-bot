// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import import_plugin from "eslint-plugin-import";

export default tseslint.config(
    { ignores: [ "./build/**/*.js" ] },
    {
        files: [ "./src/**/*.ts" ],
        plugins: {
            "@stylistic": stylistic,
            "import": import_plugin,
        },
        extends: [
            eslint.configs.recommended,
            tseslint.configs.recommended,
        ],
        languageOptions: {
            parserOptions: {
                projectService: true,
            },
        },
        rules: {
            "brace-style": ["error", "stroustrup"],
            curly: ["error", "multi-or-nest"],
            indent: ["error", 4, {
                SwitchCase: 0,
            }],
            "nonblock-statement-body-position": ["error", "below"],
            "no-restricted-globals": [
                "error",
                {
                    name: "fetch",
                    message: "Use imported fetch instead.",
                },
            ],
            "no-restricted-imports": ["error", {
                patterns: [".*"],
            }],
            "no-trailing-spaces": "error",
            quotes: ["warn", "double"],
            semi: ["warn", "always"],
            "sort-imports": ["error", {
                ignoreCase: true,
                ignoreDeclarationSort: true,
                ignoreMemberSort: false,
            }],
            "@typescript-eslint/explicit-function-return-type": "error",
            "@typescript-eslint/no-floating-promises": ["error"],
            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_",
            }],
            "@stylistic/comma-dangle": ["error", "always-multiline"],
            "@stylistic/member-delimiter-style": ["error", {
                multiline: {
                    delimiter: "semi",
                    requireLast: true,
                },
                singleline: {
                    delimiter: "semi",
                    requireLast: false,
                },
                multilineDetection: "brackets",
            }],
            "import/order": ["error", {
                alphabetize: {
                    order: "asc",
                    caseInsensitive: true,
                },
                distinctGroup: false,
                groups: [
                    "builtin",
                    "external",
                ],
                "newlines-between": "never",
                pathGroups: [
                    {
                        pattern: "#src/*",
                        group: "external",
                        position: "after",
                    },
                ],
            }],
        },
    },
);

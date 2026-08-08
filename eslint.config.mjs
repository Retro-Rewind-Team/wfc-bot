// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

export default tseslint.config(
    { ignores: [ "./build/**/*.js" ] },
    {
        files: [ "./src/**/*.ts" ],
        plugins: {
            "@stylistic": stylistic,
        },
        extends: [
            eslint.configs.recommended,
            tseslint.configs.recommended,
        ],
        languageOptions: {
            parserOptions: {
                projectService: true,
            }
        },
        rules: {
            indent: ["error", 4, {
                SwitchCase: 0,
            }],
            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_"
            }],
            semi: ["warn", "always"],
            quotes: ["warn", "double"],
            "sort-imports": ["error", {
                ignoreCase: true,
                ignoreDeclarationSort: true,
                ignoreMemberSort: false,
            }],
            curly: ["error", "multi-or-nest"],
            "brace-style": ["error", "stroustrup"],
            "no-trailing-spaces": "error",
            "nonblock-statement-body-position": ["error", "below"],
            "@typescript-eslint/no-floating-promises": ["error"],
            "@typescript-eslint/explicit-function-return-type": "error",
            "no-restricted-globals": [
                "error",
                {
                    name: "fetch",
                    message: "Use imported fetch instead."
                }
            ],
            "no-restricted-imports": ["error", {
                patterns: [".*"]
            }],
            "@stylistic/member-delimiter-style": ["error", {
                multiline: {
                    delimiter: "semi",
                    requireLast: true
                },
                singleline: {
                    delimiter: "semi",
                    requireLast: false
                },
                multilineDetection: "brackets"
            }],
            "@stylistic/comma-dangle": ["error", "always-multiline"],
        },
    }
);

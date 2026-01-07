// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config({
    files: ["**/*.ts"],
    extends: [
        eslint.configs.recommended,
        tseslint.configs.recommended,
    ],
    rules: {
        indent: ["error", 4, {
            "SwitchCase": 0,
        }],
        "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
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
    },
});

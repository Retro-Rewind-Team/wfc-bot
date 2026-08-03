import { SharedInitializer } from "./command.js";
import { unknownWiiLinkError, WiiLinkErrorDef, wiiLinkErrorDefs } from "./error_defs.js";
import * as fs from "fs/promises";

const WIILINK_ERROR_ADDENDUM_PATH = "./wiilink_error_addendum.json";

export function getWiiLinkErrorDef(error: number): WiiLinkErrorDef {
    const errorStr = error.toString();

    let ret: WiiLinkErrorDef = unknownWiiLinkError;

    for (const errorDef of Object.values(wiiLinkErrorDefs)) {
        if (errorStr.match(errorDef.regex))
            ret = errorDef;

        // Prioritize exact matches
        if (errorStr == errorDef.regex)
            return errorDef;
    }

    return ret;
}

export interface WiiLinkErrorAddendum {
    // Used to replace sections from Wiimmfi
    overrides: Record<string, string | null>;
    comments: string[];
}

let wiiLinkErrorAddendums: Record<number, WiiLinkErrorAddendum> = {};

export function getWiiLinkErrorAddendum(ecode: number): WiiLinkErrorAddendum {
    return wiiLinkErrorAddendums[ecode] ?? { overrides: {}, comments: [] };
}

export async function setWiiLinkErrorAddendum(ecode: number, addendum: WiiLinkErrorAddendum): Promise<void> {
    wiiLinkErrorAddendums[ecode] = addendum;
    await fs.writeFile(WIILINK_ERROR_ADDENDUM_PATH, JSON.stringify(wiiLinkErrorAddendums, null, 4));
}

export const initializer: SharedInitializer = {
    init: async function(): Promise<void> {
        let exists = true;
        try {
            await fs.stat(WIILINK_ERROR_ADDENDUM_PATH);
        }
        catch {
            exists = false;
        }

        try {
            if (!exists) {
                await fs.writeFile(
                    WIILINK_ERROR_ADDENDUM_PATH,
                    JSON.stringify(wiiLinkErrorAddendums, null, 4)
                );
            }
            else {
                const body = await fs.readFile(WIILINK_ERROR_ADDENDUM_PATH, { encoding: "utf8" });
                wiiLinkErrorAddendums = JSON.parse(body);
            }
        }
        catch (error) {
            console.error(`Failed to read from ${WIILINK_ERROR_ADDENDUM_PATH}`, error);
        }
    }
};

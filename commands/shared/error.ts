import { unknownWiiLinkError, WiiLinkErrorDef, wiiLinkErrorDefs } from "./error_defs.js";
import * as fs from "fs/promises";

const WIILINK_ERROR_COMMENTS_PATH = "./wiilink_error_comments.json";

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

let wiiLinkErrorComments: Record<number, string[]> = {};

export function getWiiLinkErrorComments(ecode: number): string[] | null {
    return wiiLinkErrorComments[ecode];
}

export async function setWiiLinkErrorComments(ecode: number, comments: string[]): Promise<void> {
    wiiLinkErrorComments[ecode] = comments;
    await fs.writeFile(WIILINK_ERROR_COMMENTS_PATH, JSON.stringify(wiiLinkErrorComments, null, 4));
}

export default {
    init: async function(): Promise<void> {
        let exists = true;
        try {
            await fs.stat(WIILINK_ERROR_COMMENTS_PATH);
        }
        catch {
            exists = false;
        }

        try {
            if (!exists) {
                await fs.writeFile(
                    WIILINK_ERROR_COMMENTS_PATH,
                    JSON.stringify(wiiLinkErrorComments, null, 4)
                );
            }
            else {
                const body = await fs.readFile(WIILINK_ERROR_COMMENTS_PATH, { encoding: "utf8" });
                wiiLinkErrorComments = JSON.parse(body);
            }
        }
        catch (error) {
            console.error(`Failed to read from ${WIILINK_ERROR_COMMENTS_PATH}`, error);
        }
    }
};

import * as fs from "fs/promises";

export async function fileExists(path: string): Promise<boolean> {
    try {
        await fs.stat(path);
    }
    catch {
        return false;
    }

    return true;
}

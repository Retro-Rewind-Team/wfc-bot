import { getConfig } from "../../config.js";
import { makeRequest, resolvePidFromString, validateID } from "../../utils.js";

// Name lengths are 10, each char is 2 bytes
const NAME_LEN = 10;
// Mii creation date is measured from 2006
const START_DATE = new Date(2006, 0, 1).getTime();
const config = getConfig();

export interface MiiData {
    fileName: string | null,
    name: string,
    creatorName: string,
    miiID: number,
    sysID: number,
    idStyleBits: number,
    creationDate: Date,
}

function readNameFromBuf(buffer: Buffer, offset: number): string {
    let i = 0;
    while (buffer.readUint16BE(offset + i * 2) != 0 && i < NAME_LEN)
        i++;

    const utf16_buf = Buffer.copyBytesFrom(buffer, offset, i * 2);
    const decoder = new TextDecoder("utf-16be");

    return decoder.decode(utf16_buf);
}

export function processMiiBuf(fileName: string | null, buffer: Buffer): MiiData {
    // From https://wiibrew.org/wiki/Mii_data#Mii_format
    const miiName = readNameFromBuf(buffer, 0x02);
    const creatorName = readNameFromBuf(buffer, 0x36);

    const miiID = buffer.readUint32BE(0x18);
    const miiDate = new Date(START_DATE);
    // Timestamp is stored as 4 second intervals since 2006/0/1,
    // Only bottom 29 bits needed.
    const miiTimeStamp = ((miiID << 3) >>> 3) * 4;
    miiDate.setSeconds(miiDate.getSeconds() + miiTimeStamp);
    const sysID = buffer.readUint32BE(0x1C);

    return {
        fileName: fileName,
        name: miiName,
        creatorName: creatorName,
        miiID: miiID,
        sysID: sysID,
        creationDate: miiDate,
        idStyleBits: (miiID >>> 29),
    };
}

export async function getMiiBuf(pidOrFC: string, sanitized: boolean): Promise<[Buffer | null, string | null]> {
    let id = pidOrFC;
    id = id.trim();

    const [valid, err] = validateID(id);
    if (!valid)
        return [null, `Error retrieving Mii for friend code or pid "${id}": ${err}`];

    const pid = resolvePidFromString(id);
    const [success, res] = await makeRequest("/api/mii", "POST", {
        secret: sanitized ? null: config.wfcSecret,
        pid: pid
    });

    if (!success) {
        return [
            null,
            `Failed to retrieve mii for friend code "${id}": error ${res.Error ?? "no error message provided"}`
        ];
    }

    return [ Buffer.from(res.Mii, "base64"), null ];
}

export function formatMiiData(mii: MiiData): string {
    let ret = "";

    if (mii.fileName)
        ret += `Mii File: ${mii.fileName}\n`;

    ret += `Mii Name: ${mii.name}\n`;

    if (mii.creatorName != "")
        ret += `Creator: ${mii.creatorName}\n`;

    if (((mii.miiID) >> 3) > 0)
        ret += `MiiID: ${mii.miiID.toString(16)}\n`;

    if (mii.sysID > 0)
        ret += `SysID: ${mii.sysID.toString(16)}\n`;

    if (mii.creationDate.getTime() != START_DATE)
        ret += `Mii Creation Date: ${mii.creationDate.toLocaleString()}\n`;

    if (!(mii.idStyleBits & 0b111))
        return ret.trimEnd();

    ret += "Mii Special Style Bits: ";

    if (mii.idStyleBits & 0b100)
        ret += "Special (Gold Pants), ";

    if (mii.idStyleBits & 0b010)
        ret += "Foreign (Blue Pants), ";

    if (mii.idStyleBits & 0b001)
        ret += "Regular (Gray Pants), ";

    return ret.substring(0, ret.length - 2);
}

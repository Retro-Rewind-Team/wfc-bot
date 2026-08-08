import { EmbedBuilder } from "discord.js";
import { getConfig } from "#src/config.js";
import { getColor, getMiiImageURL, makeWFCRequest, resolvePidFromString, validateID } from "#src/utils.js";

// Name lengths are 10, each char is 2 bytes
const NAME_LEN = 10;
// Mii creation date is measured from 2006
const START_DATE = new Date(2006, 0, 1).getTime();
const config = getConfig();

export interface MiiData {
    fileName: string | null;
    name: string;
    creatorName: string;
    birthDay: number;
    birthMonth: number;
    miiID: number;
    sysID: number;
    idStyleBits: number;
    creationDate: Date;
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

    const info = buffer.readUint16BE(0x00);
    const birthMonth = info >>> 10 & 0b1111;
    const birthDay = info >>> 5 & 0b11111;

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
        birthDay: birthDay,
        birthMonth: birthMonth,
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
    const [success, res] = await makeWFCRequest("/mii", "POST", {
        secret: sanitized ? null : config.wfcSecret,
        pid: pid,
    });

    if (!success) {
        return [
            null,
            `Failed to retrieve mii for friend code "${id}": error ${res.Error ?? "no error message provided"}`,
        ];
    }

    return [ Buffer.from(res.Mii, "base64"), null ];
}

export function createMiiEmbed(mii: MiiData, fc?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(getColor())
        .setTimestamp();

    if (mii.fileName)
        embed.addFields({ name: "Mii File", value: mii.fileName });

    embed.addFields({ name: "Mii Name", value: mii.name });


    if (fc) {
        embed.setThumbnail(getMiiImageURL(fc));
        embed.addFields(
            { name: "Profile ID", value: resolvePidFromString(fc).toString() },
            { name: "Friend Code", value: fc },
        );
    }

    if (mii.creatorName != "")
        embed.addFields({ name: "Creator", value: mii.creatorName });

    if (mii.birthMonth != 0 && mii.birthDay != 0) {
        embed.addFields({
            name: "Birth Date",
            value: `${mii.birthMonth }/${mii.birthDay }`,
        });
    }

    if (((mii.miiID) >> 3) > 0)
        embed.addFields({ name: "MiiID", value: mii.miiID.toString(16) });

    if (mii.sysID > 0)
        embed.addFields({ name: "SysID", value: mii.sysID.toString(16) });

    if (mii.creationDate.getTime() != START_DATE) {
        embed.addFields({
            name: "Mii Creation Date",
            value: mii.creationDate.toLocaleString(),
        });
    }

    if (!(mii.idStyleBits & 0b111))
        return embed;

    const styles: string[] = [];

    if (mii.idStyleBits & 0b100)
        styles.push("Special (Gold Pants)");

    if (mii.idStyleBits & 0b010)
        styles.push("Foreign (Blue Pants)");

    if (mii.idStyleBits & 0b001)
        styles.push("Regular (Gray Pants)");

    embed.addFields({ name: "Mii Special Style Bits", value: styles.join(", ")});

    return embed;
}

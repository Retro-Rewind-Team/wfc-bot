const RKSYS_SIZE = 0x2BC000;
const GLOBAL_CRC_OFFSET = 0x27FFC;
const LICENSE_BASE = 0x08;
const LICENSE_SIZE = 0x8CC0;
const DWC_OFFSET = 0x40;
const DWC_DATA_LENGTH = 0x3C;
const DWC_LENGTH = 0x40;

const DWC_PSEUDO_PLAYER_ID_OFFSET = 0x0C;
const DWC_AUTHENTIC_PLAYER_ID_OFFSET = 0x18;
const DWC_PROFILE_ID_OFFSET = 0x1C;
const RADIX32_ALPHABET = "0123456789abcdefghijklmnopqrstuv";

export function decodeDwcPlayerId(gsbrCode: string): number {
    const code = gsbrCode.trim().toLowerCase();
    if (!code.startsWith("rmcj") || code.length <= 4 || code.length > 11)
        throw new Error("gsbr code does not contain an MKW DWC Player ID");

    let playerId = 0;
    for (const character of code.slice(4)) {
        const digit = RADIX32_ALPHABET.indexOf(character);
        if (digit < 0)
            throw new Error("gsbr code contains an invalid DWC Player ID");

        playerId = playerId * 32 + digit;
    }

    if (playerId <= 0 || playerId > 0xFFFFFFFF)
        throw new Error("gsbr code contains an invalid DWC Player ID");

    return playerId;
}

function crc32(buffer: Buffer, start: number, end: number): number {
    let crc = 0xFFFFFFFF;

    for (let offset = start; offset < end; offset++) {
        crc ^= buffer[offset];

        for (let bit = 0; bit < 8; bit++)
            crc = (crc & 1) != 0 ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dwcCrc32(buffer: Buffer, base: number): number {
    const reversed = Buffer.alloc(DWC_DATA_LENGTH);

    for (let offset = 0; offset < DWC_DATA_LENGTH; offset += 4) {
        reversed[offset] = buffer[base + offset + 3];
        reversed[offset + 1] = buffer[base + offset + 2];
        reversed[offset + 2] = buffer[base + offset + 1];
        reversed[offset + 3] = buffer[base + offset];
    }

    return crc32(reversed, 0, reversed.length);
}

function isZeroRange(buffer: Buffer, start: number, length: number): boolean {
    for (let offset = 0; offset < length; offset++) {
        if (buffer[start + offset] != 0)
            return false;
    }

    return true;
}

function licenseBase(license: number): number {
    return LICENSE_BASE + ((license - 1) * LICENSE_SIZE);
}

function dwcBase(license: number): number {
    return licenseBase(license) + DWC_OFFSET;
}

function hasMagic(buffer: Buffer, offset: number, magic: string): boolean {
    return buffer.subarray(offset, offset + magic.length).toString("ascii") == magic;
}

function validateRksys(buffer: Buffer, license: number): void {
    if (buffer.length != RKSYS_SIZE)
        throw new Error(`Invalid rksys.dat size: got ${buffer.length} bytes, expected ${RKSYS_SIZE}.`);

    if (!hasMagic(buffer, 0, "RKSD"))
        throw new Error("Invalid rksys.dat magic; expected RKSD.");

    if (buffer.subarray(4, 8).toString("ascii") != "0006")
        throw new Error("Unsupported rksys.dat version; expected save version 0006.");

    if (license < 1 || license > 4)
        throw new Error("License number must be between 1 and 4.");

    if (!hasMagic(buffer, licenseBase(license), "RKPD"))
        throw new Error(`License ${license} does not contain a valid RKPD block.`);
}

function findDwcTemplate(buffer: Buffer, targetLicense: number): number | null {
    const target = dwcBase(targetLicense);
    if (!isZeroRange(buffer, target, DWC_DATA_LENGTH))
        return target;

    for (let license = 1; license <= 4; license++) {
        const candidate = dwcBase(license);
        if (!isZeroRange(buffer, candidate, DWC_DATA_LENGTH)
            && buffer.readUInt32BE(candidate) == DWC_LENGTH)
            return candidate;
    }

    return null;
}

export function recoverRksys(input: Buffer, license: number, profileId: number, dwcPlayerId: number): Buffer {
    validateRksys(input, license);

    if (!Number.isInteger(profileId) || profileId <= 0 || profileId > 0xFFFFFFFF)
        throw new Error("Profile ID must be a non-zero unsigned 32-bit integer.");

    if (!Number.isInteger(dwcPlayerId) || dwcPlayerId <= 0 || dwcPlayerId > 0xFFFFFFFF)
        throw new Error("DWC Player ID must be a non-zero unsigned 32-bit integer.");

    const output = Buffer.from(input);
    const target = dwcBase(license);
    const template = findDwcTemplate(output, license);

    if (template == null) {
        throw new Error(
            "The save has no populated DWC Auth Data block to recover from. " +
            "A faithful recovery requires the original block's console-specific user IDs."
        );
    }

    if (template != target)
        output.copy(output, target, template, template + DWC_LENGTH);

    output.writeUInt32BE(DWC_LENGTH, target);
    output.writeUInt32BE(dwcPlayerId >>> 0, target + DWC_PSEUDO_PLAYER_ID_OFFSET);
    output.writeUInt32BE(dwcPlayerId >>> 0, target + DWC_AUTHENTIC_PLAYER_ID_OFFSET);
    output.writeUInt32BE(profileId >>> 0, target + DWC_PROFILE_ID_OFFSET);
    output.writeUInt32BE(dwcCrc32(output, target), target + DWC_DATA_LENGTH);
    output.writeUInt32BE(crc32(output, 0, GLOBAL_CRC_OFFSET), GLOBAL_CRC_OFFSET);

    return output;
}

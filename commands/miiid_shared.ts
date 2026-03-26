// Name lengths are 10, each char is 2 bytes
const NAME_LEN = 10;

export interface MiiData {
    name: string,
    creator: string,
    miiID: number,
    sysID: number,
    date: Date,
}

function readNameFromBuf(buffer: Buffer, offset: number): string {
    let i = 0;
    while (buffer.readUint16BE(offset + i * 2) != 0 && i < NAME_LEN)
        i++;

    const utf16_buf = Buffer.copyBytesFrom(buffer, offset, i * 2);
    const decoder = new TextDecoder("utf-16be");

    return decoder.decode(utf16_buf);
}

export function processMiiBuf(buffer: Buffer): MiiData {
    // From https://wiibrew.org/wiki/Mii_data#Mii_format
    const miiName = readNameFromBuf(buffer, 0x02);
    const creatorName = readNameFromBuf(buffer, 0x36);

    const miiID = buffer.readUint32BE(0x18);
    // Jan 1, 2006
    const miiDate = new Date(2006, 0, 1);
    // Timestamp is stored as 4 second intervals since 2006/0/1,
    // Only bottom 29 bits needed.
    const miiTimeStamp = ((miiID << 3) >>> 3) * 4;
    miiDate.setSeconds(miiDate.getSeconds() + miiTimeStamp);
    const sysID = buffer.readUint32BE(0x1C);

    return {
        name: miiName,
        creator: creatorName,
        miiID: miiID,
        sysID: sysID,
        date: miiDate,
    };
}

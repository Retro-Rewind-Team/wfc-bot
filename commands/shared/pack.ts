const RRID = 0x0A;
const CTGPCID = 0x29C;
const IKWID = 0x49;
const LID = 0x29A;
const OPID = 0x36B;
const WTPID = 0x520;

export const PackOpts = [
    { name: "Retro Rewind", value: RRID },
    { name: "CTGP-C", value: CTGPCID },
    { name: "Insane Kart Wii", value: IKWID },
    { name: "Luminous", value: LID },
    { name: "OptPack", value: OPID },
    { name: "WTP", value: WTPID }
];

export function packIDToName(packID: number) {
    switch (packID) {
    case RRID:
        return "Retro Rewind";
    case CTGPCID:
        return "CTGP-C";
    case IKWID:
        return "Insane Kart Wii";
    case LID:
        return "Luminous";
    case OPID:
        return "OptPack";
    case WTPID:
        return "WTP";
    default:
        return "Unknown Pack";
    }
}

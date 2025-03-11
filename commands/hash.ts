import { CacheType, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import crypto from "crypto";
import { client } from "../index.js";
import config from "../config.json" with { type: "json" };
import { getColor, makeRequest } from "../utils.js";

const RRID = 0x08;
const CTGPCID = 0x29C;
const IKWID = 0x49;
const LID = 0x29A;
const OPID = 0x36B;
const WTPID = 0x520;

function packIDToName(packID: number) {
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

async function sendEmbed(packID: number, version: number, hashResponses: HashResponse[]) {
    const embed = new EmbedBuilder()
        .setColor(getColor())
        .setTitle(`Updated hashes for ${packIDToName(packID)}, version ${version}`);

    for (let i = 0; i < 4; i++) {
        const hashResponse = hashResponses[i];

        if (hashResponse)
            embed.addFields({
                name: hashResponse.regionName,
                value: `Hash: ${hashResponse.hash}\nMagic: ${hashResponse.magic}\nOffset: ${hashResponse.offset}`,
            });
        else
            embed.addFields({
                name: regionIdxToName(i),
                value: "None",
            });
    }

    await (client.channels.cache.get(config["logs-channel"]) as TextChannel | null)?.send({ embeds: [embed] });
}

interface HashResponse {
    hash: string,
    regionName: string,
    offset: number,
    magic: bigint,
}

function regionIdxToName(idx: number): string {
    switch (idx) {
        case 0:
            return "PAL";
        case 1:
            return "NTSC-U";
        case 2:
            return "NTSC-J";
        case 3:
            return "NTSC-K";
        default:
            return "Unknown Region";
    }
}

export default {
    modOnly: false,
    adminOnly: true,

    data: new SlashCommandBuilder()
        .setName("hash")
        .setDescription("Update code.pul hash")
        .addIntegerOption(option => option.setName("packid")
            .setDescription("Pack to update")
            .setChoices(
                { name: "Retro Rewind", value: RRID },
                { name: "CTGP-C", value: CTGPCID },
                { name: "Insane Kart Wii", value: IKWID },
                { name: "Luminous", value: LID },
                { name: "OptPack", value: OPID },
                { name: "WTP", value: WTPID })
            .setRequired(true))
        .addIntegerOption(option => option.setName("version")
            .setDescription("Version of code.pul to update")
            .setRequired(true))
        .addAttachmentOption(option => option.setName("binary")
            .setDescription("Code.pul binary to hash")
            .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        const packID = interaction.options.getInteger("packid", true);
        const version = interaction.options.getInteger("version", true);
        const binaryAttachment = interaction.options.getAttachment("binary", true);
        const binaryResponse = await fetch(binaryAttachment.url);

        if (!binaryResponse.ok) {
            await interaction.reply({
                content: `Error fetching payload attachment: ${binaryResponse.status}`
            });
            return;
        }

        const hashes: HashResponse[] = new Array(4);
        try {
            // Credit rambo (https://github.com/EpicUsername12)
            const buffer = Buffer.from(await binaryResponse.arrayBuffer());
            const regionSizes = [];
            for (let i = 0; i < 4; i++) {
                regionSizes.push(buffer.readUint32BE(i * 4));
            }

            for (let i = 0; i < 4; i++) {
                if (regionSizes[i] === 0) {
                    console.log("Region", regionIdxToName(i), "is empty");
                    continue;
                }

                const offset = 0x10 + regionSizes.slice(0, i).reduce((a, b) => a + b, 0);
                const header = buffer.subarray(offset, offset + 0x20);
                const size = header.readUint32BE(0xc); // codeSize
                const data = buffer.subarray(offset + 0x20, offset + 0x20 + size);

                hashes[i] = {
                    hash: crypto
                        .createHash("sha1")
                        .update(data)
                        .digest("hex"),
                    regionName: regionIdxToName(i),
                    offset: offset,
                    magic: header.readBigUint64BE(0),
                };
            }
        }
        catch (e) {
            await interaction.reply({
                content: `Failed to calculate hashes for pack: ${packIDToName(packID)}, version: ${version}, error: ${e}`
            });
            return;
        }

        console.log(`Calculated hashes for ${packIDToName(packID)}, version ${version}`);
        for (let i = 0; i < 4; i++) {
            const hashResponse = hashes[i];
            if (hashResponse)
                console.log(`Region: ${hashResponse.regionName}, Hash: ${hashResponse.hash}, Magic: ${hashResponse.magic}, Offset: ${hashResponse.offset}`);
            else
                console.log(`Region: ${regionIdxToName(i)}, None`);
        }

        const [success, res] = await makeRequest("/api/hash", "POST", {
            secret: config["wfc-secret"],
            pack_id: packID,
            version: version,
            hash_ntscu: hashes[1].hash,
            hash_ntscj: hashes[2].hash,
            hash_pal: hashes[0].hash,
        });

        if (success) {
            await sendEmbed(interaction.member as GuildMember | null, packID, version, hashes);
            let content = `Updated hashes for ${packIDToName(packID)}, version ${version}`;

            for (let i = 0; i < 4; i++) {
                const hashResponse = hashes[i];
                if (hashResponse)
                    content += `\nRegion: ${hashResponse.regionName}, Hash: ${hashResponse.hash}, Magic: ${hashResponse.magic}, Offset: ${hashResponse.offset}`;
                else
                    content += `\nRegion: ${regionIdxToName(i)}, None`;
            }

            console.log(`Successfully updated hashes for ${packIDToName(packID)}`);
            await interaction.reply({ content: content });
        }
        else {
            const content = `Failed to update pack: ${packIDToName(packID)}, version: ${version}, error: ${res.Error ?? "no error message provided"}`;
            console.error(content);
            await interaction.reply({
                content: content
            });
        }
    }
};

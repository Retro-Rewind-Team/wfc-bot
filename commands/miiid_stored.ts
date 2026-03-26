import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { processMiiBuf } from "./miiid_shared.js";
import { makeRequest, resolvePidFromString, validateID } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("miiid_stored")
        .setDescription("Extract the miiid field for a pid or fc")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to kick")
            .setRequired(true)),


    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({ content: `Error kicking friend code or pid "${id}": ${err}` });
            return;
        }

        const pid = resolvePidFromString(id);
        const [success, res] = await makeRequest("/api/mii", "POST", { secret: config.wfcSecret, pid: pid });

        if (!success) {
            await interaction.reply({ content: `Failed to retrieve mii for friend code "${id}": error ${res.Error ?? "no error message provided"}` });

            return;
        }

        const buffer = Buffer.from(res.Mii, "base64");
        const mii = processMiiBuf(buffer);

        await interaction.reply({
            content: `Mii Name: ${mii.name}\n`
                + `Creator: ${mii.creator}\n`
                + `MiiID: ${mii.miiID.toString(16)}\n`
                + `SysID: ${mii.sysID.toString(16)}\n`
                + `Mii TimeStamp: ${mii.date.toLocaleString()}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};

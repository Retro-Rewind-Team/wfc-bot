import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { haste, makeRequest, pidToFc, resolveModRestrictPermission, resolvePidFromString, validateID } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();


export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("investigate")
        .setDescription("Search all associated data for a user")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to ban")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({
                content: `Error investigating friend code or pid "${id}": ${err}`,
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);
        const [success, res] = await makeRequest("/api/investigate", "POST", {
            secret: config.wfcSecret,
            pid: pid,
        });

        if (!success) {
            await interaction.reply({
                content: `Failed to investigate friend code "${fc}": error ${res.Error ?? "no error message provided"}`,
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        let output = "";

        const resKeys = Object.keys(res);
        for (const key of resKeys) {
            if (key == "Success" || key == "Error")
                continue;

            output += `${key}:\n    `;

            for (let i = 0; i < res[key].length; i++) {
                if (i == res[key].length - 1)
                    output += `'${res[key][i]}'\n`;
                else
                    output += `'${res[key][i]}'\n    `;
            }
        }

        const [hcode, hout, herr] = await haste(output);

        if (hcode != 200) {
            await interaction.reply({
                content: `Successfully investigated friend code "${fc}", but failed to upload the results: error ${herr ?? "no error message provided"}`,
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await interaction.reply({
            content: hout,
            flags: MessageFlags.Ephemeral,
        });
    }
};

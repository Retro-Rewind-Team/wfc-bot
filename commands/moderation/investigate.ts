import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { haste, makeWFCRequest, pidToFc, resolveModRestrictPermission, resolvePidFromString, validateID } from "../../utils.js";
import { getConfig } from "../../config.js";
import { PermissionBit } from "../shared/roles.js";

const config = getConfig();


export default {
    permissions: PermissionBit.MODERATOR,

    data: new SlashCommandBuilder()
        .setName("investigate")
        .setDescription("Search all associated data for a user")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to investigate")
            .setRequired(true))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
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

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);
        const [success, res] = await makeWFCRequest("/investigate", "POST", {
            secret: config.wfcSecret,
            pid: pid,
        });

        if (!success) {
            await interaction.editReply({
                content: `Failed to investigate friend code "${fc}": error ${res.Error ?? "no error message provided"}`,
            });

            return;
        }

        let output = "";

        const resKeys = Object.keys(res);
        for (const key of resKeys) {
            if (key == "Success" || key == "Error")
                continue;

            output += `${key}:\n    `;

            if (res[key] == null) {
                output += "null\n";
                continue;
            }

            for (let i = 0; i < res[key].length; i++) {
                if (i == res[key].length - 1)
                    output += `'${res[key][i]}'\n`;
                else
                    output += `'${res[key][i]}'\n    `;
            }
        }

        const [hcode, hout, herr] = await haste(output);

        if (hcode != 200) {
            await interaction.editReply({
                content: `Successfully investigated friend code "${fc}", but failed to upload the results: error ${herr ?? "no error message provided"}`
            });

            return;
        }

        await interaction.editReply({
            content: hout,
        });
    }
};

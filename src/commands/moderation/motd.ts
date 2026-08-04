import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getConfig } from "#src/config.js";
import { makeWFCRequest } from "#src/utils.js";
import { loadState, State } from "#src/state.js";
import { getStatusText } from "#src/commands/shared/server_status.js";
import { PermissionBit } from "#src/commands/shared/roles.js";

const config = getConfig();
const state: State = await loadState();

export const command: Command = {
    permissions: PermissionBit.ADMIN,

    data: new SlashCommandBuilder()
        .setName("motd")
        .setDescription("Get or set the current message of the day.")
        .addStringOption(option => option.setName("message")
            .setDescription("message of the day to set"))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        let motd = interaction.options.getString("message");

        if (motd) {
            motd = motd.replace(/\\n/g, "\n");
            // Send the server a modified motd with the server status appended
            let realMotd = motd;

            if (state.status && state.status.color && state.status.message)
                realMotd = `${motd}\n\n${getStatusText(state.status)}`;

            const [success, res] = await makeWFCRequest("/motd", "POST", { secret: config.wfcSecret, motd: realMotd });
            if (!success) {
                await interaction.reply({ content: `Failed to set message of the day, error: ${res.Error ?? "no error message provided"}` });
                return;
            }

            await interaction.reply({ content: `Set message of the day to:\n${realMotd}` });
            // Serialize the original motd
            state.motd = motd;
            await state.save();
        }
        else {
            const [success, res] = await makeWFCRequest("/motd", "GET");

            if (success)
                await interaction.reply({ content: `Current message of the day is:\n${res.Motd}` });
            else
                await interaction.reply({ content: `Failed to fetch current message of the day, error: ${res.Error ?? "no error message provided"}` });
        }
    }
};

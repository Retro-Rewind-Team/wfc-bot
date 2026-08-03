import { Command } from "#src/commands/shared/command.js";
import { CacheType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { pidToFc, resolvePidFromString, validateID } from "../../utils.js";
import { PermissionBit } from "../shared/roles.js";

export const command: Command = {
    permissions: PermissionBit.NONE,

    data: new SlashCommandBuilder()
        .setName("convert_id")
        .setDescription("Convert between pids and fcs")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to convert")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({
                content: `Error converting friend code or pid "${id}": ${err}`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);

        await interaction.reply({
            content: `PID: ${pid}\nFC: ${fc}`,
            flags: MessageFlags.Ephemeral,
        });
    }
};

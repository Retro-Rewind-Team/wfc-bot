import { CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { getColor, makeRequest, pidToFc, resolvePidFromString, validateID } from "../utils.js";
import { getChannels, getConfig } from "../config.js";
import { currentlyVerifying } from "./link.js";

const config = getConfig();
const channels = getChannels();

export default {
    modOnly: true,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("force_link")
        .setDescription("Link your discord account to your RWFC profile")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to link")
            .setRequired(true))
        .addUserOption(option => option.setName("user")
            .setDescription("The user to force the link with")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        const [valid, err] = validateID(id);
        if (!valid) {
            await interaction.reply({
                content: `Error linking friend code or pid "${id}": ${err}`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);
        const user = interaction.options.getUser("user", true);

        if (currentlyVerifying.has(pid)) {
            await interaction.reply({
                content: `Error linking friend code "${fc}": Already verifying this profile!`
            });
            return;
        }

        const [success, res] = await makeRequest("/api/link", "POST", {
            secret: config.wfcSecret,
            pid: pid,
            discordID: user.id,
            action: "link",
            force: true,
        });

        if (!success) {
            currentlyVerifying.delete(pid);
            await interaction.reply({
                content: `Failed to link friend code "${fc}": error ${res.Error ?? "no error message provided"}`
            });
        }
        else {
            await interaction.reply({
                content: `Successfully linked "${fc}" with user ${user.displayName ?? user.globalName ?? user.username}!`,
            });

            const moderator = interaction.user;

            const embed = new EmbedBuilder()
                .setColor(getColor())
                .setTitle(`Account link changed by ${moderator.displayName ?? moderator.username}`)
                .addFields(
                    { name: "Server", value: interaction.guild!.name },
                    { name: "Moderator", value: `<@${moderator.id}>` },
                    { name: "Friend Code", value: fc },
                    { name: "Linked Account", value: `<@${user.id}>` }
                )
                .setTimestamp();

            if (res.Replaced && res.Replaced != "")
                embed.addFields({ name: "Replaced", value: `<@${res.Replaced}>` });

            await channels.logs.send({ embeds: [embed] });
        }
    }
};

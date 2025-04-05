import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { makeRequest, pidToFc, resolveModRestrictPermission, resolvePidFromString, sendEmbedLog, validateId } from "../utils.js";
import { getConfig } from "../config.js";

const config = getConfig();
const currentlyVerifying: Set<number> = new Set();

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("link")
        .setDescription("Link your discord account to your RWFC profile")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code or pid to link")
            .setRequired(true)),
    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        if (!validateId(id)) {
            await interaction.reply({ content: `Error linking friend code or pid "${id}": Incorrect format`, ephemeral: true });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);
        const discordId = interaction.user.id;

        interaction.deferReply({ ephemeral: true });
        if (currentlyVerifying.has(pid)) {
            await interaction.editReply({ content: `Error linking friend code "${fc}": Already verifying this profile!` });
            return;
        }
        currentlyVerifying.add(pid);
        const [success, res] = await makeRequest("/api/link", "POST", { secret: config.wfcSecret, pid: pid, discordId: discordId, action: "link" });
        if (!success) {
            currentlyVerifying.delete(pid);
            await interaction.editReply({ content: `Failed to link friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
            return;
        }

        const completed = new ButtonBuilder()
            .setCustomId("verify")
            .setLabel("Completed")
            .setStyle(ButtonStyle.Success)
        
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(completed);
        /* const verifDM = await interaction.user.send({
            content: `Verification started for "${fc}"! Please add "${config.friendbot}" on RWFC and press the button below withig 10 minutes!`,
            components: [row],
        }); */
        interaction.editReply({
            content: `Verification started for "${fc}"! Please add "${config.friendbot}" on RWFC and press the button below within 10 minutes!`,
            components: [row]
        });
        const timeOut = (Date.now() + 600_000); // 10 minutes
        while (Date.now() < timeOut) {
            try {
                const confirmation = await interaction.user.awaitMessageComponent({

    }
}
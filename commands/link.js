const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, InteractionReplyOptions } = require("discord.js");
const { makeRequest, pidToFc, resolvePidFromString, validateId } = require("../utils.js");
const config = require("../config.json");

const currentlyVerifying = new Set();

module.exports = {
    currentlyVerifying,
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("link")
        .setDescription("Link a RWFC license to your discord account.")
        .addStringOption(option =>
            option.setName("fc")
                .setDescription("Your friend code.")
                .setRequired(true)),
    exec: async function (interaction) {
        var id = interaction.options.getString("fc", true);
        id = id.trim();

        if (!validateId(id)) {
            await interaction.reply({ content: `Error linking friend code "${id}": Incorrect format`, ephemeral: true });
            return;
        }

        const pid = resolvePidFromString(id);
        const fc = pidToFc(pid);
        const discordId = interaction.member.id;


        await interaction.deferReply({ ephemeral: true });

        if (pid == resolvePidFromString(config["friendbot"])){
            await interaction.editReply({ content: `Error linking "${fc}": You cannot link this profile.`, ephemeral: true });
            return
        }
        if (currentlyVerifying.has(discordId)) {
            await interaction.reply({ content: `Error linking "${fc}": Another user is currently linking it.`, ephemeral: true });
            return;
        }
        currentlyVerifying.add(pid);
        const [success, res] = await makeRequest("/api/verify", "POST", { secret: config["wfc-secret"], pid: pid, discorduserid: discordId, step: 1 });
        if (!success) {
            interaction.editReply({ content: `Failed to link friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
            return;
        }


        const completed = new ButtonBuilder()
            .setCustomId("verify")
            .setLabel("Completed")
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(completed);
        const verifDM = await interaction.user.send({
            content: `Verification started for friend code "${fc}". Please add "${config["friendbot"]}" as a friend and press the button below within 10 minutes.`,
            components: [row]
        });
        interaction.editReply({ content: `Verification started for friend code "${fc}". Please check your DMs for further instructions.`, ephemeral: true });

        const timeOut = (Date.now() + 600_000);
        while (Date.now() < timeOut) {
            try {
                const confirmation = await verifDM.awaitMessageComponent({ time: timeOut - Date.now() });
                await confirmation.deferUpdate();

                if (confirmation.customId === "verify") {
                    const [success, res] = await makeRequest("/api/verify", "POST", { secret: config["wfc-secret"], pid: pid, discorduserid: discordId, step: 2 });
                    if (success) {
                        await interaction.editReply({ content: `Successfully linked friend code "${fc}" to your discord account.`, ephemeral: true });
                        completed.setDisabled(true);
                        const updatedRow = new ActionRowBuilder().addComponents(completed);
                        await verifDM.edit({
                            content: `Verification completed for friend code "${fc}".`,
                            components: [updatedRow]
                        });
                        currentlyVerifying.delete(pid);
                        return;
                    } else {
                        await interaction.editReply({ content: `Failed to link friend code "${fc}": error ${res.Error ?? "no error message provided"}`, ephemeral: true });
                        await interaction.user.send({ content: `Failed to link friend code "${fc}": error ${res.Error ?? "no error message provided."} Please add ${config["friendbot"]} and try again.` });
                    }
                }
            } catch (error) {
                await interaction.editReply({ content: `Failed to link friend code "${fc}": timed out`, ephemeral: true });
                completed.setDisabled(true);
                const updatedRow = new ActionRowBuilder().addComponents(completed);
                await verifDM.edit({
                    content: `Verification timed out for friend code "${fc}". Please try again.`,
                    components: [updatedRow]
                });
                const [success, res] = await makeRequest("/api/verify", "POST", { secret: config["wfc-secret"], pid: pid, discorduserid: discordId, step: 3 });
                currentlyVerifying.delete(pid);
                if (!success) {
                    console.error(`Failed to reset link process for friend code "${fc}": error ${res.Error ?? "no error message provided"}`);
                    await interaction.user.send({ content: `Failed to reset link process, please contact an administrator.` });
                    return;
                }  // end if sucess
                return;
            } // end catch
        } // end while loop
    } // end interaction exec
};
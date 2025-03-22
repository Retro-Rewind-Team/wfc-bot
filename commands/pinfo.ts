import { CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getColor, makeRequest, pidToFc, resolvePidFromString, validateId, WiiLinkUser } from "../utils.js";

export default {
    modOnly: false,
    adminOnly: false,

    data: new SlashCommandBuilder()
        .setName("pinfo")
        .setDescription("Query information for a given player id")
        .addStringOption(option => option.setName("id")
            .setDescription("friend code to retrieve")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>) {
        let id = interaction.options.getString("id", true);
        id = id.trim();

        if (!validateId(id)) {
            await interaction.reply({ content: `Error retrieving friend code or pid "${id}": Incorrect format` });
            return;
        }

        const pid = resolvePidFromString(id);

        const fc = pidToFc(pid);
        const [success, res] = await makeRequest("/api/pinfo", "POST", { pid: pid });
        if (success) {
            const embed = new EmbedBuilder()
                .setColor(getColor())
                .setTitle(`Player info for friend code ${fc}`)
                .setTimestamp();

            const user: WiiLinkUser = res.User;

            let issuedDate = Date.parse(user.BanIssued);
            let expiresDate = Date.parse(user.BanExpires);
            let banLengthStr = null;

            if (!isNaN(expiresDate) && !isNaN(expiresDate)) {
                issuedDate = Math.round(issuedDate / 1000);
                expiresDate = Math.round(expiresDate / 1000);

                if (expiresDate > Date.now())
                    user.Restricted = false;
                else {
                    let diff = expiresDate - issuedDate;
                    const days = Math.floor(diff / (60 * 60 * 24));
                    diff -= days * (60 * 60 * 24);

                    const hours = Math.floor(diff / (60 * 60));
                    diff -= hours * (60 * 60);

                    const mins = Math.floor(diff / (60));
                    diff -= mins * (60);

                    const seconds = Math.floor(diff);

                    banLengthStr = `${days} Days, ${hours} Hours, ${seconds} Seconds`;
                }
            }


            embed.addFields(
                { name: "Profile ID", value: `${user.ProfileId}` },
                { name: "Mii Name", value: `${user.LastInGameSn}` },
                { name: "Banned", value: `${user.Restricted}` }
            );

            if (user.Restricted) {
                embed.addFields(
                    { name: "Ban Reason", value: `${user.BanReason}` },
                    { name: "Ban Issued", value: `<t:${issuedDate}:F>` },
                    { name: "Ban Expires", value: `<t:${expiresDate}:F>` },
                    { name: "Ban Length", value: `${banLengthStr ?? "Unknown"}` }
                );
            }

            await interaction.reply({
                embeds: [embed]
            });
        }
        else
            await interaction.reply({ content: `Failed to query friend code "${fc}": error ${res.Error ?? "no error message provided"}` });
    }
};

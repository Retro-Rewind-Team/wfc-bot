import { CacheType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { PermissionBit } from "../shared/roles.js";
import { getWiiLinkErrorComments, getWiiLinkErrorDef } from "../shared/error.js";

interface WiimmfiErrorInfo {
    type: string,
    name: string,
    info: string,
}

interface WiimmfiError {
    error: number,
    found: number,
    infolist: WiimmfiErrorInfo[],
}

type WiimmfiErrorResponse = WiimmfiError[];

export default {
    permissions: PermissionBit.NONE,

    data: new SlashCommandBuilder()
        .setName("error")
        .setDescription("Look up an RWFC numeric error")
        .addIntegerOption(option => option.setName("ecode")
            .setDescription("5-6 digit error code")
            .setRequired(true)),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const ecode = interaction.options.getInteger("ecode", true);
        const length = ecode.toString().length;

        if (length < 5 || length > 6) {
            await interaction.reply({
                content: "Error Codes must be between 5 and 6 digits.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.deferReply();

        const wiiLinkErrorDef = getWiiLinkErrorDef(ecode);

        const url = `https://wiimmfi.de/error?e=${ecode}&m=json`;
        const response = await fetch(url);

        const embed = new EmbedBuilder()
            .setTitle(`Retro WFC Error ${ecode}: ${wiiLinkErrorDef.name}\n`);

        const success = await addWiimmfiError(embed, response);
        let footer = "Using error definitions from wiimmfi.de.";

        if (!success) {
            embed.addFields({
                name: "Description",
                value: wiiLinkErrorDef.description,
            });

            footer = "Unable to query error from wiimmfi.de.\nUsing fallback WiiLink error defintions.";
        }

        const comments = getWiiLinkErrorComments(ecode);
        if (comments && comments.length != 0) {
            for (let i = 0; i < comments.length; i++) {
                const comment = comments[i];
                embed.addFields({
                    name: `Comment ${i + 1}`,
                    value: comment,
                });
            }

            footer += "\nUsing comments from Retro WFC Developers and Moderators.";
        }

        embed.setFooter({ text: footer });

        await interaction.editReply({ embeds: [embed] });
    }
};

// Returns false if there is an issue with the wiimmfi error response
async function addWiimmfiError(
    embed: EmbedBuilder,
    response: Response
): Promise<boolean> {
    if (!response.ok)
        return false;

    const wiimmfiError = await response.json() as WiimmfiErrorResponse;

    if (wiimmfiError[0].found == 0)
        return false;

    for (const key in Object.keys(wiimmfiError[0].infolist)) {
        const info = wiimmfiError[0].infolist[key];

        const infoText = formatHREF(info.info);

        embed.addFields({
            name: `${info.name}: ${info.type}`,
            value: infoText,
        });
    }

    return true;
}

const hrefRegex = /<a\shref="(?<link>.*?)">(?<display>.*?)<\/a>/;

interface HREFMatch {
    link: string | undefined,
    display: string | undefined,
}

// Replace all href links in wiimmfi info fields with Discord link embeds
function formatHREF(str: string): string {
    let match;

    while ((match = hrefRegex.exec(str)) != null) {
        console.log(match);

        const href = match.groups as unknown as HREFMatch;
        str = str.slice(0, match.index)
            + `[${href.display}](${href.link})`
            + str.slice(match.index + match[0].length);
    }

    return str;
}

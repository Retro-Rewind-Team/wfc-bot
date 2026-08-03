import { _fetch as fetch } from "#src/fetch.js";
import { Command } from "#src/commands/shared/command.js";
import { ActionRowBuilder, APIMessageTopLevelComponent, AutocompleteInteraction, ButtonInteraction, CacheType, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { pidToFc, resolveModRestrictPermission, resolvePidFromString, validateID } from "#src/utils.js";
import { BadgeOpts, BadgeType, listBadges } from "#src/commands/shared/badges.js";
import { getConfig } from "#src/config.js";
import { Dictionary } from "#src/dictionary.js";
import { PermissionBit } from "#src/commands/shared/roles.js";
import { registerButtonHandlerByMessageID } from "#src/index.js";
import { fetchStatsEmbed, StatsSectionFlag } from "#src/commands/shared/stats_embed.js";
import { getNavigationButtons, newIndexFromButtonInteraction, validateButtonInteraction } from "#src/commands/shared/buttons.js";

const config = getConfig();
const leaderboardUrl = `http://${config.leaderboardServer}:${config.leaderboardPort}`;

interface BadgeManageResponse {
    success: boolean;
    message: string;
    badges: BadgeType[];
};

interface BadgeResponse {
    badges: BadgeType[];
}

interface BatchBadgeResponse {
    badges: Dictionary<BadgeType[]>
}

async function add(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    let id = interaction.options.getString("id", true);
    id = id.trim();

    const [valid, err] = validateID(id);
    if (!valid) {
        await interaction.reply({
            content: `Error adding badge to friend code or pid "${id}": ${err}`
        });
        return;
    }

    await interaction.deferReply();

    const pid = resolvePidFromString(id);
    const fc = pidToFc(pid);
    const badge: BadgeType = interaction.options.getInteger("badge", true);
    const badgeName = BadgeType[badge];

    const response = await fetch(`${leaderboardUrl}/api/moderation/badges/add`, {
        method: "POST",
        body: JSON.stringify({
            pid: pid.toString(),
            badge: badge,
        }),
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.wfcSecret}`
        }
    });

    if (!response.ok) {
        await interaction.editReply({
            content: `Failed to add badge ${badgeName} to friend code "${fc}": error ${response.status}`
        });
        return;
    }
    else {
        const badgeResponse: BadgeManageResponse = await response.json();

        if (!badgeResponse.success) {
            await interaction.editReply({
                content: `Failed to add badge ${badgeName} to friend code "${fc}": error ${badgeResponse.message}`
            });
            return;
        }

        await interaction.editReply({
            content: `Successfully added badge ${badgeName} to friend code "${fc}"\nThis player's badges are: ${listBadges(badgeResponse.badges)}`
        });
    }
}

async function remove(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    let id = interaction.options.getString("id", true);
    id = id.trim();

    const [valid, err] = validateID(id);
    if (!valid) {
        await interaction.reply({
            content: `Error removing badge from friend code or pid "${id}": ${err}`
        });
        return;
    }

    await interaction.deferReply();

    const pid = resolvePidFromString(id);
    const fc = pidToFc(pid);
    const badge: BadgeType = interaction.options.getInteger("badge", true);
    const badgeName = BadgeType[badge];

    const response = await fetch(`${leaderboardUrl}/api/moderation/badges/remove`, {
        method: "POST",
        body: JSON.stringify({
            pid: pid.toString(),
            badge: badge,
        }),
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.wfcSecret}`
        }
    });

    if (!response.ok) {
        await interaction.editReply({
            content: `Failed to remove badge ${badgeName} from friend code "${fc}": error ${response.status}`
        });
        return;
    }
    else {
        const badgeResponse: BadgeManageResponse = await response.json();

        if (!badgeResponse.success) {
            await interaction.editReply({
                content: `Failed to remove badge ${badgeName} from friend code "${fc}": error ${badgeResponse.message}`
            });
            return;
        }

        let badgeString: string;
        if (!badgeResponse.badges || badgeResponse.badges.length == 0)
            badgeString = "None";
        else
            badgeString = listBadges(badgeResponse.badges);


        await interaction.editReply({
            content: `Successfully removed badge ${badgeName} from friend code "${fc}"\nThis player's badges are: ${badgeString}`
        });
    }
}

async function list(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const id = interaction.options.getString("id");

    // Get all players' badges
    if (id == null || id.length == 0)
        await listAll(interaction);
    else
        await listSingle(interaction, id);
}

interface BadgeListState {
    Badges: Dictionary<BadgeType[]>,
    Idx: number;
    Embeds: EmbedBuilder[],
}

const stateByMessageID: Dictionary<BadgeListState> = {};

async function listAll(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    const restrictBadgeType = interaction.options.getInteger("badge");
    await interaction.deferReply();

    const response = await fetch(`${leaderboardUrl}/api/badges/all`);

    if (!response.ok) {
        await interaction.editReply({
            content: `Failed to fetch all badges: error ${response.status}`
        });
        return;
    }

    const batchResponse: BatchBadgeResponse = await response.json();

    if (restrictBadgeType != null) {
        const filteredBadges: Dictionary<BadgeType[]> = {};

        for (const fc of Object.keys(batchResponse.badges)) {
            const playerBadges = batchResponse.badges[fc];

            if (playerBadges.includes(restrictBadgeType))
                filteredBadges[fc] = playerBadges;
        }

        batchResponse.badges = filteredBadges;
    }

    const keys = Object.keys(batchResponse.badges);

    if (keys.length == 0) {
        await interaction.editReply({content: "No badges exist for any players"});
        return;
    }

    const row = new ActionRowBuilder()
        .addComponents(getNavigationButtons(interaction.user.id));

    const [embed, err] = await fetchStatsEmbed(keys[0], StatsSectionFlag.BADGES);
    if (err) {
        const fc = pidToFc(parseInt(keys[0]));
        await interaction.editReply({
            content: `Failed to fetch embed for player ${fc}: ${err}`
        });

        return;
    }

    embed!.setFooter({ text: `Page 1 of ${keys.length }` });

    const res = await interaction.editReply({
        embeds: [embed!],
        components: [row as unknown as APIMessageTopLevelComponent],
    });

    const message = await res.fetch();

    registerButtonHandlerByMessageID(
        message.id,
        300000, // 5 minutes
        (messageID) => {
            delete stateByMessageID[messageID];
        },
        handleButton,
    );

    stateByMessageID[message.id] = {
        Badges: batchResponse.badges,
        Idx: 0,
        Embeds: [embed!],
    };
}

async function handleButton(buttonInteraction: ButtonInteraction<CacheType>): Promise<void> {
    if (!await validateButtonInteraction(buttonInteraction))
        return;

    const state = stateByMessageID[buttonInteraction.message.id];
    const keys = Object.keys(state.Badges);

    const maxIdx = keys.length - 1;
    state.Idx = newIndexFromButtonInteraction(
        buttonInteraction,
        state.Idx,
        maxIdx
    );

    const row = new ActionRowBuilder()
        .addComponents(
            getNavigationButtons(
                buttonInteraction.user.id,
                state.Idx,
                maxIdx
            ),
        );

    let embed = state.Embeds[state.Idx];

    if (!embed) {
        const [newEmbed, err] = await fetchStatsEmbed(keys[state.Idx], StatsSectionFlag.BADGES);

        if (err) {
            const fc = pidToFc(parseInt(keys[state.Idx]));
            await buttonInteraction.update({
                content: `Failed to fetch embed for player ${fc}: ${err}`,
                components: [row as unknown as APIMessageTopLevelComponent]
            });
            return;
        }

        embed = newEmbed!;
        state.Embeds[state.Idx] = embed;
    }

    embed!.setFooter({ text: `Page ${state.Idx + 1} of ${keys.length }` });

    await buttonInteraction.update({
        embeds: [embed],
        components: [row as unknown as APIMessageTopLevelComponent],
    });
}

async function listSingle(interaction: ChatInputCommandInteraction<CacheType>, id: string): Promise<void> {
    // Get only a single player's badge
    id = id.trim();
    const [valid, err] = validateID(id);
    if (!valid) {
        await interaction.reply({
            content: `Error retrieving badges for friend code or pid "${id}": ${err}`
        });
        return;
    }

    await interaction.deferReply();

    const pid = resolvePidFromString(id);
    const fc = pidToFc(pid);

    const response = await fetch(`${leaderboardUrl}/api/badges/by-pid/${pid}`);

    if (!response.ok) {
        await interaction.editReply({
            content: `Failed to fetch badges for friend code ${fc}: error ${response.status}`
        });
        return;
    }

    const badges: BadgeType[] = (await response.json() as BadgeResponse).badges;
    let badgesString: string;
    if (badges.length == 0)
        badgesString = "None";
    else
        badgesString = listBadges(badges);

    await interaction.editReply({
        content: `${fc}: ${badgesString}`
    });
}

export const command: Command = {
    permissions: PermissionBit.PROFILE_MODERATOR,

    data: new SlashCommandBuilder()
        .setName("badge")
        .setDescription("Manage player badges")
        .addSubcommand(subcommand => subcommand.setName("add")
            .setDescription("Add a badge to a user")
            .addStringOption(option => option.setName("id")
                .setDescription("friend code or pid to add a badge to")
                .setRequired(true))
            .addIntegerOption(option => option.setName("badge")
                .setDescription("the badge to add")
                .setAutocomplete(true)
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName("remove")
            .setDescription("Remove a badge from a user")
            .addStringOption(option => option.setName("id")
                .setDescription("friend code or pid remove a badge from")
                .setRequired(true))
            .addIntegerOption(option => option.setName("badge")
                .setDescription("the badge to remove")
                .setAutocomplete(true)
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName("list")
            .setDescription("List badges for one or all players")
            .addIntegerOption(option => option.setName("badge")
                .setDescription("the badge type to filter by")
                .setAutocomplete(true))
            .addStringOption(option => option.setName("id")
                .setDescription("friend code or pid to list badges of")))
        .setDefaultMemberPermissions(resolveModRestrictPermission()),

    exec: async function(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
        case "add":
            await add(interaction);
            break;
        case "remove":
            await remove(interaction);
            break;
        case "list":
            await list(interaction);
            break;
        }
    },

    autocomplete: async function(interaction: AutocompleteInteraction<CacheType>): Promise<void> {
        const focused = interaction.options.getFocused(true);

        if (focused.name != "badge")
            return;

        const filtered = focused.value.length == 0
            ? BadgeOpts
            : BadgeOpts.filter(
                opt => opt.name.toLowerCase().includes(focused.value.toLowerCase())
            );

        await interaction.respond(filtered.slice(0, Math.min(filtered.length, 25)));
    }
};

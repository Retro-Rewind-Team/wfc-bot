// NOTE: The order of these should not be modified. Badges should only be added
// onto the end of each section. Expunged badges should be labeled "UnusedX"
export enum BadgeType {
    // Core Devs for Retro Rewind or RWFC Services (projects under the Retro
    // Rewind Team Org)
    RetroRewindDeveloper = 0,
    // Core Devs for Wheel Wizard
    WheelWizardDeveloper,
    // Significant Contributor to any relevant projects. Major PRs/Features,
    // extensive community management, major asset contributions, etc.
    MajorContributor,

    // Moderators/Admins for RWFC servers
    RWFCModerator = 100,
    // Discord Moderators/Admins
    DiscordStaff,

    // Minor contributor. Gecko codes, small assets or features, one-off changes.
    Contributor = 1000,
    Translator,
    Supporter,
    BetaTester,
    Heart,

    // Tourney Badges
    FireStarterGold = 2000,
    FireStarterSilver,
    FireStarterBronze,
    LeafStruckGold,
    LeafStruckSilver,
    LeafStruckBronze,
    SummitShowdownGold,
    SummitShowdownSilver,
    SummitShowdownBronze,
    HorizonGold,
    HorizonSilver,
    HorizonBronze,
    SunblossomGold,
    SunblossomSilver,
    SunblossomBronze,
    EarthboundGold,
    EarthboundSilver,
    EarthboundBronze,
    BotBGold,
    BotBSilver,
    BotBBronze,
}

export const BadgeOpts: { name: string; value: BadgeType }[] = [];

Object.entries(BadgeType).forEach(entry => {
    if (typeof entry[0] == "string"
        && typeof entry[1] == "number"
        && !entry[0].startsWith("Unused")) {
        BadgeOpts.push({
            name: entry[0],
            value: entry[1],
        });
    }
});

export function listBadges(badges: BadgeType[]): string {
    return badges
        .map(badge => BadgeType[badge])
        .filter(badgeName => !badgeName.startsWith("Unused"))
        .join(", ");
}

import { Command } from "#src/commands/shared/command.js";
import { makeRoleCommand, PermissionBit } from "#src/commands/shared/roles.js";

export const command: Command = makeRoleCommand(
    "profile_moderator",
    "Profile Moderator",
    PermissionBit.PROFILE_MODERATOR,
    PermissionBit.ADMIN,
);

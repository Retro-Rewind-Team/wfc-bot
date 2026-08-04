import { Command } from "#src/commands/shared/command.js";
import { makeRoleCommand, PermissionBit } from "#src/commands/shared/roles.js";

export const command: Command = makeRoleCommand(
    "mini_moderator",
    "Mini Moderator",
    PermissionBit.MINI_MODERATOR,
    PermissionBit.ADMIN,
);

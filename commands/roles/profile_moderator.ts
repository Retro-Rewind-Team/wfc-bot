import { makeRoleCommand, PermissionBit } from "../shared/roles.js";

export default makeRoleCommand(
    "profile_moderator",
    "Profile Moderator",
    PermissionBit.PROFILE_MODERATOR,
    PermissionBit.ADMIN,
);

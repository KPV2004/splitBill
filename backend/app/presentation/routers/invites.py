"""Joining a group from an invite link (/join/<code> in the frontend). Signed-in only."""

from fastapi import APIRouter

from app.presentation.deps import CurrentUser, GroupsDep
from app.presentation.schemas.api import GroupOut, InvitePreviewOut

router = APIRouter(prefix="/invites", tags=["invites"])


@router.get("/{invite_code}")
async def preview_invite(
    invite_code: str, username: CurrentUser, groups: GroupsDep
) -> InvitePreviewOut:
    return InvitePreviewOut.of(await groups.preview_invite(invite_code, username))


@router.post("/{invite_code}/join")
async def join(invite_code: str, username: CurrentUser, groups: GroupsDep) -> GroupOut:
    return GroupOut.of(await groups.join(invite_code, username))

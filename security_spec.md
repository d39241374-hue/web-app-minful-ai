# Mindful AI – Security Specification

## 1. Data Invariants
1. **PII Isolation**: User email addresses reside exclusively in `/users/{uid}`, readable/writable only by `request.auth.uid == uid` with `email_verified == true`. No `list` permission is granted on `/users`.
2. **Public Garden Separation**: `/publicGardens/{uid}` exposes strictly non-PII fields (`fullname`, `className`, `schoolName`, `treeName`, `level`, `xp`, `streakDays`, `todayFocusMins`, `dragonUpgradeLevel`, `isPublic`) and can only be written by `request.auth.uid == uid`.
3. **Master Gate on Subcollections**: `/users/{uid}/tasks`, `/plantQuests`, `/journals`, `/cdsRecords`, `/aiMessages` verify ownership via `uid == request.auth.uid` and `exists(/databases/$(database)/documents/users/$(uid))`. `/privateChats/{pairId}/messages` verifies membership against parent `/privateChats/{pairId}` using `get()`.
4. **Immutable Fields & Server Timestamps**: `uid`, `email`, `createdAt`, `fromUid`, `toUid`, `authorUid`, `senderUid`, `uidA`, `uidB` cannot be altered on update; `createdAt == request.time` on create and `updatedAt == request.time` on update.
5. **Terminal State Locking**:
   - `/friendRequests/{requestId}`: Transitions only from `pending` -> `accepted` or `declined` (by `toUid` only). Once `accepted` or `declined`, no further updates are permitted.
   - `/gardenGifts/{giftId}`: Transitions only from `pending` -> `claimed` (by `toUid` only). Once `claimed`, no further updates are permitted.
6. **Verified Auth & Bounded Values**: All writes require `request.auth != null && request.auth.token.email_verified == true`. All strings and arrays have explicit `.size()` bounds.
7. **Group Study Room Isolation & Master Gate**: `/studyRooms/{roomId}` enforces `participantUids` bounded to 1–8 entries (always containing `hostUid`), restricts `get`/`list` to `request.auth.uid in existing().participantUids`, locks terminal `status == 'ended'`, and allows timer/invite updates only by `hostUid`. `/studyRooms/{roomId}/members/{memberUid}` checks parent room membership via `get()` (Master Gate), denies `list`, and restricts writes strictly to `memberUid == request.auth.uid`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read on Private Profile**: `GET /users/victimUid` with `auth = null`.
2. **Cross-User PII Read**: `GET /users/victimUid` as `attackerUid`.
3. **Unverified Email Write**: `CREATE /users/attackerUid` with `auth.token.email_verified = false`.
4. **Shadow / Ghost Field Injection**: `CREATE /users/attackerUid` adding `"isAdmin": true` or `"role": "admin"`.
5. **UID Spoofing on Create**: `CREATE /publicGardens/victimUid` by `attackerUid` or with `uid: "victimUid"`.
6. **ID Poisoning (>128 chars / bad chars)**: `CREATE /users/attackerUid/tasks/../../evil` or 200-char ID.
7. **Timestamp Forgery**: `CREATE /forumMessages/msg1` with client-supplied past timestamp `createdAt != request.time`.
8. **Blanket List Scraping on Friend Requests**: `LIST /friendRequests` without filtering by `fromUid == auth.uid` or `toUid == auth.uid`.
9. **Terminal State Replay on Friend Request**: `UPDATE /friendRequests/req1` changing `status` from `declined` back to `accepted`.
10. **Sender Claiming Own Gift**: `UPDATE /gardenGifts/gift1` setting `status: "claimed"` as `fromUid` instead of `toUid`.
11. **Orphaned Friend Request to Non-Existent User**: `CREATE /friendRequests/req2` where `/publicGardens/$(toUid)` does not exist.
12. **Private Chat Eavesdropping**: `GET /privateChats/alice__bob/messages/m1` by `eveUid` (not `uidA` or `uidB` in parent `/privateChats/alice__bob`).
13. **StudyRoom Host Hijack / Uninvited Member Write**: `UPDATE /studyRooms/room1` timer by non-host OR `CREATE /studyRooms/room1/members/eveUid` by uninvited `eveUid` OR `UPDATE /studyRooms/endedRoom` after `status == 'ended'`.

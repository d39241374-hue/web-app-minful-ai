/**
 * Security Rules Specification & Verification Matrix for Mindful AI Firestore Rules.
 * Covers all 12 adversarial "Dirty Dozen" payloads defined in security_spec.md.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  actorUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_TEST_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Read on Private Profile',
    operation: 'get',
    path: '/users/student_a',
    actorUid: null,
    emailVerified: false,
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'match /users/{uid} -> allow get: if isOwner(uid)'
  },
  {
    id: 2,
    name: 'Cross-User PII Read',
    operation: 'get',
    path: '/users/student_a',
    actorUid: 'student_b',
    emailVerified: true,
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'match /users/{uid} -> isOwner(uid) requires request.auth.uid == uid'
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/users/student_b',
    actorUid: 'student_b',
    emailVerified: false,
    payload: { uid: 'student_b', email: 'fake@example.com' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isVerifiedOwner(uid) checks request.auth.token.email_verified == true'
  },
  {
    id: 4,
    name: 'Shadow / Ghost Field Injection (isAdmin)',
    operation: 'create',
    path: '/users/student_b',
    actorUid: 'student_b',
    emailVerified: true,
    payload: { uid: 'student_b', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidUserProfile(incoming()) -> data.keys().hasOnly([...]) rejects unknown keys'
  },
  {
    id: 5,
    name: 'UID Spoofing on PublicGarden Create',
    operation: 'create',
    path: '/publicGardens/student_a',
    actorUid: 'student_b',
    emailVerified: true,
    payload: { uid: 'student_a', level: 10 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isVerifiedOwner(uid) && incoming().uid == request.auth.uid'
  },
  {
    id: 6,
    name: 'ID Poisoning with Invalid Characters or >128 Length',
    operation: 'create',
    path: `/users/student_b/tasks/${'x'.repeat(140)}`,
    actorUid: 'student_b',
    emailVerified: true,
    payload: { uid: 'student_b', text: 'Hack' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId(taskId) enforces size <= 128 && matches ^[a-zA-Z0-9_\\-]+$'
  },
  {
    id: 7,
    name: 'Timestamp Forgery on ForumMessage',
    operation: 'create',
    path: '/forumMessages/msg_1',
    actorUid: 'student_b',
    emailVerified: true,
    payload: { authorUid: 'student_b', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidForumMessage checks data.createdAt == request.time'
  },
  {
    id: 8,
    name: 'Blanket List Scraping on FriendRequests',
    operation: 'list',
    path: '/friendRequests',
    actorUid: 'student_b',
    emailVerified: true,
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow list: if isSignedIn() && (existing().toUid == request.auth.uid || existing().fromUid == request.auth.uid)'
  },
  {
    id: 9,
    name: 'Terminal State Replay on FriendRequest',
    operation: 'update',
    path: '/friendRequests/req_declined',
    actorUid: 'student_a',
    emailVerified: true,
    payload: { status: 'accepted' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'existing().status == "pending" blocks updates once terminal state reached'
  },
  {
    id: 10,
    name: 'Sender Claiming Own GardenGift',
    operation: 'update',
    path: '/gardenGifts/gift_1',
    actorUid: 'student_b',
    emailVerified: true,
    payload: { status: 'claimed' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'existing().toUid == request.auth.uid rejects sender trying to claim'
  },
  {
    id: 11,
    name: 'Orphaned FriendRequest to Non-Existent User',
    operation: 'create',
    path: '/friendRequests/req_orphan',
    actorUid: 'student_b',
    emailVerified: true,
    payload: { fromUid: 'student_b', toUid: 'ghost_user', status: 'pending' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'exists(/databases/$(database)/documents/publicGardens/$(incoming().toUid))'
  },
  {
    id: 12,
    name: 'Private Chat Eavesdropping by Non-Participant',
    operation: 'get',
    path: '/privateChats/alice__bob/messages/msg_1',
    actorUid: 'eve_uid',
    emailVerified: true,
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isPairParticipant(pairId) via Master Gate get(/privateChats/$(pairId))'
  },
  {
    id: 13,
    name: 'Non-Host Attempting StudyRoom Timer Tampering',
    operation: 'update',
    path: '/studyRooms/room_1',
    actorUid: 'student_b',
    emailVerified: true,
    payload: { status: 'running', remainingSecs: 1500 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'match /studyRooms/{roomId} -> existing().hostUid == request.auth.uid'
  },
  {
    id: 14,
    name: 'Uninvited User Attempting StudyRoom Member Write',
    operation: 'create',
    path: '/studyRooms/room_1/members/eve_uid',
    actorUid: 'eve_uid',
    emailVerified: true,
    payload: { roomId: 'room_1', uid: 'eve_uid', status: 'focusing' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isStudyRoomParticipant(roomId) Master Gate checks request.auth.uid in getStudyRoom(roomId).participantUids'
  }
];

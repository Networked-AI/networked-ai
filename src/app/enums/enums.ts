export enum NotificationType {
  // static types
  ALL = 'All',
  UNREAD = 'Unread',

  // database types
  POSTS = 'Posts',
  EVENTS = 'Events',
  NETWORK = 'Network',
  MENTION = 'Mention',
  MY_EVENTS = 'MyEvents',
  POST_LIKED = 'PostLiked',
  INVITATION = 'Invitation',
  RSVP_REQUEST = 'RsvpRequest',
  CHAT_MESSAGE = 'ChatMessage',
  CHAT_ROOM_CREATED = 'ChatRoomCreated',
  COMMENT_LIKED = 'CommentLiked',
  COMMENT_REPLY = 'CommentReply',
  POST_COMMENTED = 'PostCommented',
  EVENT_REMINDER = 'EventReminder',
  RSVP_REQUEST_STATUS = 'RsvpRequestStatus',
  POST_EVENT_QUESTIONNAIRE = 'PostEventQuestionnaire'
}

export enum RSVPRequestStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected'
}

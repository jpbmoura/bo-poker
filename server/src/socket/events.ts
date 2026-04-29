export const Events = {
  // Client -> Server
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  VOTE_CAST: 'vote:cast',
  VOTE_REVEAL: 'vote:reveal',
  VOTE_RESET: 'vote:reset',
  PLAYER_SET_ROLE: 'player:setRole',

  // Server -> Client
  ROOM_STATE: 'room:state',
  ROOM_JOINED: 'room:joined',
  ROOM_ERROR: 'room:error',
} as const;

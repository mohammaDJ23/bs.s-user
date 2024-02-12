import { User } from 'src/entities';
import { ConversationDocObj } from 'src/gateways';
import { EncryptedUserObj } from 'src/types';

export function getConversationTargetId(
  user: EncryptedUserObj | User,
  conversation: ConversationDocObj,
) {
  return conversation.creatorId === user.id
    ? conversation.targetId
    : conversation.creatorId;
}

import {createHomeConversation} from '../workspace/store'
import {setActiveConversation} from '../workspace/nav'
import {CHAT_LAUNCH_KEY} from '../history'
import {pathLaunchAttachments,type PathAttachment} from '../path-planning/path-run-client'
import {readLearningThinking,writeLearningThinking} from '../session/learning-thinking'
type ChatExperience='answer'|'route'
export function launchChat(query:string,mode:ChatExperience,attachments: PathAttachment[] = [], thinkingDepth: 'fast' | 'deep' = readLearningThinking()) {
  const conversation=createHomeConversation(query,mode)
  if (attachments.length > 0) pathLaunchAttachments.set(conversation.id, attachments)
  writeLearningThinking(thinkingDepth)
  sessionStorage.setItem(CHAT_LAUNCH_KEY,JSON.stringify({query,mode,conversationId:conversation.id,routeId:conversation.routeId,generate:true,thinkingDepth}))
  setActiveConversation(conversation.id)
  location.hash='chat'
  return conversation.id
}

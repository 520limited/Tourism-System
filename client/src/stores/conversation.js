import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useConversationStore = defineStore('conversation', () => {
  const messages = ref([])
  const conversationId = ref(null)
  const isTyping = ref(false)

  const addMessage = (message) => {
    messages.value.push(message)
  }

  const setMessages = (msgs) => {
    messages.value = msgs
  }

  const setConversationId = (id) => {
    conversationId.value = id
  }

  const resetConversation = () => {
    messages.value = []
    conversationId.value = null
  }

  return {
    messages,
    conversationId,
    isTyping,
    addMessage,
    setMessages,
    setConversationId,
    resetConversation
  }
})

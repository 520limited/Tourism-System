import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref(null)
  const isLoggedIn = ref(false)
  const preferences = ref({
    crowd: '',
    budget: '',
    intensity: '',
    diet: ''
  })

  const setUser = (userData) => {
    userInfo.value = userData
    isLoggedIn.value = true
    if (userData.preferences) {
      preferences.value = { ...preferences.value, ...userData.preferences }
    }
  }

  const login = (userData) => {
    userInfo.value = userData
    isLoggedIn.value = true
  }

  const logout = () => {
    userInfo.value = null
    isLoggedIn.value = false
    localStorage.removeItem('sessionId')
  }

  const updatePreferences = (newPrefs) => {
    preferences.value = { ...preferences.value, ...newPrefs }
  }

  const updateUserInfo = (updates) => {
    if (userInfo.value) {
      userInfo.value = { ...userInfo.value, ...updates }
    }
  }

  return {
    userInfo,
    isLoggedIn,
    preferences,
    setUser,
    login,
    logout,
    updatePreferences,
    updateUserInfo
  }
})

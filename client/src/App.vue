<template>
  <router-view />
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from './stores/user'
import { useTripStore } from './stores/trip'
import { userAPI } from './api'

const router = useRouter()
const userStore = useUserStore()
const tripStore = useTripStore()

onMounted(async () => {
  const sessionId = localStorage.getItem('sessionId')
  if (sessionId) {
    try {
      const res = await userAPI.getProfile()
      if (res.code === 200 && res.data) {
        userStore.setUser(res.data)
      } else {
        localStorage.removeItem('sessionId')
        localStorage.removeItem('currentTripId')
        userStore.logout()
        tripStore.resetTrip()
        router.push('/login')
      }
    } catch (error) {
      localStorage.removeItem('sessionId')
      localStorage.removeItem('currentTripId')
      userStore.logout()
      tripStore.resetTrip()
      router.push('/login')
    }
  }
  
  router.beforeEach(async (to, from, next) => {
    if (tripStore.itinerary && tripStore.itinerary.length > 0) {
      await tripStore.autoSave()
    }
    next()
  })
  
  window.addEventListener('beforeunload', handleBeforeUnload)
})

const handleBeforeUnload = async (e) => {
  if (tripStore.itinerary && tripStore.itinerary.length > 0) {
    const saveData = tripStore.getSaveData()
    const sessionId = localStorage.getItem('sessionId')
    
    if (navigator.sendBeacon) {
      const formData = new FormData()
      formData.append('data', JSON.stringify({
        tripId: tripStore.tripId,
        params: saveData.params,
        itinerary: saveData.itinerary,
        conversationHistory: saveData.conversationHistory,
        routes: saveData.routes
      }))
      navigator.sendBeacon('/api/trips', formData)
    }
  }
}

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>

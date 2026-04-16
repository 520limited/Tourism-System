import { defineStore } from 'pinia'
import { ref } from 'vue'
import api, { tripAPI } from '../api'

export const useTripStore = defineStore('trip', () => {
  const tripParams = ref({
    days: null,
    crowd: '',
    budget: '',
    constraints: '',
    interests: [],
    hotelArea: ''
  })
  const itinerary = ref([])
  const tripId = ref(null)
  const isGenerating = ref(false)
  const integratedData = ref(null)
  const conversationHistory = ref([])
  const routes = ref([])
  const activities = ref([])
  const enhancedPlanning = ref(null)

  const updateTripParams = (params) => {
    tripParams.value = { ...tripParams.value, ...params }
  }

  const setItinerary = (data) => {
    itinerary.value = data
  }

  const setTripId = (id) => {
    tripId.value = id
  }

  const setIntegratedData = (data) => {
    integratedData.value = data
  }

  const setConversationHistory = (history) => {
    conversationHistory.value = history
  }

  const addConversationMessage = (role, content, extra = {}) => {
    conversationHistory.value.push({
      role,
      content,
      timestamp: new Date().toISOString(),
      ...extra
    })
  }

  const setRoutes = (routeData) => {
    routes.value = routeData
  }

  const setActivities = (data) => {
    activities.value = data
  }

  const setEnhancedPlanning = (data) => {
    enhancedPlanning.value = data
  }

  const addRoute = (route) => {
    routes.value.push(route)
  }

  const resetTrip = () => {
    tripParams.value = {
      days: null,
      crowd: '',
      budget: '',
      constraints: '',
      interests: [],
      hotelArea: ''
    }
    itinerary.value = []
    tripId.value = null
    integratedData.value = null
    conversationHistory.value = []
    routes.value = []
    activities.value = []
    enhancedPlanning.value = null
  }

  const loadTripData = (tripData) => {
    if (tripData.tripId) {
      tripId.value = tripData.tripId
    }
    if (tripData.requirements) {
      tripParams.value = { ...tripParams.value, ...tripData.requirements }
    }
    if (tripData.itinerary) {
      itinerary.value = tripData.itinerary
    }
    if (tripData.conversationHistory) {
      conversationHistory.value = tripData.conversationHistory
    }
    if (tripData.routes) {
      routes.value = tripData.routes
    }
    if (tripData.activities) {
      activities.value = tripData.activities
    }
  }

  const getSaveData = () => {
    return {
      params: JSON.parse(JSON.stringify(tripParams.value)),
      itinerary: JSON.parse(JSON.stringify(itinerary.value)),
      conversationHistory: JSON.parse(JSON.stringify(conversationHistory.value)),
      routes: JSON.parse(JSON.stringify(routes.value))
    }
  }

  const autoSave = async () => {
    if (!itinerary.value || itinerary.value.length === 0) {
      return { success: false, message: '没有可保存的行程' }
    }

    try {
      const saveData = getSaveData()

      if (tripId.value) {
        await tripAPI.update(tripId.value, {
          requirements: saveData.params,
          itinerary: saveData.itinerary,
          conversationHistory: saveData.conversationHistory,
          routes: saveData.routes
        })
      } else {
        const res = await tripAPI.create({
          params: saveData.params,
          itinerary: saveData.itinerary,
          conversationHistory: saveData.conversationHistory,
          routes: saveData.routes
        })
        if (res?.data?.tripId) {
          tripId.value = res.data.tripId
          localStorage.setItem('currentTripId', res.data.tripId)
        }
      }

      return { success: true, message: '自动保存成功' }
    } catch (error) {
      console.error('自动保存失败:', error)
      return { success: false, message: '保存失败' }
    }
  }

  const replaceAttractions = (day, newAttractions) => {
    const dayIndex = itinerary.value.findIndex(d => d.day === day)
    if (dayIndex !== -1) {
      itinerary.value[dayIndex].attractions = newAttractions
    }
  }

  const replaceRestaurants = (day, newRestaurants) => {
    const dayIndex = itinerary.value.findIndex(d => d.day === day)
    if (dayIndex !== -1) {
      itinerary.value[dayIndex].restaurants = newRestaurants
    }
  }

  const replaceHotels = (day, newHotels) => {
    const dayIndex = itinerary.value.findIndex(d => d.day === day)
    if (dayIndex !== -1) {
      itinerary.value[dayIndex].hotels = newHotels
    }
  }

  const updateDayItinerary = (day, updates) => {
    const dayIndex = itinerary.value.findIndex(d => d.day === day)
    if (dayIndex !== -1) {
      itinerary.value[dayIndex] = { ...itinerary.value[dayIndex], ...updates }
    }
  }

  return {
    tripParams,
    itinerary,
    tripId,
    isGenerating,
    integratedData,
    conversationHistory,
    routes,
    activities,
    enhancedPlanning,
    updateTripParams,
    setItinerary,
    setTripId,
    setIntegratedData,
    setConversationHistory,
    addConversationMessage,
    setRoutes,
    setActivities,
    setEnhancedPlanning,
    addRoute,
    resetTrip,
    loadTripData,
    getSaveData,
    autoSave,
    replaceAttractions,
    replaceRestaurants,
    replaceHotels,
    updateDayItinerary
  }
})

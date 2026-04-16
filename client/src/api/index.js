import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 200000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  (config) => {
    const sessionId = localStorage.getItem('sessionId')
    if (sessionId) {
      config.headers['X-Session-Id'] = sessionId
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 429) {
      console.warn('请求过于频繁')
    } else if (error.response?.status === 401) {
      localStorage.removeItem('sessionId')
      localStorage.removeItem('currentTripId')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const chatAPI = {
  sendMessage: (data) => api.post('/chat', data),
  sendMessageWithTrip: (message, tripId) => api.post('/chat', { message, tripId }),
  getHistory: (conversationId) => api.get(`/chat/history/${conversationId}`)
}

export const planAPI = {
  generateItinerary: (message, tripId) => api.post('/plan', { message, tripId }),
  refreshAttractions: (currentAttractions, sessionId, hotelArea, currentDay, locationContext) => {
    return api.post('/refresh/attractions', { currentAttractions, sessionId, hotelArea, currentDay, locationContext })
  },
  refreshRestaurants: (currentRestaurants, sessionId, currentDay, locationContext, cuisine) => {
    return api.post('/refresh/restaurants', { currentRestaurants, sessionId, currentDay, locationContext, cuisine })
  },
  refreshSnacks: (currentSnacks, sessionId) => {
    return api.post('/refresh/snacks', { currentSnacks, sessionId })
  },
  refreshDrinks: (currentDrinks, sessionId) => {
    return api.post('/refresh/drinks', { currentDrinks, sessionId })
  },
  refreshCheckIn: (currentCheckInPoints, sessionId) => {
    return api.post('/refresh/checkin', { currentCheckInPoints, sessionId })
  },
  refreshHotels: (currentHotels, sessionId, hotelArea, currentDay, locationContext, starRating) => {
    return api.post('/refresh/hotels', { currentHotels, sessionId, hotelArea, currentDay, locationContext, starRating })
  },
  generateTransportation: () => api.post('/transportation', {})
}

export const tripAPI = {
  getTrips: (params) => api.get('/trips', { params }),
  getTrip: (id) => api.get(`/trips/${id}`),
  create: (data) => api.post('/trips', data),
  update: (id, data) => api.put(`/trips/${id}`, data),
  delete: (id) => api.delete(`/trips/${id}`),
  favorite: (id, isFavorite) => api.post(`/trips/${id}/favorite`, { isFavorite }),
  duplicate: (id) => api.post(`/trips/${id}/duplicate`),
  export: (id, format) => api.get(`/trips/${id}/export`, { params: { format } }),
  share: (id) => api.post(`/trips/${id}/share`)
}

export const attractionsAPI = {
  getAll: (params) => api.get('/attractions', { params }),
  getById: (id) => api.get(`/attractions/${id}`),
  search: (keyword) => api.get('/attractions/search', { params: { keyword } })
}

export const restaurantsAPI = {
  getAll: (params) => api.get('/restaurants', { params }),
  getById: (id) => api.get(`/restaurants/${id}`),
  search: (keyword) => api.get('/restaurants/search', { params: { keyword } })
}

export const hotelsAPI = {
  getAll: (params) => api.get('/hotels', { params }),
  getById: (id) => api.get(`/hotels/${id}`)
}

export const strategiesAPI = {
  getAll: (params) => api.get('/strategies', { params }),
  getById: (id) => api.get(`/strategies/${id}`)
}

export const userAPI = {
  sendCode: (email) => api.post('/auth/send-code', { email }),
  register: (data) => api.post('/auth/register', data),
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data) => api.put('/user/profile', data),
  updatePreferences: (preferences) => api.put('/user/preferences', { preferences }),
  changePassword: (oldPassword, newPassword) => api.put('/user/password', { oldPassword, newPassword }),
  getStats: () => api.get('/user/stats')
}

export const favoriteAPI = {
  add: (type, item) => api.post(`/favorites/${type}`, { item }),
  remove: (type, itemId) => api.delete(`/favorites/${type}/${itemId}`),
  getAll: () => api.get('/favorites'),
  getByType: (type) => api.get(`/favorites/${type}`),
  toggle: (type, item) => api.post(`/favorites/${type}/toggle`, { item })
}

export const preferenceAPI = {
  recordBehavior: (data) => api.post('/behavior/record', data),
  getProfile: () => api.get('/user/preferences/profile'),
  getRecommendations: (type) => api.get(`/recommendations/${type}`),
  submitFeedback: (tripId, data) => api.post(`/trips/${tripId}/feedback`, data)
}

export const popularityAPI = {
  predict: (attraction, date, hour) => api.get('/popularity/predict', { params: { attraction, date, hour } }),
  getBestTime: (attraction, date) => api.get('/popularity/best-time', { params: { attraction, date } }),
  estimateDuration: (data) => api.post('/duration/estimate', data),
  getTripPredictions: (data) => api.post('/popularity/trip-predictions', data),
  optimizeSchedule: (data) => api.post('/schedule/optimize', data),
  getOverview: (data) => api.post('/popularity/overview', data)
}

export const weatherAPI = {
  getCurrent: (city) => api.get('/weather', { params: { city } }),
  getForecast: (city, days) => api.get('/weather/forecast', { params: { city, days } })
}

export const searchAPI = {
  all: (keyword) => api.get('/search', { params: { keyword } })
}

export const getRecommendations = (type) => api.get('/recommendations', { params: { type } })

export default api

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMapStore = defineStore('map', () => {
  const mapInstance = ref(null)
  const mapCenter = ref({ lat: 28.2282, lng: 112.9388 })
  const mapZoom = ref(12)
  const markers = ref([])
  const currentMarker = ref(null)
  const routePath = ref([])
  const selectedLocation = ref(null)
  const highlightMarker = ref(null)

  const setMapInstance = (map) => {
    mapInstance.value = map
  }

  const setCenter = (lat, lng) => {
    mapCenter.value = { lat, lng }
    if (mapInstance.value) {
      mapInstance.value.setCenter([lng, lat])
    }
  }

  const setZoom = (zoom) => {
    mapZoom.value = zoom
    if (mapInstance.value) {
      mapInstance.value.setZoom(zoom)
    }
  }

  const addMarker = (marker) => {
    markers.value.push(marker)
  }

  const clearMarkers = () => {
    markers.value.forEach(marker => {
      if (marker.remove) {
        marker.remove()
      }
    })
    markers.value = []
  }

  const setRoutePath = (path) => {
    routePath.value = path
  }

  const setCurrentMarker = (marker) => {
    currentMarker.value = marker
  }

  const setSelectedLocation = (location) => {
    selectedLocation.value = location
  }

  const setHighlightMarker = (markerId) => {
    highlightMarker.value = markerId
  }

  const focusLocation = (lat, lng, zoom = 15) => {
    setCenter(lat, lng)
    setZoom(zoom)
    setSelectedLocation({ lat, lng })
  }

  const resetMap = () => {
    clearMarkers()
    routePath.value = []
    currentMarker.value = null
    selectedLocation.value = null
    highlightMarker.value = null
  }

  return {
    mapInstance,
    mapCenter,
    mapZoom,
    markers,
    currentMarker,
    routePath,
    selectedLocation,
    highlightMarker,
    setMapInstance,
    setCenter,
    setZoom,
    addMarker,
    clearMarkers,
    setRoutePath,
    setCurrentMarker,
    setSelectedLocation,
    setHighlightMarker,
    focusLocation,
    resetMap
  }
})

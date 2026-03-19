<template>
  <div class="amap-viewer">
    <div id="amap-container" class="map-container"></div>
    <div class="map-controls">
      <el-button-group>
        <el-button size="small" @click="zoomIn">+</el-button>
        <el-button size="small" @click="zoomOut">-</el-button>
        <el-button size="small" @click="resetView">重置</el-button>
      </el-button-group>
    </div>
    
    <div class="day-selector" v-if="hasItinerary">
      <el-radio-group v-model="displayMode" size="small">
        <el-radio-button label="all">全部天数</el-radio-button>
        <el-radio-button label="day">单日查看</el-radio-button>
      </el-radio-group>
      <el-select v-if="displayMode === 'day'" v-model="selectedDay" size="small" style="width: 100px; margin-left: 8px;">
        <el-option v-for="day in dayOptions" :key="day" :label="'第' + day + '天'" :value="day" />
      </el-select>
    </div>
    
    <div v-if="loading" class="map-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>地图加载中...</span>
    </div>
    
    <div v-if="error" class="map-error">
      <el-icon><Warning /></el-icon>
      <span>{{ error }}</span>
      <el-button size="small" @click="initMap">重试</el-button>
    </div>
    
    <div v-if="!loading && !error && !hasItinerary && hasParams" class="map-overlay">
      <div class="overlay-content">
        <el-icon :size="48"><Location /></el-icon>
        <p>正在规划行程...</p>
        <p class="sub-text">AI 正在为您搜索最佳景点</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useMapStore } from '../stores/map'
import { useTripStore } from '../stores/trip'
import { ElMessage } from 'element-plus'
import { Loading, Warning, Location } from '@element-plus/icons-vue'
import axios from 'axios'

const mapStore = useMapStore()
const tripStore = useTripStore()

const loading = ref(true)
const error = ref('')
const displayMode = ref('all')
const selectedDay = ref(1)
let map = null
let markers = []
let polylines = []
let hotelMarkers = []
let transportOverlays = []

const hasParams = computed(() => {
  return tripStore.tripParams.days || tripStore.tripParams.crowd || tripStore.tripParams.budget
})

const hasItinerary = computed(() => {
  return tripStore.itinerary && tripStore.itinerary.length > 0
})

const dayOptions = computed(() => {
  if (!tripStore.itinerary) return []
  return tripStore.itinerary.map(d => d.day)
})

const initMap = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const configRes = await axios.get('/api/config/amap')
    if (configRes.data?.code !== 200 || !configRes.data.data) {
      throw new Error('获取地图配置失败')
    }
    
    const { key, securityKey } = configRes.data.data
    
    window._AMapSecurityConfig = {
      securityJsCode: securityKey,
    }

    if (window.AMap) {
      createMap()
      return
    }

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`
    
    script.onload = () => {
      console.log('高德地图脚本加载成功')
      createMap()
    }
    
    script.onerror = () => {
      loading.value = false
      error.value = '地图脚本加载失败，请检查网络连接'
    }
    
    document.head.appendChild(script)
  } catch (err) {
    console.error('地图初始化失败:', err)
    loading.value = false
    error.value = err.message || '地图初始化失败'
  }
}

const createMap = () => {
  try {
    if (!window.AMap) {
      throw new Error('AMap 未定义')
    }
    
    map = new AMap.Map('amap-container', {
      zoom: mapStore.mapZoom || 12,
      center: [mapStore.mapCenter?.lng || 112.9388, mapStore.mapCenter?.lat || 28.2282],
      viewMode: '2D',
      mapStyle: 'amap://styles/normal'
    })

    AMap.plugin(['AMap.Scale', 'AMap.ToolBar'], () => {
      map.addControl(new AMap.Scale())
      map.addControl(new AMap.ToolBar({
        position: 'RB'
      }))
    })

    loading.value = false
    console.log('地图创建成功')
    renderTripMarkers()
  } catch (e) {
    console.error('地图创建失败:', e)
    loading.value = false
    error.value = '地图创建失败: ' + e.message
  }
}

const clearMarkers = () => {
  markers.forEach(marker => {
    try {
      marker.setMap(null)
    } catch (e) {}
  })
  markers = []

  polylines.forEach(line => {
    try {
      line.setMap(null)
    } catch (e) {}
  })
  polylines = []

  hotelMarkers.forEach(marker => {
    try {
      marker.setMap(null)
    } catch (e) {}
  })
  hotelMarkers = []

  transportOverlays.forEach(overlay => {
    try {
      overlay.setMap(null)
    } catch (e) {}
  })
  transportOverlays = []
}

const renderTripMarkers = () => {
  if (!map || !window.AMap) return

  clearMarkers()

  const itinerary = tripStore.itinerary
  if (!itinerary || !itinerary.length) return

  console.log('渲染行程标记, 行程数据:', itinerary)
  itinerary.forEach((day, idx) => {
    console.log(`第${day.day}天 transports:`, day.transports)
  })

  const dayColors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']
  const allPath = []

  if (displayMode.value === 'all') {
    itinerary.forEach((dayTrip, dayIdx) => {
      if (!dayTrip.attractions || !dayTrip.attractions.length) return

      const color = dayColors[dayIdx % dayColors.length]
      const path = []

      dayTrip.attractions.forEach((attr, idx) => {
        const lat = parseFloat(attr.latitude)
        const lng = parseFloat(attr.longitude)
        
        if (!isNaN(lat) && !isNaN(lng)) {
          const position = [lng, lat]
          path.push(position)
          allPath.push(position)

          try {
            const marker = new AMap.Marker({
              position: position,
              title: `Day${dayTrip.day}: ${attr.name}`,
              label: {
                content: `<div class="marker-label day-${dayTrip.day}">${dayTrip.day}-${idx + 1}</div>`,
                direction: 'top'
              }
            })

            marker.on('click', () => {
              ElMessage.info(`景点: ${attr.name} - 第${dayTrip.day}天第${idx + 1}站`)
              mapStore.setHighlightMarker(attr.id)
              mapStore.setSelectedLocation({ lat, lng, day: dayTrip.day, index: idx })
            })

            marker.setMap(map)
            markers.push(marker)
          } catch (e) {
            console.error('添加标记失败:', e)
          }
        }
      })

      if (path.length > 1) {
        try {
          const polyline = new AMap.Polyline({
            path: path,
            strokeColor: color,
            strokeWeight: 4,
            strokeOpacity: 0.8,
            lineJoin: 'round'
          })
          polyline.setMap(map)
          polylines.push(polyline)

          if (dayTrip.transports && dayTrip.transports.length > 0) {
            console.log(`第${dayTrip.day}天有交通数据: ${dayTrip.transports.length}条, path长度: ${path.length}`)
            dayTrip.transports.forEach((transport, tIdx) => {
              console.log(`处理交通索引 ${tIdx}, path[tIdx]: ${path[tIdx]}, path[tIdx+1]: ${path[tIdx + 1]}`)
              if (path[tIdx] && path[tIdx + 1]) {
                const segmentPath = [path[tIdx], path[tIdx + 1]]
                const midLng = (path[tIdx][0] + path[tIdx + 1][0]) / 2
                const midLat = (path[tIdx][1] + path[tIdx + 1][1]) / 2
                
                const segmentLine = new AMap.Polyline({
                  path: segmentPath,
                  strokeColor: color,
                  strokeWeight: 6,
                  strokeOpacity: 0.8,
                  lineJoin: 'round',
                  zIndex: 10
                })

                const info = transport.best || {}
                const allOptions = transport.recommendations || []
                
                let optionsText = allOptions.map(opt => 
                  `${opt.icon || '🚶'}${opt.name || '步行'} ${opt.duration ? opt.duration + '分钟' : ''} ${opt.cost !== undefined ? (opt.cost === 0 ? '免费' : opt.cost + '元') : ''}`
                ).join(' | ')
                
                const tooltipContent = `${transport.from} → ${transport.to} (${info.distance || 0}米)\n${optionsText}`

                segmentLine.on('mouseover', (e) => {
                  segmentLine.setOptions({
                    strokeWeight: 8,
                    strokeOpacity: 1
                  })
                  
                  const infoWindow = new AMap.InfoWindow({
                    content: `<div class="transport-bubble">
                      <div class="bubble-route">${transport.from} → ${transport.to}</div>
                      <div class="bubble-distance">${info.distance || 0}米</div>
                      <div class="bubble-options">${allOptions.map(opt => 
                        `<span class="bubble-opt">${opt.icon || '🚶'}${opt.duration || '--'}分钟</span>`
                      ).join('')}</div>
                    </div>`,
                    offset: new AMap.Pixel(0, -10)
                  })
                  infoWindow.open(map, e.lnglat)
                  segmentLine._infoWindow = infoWindow
                })

                segmentLine.on('mouseout', () => {
                  segmentLine.setOptions({
                    strokeWeight: 6,
                    strokeOpacity: 0.8
                  })
                  if (segmentLine._infoWindow) {
                    segmentLine._infoWindow.close()
                  }
                })

                segmentLine.on('click', () => {
                  ElMessage.success({
                    message: tooltipContent,
                    duration: 3000,
                    customClass: 'transport-message'
                  })
                })

                segmentLine.setMap(map)
                transportOverlays.push(segmentLine)

                const transportMarker = new AMap.Marker({
                  position: [midLng, midLat],
                  offset: new AMap.Pixel(-16, -16),
                  content: `<div class="transport-marker">
                    <span class="transport-icon">${info.icon || '🚶'}</span>
                  </div>`
                })

                transportMarker.on('mouseover', () => {
                  ElMessage.success({
                    message: tooltipContent,
                    duration: 3000,
                    customClass: 'transport-message'
                  })
                })

                transportMarker.on('click', () => {
                  ElMessage.success({
                    message: tooltipContent,
                    duration: 3000,
                    customClass: 'transport-message'
                  })
                })

                transportMarker.setMap(map)
                transportOverlays.push(transportMarker)
              }
            })
          }
        } catch (e) {
          console.error('添加路线失败:', e)
        }
      }

      if (dayTrip.restaurants && dayTrip.restaurants.length > 0) {
        dayTrip.restaurants.forEach((rest, idx) => {
          const lat = parseFloat(rest.latitude)
          const lng = parseFloat(rest.longitude)
          
          if (!isNaN(lat) && !isNaN(lng)) {
            try {
              const marker = new AMap.Marker({
                position: [lng, lat],
                title: rest.name,
                label: {
                  content: `<div class="marker-label restaurant">R</div>`,
                  direction: 'top'
                }
              })

              marker.on('click', () => {
                ElMessage.info(`餐厅: ${rest.name} - ${rest.cuisine || '美食'}`)
              })

              marker.setMap(map)
              markers.push(marker)
            } catch (e) {}
          }
        })
      }

      if (dayTrip.hotels && dayTrip.hotels.length > 0) {
        dayTrip.hotels.forEach((hotel, idx) => {
          const lat = parseFloat(hotel.latitude)
          const lng = parseFloat(hotel.longitude)
          
          if (!isNaN(lat) && !isNaN(lng)) {
            try {
              const marker = new AMap.Marker({
                position: [lng, lat],
                title: hotel.name,
                label: {
                  content: `<div class="marker-label hotel">H</div>`,
                  direction: 'top'
                }
              })

              marker.on('click', () => {
                ElMessage.info(`酒店: ${hotel.name}${hotel.starRating ? ` - ${hotel.starRating}星级` : ''}`)
              })

              marker.setMap(map)
              hotelMarkers.push(marker)
            } catch (e) {}
          }
        })
      }
    })
  } else {
    const dayTrip = itinerary.find(d => d.day === selectedDay.value)
    if (!dayTrip || !dayTrip.attractions || !dayTrip.attractions.length) return

    const path = []

    dayTrip.attractions.forEach((attr, idx) => {
      const lat = parseFloat(attr.latitude)
      const lng = parseFloat(attr.longitude)
      
      if (!isNaN(lat) && !isNaN(lng)) {
        const position = [lng, lat]
        path.push(position)
        allPath.push(position)

        try {
          const marker = new AMap.Marker({
            position: position,
            title: attr.name,
            label: {
              content: `<div class="marker-label">${idx + 1}</div>`,
              direction: 'top'
            }
          })

          marker.on('click', () => {
            ElMessage.info(`景点: ${attr.name} - 第${idx + 1}站`)
          })

          marker.setMap(map)
          markers.push(marker)
        } catch (e) {
          console.error('添加标记失败:', e)
        }
      }
    })

    if (path.length > 1) {
      try {
        const polyline = new AMap.Polyline({
          path: path,
          strokeColor: '#409eff',
          strokeWeight: 4,
          strokeOpacity: 0.8,
          lineJoin: 'round'
        })
        polyline.setMap(map)
        polylines.push(polyline)

        if (dayTrip.transports && dayTrip.transports.length > 0) {
          dayTrip.transports.forEach((transport, tIdx) => {
            if (path[tIdx] && path[tIdx + 1]) {
              const segmentPath = [path[tIdx], path[tIdx + 1]]
              const midLng = (path[tIdx][0] + path[tIdx + 1][0]) / 2
              const midLat = (path[tIdx][1] + path[tIdx + 1][1]) / 2
              
              const segmentLine = new AMap.Polyline({
                path: segmentPath,
                strokeColor: '#409eff',
                strokeWeight: 6,
                strokeOpacity: 0.8,
                lineJoin: 'round',
                zIndex: 10
              })

              const info = transport.best || {}
              const allOptions = transport.recommendations || []
              
              let optionsText = allOptions.map(opt => 
                `${opt.icon || '🚶'}${opt.name || '步行'} ${opt.duration ? opt.duration + '分钟' : ''} ${opt.cost !== undefined ? (opt.cost === 0 ? '免费' : opt.cost + '元') : ''}`
              ).join(' | ')
              
              const tooltipContent = `${transport.from} → ${transport.to} (${info.distance || 0}米)\n${optionsText}`

              segmentLine.on('mouseover', (e) => {
                segmentLine.setOptions({
                  strokeWeight: 8,
                  strokeOpacity: 1
                })
                
                const infoWindow = new AMap.InfoWindow({
                  content: `<div class="transport-bubble">
                    <div class="bubble-route">${transport.from} → ${transport.to}</div>
                    <div class="bubble-distance">${info.distance || 0}米</div>
                    <div class="bubble-options">${allOptions.map(opt => 
                      `<span class="bubble-opt">${opt.icon || '🚶'}${opt.duration || '--'}分钟</span>`
                    ).join('')}</div>
                  </div>`,
                  offset: new AMap.Pixel(0, -10)
                })
                infoWindow.open(map, e.lnglat)
                segmentLine._infoWindow = infoWindow
              })

              segmentLine.on('mouseout', () => {
                segmentLine.setOptions({
                  strokeWeight: 6,
                  strokeOpacity: 0.8
                })
                if (segmentLine._infoWindow) {
                  segmentLine._infoWindow.close()
                }
              })

              segmentLine.on('click', () => {
                ElMessage.success({
                  message: tooltipContent,
                  duration: 3000,
                  customClass: 'transport-message'
                })
              })

              segmentLine.setMap(map)
              transportOverlays.push(segmentLine)

              const transportMarker = new AMap.Marker({
                position: [midLng, midLat],
                offset: new AMap.Pixel(-16, -16),
                content: `<div class="transport-marker">
                  <span class="transport-icon">${info.icon || '🚶'}</span>
                </div>`
              })

              transportMarker.on('mouseover', () => {
                ElMessage.success({
                  message: tooltipContent,
                  duration: 3000,
                  customClass: 'transport-message'
                })
              })

              transportMarker.on('click', () => {
                ElMessage.success({
                  message: tooltipContent,
                  duration: 3000,
                  customClass: 'transport-message'
                })
              })

              transportMarker.setMap(map)
              transportOverlays.push(transportMarker)
            }
          })
        }
      } catch (e) {
        console.error('添加路线失败:', e)
      }
    }

    if (dayTrip.restaurants && dayTrip.restaurants.length > 0) {
      dayTrip.restaurants.forEach((rest, idx) => {
        const lat = parseFloat(rest.latitude)
        const lng = parseFloat(rest.longitude)
        
        if (!isNaN(lat) && !isNaN(lng)) {
          try {
            const marker = new AMap.Marker({
              position: [lng, lat],
              title: rest.name,
              label: {
                content: `<div class="marker-label restaurant">R</div>`,
                direction: 'top'
              }
            })

            marker.on('click', () => {
              ElMessage.info(`餐厅: ${rest.name}`)
            })

            marker.setMap(map)
            markers.push(marker)
          } catch (e) {}
        }
      })
    }

    if (dayTrip.hotels && dayTrip.hotels.length > 0) {
      dayTrip.hotels.forEach((hotel, idx) => {
        const lat = parseFloat(hotel.latitude)
        const lng = parseFloat(hotel.longitude)
        
        if (!isNaN(lat) && !isNaN(lng)) {
          try {
            const marker = new AMap.Marker({
              position: [lng, lat],
              title: hotel.name,
              label: {
                content: `<div class="marker-label hotel">H</div>`,
                direction: 'top'
              }
            })

            marker.on('click', () => {
              ElMessage.info(`酒店: ${hotel.name}`)
            })

            marker.setMap(map)
            hotelMarkers.push(marker)
          } catch (e) {}
        }
      })
    }
  }

  if (allPath.length > 0) {
    try {
      map.setFitView(markers, false, [50, 50, 50, 50])
    } catch (e) {}
  }
}

const zoomIn = () => {
  if (map) map.zoomIn()
}

const zoomOut = () => {
  if (map) map.zoomOut()
}

const resetView = () => {
  if (map) {
    map.setZoomAndCenter(12, [112.9388, 28.2282])
  }
}

watch(() => tripStore.itinerary, () => {
  renderTripMarkers()
}, { deep: true })

watch([displayMode, selectedDay], () => {
  renderTripMarkers()
})

watch(() => mapStore.mapCenter, (newCenter) => {
  if (map && newCenter) {
    map.setCenter([newCenter.lng, newCenter.lat])
  }
}, { deep: true })

watch(() => mapStore.mapZoom, (newZoom) => {
  if (map && newZoom) {
    map.setZoom(newZoom)
  }
})

onMounted(() => {
  initMap()
})

onUnmounted(() => {
  if (map) {
    try {
      map.destroy()
    } catch (e) {}
  }
})
</script>

<style scoped>
.amap-viewer {
  width: 100%;
  height: 100%;
  position: relative;
  background: #f5f7fa;
}

.map-container {
  width: 100%;
  height: 100%;
}

.map-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 100;
}

.day-selector {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 100;
  background: white;
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
}

.map-loading,
.map-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 200;
  color: #909399;
}

.map-loading .el-icon,
.map-error .el-icon {
  font-size: 32px;
}

.map-loading .el-icon {
  color: #409eff;
}

.map-error .el-icon {
  color: #f56c6c;
}

.map-error span {
  color: #606266;
  font-size: 14px;
}

.map-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 150;
  pointer-events: none;
}

.overlay-content {
  text-align: center;
  color: #909399;
}

.overlay-content .el-icon {
  color: #409eff;
  animation: bounce 1s ease infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.overlay-content p {
  margin: 12px 0 4px;
  font-size: 16px;
}

.overlay-content .sub-text {
  font-size: 12px;
  color: #c0c4cc;
}

:deep(.marker-label) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  min-width: 20px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

:deep(.marker-label.day-1) {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
}

:deep(.marker-label.day-2) {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
}

:deep(.marker-label.day-3) {
  background: linear-gradient(135deg, #e6a23c 0%, #ebb563 100%);
}

:deep(.marker-label.day-4) {
  background: linear-gradient(135deg, #f56c6c 0%, #f78989 100%);
}

:deep(.marker-label.day-5) {
  background: linear-gradient(135deg, #909399 0%, #a6a9ad 100%);
}

:deep(.marker-label.restaurant) {
  background: linear-gradient(135deg, #ff9900 0%, #ffad33 100%);
  font-size: 14px;
  padding: 4px 6px;
}

:deep(.marker-label.hotel) {
  background: linear-gradient(135deg, #9b59b6 0%, #b07cc6 100%);
  font-size: 14px;
  padding: 4px 6px;
}

:deep(.transport-marker) {
  background: white;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

:deep(.transport-marker:hover) {
  transform: scale(1.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

:deep(.transport-marker .transport-icon) {
  font-size: 16px;
}

:deep(.transport-marker.always-show) {
  width: auto;
  height: auto;
  padding: 6px 10px;
  border-radius: 16px;
  gap: 4px;
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  color: white;
}

:deep(.transport-marker.always-show .transport-icon) {
  font-size: 14px;
}

:deep(.transport-marker.always-show .transport-name) {
  font-size: 12px;
  font-weight: 600;
}

:deep(.transport-marker.always-show .transport-duration) {
  font-size: 11px;
  opacity: 0.9;
}

:deep(.transport-bubble) {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 12px;
  min-width: 120px;
}

:deep(.transport-bubble .bubble-route) {
  font-weight: 600;
  font-size: 13px;
  color: #303133;
  white-space: nowrap;
}

:deep(.transport-bubble .bubble-distance) {
  font-size: 11px;
  color: #909399;
}

:deep(.transport-bubble .bubble-options) {
  display: flex;
  gap: 6px;
}

:deep(.transport-bubble .bubble-opt) {
  background: rgba(103, 179, 130, 0.2);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
}

:deep(.transport-message) {
  background: rgba(255, 255, 255, 0.9) !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1)!important;
  padding: 10px 15px!important;
  font-size: 13px!important;
  line-height: 1.5!important;
  white-space: pre-line!important;
}

:deep(.transport-message .el-message__content) {
  font-size: 13px!important;
  line-height: 1.4!important;
}

:deep(.transport-tooltip .tooltip-content) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

:deep(.transport-tooltip .tooltip-icon) {
  font-size: 18px;
}

:deep(.transport-tooltip .tooltip-name) {
  font-weight: 500;
  color: #409eff;
}

:deep(.transport-tooltip .tooltip-duration),
:deep(.transport-tooltip .tooltip-distance) {
  font-size: 12px;
  color: #909399;
}

:deep(.transport-tooltip .tooltip-reason) {
  font-size: 12px;
  color: #67c23a;
  margin-top: 4px;
}
</style>

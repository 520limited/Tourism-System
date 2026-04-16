const { v4: uuidv4 } = require('uuid');
const { dbRun, dbGet, dbAll } = require('../../database/db');
const logger = require('../logger');



class TripService {
  constructor() {
    this.trips = new Map();
    this.tripNodes = new Map();
  }

  async createTrip(userId, params, itinerary, conversationHistory = [], routes = [], activities = [], sessionId = null, crowdPredictions = null, timeEstimates = null) {
    const safeParams = params || { days: 3, crowd: '' };
    const tripId = uuidv4();
    const conversationId = uuidv4();
    const title = this.generateTripTitle(safeParams);

    try {
      logger.info(`创建行程参数 - userId: ${userId}, sessionId: ${sessionId}, title: ${title}`);
      
      await dbRun(
        `INSERT INTO trips (id, user_id, session_id, title, requirements, itinerary, conversation_history, routes, activities, crowd_predictions, time_estimates, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tripId,
          userId || null,
          sessionId || null,
          title,
          JSON.stringify(params || {}),
          JSON.stringify(itinerary || []),
          JSON.stringify(conversationHistory || []),
          JSON.stringify(routes || []),
          JSON.stringify(activities || []),
          crowdPredictions ? JSON.stringify(crowdPredictions) : null,
          timeEstimates ? JSON.stringify(timeEstimates) : null,
          'draft'
        ]
      );

      logger.info(`创建行程成功: ${tripId}`);

      return { tripId, title };
    } catch (error) {
      logger.error(`创建行程失败: ${error.message}`);
      throw error;
    }
  }

  async saveTripRoutes(tripId, itinerary) {
    try {
      for (const day of itinerary) {
        if (day.transports && day.transports.length > 0) {
          for (const transport of day.transports) {
            const routeId = uuidv4();
            await dbRun(
              `INSERT INTO trip_routes (id, trip_id, day, route_type, origin_name, destination_name, origin_coord, destination_coord, route_data) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                routeId,
                tripId,
                day.day,
                transport.best?.mode || 'unknown',
                transport.from || '',
                transport.to || '',
                transport.originCoord || '',
                transport.destinationCoord || '',
                JSON.stringify(transport)
              ]
            );
          }
        }
      }
      logger.info(`保存交通路线成功: ${tripId}`);
    } catch (error) {
      logger.error(`保存交通路线失败: ${error.message}`);
    }
  }

  async getTripRoutes(tripId) {
    try {
      const routes = await dbAll(
        'SELECT * FROM trip_routes WHERE trip_id = ? ORDER BY day, created_at',
        [tripId]
      );
      return routes.map(route => ({
        id: route.id,
        tripId: route.trip_id,
        day: route.day,
        routeType: route.route_type,
        originName: route.origin_name,
        destinationName: route.destination_name,
        originCoord: route.origin_coord,
        destinationCoord: route.destination_coord,
        routeData: JSON.parse(route.route_data || '{}'),
        createdAt: route.created_at
      }));
    } catch (error) {
      logger.error(`获取交通路线失败: ${error.message}`);
      return [];
    }
  }

  async saveTripNodes(tripId, itinerary) {
    const nodes = [];
    let nodeId = 1;

    itinerary.forEach((dayPlan) => {
      dayPlan.attractions.forEach((attr, idx) => {
        const node = {
          nodeId: `n_${tripId}_${nodeId++}`,
          tripId,
          day: dayPlan.day,
          timeSlot: attr.bestTime || '上午',
          attractionId: attr.id || attr.attraction_id,
          name: attr.name,
          latitude: attr.latitude,
          longitude: attr.longitude,
          durationHours: attr.estimatedDuration || attr.suggestedDuration || 2,
          transportInfo: attr.transportInfo || '',
          cost: attr.ticketPrice || attr.cost || 0,
          sortOrder: idx + 1,
          createdAt: new Date()
        };
        nodes.push(node);
        this.tripNodes.set(node.nodeId, node);
      });
    });

    return nodes;
  }

  async getTripById(tripId) {
    try {
      const trip = await dbGet('SELECT * FROM trips WHERE id = ?', [tripId]);
      
      if (!trip) {
        throw new Error('行程不存在');
      }

      return {
        tripId: trip.id,
        userId: trip.user_id,
        sessionId: trip.session_id,
        title: trip.title,
        requirements: JSON.parse(trip.requirements || '{}'),
        activities: JSON.parse(trip.activities || '[]'),
        itinerary: JSON.parse(trip.itinerary || '[]'),
        conversationHistory: JSON.parse(trip.conversation_history || '[]'),
        routes: JSON.parse(trip.routes || '[]'),
        crowdPredictions: trip.crowd_predictions ? JSON.parse(trip.crowd_predictions) : null,
        timeEstimates: trip.time_estimates ? JSON.parse(trip.time_estimates) : null,
        userFeedback: trip.user_feedback ? JSON.parse(trip.user_feedback) : null,
        status: trip.status,
        isFavorite: !!trip.is_favorite,
        createdAt: trip.created_at,
        updatedAt: trip.updated_at
      };
    } catch (error) {
      logger.error(`获取行程失败: ${error.message}`);
      throw error;
    }
  }

  async getUserTrips(userId, filters = {}, sessionId = null) {
    try {
      logger.info(`getUserTrips 参数 - userId: ${userId}, sessionId: ${sessionId}`);
      
      let countSql = 'SELECT COUNT(*) as total FROM trips WHERE 1=1';
      let sql = 'SELECT * FROM trips WHERE 1=1';
      const params = [];
      const countParams = [];

      if (userId) {
        sql += ' AND user_id = ?';
        countSql += ' AND user_id = ?';
        params.push(userId);
        countParams.push(userId);
        logger.info(`查询用户行程，userId: ${userId}`);
      } else if (sessionId) {
        // 游客模式：通过 session_id 查询
        sql += ' AND session_id = ?';
        countSql += ' AND session_id = ?';
        params.push(sessionId);
        countParams.push(sessionId);
        logger.info(`查询游客行程，sessionId: ${sessionId}`);
      } else {
        // 既没有 userId 也没有 sessionId，返回空
        logger.info('无用户信息，返回空列表');
        return { trips: [], total: 0 };
      }

      if (filters.status) {
        sql += ' AND status = ?';
        countSql += ' AND status = ?';
        params.push(filters.status);
        countParams.push(filters.status);
      }

      if (filters.days) {
        sql += ' AND JSON_EXTRACT(requirements, "$.days") = ?';
        countSql += ' AND JSON_EXTRACT(requirements, "$.days") = ?';
        params.push(parseInt(filters.days));
        countParams.push(parseInt(filters.days));
      }

      if (filters.keyword) {
        sql += ' AND title LIKE ?';
        countSql += ' AND title LIKE ?';
        params.push(`%${filters.keyword}%`);
        countParams.push(`%${filters.keyword}%`);
      }

      if (filters.isFavorite !== undefined) {
        sql += ' AND is_favorite = ?';
        countSql += ' AND is_favorite = ?';
        params.push(filters.isFavorite ? 1 : 0);
        countParams.push(filters.isFavorite ? 1 : 0);
      }

      sql += ' ORDER BY updated_at DESC';

      const page = parseInt(filters.page) || 1;
      const pageSize = parseInt(filters.pageSize) || 12;
      const offset = (page - 1) * pageSize;
      sql += ` LIMIT ${pageSize} OFFSET ${offset}`;

      const [trips, countResult] = await Promise.all([
        dbAll(sql, params),
        dbGet(countSql, countParams)
      ]);

      return {
        trips: trips.map(trip => ({
          tripId: trip.id,
          title: trip.title,
          requirements: JSON.parse(trip.requirements || '{}'),
          activities: JSON.parse(trip.activities || '[]'),
          status: trip.status,
          isFavorite: trip.is_favorite === 1,
          createdAt: trip.created_at,
          updatedAt: trip.updated_at
        })),
        total: countResult?.total || 0
      };
    } catch (error) {
      logger.error(`获取用户行程列表失败: ${error.message}`);
      return { trips: [], total: 0 };
    }
  }

  async updateTrip(tripId, updates) {
    try {
      const fields = [];
      const values = [];

      if (updates.title) {
        fields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.requirements) {
        fields.push('requirements = ?');
        values.push(JSON.stringify(updates.requirements));
      }
      if (updates.itinerary) {
        fields.push('itinerary = ?');
        values.push(JSON.stringify(updates.itinerary));
      }
      if (updates.conversationHistory !== undefined) {
        fields.push('conversation_history = ?');
        values.push(JSON.stringify(updates.conversationHistory));
      }
      if (updates.routes !== undefined) {
      fields.push('routes = ?');
      values.push(JSON.stringify(updates.routes));
    }
    if (updates.activities !== undefined) {
      fields.push('activities = ?');
      values.push(JSON.stringify(updates.activities));
    }
    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.crowdPredictions !== undefined) {
      fields.push('crowd_predictions = ?');
      values.push(JSON.stringify(updates.crowdPredictions));
    }
    if (updates.timeEstimates !== undefined) {
      fields.push('time_estimates = ?');
      values.push(JSON.stringify(updates.timeEstimates));
    }
    if (updates.userFeedback !== undefined) {
      fields.push('user_feedback = ?');
      values.push(JSON.stringify(updates.userFeedback));
    }
    if (updates.isFavorite !== undefined) {
      fields.push('is_favorite = ?');
      values.push(updates.isFavorite ? 1 : 0);
    }

      if (fields.length === 0) {
        return this.getTripById(tripId);
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(tripId);

      await dbRun(`UPDATE trips SET ${fields.join(', ')} WHERE id = ?`, values);

      logger.info(`更新行程成功: ${tripId}`);

      return this.getTripById(tripId);
    } catch (error) {
      logger.error(`更新行程失败: ${error.message}`);
      throw error;
    }
  }

  async updateTripItinerary(tripId, itinerary) {
    return this.updateTrip(tripId, { itinerary });
  }

  async saveConversationMessage(tripId, role, content) {
    try {
      const trip = await this.getTripById(tripId);
      const history = trip.conversationHistory || [];
      history.push({ role, content, timestamp: new Date().toISOString() });
      
      await this.updateTrip(tripId, { conversationHistory: history });
      
      return history;
    } catch (error) {
      logger.error(`保存对话消息失败: ${error.message}`);
      throw error;
    }
  }

  async saveRoute(tripId, day, routeType, origin, destination, routeData) {
    try {
      const trip = await this.getTripById(tripId);
      const routes = trip.routes || [];
      
      routes.push({
        id: uuidv4(),
        day,
        routeType,
        origin: {
          name: origin.name,
          coord: origin.coord
        },
        destination: {
          name: destination.name,
          coord: destination.coord
        },
        routeData,
        timestamp: new Date().toISOString()
      });
      
      await this.updateTrip(tripId, { routes });
      
      return routes;
    } catch (error) {
      logger.error(`保存路径失败: ${error.message}`);
      throw error;
    }
  }

  async deleteTrip(tripId) {
    try {
      await dbRun('DELETE FROM trips WHERE id = ?', [tripId]);
      logger.info(`删除行程成功: ${tripId}`);
      return true;
    } catch (error) {
      logger.error(`删除行程失败: ${error.message}`);
      throw error;
    }
  }

  async favoriteTrip(tripId, isFavorite) {
    return this.updateTrip(tripId, { isFavorite });
  }

  async duplicateTrip(tripId, userId) {
    const original = await this.getTripById(tripId);
    return this.createTrip(
      userId,
      original.requirements,
      original.itinerary,
      original.conversationHistory,
      original.routes,
      original.activities,
      null,
      original.crowdPredictions,
      original.timeEstimates
    );
  }

  generateTripTitle(params) {
    const safeParams = params || {};
    const days = safeParams.days || 3;
    const crowd = safeParams.crowd || '';
    return `${days}天${crowd ? crowd + '' : ''}长沙深度游`;
  }

  async exportTrip(tripId, format = 'pdf') {
    const trip = await this.getTripById(tripId);
    return {
      format,
      trip,
      exportDate: new Date()
    };
  }

  async generateShareLink(tripId) {
    const trip = await this.getTripById(tripId);
    const shareId = 'share_' + uuidv4().slice(0, 12);

    // 写入数据库 shared_trips 表（而非内存 Map）
    await dbRun(
      `INSERT INTO shared_trips (share_id, trip_id, expires_at, view_count)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), 0)`,
      [shareId, tripId]
    );

    return {
      shareId,
      link: `/trip/shared/${shareId}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
  }

  async getSharedTrip(shareId) {
    // 从数据库读取
    const shared = await dbGet(
      `SELECT * FROM shared_trips WHERE share_id = ? AND expires_at > NOW()`,
      [shareId]
    );

    if (!shared) {
      throw new Error('分享链接不存在或已过期');
    }

    // 更新浏览计数
    await dbRun(`UPDATE shared_trips SET view_count = view_count + 1 WHERE share_id = ?`, [shareId]);

    // 返回关联的行程数据
    const tripData = await this.getTripById(shared.trip_id);
    if (!tripData) {
      throw new Error('关联的行程不存在');
    }
    return tripData;
  }

  async getTripStats(userId, sessionId = null) {
    try {
      let whereClause = '';
      const params = [];
      
      if (userId) {
        whereClause = 'WHERE user_id = ?';
        params.push(userId);
      } else if (sessionId) {
        whereClause = 'WHERE session_id = ?';
        params.push(sessionId);
      } else {
        return { crowdTypes: {}, monthlyTrips: {} };
      }

      const trips = await dbAll(`SELECT requirements, created_at FROM trips ${whereClause}`, params);
      
      const crowdTypes = {};
      const monthlyTrips = {};
      
      trips.forEach(trip => {
        const requirements = JSON.parse(trip.requirements || '{}');
        const crowd = requirements.crowd || '其他';
        crowdTypes[crowd] = (crowdTypes[crowd] || 0) + 1;
        
        if (trip.created_at) {
          const date = new Date(trip.created_at);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyTrips[monthKey] = (monthlyTrips[monthKey] || 0) + 1;
        }
      });

      const sortedMonths = Object.keys(monthlyTrips).sort();
      const last6Months = sortedMonths.slice(-6);
      const filteredMonthlyTrips = {};
      last6Months.forEach(month => {
        filteredMonthlyTrips[month] = monthlyTrips[month];
      });

      return { crowdTypes, monthlyTrips: filteredMonthlyTrips };
    } catch (error) {
      logger.error(`获取行程统计失败: ${error.message}`);
      return { crowdTypes: {}, monthlyTrips: {} };
    }
  }
}

module.exports = new TripService();

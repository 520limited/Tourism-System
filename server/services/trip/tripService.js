const { v4: uuidv4 } = require('uuid');
const { dbRun, dbGet, dbAll } = require('../../database/db');
const logger = require('../logger');



class TripService {
  constructor() {
    this.trips = new Map();
    this.tripNodes = new Map();
    this.sharedTrips = new Map();
  }

  async createTrip(userId, params, itinerary, conversationHistory = [], routes = [], activities = [], sessionId = null) {
    const safeParams = params || { days: 3, crowd: '' };
    const tripId = uuidv4();
    const conversationId = uuidv4();
    const title = this.generateTripTitle(safeParams);

    try {
      await dbRun(
        `INSERT INTO trips (id, user_id, session_id, title, requirements, itinerary, conversation_history, routes, activities, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        title: trip.title,
        requirements: JSON.parse(trip.requirements || '{}'),
        activities: JSON.parse(trip.activities || '[]'),
        itinerary: JSON.parse(trip.itinerary || '[]'),
        conversationHistory: JSON.parse(trip.conversation_history || '[]'),
        routes: JSON.parse(trip.routes || '[]'),
        status: trip.status,
        isFavorite: trip.is_favorite === 1,
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
      let countSql = 'SELECT COUNT(*) as total FROM trips WHERE 1=1';
      let sql = 'SELECT * FROM trips WHERE 1=1';
      const params = [];
      const countParams = [];

      if (userId) {
        sql += ' AND user_id = ?';
        countSql += ' AND user_id = ?';
        params.push(userId);
        countParams.push(userId);
      } else if (sessionId) {
        // 游客模式：通过 session_id 查询
        sql += ' AND session_id = ?';
        countSql += ' AND session_id = ?';
        params.push(sessionId);
        countParams.push(sessionId);
      } else {
        // 既没有 userId 也没有 sessionId，返回空
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
    return this.updateTrip(tripId, { status: isFavorite ? 'favorited' : 'saved' });
  }

  async duplicateTrip(tripId, userId) {
    const original = await this.getTripById(tripId);
    return this.createTrip(
      userId,
      original.requirements,
      original.itinerary,
      original.conversationHistory,
      original.routes
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
    
    this.sharedTrips.set(shareId, {
      tripId,
      trip,
      shareId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      viewCount: 0
    });
    
    return {
      shareId,
      link: `/trip/shared/${shareId}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
  }

  async getSharedTrip(shareId) {
    const shared = this.sharedTrips.get(shareId);
    if (!shared) {
      throw new Error('分享链接不存在或已过期');
    }
    
    if (new Date() > shared.expiresAt) {
      this.sharedTrips.delete(shareId);
      throw new Error('分享链接已过期');
    }
    
    shared.viewCount++;
    return shared.trip;
  }
}

module.exports = new TripService();

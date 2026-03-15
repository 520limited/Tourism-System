const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { dbRun, dbGet, dbAll } = require('../../database/db');
const logger = require('../logger');

class UserService {
  async register(data) {
    const { email, password, nickname } = data;

    if (!email || !password) {
      throw new Error('邮箱和密码不能为空');
    }

    if (!this.validateEmail(email)) {
      throw new Error('邮箱格式不正确');
    }

    if (password.length < 6) {
      throw new Error('密码长度至少6位');
    }

    const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      throw new Error('该邮箱已注册');
    }

    const userId = 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const passwordHash = await bcrypt.hash(password, 10);
    const userNickname = nickname || email.split('@')[0];

    await dbRun(
      `INSERT INTO users (id, email, password_hash, nickname, preferences) VALUES (?, ?, ?, ?, ?)`,
      [userId, email, passwordHash, userNickname, JSON.stringify({})]
    );

    logger.info(`用户注册成功: ${email}`);

    return { userId, nickname: userNickname, email };
  }

  async login(email, password) {
    if (!email || !password) {
      throw new Error('邮箱和密码不能为空');
    }

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      throw new Error('用户不存在');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('密码错误');
    }

    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
    const expireDays = parseInt(process.env.SESSION_EXPIRE_DAYS) || 5;
    const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);
    
    await dbRun(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
      [sessionId, user.id, expiresAt.toISOString().slice(0, 19).replace('T', ' ')]
    );

    logger.info(`用户登录成功: ${email}`);

    return {
      sessionId,
      user: {
        userId: user.id,
        nickname: user.nickname,
        email: user.email,
        avatar: user.avatar,
        preferences: JSON.parse(user.preferences || '{}')
      }
    };
  }

  async logout(sessionId) {
    await dbRun('DELETE FROM sessions WHERE id = ?', [sessionId]);
    logger.info(`用户登出: ${sessionId}`);
    return true;
  }

  async getUserBySession(sessionId) {
    if (!sessionId) return null;
    
    const session = await dbGet(
      `SELECT s.*, u.* FROM sessions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.id = ?`,
      [sessionId]
    );

    if (!session) {
      return null;
    }

    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      await dbRun('DELETE FROM sessions WHERE id = ?', [sessionId]);
      return null;
    }

    return {
      userId: session.user_id,
      nickname: session.nickname,
      email: session.email,
      avatar: session.avatar,
      preferences: JSON.parse(session.preferences || '{}'),
      createdAt: session.created_at
    };
  }

  async getUserById(userId) {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return null;

    return {
      userId: user.id,
      nickname: user.nickname,
      email: user.email,
      avatar: user.avatar,
      preferences: JSON.parse(user.preferences || '{}'),
      createdAt: user.created_at
    };
  }

  async updateUser(userId, updates) {
    const fields = [];
    const values = [];

    if (updates.nickname) {
      fields.push('nickname = ?');
      values.push(updates.nickname);
    }
    if (updates.avatar) {
      fields.push('avatar = ?');
      values.push(updates.avatar);
    }
    if (updates.preferences) {
      fields.push('preferences = ?');
      values.push(JSON.stringify(updates.preferences));
    }

    if (fields.length === 0) {
      throw new Error('没有要更新的内容');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    await dbRun(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    
    return this.getUserById(userId);
  }

  async updatePreferences(userId, preferences) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const newPreferences = { ...user.preferences, ...preferences };
    return this.updateUser(userId, { preferences: newPreferences });
  }

  async changePassword(userId, oldPassword, newPassword) {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new Error('用户不存在');
    }

    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) {
      throw new Error('原密码错误');
    }

    if (newPassword.length < 6) {
      throw new Error('新密码长度至少6位');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await dbRun(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPasswordHash, userId]
    );

    logger.info(`用户修改密码: ${user.email}`);
    return true;
  }

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  async cleanExpiredSessions() {
    const result = await dbRun(`DELETE FROM sessions WHERE expires_at < NOW()`);
    logger.info(`清理过期会话: ${result.changes} 条`);
    return result.changes;
  }
}

module.exports = new UserService();

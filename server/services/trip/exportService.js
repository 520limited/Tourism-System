const logger = require('../logger');

/**
 * 行程导出服务
 * 支持多种格式导出：JSON、文本、Markdown
 */
class ExportService {
  
  /**
   * 导出为JSON格式
   */
  exportToJSON(tripData) {
    return JSON.stringify(tripData, null, 2);
  }

  /**
   * 导出为文本格式
   */
  exportToText(tripData) {
    const { requirements, itinerary } = tripData;
    let text = '═══════════════════════════════════════════\n';
    text += '           长沙旅游行程规划\n';
    text += '═══════════════════════════════════════════\n\n';
    
    if (requirements) {
      text += '【行程需求】\n';
      text += `出行天数：${requirements.days || '未设置'}天\n`;
      text += `出行人群：${requirements.crowd || '未设置'}\n`;
      text += `预算范围：${requirements.budget || '未设置'}元\n`;
      if (requirements.interests?.length) {
        text += `兴趣偏好：${requirements.interests.join('、')}\n`;
      }
      if (requirements.foodPreferences?.length) {
        text += `美食偏好：${requirements.foodPreferences.join('、')}\n`;
      }
      text += '\n';
    }

    if (itinerary && itinerary.length > 0) {
      itinerary.forEach(day => {
        text += `───────────────────────────────────────────\n`;
        text += `第${day.day}天：${day.title || '长沙游览'}\n`;
        text += `日期：${day.date || '待定'}\n`;
        text += `───────────────────────────────────────────\n\n`;
        
        if (day.attractions?.length > 0) {
          text += '📍 景点安排\n';
          day.attractions.forEach((attr, idx) => {
            text += `  ${idx + 1}. ${attr.name}\n`;
            text += `     类型：${attr.type || '景点'}\n`;
            text += `     门票：${attr.ticketPrice > 0 ? attr.ticketPrice + '元' : '免费'}\n`;
            text += `     时长：约${attr.estimatedDuration || 2}小时\n`;
            text += `     地址：${attr.address || '长沙市'}\n`;
            text += `     最佳时间：${attr.bestTime || '全天'}\n\n`;
          });
        }

        if (day.restaurants?.length > 0) {
          text += '🍽️ 美食推荐\n';
          day.restaurants.forEach((rest, idx) => {
            text += `  ${idx + 1}. ${rest.name}\n`;
            text += `     菜系：${rest.cuisine || '湘菜'}\n`;
            text += `     人均：${rest.avgPrice || 50}元\n`;
            text += `     招牌：${rest.specialty || '特色菜品'}\n`;
            text += `     地址：${rest.address || '长沙市'}\n\n`;
          });
        }

        if (day.hotels?.length > 0) {
          text += '🏨 住宿推荐\n';
          day.hotels.forEach((hotel, idx) => {
            text += `  ${idx + 1}. ${hotel.name}\n`;
            text += `     星级：${hotel.starRating || 3}星级\n`;
            text += `     价格：${hotel.pricePerNight || 200}元/晚\n`;
            text += `     地址：${hotel.address || '长沙市'}\n\n`;
          });
        }

        if (day.dailyCost) {
          text += '💰 费用预估\n';
          text += `  景点门票：${day.dailyCost.attractions || 0}元\n`;
          text += `  餐饮美食：${day.dailyCost.restaurants || day.dailyCost.food || 0}元\n`;
          text += `  住宿费用：${day.dailyCost.hotels || day.dailyCost.accommodation || 0}元\n`;
          text += `  交通费用：${day.dailyCost.transportation || 0}元\n`;
          text += `  ─────────────────\n`;
          text += `  当日总计：${day.dailyCost.total || 0}元\n\n`;
        }
      });
    }

    text += '═══════════════════════════════════════════\n';
    text += '        祝您旅途愉快！长沙欢迎您！\n';
    text += '═══════════════════════════════════════════\n';

    return text;
  }

  /**
   * 导出为Markdown格式
   */
  exportToMarkdown(tripData) {
    const { requirements, itinerary } = tripData;
    let md = '# 🏞️ 长沙旅游行程规划\n\n';
    
    if (requirements) {
      md += '## 📋 行程需求\n\n';
      md += `| 项目 | 内容 |\n`;
      md += `|------|------|\n`;
      md += `| 出行天数 | ${requirements.days || '未设置'}天 |\n`;
      md += `| 出行人群 | ${requirements.crowd || '未设置'} |\n`;
      md += `| 预算范围 | ${requirements.budget || '未设置'}元 |\n`;
      if (requirements.interests?.length) {
        md += `| 兴趣偏好 | ${requirements.interests.join('、')} |\n`;
      }
      if (requirements.foodPreferences?.length) {
        md += `| 美食偏好 | ${requirements.foodPreferences.join('、')} |\n`;
      }
      md += '\n';
    }

    if (itinerary && itinerary.length > 0) {
      md += '---\n\n';
      itinerary.forEach(day => {
        md += `## 📅 第${day.day}天：${day.title || '长沙游览'}\n\n`;
        md += `> 日期：${day.date || '待定'}\n\n`;
        
        if (day.attractions?.length > 0) {
          md += '### 📍 景点安排\n\n';
          day.attractions.forEach((attr, idx) => {
            md += `#### ${idx + 1}. ${attr.name}\n\n`;
            md += `- **类型**：${attr.type || '景点'}\n`;
            md += `- **门票**：${attr.ticketPrice > 0 ? attr.ticketPrice + '元' : '免费'}\n`;
            md += `- **时长**：约${attr.estimatedDuration || 2}小时\n`;
            md += `- **地址**：${attr.address || '长沙市'}\n`;
            md += `- **最佳时间**：${attr.bestTime || '全天'}\n\n`;
          });
        }

        if (day.restaurants?.length > 0) {
          md += '### 🍽️ 美食推荐\n\n';
          day.restaurants.forEach((rest, idx) => {
            md += `${idx + 1}. **${rest.name}**\n`;
            md += `   - 菜系：${rest.cuisine || '湘菜'}\n`;
            md += `   - 人均：${rest.avgPrice || 50}元\n`;
            md += `   - 招牌：${rest.specialty || '特色菜品'}\n\n`;
          });
        }

        if (day.hotels?.length > 0) {
          md += '### 🏨 住宿推荐\n\n';
          day.hotels.forEach((hotel, idx) => {
            md += `${idx + 1}. **${hotel.name}**\n`;
            md += `   - 星级：${hotel.starRating || 3}星级\n`;
            md += `   - 价格：${hotel.pricePerNight || 200}元/晚\n\n`;
          });
        }

        if (day.dailyCost) {
          md += '### 💰 费用预估\n\n';
          md += `| 项目 | 金额 |\n`;
          md += `|------|------|\n`;
          md += `| 景点门票 | ${day.dailyCost.attractions || 0}元 |\n`;
          md += `| 餐饮美食 | ${day.dailyCost.restaurants || day.dailyCost.food || 0}元 |\n`;
          md += `| 住宿费用 | ${day.dailyCost.hotels || day.dailyCost.accommodation || 0}元 |\n`;
          md += `| 交通费用 | ${day.dailyCost.transportation || 0}元 |\n`;
          md += `| **总计** | **${day.dailyCost.total || 0}元** |\n\n`;
        }

        md += '---\n\n';
      });
    }

    md += '---\n\n';
    md += '*祝您旅途愉快！长沙欢迎您！*\n';

    return md;
  }

  /**
   * 导出为HTML格式（可用于打印）
   */
  exportToHTML(tripData) {
    const { requirements, itinerary } = tripData;
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>长沙旅游行程规划</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; color: #1a73e8; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #1a73e8; }
    h2 { color: #1a73e8; margin: 20px 0 15px; padding-left: 10px; border-left: 4px solid #1a73e8; }
    h3 { color: #333; margin: 15px 0 10px; }
    .requirements { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .requirements table { width: 100%; border-collapse: collapse; }
    .requirements td { padding: 8px; border-bottom: 1px solid #e0e0e0; }
    .requirements td:first-child { width: 100px; color: #666; }
    .day-section { margin-bottom: 30px; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .day-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .day-title { font-size: 18px; font-weight: bold; color: #1a73e8; }
    .day-date { color: #666; font-size: 14px; }
    .attraction-card, .restaurant-card, .hotel-card { background: #f9f9f9; padding: 12px; margin: 10px 0; border-radius: 6px; border-left: 3px solid #4caf50; }
    .restaurant-card { border-left-color: #ff9800; }
    .hotel-card { border-left-color: #2196f3; }
    .card-title { font-weight: bold; margin-bottom: 5px; }
    .card-meta { font-size: 13px; color: #666; }
    .cost-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .cost-table td { padding: 8px; border-bottom: 1px solid #e0e0e0; }
    .cost-table .total { font-weight: bold; background: #f0f0f0; }
    .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; border-top: 1px solid #e0e0e0; }
    @media print { body { max-width: none; } .day-section { break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>🏞️ 长沙旅游行程规划</h1>
`;

    if (requirements) {
      html += `
  <div class="requirements">
    <h3>📋 行程需求</h3>
    <table>
      <tr><td>出行天数</td><td>${requirements.days || '未设置'}天</td></tr>
      <tr><td>出行人群</td><td>${requirements.crowd || '未设置'}</td></tr>
      <tr><td>预算范围</td><td>${requirements.budget || '未设置'}元</td></tr>
      ${requirements.interests?.length ? `<tr><td>兴趣偏好</td><td>${requirements.interests.join('、')}</td></tr>` : ''}
      ${requirements.foodPreferences?.length ? `<tr><td>美食偏好</td><td>${requirements.foodPreferences.join('、')}</td></tr>` : ''}
    </table>
  </div>
`;
    }

    if (itinerary && itinerary.length > 0) {
      itinerary.forEach(day => {
        html += `
  <div class="day-section">
    <div class="day-header">
      <span class="day-title">第${day.day}天：${day.title || '长沙游览'}</span>
      <span class="day-date">${day.date || '待定'}</span>
    </div>
`;
        
        if (day.attractions?.length > 0) {
          html += `    <h3>📍 景点安排</h3>\n`;
          day.attractions.forEach(attr => {
            html += `    <div class="attraction-card">
      <div class="card-title">${attr.name}</div>
      <div class="card-meta">
        类型：${attr.type || '景点'} | 
        门票：${attr.ticketPrice > 0 ? attr.ticketPrice + '元' : '免费'} | 
        时长：约${attr.estimatedDuration || 2}小时 |
        最佳时间：${attr.bestTime || '全天'}
      </div>
      <div class="card-meta">地址：${attr.address || '长沙市'}</div>
    </div>\n`;
          });
        }

        if (day.restaurants?.length > 0) {
          html += `    <h3>🍽️ 美食推荐</h3>\n`;
          day.restaurants.forEach(rest => {
            html += `    <div class="restaurant-card">
      <div class="card-title">${rest.name}</div>
      <div class="card-meta">
        菜系：${rest.cuisine || '湘菜'} | 
        人均：${rest.avgPrice || 50}元 | 
        招牌：${rest.specialty || '特色菜品'}
      </div>
    </div>\n`;
          });
        }

        if (day.hotels?.length > 0) {
          html += `    <h3>🏨 住宿推荐</h3>\n`;
          day.hotels.forEach(hotel => {
            html += `    <div class="hotel-card">
      <div class="card-title">${hotel.name}</div>
      <div class="card-meta">
        星级：${hotel.starRating || 3}星级 | 
        价格：${hotel.pricePerNight || 200}元/晚
      </div>
      <div class="card-meta">地址：${hotel.address || '长沙市'}</div>
    </div>\n`;
          });
        }

        if (day.dailyCost) {
          html += `
    <h3>💰 费用预估</h3>
    <table class="cost-table">
      <tr><td>景点门票</td><td>${day.dailyCost.attractions || 0}元</td></tr>
      <tr><td>餐饮美食</td><td>${day.dailyCost.restaurants || day.dailyCost.food || 0}元</td></tr>
      <tr><td>住宿费用</td><td>${day.dailyCost.hotels || day.dailyCost.accommodation || 0}元</td></tr>
      <tr><td>交通费用</td><td>${day.dailyCost.transportation || 0}元</td></tr>
      <tr class="total"><td>当日总计</td><td>${day.dailyCost.total || 0}元</td></tr>
    </table>
`;
        }

        html += `  </div>\n`;
      });
    }

    html += `
  <div class="footer">
    <p>祝您旅途愉快！长沙欢迎您！</p>
    <p style="font-size: 12px; margin-top: 10px;">生成时间：${new Date().toLocaleString('zh-CN')}</p>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * 下载文件
   */
  getExportData(tripData, format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return {
          content: this.exportToJSON(tripData),
          mimeType: 'application/json',
          extension: 'json'
        };
      case 'txt':
      case 'text':
        return {
          content: this.exportToText(tripData),
          mimeType: 'text/plain',
          extension: 'txt'
        };
      case 'md':
      case 'markdown':
        return {
          content: this.exportToMarkdown(tripData),
          mimeType: 'text/markdown',
          extension: 'md'
        };
      case 'html':
        return {
          content: this.exportToHTML(tripData),
          mimeType: 'text/html',
          extension: 'html'
        };
      default:
        return {
          content: this.exportToJSON(tripData),
          mimeType: 'application/json',
          extension: 'json'
        };
    }
  }
}

module.exports = new ExportService();

const nodemailer = require('nodemailer');
const logger = require('../logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.qq.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

transporter.verify((error, success) => {
  if (error) {
    logger.error(`SMTP连接失败: ${error.message}`);
  } else {
    logger.info('SMTP服务器连接成功');
  }
});

const verificationCodes = new Map();

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendVerificationCode = async (email) => {
  try {
    const code = generateCode();
    verificationCodes.set(email, {
      code,
      createdAt: Date.now(),
      attempts: 0
    });

    const mailOptions = {
      from: `"长沙旅游规划" <${process.env.SMTP_USER}>`,
      to: email,
      subject: '【长沙旅游规划】邮箱验证码',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <div style="background:  #9dddd8ff; padding: 30px; border-radius: 10px; text-align: center;">
            <h2 style="color: #fff; margin: 0 0 20px 0;">欢迎使用长沙旅游规划系统</h2>
            <p style="color: #fff; margin: 0 0 30px 0; font-size: 16px;">您的验证码是：</p>
            <div style="background: #fff; color: #9dddd8ff; font-size: 32px; font-weight: bold; padding: 20px; border-radius: 5px; margin: 0 0 20px 0; letter-spacing: 5px;">
              ${code}
            </div>
            <p style="color: #fff; margin: 0 0 10px 0; font-size: 14px;">验证码有效期为 5 分钟</p>
            <p style="color: #fff; margin: 0; font-size: 12px; opacity: 0.8;">如果这不是您的操作，请忽略此邮件</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info(`验证码已发送至: ${email}`);
    
    return { success: true, message: '验证码已发送' };
  } catch (error) {
    logger.error(`发送邮件失败: ${error.message}`);
    return { success: false, message: '发送验证码失败，请重试' };
  }
};

const verifyCode = (email, code) => {
  const record = verificationCodes.get(email);
  
  if (!record) {
    return { valid: false, message: '验证码不存在或已过期' };
  }

  const now = Date.now();
  const expired = now - record.createdAt > 5 * 60 * 1000;
  
  if (expired) {
    verificationCodes.delete(email);
    return { valid: false, message: '验证码已过期' };
  }

  if (record.code !== code) {
    record.attempts++;
    if (record.attempts >= 5) {
      verificationCodes.delete(email);
    }
    return { valid: false, message: '验证码错误' };
  }

  verificationCodes.delete(email);
  return { valid: true, message: '验证成功' };
};

const cleanupExpiredCodes = () => {
  const now = Date.now();
  for (const [email, record] of verificationCodes.entries()) {
    if (now - record.createdAt > 5 * 60 * 1000) {
      verificationCodes.delete(email);
    }
  }
  logger.info(`清理过期验证码: ${verificationCodes.size} 条记录保留`);
};

setInterval(cleanupExpiredCodes, 5 * 60 * 1000);

module.exports = {
  sendVerificationCode,
  verifyCode
};

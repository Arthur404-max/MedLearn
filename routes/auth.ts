import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../src/config/db';
import { monitoredQuery } from '../src/database/optimization';
import { logger, logAuthEvent } from '../src/config/logger';
import { checkBanOnLogin, updateLastLogin } from '../middleware/checkBan';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    // Валидация имени и фамилии (только английские буквы)
    const nameRegex = /^[A-Za-z]+$/;
    if (firstName && !nameRegex.test(firstName)) {
      return res.status(400).json({ message: 'Имя должно содержать только английские буквы' });
    }
    if (lastName && !nameRegex.test(lastName)) {
      return res.status(400).json({ message: 'Фамилия должна содержать только английские буквы' });
    }
    
    // Валидация пароля (английские буквы и спецсимволы, минимум 6 символов)
    const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Пароль должен содержать минимум 6 символов' });
    }
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ message: 'Пароль должен содержать только английские буквы, цифры и спецсимволы' });
    }
    
    const userCheck = await monitoredQuery(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userCheck.rows.length > 0) {
      logAuthEvent('registration_attempt_duplicate', undefined, email, req.ip, false);
      return res.status(400).json({ message: 'Пользователь уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET!, { expiresIn: '24h' });

    const result = await monitoredQuery(
      'INSERT INTO users (email, password_hash, verification_token, is_verified, first_name, last_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email',
      [email, hashedPassword, verificationToken, false, firstName || '', lastName || '']
    );
    
    const userId = result.rows[0].id;
    logAuthEvent('user_registered', userId, email, req.ip, true);

    // В реальном приложении здесь бы отправлялось письмо с подтверждением
    console.log(`Verification link: http://localhost:3000/verify-email?token=${verificationToken}`);

    res.status(201).json({ 
      message: 'Пользователь создан. Проверьте email для подтверждения регистрации.',
      verificationRequired: true 
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Сначала проверяем бан пользователя
    const banInfo = await checkBanOnLogin(email);
    if (banInfo && banInfo.is_banned) {
      const banResponse: any = {
        error: 'USER_BANNED',
        message: 'Пользователь заблокирован',
        ban_reason: banInfo.ban_reason
      };
      
      if (banInfo.banned_at) {
        banResponse.banned_at = banInfo.banned_at;
      }
      
      if (banInfo.is_permanent) {
        banResponse.is_permanent = true;
      } else if (banInfo.banned_until) {
        banResponse.banned_until = banInfo.banned_until;
        banResponse.time_left = Math.max(0, banInfo.banned_until.getTime() - new Date().getTime());
      }
      
      return res.status(403).json(banResponse);
    }
    
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_deleted = false',
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    // Проверяем верификацию email (поддерживаем оба поля для совместимости)
    const isEmailVerified = user.is_verified || user.email_verified;
    if (!isEmailVerified) {
      return res.status(401).json({ 
        message: 'Пожалуйста, подтвердите email перед входом в систему',
        emailNotVerified: true 
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    // Обновляем время последнего входа
    await updateLastLogin(user.id);

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful for user:', user.email);
    console.log('🎟️ Generated token for user ID:', user.id);
    console.log('🔑 JWT_SECRET length:', process.env.JWT_SECRET?.length);

    res.json({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Токен подтверждения не найден' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { email: string };

    const result = await pool.query(
      'UPDATE users SET is_verified = true, verification_token = null WHERE email = $1 AND verification_token = $2 RETURNING id',
      [decoded.email, token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Недействительный токен подтверждения' });
    }

    res.json({ message: 'Email успешно подтвержден' });
  } catch (error) {
    console.error('Ошибка подтверждения email:', error);
    res.status(400).json({ message: 'Недействительный или истекший токен' });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (user.rows[0].is_verified) {
      return res.status(400).json({ message: 'Email уже подтвержден' });
    }

    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET!, { expiresIn: '24h' });

    await pool.query(
      'UPDATE users SET verification_token = $1 WHERE email = $2',
      [verificationToken, email]
    );

    // В реальном приложении здесь бы отправлялось письмо
    console.log(`New verification link: http://localhost:3000/verify-email?token=${verificationToken}`);

    res.json({ message: 'Письмо с подтверждением отправлено повторно' });
  } catch (error) {
    console.error('Ошибка отправки подтверждения:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Проверка статуса пользователя (включая проверку на бан)
router.get('/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'NO_TOKEN', message: 'Токен не предоставлен' });
    }
    
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Недействительный токен' });
    }
    
    // Получаем информацию о пользователе
    const result = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, 
             u.is_banned, u.ban_reason, u.banned_at, u.banned_until, u.is_deleted,
             ub.is_permanent
      FROM users u
      LEFT JOIN user_bans ub ON u.id = ub.user_id AND ub.is_active = true
      WHERE u.id = $1
    `, [decoded.userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Пользователь не найден' });
    }
    
    const user = result.rows[0];
    
    // Проверяем удален ли пользователь
    if (user.is_deleted) {
      return res.status(403).json({ 
        error: 'USER_DELETED', 
        message: 'Аккаунт удален' 
      });
    }
    
    // Проверяем заблокирован ли пользователь
    if (user.is_banned) {
      // Проверяем не истек ли временный бан
      if (user.banned_until && new Date(user.banned_until) <= new Date()) {
        // Автоматически разблокируем
        await pool.query(`
          UPDATE users 
          SET is_banned = false, ban_reason = null, banned_at = null,
              banned_until = null, banned_by = null
          WHERE id = $1
        `, [user.id]);
        
        await pool.query(`
          UPDATE user_bans 
          SET is_active = false, unbanned_at = CURRENT_TIMESTAMP,
              unban_reason = 'Автоматическая разблокировка по истечении срока'
          WHERE user_id = $1 AND is_active = true
        `, [user.id]);
        
        // Реактивируем подписки
        await pool.query(`
          UPDATE subscriptions 
          SET is_active = true 
          WHERE user_id = $1 AND end_date > CURRENT_TIMESTAMP
        `, [user.id]);
        
        // Пользователь разблокирован, возвращаем OK
        return res.json({
          status: 'active',
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role
          },
          message: 'Бан автоматически снят'
        });
      }
      
      // Пользователь все еще заблокирован
      const banResponse: any = {
        error: 'USER_BANNED',
        message: 'Пользователь заблокирован',
        ban_reason: user.ban_reason,
        banned_at: user.banned_at
      };
      
      if (user.is_permanent) {
        banResponse.is_permanent = true;
      } else if (user.banned_until) {
        banResponse.banned_until = user.banned_until;
        banResponse.time_left = Math.max(0, new Date(user.banned_until).getTime() - new Date().getTime());
      }
      
      return res.status(403).json(banResponse);
    }
    
    // Пользователь активен
    res.json({
      status: 'active',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Error checking user status:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Ошибка сервера' });
  }
});

export default router;

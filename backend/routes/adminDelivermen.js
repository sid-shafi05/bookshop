const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateRawToken, hashToken, getInviteExpiryDate } = require('../utils/inviteToken');

module.exports = function adminDeliverymenRouter(db) {
  const router = express.Router();

  // POST /admin/deliverymen
  router.post('/deliverymen', requireAuth, requireRole('admin'), async (req, res) => {
    const { full_name, phone, email, zone, vehicle_type } = req.body;

    if (!full_name) return res.status(400).json({ message: 'full_name is required' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const userInsert = await client.query(
        `INSERT INTO users (full_name, phone, email, role, status)
         VALUES ($1, $2, $3, 'deliveryman', 'invited')
         RETURNING id, full_name, phone, email, role, status`,
        [full_name, phone || null, email || null]
      );

      const user = userInsert.rows[0];

      await client.query(
        `INSERT INTO delivery_profiles (user_id, zone, vehicle_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
         SET zone = EXCLUDED.zone, vehicle_type = EXCLUDED.vehicle_type, updated_at = NOW()`,
        [user.id, zone || null, vehicle_type || null]
      );

      const rawToken = generateRawToken();
      const tokenHash = hashToken(rawToken);
      const expiry = getInviteExpiryDate(Number(process.env.INVITE_EXPIRES_HOURS || 48));

      await client.query(
        `INSERT INTO user_invites (user_id, token_hash, expires_at, created_by)
         VALUES ($1, $2, $3, $4)`,
        [user.id, tokenHash, expiry, req.user.id]
      );

      await client.query('COMMIT');

      const inviteLink = `${process.env.APP_BASE_URL}/activate-delivery?token=${rawToken}`;

      return res.status(201).json({
        message: 'Deliveryman invited',
        user,
        invite_link: inviteLink
      });
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(500).json({ message: 'Failed to create deliveryman', error: err.message });
    } finally {
      client.release();
    }
  });

  // POST /admin/deliverymen/:id/resend-invite
  router.post('/deliverymen/:id/resend-invite', requireAuth, requireRole('admin'), async (req, res) => {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: 'Invalid id' });

    const userResult = await db.query(`SELECT id, role, status FROM users WHERE id = $1`, [userId]);
    const user = userResult.rows[0];
    if (!user || user.role !== 'deliveryman') {
      return res.status(404).json({ message: 'Deliveryman not found' });
    }

    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const expiry = getInviteExpiryDate(Number(process.env.INVITE_EXPIRES_HOURS || 48));

    await db.query(
      `INSERT INTO user_invites (user_id, token_hash, expires_at, created_by)
       VALUES ($1, $2, $3, $4)`,
      [userId, tokenHash, expiry, req.user.id]
    );

    const inviteLink = `${process.env.APP_BASE_URL}/activate-delivery?token=${rawToken}`;
    return res.json({ message: 'Invite resent', invite_link: inviteLink });
  });

  return router;
};
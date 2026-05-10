module.exports = ({ db, isSQLite, query }) => {
  const MAX_REGISTRATION_OTP_PER_DAY = 3;

  const tiers = [
    {
      name: "Starter",
      price: "Free",
      slug: "starter",
      maxUnits: 10,
      tagline: "For landlords with up to 10 units",
    },
    {
      name: "Growth",
      price: "KSh 2,500",
      slug: "growth",
      maxUnits: 100,
      tagline: "For growing portfolios 11–100 units",
    },
    {
      name: "Scale",
      price: "Custom",
      slug: "scale",
      maxUnits: Infinity,
      tagline: "For agencies & 100+ units",
    },
  ];

  const getTierByUnitCount = (units) => {
    if (typeof units !== 'number' || Number.isNaN(units)) {
      return tiers[0];
    }
    if (units <= 10) return tiers[0];
    if (units <= 100) return tiers[1];
    return tiers[2];
  };

  const getTierByName = (name) => tiers.find((tier) => tier.name.toLowerCase() === String(name).toLowerCase()) || null;

  const startOfToday = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    now.setMilliseconds(0);
    return now.toISOString();
  };

  const countOtpRequestsSince = async (phone, purpose, since) => {
    if (!phone || !purpose) return 0;
    if (isSQLite) {
      const row = db.prepare(`
        SELECT COUNT(*) as count
        FROM otp_request_logs
        WHERE phone = ? AND purpose = ? AND created_at >= ?
      `).get(phone, purpose, since);
      return Number(row?.count || 0);
    }

    const result = await query(
      `SELECT COUNT(*) as count FROM otp_request_logs WHERE phone = $1 AND purpose = $2 AND created_at >= $3`,
      [phone, purpose, since]
    );
    return Number(result.rows?.[0]?.count || 0);
  };

  const canSendRegistrationOtp = async (phone) => {
    const since = startOfToday();
    const count = await countOtpRequestsSince(phone, 'registration', since);
    return count < MAX_REGISTRATION_OTP_PER_DAY;
  };

  const recordOtpRequest = async ({ id, phone, purpose, success = true, createdAt = new Date().toISOString() }) => {
    if (!phone || !purpose) return;
    const recordId = id || `otpreq_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    if (isSQLite) {
      db.prepare(`
        INSERT INTO otp_request_logs (id, phone, purpose, success, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(recordId, phone, purpose, success ? 1 : 0, createdAt);
      return;
    }

    await query(
      `INSERT INTO otp_request_logs (id, phone, purpose, success, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [recordId, phone, purpose, success, createdAt]
    );
  };

  return {
    MAX_REGISTRATION_OTP_PER_DAY,
    tiers,
    getTierByUnitCount,
    getTierByName,
    canSendRegistrationOtp,
    recordOtpRequest,
  };
};
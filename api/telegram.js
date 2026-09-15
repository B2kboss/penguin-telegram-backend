const express = require("express");

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function telegram(method, payload = {}) {
  if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(
      data.description || `Telegram API error: ${response.status}`
    );
  }

  return data.result;
}

function parseTelegramTarget(url) {
  const value = String(url || "").trim();

  if (!value) {
    throw new Error("Telegram URL is required");
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid Telegram URL");
  }

  if (
    parsed.hostname !== "t.me" &&
    parsed.hostname !== "telegram.me"
  ) {
    throw new Error("Only Telegram links are supported");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);

  if (!parts.length) {
    throw new Error("Telegram target is missing");
  }

  if (parts[0] === "c") {
    if (parts.length < 3) {
      throw new Error("Invalid private Telegram message link");
    }

    return {
      chatId: `-100${parts[1]}`,
      messageId: Number(parts[2]),
      type: "message"
    };
  }

  return {
    chatId: `@${parts[0]}`,
    messageId: parts[1] ? Number(parts[1]) : null,
    type: parts[1] ? "message" : "chat"
  };
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "Penguin Telegram Verification API"
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    telegramTokenConfigured: Boolean(BOT_TOKEN)
  });
});

app.post("/api/telegram/join", async (req, res) => {
  try {
    const { chatId, userId } = req.body || {};

    if (!chatId || !userId) {
      return res.status(400).json({
        ok: false,
        error: "chatId and userId are required"
      });
    }

    const member = await telegram("getChatMember", {
      chat_id: chatId,
      user_id: Number(userId)
    });

    const status = String(member.status || "");

    const verified = [
      "creator",
      "administrator",
      "member"
    ].includes(status);

    return res.json({
      ok: true,
      verified,
      status
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/api/telegram/target", async (req, res) => {
  try {
    const target = parseTelegramTarget(req.body?.url);

    return res.json({
      ok: true,
      target
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

module.exports = app;

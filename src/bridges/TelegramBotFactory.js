// src/bridges/TelegramBotFactory.js
// Non-invasive factory: decides between grammY (GrammyBridge) and node-telegram-bot-api
// Reads environment configuration via ConfigManager to decide

const path = require('path');
const ConfigManager = require('../config');

let _engine = null;

function detectEngine() {
  if (_engine) return _engine;

  // Check env override from ConfigManager
  if (ConfigManager.CONFIG.TG_ENGINE === 'legacy') {
    _engine = 'legacy';
    console.log('[TG Factory] Engine: node-telegram-bot-api (legacy, from ConfigManager)');
    return _engine;
  }

  // Default to grammY or if configured
  try {
    require('grammy');
    _engine = 'grammy';
    console.log('[TG Factory] Engine: grammY (modern)');
  } catch {
    _engine = 'legacy';
    console.log('[TG Factory] Engine: node-telegram-bot-api (grammy not installed)');
  }

  return _engine;
}

/**
 * Create a Telegram bot instance — same API surface regardless of engine
 * @param {string} token
 * @param {object} opts - { polling: false, ... }
 * @returns {object} Bot instance with node-telegram-bot-api compatible API
 */
function createTelegramBot(token, opts = {}) {
  const engine = detectEngine();

  if (engine === 'grammy') {
    const GrammyBridge = require('./GrammyBridge');
    return new GrammyBridge(token, opts);
  }

  // Fallback: original node-telegram-bot-api
  const TelegramBot = require('node-telegram-bot-api');
  return new TelegramBot(token, opts);
}

module.exports = { createTelegramBot, detectEngine };

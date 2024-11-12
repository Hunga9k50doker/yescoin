require("dotenv").config();
const { _isArray } = require("../utils.js");

const settings = {
  TIME_SLEEP: process.env.TIME_SLEEP ? parseInt(process.env.TIME_SLEEP) : 8,
  MAX_THEADS: process.env.MAX_THEADS ? parseInt(process.env.MAX_THEADS) : 10,
  MAX_LEVEL_UPGRADE: process.env.MAX_LEVEL_UPGRADE ? parseInt(process.env.MAX_LEVEL_UPGRADE) : 10,
  SKIP_TASKS: process.env.SKIP_TASKS ? JSON.parse(process.env.SKIP_TASKS.replace(/'/g, '"')) : [],
  AUTO_TASK: process.env.AUTO_TASK ? process.env.AUTO_TASK.toLowerCase() === "true" : false,
  AUTO_JOIN_SQUARD: process.env.AUTO_JOIN_SQUARD ? process.env.AUTO_JOIN_SQUARD.toLowerCase() === "true" : false,
  AUTO_DAILY_REWARD: process.env.AUTO_DAILY_REWARD ? process.env.AUTO_DAILY_REWARD.toLowerCase() === "true" : false,
  AUTO_UPGRADE_MULTI: process.env.AUTO_UPGRADE_MULTI ? process.env.AUTO_UPGRADE_MULTI.toLowerCase() === "true" : false,
  AUTO_UPGRADE_COINLIMIT: process.env.AUTO_UPGRADE_COINLIMIT ? process.env.AUTO_UPGRADE_COINLIMIT.toLowerCase() === "true" : false,
  AUTO_UPGRADE_FILL: process.env.AUTO_UPGRADE_FILL ? process.env.AUTO_UPGRADE_FILL.toLowerCase() === "true" : false,
  CONNECT_WALLET: process.env.CONNECT_WALLET ? process.env.CONNECT_WALLET.toLowerCase() === "true" : false,
  DELAY_BETWEEN_REQUESTS: process.env.DELAY_BETWEEN_REQUESTS && _isArray(process.env.DELAY_BETWEEN_REQUESTS) ? JSON.parse(process.env.DELAY_BETWEEN_REQUESTS) : [1, 5],
  DELAY_START_BOT: process.env.DELAY_START_BOT && _isArray(process.env.DELAY_START_BOT) ? JSON.parse(process.env.DELAY_START_BOT) : [1, 15],
};

module.exports = settings;

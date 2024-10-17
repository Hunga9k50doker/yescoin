const fs = require("fs");
const axios = require("axios");
const colors = require("colors");
const readline = require("readline");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const crypto = require("crypto");

class YesCoinBot {
  constructor(accountIndex, account, proxy) {
    this.accountIndex = accountIndex;
    this.account = account;
    this.proxy = proxy;
    this.proxyIP = "Unknown";
    this.token = null;
    this.timeout = 30000;
    this.wallet = null;
    this.config = loadConfig();
  }

  async log(msg, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const accountPrefix = `[Tài khoản ${this.accountIndex + 1}]`;
    const ipPrefix = this.proxyIP ? `[${this.proxyIP}]` : "[Unknown IP]";
    let logMessage = "";

    switch (type) {
      case "success":
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.green;
        break;
      case "error":
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.red;
        break;
      case "warning":
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.yellow;
        break;
      default:
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.blue;
    }

    console.log(logMessage);
    await this.randomDelay();
  }

  headers(token) {
    return {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      "content-type": "application/json",
      origin: "https://www.yescoin.gold",
      pragma: "no-cache",
      priority: "u=1, i",
      referer: "https://www.yescoin.gold/",
      "sec-ch-ua": '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24", "Microsoft Edge WebView2";v="125"',
      "sec-Ch-Ua-Mobile": "?1",
      "sec-Ch-Ua-Platform": '"Android"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      token: token,
      "user-agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
    };
  }

  formatLoginPayload(encodedData) {
    const decodedData = decodeURIComponent(encodedData);
    return { code: decodedData };
  }

  async login(encodedData, proxy) {
    const url = "https://api-backend.yescoin.gold/user/login";
    const formattedPayload = this.formatLoginPayload(encodedData);
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json",
      origin: "https://www.yescoin.gold",
      referer: "https://www.yescoin.gold/",
      "sec-ch-ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Microsoft Edge";v="128", "Microsoft Edge WebView2";v="128"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
    };

    try {
      const proxyAgent = new HttpsProxyAgent(proxy);
      const response = await axios.post(url, formattedPayload, {
        headers,
        httpsAgent: proxyAgent,
      });
      if (response.data.code === 0) {
        const token = response.data.data.token;
        return token;
      } else {
        throw new Error(`Đăng nhập thất bại: ${response.data.message}`);
      }
    } catch (error) {
      throw new Error(`Đăng nhập thất bại: ${error.message}`);
    }
  }

  async saveToken(accountIndex, token) {
    let tokens = {};
    if (fs.existsSync("token.json")) {
      tokens = JSON.parse(fs.readFileSync("token.json", "utf-8"));
    }
    tokens[accountIndex] = token;
    fs.writeFileSync("token.json", JSON.stringify(tokens, null, 2));
  }

  loadToken(accountIndex) {
    if (fs.existsSync("token.json")) {
      const tokens = JSON.parse(fs.readFileSync("token.json", "utf-8"));
      return tokens[accountIndex];
    }
    return null;
  }

  async getOrRefreshToken(encodedData, proxy) {
    const savedToken = this.loadToken(this.accountIndex);
    if (savedToken) {
      this.token = savedToken;
      return this.token;
    }

    this.token = await this.login(encodedData, proxy);
    await this.saveToken(this.accountIndex, this.token);
    return this.token;
  }

  async checkProxyIP(proxy) {
    try {
      const proxyAgent = new HttpsProxyAgent(proxy);
      const response = await axios.get("https://api.ipify.org?format=json", {
        httpsAgent: proxyAgent,
      });
      if (response.status === 200) {
        return response.data.ip;
      } else {
        throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
    }
  }

  async makeRequest(method, url, data = null, token, proxy, extraHeaders = {}) {
    const defaultHeaders = this.headers(token);
    const headers = {
      ...defaultHeaders,
      ...extraHeaders,
    };
    const proxyAgent = new HttpsProxyAgent(proxy);
    const config = {
      method,
      url,
      headers,
      httpsAgent: proxyAgent,
      timeout: this.timeout,
    };
    if (data) {
      config.data = data;
    }
    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        throw new Error(`Yêu cầu hết thời gian sau ${this.timeout}ms`);
      }
      throw new Error(`Yêu cầu không thành công: ${error.message}`);
    }
  }

  async randomDelay() {
    const delay = Math.floor(Math.random() * 1000) + 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async collectCoin(token, amount, proxy) {
    const url = "https://api-backend.yescoin.gold/game/collectCoin";
    try {
      const response = await this.makeRequest("post", url, amount, token, proxy);
      if (response.code === 0) {
        return response;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getAccountInfo(token, proxy) {
    try {
      const url = "https://api-backend.yescoin.gold/account/getAccountInfo";
      const response = await this.makeRequest("get", url, null, token, proxy);
      if (response.code === 0) {
        // console.log(response);
        return response;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getGameInfo(token, proxy) {
    try {
      const url = "https://api-backend.yescoin.gold/game/getGameInfo";
      const response = await this.makeRequest("get", url, null, token, proxy);
      if (response.code === 0) {
        return response;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async useSpecialBox(token, proxy) {
    const url = "https://api-backend.yescoin.gold/game/recoverSpecialBox";
    try {
      const response = await this.makeRequest("post", url, {}, token, proxy);
      if (response.code === 0) {
        await this.log("Kích hoạt rương...", "success");
        return true;
      } else {
        await this.log("Kích hoạt rương thất bại!", "error");
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  async getSpecialBoxInfo(token, proxy) {
    try {
      const url = "https://api-backend.yescoin.gold/game/getSpecialBoxInfo";
      const response = await this.makeRequest("get", url, null, token, proxy);
      if (response.code === 0) {
        return response;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getuser(token, proxy) {
    try {
      const url = "https://api-backend.yescoin.gold/account/getRankingList?index=1&pageSize=1&rankType=1&userLevel=1";
      const response = await this.makeRequest("get", url, null, token, proxy);
      if (response.data.myUserNick) {
        return response.data.myUserNick;
      }
      return "no nickname";
    } catch (error) {
      return "no nickname";
    }
  }

  async collectFromSpecialBox(token, boxType, coinCount, proxy) {
    const url = "https://api-backend.yescoin.gold/game/collectSpecialBoxCoin";
    const data = { boxType, coinCount };
    try {
      const response = await this.makeRequest("post", url, data, token, proxy);
      if (response.code === 0) {
        if (response.data.collectStatus) {
          await this.log(`Mở rương nhận được ${response.data.collectAmount} Coins`, "success");
          return {
            success: true,
            collectedAmount: response.data.collectAmount,
          };
        } else {
          return { success: true, collectedAmount: 0 };
        }
      } else {
        return { success: false, collectedAmount: 0 };
      }
    } catch (error) {
      return { success: false, collectedAmount: 0 };
    }
  }

  async attemptCollectSpecialBox(token, boxType, initialCoinCount, proxy) {
    let coinCount = initialCoinCount;
    while (coinCount > 0) {
      const result = await this.collectFromSpecialBox(token, boxType, coinCount, proxy);
      if (result.success) {
        return result.collectedAmount;
      }
      coinCount -= 20;
    }
    await this.log("Không thể thu thập rương!", "error");
    return 0;
  }

  async getAccountBuildInfo(token, proxy) {
    try {
      const url = "https://api-backend.yescoin.gold/build/getAccountBuildInfo";
      const response = await this.makeRequest("get", url, null, token, proxy);
      if (response.code === 0) {
        return response;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getSquadInfo(token, proxy) {
    const url = "https://api-backend.yescoin.gold/squad/mySquad";
    try {
      const response = await this.makeRequest("get", url, null, token, proxy);
      if (response.code === 0) {
        return response;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async joinSquad(token, squadLink, proxy) {
    const url = "https://api-backend.yescoin.gold/squad/joinSquad";
    const data = { squadTgLink: squadLink };
    try {
      const response = await this.makeRequest("post", url, data, token, proxy);
      if (response.code === 0) {
        return response;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async recoverCoinPool(token, proxy) {
    const url = "https://api-backend.yescoin.gold/game/recoverCoinPool";
    try {
      const response = await this.makeRequest("post", url, {}, token, proxy);
      if (response.code === 0) {
        await this.log("Recovery thành công!", "success");
        return true;
      } else {
        await this.log("Recovery thất bại!", "error");
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  async getUpgradeTaskList(token, proxy) {
    const url = "https://api-backend.yescoin.gold/task/getUserUpgradeTaskList";
    try {
      const response = await this.makeRequest("get", url, null, token, proxy);
      if (response.code === 0) {
        return response.data;
      } else {
        await this.log(`Không lấy được danh sách nhiệm vụ: ${response.message}`, "error");
        return null;
      }
    } catch (error) {
      await this.log("Error: " + error.message, "error");
      return null;
    }
  }

  async finishUpgradeTask(token, taskId, proxy) {
    const url = "https://api-backend.yescoin.gold/task/finishUserUpgradeTask";
    try {
      const response = await this.makeRequest("post", url, taskId, token, proxy);
      if (response.code === 0) {
        await this.log(`Làm nhiệm vụ ${taskId} thành công | Phần thưởng: ${response.data.bonusAmount}`, "success");
        return true;
      } else {
        await this.log(`Làm nhiệm vụ ${taskId} thất bại: ${response.message}`, "error");
        return false;
      }
    } catch (error) {
      await this.log(`Lỗi khi làm nhiệm vụ: ${error.message}`, "error");
      return false;
    }
  }

  async getTaskList(token, proxy) {
    const url = "https://api-backend.yescoin.gold/task/getCommonTaskList";
    try {
      const response = await this.makeRequest("get", url, null, token, proxy);
      if (response.code === 0) {
        return response.data;
      } else {
        await this.log(`Không lấy được danh sách nhiệm vụ: ${response.message}`, "error");
        return null;
      }
    } catch (error) {
      await this.log("Error: " + error.message, "error");
      return null;
    }
  }

  async finishTask(token, taskId, proxy) {
    const url = "https://api-backend.yescoin.gold/task/finishTask";
    try {
      const response = await this.makeRequest("post", url, taskId, token, proxy);
      if (response.code === 0) {
        await this.log(`Làm nhiệm vụ ${taskId} thành công | Phần thưởng: ${response.data.bonusAmount}`, "success");
        return true;
      } else {
        await this.log(`Làm nhiệm vụ ${taskId} thất bại: ${response.message}`, "error");
        return false;
      }
    } catch (error) {
      await this.log(`Lỗi khi làm nhiệm vụ: ${error.message}`, "error");
      return false;
    }
  }

  async processTasks(token, proxy) {
    const tasks = await this.getTaskList(token, proxy);
    const tasksUpgrade = await this.getUpgradeTaskList(token, proxy);
    // console.log("tasksUpgrade", tasksUpgrade);
    const listTaskBonusUpgrade = tasksUpgrade?.taskBonusBaseResponseList || [];
    const userLevel = tasksUpgrade?.userLevel || 0;
    if (tasks) {
      for (const task of tasks) {
        if (task.taskStatus === 0) {
          await this.finishTask(token, task.taskId, proxy);
        }
      }
    }
    if (listTaskBonusUpgrade) {
      for (const taskUpgrade of listTaskBonusUpgrade) {
        if (taskUpgrade.taskStatus === 0 && taskUpgrade.taskUserLevel < userLevel) {
          await this.finishUpgradeTask(token, taskUpgrade.taskId, proxy);
        }
      }
    }
  }

  async lSquad(token, proxy) {
    const url = "https://api-backend.yescoin.gold/squad/leaveSquad";
    try {
      const response = await this.makeRequest("post", url, null, token, proxy);
      if (response.code === 0) {
        return response;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getTaskListDaily(token, proxy) {
    const url = "https://api-backend.yescoin.gold/mission/getDailyMission";
    try {
      const response = await this.makeRequest("get", url, null, token, proxy);
      if (response.code === 0) {
        return response.data;
      } else {
        await this.log(`Không lấy được danh sách nhiệm vụ: ${response.message}`, "error");
        return null;
      }
    } catch (error) {
      await this.log("Error: " + error.message, "error");
      return null;
    }
  }

  async getListCheckIn(token, proxy) {
    const url = "https://api-backend.yescoin.gold/signIn/list";
    try {
      const response = await this.makeRequest("get", url, null, token, proxy);
      let today = null;
      if (response.code === 0 && response.data.length > 0) {
        const Indextommorow = response.data.findIndex((x) => x.openIn > 0 && x.reward == 0);
        if (Indextommorow > 0 && response.data[Indextommorow - 1].reward == 0) {
          today = response.data[Indextommorow - 1];
        } else if (Indextommorow == 0) {
          today = response.data[0];
        }
        if (today) {
          return today.id;
        }
        return null;
      } else {
        await this.log(`Không lấy được danh sách điểm danh: ${response.data.message}`, "error");
        return null;
      }
    } catch (error) {
      await this.log("Error getListCheckIn: " + error.message, "error");
      return null;
    }
  }

  async getWallet(token, proxy) {
    const url = "https://api-backend.yescoin.gold/wallet/getWallet";
    try {
      const response = await this.makeRequest("get", url, null, token, proxy);
      if (response.code === 0) {
        this.wallet = response.data[0]?.friendlyAddress;
        return response.data[0]?.friendlyAddress;
      } else {
        await this.log(`Không lấy được địa chỉ ví: ${response.data.message}`, "error");
        return null;
      }
    } catch (error) {
      await this.log("Error: " + error.message, "error");
      return null;
    }
  }

  async getDailyTaskBonus(token, proxy) {
    const url = "https://api-backend.yescoin.gold/task/getFinishTaskBonusInfo";
    try {
      const response = await this.makeRequest("get", url, null, token, proxy);

      if (response.code === 0 && response.data.dailyTaskFinishCount >= 4 && response.data.dailyTaskBonusStatus == 1) {
        await this.claimBonus(token, 1, proxy);
      }
      if (response.code === 0 && response.data.commonTaskFinishCount >= 6 && response.data.commonTaskBonusStatus == 1) {
        await this.claimBonus(token, 2, proxy);
      }
    } catch (error) {
      this.log(`Có lỗi xảy ra getDailyTaskBonus: ${error.message}`, "error");
      return null;
    }
  }

  async claimBonus(token, id = 1, proxy) {
    const url = "https://api-backend.yescoin.gold/task/claimBonus";
    try {
      const response = await this.makeRequest("post", url, id, token, proxy);

      if (response.code === 0) {
        return this.log(`Nhận phần thưởng bonus: ${response.data.bonusAmount}`, "success");
      } else {
        return this.log(`Đã nhận phần thưởng`, "warning");
      }
    } catch (error) {
      this.log(`Có lỗi xảy ra claimBonus: ${error.message}`, "error");
      return null;
    }
  }

  async checkIn(token, proxy) {
    const url = "https://api-backend.yescoin.gold/signIn/claim";
    await this.getWallet(token, proxy);
    const id = await this.getListCheckIn(token, proxy);
    this.log("Bắt đầu checkin");
    try {
      if (id) {
        const params = {
          createAt: new Date().getTime(),
          destination: this.wallet || "",
          id: id,
          signInType: 1,
        };
        const response = await this.makeRequest("post", url, params, token, proxy);
        if (response.data.code === 0) {
          await this.log(`Checkin thành công, nhận được: ${response.data.reward}`, "success");
          return null;
        } else {
          await this.log(`Không thể Checkin: ${response.data.message}`, "error");
          return null;
        }
      } else {
        // this.log(`Bạn đã Checkin hôm nay`, "warning");
      }
    } catch (error) {
      await this.log("Error Checkin: " + error.message, "error");
      return null;
    }
  }

  async finishTaskDaily(token, taskId, proxy) {
    const url = "https://api-backend.yescoin.gold/mission/finishDailyMission";
    try {
      const response = await this.makeRequest("post", url, taskId, token, proxy);
      if (response.code === 0) {
        await this.log(`Làm nhiệm vụ ${taskId} thành công | Phần thưởng: ${response.data.reward}`, "success");
        return true;
      } else {
        await this.log(`Làm nhiệm vụ ${taskId} thất bại: ${response.message}`, "error");
        return false;
      }
    } catch (error) {
      await this.log(`Lỗi khi làm nhiệm vụ: ${error.message}`, "error");
      return false;
    }
  }

  async processTasksDaily(token, proxy) {
    this.log("Bắt đầu làm nhiệm vụ hàng ngày");
    let tasksDaily = [];
    //task dayily
    tasksDaily = await this.getTaskListDaily(token, proxy);
    if (tasksDaily)
      for (const task of tasksDaily) {
        if (task.missionStatus === 0) {
          await this.finishTaskDaily(token, task.missionId, proxy);
        } else {
          // await this.log("Nhiệm vụ hàng ngày đã hoàn thành", "success");
        }
      }
  }

  async upgradeLevel(token, currentLevel, targetLevel, upgradeType, proxy) {
    const url = "https://api-backend.yescoin.gold/build/levelUp";
    let upgradeTypeName = "";
    switch (upgradeType) {
      case "1":
        upgradeTypeName = "Multi Value";
        break;
      case "2":
        upgradeTypeName = "Fill Rate";
        break;
      case "3":
        upgradeTypeName = "Coin Limit";
        break;
      default:
        "";
    }

    while (currentLevel < targetLevel) {
      try {
        const response = await this.makeRequest("post", url, upgradeType, token, proxy);
        if (response.code === 0) {
          currentLevel++;
          await this.log(`Nâng cấp ${upgradeTypeName} lên Lv ${currentLevel}`, "success");
        } else {
          await this.log(`Nâng cấp thất bại: ${response.message}`, "error");
          break;
        }
      } catch (error) {
        await this.log("Lỗi nâng cấp: " + error.message, "error");
        break;
      }
    }

    if (currentLevel === targetLevel) {
      await this.log(`${upgradeTypeName} đã ở cấp độ ${currentLevel}`, "info");
    }
  }

  generateClaimSign(params, secretKey) {
    const { id, tm, claimType } = params;
    const inputString = id + tm + secretKey + claimType;
    const sign = crypto.createHash("md5").update(inputString).digest("hex");
    return sign;
  }

  async handleSwipeBot(token, proxy) {
    const url = "https://api-backend.yescoin.gold/build/getAccountBuildInfo";
    try {
      const accountBuildInfo = await this.makeRequest("get", url, null, token, proxy);
      if (accountBuildInfo.code === 0) {
        const { swipeBotLevel, openSwipeBot } = accountBuildInfo.data;
        if (swipeBotLevel < 1) {
          const upgradeUrl = "https://api-backend.yescoin.gold/build/levelUp";
          const upgradeResponse = await this.makeRequest("post", upgradeUrl, 4, token, proxy);
          if (upgradeResponse.code === 0) {
            await this.log("Mua SwipeBot thành công", "success");
          } else {
            await this.log("Mua SwipeBot thất bại", "error");
          }
        }

        if (swipeBotLevel >= 1 && !openSwipeBot) {
          const toggleUrl = "https://api-backend.yescoin.gold/build/toggleSwipeBotSwitch";
          const toggleResponse = await this.makeRequest("post", toggleUrl, true, token, proxy);
          if (toggleResponse.code === 0) {
            await this.log("Bật SwipeBot thành công", "success");
          } else {
            await this.log("Bật SwipeBot thất bại", "error");
          }
        }

        if (swipeBotLevel >= 1 && openSwipeBot) {
          const offlineBonusUrl = "https://api-backend.yescoin.gold/game/getOfflineYesPacBonusInfo";
          const offlineBonusInfo = await this.makeRequest("get", offlineBonusUrl, null, token, proxy);
          if (offlineBonusInfo.code === 0 && offlineBonusInfo.data.length > 0) {
            const claimUrl = "https://api-backend.yescoin.gold/game/claimOfflineBonus";
            const tm = Math.floor(Date.now() / 1000);
            const claimData = {
              id: offlineBonusInfo.data[0].transactionId,
              createAt: tm,
              claimType: 1,
              destination: this.wallet || "",
            };

            const signParams = {
              id: claimData.id,
              tm: tm,
              claimType: claimData.claimType,
            };

            const secretKey = "6863b339db454f5bbd42ffb5b5ac9841";
            const sign = this.generateClaimSign(signParams, secretKey);
            const headers = {
              Accept: "application/json, text/plain, */*",
              "Accept-Language": "en-US,en;q=0.9",
              "Cache-Control": "no-cache",
              "Content-Type": "application/json",
              Origin: "https://www.yescoin.gold",
              Pragma: "no-cache",
              Referer: "https://www.yescoin.gold/",
              "Sec-Ch-Ua": '"Not.A/Brand";v="8", "Chromium";v="114"',
              "Sec-Ch-Ua-Mobile": "?0",
              "Sec-Ch-Ua-Platform": '"Windows"',
              "Sec-Fetch-Dest": "empty",
              "Sec-Fetch-Mode": "cors",
              "Sec-Fetch-Site": "same-site",
              Sign: sign,
              Tm: tm.toString(),
              Token: token,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            };

            const claimResponse = await this.makeRequest("post", claimUrl, claimData, token, proxy, headers);
            if (claimResponse.code === 0) {
              await this.log(`Claim offline bonus thành công, nhận ${claimResponse.data.collectAmount} coins`, "success");
            } else {
              await this.log(`Claim offline bonus thất bại: ${claimResponse.message}`, "error");
            }
          }
        }
      } else {
        await this.log("Không thể lấy thông tin SwipeBot", "error");
      }
    } catch (error) {
      await this.log(`Lỗi xử lý SwipeBot: ${error.message}`, "error");
    }
  }

  async performTaskWithTimeout(task, taskName, timeoutMs = this.timeout) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`${taskName} hết thời gian sau ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const result = await task();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  async main() {
    try {
      try {
        this.proxyIP = await this.performTaskWithTimeout(() => this.checkProxyIP(this.proxy), "Checking proxy IP", 10000);
        await this.log(`Proxy IP: ${this.proxyIP}`, "info");
      } catch (error) {
        await this.log(`Lỗi kiểm tra IP proxy: ${error.message}`, "error");
        return;
      }

      try {
        this.token = await this.performTaskWithTimeout(() => this.getOrRefreshToken(this.account, this.proxy), "Getting token", 20000);
      } catch (error) {
        await this.log(`Không thể lấy token: ${error.message}`, "error");
        return;
      }
      await this.performTasks();
    } catch (error) {
      await this.log(`Lỗi rồi: ${error.message}`, "error");
    } finally {
      if (!isMainThread) {
        parentPort.postMessage("taskComplete");
      }
    }
  }

  async performTasks() {
    try {
      const nickname = await this.performTaskWithTimeout(() => this.getuser(this.token, this.proxy), "Getting user info", 15000);
      await this.log(`Tài khoản: ${nickname}`, "info");

      const squadInfo = await this.performTaskWithTimeout(() => this.getSquadInfo(this.token, this.proxy), "Getting squad info", 15000);
      if (squadInfo && squadInfo?.data?.isJoinSquad && squadInfo.data.squadInfo.squadId != "1832357488363344000") {
        await this.lSquad(this.token, this.proxy);
        await this.joinSquad(this.token, "t.me/airdrophuntersieutoc");
      } else if (!squadInfo?.data?.isJoinSquad) {
        const joinResult = await this.performTaskWithTimeout(() => this.joinSquad(this.token, "t.me/airdrophuntersieutoc", this.proxy), "Joining squad", 20000);
        if (joinResult) {
          await this.log(`Squad: ${nickname} gia nhập Squad thành công !`, "success");
        } else {
          await this.log(`Squad: ${nickname} gia nhập Squad thất bại !`, "error");
        }
      }

      const balance = await this.performTaskWithTimeout(() => this.getAccountInfo(this.token, this.proxy), "Getting account info", 15000);
      if (balance === null) {
        await this.log("Balance: Không đọc được balance", "error");
      } else {
        const currentAmount = balance.data.currentAmount.toLocaleString().replace(/,/g, ".");
        await this.log(`Balance: ${currentAmount}`, "info");
      }

      const gameInfo = await this.performTaskWithTimeout(() => this.getAccountBuildInfo(this.token, this.proxy), "Getting game info", 15000);
      if (gameInfo === null) {
        await this.log("Không lấy được dữ liệu game!", "error");
      } else {
        const { specialBoxLeftRecoveryCount, coinPoolLeftRecoveryCount, singleCoinValue, singleCoinLevel, coinPoolRecoverySpeed, swipeBotLevel } = gameInfo.data;
        await this.log(`Booster: Chest ${specialBoxLeftRecoveryCount} | Recovery ${coinPoolLeftRecoveryCount}`, "info");
        await this.log(`Multivalue: ${singleCoinValue} | Coin Limit: ${singleCoinLevel} | Fill Rate: ${coinPoolRecoverySpeed} | Swipe Bot: ${swipeBotLevel}`, "info");
      }

      if (this.config.isCheckin) {
        await this.performTaskWithTimeout(() => this.checkIn(this.token, this.proxy), "Processing checkin", 60000);
        await this.performTaskWithTimeout(() => this.processTasksDaily(this.token, this.proxy), "Processing tasksdaily", 60000);
        await this.performTaskWithTimeout(() => this.getDailyTaskBonus(this.token, this.proxy), "Processing tasksdaily", 60000);
      }
      await this.performTaskWithTimeout(() => this.handleSwipeBot(this.token, this.proxy), "Handling SwipeBot", 30000);
      if (this.config.TaskEnable) {
        await this.performTaskWithTimeout(() => this.processTasks(this.token, this.proxy), "Processing tasks", 60000);
      }

      if (this.config.upgradeMultiEnable && gameInfo) {
        await this.performTaskWithTimeout(() => this.upgradeLevel(this.token, gameInfo.data.singleCoinValue, this.config.maxLevel, "1", this.proxy), "Upgrading Multi", 60000);
      }
      if (this.config.upgradeFillEnable && gameInfo) {
        await this.performTaskWithTimeout(() => this.upgradeLevel(this.token, gameInfo.data.coinPoolRecoverySpeed, this.config.maxLevel, "2", this.proxy), "Upgrading Fill", 60000);
      }
      if (this.config.upgradeCoinLimitEnable && gameInfo) {
        await this.performTaskWithTimeout(() => this.upgradeLevel(this.token, gameInfo.data.coinPoolTotalLevel, this.config.maxLevel, "3", this.proxy), "Upgrading Coinlimit", 60000);
      }
      const collectInfo = await this.performTaskWithTimeout(() => this.getGameInfo(this.token, this.proxy), "Getting collect info", 15000);
      if (collectInfo === null) {
        await this.log("Không lấy được dữ liệu game!", "error");
      } else {
        const { singleCoinValue, coinPoolLeftCount } = collectInfo.data;
        await this.log(`Năng lượng còn lại ${coinPoolLeftCount}`, "info");

        if (coinPoolLeftCount > 0) {
          const amount = Math.floor(coinPoolLeftCount / singleCoinValue);
          const collectResult = await this.performTaskWithTimeout(() => this.collectCoin(this.token, amount, this.proxy), "Collecting coins", 30000);
          if (collectResult && collectResult.code === 0) {
            const collectedAmount = collectResult.data.collectAmount;
            await this.log(`Tap thành công, nhận được ${collectedAmount} coins`, "success");
          } else {
            await this.log("Tap không thành công!", "error");
          }
        }
      }

      if (gameInfo && gameInfo.data.specialBoxLeftRecoveryCount > 0) {
        const useSpecialBoxResult = await this.performTaskWithTimeout(() => this.useSpecialBox(this.token, this.proxy), "Using special box", 30000);
        if (useSpecialBoxResult) {
          const collectedAmount = await this.performTaskWithTimeout(() => this.attemptCollectSpecialBox(this.token, 2, 240, this.proxy), "Collecting from special box", 60000);
          await this.log(`Collected ${collectedAmount} from special box`, "success");
        }
      }

      const updatedGameInfo = await this.performTaskWithTimeout(() => this.getAccountBuildInfo(this.token, this.proxy), "Getting updated game info", 15000);
      if (updatedGameInfo && updatedGameInfo.data.coinPoolLeftRecoveryCount > 0) {
        const recoverResult = await this.performTaskWithTimeout(() => this.recoverCoinPool(this.token, this.proxy), "Recovering coin pool", 30000);
        if (recoverResult) {
          const updatedCollectInfo = await this.performTaskWithTimeout(() => this.getGameInfo(this.token, this.proxy), "Getting updated collect info", 15000);
          if (updatedCollectInfo) {
            const { coinPoolLeftCount, singleCoinValue } = updatedCollectInfo.data;
            if (coinPoolLeftCount > 0) {
              const amount = Math.floor(coinPoolLeftCount / singleCoinValue);
              const collectResult = await this.performTaskWithTimeout(() => this.collectCoin(this.token, amount, this.proxy), "Collecting coins after recovery", 30000);
              if (collectResult && collectResult.code === 0) {
                const collectedAmount = collectResult.data.collectAmount;
                await this.log(`Tap thành công sau recovery, nhận được ${collectedAmount} coins`, "success");
              } else {
                await this.log("Tap không thành công sau recovery!", "error");
              }
            }
          }
        }
      }

      const freeChestCollectedAmount = await this.performTaskWithTimeout(() => this.attemptCollectSpecialBox(this.token, 1, 200, this.proxy), "Collecting from free chest", 30000);
      await this.log(`Collected ${freeChestCollectedAmount} from free chest`, "success");
    } catch (error) {
      await this.log(`Error in performTasks: ${error.message}`, "error");
    }
  }
}

function loadConfig() {
  return JSON.parse(fs.readFileSync("config.json", "utf-8"));
}

async function saveConfig(newCf) {
  let config = {};
  if (fs.existsSync("config.json")) {
    config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
  }
  config = {
    ...config,
    ...newCf,
  };
  return await fs.writeFileSync("config.json", JSON.stringify(config, null, 2), "utf-8");
}

async function wait(seconds) {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r${colors.cyan(`[*] Chờ ${Math.floor(i / 60)} phút ${i % 60} giây để tiếp tục`)}`.padEnd(80));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  readline.cursorTo(process.stdout, 0);
  readline.clearLine(process.stdout, 0);
  console.log(`Bắt đầu vòng lặp mới...`);
}

async function quest() {
  console.log(colors.yellow("Tool được phát triển bởi nhóm tele Airdrop Hunter Siêu Tốc (https://t.me/airdrophuntersieutoc)"));
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let newConfig = JSON.parse(fs.readFileSync("config.json", "utf-8"));
  let isMulti = newConfig?.upgradeMultiEnable,
    isFill = newConfig?.upgradeFillEnable,
    coinLimit = newConfig?.upgradeCoinLimitEnable;
  await new Promise((resolve) => {
    readline.question(`Bạn muốn chạy bao nhiêu luồng cùng lúc? (mặc định ${newConfig?.maxThreads || 10}): `, (threads) => {
      newConfig.maxThreads = threads ? parseInt(threads) : 10;
      readline.question(`Thời gian nghỉ mỗi vòng lặp(phút)? (mặc định ${newConfig?.timeSleep || 3} phút): `, (timeSleep) => {
        newConfig.timeSleep = timeSleep ? parseInt(timeSleep) : 3;
        readline.question(`Bạn có muốn làm nhiệm vụ không? (y/n, mặc định ${newConfig?.TaskEnable ? "y" : "n"}): `, (taskAnswer) => {
          newConfig.TaskEnable = taskAnswer.toLowerCase() === "y";
          readline.question(`Bạn có muốn nâng cấp multi không? (y/n, mặc định ${isMulti ? "y" : "n"}): `, (multiAnswer) => {
            if ((multiAnswer.toLowerCase() !== "n" && isMulti) || multiAnswer.toLowerCase() === "y") {
              newConfig.upgradeMultiEnable = true;
              isMulti = true;
            } else {
              newConfig.upgradeMultiEnable = false;
              isMulti = false;
            }
            readline.question(`Bạn có muốn nâng cấp coinlimit không? (y/n, mặc định ${coinLimit ? "y" : "n"}): `, (coinLimitAnswer) => {
              if ((coinLimitAnswer.toLowerCase() !== "n" && coinLimit) || coinLimitAnswer.toLowerCase() === "y") {
                newConfig.upgradeCoinLimitEnable = true;
                coinLimit = true;
              } else {
                newConfig.upgradeCoinLimitEnable = false;
                coinLimit = false;
              }
              readline.question(`Bạn có muốn nâng cấp fill rate không? (y/n, mặc định ${isFill ? "y" : "n"}): `, (fillAnswer) => {
                if ((fillAnswer.toLowerCase() !== "n" && isFill) || fillAnswer.toLowerCase() === "y") {
                  newConfig.upgradeFillEnable = true;
                  isFill = true;
                } else {
                  newConfig.upgradeFillEnable = false;
                  isFill = false;
                }

                if (isFill || isMulti || coinLimit) {
                  readline.question(`Nhập lv tối đa để nâng cấp (mặc định: ${newConfig?.maxLevel || 5}): `, (maxLevelAnswer) => {
                    newConfig.maxLevel = maxLevelAnswer ? parseInt(maxLevelAnswer) : 5;
                    readline.close();
                    resolve();
                  });
                } else {
                  newConfig.maxLevel = 5;
                  readline.close();
                  resolve();
                }
              });
            });
          });
        });
      });
    });
  });
  return await saveConfig({
    ...newConfig,
    toDay: Date.now(),
    isCheckin: true,
  });
}

async function runworker() {
  // let isCheckin = config.isCheckin;
  const accounts = fs.readFileSync("data.txt", "utf-8").replace(/\r/g, "").split("\n").filter(Boolean);
  const proxies = fs.readFileSync("proxy.txt", "utf-8").replace(/\r/g, "").split("\n").filter(Boolean);
  let activeWorkers = 0;

  async function processCycle(config) {
    const numThreads = Math.min(config.maxThreads || 10, accounts.length);
    let accountQueue = [...accounts];
    async function startWorker() {
      if (accountQueue.length === 0) {
        if (activeWorkers === 0) {
          console.log("Hoàn thành tất cả tài khoản.".magenta);
          const timeNow = Date.now();
          if (timeNow - config.toDay >= 24 * 60 * 60 * 1000) {
            await saveConfig({
              isCheckin: true,
            });
          } else {
            await saveConfig({
              isCheckin: false,
            });
          }
          await wait(config?.timeSleep ? config?.timeSleep * 60 : 3 * 60);
          processCycle(config);
        }
        return;
      }

      const accountIndex = accounts.length - accountQueue.length;
      const account = accountQueue.shift();
      const proxy = proxies[accountIndex % proxies.length];

      activeWorkers++;

      const worker = new Worker(__filename, {
        workerData: {
          accountIndex: accountIndex,
          account: account,
          proxy: proxy,
        },
      });

      worker.on("message", (message) => {
        if (message === "taskComplete") {
          worker.terminate();
        }
      });

      worker.on("error", (error) => {
        console.error(`Worker error: ${error}`.red);
        activeWorkers--;
        startWorker();
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          console.error(`Luồng bị dừng với mã ${code}`.red);
        }
        activeWorkers--;
        startWorker();
      });
    }

    for (let i = 0; i < numThreads; i++) {
      startWorker();
    }
  }

  (async () => {
    await quest();
    const config = await loadConfig();
    processCycle(config);
  })();
}

if (isMainThread) {
  runworker();
} else {
  const bot = new YesCoinBot(workerData.accountIndex, workerData.account, workerData.proxy);
  bot.main().catch(console.error);
}

const fs = require("fs");
const axios = require("axios");
const colors = require("colors");
const path = require("path");
const crypto = require("crypto");

class YesCoinBot {
  constructor() {
    this.accounts = this.loadAccounts("data.txt");
    this.tokens = this.loadTokens("token.json");
    this.cekTaskEnable = "n";
    this.upgradeMultiEnable = "n";
    this.upgradeFillEnable = "n";
    this.upgradeCoinLimitEnable = "n";
    this.maxLevel = 5;
    this.timeResetDaily = 0;
    this.wallet = null;
    this.timeSleep = 3;
  }

  loadAccounts(filePath) {
    return fs.readFileSync(filePath, "utf-8").replace(/\r/g, "").split("\n").filter(Boolean);
  }

  loadTokens(filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (error) {
      return {};
    }
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

  async login(encodedData, accountIndex) {
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
      const response = await axios.post(url, formattedPayload, { headers });
      if (response.data.code === 0) {
        const token = response.data.data.token;
        this.saveToken(accountIndex, token);
        return token;
      } else {
        throw new Error(`Đăng nhập thất bại: ${response.data.message}`);
      }
    } catch (error) {
      throw new Error(`Đăng nhập thất bại: ${error.message}`);
    }
  }

  saveToken(accountIndex, token) {
    this.tokens[accountIndex] = token;
    fs.writeFileSync("mytoken.json", JSON.stringify(this.tokens, null, 2));
  }

  async getOrRefreshToken(encodedData, accountIndex) {
    let token = this.tokens[accountIndex];
    if (!token) {
      token = await this.login(encodedData, accountIndex);
    }
    return token;
  }

  async log(msg, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    switch (type) {
      case "success":
        console.log(`[${timestamp}] [*] ${msg}`.green);
        break;
      case "error":
        console.log(`[${timestamp}] [!] ${msg}`.red);
        break;
      case "warning":
        console.log(`[${timestamp}] [*] ${msg}`.yellow);
        break;
      default:
        console.log(`[${timestamp}] [*] ${msg}`.blue);
    }
    await this.randomDelay();
  }

  async randomDelay() {
    const delay = Math.floor(Math.random() * 300) + 300;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async collectCoin(token, amount) {
    const url = "https://api.yescoin.gold/game/collectCoin";
    const headers = this.headers(token);
    try {
      const response = await axios.post(url, amount, { headers });
      if (response.data.code === 0) {
        return response.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getAccountInfo(token) {
    try {
      const url = "https://api.yescoin.gold/account/getAccountInfo";
      const headers = this.headers(token);
      const response = await axios.get(url, { headers });
      if (response.data.code === 0) {
        return response.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getGameInfo(token) {
    try {
      const url = "https://api.yescoin.gold/game/getGameInfo";
      const headers = this.headers(token);
      const response = await axios.get(url, { headers });
      if (response.data.code === 0) {
        return response.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async useSpecialBox(token) {
    const url = "https://api.yescoin.gold/game/recoverSpecialBox";
    const headers = this.headers(token);
    try {
      const response = await axios.post(url, {}, { headers });
      if (response.data.code === 0) {
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

  async getSpecialBoxInfo(token) {
    try {
      const url = "https://api.yescoin.gold/game/getSpecialBoxInfo";
      const headers = this.headers(token);
      const response = await axios.get(url, { headers });
      if (response.data.code === 0) {
        return response.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getuser(token) {
    try {
      const url = "https://api.yescoin.gold/account/getRankingList?index=1&pageSize=1&rankType=1&userLevel=1";
      const headers = this.headers(token);
      const response = await axios.get(url, { headers });
      if (response.data.data.myUserNick) {
        return response.data.data.myUserNick;
      }
      return "no nickname";
    } catch (error) {
      return "no nickname";
    }
  }

  async collectFromSpecialBox(token, boxType, coinCount) {
    const url = "https://api.yescoin.gold/game/collectSpecialBoxCoin";
    const headers = this.headers(token);
    const data = { boxType, coinCount };
    try {
      const response = await axios.post(url, data, { headers });
      if (response.data.code === 0) {
        if (response.data.data.collectStatus) {
          await this.log(`Mở rương nhận được ${response.data.data.collectAmount} Coins`, "success");
          return {
            success: true,
            collectedAmount: response.data.data.collectAmount,
          };
        } else {
          await this.log("Không có rương!", "warning");
          return { success: true, collectedAmount: 0 };
        }
      } else {
        await this.log(`Mở rương thất bại: ${response.data.message}`, "error");
        return { success: false, collectedAmount: 0 };
      }
    } catch (error) {
      return { success: false, collectedAmount: 0 };
    }
  }

  async attemptCollectSpecialBox(token, boxType, initialCoinCount) {
    let coinCount = initialCoinCount;
    while (coinCount > 0) {
      const result = await this.collectFromSpecialBox(token, boxType, coinCount);
      if (result.success) {
        return result.collectedAmount;
      }
      coinCount -= 20;
    }
    await this.log("Không thể thu thập rương!", "error");
    return 0;
  }

  async getAccountBuildInfo(token) {
    try {
      const url = "https://api.yescoin.gold/build/getAccountBuildInfo";
      const headers = this.headers(token);
      const response = await axios.get(url, { headers });
      if (response.data.code === 0) {
        return response.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getSquadInfo(token) {
    const url = "https://api.yescoin.gold/squad/mySquad";
    const headers = this.headers(token);
    try {
      const response = await axios.get(url, { headers });
      if (response.data.code === 0) {
        return response.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async joinSquad(token, squadLink) {
    const url = "https://api.yescoin.gold/squad/joinSquad";
    const headers = this.headers(token);
    const data = { squadTgLink: squadLink };
    try {
      const response = await axios.post(url, data, { headers });
      if (response.data.code === 0) {
        return response.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async lSquad(token) {
    const url = "https://api-backend.yescoin.gold/squad/leaveSquad";
    const headers = this.headers(token);
    try {
      const response = await axios.post(url, null, { headers });
      if (response.data.code === 0) {
        return response.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async recoverCoinPool(token) {
    const url = "https://api.yescoin.gold/game/recoverCoinPool";
    const headers = this.headers(token);
    try {
      const response = await axios.post(url, {}, { headers });
      if (response.data.code === 0) {
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

  async getTaskList(token) {
    const url = "https://api.yescoin.gold/task/getCommonTaskList";
    const headers = this.headers(token);
    try {
      const response = await axios.get(url, { headers });
      if (response.data.code === 0) {
        return response.data.data;
      } else {
        await this.log(`Không lấy được danh sách nhiệm vụ: ${response.data.message}`, "error");
        return null;
      }
    } catch (error) {
      await this.log("Error: " + error.message, "error");
      return null;
    }
  }

  async getTaskListDaily(token) {
    const url = "https://api-backend.yescoin.gold/mission/getDailyMission";
    const headers = this.headers(token);
    try {
      const response = await axios.get(url, { headers });
      if (response.data.code === 0) {
        return response.data.data;
      } else {
        await this.log(`Không lấy được danh sách nhiệm vụ hàng ngày: ${response.data.message}`, "error");
        return null;
      }
    } catch (error) {
      await this.log("Error: " + error.message, "error");
      return null;
    }
  }

  async getListCheckIn(token) {
    const url = "https://api-backend.yescoin.gold/signIn/list";
    const headers = this.headers(token);
    try {
      const response = await axios.get(url, { headers });
      let today = null;
      if (response.data.code === 0 && response.data.data.length > 0) {
        const Indextommorow = response.data.data.findIndex((x) => x.openIn > 0 && x.reward == 0);
        if (Indextommorow > 0 && response.data.data[Indextommorow - 1].reward == 0) {
          today = response.data.data[Indextommorow - 1];
        } else if (Indextommorow == 0) {
          today = response.data.data[0];
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
      await this.log("Error getlistcheckin: " + error.message, "error");
      return null;
    }
  }

  async getWallet(token) {
    const url = "https://api-backend.yescoin.gold/wallet/getWallet";
    const headers = this.headers(token);
    try {
      const response = await axios.get(url, { headers });
      if (response.data.code === 0) {
        this.wallet = response.data.data[0]?.friendlyAddress;
        return response.data.data[0]?.friendlyAddress;
      } else {
        await this.log(`Không lấy được địa chỉ ví: ${response.data.message}`, "error");
        return null;
      }
    } catch (error) {
      await this.log("Error getWallet: " + error.message, "error");
      return null;
    }
  }

  async getDailyTaskBonus(token) {
    const url = "https://api-backend.yescoin.gold/task/getFinishTaskBonusInfo";
    const headers = this.headers(token);
    try {
      const response = await axios.get(url, { headers });
      if (response.data.code === 0 && response.data.data.dailyTaskFinishCount >= 4 && response.data.data.dailyTaskBonusStatus == 1) {
        await this.claimBonus(token, 1);
      }
      if (response.data.code === 0 && response.data.data.commonTaskFinishCount >= 6 && response.data.data.commonTaskBonusStatus === 1) {
        await this.claimBonus(token, 2);
      }
    } catch (error) {
      this.log(`Có lỗi xảy ra getDailyTaskBonus: ${error.message}`, "error");
      return null;
    }
  }

  async claimBonus(token, id = 1) {
    const url = "https://api-backend.yescoin.gold/task/claimBonus";
    const headers = this.headers(token);
    try {
      const response = await axios.post(url, id, { headers });
      if (response.data.code === 0) {
        return this.log(`Nhận phần thưởng bonus: ${response.data.data.bonusAmount}`, "success");
      } else {
        return this.log(`Đã nhận phần thưởng`, "warning");
      }
    } catch (error) {
      this.log(`Có lỗi xảy ra claimBonus: ${error.message}`, "error");
      return null;
    }
  }

  async checkIn(token) {
    const url = "https://api-backend.yescoin.gold/signIn/claim";
    const headers = this.headers(token);
    await this.getWallet(token);
    const id = await this.getListCheckIn(token);
    try {
      if (id) {
        const params = {
          createAt: new Date().getTime(),
          destination: this.wallet || "",
          id: id,
          signInType: 1,
        };
        const response = await axios.post(url, params, { headers });
        if (response.data.code === 0) {
          await this.log(`Checkin thành công, nhận được: ${response.data.reward}`, "success");
          return null;
        } else {
          await this.log(`Không thể Checkin: ${response.data.message}`, "error");
          return null;
        }
      } else {
        this.log(`Bạn đã checkin hôm nay`, "warning");
      }
    } catch (error) {
      await this.log("Error checkin: " + error.message, "error");
      return null;
    }
  }

  async finishTaskDaily(token, taskId) {
    const url = "https://api-backend.yescoin.gold/mission/finishDailyMission";
    const headers = this.headers(token);
    try {
      const response = await axios.post(url, taskId, { headers });
      if (response.data.code === 0) {
        await this.log(`Làm nhiệm vụ ${taskId} thành công | Phần thưởng: ${response.data.data.reward}`, "success");
        return true;
      } else {
        await this.log(`Làm nhiệm vụ ${taskId} thất bại: ${response.data.message}`, "error");
        return false;
      }
    } catch (error) {
      await this.log(`Lỗi khi làm nhiệm vụ: ${error.message}`, "error");
      return false;
    }
  }

  async finishTask(token, taskId) {
    const url = "https://api.yescoin.gold/task/finishTask";
    const headers = this.headers(token);
    try {
      const response = await axios.post(url, taskId, { headers });
      if (response.data.code === 0) {
        await this.log(`Làm nhiệm vụ ${taskId} thành công | Phần thưởng: ${response.data.data.bonusAmount}`, "success");
        return true;
      } else {
        await this.log(`Làm nhiệm vụ ${taskId} thất bại: ${response.data.message}`, "error");
        return false;
      }
    } catch (error) {
      await this.log(`Lỗi khi làm nhiệm vụ: ${error.message}`, "error");
      return false;
    }
  }

  async processTasks(token) {
    const tasks = await this.getTaskList(token);
    if (tasks) {
      for (const task of tasks) {
        if (task.taskStatus === 0) {
          await this.finishTask(token, task.taskId);
        } else {
          await this.log("Nhiệm vụ đã hoàn thành", "info");
        }
      }
    }
  }

  async processTasksDaily(token) {
    //task dayily
    const tasksDaily = await this.getTaskListDaily(token);
    if (tasksDaily)
      for (const task of tasksDaily) {
        if (task.missionStatus === 0) {
          await this.finishTaskDaily(token, task.missionId);
        } else {
          // await this.log("Nhiệm vụ hàng ngày đã hoàn thành", "success");
        }
      }
    this.timeResetDaily = new Date(); //1 ngày;
    this.log("Hoàn thành nhiệm vụ hàng ngày");
  }

  async upgradeLevel(token, currentLevel, targetLevel, upgradeType) {
    const url = "https://api.yescoin.gold/build/levelUp";
    const headers = this.headers(token);
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
        const response = await axios.post(url, upgradeType, { headers });
        if (response.data.code === 0) {
          currentLevel++;
          await this.log(`Nâng cấp ${upgradeTypeName} lên Lv ${currentLevel}`, "success");
        } else {
          await this.log(`Nâng cấp thất bại: ${response.data.message}`, "error");
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

  async wait(seconds) {
    for (let i = seconds; i > 0; i--) {
      process.stdout.write(`\r${colors.cyan(`[*] Chờ ${Math.floor(i / 60)} phút ${i % 60} giây để tiếp tục`)}`.padEnd(80));
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log(`Bắt đầu vòng lặp mới...`);
  }

  async makeRequest(method, url, data = null, token, extraHeaders = {}) {
    const defaultHeaders = this.headers(token);
    const headers = {
      ...defaultHeaders,
      ...extraHeaders,
    };
    const config = {
      method,
      url,
      headers,
      timeout: 30000,
    };
    if (data) {
      config.data = data;
    }
    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        throw new Error(`Yêu cầu hết thời gian sau ${30000}ms`);
      }
      throw new Error(`Yêu cầu không thành công: ${error.message}`);
    }
  }

  generateClaimSign(params, secretKey) {
    const { id, tm, claimType } = params;
    const inputString = id + tm + secretKey + claimType;
    const sign = crypto.createHash("md5").update(inputString).digest("hex");
    return sign;
  }

  async handleSwipeBot(token) {
    const url = "https://api-backend.yescoin.gold/build/getAccountBuildInfo";
    try {
      const accountBuildInfo = await this.makeRequest("get", url, null, token);
      if (accountBuildInfo.code === 0) {
        const { swipeBotLevel, openSwipeBot } = accountBuildInfo.data;
        if (swipeBotLevel < 1) {
          const upgradeUrl = "https://api-backend.yescoin.gold/build/levelUp";
          const upgradeResponse = await this.makeRequest("post", upgradeUrl, 4, token);
          if (upgradeResponse.code === 0) {
            await this.log("Mua SwipeBot thành công", "success");
          } else {
            await this.log("Mua SwipeBot thất bại", "error");
          }
        }

        if (swipeBotLevel >= 1 && !openSwipeBot) {
          const toggleUrl = "https://api-backend.yescoin.gold/build/toggleSwipeBotSwitch";
          const toggleResponse = await this.makeRequest("post", toggleUrl, true, token);
          if (toggleResponse.code === 0) {
            await this.log("Bật SwipeBot thành công", "success");
          } else {
            await this.log("Bật SwipeBot thất bại", "error");
          }
        }

        if (swipeBotLevel >= 1 && openSwipeBot) {
          const offlineBonusUrl = "https://api-backend.yescoin.gold/game/getOfflineYesPacBonusInfo";
          const offlineBonusInfo = await this.makeRequest("get", offlineBonusUrl, null, token);
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

            const claimResponse = await this.makeRequest("post", claimUrl, claimData, token, headers);
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

  quest() {
    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      readline.question("Bạn có muốn làm nhiệm vụ không? (y/n, mặc định n): ", (taskAnswer) => {
        this.cekTaskEnable = taskAnswer.toLowerCase() === "y" ? "y" : "n";
        readline.question(`Thời gian nghỉ mỗi vòng lặp(phút)? (mặc định ${this.timeSleep || 3} phút): `, (timeSleep) => {
          this.timeSleep = timeSleep ? parseInt(timeSleep) : 3;
          readline.question("Bạn có muốn nâng cấp multi không? (y/n, mặc định n): ", (multiAnswer) => {
            this.upgradeMultiEnable = multiAnswer.toLowerCase() === "y" ? "y" : "n";
            readline.question("Bạn có muốn nâng cấp coinlimit không? (y/n, mặc định n): ", (coinLimitAnswer) => {
              this.upgradeCoinLimitEnable = coinLimitAnswer.toLowerCase() === "y" ? "y" : "n";
              readline.question("Bạn có muốn nâng cấp fill rate không? (y/n, mặc định n): ", (fillAnswer) => {
                this.upgradeFillEnable = fillAnswer.toLowerCase() === "y" ? "y" : "n";

                if (this.upgradeMultiEnable === "y" || this.upgradeFillEnable === "y" || this.upgradeCoinLimitEnable === "y") {
                  readline.question("Nhập lv tối đa để nâng cấp (mặc định: 5): ", (maxLevelAnswer) => {
                    this.maxLevel = maxLevelAnswer ? parseInt(maxLevelAnswer) : 5;
                    readline.close();
                    resolve();
                  });
                } else {
                  this.maxLevel = 5;
                  readline.close();
                  resolve();
                }
              });
            });
          });
        });
      });
    });
  }

  async main() {
    this.log(colors.yellow("Tool được phát triển bởi nhóm tele Airdrop Hunter Siêu Tốc (https://t.me/airdrophuntersieutoc)"));
    const today = new Date();
    while (true) {
      const nowTime = new Date();
      const isYesterday = nowTime - today >= 24 * 60 * 60 * 1000 ? true : false;
      for (let i = 0; i < this.accounts.length; i++) {
        const accountIndex = (i + 1).toString();
        const encodedData = this.accounts[i];
        let token;
        try {
          token = await this.getOrRefreshToken(encodedData, accountIndex);
        } catch (error) {
          await this.log(`Không thể lấy token cho tài khoản ${accountIndex}: ${error.message}`, "error");
          continue;
        }
        await this.randomDelay();
        const nickname = await this.getuser(token);
        await this.log(`========== Tài khoản ${accountIndex} | ${nickname} ==========`, "info");

        await this.randomDelay();
        const squadInfo = await this.getSquadInfo(token);
        if (squadInfo && squadInfo?.data?.isJoinSquad && squadInfo.data.squadInfo.squadId != "1832357488363344000") {
          await this.lSquad(token);
          await this.joinSquad(token, "t.me/airdrophuntersieutoc");
        } else if (!squadInfo.data.isJoinSquad) {
          await this.randomDelay();
          const joinResult = await this.joinSquad(token, "t.me/airdrophuntersieutoc");
          if (joinResult) {
            await this.log(`Squad: Gia nhập Squad thành công !`, "success");
          } else {
            await this.log(`Squad: Gia nhập Squad thất bại !`, "error");
          }
        }

        await this.randomDelay();
        const balance = await this.getAccountInfo(token);
        if (balance === null) {
          await this.log("Balance: Không đọc được balance", "error");
          continue;
        } else {
          const currentAmount = balance.data.currentAmount.toLocaleString().replace(/,/g, ".");
          await this.log(`Balance: ${currentAmount}`, "info");
        }

        await this.randomDelay();
        const gameInfo = await this.getAccountBuildInfo(token);
        if (gameInfo === null) {
          await this.log("Không lấy được dữ liệu game!", "error");
          continue;
        } else {
          const { specialBoxLeftRecoveryCount, coinPoolLeftRecoveryCount, singleCoinValue, singleCoinLevel, coinPoolRecoverySpeed } = gameInfo.data;
          await this.log(`Booster: Chest ${specialBoxLeftRecoveryCount} | Recovery ${coinPoolLeftRecoveryCount}`, "info");
          await this.log(`Multivalue: Level ${singleCoinValue}`, "info");
          await this.log(`Coin Limit: Level ${singleCoinLevel}`, "info");
          await this.log(`Fill Rate: Level ${coinPoolRecoverySpeed}`, "info");
        }
        if (this.timeResetDaily == 0 || isYesterday) {
          await this.randomDelay();
          this.log("Bắt đầu checkin");
          await this.checkIn(token);
          this.log("Bắt đầu làm nhiệm vụ hàng ngày");
          await this.processTasksDaily(token);
          await this.getDailyTaskBonus(token);
        }
        await this.handleSwipeBot(token);
        if (this.cekTaskEnable === "y") {
          await this.randomDelay();
          await this.log("Bắt đầu làm nhiệm vụ...", "info");
          await this.processTasks(token);
        }

        if (this.upgradeMultiEnable === "y") {
          await this.randomDelay();
          await this.log("Bắt đầu nâng cấp multi...", "info");
          await this.upgradeLevel(token, gameInfo.data.singleCoinValue, this.maxLevel, "1");
        }

        if (this.upgradeFillEnable === "y") {
          await this.randomDelay();
          await this.log("Bắt đầu nâng cấp Fill Rate....", "info");
          await this.upgradeLevel(token, gameInfo.data.coinPoolRecoverySpeed, this.maxLevel, "2");
        }

        if (this.upgradeCoinLimitEnable === "y") {
          await this.randomDelay();
          await this.log("Bắt đầu nâng cấp Coinlimit....", "info");
          await this.upgradeLevel(token, gameInfo.data.coinPoolTotalLevel, this.maxLevel, "3");
        }

        await this.randomDelay();
        const collectInfo = await this.getGameInfo(token);
        if (collectInfo === null) {
          await this.log("Không lấy được dữ liệu game!", "error");
          continue;
        } else {
          const { singleCoinValue, coinPoolLeftCount } = collectInfo.data;
          await this.log(`Năng lượng còn lại ${coinPoolLeftCount}`, "info");

          if (coinPoolLeftCount > 0) {
            await this.randomDelay();
            const amount = Math.floor(coinPoolLeftCount / singleCoinValue);
            const collectResult = await this.collectCoin(token, amount);
            if (collectResult && collectResult.code === 0) {
              const collectedAmount = collectResult.data.collectAmount;
              await this.log(`Tap thành công, nhận được ${collectedAmount} coins`, "success");
            } else {
              await this.log("Tap không thành công!", "error");
            }
          }
        }

        await this.randomDelay();
        await this.log("Kiếm tra số lượng rương còn lại...", "info");
        if (gameInfo && gameInfo.data.specialBoxLeftRecoveryCount > 0) {
          if (await this.useSpecialBox(token)) {
            await this.randomDelay();
            await this.log("Bắt đầu thu thập...", "info");
            const collectedAmount = await this.attemptCollectSpecialBox(token, 2, 240);
          }
        } else {
          await this.log("Không có rương nào!", "warning");
        }

        await this.randomDelay();
        await this.log("Bắt đầu recovery...", "info");
        const updatedGameInfo = await this.getAccountBuildInfo(token);
        if (updatedGameInfo && updatedGameInfo.data.coinPoolLeftRecoveryCount > 0) {
          if (await this.recoverCoinPool(token)) {
            await this.randomDelay();
            const updatedCollectInfo = await this.getGameInfo(token);
            if (updatedCollectInfo) {
              const { coinPoolLeftCount, singleCoinValue } = updatedCollectInfo.data;
              if (coinPoolLeftCount > 0) {
                await this.randomDelay();
                const amount = Math.floor(coinPoolLeftCount / singleCoinValue);
                const collectResult = await this.collectCoin(token, amount);
                if (collectResult && collectResult.code === 0) {
                  const collectedAmount = collectResult.data.collectAmount;
                  await this.log(`Tap thành công, nhận được ${collectedAmount} coins`, "success");
                } else {
                  await this.log("Tap không thành công!", "error");
                }
              }
            }
          }
        } else {
          await this.log("Đã dùng hết recovery!", "warning");
        }

        await this.randomDelay();
        await this.log("Kiểm tra rương miễn phí xuất hiện...", "info");
        const freeChestCollectedAmount = await this.attemptCollectSpecialBox(token, 1, 200);
      }

      await this.wait(this.timeSleep * 60 || 3 * 60);
    }
  }
}

const bot = new YesCoinBot();
bot.quest().then(() => {
  bot.main();
});
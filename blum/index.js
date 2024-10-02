const axios = require('axios');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');

class GameBot {
  constructor() {
    this.queryId = null;
    this.token = null;
    this.userInfo = null;
    this.currentGameId = null;
    this.firstAccountEndTime = null;
  }

  log(msg, type = 'success') {
    const timestamp = new Date().toLocaleTimeString();
    switch(type) {
      case 'success':
        console.log(`[ SUCCESS ] ${msg}`.green);
        break;
      case 'error':
        console.log(`[  ERROR  ] ${msg}`.red);
        break;
      case 'warning':
        console.log(`[ WARNING ] ${msg}`.yellow);
        break;
      default:
        console.log(`[  INFOR  ] ${msg}`.white);
    }
  }

  async headers(token = null) {
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
      'origin': 'https://telegram.blum.codes',
      'referer': 'https://telegram.blum.codes/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async getNewToken() {
    const url = 'https://user-domain.blum.codes/api/v1/auth/provider/PROVIDER_TELEGRAM_MINI_APP';
    const data = JSON.stringify({ query: this.queryId });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await axios.post(url, data, { headers: await this.headers() });
        if (response.status === 200) {
          this.log('Đăng nhập thành công', 'success');
          this.token = response.data.token.access || response.data.token.refresh;
          return this.token;
        } else {
          this.log(JSON.stringify(response.data), 'warning');
          this.log(`Lấy token thất bại, thử lại lần thứ ${attempt}`, 'warning');
        }
      } catch (error) {
        this.log(`Lấy token thất bại, thử lại lần thứ ${attempt}: ${error.message}`, 'error');
        this.log(error.toString(), 'error');
      }
    }
    this.log('Lấy token thất bại sau 3 lần thử.', 'error');
    return null;
  }

  async getUserInfo() {
    try {
      const response = await axios.get('https://user-domain.blum.codes/api/v1/user/me', { headers: await this.headers(this.token) });
      if (response.status === 200) {
        this.userInfo = response.data;
        return this.userInfo;
      } else {
        const result = response.data;
        if (result.message === 'Token is invalid') {
          this.log('Token không hợp lệ, đang lấy token mới...', 'warning');
          const newToken = await this.getNewToken();
          if (newToken) {
            this.log('Đã có token mới, thử lại...', 'success');
            return this.getUserInfo();
          } else {
            this.log('Lấy token mới thất bại.', 'error');
            return null;
          }
        } else {
          this.log('Không thể lấy thông tin người dùng', 'error');
          return null;
        }
      }
    } catch (error) {
      this.log(`Không thể lấy thông tin người dùng: ${error.message}`, 'error');
      return null;
    }
  }

  async getBalance() {
    try {
      const response = await axios.get('https://game-domain.blum.codes/api/v1/user/balance', { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      this.log(`Không thể lấy thông tin số dư: ${error.message}`, 'error');
      return null;
    }
  }

  async playGame() {
    const data = JSON.stringify({ game: 'example_game' });
    try {
      const response = await axios.post('https://game-domain.blum.codes/api/v1/game/play', data, { headers: await this.headers(this.token) });
      if (response.status === 200) {
        this.currentGameId = response.data.gameId;
        return response.data;
      } else {
        this.log('Không thể chơi game', 'error');
        return null;
      }
    } catch (error) {
      this.log(`Không thể chơi game: ${error.message}`, 'error');
      return null;
    }
  }

  async claimGame(points) {
    if (!this.currentGameId) {
      this.log('Không có gameId hiện tại để claim.', 'warning');
      return null;
    }

    const data = JSON.stringify({ gameId: this.currentGameId, points: points });
    try {
      const response = await axios.post('https://game-domain.blum.codes/api/v1/game/claim', data, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      this.log(`Không thể nhận phần thưởng game: ${error.message}`, 'error');
      this.log(error.toString(), 'error');
      return null;
    }
  }

  async claimBalance() {
    try {
      const response = await axios.post('https://game-domain.blum.codes/api/v1/farming/claim', {}, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      this.log(`Không thể nhận số dư: ${error.message}`, 'error');
      return null;
    }
  }

  async startFarming() {
    const data = JSON.stringify({ action: 'start_farming' });
    try {
      const response = await axios.post('https://game-domain.blum.codes/api/v1/farming/start', data, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      this.log(`Không thể bắt đầu farming: ${error.message}`, 'error');
      return null;
    }
  }

  async checkBalanceFriend() {
    try {
      const response = await axios.get(`https://gateway.blum.codes/v1/friends/balance`, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      this.log(`Không thể kiểm tra số dư bạn bè: ${error.message}`, 'error');
      return null;
    }
  }

  async claimBalanceFriend() {
    try {
      const response = await axios.post(`https://gateway.blum.codes/v1/friends/claim`, {}, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      this.log(`Không thể nhận số dư bạn bè!`, 'error');
      return null;
    }
  }

  async checkDailyReward() {
    try {
      const response = await axios.post('https://game-domain.blum.codes/api/v1/daily-reward?offset=-420', {}, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      this.log(`Hôm nay đã điểm danh rồi !`, 'error');
      return null;
    }
  }

  async Countdown(seconds, isShow = true) {
    for (let i = Math.floor(seconds); i >= 0; i--) {
      if(isShow){
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`[*] Chờ ${i} giây để tiếp tục...`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('');
  }

  async getTasks() {
    try {
      const response = await axios.get('https://game-domain.blum.codes/api/v1/tasks', { headers: await this.headers(this.token) });
      if (response.status === 200) {
        return response.data;
      } else {
        this.log('Không thể lấy danh sách nhiệm vụ', 'error');
        return [];
      }
    } catch (error) {
      this.log(`Không thể lấy danh sách nhiệm vụ: ${error.message}`, 'error');
      return [];
    }
  }

  async startTask(taskId) {
    try {
      const response = await axios.post(`https://game-domain.blum.codes/api/v1/tasks/${taskId}/start`, {}, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      this.log(`Không thể bắt đầu nhiệm vụ ${taskId}: ${error.message}`, 'error');
      return null;
    }
  }

  async claimTask(taskId) {
    try {
      const response = await axios.post(`https://game-domain.blum.codes/api/v1/tasks/${taskId}/claim`, {}, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
  }

  async main() {
    const dataFile = path.join(__dirname, 'data.txt');
    const queryIds = fs.readFileSync(dataFile, 'utf8')
        .replace(/\r/g, '')
        .split('\n')
        .filter(Boolean);

    // const nhiemvu = await this.askQuestion('Bạn có muốn làm nhiệm vụ không? (y/n): ');
    const hoinhiemvu = true

    while (true) {
      for (let i = 0; i < queryIds.length; i++) {
        this.queryId = queryIds[i];

        const token = await this.getNewToken();
        if (!token) {
          this.log('Không thể lấy token, bỏ qua tài khoản này', 'error');
          continue;
        }

        const userInfo = await this.getUserInfo();
        if (userInfo === null) {
          this.log('Không thể lấy thông tin người dùng, bỏ qua tài khoản này', 'error');
          continue;
        }

        console.log(`========== Tài khoản ${i + 1} | ${userInfo.username.green} ==========`);
        
        const balanceInfo = await this.getBalance();
        if (balanceInfo) {
            this.log('Đang lấy thông tin....', 'success');
            this.log(`Số dư: ${colors.yellow(balanceInfo.availableBalance)}`, 'success');
            this.log(`Vé chơi game: ${colors.yellow(balanceInfo.playPasses)}`, 'success');

            if (!balanceInfo.farming) {
                const farmingResult = await this.startFarming();
                if (farmingResult) {
                    this.log('Đã bắt đầu farming thành công!', 'success');
                }
            } else {
                const endTime = DateTime.fromMillis(balanceInfo.farming.endTime);
                const formattedEndTime = endTime.setZone('Asia/Ho_Chi_Minh').toFormat('dd/MM/yyyy HH:mm:ss');
                this.log(`Thời gian hoàn thành farm: ${colors.cyan(formattedEndTime)}`, 'success');
                if (i === 0) {
                  this.firstAccountEndTime = endTime;
                }
                const currentTime = DateTime.now();
                if (currentTime > endTime) {
                    const claimBalanceResult = await this.claimBalance();
                    if (claimBalanceResult) {
                        this.log('Claim farm thành công!', 'success');
                    }

                    const farmingResult = await this.startFarming();
                    if (farmingResult) {
                        this.log('Đã bắt đầu farming thành công!', 'success');
                    }
                } else {
                    const timeLeft = endTime.diff(currentTime).toFormat('hh:mm:ss');
                    this.log(`Thời gian còn lại để farming: ${colors.cyan(timeLeft)}`, 'success');
                }
            }
        } else {
            this.log('Không thể lấy thông tin số dư', 'error');
        }

        if (hoinhiemvu) {
          const taskListResponse = await this.getTasks();
          if (taskListResponse && Array.isArray(taskListResponse) && taskListResponse.length > 0) {
            let allTasks = taskListResponse.flatMap(section => section.tasks || []);
            this.log('Đã lấy danh sách nhiệm vụ', 'success');
            const excludedTaskId = "5daf7250-76cc-4851-ac44-4c7fdcfe5994";
            allTasks = allTasks.filter(task => task.id !== excludedTaskId && task?.kind === 'INITIAL' && !['STARTED','FINISHED'].includes(task?.status));
            console.log('[  QUEST  ] Nhiệm vụ có thể làm:', allTasks.length);
            for (const task of allTasks) {
              const { status } = task 
              if(status === 'READY_FOR_CLAIM'){
                const claimResult = await this.claimTask(task.id);
              if (claimResult && claimResult.status === "FINISHED") {
                readline.cursorTo(process.stdout, 0);
                process.stdout.write(`[  QUEST  ] ${colors.yellow(task.title)}: ${colors.green('Done !     ')}`);
                console.log();
                continue
              } else {
                readline.cursorTo(process.stdout, 0);
                process.stdout.write(`[  QUEST  ] ${colors.yellow(task.title)}: ${colors.red('Claim faild !     ')}`);
                console.log();
                continue
              }
              } else {
                const startResult = await this.startTask(task.id);
                if (startResult) {
                  readline.cursorTo(process.stdout, 0);
                  process.stdout.write(`[  QUEST  ] ${colors.yellow(task.title)}: ${colors.yellow('Starting...')}`);
                } else {
                  readline.cursorTo(process.stdout, 0);
                  process.stdout.write(`[  QUEST  ] ${colors.yellow(task.title)}: ${colors.red('Start Faild !')}`);
                  console.log();
                  continue;
                }
                await this.Countdown(3,false);
                const claimResult = await this.claimTask(task.id);
                if (claimResult && claimResult.status === "FINISHED") {
                  readline.cursorTo(process.stdout, 0);
                  process.stdout.write(`[  QUEST  ] ${colors.yellow(task.title)}: ${colors.green('Done !     ')}`);
                } else {
                  readline.cursorTo(process.stdout, 0);
                  process.stdout.write(`[  QUEST  ] ${colors.yellow(task.title)}: ${colors.red('Claim faild !     ')}`);
                }
                console.log();
              }
            }
          } else {
            this.log('Không thể lấy danh sách nhiệm vụ !', 'error');
          }
        }

        const dailyRewardResult = await this.checkDailyReward();
        if (dailyRewardResult) {
          this.log('Đã nhận phần thưởng hàng ngày!', 'success');
        }

        const friendBalanceInfo = await this.checkBalanceFriend();
        if (friendBalanceInfo) {
          this.log(`Số dư bạn bè: ${friendBalanceInfo.amountForClaim}`, 'success');
          if (friendBalanceInfo.amountForClaim > 0) {
            const claimFriendBalanceResult = await this.claimBalanceFriend();
            if (claimFriendBalanceResult) {
              this.log('Đã nhận số dư bạn bè thành công!', 'success');
            }
          } else {
            this.log('Không có số dư bạn bè để nhận!', 'success');
          }
        } else {
          this.log('Không thể kiểm tra số dư bạn bè!', 'error');
        }
        
        if (balanceInfo && balanceInfo.playPasses > 0) {
          for (let j = 0; j < balanceInfo.playPasses; j++) {
            const playResult = await this.playGame();
            if (playResult) {
              this.log(`Bắt đầu chơi game lần thứ ${j + 1}...`, 'success');
              await this.Countdown(30);
              const claimGameResult = await this.claimGame(2000);
              if (claimGameResult) {
                this.log(`Đã nhận phần thưởng game lần thứ ${j + 1} thành công!`, 'success');
              }
            } else {
              this.log(`Không thể chơi game lần thứ ${j + 1}`, 'error');
              break;
            }
          }
        } else {
          this.log('Không có vé chơi game', 'success');
        }

        this.log(`Hoàn thành xử lý tài khoản ${colors.cyan(userInfo.username)}`, 'success');
        console.log(''); 
      }

      if (this.firstAccountEndTime) {
        const currentTime = DateTime.now();
        const timeLeft = this.firstAccountEndTime.diff(currentTime).as('seconds');

        if (timeLeft > 0) {
          await this.Countdown(timeLeft);
        } else {
          this.log('Chờ 10 phút trước khi bắt đầu vòng mới...', 'success');
          await this.Countdown(600);
        }
      } else {
        this.log('Chờ 10 phút trước khi bắt đầu vòng mới...', 'success');
        await this.Countdown(600);
      }
    }
  }
}

if (require.main === module) {
  const gameBot = new GameBot();
  gameBot.main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
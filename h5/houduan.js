export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // --- 配置区 ---
    const CONFIG = {
      BACKEND_KEY: "F2BAE5A21F88F43C661764BCC4480700",
      DB_URL: "https://api.pgaot.com/dbs/v2/sql",
      RESEND_KEY: "re_6HiqDYLD_EXKfy6FwPHaR5gXqT18gk4Y2",
      TABLES: {
        USER: "9dc348ceb5bb3b335c5dc99a088b9448",
        APP: "4a4e8878f626bebee7979d4c733d36c9",
        COMMENT: "78a9128dfdbc722a161b2a1cde2669e3",
        MSG: "23348ea6c3f968762d8f539e7305c6cd",
        COIN_LOG: "dadf9495910a03f4930ced1eabf44441"
      }
    };

    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");
    const clientIp = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

    // 辅助工具：转义单引号和处理特殊字符
    const setMarks = (text) => {
      const str = String(text || "");
      // 转义单引号
      return str.replace(/'/g, "~PGDBSD~");
    };

    // 核心函数：执行 SQL
    const executeSql = async (sql) => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const bodyString = JSON.stringify({ sql });
      const sign = await md5(bodyString + timestamp + CONFIG.BACKEND_KEY);

      const res = await fetch(CONFIG.DB_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "X-Pgaot-Key": CONFIG.BACKEND_KEY,
          "X-Pgaot-Time": timestamp,
          "X-Pgaot-Sign": sign,
        },
        body: bodyString
      });
      return await res.json();
    };

    try {
      // --- 关键修复：body只能读取一次 ---
      let body = {};
      const contentType = request.headers.get("Content-Type") || "";
      
      // 打印调试信息
      console.log('请求模式:', mode);
      console.log('请求方法:', request.method);
      console.log('Content-Type:', contentType);
      
      // 只有在非上传模式且是 POST 时尝试解析 JSON
      if (request.method === "POST" && mode !== "upload_meituan") {
        try {
          body = await request.json();
          console.log('解析后的body:', body);
        } catch (e) {
          console.error('解析body失败:', e);
          // 如果解析失败，保持body为空对象
        }
      }

      // --- IP 安全校验逻辑 ---
      const skipCheck = ["login", "register", "check_email", "send_mail", "upload_meituan", "get_pending_apps"];
      if (!skipCheck.includes(mode)) {
        const mail = body.mail || url.searchParams.get("mail");
        console.log('获取到的mail:', mail);
        if (!mail) return new Response(JSON.stringify({ code: 400, msg: "缺少必要身份参数" }), { headers: corsHeaders });
        
        const checkRes = await executeSql(`SELECT \`最近ip\` FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(mail)}' LIMIT 1`);
        console.log('IP校验结果:', checkRes);
        
        if (checkRes.fields && checkRes.fields.length > 0) {
          const lastIp = checkRes.fields[0]["最近ip"];
          console.log('数据库中的最近IP:', lastIp);
          console.log('客户端IP:', clientIp);
          if (!lastIp || lastIp !== clientIp) {
            return new Response(JSON.stringify({ code: 403, msg: "账号环境异常，请勿多端登录" }), { headers: corsHeaders });
          }
        } else {
          return new Response(JSON.stringify({ code: 404, msg: "用户身份失效" }), { headers: corsHeaders });
        }
      }

      // --- 路由逻辑 ---
      
      // 1. 登录
      if (mode === "login") {
        const { email, password } = body;
        const loginSql = `SELECT 邮箱,昵称,头像,个性签名,积分 FROM \`${CONFIG.TABLES.USER}\` WHERE 邮箱='${setMarks(email)}' AND 密码='${setMarks(password)}' LIMIT 1`;
        const res = await executeSql(loginSql);
        
        if (res.fields && res.fields.length > 0) {
          await executeSql(`UPDATE \`${CONFIG.TABLES.USER}\` SET \`最近ip\`='${clientIp}' WHERE \`邮箱\`='${setMarks(email)}'`);
        }
        return new Response(JSON.stringify(res), { headers: corsHeaders });
      }

      // 2. 检查邮箱
      if (mode === "check_email") {
        const { email } = body;
        const res = await executeSql(`SELECT id FROM \`${CONFIG.TABLES.USER}\` WHERE 邮箱='${setMarks(email)}' LIMIT 1`);
        return new Response(JSON.stringify(res), { headers: corsHeaders });
      }

      // 3. 发送邮件
      if (mode === "send_mail") {
        // 兼容性修改：优先从 body 拿，拿不到就从 URL 参数拿
        const to = body.to || body.email || url.searchParams.get("to") || url.searchParams.get("email");
        const code = body.code || url.searchParams.get("code");

        if (!to || !code) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少收件人(to/email)或验证码(code)" }), { headers: corsHeaders });
        }

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${CONFIG.RESEND_KEY}`, 
            "Content-Type": "application/json" 
          },
          body: JSON.stringify({
            from: "趣加应用 <no-reply@upadates.qujiaweb.top>",
            to: [to],
            subject: "【趣加应用】验证码：" + code,
            html: `<p>您的验证码是：<strong>${code}</strong></p><p>若非本人操作请忽略此邮件。</p>`
          }),
        });

        const resendData = await resendRes.json();
        
        // 关键：将 Resend 的真实状态返回给前端，方便调试
        if (resendRes.ok) {
          return new Response(JSON.stringify({ code: 200, msg: "发送成功", id: resendData.id }), { headers: corsHeaders });
        } else {
          return new Response(JSON.stringify({ code: resendRes.status, msg: "邮件接口报错", error: resendData }), { headers: corsHeaders });
        }
      }

      // 4. 注册接口
      if (mode === "register") {
        const { email, password, nickname } = body;
        
        if (!email || !password || !nickname) {
          return new Response(JSON.stringify({ code: 400, msg: "提交数据不完整" }), { headers: corsHeaders });
        }

        try {
          const currentTimestamp = Math.floor(Date.now() / 1000);
          const sql = `INSERT INTO \`${CONFIG.TABLES.USER}\` (
            邮箱, 密码, 昵称, 最近ip, 积分, createdAt, updatedAt
          ) VALUES (
            '${setMarks(email.toLowerCase())}', 
            '${setMarks(password)}', 
            '${setMarks(nickname)}', 
            '${clientIp}', 
            0, 
            '${currentTimestamp}', 
            '${currentTimestamp}'
          )`;
          const res = await executeSql(sql);
          return new Response(JSON.stringify(res), { headers: corsHeaders });
        } catch (error) {
          console.error('注册失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "注册失败：" + error.message }), { headers: corsHeaders });
        }
      }

      // 4. 美团存储上传 (修复的核心部分)
      if (mode === "upload_meituan") {
        const formData = await request.formData();
        const file = formData.get('file');
        if (!file) return new Response(JSON.stringify({ code: 0, msg: "未接收到文件" }), { headers: corsHeaders });

        const fileExt = file.name.split('.').pop();
        const fileName = `mt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const targetUrl = `https://db0ai4hqk7tsfy.database.nocode.cn/storage/v1/object/qujia/${fileName}`;

        const mtFormData = new FormData();
        mtFormData.append('file', file);

        const mtRes = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ2OTc5MjAwLCJleHAiOjE5MDQ3NDU2MDB9.l97FzKmUFm2tNHQYRhFUe9P12ndi7Th6cnYGoDENosI',
            'Origin': 'https://instant-file-sharing.nocode.host',
            'Referer': 'https://instant-file-sharing.nocode.host/',
          },
          body: mtFormData
        });

        const mtJson = await mtRes.json();
        if (mtJson.Key) mtJson.full_url = `https://db0ai4hqk7tsfy.database.nocode.cn/storage/v1/object/public/qujia/${fileName}`;
        return new Response(JSON.stringify(mtJson), { headers: corsHeaders });
      }

      // 5. 获取用户信息
      if (mode === "get_user_info") {
        const mail = body.mail || url.searchParams.get("mail");
        const res = await executeSql(`SELECT 昵称,头像,个性签名,积分,背景图片,是否管理 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(mail)}' LIMIT 1`);
        return new Response(JSON.stringify(res), { headers: corsHeaders });
      }

      // 6. 管理员身份检查
      if (mode === "check_admin") {
        const mail = body.mail || url.searchParams.get("mail");
        const res = await executeSql(`SELECT 昵称,头像,个性签名,积分,背景图片,是否管理 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(mail)}' AND \`是否管理\`='是' LIMIT 1`);
        
        // 添加0.5秒延迟
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (res.fields && res.fields.length > 0) {
          return new Response(JSON.stringify(res), { headers: corsHeaders });
        } else {
          return new Response(JSON.stringify({ code: 403, msg: "不是管理" }), { headers: corsHeaders });
        }
      }

      // 6. 获取其他用户信息
      if (mode === "get_other_user_info") {
        const mail = body.mail || url.searchParams.get("mail");
        const user = body.user || url.searchParams.get("user");
        if (!user) return new Response(JSON.stringify({ code: 400, msg: "缺少查询用户参数" }), { headers: corsHeaders });
        const res = await executeSql(`SELECT 昵称,头像,个性签名,积分,背景图片 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(user)}' LIMIT 1`);
        return new Response(JSON.stringify(res), { headers: corsHeaders });
      }

      // 6. 获取应用列表
      if (mode === "get_apps" || mode === "get_app_list") {
        const filter = url.searchParams.get("filter") || "";
        let sql = "";
        if (filter === "latest") {
          sql = `SELECT id, 名称, 图标, 简介 FROM \`${CONFIG.TABLES.APP}\` WHERE \`是否推荐\`='推荐' ORDER BY createdAt DESC LIMIT 50`;
        } else if (filter === "rank") {
          sql = `SELECT id, 名称, 图标, 简介 FROM \`${CONFIG.TABLES.APP}\` WHERE \`积分\`>10 ORDER BY \`积分\` DESC LIMIT 50`;
        } else if (["影视音乐", "实用工具", "娱乐游戏", "学习必备", "社交生活"].includes(filter)) {
          sql = `SELECT id, 名称, 图标, 简介 FROM \`${CONFIG.TABLES.APP}\` WHERE \`分类\`='${setMarks(filter)}' AND \`是否推荐\`='推荐' ORDER BY createdAt DESC LIMIT 50`;
        } else {
          sql = `SELECT id, 名称, 图标, 简介 FROM \`${CONFIG.TABLES.APP}\` WHERE \`星标排行\`='星标' ORDER BY RAND() LIMIT 50`;
        }
        const res = await executeSql(sql);
        return new Response(JSON.stringify(res), { headers: corsHeaders });
      }
      
      // 7. 获取用户分享的应用
      if (mode === "get_user_apps") {
        const mail = body.mail || url.searchParams.get("mail");
        if (!mail) return new Response(JSON.stringify({ code: 400, msg: "缺少必要身份参数" }), { headers: corsHeaders });
        const res = await executeSql(`SELECT id, 名称, 图标, 简介, 是否推荐 FROM \`${CONFIG.TABLES.APP}\` WHERE \`邮箱\`='${setMarks(mail)}' ORDER BY createdAt DESC LIMIT 9999`);
        return new Response(JSON.stringify(res), { headers: corsHeaders });
      }

      // 8. 获取其他用户分享的应用
      if (mode === "get_other_user_apps") {
        const mail = body.mail || url.searchParams.get("mail");
        const user = body.user || url.searchParams.get("user");
        if (!user) return new Response(JSON.stringify({ code: 400, msg: "缺少查询用户参数" }), { headers: corsHeaders });
        const res = await executeSql(`SELECT id, 名称, 图标, 简介 FROM \`${CONFIG.TABLES.APP}\` WHERE \`邮箱\`='${setMarks(user)}' AND \`是否推荐\`='推荐' ORDER BY createdAt DESC LIMIT 9999`);
        return new Response(JSON.stringify(res), { headers: corsHeaders });
      }
      
      // 9. 获取待审核应用列表
      if (mode === "get_pending_apps") {
        const res = await executeSql(`SELECT id, 名称, 图标, 简介, 邮箱, 用户 FROM \`${CONFIG.TABLES.APP}\` WHERE \`是否推荐\`='待审核' ORDER BY createdAt DESC LIMIT 100`);
        return new Response(JSON.stringify(res), { headers: corsHeaders });
      }
      
      // 10. 获取应用详情
      if (mode === "get_app_detail") {
        const appId = url.searchParams.get("id") || "";
        if (!appId) return new Response(JSON.stringify({ code: 400, msg: "缺少应用ID参数" }), { headers: corsHeaders });
        const res = await executeSql(`SELECT * FROM \`${CONFIG.TABLES.APP}\` WHERE id='${setMarks(appId)}' AND \`是否推荐\`!='未通过' LIMIT 1`);
        // 如果没有数据，返回"该应用已被删除"的提示
        if (!res.fields || res.fields.length === 0) {
          return new Response(JSON.stringify({ code: 404, msg: "该应用已被删除", fields: [] }), { headers: corsHeaders });
        }
        return new Response(JSON.stringify(res), { headers: corsHeaders });
      }
      
      // 9. 搜索应用
      if (mode === "search_apps") {
        const keyword = url.searchParams.get("keyword") || "";
        if (!keyword) return new Response(JSON.stringify({ code: 400, msg: "缺少搜索关键词" }), { headers: corsHeaders });
        const res = await executeSql(`SELECT id, 名称, 图标, 简介 FROM \`${CONFIG.TABLES.APP}\` WHERE \`名称\` LIKE '%${setMarks(keyword)}%' AND \`是否推荐\`='推荐' ORDER BY createdAt DESC LIMIT 50`);
        return new Response(JSON.stringify(res), { headers: corsHeaders });
      }
      
      // 10. 新增应用
      if (mode === "add_app") {
        const { name, link, icon, intro, images, is_recommended, password, user, mail, category, package_name, version, size, arch, android_version } = body;
        
        // 验证必填字段
        if (!name || !link || !icon || !intro || !images || !user || !mail || !category || !package_name || !version || !size || !arch || !android_version) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        // 生成新ID（使用时间戳和随机数）
        const newId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        // 构建SQL插入语句
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const sql = `INSERT INTO \`${CONFIG.TABLES.APP}\` (
          id, 名称, 链接, 图标, 简介, 图片, 是否推荐, 密码, 用户, 邮箱, 分类, 星标排行, 积分, 时间, 包名, 版本, 大小, 位数, 安卓版本, createdAt, updatedAt
        ) VALUES (
          '${setMarks(newId)}', 
          '${setMarks(name)}', 
          '${setMarks(link)}', 
          '${setMarks(icon)}', 
          '${setMarks(intro)}', 
          '${setMarks(images)}', 
          '${setMarks(is_recommended || "待审核")}', 
          '${setMarks(password || "")}', 
          '${setMarks(user)}', 
          '${setMarks(mail)}', 
          '${setMarks(category)}', 
          '${setMarks("")}', 
          '${setMarks(0)}', 
          '${setMarks(currentTimestamp)}', 
          '${setMarks(package_name)}', 
          '${setMarks(version)}', 
          '${setMarks(size)}', 
          '${setMarks(arch)}', 
          '${setMarks(android_version)}',
          '${currentTimestamp}',
          '${currentTimestamp}'
        )`;
        console.log('执行的SQL语句:', sql);
        
        try {
          const res = await executeSql(sql);
          console.log('SQL执行结果:', res);
          // 检查执行结果
          if (res.code === 200) {
            // 检查用户今天是否上传了10个资源
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
            const todayStart = `${todayStr} 00:00:00`;
            const todayEnd = `${todayStr} 23:59:59`;
            
            // 查询用户今天上传的资源数量
            const uploadCountRes = await executeSql(`SELECT * FROM \`${CONFIG.TABLES.COIN_LOG}\` WHERE \`邮箱\`='${setMarks(mail)}' AND \`类型\`='上传资源奖励' AND \`时间\` >= '${setMarks(todayStart)}' AND \`时间\` <= '${setMarks(todayEnd)}'`);
            const uploadCount = uploadCountRes.fields ? uploadCountRes.fields.length : 0;
            
            // 如果用户今天上传的资源数量小于10，则给用户加10积分
            if (uploadCount < 10) {
              // 获取用户当前积分
              const userInfoRes = await executeSql(`SELECT 积分 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(mail)}' LIMIT 1`);
              if (userInfoRes.fields && userInfoRes.fields.length > 0) {
                const currentUserCoin = parseInt(userInfoRes.fields[0].积分 || 0);
                const timestamp = Math.floor(Date.now() / 1000);
                // 增加8小时，解决时区问题
                now.setHours(now.getHours() + 8);
                const timeStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                
                // 新增积分明细
                await executeSql(`INSERT INTO \`${CONFIG.TABLES.COIN_LOG}\` (邮箱, 类型, 积分变动, 时间, appid, createdAt, updatedAt) VALUES ('${setMarks(mail)}', '上传资源奖励', '+10', '${setMarks(timeStr)}', '', '${timestamp}', '${timestamp}')`);
                
                // 更新用户积分
                await executeSql(`UPDATE \`${CONFIG.TABLES.USER}\` SET \`积分\`='${currentUserCoin + 10}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(mail)}'`);
              }
            }
            
            return new Response(JSON.stringify({ code: 200, msg: "应用添加成功", app_id: newId }), { headers: corsHeaders });
          } else {
            return new Response(JSON.stringify({ code: 500, msg: "添加失败：" + (res.msg || "未知错误") }), { headers: corsHeaders });
          }
        } catch (error) {
          console.error('SQL执行错误:', error);
          return new Response(JSON.stringify({ code: 500, msg: "添加失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 11. 提交评论
      if (mode === "submit_comment") {
        const { appid, content, images, mail, rating } = body;
        
        // 验证必填字段
        if (!appid || !content || !mail || !rating) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        // 获取用户信息
        const userInfo = await executeSql(`SELECT 昵称, 头像 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(mail)}' LIMIT 1`);
        if (!userInfo.fields || userInfo.fields.length === 0) {
          return new Response(JSON.stringify({ code: 404, msg: "用户不存在" }), { headers: corsHeaders });
        }
        
        const user = userInfo.fields[0];
        const currentTimestamp = Math.floor(Date.now() / 1000);
        
        // 构建SQL插入语句
        const sql = `INSERT INTO \`${CONFIG.TABLES.COMMENT}\` (
          用户, 时间, 图片, 内容, 头像, 邮箱, appid, 点赞数, 评分, rootid, parentid, createdAt, updatedAt
        ) VALUES (
          '${setMarks(user.昵称)}', 
          '${setMarks(currentTimestamp)}', 
          '${setMarks(images || "")}', 
          '${setMarks(content)}', 
          '${setMarks(user.头像 || "")}', 
          '${setMarks(mail)}', 
          '${setMarks(appid)}', 
          '${setMarks(0)}', 
          '${setMarks(rating)}', 
          '${setMarks("")}', 
          '${setMarks("")}',
          '${currentTimestamp}',
          '${currentTimestamp}'
        )`;
        
        try {
          const res = await executeSql(sql);
          if (res.code === 200) {
            // 获取应用信息，找到应用分享人的邮箱
            const appInfoRes = await executeSql(`SELECT 邮箱, 名称 FROM \`${CONFIG.TABLES.APP}\` WHERE id='${setMarks(appid)}' LIMIT 1`);
            if (appInfoRes.fields && appInfoRes.fields.length > 0) {
              const appOwnerMail = appInfoRes.fields[0].邮箱;
              const appName = appInfoRes.fields[0].名称;
              
              // 确保应用分享人不是评论者自己
              if (appOwnerMail !== mail) {
                // 给应用分享人发送消息
                const msgSql = `INSERT INTO \`${CONFIG.TABLES.MSG}\` (发起人邮箱, 发起人昵称, 发起人头像, 发起人内容, 接受人邮箱, 时间, appid, rootid, parentid, 是否删除, 是否已读, 类型, createdAt, updatedAt) VALUES (
                  '${setMarks(mail)}', 
                  '${setMarks(user.昵称)}', 
                  '${setMarks(user.头像 || '')}', 
                  '${setMarks(content)}', 
                  '${setMarks(appOwnerMail)}', 
                  '${currentTimestamp}', 
                  '${setMarks(appid)}', 
                  '', 
                  '', 
                  '否', 
                  '否', 
                  '评论', 
                  '${currentTimestamp}', 
                  '${currentTimestamp}'
                )`;
                await executeSql(msgSql);
              }
            }
            return new Response(JSON.stringify({ code: 200, msg: "评论提交成功" }), { headers: corsHeaders });
          } else {
            return new Response(JSON.stringify({ code: 500, msg: "评论提交失败：" + (res.msg || "未知错误") }), { headers: corsHeaders });
          }
        } catch (error) {
          console.error('提交评论失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "评论提交失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 12. 获取应用评论
      if (mode === "get_app_comments") {
        const appid = url.searchParams.get("appid") || "";
        if (!appid) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少应用ID" }), { headers: corsHeaders });
        }
        
        const sql = `SELECT 用户, 时间, 图片, 内容, 头像, 邮箱, appid, 点赞数, 评分, rootid, parentid, createdAt FROM \`${CONFIG.TABLES.COMMENT}\` WHERE \`appid\`='${setMarks(appid)}' ORDER BY \`时间\` DESC LIMIT 100`;
        
        try {
          const res = await executeSql(sql);
          return new Response(JSON.stringify(res), { headers: corsHeaders });
        } catch (error) {
          console.error('获取评论失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "获取评论失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 13. 删除评论
      if (mode === "delete_comment") {
        console.log('删除评论请求:', { body, url: url.searchParams });
        const { comment_id, mail } = body;
        
        // 验证必填字段
        if (!comment_id || !mail) {
          console.log('缺少必要字段:', { comment_id, mail });
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        // 验证评论是否存在且属于该用户
        console.log('检查评论权限，comment_id:', comment_id, 'mail:', mail);
        console.log('评论表名:', CONFIG.TABLES.COMMENT);
        
        // 先尝试使用时间字段查询（因为前端传递的是时间字段值）
        const checkSqlByTime = `SELECT * FROM \`${CONFIG.TABLES.COMMENT}\` WHERE \`时间\`='${setMarks(comment_id)}' LIMIT 1`;
        console.log('执行根据时间检查SQL:', checkSqlByTime);
        const checkResByTime = await executeSql(checkSqlByTime);
        console.log('根据时间检查结果:', checkResByTime);
        
        let commentData = null;
        if (checkResByTime.fields && checkResByTime.fields.length > 0) {
          commentData = checkResByTime.fields[0];
          console.log('通过时间字段找到评论:', commentData);
        } else {
          // 如果通过时间找不到，再尝试使用createdAt字段查询
          const checkSqlByCreatedAt = `SELECT * FROM \`${CONFIG.TABLES.COMMENT}\` WHERE createdAt='${setMarks(comment_id)}' LIMIT 1`;
          console.log('执行根据createdAt检查SQL:', checkSqlByCreatedAt);
          const checkResByCreatedAt = await executeSql(checkSqlByCreatedAt);
          console.log('根据createdAt检查结果:', checkResByCreatedAt);
          
          if (checkResByCreatedAt.fields && checkResByCreatedAt.fields.length > 0) {
            commentData = checkResByCreatedAt.fields[0];
            console.log('通过createdAt找到评论:', commentData);
          }
        }
        
        if (!commentData) {
          console.log('评论不存在，comment_id:', comment_id);
          return new Response(JSON.stringify({ code: 404, msg: "评论不存在或无权限删除" }), { headers: corsHeaders });
        }
        
        // 检查邮箱是否匹配（忽略大小写）
        const commentMail = commentData.邮箱;
        console.log('评论邮箱:', commentMail, '请求邮箱:', mail);
        if (commentMail.toLowerCase() !== mail.toLowerCase()) {
          console.log('邮箱不匹配，无权限删除');
          return new Response(JSON.stringify({ code: 404, msg: "评论不存在或无权限删除" }), { headers: corsHeaders });
        }
        
        // 执行删除操作（根据时间字段删除，因为时间字段是唯一的）
        const deleteSql = `DELETE FROM \`${CONFIG.TABLES.COMMENT}\` WHERE \`时间\`='${setMarks(commentData.时间)}'`;
        console.log('执行删除SQL:', deleteSql);
        
        try {
          const res = await executeSql(deleteSql);
          console.log('删除结果:', res);
          return new Response(JSON.stringify({ code: 200, msg: "删除成功" }), { headers: corsHeaders });
        } catch (error) {
          console.error('删除评论失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "删除失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 18. 提交回复
      if (mode === "submit_reply") {
        const { appid, content, images, mail, target_user, target_mail, parentid, rootid } = body;
        
        // 验证必填字段
        if (!appid || !content || !mail || !target_mail || !parentid) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        // 获取用户信息
        const userInfo = await executeSql(`SELECT 昵称, 头像 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(mail)}' LIMIT 1`);
        if (!userInfo.fields || userInfo.fields.length === 0) {
          return new Response(JSON.stringify({ code: 404, msg: "用户不存在" }), { headers: corsHeaders });
        }
        
        const user = userInfo.fields[0];
        const currentTimestamp = Math.floor(Date.now() / 1000);
        
        // 构建SQL插入语句
        const sql = `INSERT INTO \`${CONFIG.TABLES.COMMENT}\` (
          用户, 时间, 图片, 内容, 头像, 邮箱, appid, 点赞数, 评分, rootid, parentid, createdAt, updatedAt
        ) VALUES (
          '${setMarks(user.昵称)}', 
          '${setMarks(currentTimestamp)}', 
          '${setMarks(images || "")}', 
          '${setMarks(content)}', 
          '${setMarks(user.头像 || "")}', 
          '${setMarks(mail)}', 
          '${setMarks(appid)}', 
          '${setMarks(0)}', 
          '${setMarks("")}', 
          '${setMarks(rootid || parentid)}', 
          '${setMarks(parentid)}',
          '${currentTimestamp}',
          '${currentTimestamp}'
        )`;
        
        try {
          const res = await executeSql(sql);
          if (res.code === 200) {
            // 给被回复人发送消息
            const msgSql = `INSERT INTO \`${CONFIG.TABLES.MSG}\` (发起人邮箱, 发起人昵称, 发起人头像, 发起人内容, 接受人邮箱, 时间, appid, rootid, parentid, 是否删除, 是否已读, 类型, createdAt, updatedAt) VALUES (
              '${setMarks(mail)}', 
              '${setMarks(user.昵称)}', 
              '${setMarks(user.头像 || '')}', 
              '${setMarks(content)}', 
              '${setMarks(target_mail)}', 
              '${currentTimestamp}', 
              '${setMarks(appid)}', 
              '${setMarks(rootid || parentid)}', 
              '${setMarks(parentid)}', 
              '否', 
              '否', 
              '回复', 
              '${currentTimestamp}', 
              '${currentTimestamp}'
            )`;
            await executeSql(msgSql);
            
            return new Response(JSON.stringify({ code: 200, msg: "回复提交成功" }), { headers: corsHeaders });
          } else {
            return new Response(JSON.stringify({ code: 500, msg: "回复提交失败：" + (res.msg || "未知错误") }), { headers: corsHeaders });
          }
        } catch (error) {
          console.error('提交回复失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "回复提交失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 14. 投1积分
      if (mode === "coin_1") {
        const { mail, appid } = body;
        
        // 验证必填字段
        if (!mail || !appid) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          // 1. 获取应用信息
          const appInfoRes = await executeSql(`SELECT 名称, 邮箱, 积分 FROM \`${CONFIG.TABLES.APP}\` WHERE id='${setMarks(appid)}' LIMIT 1`);
          if (!appInfoRes.fields || appInfoRes.fields.length === 0) {
            return new Response(JSON.stringify({ code: 404, msg: "应用不存在" }), { headers: corsHeaders });
          }
          
          const app = appInfoRes.fields[0];
          const appOwnerMail = app.邮箱;
          const appName = app.名称;
          const currentAppCoin = parseInt(app.积分 || 0);
          
          // 2. 检查是否是自己的应用
          if (appOwnerMail === mail) {
            return new Response(JSON.stringify({ code: 400, msg: "不能给自己的应用投币" }), { headers: corsHeaders });
          }
          
          // 3. 检查用户是否已经投过币
          const coinLogRes = await executeSql(`SELECT * FROM \`${CONFIG.TABLES.COIN_LOG}\` WHERE \`邮箱\`='${setMarks(mail)}' AND \`appid\`='${setMarks(appid)}' LIMIT 1`);
          if (coinLogRes.fields && coinLogRes.fields.length > 0) {
            return new Response(JSON.stringify({ code: 400, msg: "您已投过币了" }), { headers: corsHeaders });
          }
          
          // 4. 获取投币用户信息
          const userInfoRes = await executeSql(`SELECT 昵称, 头像, 积分 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(mail)}' LIMIT 1`);
          if (!userInfoRes.fields || userInfoRes.fields.length === 0) {
            return new Response(JSON.stringify({ code: 404, msg: "用户不存在" }), { headers: corsHeaders });
          }
          
          const user = userInfoRes.fields[0];
          const userName = user.昵称;
          const userAvatar = user.头像;
          const currentUserCoin = parseInt(user.积分 || 0);
          
          // 5. 检查用户积分是否足够
          if (currentUserCoin < 1) {
            return new Response(JSON.stringify({ code: 400, msg: "积分不足" }), { headers: corsHeaders });
          }
          
          // 6. 获取被投人信息
          const ownerInfoRes = await executeSql(`SELECT 积分 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(appOwnerMail)}' LIMIT 1`);
          if (!ownerInfoRes.fields || ownerInfoRes.fields.length === 0) {
            return new Response(JSON.stringify({ code: 404, msg: "应用主人不存在" }), { headers: corsHeaders });
          }
          
          const currentOwnerCoin = parseInt(ownerInfoRes.fields[0].积分 || 0);
          
          // 7. 构建时间字符串（增加8小时，解决时区问题）
          const now = new Date();
          now.setHours(now.getHours() + 8);
          const timeStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          const timestamp = Math.floor(Date.now() / 1000);
          
          // 8. 开始事务操作
          // 8.1 新增投币人积分明细
          await executeSql(`INSERT INTO \`${CONFIG.TABLES.COIN_LOG}\` (邮箱, 类型, 积分变动, 时间, appid, createdAt, updatedAt) VALUES ('${setMarks(mail)}', '投币', '-1', '${setMarks(timeStr)}', '${setMarks(appid)}', '${timestamp}', '${timestamp}')`);
          
          // 8.2 新增被投人积分明细
          await executeSql(`INSERT INTO \`${CONFIG.TABLES.COIN_LOG}\` (邮箱, 类型, 积分变动, 时间, appid, createdAt, updatedAt) VALUES ('${setMarks(appOwnerMail)}', '收到投币', '+1', '${setMarks(timeStr)}', '${setMarks(appid)}', '${timestamp}', '${timestamp}')`);
          
          // 8.3 更新应用积分
          await executeSql(`UPDATE \`${CONFIG.TABLES.APP}\` SET \`积分\`='${currentAppCoin + 1}', updatedAt='${timestamp}' WHERE id='${setMarks(appid)}'`);
          
          // 8.4 更新投币人积分
          await executeSql(`UPDATE \`${CONFIG.TABLES.USER}\` SET \`积分\`='${currentUserCoin - 1}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(mail)}'`);
          
          // 8.5 更新被投人积分
          await executeSql(`UPDATE \`${CONFIG.TABLES.USER}\` SET \`积分\`='${currentOwnerCoin + 1}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(appOwnerMail)}'`);
          
          // 8.6 新增消息
          await executeSql(`INSERT INTO \`${CONFIG.TABLES.MSG}\` (发起人邮箱, 发起人昵称, 发起人头像, 发起人内容, 接受人邮箱, 时间, appid, rootid, parentid, 是否删除, 是否已读, 类型, createdAt, updatedAt) VALUES ('${setMarks(mail)}', '${setMarks(userName)}', '${setMarks(userAvatar || '')}', '给你分享的《${setMarks(appName)}》投了1个积分', '${setMarks(appOwnerMail)}', '${timestamp}', '${setMarks(appid)}', '', '', '否', '否', '投币', '${timestamp}', '${timestamp}')`);
          
          return new Response(JSON.stringify({ code: 200, msg: "投币成功" }), { headers: corsHeaders });
          
        } catch (error) {
          console.error('投币失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "投币失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 15. 投2积分
      if (mode === "coin_2") {
        const { mail, appid } = body;
        
        // 验证必填字段
        if (!mail || !appid) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          // 1. 获取应用信息
          const appInfoRes = await executeSql(`SELECT 名称, 邮箱, 积分 FROM \`${CONFIG.TABLES.APP}\` WHERE id='${setMarks(appid)}' LIMIT 1`);
          if (!appInfoRes.fields || appInfoRes.fields.length === 0) {
            return new Response(JSON.stringify({ code: 404, msg: "应用不存在" }), { headers: corsHeaders });
          }
          
          const app = appInfoRes.fields[0];
          const appOwnerMail = app.邮箱;
          const appName = app.名称;
          const currentAppCoin = parseInt(app.积分 || 0);
          
          // 2. 检查是否是自己的应用
          if (appOwnerMail === mail) {
            return new Response(JSON.stringify({ code: 400, msg: "不能给自己的应用投币" }), { headers: corsHeaders });
          }
          
          // 3. 检查用户是否已经投过币
          const coinLogRes = await executeSql(`SELECT * FROM \`${CONFIG.TABLES.COIN_LOG}\` WHERE \`邮箱\`='${setMarks(mail)}' AND \`appid\`='${setMarks(appid)}' LIMIT 1`);
          if (coinLogRes.fields && coinLogRes.fields.length > 0) {
            return new Response(JSON.stringify({ code: 400, msg: "您已投过币了" }), { headers: corsHeaders });
          }
          
          // 4. 获取投币用户信息
          const userInfoRes = await executeSql(`SELECT 昵称, 头像, 积分 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(mail)}' LIMIT 1`);
          if (!userInfoRes.fields || userInfoRes.fields.length === 0) {
            return new Response(JSON.stringify({ code: 404, msg: "用户不存在" }), { headers: corsHeaders });
          }
          
          const user = userInfoRes.fields[0];
          const userName = user.昵称;
          const userAvatar = user.头像;
          const currentUserCoin = parseInt(user.积分 || 0);
          
          // 5. 检查用户积分是否足够
          if (currentUserCoin < 2) {
            return new Response(JSON.stringify({ code: 400, msg: "积分不足" }), { headers: corsHeaders });
          }
          
          // 6. 获取被投人信息
          const ownerInfoRes = await executeSql(`SELECT 积分 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(appOwnerMail)}' LIMIT 1`);
          if (!ownerInfoRes.fields || ownerInfoRes.fields.length === 0) {
            return new Response(JSON.stringify({ code: 404, msg: "应用主人不存在" }), { headers: corsHeaders });
          }
          
          const currentOwnerCoin = parseInt(ownerInfoRes.fields[0].积分 || 0);
          
          // 7. 构建时间字符串（增加8小时，解决时区问题）
          const now = new Date();
          now.setHours(now.getHours() + 8);
          const timeStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          const timestamp = Math.floor(Date.now() / 1000);
          
          // 8. 开始事务操作
          // 8.1 新增投币人积分明细
          await executeSql(`INSERT INTO \`${CONFIG.TABLES.COIN_LOG}\` (邮箱, 类型, 积分变动, 时间, appid, createdAt, updatedAt) VALUES ('${setMarks(mail)}', '投币', '-2', '${setMarks(timeStr)}', '${setMarks(appid)}', '${timestamp}', '${timestamp}')`);
          
          // 8.2 新增被投人积分明细
          await executeSql(`INSERT INTO \`${CONFIG.TABLES.COIN_LOG}\` (邮箱, 类型, 积分变动, 时间, appid, createdAt, updatedAt) VALUES ('${setMarks(appOwnerMail)}', '收到投币', '+2', '${setMarks(timeStr)}', '${setMarks(appid)}', '${timestamp}', '${timestamp}')`);
          
          // 8.3 更新应用积分
          await executeSql(`UPDATE \`${CONFIG.TABLES.APP}\` SET \`积分\`='${currentAppCoin + 2}', updatedAt='${timestamp}' WHERE id='${setMarks(appid)}'`);
          
          // 8.4 更新投币人积分
          await executeSql(`UPDATE \`${CONFIG.TABLES.USER}\` SET \`积分\`='${currentUserCoin - 2}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(mail)}'`);
          
          // 8.5 更新被投人积分
          await executeSql(`UPDATE \`${CONFIG.TABLES.USER}\` SET \`积分\`='${currentOwnerCoin + 2}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(appOwnerMail)}'`);
          
          // 8.6 新增消息
          await executeSql(`INSERT INTO \`${CONFIG.TABLES.MSG}\` (发起人邮箱, 发起人昵称, 发起人头像, 发起人内容, 接受人邮箱, 时间, appid, rootid, parentid, 是否删除, 是否已读, 类型, createdAt, updatedAt) VALUES ('${setMarks(mail)}', '${setMarks(userName)}', '${setMarks(userAvatar || '')}', '给你分享的《${setMarks(appName)}》投了2个积分', '${setMarks(appOwnerMail)}', '${timestamp}', '${setMarks(appid)}', '', '', '否', '否', '投币', '${timestamp}', '${timestamp}')`);
          
          return new Response(JSON.stringify({ code: 200, msg: "投币成功" }), { headers: corsHeaders });
          
        } catch (error) {
          console.error('投币失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "投币失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 16. 获取积分明细
      if (mode === "get_coin_log") {
        const mail = body.mail || url.searchParams.get("mail");
        
        // 验证必填字段
        if (!mail) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          // 计算30天前的日期
          const now = new Date();
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const thirtyDaysAgoStr = `${thirtyDaysAgo.getFullYear()}-${(thirtyDaysAgo.getMonth() + 1).toString().padStart(2, '0')}-${thirtyDaysAgo.getDate().toString().padStart(2, '0')} 00:00:00`;
          
          // 查询积分明细
          const res = await executeSql(`SELECT 时间, 类型, 积分变动 FROM \`${CONFIG.TABLES.COIN_LOG}\` WHERE \`邮箱\`='${setMarks(mail)}' AND \`时间\` >= '${setMarks(thirtyDaysAgoStr)}' ORDER BY \`时间\` DESC LIMIT 100`);
          
          return new Response(JSON.stringify(res), { headers: corsHeaders });
          
        } catch (error) {
          console.error('获取积分明细失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "获取积分明细失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 17. 广告奖励
      if (mode === "ad_reward") {
        const mail = body.mail || url.searchParams.get("mail");
        
        // 验证必填字段
        if (!mail) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          // 1. 获取用户信息
          const userInfoRes = await executeSql(`SELECT 昵称, 头像, 积分 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(mail)}' LIMIT 1`);
          if (!userInfoRes.fields || userInfoRes.fields.length === 0) {
            return new Response(JSON.stringify({ code: 404, msg: "用户不存在" }), { headers: corsHeaders });
          }
          
          const user = userInfoRes.fields[0];
          const currentUserCoin = parseInt(user.积分 || 0);
          
          // 2. 构建时间字符串（增加8小时，解决时区问题）
          const now = new Date();
          now.setHours(now.getHours() + 8);
          const timeStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          const timestamp = Math.floor(Date.now() / 1000);
          
          // 3. 开始事务操作
          // 3.1 新增积分明细
          await executeSql(`INSERT INTO \`${CONFIG.TABLES.COIN_LOG}\` (邮箱, 类型, 积分变动, 时间, appid, createdAt, updatedAt) VALUES ('${setMarks(mail)}', '观看广告奖励', '+3', '${setMarks(timeStr)}', '', '${timestamp}', '${timestamp}')`);
          
          // 3.2 更新用户积分
          await executeSql(`UPDATE \`${CONFIG.TABLES.USER}\` SET \`积分\`='${currentUserCoin + 3}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(mail)}'`);
          
          return new Response(JSON.stringify({ code: 200, msg: "广告奖励领取成功" }), { headers: corsHeaders });
          
        } catch (error) {
          console.error('广告奖励失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "广告奖励失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 18. 更新头像
      if (mode === "update_avatar") {
        const { mail, avatar } = body;
        
        // 验证必填字段
        if (!mail || !avatar) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          const timestamp = Math.floor(Date.now() / 1000);
          
          // 1. 更新用户表中的头像
          await executeSql(`UPDATE \`${CONFIG.TABLES.USER}\` SET \`头像\`='${setMarks(avatar)}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(mail)}'`);
          
          // 2. 更新消息表中的发起人头像
          await executeSql(`UPDATE \`${CONFIG.TABLES.MSG}\` SET \`发起人头像\`='${setMarks(avatar)}', updatedAt='${timestamp}' WHERE \`发起人邮箱\`='${setMarks(mail)}'`);
          
          // 3. 更新评论表中的头像
          await executeSql(`UPDATE \`${CONFIG.TABLES.COMMENT}\` SET \`头像\`='${setMarks(avatar)}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(mail)}'`);
          
          return new Response(JSON.stringify({ code: 200, msg: "头像更新成功" }), { headers: corsHeaders });
        } catch (error) {
          console.error('更新头像失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "更新头像失败：" + error.message }), { headers: corsHeaders });
        }
      }

      // 19. 更新昵称
      if (mode === "update_nickname") {
        const { mail, nickname } = body;
        
        // 验证必填字段
        if (!mail || !nickname) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          const timestamp = Math.floor(Date.now() / 1000);
          
          // 1. 更新用户表中的昵称
          await executeSql(`UPDATE \`${CONFIG.TABLES.USER}\` SET \`昵称\`='${setMarks(nickname)}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(mail)}'`);
          
          // 2. 更新消息表中的发起人昵称
          await executeSql(`UPDATE \`${CONFIG.TABLES.MSG}\` SET \`发起人昵称\`='${setMarks(nickname)}', updatedAt='${timestamp}' WHERE \`发起人邮箱\`='${setMarks(mail)}'`);
          
          // 3. 更新评论表中的用户字段
          await executeSql(`UPDATE \`${CONFIG.TABLES.COMMENT}\` SET \`用户\`='${setMarks(nickname)}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(mail)}'`);
          
          // 4. 更新应用表中的用户字段
          await executeSql(`UPDATE \`${CONFIG.TABLES.APP}\` SET \`用户\`='${setMarks(nickname)}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(mail)}'`);
          
          return new Response(JSON.stringify({ code: 200, msg: "昵称更新成功" }), { headers: corsHeaders });
        } catch (error) {
          console.error('更新昵称失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "更新昵称失败：" + error.message }), { headers: corsHeaders });
        }
      }

      // 20. 更新个性签名
      if (mode === "update_bio") {
        const { mail, bio } = body;
        
        // 验证必填字段
        if (!mail) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          const timestamp = Math.floor(Date.now() / 1000);
          
          // 更新用户表中的个性签名
          await executeSql(`UPDATE \`${CONFIG.TABLES.USER}\` SET \`个性签名\`='${setMarks(bio || "")}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(mail)}'`);
          
          return new Response(JSON.stringify({ code: 200, msg: "个性签名更新成功" }), { headers: corsHeaders });
        } catch (error) {
          console.error('更新个性签名失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "更新个性签名失败：" + error.message }), { headers: corsHeaders });
        }
      }

      // 21. 更新背景图片
      if (mode === "update_background") {
        const { mail, background } = body;
        
        // 验证必填字段
        if (!mail || !background) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          const timestamp = Math.floor(Date.now() / 1000);
          
          // 更新用户表中的背景图片
          await executeSql(`UPDATE \`${CONFIG.TABLES.USER}\` SET \`背景图片\`='${setMarks(background)}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(mail)}'`);
          
          return new Response(JSON.stringify({ code: 200, msg: "背景图片更新成功" }), { headers: corsHeaders });
        } catch (error) {
          console.error('更新背景图片失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "更新背景图片失败：" + error.message }), { headers: corsHeaders });
        }
      }

      // 22. 更新密码
      if (mode === "update_password") {
        const { mail, password } = body;
        
        // 验证必填字段
        if (!mail || !password) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          const timestamp = Math.floor(Date.now() / 1000);
          
          // 更新用户表中的密码
          await executeSql(`UPDATE \`${CONFIG.TABLES.USER}\` SET \`密码\`='${setMarks(password)}', updatedAt='${timestamp}' WHERE \`邮箱\`='${setMarks(mail)}'`);
          
          return new Response(JSON.stringify({ code: 200, msg: "密码更新成功" }), { headers: corsHeaders });
        } catch (error) {
          console.error('更新密码失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "更新密码失败：" + error.message }), { headers: corsHeaders });
        }
      }

      // 23. 获取消息列表
      if (mode === "get_messages") {
        const mail = body.mail || url.searchParams.get("mail");
        const type = body.type || url.searchParams.get("type");
        
        // 验证必填字段
        if (!mail) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          // 构建查询条件
          let whereClause = `WHERE \`接受人邮箱\`='${setMarks(mail)}' AND \`是否删除\`='否' AND \`发起人邮箱\`!='${setMarks(mail)}'`;
          if (type) {
            whereClause += ` AND \`类型\`='${setMarks(type)}'`;
          }
          
          // 查询消息列表
          const res = await executeSql(`SELECT * FROM \`${CONFIG.TABLES.MSG}\` ${whereClause} ORDER BY createdAt DESC LIMIT 100`);
          
          return new Response(JSON.stringify(res), { headers: corsHeaders });
          
        } catch (error) {
          console.error('获取消息列表失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "获取消息列表失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 19. 删除用户分享的应用
      if (mode === "delete_user_app") {
        const { id, mail } = body;
        
        // 验证必填字段
        if (!id || !mail) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          // 执行删除操作
          const deleteSql = `DELETE FROM \`${CONFIG.TABLES.APP}\` WHERE id='${setMarks(id)}' AND \`邮箱\`='${setMarks(mail)}'`;
          const res = await executeSql(deleteSql);
          
          if (res.code === 200) {
            return new Response(JSON.stringify({ code: 200, msg: "删除成功" }), { headers: corsHeaders });
          } else {
            return new Response(JSON.stringify({ code: 500, msg: "删除失败：" + (res.msg || "未知错误") }), { headers: corsHeaders });
          }
        } catch (error) {
          console.error('删除应用失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "删除失败：" + error.message }), { headers: corsHeaders });
        }
      }

      // 20. 星标应用
      if (mode === "star_app") {
        const { id, mail } = body;
        
        // 验证必填字段
        if (!id || !mail) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          // 验证应用是否存在
          const appInfoRes = await executeSql(`SELECT id FROM \`${CONFIG.TABLES.APP}\` WHERE id='${setMarks(id)}' LIMIT 1`);
          if (!appInfoRes.fields || appInfoRes.fields.length === 0) {
            return new Response(JSON.stringify({ code: 404, msg: "应用不存在" }), { headers: corsHeaders });
          }
          
          // 更新应用星标排行
          const timestamp = Math.floor(Date.now() / 1000);
          await executeSql(`UPDATE \`${CONFIG.TABLES.APP}\` SET \`星标排行\`='星标', updatedAt='${timestamp}' WHERE id='${setMarks(id)}'`);
          
          return new Response(JSON.stringify({ code: 200, msg: "星标成功" }), { headers: corsHeaders });
        } catch (error) {
          console.error('星标应用失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "星标失败：" + error.message }), { headers: corsHeaders });
        }
      }

      // 20. 修改消息已读状态
      if (mode === "mark_message_read") {
        const mail = body.mail || url.searchParams.get("mail");
        const createdAt = body.createdAt || url.searchParams.get("createdAt");
        
        // 验证必填字段
        if (!mail || !createdAt) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          // 修改消息已读状态
          const res = await executeSql(`UPDATE \`${CONFIG.TABLES.MSG}\` SET \`是否已读\`='是', updatedAt='${Math.floor(Date.now() / 1000)}' WHERE \`接受人邮箱\`='${setMarks(mail)}' AND createdAt='${setMarks(createdAt)}'`);
          
          return new Response(JSON.stringify({ code: 200, msg: "消息已标记为已读" }), { headers: corsHeaders });
          
        } catch (error) {
          console.error('修改消息已读状态失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "修改消息已读状态失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 20. 一键已读所有消息
      if (mode === "mark_all_read") {
        const mail = body.mail || url.searchParams.get("mail");
        
        // 验证必填字段
        if (!mail) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          // 修改所有消息已读状态
          const res = await executeSql(`UPDATE \`${CONFIG.TABLES.MSG}\` SET \`是否已读\`='是', updatedAt='${Math.floor(Date.now() / 1000)}' WHERE \`接受人邮箱\`='${setMarks(mail)}' AND \`是否删除\`='否'`);
          
          return new Response(JSON.stringify({ code: 200, msg: "所有消息已标记为已读" }), { headers: corsHeaders });
          
        } catch (error) {
          console.error('一键已读失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "一键已读失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 21. 删除消息
      if (mode === "delete_message") {
        const mail = body.mail || url.searchParams.get("mail");
        const createdAt = body.createdAt || url.searchParams.get("createdAt");
        
        // 验证必填字段
        if (!mail || !createdAt) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          // 修改消息删除状态
          const res = await executeSql(`UPDATE \`${CONFIG.TABLES.MSG}\` SET \`是否删除\`='是', updatedAt='${Math.floor(Date.now() / 1000)}' WHERE \`接受人邮箱\`='${setMarks(mail)}' AND createdAt='${setMarks(createdAt)}'`);
          
          return new Response(JSON.stringify({ code: 200, msg: "消息已删除" }), { headers: corsHeaders });
          
        } catch (error) {
          console.error('删除消息失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "删除消息失败：" + error.message }), { headers: corsHeaders });
        }
      }

      // 22. 应用审核通过
      if (mode === "approve_app") {
        const { appid, mail } = body;
        
        // 验证必填字段
        if (!appid || !mail) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          // 获取管理员信息
          const adminInfo = await executeSql(`SELECT 昵称, 头像 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(mail)}' LIMIT 1`);
          if (!adminInfo.fields || adminInfo.fields.length === 0) {
            return new Response(JSON.stringify({ code: 404, msg: "管理员不存在" }), { headers: corsHeaders });
          }
          
          const admin = adminInfo.fields[0];
          
          // 获取应用信息
          const appInfo = await executeSql(`SELECT 名称, 邮箱 FROM \`${CONFIG.TABLES.APP}\` WHERE id='${setMarks(appid)}' LIMIT 1`);
          if (!appInfo.fields || appInfo.fields.length === 0) {
            return new Response(JSON.stringify({ code: 404, msg: "应用不存在" }), { headers: corsHeaders });
          }
          
          const app = appInfo.fields[0];
          const appName = app.名称;
          const appOwnerMail = app.邮箱;
          
          // 更新应用状态为推荐
          const timestamp = Math.floor(Date.now() / 1000);
          await executeSql(`UPDATE \`${CONFIG.TABLES.APP}\` SET \`是否推荐\`='推荐', updatedAt='${timestamp}' WHERE id='${setMarks(appid)}'`);
          
          // 发送通知消息
          const msgContent = `你的应用《${appName}》已通过审核`;
          await executeSql(`INSERT INTO \`${CONFIG.TABLES.MSG}\` (
            发起人邮箱, 发起人昵称, 发起人头像, 发起人内容, 接受人邮箱, 时间, appid, rootid, parentid, 是否删除, 是否已读, 类型, createdAt, updatedAt
          ) VALUES (
            '${setMarks(mail)}', 
            '${setMarks(admin.昵称)}', 
            '${setMarks(admin.头像 || '')}', 
            '${setMarks(msgContent)}', 
            '${setMarks(appOwnerMail)}', 
            '${timestamp}', 
            '${setMarks(appid)}', 
            '', 
            '', 
            '否', 
            '否', 
            '通知', 
            '${timestamp}', 
            '${timestamp}'
          )`);
          
          return new Response(JSON.stringify({ code: 200, msg: "审核通过" }), { headers: corsHeaders });
          
        } catch (error) {
          console.error('审核通过失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "审核通过失败：" + error.message }), { headers: corsHeaders });
        }
      }

      // 23. 应用审核下架
      if (mode === "reject_app") {
        const { appid, mail, reason } = body;
        
        // 验证必填字段
        if (!appid || !mail || !reason) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少必要字段" }), { headers: corsHeaders });
        }
        
        try {
          // 获取管理员信息
          const adminInfo = await executeSql(`SELECT 昵称, 头像 FROM \`${CONFIG.TABLES.USER}\` WHERE \`邮箱\`='${setMarks(mail)}' LIMIT 1`);
          if (!adminInfo.fields || adminInfo.fields.length === 0) {
            return new Response(JSON.stringify({ code: 404, msg: "管理员不存在" }), { headers: corsHeaders });
          }
          
          const admin = adminInfo.fields[0];
          
          // 获取应用信息
          const appInfo = await executeSql(`SELECT 名称, 邮箱 FROM \`${CONFIG.TABLES.APP}\` WHERE id='${setMarks(appid)}' LIMIT 1`);
          if (!appInfo.fields || appInfo.fields.length === 0) {
            return new Response(JSON.stringify({ code: 404, msg: "应用不存在" }), { headers: corsHeaders });
          }
          
          const app = appInfo.fields[0];
          const appName = app.名称;
          const appOwnerMail = app.邮箱;
          
          // 更新应用状态为未通过
          const timestamp = Math.floor(Date.now() / 1000);
          await executeSql(`UPDATE \`${CONFIG.TABLES.APP}\` SET \`是否推荐\`='未通过', updatedAt='${timestamp}' WHERE id='${setMarks(appid)}'`);
          
          // 发送通知消息
          const msgContent = `你的应用《${appName}》未能通过审核，原因：${reason}`;
          await executeSql(`INSERT INTO \`${CONFIG.TABLES.MSG}\` (
            发起人邮箱, 发起人昵称, 发起人头像, 发起人内容, 接受人邮箱, 时间, appid, rootid, parentid, 是否删除, 是否已读, 类型, createdAt, updatedAt
          ) VALUES (
            '${setMarks(mail)}', 
            '${setMarks(admin.昵称)}', 
            '${setMarks(admin.头像 || '')}', 
            '${setMarks(msgContent)}', 
            '${setMarks(appOwnerMail)}', 
            '${timestamp}', 
            '${setMarks(appid)}', 
            '', 
            '', 
            '否', 
            '否', 
            '通知', 
            '${timestamp}', 
            '${timestamp}'
          )`);
          
          return new Response(JSON.stringify({ code: 200, msg: "审核下架" }), { headers: corsHeaders });
          
        } catch (error) {
          console.error('审核下架失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "审核下架失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      // 24. 获取更多版本应用
      if (mode === "get_more_apps") {
        const baoming = body.baoming || url.searchParams.get("baoming");
        
        // 验证必填字段
        if (!baoming) {
          return new Response(JSON.stringify({ code: 400, msg: "缺少包名参数" }), { headers: corsHeaders });
        }
        
        try {
          const res = await executeSql(`SELECT * FROM \`${CONFIG.TABLES.APP}\` WHERE 包名='${setMarks(baoming)}' AND 是否推荐='推荐' ORDER BY createdAt DESC`);
          return new Response(JSON.stringify(res), { headers: corsHeaders });
        } catch (error) {
          console.error('获取更多版本应用失败:', error);
          return new Response(JSON.stringify({ code: 500, msg: "获取更多版本应用失败：" + error.message }), { headers: corsHeaders });
        }
      }
      
      return new Response(JSON.stringify({ code: 404, msg: "Invalid Mode" }), { headers: corsHeaders });

    } catch (e) {
      return new Response(JSON.stringify({ code: 500, msg: e.message }), { headers: corsHeaders });
    }
  }
};

async function md5(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("MD5", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

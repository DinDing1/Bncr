/**
 * This file is part of the Bncr project.
 * @author Womian
 * @name wxKv
 * @team Bncr团队
 * @version 1.0.1
 * @description Kv适配器
 * @adapter true
 * @public true
 * @disable false
 * @priority 2
 * @Copyright ©2024 womian. All rights reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 */
/**
 * 目前只实现了 文本消息 图片  好友申请  适配表情
 */
/* 配置构造器 */

const jsonSchema = BncrCreateSchema.object({
  enable: BncrCreateSchema.boolean().setTitle('是否开启适配器').setDescription(`设置为关则不加载该适配器`).setDefault(false),
  kvUrl: BncrCreateSchema.string().setTitle('KvUrl').setDescription(`酷V框架所在的Url`).setDefault(''),
  friendEnable: BncrCreateSchema.boolean().setTitle('自动通过好友申请开关').setDescription(`自动通过好友`).setDefault(false),
  kvToken: BncrCreateSchema.string().setTitle('KvToken').setDescription(`酷V生成的token`).setDefault(''),
  Information:BncrCreateSchema.string().setTitle('申请好友验证信息').setDescription(`用于验证的信息`).setDefault(''),
}).setTitle('Kv适配器');

const ConfigDB = new BncrPluginConfig(jsonSchema);
module.exports = async () => {
  /* 读取用户配置 */
  await ConfigDB.get();
  /* 如果用户未配置,userConfig则为空对象{} */
  if (!Object.keys(ConfigDB.userConfig).length) {
      sysMethod.startOutLogs('未配置Kv适配器,退出.');
      return;
  }
  if (!ConfigDB?.userConfig?.enable) {
    sysMethod.startOutLogs('未配置Kv适配器,退出.');
    return;
  }
  //读取 用户设置的配置
  const kvUrl = ConfigDB.userConfig.kvUrl ;
  const kvToken = ConfigDB.userConfig.kvToken ;
  const friendEnable=ConfigDB.userConfig.friendEnable;
  const Information=ConfigDB.userConfig.Information;

  await sysMethod.testModule(['request'], { install: true });
  //初始化设置
  const wxKv = new Adapter('wxKv');
  const request = require('util').promisify(require('request'));
  const KvDB = new BncrDB('wxKv');
  let botId = await KvDB.get('Kv_botid', ''); //自动设置，无需更改
  router.get('/api/bot/Kv', (req, res) => res.send({ msg: '这是Bncr Kv Api接口，你的get请求测试正常~，请用post交互数据' }));
  router.post('/api/bot/Kv', async (req, res) => {
      try {
          const body = req.body;
          //防止自己消息无限回调
          if (body.final_from_wxid === body.account_wxid) return `拒收该消息:${body.data.content}`;
          //自动设置 botId
          if (botId !== body.account_wxid) {
              botId = await KvDB.set('Kv_botid', body.account_wxid, { def: body.account_wxid });
          }
          /**
           * 事件类型  10020 私聊| 10019 群聊 |10013 群事件 | 10024 好友申请
           */
          if ([10020,10019,10013,10024].indexOf(body.event_type) === -1) return `拒收该消息类型:${body.data.content}`;
          let msgInfo = null;
          //私聊
          if (body.event_type === 10020) {
              msgInfo = {
                  msgType: body.data.msgtype,
                  userId: body.data.final_from_wxid || '',
                  userName: body.data.final_from_name || '',
                  groupId: '0',
                  groupName: '',
                  msg: body.data.content || '',
                  msgId: body.data.createtime || '',
                  fromType: `Social`,
              };
              //群
          } else if (body.event_type === 10019) {
              msgInfo = {
                  msgType: body.data.msgtype,
                  userId: body.data.final_from_wxid || '',
                  userName: body.data.final_from_name || '',
                  groupId: body.data.from_wxid.replace('@chatroom', '') || '0',
                  groupName: body.data.from_name,
                  msg: body.data.content || '',
                  msgId: body.data.createtime || '',
                  fromType: `Social`,
              }
              //好友申请
          } else if (body.event_type === 10024) {
              msgInfo = {
                  msgType: body.data.msgtype,
                  userId: body.data.from_wxid || '',
                  userName: body.data.from_name || '',
                  msg: body.data.content || '',
                  msgId: body.data.createtime || '',
                  fromType: `Social`,
              }
              if (friendEnable && body.data.content === Information){
                  param =
                      {
                          "api": 23,
                          "selfid": botId,
                          "data": {
                              "targetid": body.data.from_wxid,
                              "type": "2",
                              "Svrid": body.data.SvrId,
                              "subset": "",
                              "remarks": body.data.from_name
                          }
                      }
                  await request({
                      url: kvUrl,
                      method: 'post',
                      body: param,
                      json: true,
                      headers: {
                          "X-Token": kvToken,  
                          "Content-Type": "application/json",
                      },
                  })
                  return;
              }
          }else if (body.event_type === 10013){
              msgInfo = {
                  //待实现
              }
          }
          msgInfo && wxKv.receive(msgInfo);
          res.send({ status: 200, data: '', msg: 'ok' });
      } catch (e) {
          console.error('Kv消息接收器错误:', e);
          res.send({ status: 400, data: '', msg: e.toString() });
      }
  });
  //向系统中注入方法
  /*  msgtype: 1, 文本
      msgtype: 2, 图片
      msgtype: 3, 语音
      msgtype: 5, 视频
      msgtype: 37, 好友申请 */
  wxKv.reply = async function (replyInfo) {
      let body = null;
      console.log("当前回复消息体",replyInfo.msg)
      const to_Wxid = +replyInfo.groupId ? replyInfo.groupId + '@chatroom' : replyInfo.userId;
      const subtypeValue = to_Wxid.includes('@chatroom') ? 2 : 1;
      switch (replyInfo.type){
          case 'text':
              replyInfo.msg = encodeEmoji(replyInfo.msg);
              body = {
                  "api": 4,
                  "selfid": botId,
                  "data": {
                      "targetid": to_Wxid,
                      "subtype": subtypeValue,
                      "msg": replyInfo.msg
                  }
              };
              break;
          case 'image':
              body = {
                  "api": 7,
                  "selfid": botId,
                  "data": {
                      "targetid": to_Wxid,
                      "subtype": subtypeValue,
                      "imagepath": replyInfo.path
                  }
              };
              break;
          case 'video':
              body = {
                  "api": 14,
                  "selfid": botId,
                  "data": {
                      "targetid": to_Wxid,
                      "subtype": subtypeValue,
                      "Videopath": replyInfo.path
                  }
              };
              break;
          default:
              return;
      }
      body && (await requestKv(body));
      return '';      
  };
  /* 推送消息方法 */
  wxKv.push = async function (replyInfo) {
      return this.reply(replyInfo);
  };
  /* wx无法撤回消息 为空 */
  wxKv.delMsg = () => {};
  async function requestKv(body) {
      return (
          await request({
              url: kvUrl,
              method: 'post',
              body: body,
              json: true,
              headers: {
                  "X-Token": kvToken,  
                  "Content-Type": "application/json",
              },
          })
      ).body;
  }
  function encodeEmoji(text) {
    const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F000}-\u{1F02F}]/gu;
    const encodedText = text.replace(emojiPattern, (emoji) => {
        const codePoint = emoji.codePointAt(0);
        return `[@emoji=${codePoint.toString(16)}]`;
    });

    return encodedText;
}
  return wxKv;
};


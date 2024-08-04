/**
 * @author dinding
 * @name moyu
 * @team dinding
 * @version 1.0.0
 * @description 摸鱼插件，通过正则匹配 "摸鱼" 关键字调用摸鱼接口
 * @rule ^(摸鱼)$
 * @admin true
 * @public false
 * @priority 9999
 * @disable false
 * @classification ["娱乐"]
 */

/**
 * 使用BncrPluginConfig全局构造函数规范所有配置文件
 */
const jsonSchema = BncrCreateSchema.object({
  cron: BncrCreateSchema.string()
    .setTitle('定时任务')
    .setDescription('')
    .setDefault('0 0 10 * * *'),
  groupId: BncrCreateSchema.number()
    .setTitle('推送群ID')
    .setDescription('')
    .setDefault(45289120024)
});

/* 完成后new BncrPluginConfig传递该jsonSchema */
const ConfigDB = new BncrPluginConfig(jsonSchema);

/**
 * 插件入口，插件被触发时将运行该function
 * 添加过三斜指令后，
 * 需要对module.exports导出的函数做JSDoc注解，
 * 表明sender是Sender接口，后续输入sender.会出现代码提示
 * @param {Sender} sender
 */
module.exports = async sender => {
  await ConfigDB.get();

  /* 如果用户未配置过插件,userConfig为空对象{} */
  if (!Object.keys(ConfigDB.userConfig).length) {
    return await sender.reply('请先发送"修改无界配置",或者前往前端web"插件配置"来完成插件首次配置');
  }

  const { cron, groupId } = ConfigDB.userConfig;

  // 设置定时任务
  const schedule = require('node-schedule');
  schedule.scheduleJob(cron, async function () {
    try {
      const axios = require('axios');
      const response = await axios.get('https://api.vvhan.com/api/moyu?type=json');
      const data = response.data;

      await sender.reply({
        type: 'image',
        path: data.url,
        groupId: groupId
      });
    } catch (error) {
      console.error('Error fetching data from the API:', error);
      await sender.reply('获取摸鱼信息失败，请稍后再试。');
    }
  });

  // 立即执行一次
  try {
    const axios = require('axios');
    const response = await axios.get('https://api.vvhan.com/api/moyu?type=json');
    const data = response.data;

    await sender.reply({
      type: 'image',
      path: data.url,
      groupId: groupId
    });
  } catch (error) {
    console.error('Error fetching data from the API:', error);
    await sender.reply('获取摸鱼信息失败，请稍后再试。');
  }
};
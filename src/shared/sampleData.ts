export const SAMPLE_LOG_CONTENT = `[2024-06-10 14:32:15] [INFO] Player 玩家剑仙 LOGIN player_id:10086123 ip:192.168.1.100 device:iPhone14,3
[2024-06-10 14:32:20] [INFO] 玩家 10086123 进入主城 长安 player_name:剑仙 level:85
[2024-06-10 14:33:45] [INFO] 玩家 10086123 接收任务 任务ID:quest_00123 任务名称:寻找失落的神剑
[2024-06-10 14:35:22] [INFO] 玩家 10086123 打开背包 player_id:10086123 inventory_size:36
[2024-06-10 14:35:30] [INFO] Item Change player_id:10086123 item_id:item_gold_001 item_name:金币 change:+10000 reason:任务奖励
[2024-06-10 14:36:18] [INFO] 玩家 10086123 使用道具 item_id:item_potion_001 item_name:高级生命药水 quantity:1
[2024-06-10 14:37:45] [INFO] 玩家 10086123 进入战斗 副本:dungeon_dragon_01 怪物:BOSS_暗影龙王
[2024-06-10 14:38:02] [INFO] 战斗中 player_id:10086123 damage:12500 skill:千剑归宗
[2024-06-10 14:38:30] [WARNING] 玩家 10086123 生命值过低 hp:150/5000
[2024-06-10 14:39:15] [INFO] Item Change player_id:10086123 item_id:item_sword_005 item_name:流光剑 change:+1 reason:BOSS掉落
[2024-06-10 14:40:00] [INFO] 玩家 10086123 完成任务 quest_id:quest_00123 奖励经验值:+50000
[2024-06-10 14:41:22] [INFO] 支付成功 player_id:10086123 order_no:PAY20240610144122001 amount:648.00 product:月卡+6480钻石
[2024-06-10 14:41:30] [INFO] Item Change player_id:10086123 item_id:item_diamond_001 item_name:钻石 change:+6480 reason:充值
[2024-06-10 14:42:10] [INFO] 玩家 10086123 发送聊天 channel:世界 content:有人组队刷副本吗？
[2024-06-10 14:43:55] [INFO] 玩家 10086123 与玩家 10086456 组队 player_name:月影
[2024-06-10 14:45:30] [INFO] 玩家 10086123 进入副本 dungeon_id:dungeon_crypt_03
[2024-06-10 14:47:12] [ERROR] 玩家 10086123 在副本中发生异常 error_code:CLIENT_FREEZE_003 描述:客户端无响应超过30秒
[2024-06-10 14:47:45] [ERROR] DISCONNECT player_id:10086123 reason:Connection timeout last_ping:45秒前
[2024-06-10 14:48:20] [INFO] Player LOGIN player_id:10086123 ip:192.168.1.100 重新连接
[2024-06-10 14:48:35] [WARNING] 玩家 10086123 重连后发现背包数据异常 inventory_hash_mismatch
[2024-06-10 14:49:00] [INFO] 系统自动修复背包数据 player_id:10086123 restored_items:3
[2024-06-10 14:50:15] [INFO] 玩家 10086123 打开充值商店 player_id:10086123
[2024-06-10 14:51:02] [INFO] 支付发起 player_id:10086123 order_no:PAY20240610145102002 amount:328.00 product:3280钻石
[2024-06-10 14:51:30] [ERROR] PAYMENT_FAILED player_id:10086123 order_no:PAY20240610145102002 error:支付网关超时
[2024-06-10 14:52:00] [INFO] 玩家 10086123 退出副本 返回主城
[2024-06-10 14:53:45] [INFO] Item Change player_id:10086123 item_id:item_material_012 item_name:龙之鳞片 change:-5 reason:装备强化
[2024-06-10 14:54:00] [INFO] 玩家 10086123 装备强化成功 equip_id:equip_armor_008 强化等级:+8
[2024-06-10 14:55:22] [CRITICAL] 客户端崩溃 player_id:10086123 crash_dump:crash_20240610_145522_ab12cd.dmp
[2024-06-10 15:02:10] [INFO] Player LOGIN player_id:10086123 ip:192.168.1.100 设备:iPhone14,3
[2024-06-10 15:02:30] [INFO] 玩家 10086123 发送聊天 channel:客服 content:GM您好，我刚才充值328元没有到账，还闪退了两次
[2024-06-10 15:03:15] [INFO] 玩家 10086999 LOGIN player_name:逍遥客 level:72
[2024-06-10 15:03:30] [INFO] 玩家 10086999 领取日常奖励 player_id:10086999
[2024-06-10 15:04:12] [INFO] Item Change player_id:10086999 item_id:item_gold_001 item_name:金币 change:+5000 reason:日常奖励
[2024-06-10 15:05:00] [INFO] 玩家 10086999 进入竞技场 arena_rank:1250
[2024-06-10 15:06:45] [INFO] 战斗结束 player_id:10086999 result:win arena_points:+18
[2024-06-10 15:08:20] [ERROR] 玩家 10086123 道具丢失 item_id:item_sword_005 item_name:流光剑 数量:1
[2024-06-10 15:09:00] [WARNING] 玩家 10086123 多次反馈支付异常 feedback_count:3
[2024-06-10 15:10:30] [INFO] 玩家 10086999 退出游戏 LOGOUT player_id:10086999 在线时长:7分15秒
[2024-06-10 15:12:45] [INFO] 系统维护公告 system_notice:服务器将于今晚23:00进行例行维护
`;

export const SAMPLE_LOG_FILE = {
  path: 'sample-data://demo-game.log',
  name: '示例游戏日志.log',
  content: SAMPLE_LOG_CONTENT,
  size: SAMPLE_LOG_CONTENT.length,
};

const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 9000 })

import { getValue, setValue, existKey } from './config/RedisConfig'
// const jwt = require('jsonwebtoken')

const timeInterval = 30000
// 多聊天室的功能
// roomId -> 对应相同的roomId进行广播
let group = {}

wss.on('connection', function (ws) {
    // 初始的心跳连接状态
    ws.isAlive = true

    console.log('one client is connected');
    // 接收客户端的消息
    // ws 是当前客户端
    ws.on('message', function (msg) {
        const msgObj = JSON.parse(msg)
        const roomId = prefix + (msgObj.roomId ? msgObj.roomId : ws.roomId)
        // 进入聊天室
        if (msgObj.event === 'enter') {
            // 当用户进入房间之后，需判断用户的房间是否存在
            // 如果用户房间不存在，则再redis中创建房间，用户保存用户信息
            // 主要是用于统计房间里面的人数，用于后面进行消息发送
            ws.name = msgObj.message
            ws.roomId = msgObj.roomId
            ws.uid = msgObj.uid
            console.log('ws.uid: ', ws.uid)
            // 判断redis中是否有对应的roomId的键值
            const result = await existKey(roomId)
            if (result === 0) {
                // 初始化一个房间数据
                setValue(roomId, ws.uid)
            } else {
                // 已经存在该房间缓存数据
                const arrStr = await getValue(roomId)
                let arr = arrStr.split(',')
                if (arr.indexOf(ws.uid) === -1) {
                    setValue(roomId, arrStr + ',' + ws.uid)
                }
            }
            if (typeof group[ws.roomId] === 'undefined') {
                group[ws.roomId] = 1
            } else {
                group[ws.roomId]++
            }
        }
        // 主动发送消息给客户端
        // ws.send('server: ' + msg)
        // console.log(msg)

        // 鉴权
        /* if (msgObj.event === 'auth') {
            jwt.verify(msgObj.message, 'secret', (err, decode) => {
                if (err) {
                    // websocket 返回前台鉴权失败消息
                    ws.send(JSON.stringify({
                        event: 'noAuth',
                        message: 'please auth again'
                    }))
                    console.log('auth error');
                    return
                } else {
                    // 鉴权通过
                    console.log(decode)
                    ws.isAuth = true
                    return
                }
            })
            return
        } */

        // 拦截非鉴权的请求
        /* if (!ws.isAuth) {
            return
        } */

        // 心跳检测
        if (msgObj.event === 'heartBeat' && msgObj.message === 'pong') {
            ws.isAlive = true
            return
        }

        // 广播消息
        // 获取房间里面所有的用户信息
        const arrStr = await getValue(roomId)
        let users = arrStr.split(',')
        wss.clients.forEach(async (client) => {
            // 过滤自己的客户端
            if (client.readyState === WebSocket.OPEN && client.roomId === ws.roomId) {
                msgObj.name = ws.name
                msgObj.num = group[ws.roomId]
                client.send(JSON.stringify(msgObj))
                // 排除已经发送了消息的客户端 -> 在线
                if (users.indexOf(client.uid) !== -1) {
                    users.splice(users.indexOf(client.uid), 1)
                }
                // 消息缓存：取redis中uid的数据
                let result = await existKey(ws.uid)
                if (result !== 0) {
                    // 存在未发送的离线消息数据
                    let tmpArr = await getValue(ws.uid)
                    let tmpObj = JSON.parse(tmpArr)
                    let uid = ws.uid
                    if (tmpObj.length > 0) {
                        let i = []
                        // 判断该用户的离线缓存数据
                        // 判断用户的房间id是否与当前一直
                        tmpObj.forEach(item => {
                            if (item.roomId === client.roomId && uid === client.uid) {
                                client.send(JSON.stringify(item))
                                i.push(item)
                            }
                        })
                        // 删除已经发送的缓存消息数据
                        if (i.length > 0) {
                            i.forEach(item => {
                                tmpObj.splice(item, 1)
                            })
                        }
                        setValue(ws.uid, JSON.stringify(tmpObj))
                    }
                }
            }
        })

        // 断开了与服务端的用户的id，并且其他的客户端发送了消息
        if (users.length > 0 && msgObj.event === 'message') {
            users.forEach(async (item) => {
                const result = await existKey(item)
                if (result !== 0) {
                    // 说明已经存在其他房间该用户的离线消息数据
                    let userData = await getValue(item)
                    let msgs = JSON.parse(userData)
                    msgs.push({
                        roomId: ws.roomId,
                        ...msgObj
                    })
                    setValue(item, JSON.stringify(msgs))
                } else {
                    // 说明先前这个用户一直在线，并且无离线消息数据
                    setValue(item, JSON.stringify([{
                        roomId: ws.roomId,
                        ...msgObj
                    }]))
                }
            })
        }
    })
    // 当ws客户端离开链接的时候
    ws.on('close', function () {
        if (ws.name) {
            group[ws.roomId]--
        }
        let msgObj = {}
        // 广播消息
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && ws.roomId === client.roomId) {
                msgObj.name = ws.name
                msgObj.num = group[ws.roomId]
                msgObj.event = 'out'
                client.send(JSON.stringify(msgObj))
            }
        })
    })
})

/* setInterval(() => {
    wss.clients.forEach(ws => {
        if (!ws.isAlive && ws.roomId) {
            group[ws.roomId]--
            delete ws['roomId']
            return ws.terminate()
        }
        ws.isAlive = false
        ws.send(JSON.stringify({
            event: 'heartBeat',
            message: 'ping',
            num: group[ws.roomId]
        }))
    })
    // 主动发送心跳检测请求
    // 当客户端返回了消息之后，主动设置flag为在线
}, timeInterval) */
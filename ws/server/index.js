const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 9000 })
const jwt = require('jsonwebtoken')

const timeInterval = 1000
// 多聊天室的功能
// roomId -> 对应相同的roomId进行广播
let group = {}

wss.on('connection', function (ws) {
    // 初始的心跳连接状态
    ws.isAlive = true

    console.log('one client is connected');
    // 接受客户端的消息
    // ws 是当前客户端
    ws.on('message', function (msg) {
        const msgObj = JSON.parse(msg)
        // 进入聊天室
        if (msgObj.event === 'enter') {
            ws.name = msgObj.message
            ws.roomId = msgObj.roomId
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
        if (msgObj.event === 'auth') {
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
        }

        // 拦截非鉴权的请求
        if (!ws.isAuth) {
            return
        }

        // 心跳检测
        if (msgObj.event === 'heartBeat' && msgObj.message === 'pong') {
            ws.isAlive = true
            return
        }

        // 广播消息
        wss.clients.forEach(client => {
            // 过滤自己的客户端
            if (client.readyState === WebSocket.OPEN && client.roomId === ws.roomId) {
                msgObj.name = ws.name
                msgObj.num = group[ws.roomId]
                client.send(JSON.stringify(msgObj))
            }
        })
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

setInterval(() => {
    wss.clients.forEach(ws => {
        if (!ws.isAlive) {
            group[ws.roomId]--
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
}, timeInterval)
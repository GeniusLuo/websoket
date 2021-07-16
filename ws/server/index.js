const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 9000 })

wss.on('connection', function (ws) {
    console.log('one client is connected');
    // 接受客户端的消息
    ws.on('message', function (msg) {
        // 主动发送消息给客户端
        // ws.send('server: ' + msg)

        // 广播消息
        wss.clients.forEach(client => {
            // 过滤自己的客户端
            if (ws !== client && client.readyState === WebSocket.OPEN) {
                client.send(msg)
            }
        })
    })

})
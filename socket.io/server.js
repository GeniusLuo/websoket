const app = require('express')()
const http = require('http').createServer(app)
const io = require('socket.io')(http)

app.get('/', function (req, res) {
    // res.send('Hello World')
    res.sendFile(__dirname + '/index.html')
})

io.on('connection', function (socket) {
    console.log('socket io is connected')
    socket.on('chatEvent', function (msg) {
        console.log('msg from client: ', msg);
        // socket.send('sever says:' + msg)
        // 广播消息 - 用于群聊的那种
        socket.broadcast.emit('ServerMsg', msg)
    })
})

http.listen(9000, function () {
    console.log('server is running on: 9000')
})
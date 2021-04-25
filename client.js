const io = require("socket.io")()
const moment = require("moment")
const MongoClient = require('mongodb').MongoClient
const bcrypt = require('bcrypt')
const SALT_WORK = 10
const clientsrooms = {}
let n1

const uri = "mongodb+srv://Vaibhav-06:Vaibhav@5212@cluster0.up9xg.mongodb.net/Dotandboxes?retryWrites=true&w=majority"
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})



const today = moment()
const gamedate = today.format()
client.connect((err) => {
    if (err) throw err
    //console.log("connected")
    io.on("connection", socket => {
        let login = client.db("Dotandboxes").collection('login')
        socket.on('getlead', () => {
            login.aggregate({
                $sort: {
                    PlayerScore: 1
                }
            }).toArray(function (err, res) {
                if (err) throw err
                let newarr = []
                data = {}
                //console.log(res)
                for (let index = 0; index < res.length; index++) {

                    if (res[index].PlayerScore == undefined) {
                        continue
                    } else if (res[index].PlayerScore.length == 0) {
                        continue
                    } else {
                        val = res[index].PlayerScore.sort((a, b) => {
                            return b - a
                        })
                        user = res[index].username
                        newarr.push({
                            user: user,
                            data: val[0]
                        })
                    }
                }
                socket.emit('leaders', newarr)
            })
        })
        socket.on('sending', (res) => {
            login.find({
                username: res.user
            }).toArray((err, res1) => {
                var data = []
                var ele = {}
                for (let index = 0; index < res1[0].PlayerScore.length; index++) {
                    ele["game" + index] = 0
                    if (res1[0].PlayerScore[index] == res.data) {
                        let mode = res1[0].GameMode[index]
                        let date = res1[0].date[index]
                        data = {
                            m: mode,
                            d: date,
                            user: res.user,
                            score: res.data
                        }
                        socket.emit('finallist', data)
                    }
                }
            })
        })
        socket.on('newgame', handlenewgame)
        socket.on('joingame', handleJoingame)
        socket.on('fire', handlenewFire)


        function handlenewFire(id) {
            // //console.log(id)
            io.sockets.in(id.room).emit('fire', id)
        }

        function handlenewgame(n) {
            let roomname = makeid(5)
            clientsrooms[socket.id] = roomname
            socket.emit('gameCode', roomname)
            socket.join(roomname)
            socket.number = 1
            n1 = n
            socket.emit('init', 1)
        }

        function handleJoingame(gameCode) {
            const room = io.sockets.adapter.rooms[gameCode.room]
            let allUsers
            if (room) {
                allUsers = room.sockets
            }
            let numclients = 0
            if (allUsers) {
                numclients = Object.keys(allUsers).length
            }
            if (numclients == 0) {
                socket.emit('unknowngame')
                return
            } else if (numclients > 1) {
                socket.emit('toomany')
                return
            }
            socket.broadcast.emit("name", gameCode)
            clientsrooms[socket.id] = gameCode.room
            socket.join(gameCode.room)
            socket.number = 2
            socket.emit('init', 2)
            let code = {
                n: n1,
                room: gameCode.room,
            }
            socket.emit('gameCodeforJoin', code)
        }

        socket.on('submit', function (data) {
            let user = data.name
            let pwd = data.password
            if (user == "" || pwd == "") {
                //console.log('Empty field signup')
            } else {
                login.find({
                    username: user
                }).toArray(function (err, res) {
                    if (err) throw err
                    if (res.length === 0) {
                        bcrypt.hash(pwd, SALT_WORK, function (err, hash) {
                            if (err) throw err
                            pwd = hash
                            //console.log(hash)
                            login.insertOne({
                                username: user,
                                password: pwd
                            })
                            //console.log("new user:" + user)
                            socket.emit('verified', {
                                username: user,
                                password: pwd,
                                GameMode: null,
                                Result: null,
                                PlayerScore: null
                            })

                        })
                    } else {
                        socket.emit('result', res)
                    }
                })
            }
        })

        socket.on('submitLogin', function (data) {
            let userLogin = data.name
            let pwdLogin = data.password
            if (userLogin == "" || pwdLogin == "") {
                //console.log('Empty field signup')
            } else {
                login.find({
                    username: userLogin
                }).toArray(function (err, result) {
                    if (err) throw err
                    if (result.length === 0) {
                        //console.log('fail')
                        socket.emit('loginfail', result)
                    } else {
                        bcrypt.compare(pwdLogin, result[0].password, function (err, hash) {
                            if (err) throw err
                            if (hash == true) {
                                //console.log('succes')
                                socket.emit('verified', result[0])
                            } else {
                                socket.emit('passfail', result[0])
                            }
                        })
                    }
                })
            }
        })
        socket.on('get', (data) => {
            login.find({
                username: data.username
            }).toArray((err, res) => {
                if (err) throw err
                if (res[0].PlayerScore == undefined) {
                    socket.emit('not')
                } else {
                    socket.emit('recentdata', res)
                }
            })
        })
        socket.on('display', (data) => {
            login.find({
                username: data.username
            }).toArray(function (err, res) {
                if (err) throw err
                /*const newarr = res[0].date.sort((a, b) => {
                    return moment(b).diff(a)
                })*/
                if (res[0].Result == undefined) return
                socket.emit('desc', res[0].Result.length)
                var counts = {}
                var mode = {}
                counts.total = res[0].Result.length
                mode.total = res[0].Result.length
                res[0].Result.forEach(function (x) {
                    counts[x] = (counts[x] || 0) + 1
                })
                res[0].GameMode.forEach(function (x) {
                    mode[x] = (mode[x] || 0) + 1
                })

                socket.emit('modep', mode)
                socket.emit('wonlose', counts)
            })
        })
        socket.on('res', (data) => {
            let player = data.scoreP
            let computer = data.scoreC
            let acc = data.data
            let query = {
                username: acc.username
            }
            let playW = {
                $push: {
                    GameMode: data.game,
                    Result: 'Player Wins',
                    PlayerScore: player,
                    date: new Date().toLocaleDateString()

                }
            }

            let compW = {
                $push: {
                    GameMode: data.game,
                    Result: 'Computer Wins',
                    PlayerScore: player,
                    date: new Date().toLocaleDateString()
                }
            }

            let EneW = {
                $push: {
                    GameMode: data.game,
                    Result: 'Enemy Wins',
                    PlayerScore: player,
                    date: new Date().toLocaleDateString()
                }
            }

            if (player > computer) {
                login.updateOne(query, playW, function (err, res) {
                    if (err) throw err
                    //console.log("updated")
                })
            } else {
                if (data.game == 'Multi') {
                    login.updateOne(query, EneW, function (err, res) {
                        if (err) throw err
                        //console.log("updated")
                    })
                } else {
                    login.updateOne(query, compW, function (err, res) {
                        if (err) throw err
                        //console.log("updated")
                    })
                }
            }
        })
    })

})

function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
io.listen(process.env.PORT || 3000)
/* ###################################################################### */
require('dotenv').config();
const SERVER_HOST = process.env.SERVER_HOST;
const SERVER_PORT = process.env.SERVER_PORT;
const PEER_PORT = process.env.PEER_PORT;
const OPTION_KEY = process.env.OPTION_KEY;

let https = require('https');
let url = require('url');
let fs = require('fs');
let {PeerServer} = require('peer');
let yt = require('./function/yt');

/* ---------------------------------------- */
const options = {
    'localhost': {
        cert: fs.readFileSync(__dirname + '/cert/localhost/localhost.pem'),
        key: fs.readFileSync(__dirname + '/cert/localhost/localhost-key.pem')
    },
    'Azure': {
        ca: fs.readFileSync(__dirname + '/cert/etc/ssl/ca_bundle.crt'),
        cert: fs.readFileSync(__dirname + '/cert/etc/ssl/certificate.crt'),
        key: fs.readFileSync(__dirname + '/cert/etc/private/private.key')
    }
}

let myPeerServer = PeerServer({ 
    ssl: options[OPTION_KEY],
    port: PEER_PORT, 
    path: '/'
});

/* ---------------------------------------- */
let server;
let server_io;
let roomCount = 0;
let room_arr = [];
let roomName_arr = [];

let master = {};
let masterid = {};
let speaker_arr = {};

let userid_arr = {};
let username_arr = {};
let socket_arr = {};

let chat_history = {};
let music_list = {};
let yt_arr = {};

let lastTime = {};
const command_def = `====================
-- 播放音樂
play YouTube-URL
play KeyWord

-- 暫停播放
pause

-- 繼續播放
resume

-- 跳過目前歌曲
skip

-- 重複目前歌曲
loop

-- 取消重複歌曲
unloop

-- 清除歌單
clear

-- 查看歌單 (個人)
list

-- 清除訊息 (個人)
cls
====================`;

/* ###################################################################### */
function get_MusicList(roomId) {
    if (!music_list[roomId][0]) return '--No Music--';
    let message = '====================\n';
    music_list[roomId].map( (music, i) => {
        if (i != 0) message += `\n\nMusic ${i} : ${music.title}`;
        else  message += `*Now Playing : ${music.title}`;
    });
    message += '\n====================';
    return message;
}

function play_nextMusic(roomId, socketid) {
    if (music_list[roomId][0]) {
        music_list[roomId].shift();
        if (music_list[roomId][0]) {
            server_io.in(roomId).emit('yt-stream', music_list[roomId][0].url);
            server_io.in(roomId).emit('musicroom-refresh', socketid, `Music Start | ${music_list[roomId][0].title}`);
            socket_arr[roomId].map( (socket2) => {
                let index = yt_arr[roomId].indexOf(socket2);
                if (index != -1) yt_arr[roomId].splice(index, 1);
            });
        }
    }
}

/* send command to clients */
function ctrl_BOT(roomId, socket, command, speaker) {
    switch (command) {
        case 'yt':
            socket.emit('musicroom-refresh', socket.id, command_def);
            return true;
        case 'cls':
            socket.emit('musicroom-clean');
            return true;
        case 'clear':
            if (speaker) {
                music_list[roomId] = [music_list[roomId][0]];
                server_io.in(roomId).emit('musicroom-refresh', socket.id, '--Music Clear--');
            } else {
                socket.emit('musicroom-refresh', socket.id, '--權限不夠--');
            }
            return true;
        case 'list':
            socket.emit('musicroom-refresh', socket.id, get_MusicList(roomId));
            return true;
        case 'pause':
            if (speaker) {
                if (music_list[roomId][0]) {
                    server_io.in(roomId).emit('yt-operate', 'pause');
                    server_io.in(roomId).emit('musicroom-refresh', socket.id, '--Music Pause--');
                } else {
                    socket.emit('musicroom-refresh', socket.id, '--No Music playing--');
                }
            } else {
                socket.emit('musicroom-refresh', socket.id, '--權限不夠--');
            }
            return true;
        case 'resume':
            if (speaker) {
                if (music_list[roomId][0]) {
                    server_io.in(roomId).emit('yt-operate', 'resume');
                    server_io.in(roomId).emit('musicroom-refresh', socket.id, '--Music Resume--');
                } else {
                    socket.emit('musicroom-refresh', socket.id, '--No Music playing--');
                }
            } else {
                socket.emit('musicroom-refresh', socket.id, '--權限不夠--');
            }
            return true;
        case 'skip':
            if (speaker) {
                if (music_list[roomId][0]) {
                    server_io.in(roomId).emit('yt-operate', 'skip');
                    server_io.in(roomId).emit('musicroom-refresh', socket.id, '--Music Skip--');
                    play_nextMusic(roomId, socket.id);
                } else {
                    socket.emit('musicroom-refresh', socket.id, '--No Music playing--');
                }
            } else {
                socket.emit('musicroom-refresh', socket.id, '--權限不夠--');
            } 
            return true;
        case 'loop':
            if (speaker) {
                if (music_list[roomId][0]) {
                    server_io.in(roomId).emit('yt-operate', 'loop');
                    server_io.in(roomId).emit('musicroom-refresh', socket.id, '--Music Loop--');
                } else {
                    socket.emit('musicroom-refresh', socket.id, '--No Music playing--');
                }
            } else {
                socket.emit('musicroom-refresh', socket.id, '--權限不夠--');
            }
            return true;
        case 'unloop':
            if (speaker) {
                if (music_list[roomId][0]) {
                    server_io.in(roomId).emit('yt-operate', 'unloop');
                    server_io.in(roomId).emit('musicroom-refresh', socket.id, '--Music Unloop--');
                } else {
                    socket.emit('musicroom-refresh', socket.id, '--No Music playing--');
                }
            } else {
                socket.emit('musicroom-refresh', socket.id, '--權限不夠--');
            }
            return true;
    }
    return false;
}

/* find yt streaming url and send to clients */
function find_ytStream(roomId, socket, URL, KEYWORD) {
    yt.getStream_by_URL(URL, 'audioonly')
    .then( (result) => {
        if (!music_list[roomId][0]) {
            server_io.in(roomId).emit('yt-stream', result.url);
            server_io.in(roomId).emit('musicroom-refresh', socket.id, `Music Start | ${result.title}`);
        } else {
            server_io.in(roomId).emit('musicroom-refresh', socket.id, `Add To List | ${result.title}`);
        }
        music_list[roomId] = [...music_list[roomId], result];
        socket_arr[roomId].map( (socket2) => {
            let index = yt_arr[roomId].indexOf(socket2);
            if (index != -1) yt_arr[roomId].splice(index, 1);
        });
    }).catch( (error) => {
        if (error == 'Regional Restriction') {
            socket.emit('musicroom-refresh', socket.id, '--Regional Restriction--');
        } else {
            yt.getStream_by_KEYWORD(KEYWORD, 'audioonly')
            .then((result) => {
                if (!music_list[roomId][0]) {
                    server_io.in(roomId).emit('yt-stream', result.url);
                    server_io.in(roomId).emit('musicroom-refresh', socket.id, `Music Start | ${result.title}`);
                } else {
                    server_io.in(roomId).emit('musicroom-refresh', socket.id, `Add To List | ${result.title}`);
                }
                music_list[roomId] = [...music_list[roomId], result];
                socket_arr[roomId].map( (socket2) => {
                    let index = yt_arr[roomId].indexOf(socket2);
                    if (index != -1) yt_arr[roomId].splice(index, 1);
                });
            }).catch( (error) => {
                socket.emit('musicroom-refresh', socket.id, '--Not Found--');
            });
        }
    });
}

/* ###################################################################### */
server = https.createServer(options[OPTION_KEY], (request, response) => {
    let parent = __dirname.replace('private', 'public');
    let path = url.parse(request.url).pathname;
    switch (path) {
        case '/':
            path = '/index.html';
        case '/js/main.js':
        case '/media/icon/mic-off.png':
        case '/media/icon/mic-on.png':
        case '/media/icon/earphone.png':
            fs.readFile(parent + path, (error, data) => {
                if (error) {
                    response.writeHead(404);
                    response.write("page dose not exist - 404");
                } else {
                    response.writeHead(200, {'Content-Type': 'text/html'});
                    response.write(data, 'utf-8');
                }
                response.end();
            })
            break;
        case '/media/sound/join.mp3':
            try {
                let mp3 = fs.readFileSync(parent + path);
                response.writeHead(200, {'Content-Type': 'audio/mpeg'});
                response.write(mp3);
            } catch {
                response.writeHead(404);
                response.write("page dose not exist - 404");
            }
            response.end();
            break;
        default:
            response.writeHead(404);
            response.write("page dose not exist - 404");
            response.end();
            break;
    }
});

/* ###################################################################### */
server_io = require('socket.io')(server, {
    pingTimeout: 5000,
    pingInterval: 10000
});

server_io.on('connection', (socket) => {
    socket.emit('room-list', room_arr, roomName_arr);

    socket.on('join-room', (roomId, roomName) => {
        /* socket join room */
        if (roomId == 'creat') {
            roomId = 'Room-' + String(roomCount);
            roomCount += 1;
            room_arr = [...room_arr, roomId];
            roomName_arr = [...roomName_arr, roomName];
            master[roomId] = null;
            masterid[roomId] = null;
            speaker_arr[roomId] = [];
            userid_arr[roomId] = [];
            username_arr[roomId] = [];
            socket_arr[roomId] = [];
            chat_history[roomId] = [];
            music_list[roomId] = [];
            yt_arr[roomId] = [];
            lastTime[roomId] = Date.now();
            server_io.emit('room-list', room_arr, roomName_arr);
        }
        socket.join(roomId);

        /* when somebody disconnect */
        socket.on('disconnect', () => {
            let index = socket_arr[roomId].indexOf(socket);
            if (index != -1) {
                /* find the left one from arr */
                let leaveid =  userid_arr[roomId][index];
                if (leaveid == masterid[roomId]) {
                    master[roomId] = null;
                    masterid[roomId] = null;
                }
                /* remove the left one in arr */
                socket_arr[roomId].splice(index, 1);
                userid_arr[roomId].splice(index, 1);
                username_arr[roomId].splice(index, 1);
                index = yt_arr[roomId].indexOf(socket);
                if (index != -1) yt_arr[roomId].splice(index, 1);
                index = speaker_arr[roomId].indexOf(leaveid);
                if (index != -1) speaker_arr[roomId].splice(index, 1);
                /* update clients data */
                server_io.in(roomId).emit('speaker-refresh', speaker_arr[roomId], false, null);
                server_io.in(roomId).emit('all-user-id', userid_arr[roomId], username_arr[roomId], null);
                server_io.in(roomId).emit('someone-left', leaveid, (masterid[roomId] == null));
                server_io.in(roomId).emit('close-video-all' + leaveid);
                server_io.in(roomId).emit('close-audio' + leaveid);
                /* clear chatroom if nobody online */
                if (!socket_arr[roomId][0]) {
                    chat_history[roomId] = [];
                    music_list[roomId] = [];
                    delete master[roomId];
                    delete masterid[roomId];
                    delete speaker_arr[roomId];
                    delete userid_arr[roomId];
                    delete username_arr[roomId];
                    delete socket_arr[roomId];
                    delete chat_history[roomId];
                    delete music_list[roomId];
                    delete yt_arr[roomId];
                    delete lastTime[roomId];
                    let index = room_arr.indexOf(roomId);
                    if (index != -1) room_arr.splice(index, 1);
                    if (index != -1) roomName_arr.splice(index, 1);
                }
            }
        });

        /* when somebody enter main page */
        socket.on('new-user-request', (userid, username, level) => {
            if (socket_arr[roomId].indexOf(socket) == -1) {
                if (level == 'host') {
                    master[roomId] = socket;
                    masterid[roomId] = userid;
                }
                socket_arr[roomId] = [...socket_arr[roomId], socket];
                userid_arr[roomId] = [...userid_arr[roomId], userid];
                username_arr[roomId] = [...username_arr[roomId], username];
                yt_arr[roomId] = [...yt_arr[roomId], socket];
                server_io.in(roomId).emit('speaker-refresh', speaker_arr[roomId], false, null);
                server_io.in(roomId).emit('new-user-id', userid);
                server_io.in(roomId).emit('all-user-id', userid_arr[roomId], username_arr[roomId], masterid[roomId]);
                socket.emit('chat-history', chat_history[roomId]);
                socket.emit('musicroom-refresh', '', get_MusicList(roomId));
            }
        });

        /* somebody send a message in chatroom */
        socket.on('new-chat-message', (message) => {
            if (socket_arr[roomId].indexOf(socket) != -1) {
                chat_history[roomId] = [...chat_history[roomId], message];
                server_io.in(roomId).emit('chatroom-refresh', socket.id, message);
            }
        });

        /* ---------------------------------------- */
        /* somebody send a message in commandroom */
        socket.on('new-music-command', (message) => {
            let exist = socket_arr[roomId].indexOf(socket) != -1;
            let index = socket_arr[roomId].indexOf(socket);
            index =  (index != -1)? speaker_arr[roomId].indexOf(userid_arr[roomId][index]): -1;
            let speaker = index != -1 || socket == master[roomId];
            if (exist && speaker) {
                let prefix = message.slice(0, 5);
                let URL = message.replace(prefix, '');
                let KEYWORD = message.replace(prefix, '');
                let command = message.replaceAll(' ', '').replaceAll('\n', '');
                if (prefix == 'play ') find_ytStream(roomId, socket, URL, KEYWORD);
                else if (!ctrl_BOT(roomId, socket, command, true)) socket.emit('musicroom-refresh', socket.id, '--Invalid Input--');
            } else if (exist) {
                let prefix = message.slice(0, 5);
                let command = message.replaceAll(' ', '').replaceAll('\n', '');
                if (prefix == 'play ') socket.emit('musicroom-refresh', socket.id, '--權限不夠--');
                else if (!ctrl_BOT(roomId, socket, command, false)) socket.emit('musicroom-refresh', socket.id, '--Invalid Input--');
            }
        });
        /* when music audio ended */
        socket.on('yt-ended', () => {
            let Time = Date.now();
            if (Time - lastTime[roomId] > 1800) {
                lastTime[roomId] = Time;
                play_nextMusic(roomId, '');
            }
        });
        /* get client music audio streaming time... */
        socket.on('yt-music-state', (pack) => {
            yt_arr[roomId].map( (socket2) => {
                socket2.emit('join-yt-stream', pack);
            });
            socket_arr[roomId].map( (socket2) => {
                let index = yt_arr[roomId].indexOf(socket2);
                if (index != -1) yt_arr[roomId].splice(index, 1);
            });
        });

        /* ---------------------------------------- */
        /* somebody stop capture */
        socket.on('stop-videoStream', (userid, streamId, other) => {
            server_io.in(roomId).emit('close-video' + userid + streamId, other);
        });
        socket.on('stop-audioStream', (userid) => {
            server_io.in(roomId).emit('close-audio' + userid);
        });
        
        /* ---------------------------------------- */
        socket.on('share-request', (userid) => {
            if (master[roomId] && socket_arr[roomId].indexOf(socket) != -1) master[roomId].emit('share-request', userid);
        });
        socket.on('request-result', (userid, result) => {
            if (socket == master[roomId]) {
                let socket2 = socket_arr[roomId][userid_arr[roomId].indexOf(userid)];
                if (result == true || result == '授權') {
                    speaker_arr[roomId] = [...speaker_arr[roomId], userid];
                    server_io.in(roomId).emit('speaker-refresh', speaker_arr[roomId], false, userid);
                } else if (result == '收回') {
                    let index = speaker_arr[roomId].indexOf(userid);
                    let taken = (index != -1)? speaker_arr[roomId][index]: null;
                    if (index != -1) speaker_arr[roomId].splice(index, 1);
                    server_io.in(roomId).emit('speaker-refresh', speaker_arr[roomId], true, taken);
                }
                socket2.emit('request-result', result);
            } else {
                socket.emit('warn');
            }
        });
    
    });
});

/* ###################################################################### */
myPeerServer.listen();
server.listen(SERVER_PORT, SERVER_HOST);
console.log('start');
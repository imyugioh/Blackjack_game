var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io').listen(http);
var bodyParser = require('body-parser');
const _ = require('underscore');
var mongoose = require('mongoose');
var usermodel = require('./model/user');
var tablemodel = require('./model/table');
var historymodel = require('./model/history');
var crypto = require('./component/crypto');

var port = process.env.PORT || 3000;

const server = '127.0.0.1:27017';
const database = 'blackjack';

//database connect
mongoose.connect(`mongodb://${server}/${database}`, {useCreateIndex: true, useNewUrlParser : true}).then(() => {
  console.log('Database connection successful')
})
.catch(err => {
  console.error('Database connection error')
});

app.use(bodyParser.urlencoded({ extended: true }));

app.set('views','./views');
app.set('view engine','ejs');
app.use(express.static('./public'));

app.get('/', function(req, res){
  res.render('index');
});

app.get('/users', async function(req, res){
  let alluser = await usermodel.find({}).exec();
  res.render('users', {users: alluser, decrypt: crypto.decrypt});
});

app.get('/tables', async function(req, res){
  let alltable = await tablemodel.find({}).exec();
  res.render('tables', {tables: alltable});
});

app.post('/users/edit/', async function(req, res){
  await usermodel.findOneAndUpdate({_id : mongoose.Types.ObjectId(req.body.userid)}, {username:req.body.username, password:req.body.password, email: req.body.email, gender:req.body.gender=='Man' ? 1 : 2, credits:crypto.encrypt(req.body.credits), gold: req.body.gold, bitcoin_id:req.body.bitcoinid}, {upsert:true, new:true}).then(function(res){
    console.log('User Updated');
  });
  res.redirect('/users');
});

app.post('/users/add/', async function(req, res){
  console.log(req.body);
  let newuser = new usermodel({username:req.body.username, password:req.body.password, email: req.body.email, gender:req.body.gender, credits:crypto.encrypt(req.body.credits), gold: req.body.gold, bitcoin_id:req.body.bitcoinid});
  newuser.save().then(result=>{
    res.status(200).json({success:true});
  }).catch((err) => {
    console.log(err);
    res.status(400).json({success:false});
  });
});

app.delete('/users', async function(req, res){
  const { userid } = req.query;
  await usermodel.findOneAndRemove({_id : mongoose.Types.ObjectId(userid)}, {new:true}).then(function(result){
    if (result == null)
      return res.status(404).json({success: false});
    console.log('User Deleted');
  });
  res.status(200).json({success: true});
});

app.delete('/tables', async function(req, res){
  const { objectid, tableid } = req.query;
  await tablemodel.findOneAndRemove({_id : mongoose.Types.ObjectId(objectid)}, {new:true}).then(function(result){
    console.log(result);
    if (result == null)
      return res.status(404).json({success: false});
    console.log('Table Deleted');
    roomlist.splice(parseInt(tableid) - 1, 1);
  });
  res.status(200).json({success: true});
});

app.post('/tables/edit/', async function(req, res){
  let tableindex = parseInt(req.body.tableid) - 1;
  await tablemodel.findOneAndUpdate({_id: mongoose.Types.ObjectId(req.body.tableobjid)}, {table_name:req.body.tablename, buyin_limit:req.body.buyinlimit, raise_min:req.body.raisemin, raise_max:req.body.raisemax, customed:req.body.customed == "Default" ? false:true, Max_player:req.body.maxplayer, Min_player:req.body.minplayer}, {upsert:true, new:true}).then(function(res) {
    console.log('Table Updated');
     roomlist[tableindex].name = req.body.tablename;
     roomlist[tableindex].buy_in_limit = parseInt(req.body.buyinlimit);
     roomlist[tableindex].raise_min = parseInt(req.body.raisemin);
     roomlist[tableindex].raise_max = parseInt(req.body.raisemax);
     roomlist[tableindex].customed = req.body.customed == "Default" ? false:true;
     roomlist[tableindex].max_player = parseInt(req.body.maxplayer);
     roomlist[tableindex].min_player = parseInt(req.body.minplayer);
  });
  res.redirect('/tables');
});

app.post('/tables/add/', async function(req, res){
  const {table_name, buyin_limit, raise_min, raise_max, customed, Max_player, Min_player} = req.body;
  let newtable = new tablemodel({table_name, buyin_limit, raise_min, raise_max, customed, Max_player, Min_player});
  newtable.save().then(result=>{
    console.log('Table Added');
    initRoom(roomlist.length, table_name, parseInt(buyin_limit), parseInt(raise_min), parseInt(raise_max), customed == "true" ? true : false, parseInt(Max_player), parseInt(Min_player));
    res.status(200).json({success:true});
  }).catch((err) => {
    console.log(err);
    res.status(400).json({success:false});
  });
});

//define variables

// let players = [];  //real game players

// var initPlayer = function(id, name, money, roomID) {
//     this.id = id;
//     this.name = name;
//     this.money = money;
//     this.betMoney = 0;
//     this.totalScore = 0;
//     this.hand = [];
//     this.roomID = roomID;
// }

let roomlist = [];
let allUsers = [];
let loggedUsers = [];
var MAX_PLAYER = 2;
var MIN_PLAYER = 2;
var maxBet=0;
var casinoSharePercent=1;
var customTableCreated = false;

//define functions

function saveRoomMessage(data)
{
  //save to database
  console.log("Doing something creepy with data.");
  return `${data.name} : ${data.text}`
}

function getRoomList()
{
  let trimmedRoomList = [];

  for(var i = 0; i < roomlist.length; i++)
  {
    let room = {
      name: roomlist[i].name,
      raise_max: roomlist[i].raise_max,
      raise_min: roomlist[i].raise_min,
      buy_in_limit: roomlist[i].buy_in_limit,
      customTableCreated: roomlist[i].customTableCreated,
      currentPlayerCount: roomlist[i].players.length,
      max_player: roomlist[i].max_player,
      customed : roomlist[i].customed,
    };

    trimmedRoomList.push(room);
  }

  return JSON.stringify(trimmedRoomList);
}

function resetRoom(roomId)
{
  let room = roomlist[roomId];
  console.log("Reset Room function called.");
  if(room)
  {
    room.total_bet = 0;
    room.maximum_bet = 0;
    room.prev_maximum_bet = 0;
    room.turnIndex = 0;
    room.previousRound = "";
    room.currentRound = "intitial";
    room.hitBlackjack = false;
    room.tempPlayerId = "";
    room.hitBlackjack =false;

    if(room.customed && room.customTableCreated)
    {
      room.customTableCreated = false;
      console.log("Custom Room Cleared.");
    }

    for(var i = 0; i < room.rounds.length; i++)
    {
      console.log(room.rounds[i].round +" reset.");
      room.rounds[i].completed = false;
    }
    console.log("Room refreshed.");
  }
}

function initRoom(id, name, buy_in_limit, raise_min, raise_max, customed, maxplayer, minplayer)
{
  roomlist[id] = {};
  roomlist[id].name = name;
  roomlist[id].tempPlayerId = "";
  roomlist[id].lastWinnerID = "";
  roomlist[id].buy_in_limit = buy_in_limit;
  roomlist[id].raise_min = raise_min;
  roomlist[id].raise_max = raise_max;
  roomlist[id].customed = customed;
  roomlist[id].customTableCreated = false;
  roomlist[id].max_player = maxplayer;
  roomlist[id].min_player = minplayer;
  roomlist[id].total_bet  = 0; // to be reset at start of every game
  roomlist[id].maximum_bet = 0; //maximum bet of this game by some player
  roomlist[id].prev_maximum_bet = 0;
  roomlist[id].players = [];
  roomlist[id].turnIndex = 0;
  roomlist[id].previousRound = "";
  roomlist[id].currentRound = "initial";
  roomlist[id].hitBlackjack = false;
  roomlist[id].intervalID = null;
  roomlist[id].rounds = [{
	  round: "Betting Round",
	  timeOut: 30,
	  completed: false,
    raiseLimit: "unlimited"
  },
  {
	 round: "Blackjack Round",
	 timeOut: 45,
	 completed: false,
   raiseLimit: 1
  },
  {
	  round: "Hitting Round",
	  timeOut: 15,
	  completed: false,
    raiseLimit: "unlimited"
  },
  {
    round: "Hitting Round Completion",
    timeOut: 15,
    completed: false,
    raiseLimit: "unlimited"
  },
  {
    round: "Game Completed",
    timeOut: 15,
    completed: false,
    raiseLimit: "unlimited"
  }];
}

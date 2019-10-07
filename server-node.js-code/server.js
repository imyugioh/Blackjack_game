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

function initDefaultRooms()
{
  // createTimer(10, function(value){
  //   console.log(value +" Tick Tock");
  // },
  // function(){
  //   console.log("ITS WORKING!!!!");
  // });

  console.log("Rooms initialized.");
  //for the test
  //save to database
  tablemodel.countDocuments(function(err, res) {
    if (err) return console.log(err);
    if (!res) {
      initRoom(0, "Room 1", 500, 20, 100, false, MAX_PLAYER, MIN_PLAYER);
      initRoom(1, "Room 2", 1000, 50, 300, false, MAX_PLAYER, MIN_PLAYER);
      initRoom(2, "Room 3", 1500, 50, 400, false, MAX_PLAYER, MIN_PLAYER);
      initRoom(3, "Room 4", 700, 10, 50, false, MAX_PLAYER, MIN_PLAYER);
      initRoom(4, "Room 5", 5000, 500, 1200, false, MAX_PLAYER, MIN_PLAYER);
      initRoom(5, "Room 6", 0, 0, 0, true, MAX_PLAYER, MIN_PLAYER);

      tablemodel.insertMany([{table_name: "Room 1", buyin_limit: 500, raise_min: 20, raise_max: 100, customed: false, Max_player: MAX_PLAYER, Min_player: MIN_PLAYER},
      {table_name: "Room 2", buyin_limit: 1000, raise_min: 50, raise_max: 300, customed: false, Max_player: MAX_PLAYER, Min_player: MIN_PLAYER},
      {table_name: "Room 3", buyin_limit: 1500, raise_min: 50, raise_max: 400, customed: false, Max_player: MAX_PLAYER, Min_player: MIN_PLAYER},
      {table_name: "Room 4", buyin_limit: 700, raise_min: 10, raise_max: 50, customed: false, Max_player: MAX_PLAYER, Min_player: MIN_PLAYER},
      {table_name: "Room 5", buyin_limit: 5000, raise_min: 500, raise_max: 1200, customed: false, Max_player: MAX_PLAYER, Min_player: MIN_PLAYER},
      {table_name: "Room 6", buyin_limit: 0, raise_min: 0, raise_max: 0, customed: true, Max_player: MAX_PLAYER, Min_player: MIN_PLAYER}],
      {ordered: true}, function(err, res){
        if (err) return console.log(err);
        console.log("Table Created");
      });
    } else {
      tablemodel.find({}, function(err, res){
        for(var i = 0;i < res.length;i ++) {
          initRoom(i, res[i].table_name, res[i].buyin_limit, res[i].raise_min, res[i].raise_max, res[i].customed, res[i].Max_player, res[i].Min_player);
        }
      })
      console.log('Tables already exist');
    }
  });
  //end
}

function saveChathistory(info) {
  let newchat = new historymodel({channel: info.channel, from: info.sender, message: info.message});
  newchat.save().then(function(res) {
    console.log(res);
  });
  return info;
}

function GenerateRoom()
{
  var count = 0;
  for (var i = 0; i < roomlist.length;i++)
  {
    if (roomlist[i].players.length == roomlist[i].max_player)
      count++;
  }
  if (count == roomlist.length)
    initRoom(roomlist.length, 0, 0, 0, true);
}

function checkRoomFull(room)
{
  if (room.players.length == room.max_player)
    return true;
  return false;
}

function updateTotalBet(data,socketChannel)
{
	roomlist[socketChannel].total_bet +=data ;
	console.log("this bet is of "+data +" and Total bet on table is : " + roomlist[socketChannel].total_bet +" while maximum bet is: " +roomlist[socketChannel].maximum_bet);
}

function updateBetAccepted(data,socketChannel)
{
	for(var i = 0; i < roomlist[socketChannel].players.length; i++) {
		if(roomlist[socketChannel].players[i].id != data){
		roomlist[socketChannel].players[i].betAccepted=false;
		}
	}
}

function switchTurn(playerId, socketChannel)
{
  var user = _.findWhere(roomlist[socketChannel].players, {id:playerId});
  var someData = {
      id : playerId,
      betAccepted : user.betAccepted,
      currentRound : roomlist[socketChannel].currentRound
  };

  var playerIdNum = playerId;
  var roomChannel = socketChannel;

  io.in(roomChannel).emit('switchTurn', someData);
  console.log(someData.id +" Turn!");

  createTimer(30, function(retValue){
    timerStarted(retValue, roomChannel, playerIdNum)
  }, function(){
    switch (roomlist[roomChannel].currentRound) {
      case "Betting Round":

        // switch (roomlist[socketChannel].previousRound) {
        //   case "Blackjack Round":
        //   console.log(user.name+" not responded in blackjack round => betting round, forcing accept bet.");
        //   io.in(socketChannel).emit('OnForcedAcceptBet', {id: user.id});
        //   break;
        //   case "Hitting Round":
        //   console.log(user.name+" not responded in hitting round => betting round, forcing accept bet.");
        //   io.in(socketChannel).emit('OnForcedAcceptBet', {id: user.id});
        //   break;
        //   default:
        // }

      console.log("User not responded in betting round, forcing forfeit.");
      io.in(roomChannel).emit('OnForcedForfeit', {id: user.id});
      break;
      case "Blackjack Round":
        if(user)
        {
          if(!user.hasChecked)
          {
            console.log("User not responded in blackjack round, forcing check.");
            io.in(roomChannel).emit('OnForcedChecked', {id: user.id});
          }
        }
      break;
      case "Hitting Round":
      if(user)
      {
        if(!user.standTaken && !user.hasChecked)
        {
          console.log("User not responded in hitting round, forcing stand.");
          io.in(roomChannel).emit('OnForcedStand', {id: user.id});
        }else if(user.standTaken && !user.hasChecked)
        {
          console.log("User not responded in hitting round, forcing check.");
          io.in(roomChannel).emit('OnForcedChecked', {id: user.id});
        }
      }
      break;
      case "Hitting Round Completion":
      if(user)
      {
        if(!user.hasChecked)
        {
          console.log("User not responded in Hitting Round Completion, forcing check.");
          io.in(roomChannel).emit('OnForcedChecked', {id: user.id});
        }
      }
      break;
      default:
    }
    console.log("ITS WORKING!!!!");
  }, roomChannel);
}

function createTimer(timeOut, intervalFunction, endFunction, roomid)
{
  console.log("Create Timer function called.");
  let seconds = timeOut;

  if(roomlist[roomid].intervalID != null)
  {
    clearInterval(roomlist[roomid].intervalID);
    roomlist[roomid].intervalID = null;
  }

  roomlist[roomid].intervalID = setInterval(function() {
        seconds = seconds - 1 >= 0 ? seconds - 1 : 0;
        let progress = seconds / timeOut;

        let data = {
          duration: seconds,
          progress: progress,
          totalTimeOut: timeOut
        }

        intervalFunction(data);
        if(seconds <= 0)
        {
          clearInterval(roomlist[roomid].intervalID);
          endFunction();
          console.log("interval cleared.");
        }
    }, 1000);
}

function timerStarted(value, socketChannel, playerID)
{
  value.id = playerID;
  io.in(socketChannel).emit('OnTimerUpdated', value);
}

function timerCompleted(socketChannel, playerId)
{
  console.log("ITS WORKING!!!!");
}

function destroyTimer(socketChannel)
{
  if(roomlist[socketChannel].intervalID != null)
  {
    clearInterval(roomlist[socketChannel].intervalID);
    roomlist[socketChannel].intervalID = null;
    console.log("timer destroyed.");
  }
}

function getRound(round, socketChannel){
  let roundData = _.findWhere(roomlist[socketChannel].rounds, {round:round});
  return roundData;
}

function distributeInsuranceAmount(socketChannel,winnerId){
    for(var i = 0; i < roomlist[socketChannel].players.length; i++)
    {
      if(roomlist[socketChannel].players[i].id != winnerId && roomlist[socketChannel].players[i].insuranceAccepted){
        console.log("blackjack insurance mil gyi name = " + roomlist[socketChannel].players[i].name);
        roomlist[socketChannel].players[i].gold += (roomlist[socketChannel].players[i].insuredAmount + roomlist[socketChannel].players[i].goldOnTable)/2;
        roomlist[socketChannel].total_bet -= roomlist[socketChannel].players[i].goldOnTable/4;
        roomlist[socketChannel].players[i].goldOnTable =0;
        roomlist[socketChannel].players[i].insuranceAccepted=false;
        io.in(socketChannel).emit('OnStakeUpdated', roomlist[socketChannel].players[i]);
      }
    }
}

function checkWinner(socketChannel)
{
  let winner = [];
    let totalWinners=0;
    for(var i = 0; i < roomlist[socketChannel].players.length; i++)
    {
    if(roomlist[socketChannel].players[i].points == 21){
      winner[totalWinners]=roomlist[socketChannel].players[i];
      console.log(winner[0].name + " is winner with points: " +winner[0].points + " total winners "+ totalWinners+1) ;
      totalWinners++;
      distributeInsuranceAmount(socketChannel,roomlist[socketChannel].players[i].id);
    }
  }
  if(totalWinners == 1 && !winner[0].won)
   {
     //if only one player has blackjack
     winner[0].won = true;
     let winningUser= _.findWhere(roomlist[socketChannel].players,{id: winner[0].id});
     if(winningUser){
      console.log("winning user in blackjack round is");
      console.log(winningUser);
      console.log("////////////////////////////////////");

     }
	 deductCasinoShare(socketChannel);
     winner[0].gold +=roomlist[socketChannel].total_bet;
     winner[0].goldOnTable =0;
     console.log(winner[0].name + " is winner with points: " +winner[0].points);
     for(var i = 0; i < roomlist[socketChannel].players.length; i++){
      roomlist[socketChannel].players[i].won =true;
       if(winner[0].id != roomlist[socketChannel].players[i].id){
         roomlist[socketChannel].players[i].goldOnTable = 0;
       }

       roomlist[socketChannel].currentRound = "Game Completed";
       io.in(socketChannel).emit('OnBlackjack', roomlist[socketChannel].players[i]);
       io.in(socketChannel).emit('OnStakeUpdated', roomlist[socketChannel].players[i]);

       roomlist[socketChannel].lastWinnerID = winner[0].id;
     }
     //Hitting round should not start as a player has blackjack in blackjack round
   }
   else if(totalWinners > 1){
     //if multiple players have blackjack
	  deductCasinoShare(socketChannel);
     for(var i = 0; i < winner.length; i++){
       if(!winner[i].won)
       {
         winner[i].won = true;
         winner[i].gold += roomlist[socketChannel].total_bet / winner.length;
         winner[0].goldOnTable =0;
       }
     }
     for(var i = 0; i < roomlist[socketChannel].players.length; i++){
       roomlist[socketChannel].players[i].goldOnTable = 0;
       roomlist[socketChannel].players[i].won =true;
     }

     roomlist[socketChannel].currentRound = "Game Completed";
     io.in(socketChannel).emit('OnStakeUpdated', roomlist[socketChannel].players[i]);
     io.in(socketChannel).emit('OnDraw', roomlist[socketChannel].players[i]);

     //Hitting round should not start as multiple players have blackjack in blackjack round
   }
   else {
     if(roomlist[socketChannel].currentRound === "Blackjack Round")
     {
       roomlist[socketChannel].rounds[1].completed = true;
       roomlist[socketChannel].currentRound = "Hitting Round";

       for(var i = 0; i < roomlist[socketChannel].players.length; i++)
       {
         if(roomlist[socketChannel].players[i].insuranceAccepted){
          roomlist[socketChannel].total_bet += roomlist[socketChannel].players[i].insuredAmount;
          roomlist[socketChannel].players[i].insuranceAccepted = false;
          roomlist[socketChannel].players[i].insuredAmount = 0;
          io.in(socketChannel).emit('TotalBetUpdated', roomlist[socketChannel].total_bet);
         }
         roomlist[socketChannel].players[i].currentRaiseInLimit = roomlist[socketChannel].players[i].maxRaiseInLimit = roomlist[socketChannel].rounds[2].raiseLimit;
       }

       roomlist[socketChannel].turnIndex =  roomlist[socketChannel].turnIndex + 1 >= roomlist[socketChannel].players.length ? 0 : roomlist[socketChannel].turnIndex + 1;
       let user = roomlist[socketChannel].players[roomlist[socketChannel].turnIndex];
       console.log(user.currentRaiseInLimit);

       switchTurn(user.id,socketChannel);
       console.log("Hitting Round Started.");
     }
   }
}

function checkMaxRaiseLimit(id, socketChannel)
{
  for(var i = 0; i < roomlist[socketChannel].players.length; i++)
  {
    let tempVar = 0;
    if(roomlist[socketChannel].players[i].id != id)
    {
      if(tempVar < roomlist[socketChannel].players[i].gold + roomlist[socketChannel].players[i].goldOnTable)
      {
        tempVar = roomlist[socketChannel].players[i].gold + roomlist[socketChannel].players[i].goldOnTable;

        let data = {
          id: id,
          raiseLimit: tempVar
        }

        io.in(socketChannel).emit('checkMaxRaiseLimit', data);
        return tempVar;
      }
    }
  }
}

//Deducting casinos share
function deductCasinoShare(socketChannel)
{
	let casinoShare= (roomlist[socketChannel].total_bet/ (casinoSharePercent * 100) );
	roomlist[socketChannel].total_bet -= casinoShare;
	io.in(socketChannel).emit('ShowCasinoShare', casinoShare);
}
//checking winner after split case
function checkWinnerAfterSplitting(socketChannel)
{
  console.log("Player array is ");
  console.log(roomlist[socketChannel].players);
  for(var i = 0; i < roomlist[socketChannel].players.length; i++)
  {
    if(roomlist[socketChannel].players[i].hands.length > 0){
      console.log("hand is" );
      console.log( roomlist[socketChannel].players[i].hands[0]);

    }
  }
  // return;
  for(var i = 0; i < roomlist[socketChannel].players.length; i++)
  {
      if(roomlist[socketChannel].players[i].hands.length > 0){
        console.log("hand length > 0");
        deductCasinoShare(socketChannel);

        checkIndividualWinnerAfterSplitting(socketChannel);
        roomlist[socketChannel].players[i].points = roomlist[socketChannel].players[i].hands[0].points ;
      //   for(var i = 0; i < roomlist[socketChannel].players.length; i++){
      //     roomlist[socketChannel].players[i].goldOnTable = 0;
      // }
      // for(var i = 0; i < roomlist[socketChannel].players.length; i++){
      // //io.in(socketChannel).emit('OnStakeUpdated', roomlist[socketChannel].players[i]);

      // }
      roomlist[socketChannel].players[i].points = roomlist[socketChannel].players[i].hands[0].points ;
      let tempUser=_.findWhere(roomlist[socketChannel].players, {id : roomlist[socketChannel].players[i]});
      setTimeout(function() {

        checkIndividualWinnerAfterSplitting(socketChannel);
        io.in(socketChannel).emit('RevealSplitCards', tempUser);
        for(var i = 0; i < roomlist[socketChannel].players.length; i++){
            roomlist[socketChannel].players[i].goldOnTable = 0;
        }
        for(var i = 0; i < roomlist[socketChannel].players.length; i++){
        io.in(socketChannel).emit('OnStakeUpdated', roomlist[socketChannel].players[i]);
        }
      }, 3000);
   }
  }
}

function checkIndividualWinnerAfterSplitting(socketChannel)
{
  let winner = [];
  let bustPlayers = [];
  let temp=[] ;
  let totalWinners = 0;
  let tempPoints = 0;

  for(var i = 0; i < roomlist[socketChannel].players.length; i++)
  {
   if(roomlist[socketChannel].players[i].points > 21){
      bustPlayers.push(roomlist[socketChannel].players[i]);
   }
   else {
     if(winner.length > 0){
       winner[winner.length]=roomlist[socketChannel].players[i];
       for(var j = winner.length-1; j > 0 ; j--){
          if(winner[j].points > winner[j-1].points){
             temp[tempPoints] = winner[j];
             winner[j]=winner[j-1];
             winner[j-1]=temp[tempPoints];
          }
       }
     }else if(winner.length <= 0){
        winner.push(roomlist[socketChannel].players[i]);
     }
   }

  }
  if(bustPlayers.length >0){
       /*for(var i = 0; i < bustPlayers.length; i++){
    winner[winner.length]=bustPlayers[i];
   }*/
  }
  if(winner.length == 0 && bustPlayers.length == roomlist[socketChannel].players.length){
    //all busted players so return them their money
    //return half the money to them as split
    console.log("All Player Busted this round");
    for(var i = 0; i < bustPlayers.length; i++){
    //  if(!bustPlayers[i].isBusted)
    //  {
       bustPlayers[i].isBusted = true;
       bustPlayers[i].gold += bustPlayers[i].goldOnTable/2;
       bustPlayers[i].goldOnTable=bustPlayers[i].goldOnTable/2;
       io.in(socketChannel).emit('OnSplitDraw', winner[0]);
    //}
   }
  }else{
    if(winner.length > 0)  {
     console.log("final winner array is ");
     console.log(winner);
       tempPoints = winner[0].points;
     console.log("tempPoints are " + tempPoints);
    }
   for(var i = 0; i < winner.length; i++){
     if(winner[i].points == tempPoints){
       totalWinners++;
     }
   }
    if(totalWinners == 1){
      //if(!winner[0].won){
        //giving bet money to the winning player
        winner[0].won = true;
        console.log("one winner of this round " + winner[0].name);
        // deductCasinoShare(socketChannel);
        winner[0].gold +=roomlist[socketChannel].total_bet/2;
        io.in(socketChannel).emit('OnSplitWin', winner[0]);

        roomlist[socketChannel].lastWinnerID = winner[0].id;

     // }
    }
    else{
      if(totalWinners == roomlist[socketChannel].players.length ){
        //Draw scenario
        console.log("this round is draw");
        for(var i = 0; i < totalWinners; i++){
          //if(!winner[i].won)
          {
             winner[i].gold += roomlist[socketChannel].total_bet / (totalWinners*2);
             winner[i].won = true;
             io.in(socketChannel).emit('OnSplitDraw');
          }
        }
      }else{
        //giving bet money to the multiple winning players
        console.log("multiple bndey jeet gye");
        //  deductCasinoShare(socketChannel);
         for(var i = 0; i < totalWinners; i++){
        //   if(!winner[i].won)
          {
            winner[i].gold += roomlist[socketChannel].total_bet / (totalWinners*2);
            winner[i].won = true;
            io.in(socketChannel).emit('OnSplitWin', winner[i]);
          }
         }
      }
    }
  }

}
//checking for winner at the end of hitting round

function checkWinnerAfterHitting(socketChannel)
{
   let winner = [];
   let bustPlayers = [];
   let temp=[] ;
   let totalWinners = 0;
   let tempPoints = 0;

   for(var i = 0; i < roomlist[socketChannel].players.length; i++)
   {
    if(roomlist[socketChannel].players[i].points > 21){
       //winner[winner.length]=roomlist[socketChannel].players[i];
       bustPlayers.push(roomlist[socketChannel].players[i]);
    }
    else {
      if(winner.length > 0){
        winner[winner.length]=roomlist[socketChannel].players[i];
        //winner.push(roomlist[socketChannel].players[i]);
        for(var j = winner.length-1; j > 0 ; j--){
           if(winner[j].points > winner[j-1].points){
              temp[tempPoints] = winner[j];
              winner[j]=winner[j-1];
              winner[j-1]=temp[tempPoints];
           }
        }
      }else if(winner.length <= 0){
         winner.push(roomlist[socketChannel].players[i]);
      }
    }

   }
   if(bustPlayers.length >0){
        /*for(var i = 0; i < bustPlayers.length; i++){
     winner[winner.length]=bustPlayers[i];
    }*/
   }
   if(winner.length == 0 && bustPlayers.length == roomlist[socketChannel].players.length){
     //all busted players so return them their money
     console.log("All Player Busted");
     for(var i = 0; i < bustPlayers.length; i++){
      if(!bustPlayers[i].isBusted)
      {
        bustPlayers[i].isBusted = true;
        bustPlayers[i].gold +=roomlist[socketChannel].total_bet /roomlist[socketChannel].players.length;
        bustPlayers[i].goldOnTable=0;
        io.in(socketChannel).emit('OnDraw', winner[0]);
      }
  }
   }else{
     if(winner.length > 0)  {
      console.log("final winner array is ");
      console.log(winner);
        tempPoints = winner[0].points;
      console.log("tempPoints are " + tempPoints);
     }
    for(var i = 0; i < winner.length; i++){
      if(winner[i].points == tempPoints){
        totalWinners++;
      }
    }
  if(totalWinners == 1){
    if(!winner[0].won){
      //giving bet money to the winning player
      winner[0].won = true;
      console.log("one winner " + winner[0].name);
      deductCasinoShare(socketChannel);
      winner[0].gold +=roomlist[socketChannel].total_bet;
      io.in(socketChannel).emit('OnWin', winner[0]);

      roomlist[socketChannel].lastWinnerID = winner[0].id;

    }
  }
  else{
    if(totalWinners == roomlist[socketChannel].players.length ){
      //Draw scenario
      for(var i = 0; i < totalWinners; i++){
        if(!winner[i].won)
        {
          winner[i].gold += roomlist[socketChannel].total_bet / totalWinners;
          winner[i].won = true;
          io.in(socketChannel).emit('OnDraw');
        }
      }
    }else{
    //giving bet money to the multiple winning players
    deductCasinoShare(socketChannel);
    for(var i = 0; i < totalWinners; i++){
      if(!winner[i].won)
      {
        winner[i].gold += roomlist[socketChannel].total_bet / totalWinners;
        winner[i].won = true;
        io.in(socketChannel).emit('OnWin', winner[i]);
      }
    }
  }
  }
   }
 for(var i = 0; i < roomlist[socketChannel].players.length; i++){
      roomlist[socketChannel].players[i].goldOnTable = 0;
  }
for(var i = 0; i < roomlist[socketChannel].players.length; i++){
  io.in(socketChannel).emit('OnStakeUpdated', roomlist[socketChannel].players[i]);
}
}

function analyze(players)
{
 let winner = [];
 let totalWinners=1;
 winner[0]=players[0];

 for(var i = 1; i <= players.length-1; i++)
 {
   //single winner case
   if(i > 0)
   {
     if(winner[0].points < players[i].points)
     {
     // remove all prev indexes and insert on 0th
     winner = [];
     let index = i;
     winner[0]=players[index];
     totalWinners=1;
    }else if(winner[0].points == players[i].points){
     //draw case
     winner[totalWinners]=players[i];
     totalWinners++;
    }
  }
 }

 if(totalWinners > 1)
 {
   console.log("stalemate");
 }else if(totalWinners == 1)
 {
   console.log(winner[0].name + " is winner with points: " +winner[0].points);
 }
}

function checkSplit(socketChannel)
{
let val = roomlist[socketChannel].players.every((val, i, arr) => val.split === true);
console.log(val);
return val;
}

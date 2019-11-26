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
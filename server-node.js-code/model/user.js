let mongoose = require('mongoose');

let userSchema = new mongoose.Schema({
    username: String,
    password: {
        type: String,
        required: true,
    },
    email: {
       type: String,
       unique: true,
       required : true,
    },
    gender: Number,
    credits: String,
    gold: Number,
    bitcoin_id: {
       type: String,
       unique: true,
       required : false,
    },
});

module.exports = mongoose.model('user', userSchema);
let mongoose = require('mongoose');

let tableSchema = new mongoose.Schema({
    table_name : {
        type: String,
        required: true,
    },
    buyin_limit : {
        type: Number,
        required: true,
    },
    raise_min : {
        type: Number,
        required: true,
    },
    raise_max : {
        type: Number,
        required: true,
    },
    customed : {
        type: Boolean,
        required: true,
    },
    Max_player : {
        type: Number,
        required: true,
    },
    Min_player : {
        type: Number,
        required: true,
    }
});

module.exports = mongoose.model('table', tableSchema);
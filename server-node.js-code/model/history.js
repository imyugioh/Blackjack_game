let mongoose = require('mongoose');

let historySchema = new mongoose.Schema({
    channel: {
        type: Number,
        required: true
    },
    from : {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('history', historySchema);
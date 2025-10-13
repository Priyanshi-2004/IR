const mongoose = require('mongoose');
const { MONGO_URI } = require('./server-config.js');

const connectToDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("connected to Database");
    } catch (error) {
        console.log("Error connecting to Database", error);
    }
}

module.exports = {
    connectToDB
};
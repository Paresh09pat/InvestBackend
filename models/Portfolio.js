const { Schema, model } = require("mongoose")

const portfolioSchema = new Schema({
    user:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    


})
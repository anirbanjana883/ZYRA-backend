import mongoose from "mongoose";
import replySchema from "./reply.model.js";

const commentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    replies: [replySchema],
  },
  { timestamps: true }
);

export default commentSchema;

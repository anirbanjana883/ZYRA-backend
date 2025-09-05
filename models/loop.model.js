
import mongoose from "mongoose";
import commentSchema from "./comment.model.js"; 

const loopSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    media: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [commentSchema], 
  },
  { timestamps: true }
);

const Loop = mongoose.models.Loop || mongoose.model("Loop", loopSchema);

export default Loop;
